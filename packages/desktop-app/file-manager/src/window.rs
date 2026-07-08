//! Top-level application window construction.

/// What: imports the GTK widget-extension traits (builders, `present`, `upcast`).
/// Why: the shell presents an `ApplicationWindow` and upcasts its content to `Widget`.
use gtk4::prelude::*;
/// What: imports the concrete GTK types the shell window is built from.
/// Why: named explicitly so window construction reads without a glob import.
use gtk4::{Application, ApplicationWindow, Label, Widget};

/// What: imports the borrowed and owned path types.
/// Why: the start directory is computed as a `PathBuf` and read through a `&Path`.
use std::path::{Path, PathBuf};

/// What: imports the default window-geometry constants.
/// Why: the window is sized from a single source of truth in `constants`.
use crate::constants::{DEFAULT_HEIGHT, DEFAULT_WIDTH};

/// What: build the top-level window over the start directory's listing and present it.
/// Why: the Directory-listing milestone: one native Wayland window showing a real directory. The
///      column strip (later milestones) replaces the single-pane content with the fixed canvas.
pub(crate) fn build_window(app: &Application) {
    let start = start_directory();
    let content = build_start_content(&start);
    let window = ApplicationWindow::builder()
        .application(app)
        .title("Monochromatic File Manager")
        .default_width(DEFAULT_WIDTH)
        .default_height(DEFAULT_HEIGHT)
        .child(&content)
        .build();
    window.present();
    tracing::info!(path = %start.display(), "presented top-level window");
}

/// What: read `start` and return either its listing pane or an error label, as a `Widget`.
/// Why: a common widget type lets the window hold either outcome; an unreadable start directory
///      surfaces as an honest in-window message rather than a blank window.
fn build_start_content(start: &Path) -> Widget {
    match crate::fs::read_directory(start, 0) {
        Ok(snapshot) => {
            tracing::info!(
                entries = snapshot.entries.len(),
                path = %snapshot.path.display(),
                "listed start directory"
            );
            crate::pane::build_listing_pane(&snapshot).upcast::<Widget>()
        }
        Err(error) => {
            tracing::error!(%error, path = %start.display(), "failed to read start directory");
            Label::new(Some(&format!("Cannot read {}: {error}", start.display())))
                .upcast::<Widget>()
        }
    }
}

/// What: choose the directory the app opens on: `$HOME`, else the current directory, else `.`.
/// Why: a sensible default until OS-open integration and a path argument arrive; `$HOME` is set on
///      the Linux target this milestone runs on.
fn start_directory() -> PathBuf {
    if let Some(home) = std::env::var_os("HOME") {
        return PathBuf::from(home);
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}
