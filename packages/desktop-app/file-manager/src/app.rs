//! The whole-program wiring: install the Slint backend (with the Wayland app-id
//! hook, skipped under the embedded MCP server), build the window, connect its
//! callbacks to the controller, and mirror the instrumentation into the HUD on a
//! timer. Kept in the library so the binary is a one-line call and in-process UI
//! tests can construct the window.

/// What:     `use std::cell::RefCell;` imports single-thread interior mutability
///           for non-`Copy` values (sibling `Cell` for `Copy`, `Mutex` for
///           threads).
/// Why:      Slint callbacks all share one `Controller` and mutate it on the UI
///           thread.
use std::cell::RefCell;

/// What:     `use std::rc::Rc;` imports single-thread reference counting.
/// Why:      Many callbacks need to share the same `RefCell<Controller>`.
use std::rc::Rc;

/// What:     `use std::time::Duration;` imports a time span type (sibling: a raw
///           millisecond integer, which the timer would need wrapped anyway).
/// Why:      The HUD timer takes a typed interval.
use std::time::Duration;

/// What:     `use anyhow::Result;` imports the one-parameter error result alias.
/// Why:      `run` and backend setup use one error channel.
use anyhow::Result;

/// What:     `use i_slint_backend_winit::Backend;` imports Slint's winit backend
///           builder.
/// Why:      The app installs the app-id hook before window creation.
use i_slint_backend_winit::Backend;

/// What:     `use slint::{ComponentHandle, Timer, TimerMode};` imports the trait
///           giving `.as_weak()`/`.run()`, the timer type, and its repeat-mode
///           enum.
/// Why:      Needed to run the window and drive the HUD mirror.
use slint::{ComponentHandle, Timer, TimerMode};

/// What:     `use crate::AppWindow;` imports the Slint-generated window component.
/// Why:      `run` constructs and drives it.
use crate::AppWindow;

/// What:     `use crate::controller::Controller;` imports the app-state owner.
/// Why:      Callbacks delegate to it.
use crate::controller::Controller;

/// What:     `use crate::instrument::Instrumentation;` imports the shared counters.
/// Why:      The HUD mirror reads them.
use crate::instrument::Instrumentation;

/// What:     `use crate::launcher;` imports the app-id hook module.
/// Why:      Backend setup installs `launcher::set_window_app_id`.
use crate::launcher;

/// What:     `use crate::strip::COLUMN_WIDTH_PX;` imports the fixed column width.
/// Why:      The window's `column-width-px` property is set from it.
use crate::strip::COLUMN_WIDTH_PX;

/// What:     `const HUD_REFRESH_MS: u64 = 150;` is the HUD mirror interval.
///           `u64` is what `Duration::from_millis` expects.
/// Why:      Fast enough to feel live, slow enough not to churn.
const HUD_REFRESH_MS: u64 = 150;

/// What:     `const FRAME_TICK_MS: u64 = 16;` is the per-frame reconcile interval
///           (about 60 Hz).
/// Why:      One timer collects finished decodes and applies horizontal window
///           shifts off the render frame, so scrolling never rebuilds the model
///           from inside the Flickable's own change callback.
const FRAME_TICK_MS: u64 = 16;

