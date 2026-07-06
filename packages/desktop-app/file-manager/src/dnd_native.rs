//! Foundation for the native (OS-level) drag-and-drop adapters: pull the raw
//! platform window handles out of the Slint window so a per-OS adapter can drive
//! the platform's own drag protocol. This is needed because winit 0.30 (which
//! Slint's backend wraps) has no Wayland drag-and-drop at all, so on Wayland the
//! adapter has to speak the `wl_data_device` protocol itself on winit's own
//! connection, and that needs the `wl_display` and `wl_surface` pointers this
//! module extracts. The winit-event path (`on_winit_window_event` +
//! `DroppedFile`) only covers X11, macOS, and Windows, never pure Wayland.

/// What:     `use std::ffi::c_void;` imports the "unknown C type" placeholder
///           (`void` in C). A `*mut c_void` is C's `void*`: a pointer to memory
///           whose type Rust does not track.
/// Why:      The Wayland objects (`wl_display`, `wl_surface`) are opaque C structs;
///           we hold them as untyped pointers to hand to the Wayland client later.
use std::ffi::c_void;

/// What:     `use std::ptr::NonNull;` imports a pointer wrapper that is guaranteed
///           never to be null (sibling: a plain `*mut T`, which may be null).
/// Why:      raw-window-handle hands back `NonNull`, and a Wayland object pointer is
///           only meaningful when it actually points at something.
use std::ptr::NonNull;

/// What:     `use i_slint_backend_winit::WinitWindowAccessor;` imports the trait
///           that adds `with_winit_window`/`has_winit_window` to a `slint::Window`.
/// Why:      Method-call syntax on the window only compiles when this trait is in
///           scope (Rust requires the trait imported to call its methods).
use i_slint_backend_winit::WinitWindowAccessor;

/// What:     `use i_slint_backend_winit::winit::raw_window_handle::{...};` imports
///           the raw-window-handle 0.6 traits and enums winit re-exports:
///           `HasDisplayHandle`/`HasWindowHandle` give `.display_handle()`/
///           `.window_handle()`, and `RawDisplayHandle`/`RawWindowHandle` are the
///           per-platform enums whose `Wayland` variant carries the pointers.
/// Why:      Reaching winit's re-export (rather than a separate rwh dependency)
///           guarantees the same rwh version winit uses, so the types line up.
use i_slint_backend_winit::winit::raw_window_handle::{
    HasDisplayHandle, HasWindowHandle, RawDisplayHandle, RawWindowHandle,
};

/// What:     `pub struct WaylandHandles { display, surface }` is a plain record of
///           the two Wayland pointers a data-device adapter needs: the connection
///           (`wl_display`) and the app's drag-origin surface (`wl_surface`), each
///           a `NonNull<c_void>` (a guaranteed-non-null `void*`).
/// Why:      The Wayland outbound drag calls `start_drag(source, origin_surface,
///           icon, serial)` and must talk on the app's existing connection, so it
///           needs exactly these two handles.
pub struct WaylandHandles {
    /// What:     `pub display: NonNull<c_void>` is the `*mut wl_display` connection
    ///           pointer, non-null.
    /// Why:      The adapter wraps this existing connection instead of opening a new
    ///           one, so its data-device shares winit's input serials.
    pub display: NonNull<c_void>,
    /// What:     `pub surface: NonNull<c_void>` is the `*mut wl_surface` of the app
    ///           window, non-null.
    /// Why:      A Wayland drag is anchored to the origin surface.
    pub surface: NonNull<c_void>,
}

/// What:     `pub fn wayland_handles(window: &slint::Window) -> Option<WaylandHandles>`
///           returns the Wayland pointers when the window is a live Wayland window,
///           else `None` (X11, macOS, Windows, or no window yet). `&slint::Window`
///           borrows the window read-only.
/// Why:      The Wayland adapter calls this once to attach to the connection;
///           `None` means "not Wayland", so a different adapter handles this OS.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function waylandHandles(window: SlintWindow): WaylandHandles | null { ... }
/// ```
pub fn wayland_handles(window: &slint::Window) -> Option<WaylandHandles> {
    // What:     `window.with_winit_window(|winit_window| { ... })` runs the closure
    //           with the underlying `winit::window::Window` and returns
    //           `Some(result)` while the window exists, else `None`. The closure
    //           itself returns an `Option<WaylandHandles>`, so the whole call is
    //           `Option<Option<WaylandHandles>>` and `.flatten()` collapses it.
    // Why:      The winit window is the only thing that exposes the raw handles.
    window
        .with_winit_window(|winit_window| {
            // What:     `winit_window.display_handle().ok()?` asks winit for the
            //           display handle; `.ok()` turns the `Result` into an `Option`
            //           and `?` returns `None` from this closure on error.
            // Why:      Without a display handle there is no Wayland connection.
            let display = match winit_window.display_handle().ok()?.as_raw() {
                // What:     `RawDisplayHandle::Wayland(handle) => handle.display`
                //           matches the Wayland variant and pulls its `display`
                //           pointer (a `NonNull<c_void>`).
                // Why:      Only the Wayland variant carries a `wl_display`.
                RawDisplayHandle::Wayland(handle) => handle.display,
                // What:     `_ => return None` rejects every other backend (X11,
                //           macOS AppKit, Windows Win32).
                // Why:      This adapter is Wayland-only; others handle those.
                _ => return None,
            };
            // What:     `winit_window.window_handle().ok()?` asks for the window
            //           handle the same way.
            // Why:      The surface pointer lives on the window handle.
            let surface = match winit_window.window_handle().ok()?.as_raw() {
                // What:     `RawWindowHandle::Wayland(handle) => handle.surface`
                //           pulls the `wl_surface` pointer.
                // Why:      The drag is anchored to this surface.
                RawWindowHandle::Wayland(handle) => handle.surface,
                // What:     `_ => return None` rejects non-Wayland windows.
                // Why:      Same Wayland-only reason.
                _ => return None,
            };
            // What:     `Some(WaylandHandles { display, surface })` builds the record
            //           and wraps it in the present `Option` variant; tail of the
            //           closure, so it is the closure's return value.
            // Why:      Hand both pointers back to the caller.
            Some(WaylandHandles { display, surface })
        })
        // What:     `.flatten()` turns `Option<Option<T>>` into `Option<T>`, so a
        //           missing window and a non-Wayland window both read as `None`.
        // Why:      The caller only cares whether it got Wayland handles.
        .flatten()
}

