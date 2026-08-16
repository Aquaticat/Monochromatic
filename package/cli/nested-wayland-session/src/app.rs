//! Program orchestration: build the event loop, wire every source, spawn the client,
//! and run until it exits.
//!
//! `run` is the whole-program entry the binary calls. It stays deliberately thin: each
//! subsystem (backend, state, child, rendering, per-event handling) lives in its own
//! module, and this file only connects them and owns the event loop.

/// What:     Grouped `use` of the winit event enum, the output mode / damage tracker, the
///           event loop, and the display.
/// Why:      `run` and `handle_winit_event` reference these.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { WinitEvent, Mode, OutputDamageTracker, EventLoop, Display } from "smithay";
/// ```
use smithay::{
    backend::{renderer::damage::OutputDamageTracker, renderer::ImportMemWl, winit::WinitEvent},
    output::Mode,
    reexports::{
        calloop::EventLoop,
        wayland_server::Display,
    },
};

/// What:     `use anyhow::{Context, Result};`. Error helpers.
/// Why:      `run` returns `Result<i32>` and annotates setup failures.
use anyhow::{Context, Result};

/// What:     Grouped `use` of our own modules' items.
/// Why:      `run` calls into backend, child, state, and the xdg-shell reconfigure.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { initBackend } from "./backend"; import { spawnChild, ... } from "./child"; ...
/// ```
use crate::{
    appearance_portal::AppearancePortal,
    backend::{init_backend, OUTPUT_REFRESH_MHZ},
    child::{register_exit_poll, spawn_child},
    cli::Config,
    control,
    handler::xdg_shell::reconfigure_fullscreen,
    render::redraw,
    state::Compositor,
    systemd::Isolation,
};

/// Build everything, spawn the hosted client, and run the event loop to completion.
///
/// What:     `pub fn run(config: Config) -> Result<i32>`. Consumes the parsed config,
///           returns the hosted client's exit code (or an error if setup failed).
/// Why:      The single top-level function the binary invokes; returning the code lets
///           `main` propagate it to the shell.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function run(config: Config): number { ... }
/// ```
///
/// @example
/// ```ts
/// const code = run(parseArgs(argv));
/// ```
pub fn run(config: Config) -> Result<i32> {
    // What:     `let mut event_loop: EventLoop<Compositor> = EventLoop::try_new()
    //           .context("creating the calloop event loop")?;`. Creates the loop whose
    //           shared data type is `Compositor`. `mut` because sources are registered
    //           against it. `.context(msg)?` turns a failure into a clean error.
    // Why:      The single event loop drives Wayland clients, winit, the child poll, and
    //           (later) the control socket.
    let mut event_loop: EventLoop<'static, Compositor> =
        EventLoop::try_new().context("creating the calloop event loop")?;

    // What:     `let display: Display<Compositor> = Display::new().context(...)?;`. Creates
    //           the wayland-server display, parameterised by our state type.
    // Why:      Owns all client connections and protocol globals.
    let display: Display<Compositor> = Display::new().context("creating the Wayland display")?;

    // What:     `let display_handle = display.handle();`. A cheap clone of the display's
    //           control handle, taken before the display is moved into the state.
    // Why:      Backend init needs it to register the output and dmabuf globals.
    let display_handle = display.handle();

    // What:     `let (pieces, winit) = init_backend(&display_handle, &config)?;`. Build the
    //           winit backend, output, and dmabuf state; `?` propagates any failure.
    //           `winit` is the event source registered below.
    // Why:      Set up the GPU rendering path before constructing the state.
    let (pieces, winit) = init_backend(&display_handle, &config)?;

    // What:     `let mut state = Compositor::new(&mut event_loop, display, pieces);`.
    //           Construct the full state, consuming the display and backend pieces.
    // Why:      Produce the value the event loop carries.
    let mut state = Compositor::new(&mut event_loop, display, pieces);

    // What:     `let shm_formats = state.backend.renderer().shm_formats();`. Ask the GLES
    //           renderer which shared-memory formats it supports (method from the
    //           `ImportMemWl` trait). Borrows the backend only for this statement.
    // Why:      Advertise exactly those formats so any shm client (e.g. a cursor theme)
    //           uses a format the renderer can upload.
    let shm_formats = state.backend.renderer().shm_formats();

    // What:     `state.shm_state.update_formats(shm_formats);`. Store the format list.
    // Why:      Complete the shm advertisement.
    state.shm_state.update_formats(shm_formats);

    // What:     `let loop_handle = event_loop.handle();`. A handle for registering more
    //           sources.
    // Why:      Used to insert the winit source and the exit poll.
    let loop_handle = event_loop.handle();

    // What:     `loop_handle.insert_source(winit, |event, _, state| { handle_winit_event(
    //           event, state); }).map_err(|err| anyhow::anyhow!(...))?;`. Registers the
    //           winit event source. The closure receives each `WinitEvent`, ignored
    //           metadata (`_`), and `&mut Compositor`. `.map_err(...)?` converts a
    //           registration error into `anyhow`.
    // Why:      Route resize / redraw / close events into the compositor.
    loop_handle
        .insert_source(winit, |event, _, state: &mut Compositor| {
            handle_winit_event(event, state);
        })
        .map_err(|err| anyhow::anyhow!("registering the winit source failed: {err}"))?;

    // What:     `if let Some(socket_path) = &config.control_socket { control::start(
    //           &loop_handle, socket_path)?; }`. When a control socket was requested, bind
    //           it and spawn the control thread; `?` propagates a bind failure.
    // Why:      Enable the screenshot/input/resize control API only when asked.
    if let Some(socket_path) = &config.control_socket {
        control::start(&loop_handle, socket_path)?;
    }

    // What:     `register_exit_poll(&loop_handle);`. Insert the periodic child-exit poll.
    // Why:      Stop the loop when the hosted client exits.
    register_exit_poll(&loop_handle);

    // Start private Settings portal only when deterministic nested appearance was requested.
    let appearance_portal = config
        .color_scheme
        .map(AppearancePortal::start)
        .transpose()
        .context("starting isolated nested appearance")?;

    // What:     `let isolation = Isolation { enabled: config.isolate, cpu_quota_percent:
    //           config.app_cpu_quota, cpu_weight: config.app_cpu_weight };`. Assemble the
    //           CPU-isolation settings from the parsed config.
    // Why:      Passed to `spawn_child`, which isolates the app under systemd or degrades.
    let isolation = Isolation {
        enabled: config.isolate,
        cpu_quota_percent: config.app_cpu_quota,
        cpu_weight: config.app_cpu_weight,
    };

    // Launch client on nested Wayland socket and private appearance bus when configured.
    spawn_child(
        &mut state,
        &config.child_command,
        &isolation,
        appearance_portal.as_ref().map(AppearancePortal::bus_address),
    )?;

    // What:     `state.backend.window().request_redraw();`. Kick off the first frame.
    // Why:      Rendering is self-sustaining after the first request, but something has
    //           to request the initial one.
    state.backend.window().request_redraw();

    // What:     `event_loop.run(None, &mut state, |_| {}).context("event loop failed")?;`.
    //           Runs the loop with no timeout (`None`), the state as shared data, and an
    //           empty per-iteration callback. Returns when `loop_signal.stop()` is called.
    // Why:      This is the program's main blocking loop.
    event_loop
        .run(None, &mut state, |_| {})
        .context("event loop failed")?;

    // What:     `Ok(state.child_exit_code.unwrap_or(0))`. Return the recorded child code,
    //           or 0 if the loop stopped for another reason. Tail expression.
    // Why:      Propagate the hosted app's exit status as our own.
    return Ok(state.child_exit_code.unwrap_or(0));
}

