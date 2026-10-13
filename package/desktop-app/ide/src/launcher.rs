//! Desktop-shell integration:
//!  the Wayland app id,
//!  stamped before the window exists.
//!
//! What:
//!  [`install_backend`] installs Slint's winit backend explicitly with a window-attributes hook,
//!       [`set_window_app_id`],
//!  that names the window `monochromatic.ide`,
//!  as the sibling terminal
//!       and music player do in their own `launcher.rs`.
//! Why:
//!  Desktop shells match a window to its launcher entry by app id (`StartupWMClass` in
//!      `share/applications/monochromatic.ide.desktop`);
//!  Slint's default backend sets none,
//!  and the id
//!      cannot be changed after the window is created.

/// What:
///  The trait that adds `with_name` (the Wayland app id) to winit window attributes;
///  `use`
///       brings it into scope like a TS import.
/// Why:
///  Without the trait in scope the method does not exist on the attributes value.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { withWaylandName } from 'winit/platform/wayland';
/// ```
use i_slint_backend_winit::winit::platform::wayland::WindowAttributesExtWayland;
/// What:
///  The creation-time window settings record and Slint's winit backend.
/// Why:
///  The hook receives and returns attributes;
///  the backend is built with the hook installed.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Backend } from 'i-slint-backend-winit'; import type { WindowAttributes } from 'winit';
/// ```
use i_slint_backend_winit::{Backend, winit::window::WindowAttributes};

/// What:
///  The app id.
///  `&str` is text stored in the program (sibling `String`,
///  owned text built at run time).
/// Why:
///  The window's app id and the launcher entry's `StartupWMClass` and file name must match exactly.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const APP_ID = 'monochromatic.ide';
/// ```
pub const APP_ID: &str = "monochromatic.ide";

/// What:
///  The window-attributes hook:
///  stamp the app id onto the window being created and hand the
///       attributes back (taken and returned by value).
/// Why:
///  Passed to `Backend::builder().with_window_attributes_hook(...)`,
///  which calls it at window creation.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function setWindowAppId(attributes: WindowAttributes): WindowAttributes {
///   return attributes.withName(APP_ID, APP_ID);
/// }
/// ```
pub fn set_window_app_id(attributes: WindowAttributes) -> WindowAttributes {
    // `with_name(general, instance)`: on Wayland the first is the app id; X11 uses both as WM_CLASS.
    return attributes.with_name(APP_ID, APP_ID);
}

/// What:
///  Install the winit backend with the app-id hook,
///  unless the environment asks Slint for
///       something else.
///  `anyhow::Result<()>` is success without a value,
///  or an error.
/// Why:
///  The app id must be stamped before the window exists,
///  which only an explicit backend allows.
/// Gotcha:
///  Slint's embedded inspection server (`SLINT_MCP_PORT`,
///  debug inspection tasks only) starts
///         only when Slint chooses the backend itself,
///  so those runs keep Slint's selector and no app
///         id,
///  as in the sibling applications.
///  A `SLINT_BACKEND` naming another backend is honored
///         the same way.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function installBackend(): void // throws when the backend cannot be created
/// ```
pub fn install_backend() -> anyhow::Result<()> {
    if std::env::var_os("SLINT_MCP_PORT").is_some() {
        // `Ok(())`: success with nothing to return; Slint will pick its own backend.
        return Ok(());
    }
    // What: `std::env::var(...)` reads the variable as text; `unwrap_or_default()` gives empty text
    //       when it is unset or not UTF-8.
    // Why: Only a value naming winit, optionally with a renderer (`winit-software`), stays explicit here.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const requested = env.SLINT_BACKEND ?? '';
    // ```
    let requested = std::env::var("SLINT_BACKEND").unwrap_or_default();
    if !requested.is_empty() && !requested.starts_with("winit") {
        tracing::debug!(backend = %requested, "SLINT_BACKEND names another backend; the window gets no app id");
        return Ok(());
    }
    // What: `let mut builder = Backend::builder()...` starts a configurable backend; `mut` allows the
    //       renderer choice below to replace it.
    // Why: The hook runs at native window creation time.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let builder = Backend.builder().withWindowAttributesHook(setWindowAppId);
    // ```
    let mut builder = Backend::builder().with_window_attributes_hook(set_window_app_id);
    // What: `strip_prefix("winit-")` returns `Some(rest)` for `winit-software` and the like.
    // Why: Slint's own `SLINT_BACKEND` spelling picks a renderer after the dash; keep honoring it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (requested.startsWith('winit-')) builder = builder.withRendererName(requested.slice(6));
    // ```
    if let Some(renderer) = requested.strip_prefix("winit-") {
        builder = builder.with_renderer_name(renderer);
    }
    // The trailing `?` hands a backend creation failure to `main`, which prints it.
    let backend = builder.build()?;
    // What: `set_platform(Box::new(backend))` hands Slint the backend in a heap box (sibling `Rc`,
    //       shared ownership, which Slint does not ask for); `map_err` turns its error into text.
    // Why: Slint keeps one platform for the process; it must be set before the first window.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // slint.setPlatform(backend); // throws when a platform was already set
    // ```
    slint::platform::set_platform(Box::new(backend))
        .map_err(|error| return anyhow::anyhow!("Cannot install the window backend: {error}"))?;
    tracing::debug!(
        app_id = APP_ID,
        "winit backend installed with the Wayland app id"
    );
    return Ok(());
}
