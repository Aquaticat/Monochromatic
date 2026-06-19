//! UI-side progress debounce bridge.
//!
//! This module sits in the binary crate because it talks to generated Slint
//! types. The pure timing rule lives in `music_player::progress`; this file
//! wires that rule to the on-screen seek bar and KDE taskbar progress.

/// What:     `use std::sync::Mutex;`. A standard-library lock that lets one thread mutate
///           a value at a time. Sibling: `RwLock`, which has separate read and write
///           locking.
/// Why:      The update callback crosses from the engine thread to the UI thread, so the
///           debounce state is shared behind a lock.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // Mutex<T> ~ a shared value you must lock() before touching
/// ```
use std::sync::Mutex;

/// What:     `use std::time::Duration;`. A standard-library elapsed time span. Sibling:
///           `Instant`, a timestamp.
/// Why:      The caller passes elapsed time since startup into the debouncer.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Duration = number; // milliseconds
/// ```
use std::time::Duration;

/// What:     `use music_player::command::Update;`. The engine-to-UI update enum.
/// Why:      This bridge classifies `Position`, `NowPlaying`, and `Playing` updates.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Update } from "music-player/command";
/// ```
use music_player::command::Update;

/// What:     `use music_player::launcher::Launcher;`. The KDE taskbar-progress signal
///           helper.
/// Why:      Accepted progress updates mirror from Slint state to the taskbar.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Launcher } from "music-player/launcher";
/// ```
use music_player::launcher::Launcher;

/// What:     `use music_player::progress::{ProgressDebouncer, ProgressUpdateKind};`. The
///           pure debounce state and update-kind enum.
/// Why:      Keep timing policy tested in the library while this module handles UI
///           plumbing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { ProgressDebouncer, ProgressUpdateKind } from "music-player/progress";
/// ```
use music_player::progress::{ProgressDebouncer, ProgressUpdateKind};

/// What:     `use crate::{apply_update, AppWindow};`. Import the parent binary module's
///           generated Slint window type and existing update applier.
/// Why:      The generated `AppWindow` type only exists in this binary crate, not in the
///           library crate.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { applyUpdate, AppWindow } from "./main";
/// ```
use crate::{apply_update, AppWindow};

/// What:     `fn progress_fraction(app: &AppWindow) -> f64`. Read the Slint window's
///           position and duration properties and return a 0..1 fraction. `f64` (sibling
///           `f32`) for the D-Bus double.
/// Why:      The on-screen progress and KDE taskbar progress must use the same
///           post-update state.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function progressFraction(app: AppWindow): number {
///   const duration = app.duration;
///   return duration > 0 ? app.position / duration : 0;
/// }
/// ```
fn progress_fraction(app: &AppWindow) -> f64 {
    // What:     `let duration = app.get_duration();`. Read the current track length in
    //           seconds from the generated Slint getter.
    // Why:      The duration is the denominator for the fraction.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const duration = app.duration;
    // ```
    let duration = app.get_duration();
    // What:     `if duration > 0.0 { ... } else { ... }`. An `if/else` EXPRESSION guarding
    //           the division.
    // Why:      Zero-duration tracks have no meaningful progress fraction.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return duration > 0 ? app.position / duration : 0;
    // ```
    if duration > 0.0 {
        // What:     `f64::from(app.get_position() / duration)`. Divide two Slint `float`
        //           values (`f32`) and `f64::from(...)` widens the result to `f64` for
        //           D-Bus. Tail of this branch.
        // Why:      LauncherEntry expects a double, while Slint stores floats.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return app.position / duration;
        // ```
        f64::from(app.get_position() / duration)
    } else {
        // What:     `0.0`. The fallback fraction for absent or zero-length media. Tail of
        //           this branch.
        // Why:      Avoid NaN and keep taskbar state deterministic.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return 0;
        // ```
        0.0
    }
}