/// What:     `fn install_backend() -> Result<()>` builds and installs the explicit
///           winit backend with the app-id hook, unless the embedded MCP server
///           is active.
/// Why:      The Wayland app id must be stamped before the window exists, but the
///           MCP server needs Slint to own backend creation.
fn install_backend() -> Result<()> {
    // What:     `if std::env::var_os("SLINT_MCP_PORT").is_some() { return Ok(()); }`
    //           bails out without installing a platform. `var_os` returns an
    //           `Option`; `.is_some()` tests presence.
    // Why:      Slint's embedded MCP server only starts when Slint creates the
    //           backend itself; installing one here would leave it unbound.
    if std::env::var_os("SLINT_MCP_PORT").is_some() {
        return Ok(());
    }
    // What:     `let mut builder = Backend::builder().with_window_attributes_hook(
    //           launcher::set_window_app_id);` starts a backend builder with the
    //           app-id hook installed.
    // Why:      The hook runs at native window creation.
    let mut builder = Backend::builder().with_window_attributes_hook(launcher::set_window_app_id);
    // What:     `let force_software = std::env::var("SLINT_BACKEND").map(|value|
    //           value.contains("software")).unwrap_or(false);`. `.map(...)` runs a
    //           closure on the `Ok` value; `.unwrap_or(false)` treats a missing
    //           variable as `false` and drops the error.
    // Why:      Preserve the sibling apps' software-renderer escape hatch.
    let force_software = std::env::var("SLINT_BACKEND")
        .map(|value| value.contains("software"))
        .unwrap_or(false);
    // What:     `if force_software { builder = builder.with_renderer_name("software"); }`
    //           swaps the renderer when requested.
    // Why:      No-GPU sessions can force the software renderer.
    if force_software {
        builder = builder.with_renderer_name("software");
    }
    // What:     `let backend = builder.build()?;` finishes the backend; `?`
    //           propagates a platform error.
    // Why:      Backend creation can fail without a display server.
    let backend = builder.build()?;
    // What:     `slint::platform::set_platform(Box::new(backend)).expect(...)`
    //           boxes the backend as a trait object and installs it globally.
    //           `Box::new` heap-allocates (sibling `Rc`/`Arc` share instead).
    // Why:      The next `AppWindow::new()` must use this backend and hook.
    slint::platform::set_platform(Box::new(backend))
        .expect("no Slint platform should already be set");
    // What:     `Ok(())` returns success; tail expression.
    // Why:      The platform is installed.
    Ok(())
}

/// What:     `fn mirror_hud(app: &AppWindow, instrumentation: &Instrumentation)`
///           copies every counter into the window's HUD properties.
/// Why:      The instrumentation is the source of truth; the HUD is a mirror.
fn mirror_hud(app: &AppWindow, instrumentation: &Instrumentation) {
    // What:     `app.set_total_columns(instrumentation.total_columns.get() as i32);`
    //           reads the `Cell` and narrows the `usize` to Slint's `int`.
    // Why:      Show the full column count.
    app.set_total_columns(instrumentation.total_columns.get() as i32);
    // What:     Each following setter mirrors one counter the same way.
    // Why:      Keep the HUD in step with the measurement.
    app.set_resident_columns(instrumentation.resident_columns.get() as i32);
    app.set_total_panes(instrumentation.total_panes.get() as i32);
    app.set_resident_panes(instrumentation.resident_panes.get() as i32);
    app.set_live_row_delegates(instrumentation.materialized_count() as i32);
    // What:     `instrumentation.total_rows_addressable.get().min(i32::MAX as u64)
    //           as i32` clamps the `u64` sum into `int` range before narrowing.
    // Why:      The addressable-row sum can exceed a 32-bit integer.
    app.set_total_rows_addressable(
        instrumentation.total_rows_addressable.get().min(i32::MAX as u64) as i32,
    );
    // What:     `(instrumentation.decoded_image_bytes.get() / 1024) as i32`
    //           converts resident bytes to kibibytes.
    // Why:      The HUD reads KiB.
    app.set_decoded_image_kib((instrumentation.decoded_image_bytes.get() / 1024) as i32);
    app.set_decode_count(instrumentation.decode_count.get() as i32);
    // What:     Mirror the count of in-flight background decodes.
    // Why:      HUD gauge showing the decode queue draining off the UI thread.
    app.set_pending_decodes(instrumentation.pending_decodes.get() as i32);
    app.set_column_builds(instrumentation.column_builds.get() as i32);
    app.set_pane_builds(instrumentation.pane_builds.get() as i32);
    app.set_active_column(instrumentation.active_column.get() as i32);
    app.set_active_pane(instrumentation.active_pane.get() as i32);
    // What:     `app.set_active_pane_focused(instrumentation.active_pane_focused.get());`
    //           mirrors the focus flag (a plain `bool`).
    // Why:      The focus-survival read-back.
    app.set_active_pane_focused(instrumentation.active_pane_focused.get());
}

