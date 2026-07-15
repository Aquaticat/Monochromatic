//! Spawning and lifecycle of the single hosted client process.
//!
//! The fixture forks exactly one client, pointed at the nested socket via
//! `WAYLAND_DISPLAY`, and stops the event loop (propagating the exit code) when that
//! client exits. Child exit is detected by a periodic calloop timer that polls
//! `try_wait`, which keeps everything on the event loop's single thread.

/// What:     `use std::time::Duration;`. `Duration` is the exit-poll interval. The child
///           `Command` itself is built by the `systemd` module, so it is not named here.
/// Why:      Needed to schedule the exit poll.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // Duration ~ a ms count.
/// ```
use std::time::Duration;

/// What:     Grouped `use` of the calloop timer types and loop handle.
/// Why:      `register_exit_poll` inserts a `Timer` source through the `LoopHandle`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Timer, TimeoutAction, LoopHandle } from "smithay/calloop";
/// ```
use smithay::reexports::calloop::{
    timer::{TimeoutAction, Timer},
    LoopHandle,
};

/// What:     `use anyhow::{Context, Result};`. Error helpers.
/// Why:      `spawn_child` returns `Result` and annotates spawn failures.
use anyhow::{Context, Result};

/// What:     `use tracing::{info, warn};`. Structured log macros.
/// Why:      Report spawn and exit events.
use tracing::{info, warn};

/// What:     `use crate::{state::Compositor, systemd::Isolation};`. Our state type and the
///           CPU-isolation settings.
/// Why:      `spawn_child` reads/writes state and builds the child command per the isolation
///           settings.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Compositor } from "./state"; import { Isolation } from "./systemd";
/// ```
use crate::{state::Compositor, systemd::Isolation};

/// How often to poll the hosted child for exit.
///
/// What:     `const POLL_INTERVAL: Duration = Duration::from_millis(200);`. A fixed
///           200-millisecond interval.
/// Why:      Frequent enough to shut down promptly after the app exits, rare enough to
///           cost nothing measurable.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const POLL_INTERVAL_MS = 200;
/// ```
const POLL_INTERVAL: Duration = Duration::from_millis(200);

/// Spawn the hosted client, pointed at the nested Wayland socket.
///
/// What:     `pub fn spawn_child(state: &mut Compositor, command: &[String]) ->
///           Result<()>`. Borrows the state mutably (to store the `Child`) and the
///           command read-only. `Result<()>` returns the unit `()` on success.
/// Why:      Launch the one client the fixture exists to host, connected to us rather
///           than to the host compositor.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function spawnChild(state, command): void { ... }
/// ```
///
/// @example
/// ```ts
/// spawnChild(state, ["music-player", "fixtures"]);
/// ```
pub fn spawn_child(state: &mut Compositor, command: &[String], isolation: &Isolation) -> Result<()> {
    // What:     `let program = &command[0];`. Borrow the first token (the executable).
    //           `parse_args` guarantees `command` is non-empty, so index 0 is safe.
    // Why:      Names the program to launch and to report in messages.
    let program = &command[0];

    // What:     `let mut cmd = crate::systemd::build_child_command(program, &command[1..],
    //           isolation);`. Build the spawn command: either a `systemd-run --scope`
    //           wrapper (when isolation is enabled and systemd is available) or the app
    //           directly. `program` (a `&String`) coerces to the `&str` the helper takes.
    // Why:      Centralise the isolate-or-degrade decision in one place; `mut` because we
    //           set the Wayland environment on it next.
    let mut cmd = crate::systemd::build_child_command(program, &command[1..], isolation);

    // What:     `cmd.env("WAYLAND_DISPLAY", &state.socket_name);`. Set the child's
    //           `WAYLAND_DISPLAY` to our listening socket. This sets it ONLY for the
    //           child, not our own process, so our winit window keeps talking to the
    //           parent compositor.
    // Why:      Make the client connect to us instead of the host session.
    cmd.env("WAYLAND_DISPLAY", &state.socket_name);

    // What:     `cmd.env_remove("WAYLAND_SOCKET");`. Drop any inherited `WAYLAND_SOCKET`
    //           (an fd-based connection override).
    // Why:      If the parent passed a socket fd, it would override `WAYLAND_DISPLAY` and
    //           send the child to the wrong compositor.
    cmd.env_remove("WAYLAND_SOCKET");

    // What:     `let child = cmd.spawn().with_context(|| format!("failed to spawn {program}"))?;`.
    //           `spawn()` starts the process, returning `io::Result<Child>`;
    //           `.with_context(closure)` lazily attaches a message on error; `?` unwraps
    //           or returns the error.
    // Why:      Actually launch the client, failing cleanly if the binary is missing.
    let child = cmd
        .spawn()
        .with_context(|| format!("failed to spawn hosted client: {program}"))?;

    // What:     `info!(...)`. Log the spawn with the socket the child will use.
    // Why:      Make the wiring visible for debugging.
    info!("spawned hosted client {program} on {:?}", state.socket_name);

    // What:     `state.child = Some(child);`. Store the process handle. `Some(child)`
    //           wraps it in the present variant of `Option`.
    // Why:      The exit-poll timer needs the handle to `try_wait` on.
    state.child = Some(child);

    // What:     `Ok(())`. Success with the unit value; tail expression.
    // Why:      Signal the spawn succeeded.
    Ok(())
}