/// What:     `fn emit_launcher_progress(app: &AppWindow, launcher: &Launcher)`. Push the
///           current progress state to KDE's LauncherEntry signal helper.
/// Why:      Centralizing this keeps taskbar progress in sync with debounced Slint progress
///           updates.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function emitLauncherProgress(app: AppWindow, launcher: Launcher): void { ... }
/// ```
fn emit_launcher_progress(app: &AppWindow, launcher: &Launcher) {
    // What:     `let duration = app.get_duration();`. Read the current track length.
    // Why:      The taskbar bar should be visible only when a real-duration track is
    //           playing; a zero-duration fixture would otherwise flash an empty bar.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const duration = app.duration;
    // ```
    let duration = app.get_duration();
    // What:     `let visible = app.get_playing() && duration > 0.0;`. Combine play state
    //           with a positive-duration guard (`&&` short-circuits).
    // Why:      Paused or zero-duration media should hide the taskbar progress bar.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const visible = app.playing && duration > 0;
    // ```
    let visible = app.get_playing() && duration > 0.0;
    // What:     `let fraction = progress_fraction(app);`. Compute the 0..1 progress once
    //           into a local, so both progress sinks below read the same value.
    // Why:      The Linux LauncherEntry signal and the Windows taskbar must agree.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const fraction = progressFraction(app);
    // ```
    let fraction = progress_fraction(app);
    // What:     `launcher.set_progress(fraction, visible);`. Emit the clamped fraction plus
    //           visibility flag. Real D-Bus on Linux; a no-op on macOS and Windows (the
    //           Windows taskbar is driven just below).
    // Why:      KDE updates or hides the taskbar progress indicator.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // launcher.setProgress(fraction, visible);
    // ```
    launcher.set_progress(fraction, visible);
    // What:     `#[cfg(windows)] set_windows_taskbar_progress(app, fraction, visible);`. On
    //           Windows ONLY, drive the native taskbar progress bar through the
    //           ITaskbarList3 COM interface (see the Windows region at the bottom).
    //           `#[cfg(windows)]` removes this statement entirely off Windows, where the
    //           function does not exist. This runs on the UI/event-loop thread, the only
    //           place the window handle and COM apartment are valid.
    // Why:      Windows has no D-Bus LauncherEntry protocol, so the taskbar bar is the
    //           OS-native equivalent of the Linux launcher progress.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (process.platform === "win32") setWindowsTaskbarProgress(app, fraction, visible);
    // ```
    #[cfg(windows)]
    set_windows_taskbar_progress(app, fraction, visible);
}

/// What:     `fn should_surface_progress(progress_debouncer: &Mutex<ProgressDebouncer>, elapsed: Duration, kind: ProgressUpdateKind) -> bool`.
///           Lock the shared debouncer and ask whether this update should repaint progress
///           surfaces now.
/// Why:      The update callback crosses threads, so the state lives behind a mutex.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function shouldSurfaceProgress(debouncer, elapsed, kind): boolean { ... }
/// ```
fn should_surface_progress(
    progress_debouncer: &Mutex<ProgressDebouncer>,
    elapsed: Duration,
    kind: ProgressUpdateKind,
) -> bool {
    // What:     `let mut debouncer = progress_debouncer.lock().expect("progress debouncer lock should not be poisoned");`.
    //           `.lock()` returns `Result<MutexGuard, _>` (the guard auto-unlocks when it
    //           drops); `.expect(msg)` unwraps it or PANICS with `msg` on POISON (a prior
    //           lock holder panicked). `mut` because we call a `&mut self` method on it.
    // Why:      A poisoned debounce lock means a previous UI update panicked, so the
    //           process is already in a bad state.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const debouncer = lock(progressDebouncer);
    // ```
    let mut debouncer = progress_debouncer
        .lock()
        .expect("progress debouncer lock should not be poisoned");
    // What:     `debouncer.should_surface(elapsed, kind)`. Run the pure timing rule. Tail
    //           expression -> return value (the guard unlocks as it drops here).
    // Why:      Return the shared decision to the caller.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return debouncer.shouldSurface(elapsed, kind);
    // ```
    debouncer.should_surface(elapsed, kind)
}