/// What:     `pub fn run() -> Result<()>` is the whole-program entry the binary
///           calls.
/// Why:      Set up logging, the backend, the window, the callbacks, the HUD
///           timer, and run the event loop.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export async function run(): Promise<void> { ... }
/// ```
pub fn run() -> Result<()> {
    // What:     Install the stderr tracing subscriber (RUST_LOG, default info)
    //           before backend setup, matching the sibling apps.
    // Why:      Make callback errors visible from a terminal.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .with_writer(std::io::stderr)
        .init();
    // What:     `install_backend()?;` installs the backend (or skips for MCP).
    // Why:      Must happen before the window is created.
    install_backend()?;
    // What:     `let app = AppWindow::new()?;` constructs the Slint window; `?`
    //           propagates a platform error.
    // Why:      The window hosts the strip.
    let app = AppWindow::new()?;
    // What:     `let controller = Rc::new(RefCell::new(Controller::new()));` shares
    //           one mutable controller across every callback.
    // Why:      Callbacks run at different times but mutate one state.
    let controller = Rc::new(RefCell::new(Controller::new()));
    // What:     `let instrumentation = controller.borrow().instrumentation();`
    //           takes a shared handle to the counters. `.borrow()` is a checked
    //           read borrow of the `RefCell`.
    // Why:      The HUD timer mirrors from it.
    let instrumentation = controller.borrow().instrumentation();

    // What:     `app.set_columns(controller.borrow().columns_model_rc());` installs
    //           the persistent columns model on the window ONCE.
    // Why:      From now on Rust mutates that model in place (insert/remove/
    //           row-changed); it is never replaced, so the Flickable's scroll
    //           position is never disturbed.
    app.set_columns(controller.borrow().columns_model_rc());
    // What:     `app.set_strip_width_px(controller.borrow().strip_width_px());`
    //           sets the Flickable's full content width.
    // Why:      Horizontal scrolling spans the whole strip.
    app.set_strip_width_px(controller.borrow().strip_width_px());
    // What:     `app.set_column_width_px(COLUMN_WIDTH_PX);` sets the column width.
    // Why:      The UI positions and sizes columns by it.
    app.set_column_width_px(COLUMN_WIDTH_PX);

    // What:     `app.on_horizontal_scrolled({ ... });` registers the callback.
    // Why:      The Flickable reports pixel offsets continuously as it animates; we
    //           only STORE the offset here. The frame timer reconciles the model
    //           when the offset crosses into a different column window, so a smooth
    //           scroll within one window rebuilds nothing and never swaps the model
    //           mid-render.
    app.on_horizontal_scrolled({
        let controller = Rc::clone(&controller);
        // What:     `move |offset_px| { ... }` captures the controller by value.
        // Why:      Slint owns the callback, so it must own its captures.
        move |offset_px| {
            // What:     `controller.borrow_mut().set_h_offset(offset_px);` records
            //           the offset without rebuilding.
            // Why:      Cheap: no allocation or repeater churn on the render frame.
            controller.borrow_mut().set_h_offset(offset_px);
        }
    });

    // What:     Register the vertical-scroll callback (0..100% of the shared range).
    // Why:      Vertical scroll rewrites every in-window column's panes in place.
    app.on_vertical_scrolled({
        let controller = Rc::clone(&controller);
        // What:     `move |percent| { ... }` captures the controller by value.
        // Why:      Slint owns the callback.
        move |percent| {
            // What:     `controller.borrow_mut().on_vertical_scroll(percent);` mutates
            //           the persistent model in place; no swap, no Flickable touch.
            // Why:      Vertical scroll moves every column together.
            controller.borrow_mut().on_vertical_scroll(percent);
        }
    });

    // What:     Register the keyboard-navigation callback.
    // Why:      Arrows/buttons move the active column/pane and may scroll it in.
    let weak_k = app.as_weak();
    app.on_key_nav({
        let controller = Rc::clone(&controller);
        // What:     `move |key| { ... }` receives the command string.
        // Why:      One handler for all navigation commands.
        move |key| {
            if let Some(app) = weak_k.upgrade() {
                // What:     `controller.borrow_mut().on_key_nav(key.as_str());` mutates
                //           the model in place; `.as_str()` borrows the SharedString.
                //           The `RefMut` releases at the `;`.
                // Why:      Navigation reconciles the model without a swap.
                controller.borrow_mut().on_key_nav(key.as_str());
                // What:     `app.set_h_scroll_px(0.0 - controller.borrow().h_offset_px());`
                //           moves the Flickable to the (possibly moved) offset;
                //           viewport-x is <= 0, so it is negated.
                // Why:      Keyboard navigation must move the visible window; the
                //           resulting viewport-x change feeds set_h_offset.
                app.set_h_scroll_px(0.0 - controller.borrow().h_offset_px());
            }
        }
    });

    // What:     Register the column `init` counter callback.
    // Why:      Cross-check Slint instantiates only windowed columns (recycling).
    app.on_column_built({
        let instrumentation = Rc::clone(&instrumentation);
        // What:     `move || { ... }` is a zero-argument closure.
        // Why:      The callback carries no data, only the fact of a build.
        move || {
            // What:     `instrumentation.column_builds.set(instrumentation
            //           .column_builds.get() + 1);` increments the `Cell` counter.
            // Why:      Count one column instantiation.
            instrumentation
                .column_builds
                .set(instrumentation.column_builds.get() + 1);
        }
    });

    // What:     Register the pane `init` counter callback.
    // Why:      Same recycling cross-check at the pane level.
    app.on_pane_built({
        let instrumentation = Rc::clone(&instrumentation);
        move || {
            instrumentation
                .pane_builds
                .set(instrumentation.pane_builds.get() + 1);
        }
    });

    // What:     Register the active-pane focus callback.
    // Why:      The active pane reports its focus state for the survival check.
    app.on_active_focus_changed({
        let controller = Rc::clone(&controller);
        // What:     `move |focused| { ... }` receives the new focus bool.
        // Why:      Store it in the instrumentation.
        move |focused| {
            controller.borrow().set_active_focus(focused);
        }
    });

    // What:     `let hud_timer = Timer::default();` creates a repeating timer.
    // Why:      Mirror the instrumentation into the HUD periodically.
    let hud_timer = Timer::default();
    // What:     `let weak_hud = app.as_weak();` is the timer's non-owning handle.
    // Why:      The timer must not keep the window alive.
    let weak_hud = app.as_weak();
    // What:     `hud_timer.start(TimerMode::Repeated, Duration::from_millis(
    //           HUD_REFRESH_MS), { ... })` starts the periodic mirror.
    // Why:      Post-render counters (materialized rows, builds) need a poll.
    hud_timer.start(TimerMode::Repeated, Duration::from_millis(HUD_REFRESH_MS), {
        let instrumentation = Rc::clone(&instrumentation);
        move || {
            if let Some(app) = weak_hud.upgrade() {
                // What:     `mirror_hud(&app, &instrumentation);` copies counters in.
                // Why:      Refresh the HUD.
                mirror_hud(&app, &instrumentation);
            }
        }
    });

    // What:     `let frame_timer = Timer::default();` creates the per-frame timer.
    // Why:      It collects finished decodes and applies horizontal window shifts,
    //           both off the render frame and only when something changed.
    let frame_timer = Timer::default();
    // What:     `let weak_frame = app.as_weak();` is its non-owning handle.
    // Why:      The timer must not keep the window alive.
    let weak_frame = app.as_weak();
    // What:     `frame_timer.start(TimerMode::Repeated, Duration::from_millis(
    //           FRAME_TICK_MS), { ... })` starts the per-frame reconcile.
    // Why:      Turn decode results and scroll shifts into at most one rebuild/tick.
    frame_timer.start(TimerMode::Repeated, Duration::from_millis(FRAME_TICK_MS), {
        let controller = Rc::clone(&controller);
        move || {
            // What:     `if weak_frame.upgrade().is_some() { ... }` runs only while the
            //           window still exists.
            // Why:      Skip work during teardown.
            if weak_frame.upgrade().is_some() {
                // What:     `controller.borrow_mut().frame_tick();` drains decodes and
                //           slides the window, mutating the persistent model in place.
                // Why:      No model swap, so the Flickable's scroll is untouched.
                controller.borrow_mut().frame_tick();
            }
        }
    });

    // What:     `app.run()?;` enters the Slint event loop and blocks until the
    //           window closes; `?` propagates a platform error.
    // Why:      Drive the UI.
    app.run()?;
    // What:     `hud_timer.stop();` and `frame_timer.stop();` halt both timers.
    // Why:      Clean shutdown.
    hud_timer.stop();
    frame_timer.stop();
    // What:     `Ok(())` returns success; tail expression.
    // Why:      The program ran and exited cleanly.
    Ok(())
}
