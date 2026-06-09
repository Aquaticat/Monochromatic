//! Desktop-shell integration: the Wayland app id and the KDE taskbar progress.
//!
//! Two small concerns share one identifier (`APP_ID`), so they live together:
//!
//! - `set_window_app_id` is a winit window-attributes hook that stamps the
//!   Wayland app id onto the window at creation. KDE matches a running window to
//!   a `.desktop` file by that id, which is how the progress badge finds the
//!   window. app id can only be set at creation (it is an `xdg_toplevel`
//!   property), so this must run via the backend hook, not after the fact.
//! - `Launcher` emits the `com.canonical.Unity.LauncherEntry` `Update` signal on
//!   the session bus, the de-facto Linux protocol for taskbar progress (KDE
//!   Plasma supports it natively; GNOME needs Dash-to-Dock). The `appUri` names
//!   the same `.desktop` file, and the body carries `progress` (0..1) and
//!   `progress-visible`.
//!
//! Everything is best-effort: with no session bus (or a shell that ignores the
//! protocol) the signal is silently dropped and playback is unaffected.

// What:     `use std::collections::HashMap;`. The owned hash-map type. Sibling:
//           `BTreeMap` (sorted). Used for the signal's `a{sv}` property dict.
// Why:      zvariant serializes `HashMap<&str, Value>` as the D-Bus `a{sv}` the
//           LauncherEntry `Update` body needs.
// TS map:   `type HashMap<K, V> = Map<K, V>;`
// What:     `#[cfg(target_os = "linux")]` is a conditional-compilation attribute:
//           the line right below it is compiled into the program ONLY on Linux
//           builds and skipped on every other target (macOS here).
// Why:      The D-Bus signal that uses this map is Linux-only, and `zbus` is not
//           even a dependency on macOS, so its whole import chain must be gated.
// TS map:   no equivalent; conditional compilation has no TS analogue (the
//           closest mental model is stripping the line in a platform-specific
//           build step).
#[cfg(target_os = "linux")]
use std::collections::HashMap;

// What:     `use i_slint_backend_winit::winit::platform::wayland::WindowAttributesExtWayland;`.
//           The extension trait adding `with_name` to `WindowAttributes`. Pulled
//           from Slint's RE-EXPORTED winit (`i_slint_backend_winit::winit`), not a
//           separate `winit` crate, so the type matches the hook's parameter.
// Why:      `with_name(general, instance)` sets the Wayland app id (`general`); the
//           same field also becomes the X11 `WM_CLASS`, so one call covers both.
// TS map:   no equivalent; a mixin adding a method to a builder type.
// What:     `#[cfg(target_os = "linux")]`: compile this Wayland-only import on
//           Linux builds only (see the first gated import for the full
//           explanation of the attribute).
// Why:      `with_name` (Wayland app id) exists only on the Linux winit backend;
//           on macOS the trait is absent, so the import would not resolve.
// TS map:   no equivalent; the line simply does not exist in a macOS build.
#[cfg(target_os = "linux")]
use i_slint_backend_winit::winit::platform::wayland::WindowAttributesExtWayland;

// What:     `use i_slint_backend_winit::winit::window::WindowAttributes;`. The
//           winit window-creation settings struct the hook receives and returns.
// Why:      `set_window_app_id`'s signature names it.
// TS map:   `type WindowAttributes = WindowCreateOptions;`
use i_slint_backend_winit::winit::window::WindowAttributes;

// What:     `use zbus::blocking::Connection;`. A synchronous D-Bus connection
//           (the blocking facade over the async `zbus::Connection`). `Clone` (it
//           shares one underlying socket), `Send`, `Sync`.
// Why:      The UI thread emits the signal inline; the blocking API avoids dragging
//           an async runtime into the property edge. `Clone` lets each update tick
//           carry its own handle into the event-loop closure.
// TS map:   `import { Connection } from "dbus";`
// What:     `#[cfg(target_os = "linux")]`: Linux-only import (see the first gated
//           import for the attribute's full explanation).
// Why:      `zbus` is a Linux-only dependency (gated in Cargo.toml); macOS has no
//           D-Bus session bus, so the connection type does not exist there.
// TS map:   no equivalent; absent from a macOS build.
#[cfg(target_os = "linux")]
use zbus::blocking::Connection;