/// What:     `pub(crate) fn apply_update_with_progress_debounce(app: &AppWindow, launcher: &Launcher, progress_debouncer: &Mutex<ProgressDebouncer>, elapsed: Duration, update: Update)`.
///           Apply one engine update, but gate progress-surface repaints through
///           `ProgressDebouncer`. `pub(crate)` lets `main.rs` call it.
/// Why:      Short tracks can emit rapid position resets; the seek bar and taskbar should
///           update at a human-visible cadence instead of flickering.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function applyUpdateWithProgressDebounce(app, launcher, progressDebouncer, elapsed, update): void { ... }
/// ```
pub(crate) fn apply_update_with_progress_debounce(
    app: &AppWindow,
    launcher: &Launcher,
    progress_debouncer: &Mutex<ProgressDebouncer>,
    elapsed: Duration,
    update: Update,
) {
    // What:     `match &update { ... }`. Branch by update variant (exhaustive over the ones
    //           we special-case, plus a wildcard `_`). Matches by REFERENCE so the same
    //           `update` value can be forwarded to `apply_update` without rebuilding it.
    // Why:      Position updates can be suppressed; other UI state still applies.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // switch (update.kind) { ... }
    // ```
    match &update {
        // What:     `Update::Position(_) => { ... }`. A progress-position tick. The payload is
        //           not bound here; `apply_update` reads it from the forwarded `&update`.
        // Why:      This is the on-screen seek-bar update that needs debouncing.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // case "position": { ... }
        // ```
        Update::Position(_) => {
            // What:     `if should_surface_progress(progress_debouncer, elapsed, ProgressUpdateKind::Debounced) { ... }`.
            //           Ask the debounce helper whether enough time has passed (this update
            //           is `Debounced`, i.e. rate-limited).
            // Why:      Suppressed ticks leave the current bar position in place.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (shouldSurfaceProgress(progressDebouncer, elapsed, "debounced")) { ... }
            // ```
            if should_surface_progress(progress_debouncer, elapsed, ProgressUpdateKind::Debounced)
            {
                // What:     `apply_update(app, &update);`. Forward the borrowed update after it
                //           passed the gate. Unlike NowPlaying/Playing, the position apply is
                //           INSIDE the gate, so a suppressed tick leaves the bar in place.
                // Why:      Move the Slint seek bar and text at the debounced cadence.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // applyUpdate(app, update);
                // ```
                apply_update(app, &update);
                // What:     `emit_launcher_progress(app, launcher);`. Mirror the same
                //           accepted progress state to the taskbar.
                // Why:      The taskbar should not update more often than the seek bar.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // emitLauncherProgress(app, launcher);
                // ```
                emit_launcher_progress(app, launcher);
            }
        }
        // What:     `Update::NowPlaying { .. } => { ... }`. The current-track metadata. The
        //           fields are not bound here; `apply_update` reads them from `&update`.
        // Why:      Title, duration, row highlight, and page following still update
        //           immediately; only taskbar progress emission is debounced.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // case "nowPlaying": { ... }
        // ```
        Update::NowPlaying { .. } => {
            // What:     `let should_emit_progress = should_surface_progress(progress_debouncer, elapsed, ProgressUpdateKind::Debounced);`.
            //           Decide BEFORE applying the update; the decision depends only on
            //           elapsed time, not on the new metadata.
            // Why:      Rapid track changes should not flash the taskbar bar.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const shouldEmitProgress = shouldSurfaceProgress(progressDebouncer, elapsed, "debounced");
            // ```
            let should_emit_progress = should_surface_progress(
                progress_debouncer,
                elapsed,
                ProgressUpdateKind::Debounced,
            );
            // What:     `apply_update(app, &update);`. Forward the borrowed update; the apply
            //           is OUTSIDE the gate, so track identity always lands immediately and
            //           only the taskbar emission below is debounced.
            // Why:      Track identity must never wait for progress debounce.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // applyUpdate(app, update);
            // ```
            apply_update(app, &update);
            // What:     `if should_emit_progress { emit_launcher_progress(app, launcher); }`.
            //           Use the earlier decision.
            // Why:      Keep taskbar progress at the debounced cadence on track resets.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (shouldEmitProgress) emitLauncherProgress(app, launcher);
            // ```
            if should_emit_progress {
                emit_launcher_progress(app, launcher);
            }
        }
        // What:     `Update::Playing(_) => { ... }`. Play/pause state changed; the flag is not
        //           bound here, `apply_update` reads it from `&update`.
        // Why:      Taskbar visibility must hide/show immediately even while ordinary
        //           progress movement is debounced.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // case "playing": { ... }
        // ```
        Update::Playing(_) => {
            // What:     `let should_emit_progress = should_surface_progress(progress_debouncer, elapsed, ProgressUpdateKind::Immediate);`.
            //           `Immediate` updates always pass and reset the debounce baseline.
            // Why:      A position reset immediately after play/pause should not flicker.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const shouldEmitProgress = shouldSurfaceProgress(progressDebouncer, elapsed, "immediate");
            // ```
            let should_emit_progress = should_surface_progress(
                progress_debouncer,
                elapsed,
                ProgressUpdateKind::Immediate,
            );
            // What:     `apply_update(app, &update);`. Forward the borrowed update: mirror the
            //           play flag immediately (the apply is outside the gate).
            // Why:      Button label and window title update immediately.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // applyUpdate(app, update);
            // ```
            apply_update(app, &update);
            // What:     `if should_emit_progress { emit_launcher_progress(app, launcher); }`.
            //           This remains true for immediate updates; the branch documents the
            //           shared path.
            // Why:      Keep all LauncherEntry emission in one helper.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (shouldEmitProgress) emitLauncherProgress(app, launcher);
            // ```
            if should_emit_progress {
                emit_launcher_progress(app, launcher);
            }
        }
        // What:     `_ => apply_update(app, &update)`. The wildcard arm forwards any
        //           non-progress update directly (by reference).
        // Why:      Queue, volume, shuffle, and repeat state should not be debounced.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // default: applyUpdate(app, update);
        // ```
        _ => apply_update(app, &update),
    }
}