/// Register the periodic child-exit poll on the event loop.
///
/// What:     `pub fn register_exit_poll(loop_handle: &LoopHandle<Compositor>)`. Borrows
///           the loop handle to insert a repeating timer source.
/// Why:      Turns "the child exited" into a loop-stopping event without a second thread.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function registerExitPoll(loopHandle) { ... }
/// ```
pub fn register_exit_poll(loop_handle: &LoopHandle<Compositor>) {
    // What:     `loop_handle.insert_source(Timer::from_duration(POLL_INTERVAL), |_,
    //           _, state| { ... }).expect(...)`. Registers a timer that first fires after
    //           `POLL_INTERVAL`. The callback receives the fire instant (`_`), metadata
    //           (`_`), and `&mut Compositor` (`state`).
    // Why:      Poll the child on a fixed cadence.
    loop_handle
        .insert_source(Timer::from_duration(POLL_INTERVAL), |_, _, state: &mut Compositor| {
            // What:     `poll_child(state);`. Check whether the child exited and, if so,
            //           stop the loop.
            // Why:      The actual exit check.
            poll_child(state);

            // What:     `TimeoutAction::ToDuration(POLL_INTERVAL)`. Tell calloop to
            //           reschedule the timer for another `POLL_INTERVAL` from now (tail
            //           expression of the closure).
            // Why:      Keep polling until the loop stops.
            TimeoutAction::ToDuration(POLL_INTERVAL)
        })
        .expect("failed to register the child-exit poll timer");
}

/// Check whether the hosted child has exited; if so, record its code and stop the loop.
///
/// What:     `fn poll_child(state: &mut Compositor)`. Private helper called by the timer.
/// Why:      Centralise the try-wait / record-code / stop-loop sequence.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function pollChild(state) { ... }
/// ```
fn poll_child(state: &mut Compositor) {
    // What:     `let Some(child) = state.child.as_mut() else { return; };`. `as_mut()`
    //           borrows the `Option<Child>` as `Option<&mut Child>`; the `let ... else`
    //           binds the child mutably when present or returns when it is already gone.
    // Why:      Nothing to poll once the child has been cleared.
    let Some(child) = state.child.as_mut() else {
        return;
    };

    // What:     `match child.try_wait() { ... }`. `try_wait()` returns
    //           `io::Result<Option<ExitStatus>>`: `Ok(Some(status))` if exited,
    //           `Ok(None)` if still running, `Err(_)` on a wait error. Pattern-match all
    //           three.
    // Why:      React to each possible state.
    match child.try_wait() {
        Ok(Some(status)) => {
            // What:     `let code = status.code().unwrap_or(0);`. `code()` returns
            //           `Option<i32>` (None when the process was killed by a signal);
            //           `.unwrap_or(0)` substitutes 0 in that case.
            // Why:      A single integer exit code to propagate.
            let code = status.code().unwrap_or(0);

            // What:     `info!(...)`. Log the exit code.
            // Why:      Make shutdown visible.
            info!("hosted client exited with code {code}");

            // What:     `state.child_exit_code = Some(code);`. Record it for `main`.
            // Why:      `run` returns this as the program's exit code.
            state.child_exit_code = Some(code);

            // What:     `state.child = None;`. Clear the handle so we stop polling.
            // Why:      The child is reaped; nothing left to wait on.
            state.child = None;

            // What:     `state.loop_signal.stop();`. Ask the event loop to end.
            // Why:      The fixture's job is done when the app exits.
            state.loop_signal.stop();
        }
        Ok(None) => {
            // What:     Empty arm: the child is still running.
            // Why:      Keep waiting; the timer will poll again.
        }
        Err(err) => {
            // What:     `warn!(...)`. Log the wait error.
            // Why:      Surface the unexpected failure.
            warn!("failed to wait on hosted client: {err}");

            // What:     `state.child = None;`. Stop polling a child we cannot wait on.
            // Why:      Avoid looping on a permanent error.
            state.child = None;

            // What:     `state.loop_signal.stop();`. End the loop; without a hostable
            //           child there is nothing to do.
            // Why:      Fail closed rather than spin.
            state.loop_signal.stop();
        }
    }
}