// What:     `use zbus::zvariant::Value;`. The D-Bus dynamic-value enum (`v`):
//           `Value::F64(f64)`, `Value::Bool(bool)`, and so on. `zvariant` is
//           re-exported by `zbus`.
// Why:      The `a{sv}` dict's values are variants; `Value` is each entry's value.
// TS map:   `type Value = number | boolean | string | ...;`
// What:     `#[cfg(target_os = "linux")]`: Linux-only import (see the first gated
//           import for the attribute's full explanation).
// Why:      `zbus`/`zvariant` are Linux-only here, so this dynamic-value type is
//           absent on macOS.
// TS map:   no equivalent; absent from a macOS build.
#[cfg(target_os = "linux")]
use zbus::zvariant::Value;

// What:     `use crate::identity::APP_ID;` imports the Wayland app id (the
//           `.desktop` basename `<APP_ID>.desktop` and the X11 `WM_CLASS` are the
//           same string) from the shared identity module, instead of defining a
//           local constant here.
// Why:      KDE links the window to the launcher entry only when the id stamped on
//           the window matches the `.desktop` file; sourcing it from one place
//           keeps the window, the desktop file, and the launcher URI equal.
// TS map:   `import { APP_ID } from "./identity";`
// What:     `#[cfg(target_os = "linux")]`: import this on Linux only.
// Why:      Its only readers (the Wayland `with_name` hook and the launcher URI)
//           are Linux-only, so importing it on macOS would be an unused import and
//           trip the dead-code/unused-import warning.
// TS map:   no equivalent; absent from a macOS build.
#[cfg(target_os = "linux")]
use crate::identity::APP_ID;

// What:     `const SIGNAL_PATH: &str = "/org/monochromatic/MusicPlayer";`. The
//           object path the `Update` signal is emitted from.
// Why:      KDE matches the signal by interface + member, not path, so any valid
//           object path works; this one names the app.
// TS map:   `const SIGNAL_PATH = "/org/monochromatic/MusicPlayer";`
// What:     `#[cfg(target_os = "linux")]`: Linux-only constant (used only by the
//           Linux `set_progress` D-Bus emit below).
// Why:      Avoid an unused-constant warning on macOS where no signal is emitted.
// TS map:   no equivalent; absent from a macOS build.
#[cfg(target_os = "linux")]
const SIGNAL_PATH: &str = "/org/monochromatic/MusicPlayer";

// What:     `const LAUNCHER_INTERFACE: &str = "com.canonical.Unity.LauncherEntry";`.
//           The D-Bus interface the taskbar-progress signal lives on.
// Why:      The well-known LauncherEntry interface KDE (and Unity-style docks)
//           listen on.
// TS map:   `const LAUNCHER_INTERFACE = "com.canonical.Unity.LauncherEntry";`
// What:     `#[cfg(target_os = "linux")]`: Linux-only constant (see SIGNAL_PATH).
// Why:      Avoid an unused-constant warning on macOS.
// TS map:   no equivalent; absent from a macOS build.
#[cfg(target_os = "linux")]
const LAUNCHER_INTERFACE: &str = "com.canonical.Unity.LauncherEntry";

// What:     `const UPDATE_MEMBER: &str = "Update";`. The signal name.
// Why:      LauncherEntry carries progress/count/urgency via one `Update` signal.
// TS map:   `const UPDATE_MEMBER = "Update";`
// What:     `#[cfg(target_os = "linux")]`: Linux-only constant (see SIGNAL_PATH).
// Why:      Avoid an unused-constant warning on macOS.
// TS map:   no equivalent; absent from a macOS build.
#[cfg(target_os = "linux")]
const UPDATE_MEMBER: &str = "Update";

// What:     `pub(crate) fn set_window_app_id(attributes: WindowAttributes) -> WindowAttributes`.
//           A winit window-attributes hook: stamp the app id onto the window being
//           created and return the adjusted attributes.
// Why:      Passed to `Backend::builder().with_window_attributes_hook(...)`. KDE
//           needs the app id at creation to associate the window with the launcher
//           entry; nothing can set it afterward.
// TS map:   `function setWindowAppId(attributes: WindowAttributes): WindowAttributes`
// What:     `#[cfg(target_os = "linux")]`: this is the LINUX version of the hook,
//           compiled only on Linux. The non-Linux pass-through version follows.
// Why:      `with_name` (the Wayland app id) exists only on the Linux winit
//           backend; the macOS build gets the stub below instead.
// TS map:   the Linux branch of a platform switch.
#[cfg(target_os = "linux")]
pub fn set_window_app_id(attributes: WindowAttributes) -> WindowAttributes {
    // What:     `attributes.with_name(APP_ID, APP_ID)`. Set the name pair (Wayland
    //           app id = first arg; the same field feeds the X11 `WM_CLASS`). Tail
    //           expression -> return value.
    // Why:      One call sets the id under whichever display server is in use.
    // TS map:   `return attributes.withName(APP_ID, APP_ID);`
    attributes.with_name(APP_ID, APP_ID)
}

