//! UI-side progress debounce bridge.
//!
//! This module sits in the binary crate because it talks to generated Slint
//! types. The pure timing rule lives in `music_player::progress`; this file
//! wires that rule to the on-screen seek bar and KDE taskbar progress.

// What:     `use std::sync::Mutex;`. A standard-library lock that lets one thread
//           mutate a value at a time. Sibling: `RwLock`, which has separate read
//           and write locking.
// Why:      The update callback crosses from the engine thread to the UI thread,
//           so the debounce state is shared behind a lock.
// TS map:   no exact equivalent; mentally `lock(sharedState, () => { ... })`.
use std::sync::Mutex;

// What:     `use std::time::Duration;`. A standard-library elapsed time span.
//           Sibling: `Instant`, a timestamp.
// Why:      The caller passes elapsed time since startup into the debouncer.
// TS map:   `type Duration = number; // milliseconds`
use std::time::Duration;

// What:     `use music_player::command::Update;`. The engine-to-UI update enum.
// Why:      This bridge classifies `Position`, `NowPlaying`, and `Playing` updates.
// TS map:   `import { Update } from "music-player/command";`
use music_player::command::Update;

// What:     `use music_player::launcher::Launcher;`. The KDE taskbar-progress
//           signal helper.
// Why:      Accepted progress updates mirror from Slint state to the taskbar.
// TS map:   `import { Launcher } from "music-player/launcher";`
use music_player::launcher::Launcher;

// What:     `use music_player::progress::{ProgressDebouncer, ProgressUpdateKind};`.
//           The pure debounce state and update-kind enum.
// Why:      Keep timing policy tested in the library while this module handles UI
//           plumbing.
// TS map:   `import { ProgressDebouncer, ProgressUpdateKind } from "music-player/progress";`
use music_player::progress::{ProgressDebouncer, ProgressUpdateKind};

// What:     `use crate::{apply_update, AppWindow};`. Import the parent binary
//           module's generated Slint window type and existing update applier.
// Why:      The generated `AppWindow` type only exists in this binary crate, not in
//           the library crate.
// TS map:   `import { applyUpdate, AppWindow } from "./main";`
use crate::{apply_update, AppWindow};

// What:     `fn progress_fraction(app: &AppWindow) -> f64`. Read the Slint window's
//           position and duration properties and return a 0..1 fraction.
// Why:      The on-screen progress and KDE taskbar progress must use the same
//           post-update state.
// TS map:   `function progressFraction(app: AppWindow): number`
fn progress_fraction(app: &AppWindow) -> f64 {
    // What:     `let duration = app.get_duration();`. Read the current track length
    //           in seconds from the generated Slint getter.
    // Why:      The duration is the denominator for the fraction.
    // TS map:   `const duration = app.duration;`
    let duration = app.get_duration();
    // What:     `if duration > 0.0 { ... } else { ... }`. Guard the division.
    // Why:      Zero-duration tracks have no meaningful progress fraction.
    // TS map:   `if (duration > 0) return app.position / duration; return 0;`
    if duration > 0.0 {
        // What:     `f64::from(app.get_position() / duration)`. Divide two Slint
        //           `float` values (`f32`) and widen the result to `f64` for D-Bus.
        // Why:      LauncherEntry expects a double, while Slint stores floats.
        // TS map:   `return app.position / duration;`
        f64::from(app.get_position() / duration)
    } else {
        // What:     `0.0` is the fallback fraction for absent or zero-length media.
        // Why:      Avoid NaN and keep taskbar state deterministic.
        // TS map:   `return 0;`
        0.0
    }
}

// What:     `fn emit_launcher_progress(app: &AppWindow, launcher: &Launcher)`. Push
//           the current progress state to KDE's LauncherEntry signal helper.
// Why:      Centralizing this keeps taskbar progress in sync with debounced Slint
//           progress updates.
// TS map:   `function emitLauncherProgress(app: AppWindow, launcher: Launcher): void`
fn emit_launcher_progress(app: &AppWindow, launcher: &Launcher) {
    // What:     `let duration = app.get_duration();`. Read the current track length.
    // Why:      The taskbar bar should be visible only when a real-duration track is
    //           playing; a zero-duration fixture would otherwise flash an empty bar.
    // TS map:   `const duration = app.duration;`
    let duration = app.get_duration();
    // What:     `let visible = app.get_playing() && duration > 0.0;`. Combine play
    //           state with a positive-duration guard.
    // Why:      Paused or zero-duration media should hide the taskbar progress bar.
    // TS map:   `const visible = app.playing && duration > 0;`
    let visible = app.get_playing() && duration > 0.0;
    // What:     `launcher.set_progress(progress_fraction(app), visible);`. Emit the
    //           clamped fraction plus visibility flag.
    // Why:      KDE updates or hides the taskbar progress indicator.
    // TS map:   `launcher.setProgress(progressFraction(app), visible);`
    launcher.set_progress(progress_fraction(app), visible);
}

// What:     `fn should_surface_progress(...) -> bool`. Lock the shared debouncer and
//           ask whether this update should repaint progress surfaces now.
// Why:      The update callback crosses threads, so the state lives behind a mutex.
// TS map:   `function shouldSurfaceProgress(debouncer, elapsed, kind): boolean`
fn should_surface_progress(
    progress_debouncer: &Mutex<ProgressDebouncer>,
    elapsed: Duration,
    kind: ProgressUpdateKind,
) -> bool {
    // What:     `let mut debouncer = progress_debouncer.lock().expect(...)`. Acquire
    //           the mutex and get mutable access to the inner debouncer; `expect`
    //           turns poison into a clear panic message.
    // Why:      A poisoned debounce lock means a previous UI update panicked, so the
    //           process is already in a bad state.
    // TS map:   `const debouncer = lock(progressDebouncer);`
    let mut debouncer = progress_debouncer
        .lock()
        .expect("progress debouncer lock should not be poisoned");
    // What:     `debouncer.should_surface(elapsed, kind)`. Run the pure timing rule.
    // Why:      Return the shared decision to the caller.
    // TS map:   `return debouncer.shouldSurface(elapsed, kind);`
    debouncer.should_surface(elapsed, kind)
}