//region Windows taskbar progress (ITaskbarList3)
// Purpose: the Windows-native equivalent of the Linux LauncherEntry progress bar.
// Windows exposes per-window taskbar progress through the ITaskbarList3 COM
// interface, so this region creates that interface once per UI thread and pushes
// the same fraction/visibility `emit_launcher_progress` already computed. It is
// compiled only on Windows; every item is `#[cfg(windows)]`.

/// What:     `use std::cell::RefCell;`. A single-threaded interior-mutability cell: it
///           allows mutation through a shared `&` reference, enforcing the borrow rules at
///           RUNTIME instead of compile time. Sibling: `Cell<T>` (move in/out, no
///           borrowing); `RefCell` lets us borrow the inner value.
/// Why:      The cached COM interface lives in a `thread_local!`, which hands out only `&`
///           references, so mutation (first-time creation) needs a `RefCell`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // no equivalent: a one-slot box you can mutate through a shared reference
/// ```
#[cfg(windows)]
use std::cell::RefCell;

/// What:     `use windows::Win32::Foundation::HWND;`. The Win32 window-handle type (a
///           newtype around a raw pointer to the window).
/// Why:      ITaskbarList3's methods take the target window's `HWND`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type HWND = number; // an opaque window handle
/// ```
#[cfg(windows)]
use windows::Win32::Foundation::HWND;

/// What:     `use windows::Win32::System::Com::{CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, CoCreateInstance, CoInitializeEx};`.
///           COM bootstrap items: `CoInitializeEx` initializes COM on the thread;
///           `CoCreateInstance` builds a COM object by class id; `CLSCTX_INPROC_SERVER`
///           asks for an in-process implementation; `COINIT_APARTMENTTHREADED` is the
///           single-threaded-apartment mode winit's window thread already uses.
/// Why:      Needed to construct the taskbar COM object on the UI thread.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED } from "windows-com";
/// ```
#[cfg(windows)]
use windows::Win32::System::Com::{
    CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, CoCreateInstance, CoInitializeEx,
};

/// What:     `use windows::Win32::UI::Shell::{ITaskbarList3, TBPF_NOPROGRESS, TBPF_NORMAL, TaskbarList};`.
///           `ITaskbarList3` is the COM INTERFACE (a fat pointer to vtable methods);
///           `TaskbarList` is the CLASS ID (`GUID`) of the concrete shell object that
///           implements it; `TBPF_NORMAL`/`TBPF_NOPROGRESS` are progress-state flags (show
///           a normal bar / hide the bar).
/// Why:      These drive the taskbar progress bar.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { ITaskbarList3, TaskbarList, TBPF_NORMAL, TBPF_NOPROGRESS } from "windows-shell";
/// ```
#[cfg(windows)]
use windows::Win32::UI::Shell::{ITaskbarList3, TBPF_NOPROGRESS, TBPF_NORMAL, TaskbarList};