// What:     `#[cfg(not(target_os = "linux"))]`: the NON-Linux version of the hook
//           (macOS here), compiled on every target except Linux. It returns the
//           window attributes unchanged.
// Why:      The Wayland app id is a Linux display-server concept with no macOS
//           analogue, so the hook is a pass-through; the caller in main.rs
//           registers it identically on both platforms.
// TS map:   the non-Linux branch: `(a) => a`.
#[cfg(not(target_os = "linux"))]
pub fn set_window_app_id(attributes: WindowAttributes) -> WindowAttributes {
    // What:     `attributes`. Bare tail expression: return the input untouched.
    // Why:      Nothing to stamp on a non-Wayland platform.
    // TS map:   `return attributes;`
    attributes
}

// What:     `#[derive(Clone)] pub(crate) struct Launcher { ... }`. A cheap-to-clone
//           handle that emits taskbar-progress signals. `Clone` shares the one
//           underlying socket; `Send`/`Sync` come for free from the fields.
// Why:      The engine's update callback clones one per tick into the event-loop
//           closure, mirroring how the window weak handle is cloned.
// TS map:   `class Launcher { connection: Connection | null; appUri: string }`
// What:     `#[cfg(target_os = "linux")]`: this is the LINUX `Launcher`, the real
//           D-Bus emitter, compiled only on Linux. The macOS stub struct follows
//           the impl block below.
// Why:      Its `connection` field is a `zbus` type that does not exist on macOS.
// TS map:   the Linux branch of a platform switch over the class.
#[cfg(target_os = "linux")]
#[derive(Clone)]
pub struct Launcher {
    // What:     `connection: Option<Connection>`. The session-bus connection, or
    //           `None` when no bus is reachable.
    // Why:      Best-effort: a missing bus disables progress instead of failing.
    // TS map:   `connection: Connection | null;`
    connection: Option<Connection>,
    // What:     `app_uri: String`. The `application://<APP_ID>.desktop` URI naming
    //           which launcher entry the progress applies to.
    // Why:      The first argument of every `Update` signal.
    // TS map:   `appUri: string;`
    app_uri: String,
}

// What:     `impl Launcher { ... }`. Construction and the one emit method.
// Why:      Bundle the connection with the URI it always sends.
// TS map:   class body.
// What:     `#[cfg(target_os = "linux")]`: the LINUX impl, matching the Linux
//           struct above; compiled only on Linux.
// Why:      Its body calls `zbus`, which is Linux-only.
// TS map:   the Linux branch's class methods.
#[cfg(target_os = "linux")]
impl Launcher {
    // What:     `pub(crate) fn new() -> Launcher`. Connect to the session bus
    //           (best-effort) and precompute the launcher URI.
    // Why:      One connection reused for the app's lifetime.
    // TS map:   `static connect(): Launcher`
    pub fn new() -> Launcher {
        // What:     `let connection = Connection::session().ok();`. Open the session
        //           bus; `.ok()` turns a failure into `None` (no bus -> disabled).
        // Why:      A headless or bus-less environment must not crash the player.
        // TS map:   `const connection = trySessionBus();`
        let connection = Connection::session().ok();
        // What:     `Launcher { connection, app_uri: format!("application://{APP_ID}.desktop") }`.
        //           Build the handle with the precomputed URI.
        // Why:      The URI never changes, so format it once.
        // TS map:   `return { connection, appUri: `application://${APP_ID}.desktop` };`
        Launcher {
            connection,
            app_uri: format!("application://{APP_ID}.desktop"),
        }
    }

