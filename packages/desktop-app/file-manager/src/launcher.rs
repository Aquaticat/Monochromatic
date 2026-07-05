//! Desktop-shell integration for the file-manager prototype: the Wayland app-id
//! hook, mirroring the sibling terminal app.

/// What:     `use i_slint_backend_winit::winit::platform::wayland::WindowAttributesExtWayland;`
///           imports the trait that adds `with_name` to winit window attributes.
/// Why:      Slint's default backend selector has no hook for the Wayland app id.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { withWaylandName } from "winit-wayland";
/// ```
use i_slint_backend_winit::winit::platform::wayland::WindowAttributesExtWayland;

/// What:     `use i_slint_backend_winit::winit::window::WindowAttributes;` imports
///           the creation-time window settings record.
/// Why:      The app-id hook receives and returns this exact type.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import type { WindowAttributes } from "winit";
/// ```
use i_slint_backend_winit::winit::window::WindowAttributes;

/// What:     `pub const APP_ID: &str = "monochromatic.file-manager";` declares a
///           borrowed string constant (`&str`, not an owned `String`, so it lives
///           in the binary with no allocation).
/// Why:      The Wayland app id and any future `.desktop` StartupWMClass must match.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const APP_ID = "monochromatic.file-manager";
/// ```
pub const APP_ID: &str = "monochromatic.file-manager";

/// What:     `pub fn set_window_app_id(attributes: WindowAttributes) ->
///           WindowAttributes` is the hook Slint's winit backend builder calls at
///           native window creation.
/// Why:      Shells associate windows with desktop files by app id.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function setWindowAppId(attributes) { return attributes.withName(APP_ID, APP_ID); }
/// ```
pub fn set_window_app_id(attributes: WindowAttributes) -> WindowAttributes {
    // What:     `attributes.with_name(APP_ID, APP_ID)` sets the Wayland app id and
    //           the X11 WM_CLASS pair, returning the modified value; tail
    //           expression.
    // Why:      The id must be present before the native window is created.
    attributes.with_name(APP_ID, APP_ID)
}