// What:     `thread_local! { static TASKBAR: RefCell<Option<ITaskbarList3>> = const { RefCell::new(None) }; }`.
//           A per-thread static holding the cached COM interface, or `None` until first
//           use. `thread_local!` gives each thread its OWN copy; `const { ... }` is a
//           compile-time initializer (no lazy runtime init needed).
// Why:      `ITaskbarList3` is a single-threaded-apartment COM object (`!Send`), so it
//           must never cross threads; a `thread_local` on the UI thread is the natural
//           home, and caching it avoids recreating it on every progress tick.
//
// In TS you'd write (pseudocode):
// ```ts
// // per-UI-thread cache: let taskbar: ITaskbarList3 | null = null;
// ```
#[cfg(windows)]
thread_local! {
    static TASKBAR: RefCell<Option<ITaskbarList3>> = const { RefCell::new(None) };
}

/// What:     `fn window_hwnd(app: &AppWindow) -> Option<HWND>`. Resolve the running
///           window's Win32 handle, or `None` if it is not yet realized or not a
///           winit/Win32 window. Module-private, Windows-only.
/// Why:      The handle exists only once the event loop has created the window, which is
///           why this is resolved lazily on each progress tick rather than at startup.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function windowHwnd(app: AppWindow): HWND | null { ... }
/// ```
#[cfg(windows)]
fn window_hwnd(app: &AppWindow) -> Option<HWND> {
    /// What:     `use slint::ComponentHandle;`. Brings the `.window()` accessor into scope
    ///           (a trait method is callable only when its trait is imported).
    /// Why:      `app.window()` returns the `slint::Window` the next call needs.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// import { ComponentHandle } from "slint";
    /// ```
    use slint::ComponentHandle;
    /// What:     `use i_slint_backend_winit::WinitWindowAccessor;`. The extension trait
    ///           adding `.with_winit_window(...)` to `slint::Window` on the winit backend.
    /// Why:      It exposes the underlying winit window, from which the raw handle comes.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// import { WinitWindowAccessor } from "slint-winit-backend";
    /// ```
    use i_slint_backend_winit::WinitWindowAccessor;
    /// What:     `use i_slint_backend_winit::winit::raw_window_handle::{HasWindowHandle, RawWindowHandle};`.
    ///           `HasWindowHandle` provides `.window_handle()`; `RawWindowHandle` is the
    ///           per-platform handle enum. Imported through winit's OWN re-export so the
    ///           `raw-window-handle` version matches winit's exactly (no separate dep).
    /// Why:      Needed to read and match the platform window handle.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// import { HasWindowHandle, RawWindowHandle } from "winit/raw-window-handle";
    /// ```
    use i_slint_backend_winit::winit::raw_window_handle::{HasWindowHandle, RawWindowHandle};
    // What:     `app.window().with_winit_window(|w| { ... }).flatten()`. `with_winit_window`
    //           runs the closure with the live winit `Window`, returning
    //           `Some(closure_result)` or `None` if there is no winit window. The closure
    //           itself returns `Option<HWND>`, so the outer result is `Option<Option<HWND>>`;
    //           `.flatten()` collapses it to `Option<HWND>`. Tail expression -> return value.
    // Why:      Reach into the winit window to read its raw Win32 handle.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return (app.window().withWinitWindow((w) => ...) ?? null);
    // ```
    app.window()
        .with_winit_window(|w| {
            // What:     `match w.window_handle().ok()?.as_raw() { ... }`. `.window_handle()`
            //           returns `Result<WindowHandle, _>`; `.ok()?` yields the handle or
            //           returns `None` from this closure on error. `.as_raw()` converts it
            //           to the `RawWindowHandle` enum.
            // Why:      Inspect which platform handle this is.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const raw = w.windowHandle(); if (!raw) return null;
            // ```
            match w.window_handle().ok()?.as_raw() {
                // What:     `RawWindowHandle::Win32(handle) => Some(HWND(handle.hwnd.get() as *mut core::ffi::c_void))`.
                //           On Windows the handle is the `Win32` variant; `handle.hwnd` is a
                //           `NonZeroIsize`, `.get()` reads the raw `isize`, and `as *mut
                //           core::ffi::c_void` turns it into the pointer the `windows`
                //           crate's `HWND(*mut c_void)` newtype wraps.
                // Why:      Build the `HWND` ITaskbarList3 needs.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (raw.kind === "win32") return new HWND(raw.hwnd);
                // ```
                RawWindowHandle::Win32(handle) => {
                    Some(HWND(handle.hwnd.get() as *mut core::ffi::c_void))
                }
                // What:     `_ => None`. Any other platform variant (cannot happen in a
                //           Windows build, but the match must be exhaustive).
                // Why:      Only the Win32 handle is usable here.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // return null;
                // ```
                _ => None,
            }
        })
        .flatten()
}