    // What:     `pub(crate) fn set_progress(&self, fraction: f64, visible: bool)`.
    //           Emit one `Update` carrying the progress fraction and whether the
    //           bar is shown. A no-op when there is no connection.
    // Why:      Called whenever position/play-state changes; KDE moves the bar.
    // TS map:   `setProgress(fraction: number, visible: boolean): void`
    pub fn set_progress(&self, fraction: f64, visible: bool) {
        // What:     `if let Some(connection) = self.connection.as_ref() { ... }`.
        //           Borrow the connection; skip entirely when absent.
        // Why:      Best-effort emission.
        // TS map:   `if (!this.connection) return; ...`
        if let Some(connection) = self.connection.as_ref() {
            // What:     `let clamped = fraction.clamp(0.0, 1.0);`. Bound the fraction
            //           to 0..=1 (a stray duration/position could overshoot).
            // Why:      The protocol expects a 0..1 progress value.
            // TS map:   `const clamped = Math.min(1, Math.max(0, fraction));`
            let clamped = fraction.clamp(0.0, 1.0);
            // What:     `let properties: HashMap<&str, Value> = HashMap::from([...]);`.
            //           The `a{sv}` body: `progress` (double) and `progress-visible`
            //           (bool).
            // Why:      These two keys drive the taskbar bar; others (count, urgent)
            //           are unused here.
            // TS map:   `const properties = { progress: clamped, "progress-visible": visible };`
            let properties: HashMap<&str, Value> = HashMap::from([
                ("progress", Value::F64(clamped)),
                ("progress-visible", Value::Bool(visible)),
            ]);
            // What:     `let _ = connection.emit_signal(...);`. Broadcast the signal
            //           (`None` destination). Body is `(appUri, properties)` ->
            //           `(sa{sv})`. The result is ignored on purpose.
            // Why:      A failed emit (bus dropped) must not interrupt playback, and
            //           logging here would spam at the position-update rate.
            // TS map:   `this.connection.emitSignal(null, PATH, IFACE, "Update", [appUri, properties]);`
            let _ = connection.emit_signal(
                None::<&str>,
                SIGNAL_PATH,
                LAUNCHER_INTERFACE,
                UPDATE_MEMBER,
                &(self.app_uri.as_str(), properties),
            );
        }
    }
}

// What:     `#[cfg(not(target_os = "linux"))] #[derive(Clone)] pub struct Launcher;`.
//           The NON-Linux `Launcher`: a unit struct (no fields), compiled on every
//           target except Linux. `Clone` so the engine's per-tick clone compiles.
// Why:      macOS has no D-Bus LauncherEntry protocol, so there is nothing to
//           hold; the type exists only to keep callers (main.rs, ui_progress.rs)
//           identical across platforms.
// TS map:   `class Launcher {}` (an empty placeholder)
#[cfg(not(target_os = "linux"))]
#[derive(Clone)]
pub struct Launcher;

// What:     `#[cfg(not(target_os = "linux"))] impl Launcher { ... }`. The no-op
//           construction + emit methods matching the Linux API.
// Why:      `Launcher::new()` and `set_progress(..)` are called unconditionally;
//           the stubs make those compile and do nothing on macOS.
// TS map:   the placeholder class body.
#[cfg(not(target_os = "linux"))]
impl Launcher {
    // What:     `pub fn new() -> Launcher`. Build the empty placeholder.
    // Why:      Mirror the Linux constructor's signature.
    // TS map:   `static connect(): Launcher { return new Launcher(); }`
    pub fn new() -> Launcher {
        // What:     `Launcher`. Construct the unit struct (no fields). Bare tail
        //           expression -> return value.
        // Why:      Nothing to initialise off Linux.
        // TS map:   `return new Launcher();`
        Launcher
    }

    // What:     `pub fn set_progress(&self, _fraction: f64, _visible: bool)`. A
    //           no-op. The leading `_` on each parameter name tells the compiler
    //           the argument is intentionally unused (no "unused variable"
    //           warning). Empty body `{}`.
    // Why:      No taskbar-progress protocol on macOS; accept the call and do
    //           nothing so ui_progress.rs stays platform-agnostic.
    // TS map:   `setProgress(_fraction: number, _visible: boolean): void {}`
    pub fn set_progress(&self, _fraction: f64, _visible: bool) {}
}

// What:     `impl Default for Launcher { ... }`. Delegates to `new()`.
// Why:      Clippy's `new_without_default`: a public argument-less `new` should
//           have a matching `Default`. On Linux this is the best-effort
//           session-bus connect; off Linux it builds the unit placeholder.
// TS map:   no equivalent.
impl Default for Launcher {
    // What:     `fn default() -> Self { Self::new() }`. Build via `new`.
    // Why:      One construction path. Tail expression -> return value.
    // TS map:   `static default() { return Launcher.connect(); }`
    fn default() -> Self {
        Self::new()
    }
}
