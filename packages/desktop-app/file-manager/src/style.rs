//! Application stylesheet.

/// What: imports the default-display accessor type.
/// Why: the stylesheet is attached to the display so every window inherits it.
use gtk4::gdk::Display;
/// What: imports the CSS provider, the application priority constant, and the display-attach helper.
/// Why: a provider at application priority overrides the theme's background across the app.
use gtk4::{
    CssProvider, STYLE_PROVIDER_PRIORITY_APPLICATION, style_context_add_provider_for_display,
};

/// What: the app stylesheet: a pure-black background across the window and its views.
/// Why: black is easier on the eyes than the theme's dark grey; row selection and text keep the
///      theme's colors so highlighting and readability are unaffected.
const APP_CSS: &str =
    "window, scrolledwindow, viewport, listview, .view { background-color: #000000; }";

/// What: load the app stylesheet onto the default display so every window picks it up.
/// Why: installed once at startup (the display exists only after GTK init); a missing display is
///      logged and skipped rather than panicking.
pub(crate) fn install() {
    let Some(display) = Display::default() else {
        tracing::warn!("no default display; skipping stylesheet");
        return;
    };
    let provider = CssProvider::new();
    provider.load_from_data(APP_CSS);
    style_context_add_provider_for_display(&display, &provider, STYLE_PROVIDER_PRIORITY_APPLICATION);
}
