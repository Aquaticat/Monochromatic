//! Top-level application window construction.

/// What: imports the GTK widget-extension traits (builder finishers, `present`).
/// Why: the shell presents an `ApplicationWindow`, which needs `GtkWindowExt` from the prelude.
use gtk4::prelude::*;
/// What: imports the concrete GTK widget types the shell window is built from.
/// Why: named explicitly so window construction reads without relying on a glob import.
use gtk4::{Application, ApplicationWindow, Label};

/// What: imports the default window-geometry constants.
/// Why: the window is sized from a single source of truth in `constants`.
use crate::constants::{DEFAULT_HEIGHT, DEFAULT_WIDTH};

/// What: build the top-level application window owned by `app` and present it.
/// Why: the Foundation milestone (docs/planning/file-manager.md) is one native Wayland window.
///      Later milestones swap the placeholder child for the fixed-canvas column strip; keeping
///      construction here keeps `run` short and under the max-lines budget.
pub(crate) fn build_window(app: &Application) {
    let placeholder = Label::builder()
        .label("Monochromatic File Manager")
        .build();
    let window = ApplicationWindow::builder()
        .application(app)
        .title("Monochromatic File Manager")
        .default_width(DEFAULT_WIDTH)
        .default_height(DEFAULT_HEIGHT)
        .child(&placeholder)
        .build();
    window.present();
    tracing::info!("presented top-level window");
}