/// Dispatch one winit event: resize the output, redraw, or stop on close.
///
/// What:     `fn handle_winit_event(event: WinitEvent, state: &mut Compositor)`. Private
///           per-event handler.
/// Why:      Keep the event match out of `run` so `run` reads as pure orchestration.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function handleWinitEvent(event, state) { ... }
/// ```
fn handle_winit_event(event: WinitEvent, state: &mut Compositor) {
    // What:     `match event { ... }`. Match the winit event enum. Only the variants the
    //           fixture cares about are handled; `_ => {}` ignores the rest (including
    //           `Input`, since the fixture injects its own input via the control API).
    // Why:      React to the parent window being resized or closed, and to redraw ticks.
    match event {
        WinitEvent::Resized { size, .. } => {
            // What:     `let mode = Mode { size, refresh: OUTPUT_REFRESH_MHZ };`. Build a
            //           new output mode at the new size.
            // Why:      The nested screen resized; update its advertised resolution.
            let mode = Mode {
                size,
                refresh: OUTPUT_REFRESH_MHZ,
            };

            // What:     `state.output.change_current_state(Some(mode), None, None, None);`.
            //           Apply the new mode; keep transform, scale, and position unchanged.
            // Why:      Make the new resolution current.
            state.output.change_current_state(Some(mode), None, None, None);

            // What:     `state.output.set_preferred(mode);`. Mark it preferred.
            // Why:      Clients prefer this mode when choosing a size.
            state.output.set_preferred(mode);

            // What:     `state.damage_tracker = OutputDamageTracker::from_output(
            //           &state.output);`. Replace the damage tracker with one sized to the
            //           new output.
            // Why:      The old tracker's dimensions no longer match the framebuffer.
            state.damage_tracker = OutputDamageTracker::from_output(&state.output);

            // What:     `reconfigure_fullscreen(state);`. Tell every hosted window to
            //           redraw at the new fullscreen size.
            // Why:      Keep the app filling the resized screen.
            reconfigure_fullscreen(state);
        }
        WinitEvent::Redraw => {
            // What:     `redraw(state);`. Composite and present one frame.
            // Why:      A redraw was requested (by us or the parent).
            redraw(state);
        }
        WinitEvent::CloseRequested => {
            // What:     `state.loop_signal.stop();`. End the event loop.
            // Why:      The parent asked the nested window to close.
            state.loop_signal.stop();
        }
        _ => {}
    }
}