/// What:     `fn create_taskbar_list() -> Option<ITaskbarList3>`. Initialize COM on this
///           thread and build the taskbar COM object, or `None` on any failure.
///           Module-private, Windows-only.
/// Why:      Done once and cached; pulled into its own function so `set_..._progress` reads
///           cleanly.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function createTaskbarList(): ITaskbarList3 | null { ... }
/// ```
#[cfg(windows)]
fn create_taskbar_list() -> Option<ITaskbarList3> {
    // What:     `unsafe { ... }`. COM calls are raw FFI, so the whole body is `unsafe`
    //           (Rust cannot verify the COM contracts). `unsafe` means "trust me", not
    //           "dangerous".
    // Why:      Required to call `CoInitializeEx` / `CoCreateInstance`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // no equivalent: raw platform calls
    // ```
    unsafe {
        // What:     `let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);`. Ensure COM
        //           is initialized on this thread in single-threaded-apartment mode. winit
        //           already initializes OLE (STA) on its window thread, so this typically
        //           returns `S_FALSE` (already initialized) and just bumps the init count;
        //           `let _ =` discards the returned `HRESULT`.
        // Why:      `CoCreateInstance` requires an initialized apartment; calling this
        //           defensively makes the code correct even if winit's init changes.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // coInitializeEx(null, "apartmentThreaded"); // ignore result
        // ```
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        // What:     `let taskbar: ITaskbarList3 = CoCreateInstance(&TaskbarList, None, CLSCTX_INPROC_SERVER).ok()?;`.
        //           Create the shell taskbar object and ask for its `ITaskbarList3`
        //           interface. `&TaskbarList` is the class id; `None` means no aggregating
        //           outer object; `CLSCTX_INPROC_SERVER` loads it in-process. Returns
        //           `Result<ITaskbarList3>`; `.ok()?` yields the interface or returns `None`
        //           on failure.
        // Why:      This object is what actually moves the taskbar bar.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const taskbar = coCreateInstance(TaskbarList, null, "inproc"); if (!taskbar) return null;
        // ```
        let taskbar: ITaskbarList3 =
            CoCreateInstance(&TaskbarList, None, CLSCTX_INPROC_SERVER).ok()?;
        // What:     `taskbar.HrInit().ok()?;`. Required one-time initialization of the
        //           taskbar interface. Returns `Result<()>`; `.ok()?` returns `None` on
        //           failure.
        // Why:      ITaskbarList must be `HrInit`-ed before other methods are called.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!taskbar.hrInit()) return null;
        // ```
        taskbar.HrInit().ok()?;
        // What:     `Some(taskbar)`. Wrap the ready interface as present. Tail expression ->
        //           return value.
        // Why:      Hand the cached interface back to the caller.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return taskbar;
        // ```
        Some(taskbar)
    }
}

