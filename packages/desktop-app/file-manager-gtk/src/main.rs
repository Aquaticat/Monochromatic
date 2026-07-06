//! GTK4 file-manager spike. Proves the three things the Slint and Qt spikes struggled with,
//! in one app: a native Wayland window on KWin (GDK's Wayland backend, not XWayland), a
//! virtualized `ListView` over a 100000-row model (GtkListView realizes only the visible
//! rows), and native inbound drag-and-drop via `GtkDropTarget` (GDK implements DnD on
//! `wl_data_device`). GNOME Files (Nautilus) is GTK4, so this is proven territory.

use gtk4::gdk::{DragAction, FileList};
use gtk4::prelude::*;
use gtk4::{
    Application, ApplicationWindow, DropTarget, Label, ListItem, ListView, ScrolledWindow,
    SignalListItemFactory, SingleSelection, StringList, StringObject,
};
use tracing_subscriber::EnvFilter;

/// Application id used for the GTK application and its Wayland app id.
const APP_ID: &str = "dev.monochromatic.file_manager_gtk";

/// Row count of the virtualization stress model; only the visible handful is ever realized.
const ROW_COUNT: u32 = 100_000;

/// What: install non-blocking tracing, build the GTK application, and run its event loop.
/// Why: the `Application` owns the GDK Wayland backend and lifecycle; `run` blocks until the
///      last window closes and returns the process exit code. The tracing worker guard is
///      held for the whole run so logging never blocks the UI thread.
fn main() -> gtk4::glib::ExitCode {
    let (writer, _guard) = tracing_appender::non_blocking(std::io::stderr());
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with_writer(writer)
        .init();
    tracing::info!("file-manager-gtk starting");

    let app = Application::builder().application_id(APP_ID).build();
    app.connect_activate(build_ui);
    app.run()
}

/// What: build the window, its virtualized list, and the file drop target, and present it.
/// Why: called on the application's `activate`; wires a `StringList` model into a `ListView`
///      through a `SignalListItemFactory`, and attaches a `DropTarget` accepting a file list
///      so a Dolphin drop lands here over native Wayland.
fn build_ui(app: &Application) {
    let model = StringList::new(&[]);
    for i in 0..ROW_COUNT {
        model.append(&format!("row {i}"));
    }

    let factory = SignalListItemFactory::new();
    factory.connect_setup(|_, item| {
        let item = item.downcast_ref::<ListItem>().expect("list item");
        item.set_child(Some(&Label::builder().xalign(0.0).build()));
    });
    factory.connect_bind(|_, item| {
        let item = item.downcast_ref::<ListItem>().expect("list item");
        let text = item
            .item()
            .and_downcast::<StringObject>()
            .expect("string object")
            .string();
        item.child()
            .and_downcast::<Label>()
            .expect("label")
            .set_text(&text);
    });

    let selection = SingleSelection::new(Some(model));
    let list = ListView::new(Some(selection), Some(factory));
    let scrolled = ScrolledWindow::builder()
        .child(&list)
        .vexpand(true)
        .hexpand(true)
        .build();

    let drop = DropTarget::new(FileList::static_type(), DragAction::COPY);
    drop.connect_drop(|_, value, _, _| match value.get::<FileList>() {
        Ok(files) => {
            for file in files.files() {
                tracing::info!(path = ?file.path(), "inbound file drop");
            }
            true
        }
        Err(error) => {
            tracing::warn!(%error, "drop value was not a file list");
            false
        }
    });

    let window = ApplicationWindow::builder()
        .application(app)
        .title("Monochromatic File Manager (GTK4)")
        .default_width(800)
        .default_height(600)
        .child(&scrolled)
        .build();
    window.add_controller(drop);
    window.present();

    // Optional self-quit for headless teardown checks: FMGTK_QUIT_MS=8000 quits the app
    // after 8s so the exit code reveals whether teardown is clean (the Qt spike segfaults
    // here). Absent the env var, the app runs until the window is closed.
    if let Ok(raw) = std::env::var("FMGTK_QUIT_MS") {
        if let Ok(ms) = raw.parse::<u64>() {
            let app = app.clone();
            gtk4::glib::timeout_add_local_once(std::time::Duration::from_millis(ms), move || {
                app.quit();
            });
        }
    }
}
