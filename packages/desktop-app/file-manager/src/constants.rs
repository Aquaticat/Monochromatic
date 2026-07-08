//! Compile-time constants shared across the file-manager shell.

/// What: GTK application id, reused verbatim as the Wayland `app_id` on the `xdg_toplevel`.
/// Why: GTK requires a valid reverse-DNS application id, and the compositor keys window rules
///      and taskbar identity off the same string, so one source of truth avoids drift.
pub(crate) const APP_ID: &str = "dev.monochromatic.FileManager";

/// What: initial top-level window width in pixels.
/// Why: a wide default suits the horizontal column strip that fills the window.
pub(crate) const DEFAULT_WIDTH: i32 = 1280;

/// What: initial top-level window height in pixels.
/// Why: tall enough to show a full column of vertically stacked panes.
pub(crate) const DEFAULT_HEIGHT: i32 = 800;

/// What: environment variable naming a millisecond budget after which the app self-quits.
/// Why: lets an unattended verification run open the window, prove it renders, and exit
///      without a human closing it; unset in normal use so the app runs until closed.
pub(crate) const QUIT_MS_ENV: &str = "FM_QUIT_MS";