/// What:     `fn set_windows_taskbar_progress(app: &AppWindow, fraction: f64, visible: bool)`.
///           Push the current progress to the Windows taskbar bar. Module-private,
///           Windows-only. Runs on the UI thread.
/// Why:      The Windows counterpart to the Linux `Launcher::set_progress`; called from
///           `emit_launcher_progress` under `#[cfg(windows)]`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function setWindowsTaskbarProgress(app, fraction, visible): void { ... }
/// ```
#[cfg(windows)]
fn set_windows_taskbar_progress(app: &AppWindow, fraction: f64, visible: bool) {
    // What:     `let hwnd = match window_hwnd(app) { Some(h) => h, None => return };`.
    //           Resolve the window handle, or bail out silently if it is not ready.
    // Why:      Without a handle there is nothing to drive; best-effort like the Linux path
    //           (a missing handle never disrupts playback).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const hwnd = windowHwnd(app); if (!hwnd) return;
    // ```
    let hwnd = match window_hwnd(app) {
        Some(h) => h,
        None => return,
    };
    // What:     `TASKBAR.with(|cell| { ... })`. Access this thread's cached COM interface
    //           cell. `with` runs the closure with a `&RefCell<...>`.
    // Why:      Reuse the one interface instead of recreating it each tick.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // withThreadLocal(TASKBAR, (cell) => { ... });
    // ```
    TASKBAR.with(|cell| {
        // What:     `let needs_init = cell.borrow().is_none();`. `.borrow()` takes a shared
        //           runtime borrow; `.is_none()` reads whether the cache is still empty,
        //           releasing the borrow at the end of THIS statement (so the `borrow_mut`
        //           below does not overlap it).
        // Why:      Decide whether to build the interface without holding a borrow across
        //           the mutation.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const needsInit = cell.value === null;
        // ```
        let needs_init = cell.borrow().is_none();
        // What:     `if needs_init { *cell.borrow_mut() = create_taskbar_list(); }`. Build
        //           and store the interface on first use (or after a prior failed attempt).
        //           `*cell.borrow_mut() = ...` writes through the runtime-checked MUTABLE
        //           borrow (the `*` dereferences the guard to assign the inner value).
        // Why:      Lazily create the COM object the first time progress is shown.
        // Gotcha:   `borrow_mut` panics if another borrow is live; that is why `needs_init`
        //           was read and released first.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (needsInit) cell.value = createTaskbarList();
        // ```
        if needs_init {
            *cell.borrow_mut() = create_taskbar_list();
        }
        // What:     `let guard = cell.borrow();`. Take a shared runtime borrow to read the
        //           cached interface.
        // Why:      Need a reference to call methods on the interface.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const taskbar = cell.value;
        // ```
        let guard = cell.borrow();
        // What:     `if let Some(taskbar) = guard.as_ref() { ... }`. `.as_ref()` borrows the
        //           inner `Option<ITaskbarList3>` as `Option<&ITaskbarList3>`; proceed only
        //           when the interface exists (creation may have failed, leaving `None`).
        // Why:      A failed creation is retried next tick; never panic on it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (taskbar) { ... }
        // ```
        if let Some(taskbar) = guard.as_ref() {
            // What:     `unsafe { ... }`. The COM method calls are raw FFI.
            // Why:      Required to call ITaskbarList3 methods.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // // raw platform calls
            // ```
            unsafe {
                // What:     `if visible { ... } else { ... }`. Show a moving bar when
                //           playing, otherwise clear it.
                // Why:      The bar should appear only while real-duration audio plays.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (visible) { ... } else { ... }
                // ```
                if visible {
                    // What:     `let total: u64 = 1000;`. A fixed denominator for the
                    //           progress ratio. `u64` is the unsigned 64-bit integer
                    //           SetProgressValue takes (siblings: `u32`, `usize`).
                    // Why:      ITaskbarList3 wants completed/total as integers, so we scale
                    //           the 0..1 fraction onto a 0..1000 range.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // const total = 1000;
                    // ```
                    let total: u64 = 1000;
                    // What:     `let completed = (fraction.clamp(0.0, 1.0) * total as f64) as u64;`.
                    //           `.clamp(0.0, 1.0)` pins the fraction into 0..=1, `* total as
                    //           f64` scales to the denominator (widening `total` for the
                    //           multiply), and `as u64` truncates the result back to an
                    //           integer.
                    // Why:      Convert the float fraction into the integer numerator.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // const completed = Math.floor(Math.min(1, Math.max(0, fraction)) * total);
                    // ```
                    let completed = (fraction.clamp(0.0, 1.0) * total as f64) as u64;
                    // What:     `let _ = taskbar.SetProgressState(hwnd, TBPF_NORMAL);`. Put
                    //           the bar in the normal (green, determinate) state. Returns
                    //           `Result<()>`; `let _ =` ignores failures.
                    // Why:      A no-progress window must switch to a normal bar before a
                    //           value is shown.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // taskbar.setProgressState(hwnd, "normal");
                    // ```
                    let _ = taskbar.SetProgressState(hwnd, TBPF_NORMAL);
                    // What:     `let _ = taskbar.SetProgressValue(hwnd, completed, total);`.
                    //           Move the bar to `completed/total`. Result ignored.
                    // Why:      This is the actual progress position.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // taskbar.setProgressValue(hwnd, completed, total);
                    // ```
                    let _ = taskbar.SetProgressValue(hwnd, completed, total);
                } else {
                    // What:     `let _ = taskbar.SetProgressState(hwnd, TBPF_NOPROGRESS);`.
                    //           Clear the bar (no progress shown). Result ignored.
                    // Why:      Hide the bar when paused or between tracks.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // taskbar.setProgressState(hwnd, "noProgress");
                    // ```
                    let _ = taskbar.SetProgressState(hwnd, TBPF_NOPROGRESS);
                }
            }
        }
    });
}
//endregion