// What:     `pub(crate) fn apply_update_with_progress_debounce(...)`. Apply one
//           engine update, but gate progress-surface repaints through
//           `ProgressDebouncer`. `pub(crate)` lets `main.rs` call it.
// Why:      Short tracks can emit rapid position resets; the seek bar and taskbar
//           should update at a human-visible cadence instead of flickering.
// TS map:   `export function applyUpdateWithProgressDebounce(...): void`
pub(crate) fn apply_update_with_progress_debounce(
    app: &AppWindow,
    launcher: &Launcher,
    progress_debouncer: &Mutex<ProgressDebouncer>,
    elapsed: Duration,
    update: Update,
) {
    // What:     `match update { ... }`. Branch by update variant.
    // Why:      Position updates can be suppressed; other UI state still applies.
    // TS map:   `switch (update.kind) { ... }`
    match update {
        // What:     `Update::Position(secs) => { ... }`. A progress-position tick.
        // Why:      This is the on-screen seek-bar update that needs debouncing.
        // TS map:   `case "position": ...`
        Update::Position(secs) => {
            // What:     `if should_surface_progress(...) { ... }`. Ask the debounce
            //           helper whether enough time has passed.
            // Why:      Suppressed ticks leave the current bar position in place.
            // TS map:   `if (shouldSurfaceProgress(...)) { ... }`
            if should_surface_progress(progress_debouncer, elapsed, ProgressUpdateKind::Debounced)
            {
                // What:     `apply_update(app, Update::Position(secs));`. Apply the
                //           original position update after it passed the gate.
                // Why:      Move the Slint seek bar and text at the debounced cadence.
                // TS map:   `applyUpdate(app, update);`
                apply_update(app, Update::Position(secs));
                // What:     `emit_launcher_progress(app, launcher);`. Mirror the same
                //           accepted progress state to the taskbar.
                // Why:      The taskbar should not update more often than the seek bar.
                // TS map:   `emitLauncherProgress(app, launcher);`
                emit_launcher_progress(app, launcher);
            }
        }
        // What:     `Update::NowPlaying { ... } => { ... }`. Current track metadata.
        // Why:      Title, duration, row highlight, and page following still update
        //           immediately; only taskbar progress emission is debounced.
        // TS map:   `case "nowPlaying": ...`
        Update::NowPlaying {
            index,
            name,
            duration,
        } => {
            // What:     `let should_emit_progress = should_surface_progress(...)`.
            //           Decide before applying the update; the decision depends only
            //           on elapsed time, not on the new metadata.
            // Why:      Rapid track changes should not flash the taskbar bar.
            // TS map:   `const shouldEmitProgress = shouldSurfaceProgress(...);`
            let should_emit_progress = should_surface_progress(
                progress_debouncer,
                elapsed,
                ProgressUpdateKind::Debounced,
            );
            // What:     `apply_update(app, Update::NowPlaying { ... })`. Rebuild the
            //           Slint state from the track metadata.
            // Why:      Track identity must never wait for progress debounce.
            // TS map:   `applyUpdate(app, update);`
            apply_update(
                app,
                Update::NowPlaying {
                    index,
                    name,
                    duration,
                },
            );
            // What:     `if should_emit_progress { ... }`. Use the earlier decision.
            // Why:      Keep taskbar progress at the debounced cadence on track resets.
            // TS map:   `if (shouldEmitProgress) emitLauncherProgress(...);`
            if should_emit_progress {
                emit_launcher_progress(app, launcher);
            }
        }
        // What:     `Update::Playing(on) => { ... }`. Play/pause state changed.
        // Why:      Taskbar visibility must hide/show immediately even while ordinary
        //           progress movement is debounced.
        // TS map:   `case "playing": ...`
        Update::Playing(on) => {
            // What:     `let should_emit_progress = should_surface_progress(...Immediate)`.
            //           Immediate updates always pass and reset the debounce baseline.
            // Why:      A position reset immediately after play/pause should not flicker.
            // TS map:   `const shouldEmitProgress = shouldSurfaceProgress(..., "immediate");`
            let should_emit_progress = should_surface_progress(
                progress_debouncer,
                elapsed,
                ProgressUpdateKind::Immediate,
            );
            // What:     `apply_update(app, Update::Playing(on));`. Mirror the play flag.
            // Why:      Button label and window title update immediately.
            // TS map:   `applyUpdate(app, update);`
            apply_update(app, Update::Playing(on));
            // What:     `if should_emit_progress { ... }`. This remains true for
            //           immediate updates; the branch documents the shared path.
            // Why:      Keep all LauncherEntry emission in one helper.
            // TS map:   `if (shouldEmitProgress) emitLauncherProgress(...);`
            if should_emit_progress {
                emit_launcher_progress(app, launcher);
            }
        }
        // What:     `other => apply_update(app, other)`. Any non-progress update.
        // Why:      Queue, volume, shuffle, and repeat state should not be debounced.
        // TS map:   `default: applyUpdate(app, update);`
        other => apply_update(app, other),
    }
}