/// What:     `pub fn log_backend(window: &slint::Window)` logs which windowing
///           backend the Slint window runs on, for startup diagnostics.
/// Why:      The DnD path differs per backend (Wayland needs the hand-written
///           `wl_data_device` adapter; X11/macOS/Windows can use winit events), so
///           a run's log should say which one is active.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function logBackend(window: SlintWindow): void { ... }
/// ```
pub fn log_backend(window: &slint::Window) {
    // What:     `let backend = window.with_winit_window(|w| { ... }).flatten()
    //           .unwrap_or("no-winit-window");` classifies the backend into a short
    //           label, defaulting when there is no winit window.
    // Why:      One readable string for the log line below.
    let backend = window
        .with_winit_window(|winit_window| {
            // What:     `winit_window.display_handle().ok().map(|handle| match
            //           handle.as_raw() { ... })` maps the display handle to a label,
            //           or `None` on error.
            // Why:      The display-handle variant names the backend.
            winit_window.display_handle().ok().map(|handle| match handle.as_raw() {
                // What:     Each arm returns a static label for one backend.
                // Why:      Human-readable backend name.
                RawDisplayHandle::Wayland(_) => "wayland",
                RawDisplayHandle::Xlib(_) | RawDisplayHandle::Xcb(_) => "x11",
                RawDisplayHandle::AppKit(_) => "macos-appkit",
                RawDisplayHandle::Windows(_) => "windows",
                _ => "other",
            })
        })
        .flatten()
        .unwrap_or("no-winit-window");
    // What:     `tracing::info!(backend, "native DnD: window backend detected");`
    //           logs the label as a structured field.
    // Why:      Confirms, at startup, which DnD path will run.
    tracing::info!(backend, "native DnD: window backend detected");
}

/// What:     `pub fn start<F>(window: &slint::Window, on_drop: F)` starts the native
///           drag-and-drop adapter for whichever backend the window runs on. On
///           Wayland it spawns the `wl_data_device` thread; other backends are not
///           wired yet. `F: Fn(Vec<String>) + Send + 'static` is the callback invoked
///           (off the UI thread) with the paths of an inbound file drop.
/// Why:      Single entry point the app calls once the window is realized; the
///           callback lets the app surface dropped paths without this module knowing
///           the UI.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function start(window: SlintWindow, onDrop: (paths: string[]) => void): void { ... }
/// ```
pub fn start<F>(window: &slint::Window, on_drop: F)
where
    F: Fn(Vec<String>) + Send + 'static,
{
    // What:     `log_backend(window);` records which backend is active first.
    // Why:      The log should always name the backend, wired or not.
    log_backend(window);
    // What:     `if std::env::var_os("MONOCHROMATIC_FM_NO_NATIVE_DND").is_some() {
    //           ...; return; }` bails before starting any native adapter when the
    //           guard env var is set. `var_os` returns an `Option`; `.is_some()`
    //           tests presence.
    // Why:      An escape hatch to run the app WITHOUT the native drag-and-drop
    //           thread, to isolate whether that thread disturbs the app.
    if std::env::var_os("MONOCHROMATIC_FM_NO_NATIVE_DND").is_some() {
        tracing::info!("native DnD: disabled via MONOCHROMATIC_FM_NO_NATIVE_DND");
        // What:     `let _ = &on_drop;` marks the callback used on the disabled path.
        // Why:      Avoid an unused-variable warning when the adapter is skipped.
        let _ = &on_drop;
        return;
    }
    // What:     `#[cfg(target_os = "linux")] { ... }` compiles this block only on
    //           Linux, the one OS whose Wayland path needs the hand-written adapter.
    // Why:      `dnd_wayland` and its Wayland crates only exist on Linux.
    #[cfg(target_os = "linux")]
    {
        // What:     `if let Some(handles) = wayland_handles(window) { ... } else {...}`
        //           starts the Wayland adapter when on Wayland, else notes the gap.
        // Why:      Only Wayland windows drive `wl_data_device`; X11 (and later macOS
        //           and Windows) use different inbound/outbound paths.
        if let Some(handles) = wayland_handles(window) {
            crate::dnd_wayland::start(handles.display, on_drop);
        } else {
            tracing::info!("native DnD: not a Wayland window, wl_data_device adapter skipped");
        }
    }
    // What:     `#[cfg(not(target_os = "linux"))] { let _ = on_drop; }` consumes the
    //           callback on non-Linux, where no adapter uses it yet.
    // Why:      Keep the signature cross-platform without an unused-variable warning.
    #[cfg(not(target_os = "linux"))]
    {
        let _ = on_drop;
    }
}
