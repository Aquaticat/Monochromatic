//! GTK4 file-manager spike. The plain window proves the three things Slint and Qt struggled
//! with (native Wayland window on KWin, a virtualized `ListView`, native inbound DnD via
//! `GtkDropTarget`). FMGTK_BENCH switches to the faithful perf benchmark: a 2D grid of many
//! panes (columns of panes, each pane either a small file list or an image preview), panned
//! diagonally, reporting frames per second off the GTK frame clock. GNOME Files is GTK4, so
//! this is proven territory.

use gtk4::gdk::{DragAction, FileList, Texture};
use gtk4::prelude::*;
use gtk4::{
    Application, ApplicationWindow, Box as GtkBox, DropTarget, Label, ListItem, ListView,
    Orientation, Picture, ScrolledWindow, SignalListItemFactory, SingleSelection, StringList,
    StringObject,
};
use tracing_subscriber::EnvFilter;

/// Application id used for the GTK application and its Wayland app id.
const APP_ID: &str = "dev.monochromatic.file_manager_gtk";

/// Row count of the plain-UI virtualization model; only the visible handful is realized.
const ROW_COUNT: u32 = 100_000;

/// Column count of the benchmark grid; kept realistic (a Miller-columns view opens a few).
const COLUMN_COUNT: u32 = 12;

/// Panes per column; `COLUMN_COUNT * PANES_PER_COLUMN` is about 14400 panes, matching the
/// Slint/Qt strip scale. Each column's pane list virtualizes, so only visible panes realize.
const PANES_PER_COLUMN: u32 = 1200;

/// Rows shown inside a directory (list) pane.
const PANE_ROWS: u32 = 5;

/// What: install non-blocking tracing, build the GTK application, and run its event loop.
/// Why: the `Application` owns the GDK Wayland backend; `run` blocks until the last window
///      closes. The tracing worker guard is held for the whole run so logging never blocks
///      the UI thread.
fn main() -> gtk4::glib::ExitCode {
    let (writer, _guard) = tracing_appender::non_blocking(std::io::stderr());
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with_writer(writer)
        .init();
    tracing::info!("file-manager-gtk starting");

    let app = Application::builder().application_id(APP_ID).build();
    app.connect_activate(|app| {
        if std::env::var("FMGTK_BENCH").is_ok() {
            build_bench_ui(app);
        } else {
            build_ui(app);
        }
    });
    app.run()
}

/// What: build the plain window, its virtualized list, and the file drop target, and present.
/// Why: proves native Wayland, virtualization, and native inbound DnD; a Dolphin drop lands
///      here over real Wayland through the stock `GtkDropTarget` (`GdkFileList`).
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

    if let Ok(raw) = std::env::var("FMGTK_QUIT_MS") {
        if let Ok(ms) = raw.parse::<u64>() {
            let app = app.clone();
            gtk4::glib::timeout_add_local_once(std::time::Duration::from_millis(ms), move || {
                app.quit();
            });
        }
    }
}

/// What: build one column's pane list: a virtualized vertical `ListView` whose panes are each
///       either an image preview or a small file list, chosen by pane index.
/// Why: the grid is columns of panes; this builds a column. Panes share nothing that would
///       force cross-column relayout. `imgs` is the thumbnail-pool directory.
fn build_pane_column(cache: &std::rc::Rc<Vec<Texture>>) -> ScrolledWindow {
    let panes = StringList::new(&[]);
    for p in 0..PANES_PER_COLUMN {
        panes.append(&format!("pane {p}"));
    }

    let factory = SignalListItemFactory::new();
    factory.connect_setup(|_, item| {
        let item = item.downcast_ref::<ListItem>().expect("list item");
        let cell = GtkBox::new(Orientation::Vertical, 0);
        cell.set_size_request(220, 150);
        let picture = Picture::new();
        picture.set_vexpand(true);
        cell.append(&picture);
        let rows = GtkBox::new(Orientation::Vertical, 0);
        for _ in 0..PANE_ROWS {
            rows.append(&Label::builder().xalign(0.0).build());
        }
        cell.append(&rows);
        item.set_child(Some(&cell));
    });
    let cache = cache.clone();
    factory.connect_bind(move |_, item| {
        let item = item.downcast_ref::<ListItem>().expect("list item");
        let index = item.position();
        let cell = item.child().and_downcast::<GtkBox>().expect("cell");
        let picture = cell.first_child().and_downcast::<Picture>().expect("picture");
        let rows = cell.last_child().and_downcast::<GtkBox>().expect("rows");
        let is_preview = (index % 2) == 0;
        picture.set_visible(is_preview);
        rows.set_visible(!is_preview);
        if is_preview {
            if !cache.is_empty() {
                picture.set_paintable(Some(&cache[index as usize % cache.len()]));
            }
        } else {
            let mut child = rows.first_child();
            let mut r = 0;
            while let Some(node) = child {
                if let Some(label) = node.downcast_ref::<Label>() {
                    label.set_text(&format!("file {index}-{r}"));
                }
                r += 1;
                child = node.next_sibling();
            }
        }
    });

    let selection = SingleSelection::new(Some(panes));
    let list = ListView::new(Some(selection), Some(factory));
    ScrolledWindow::builder()
        .child(&list)
        .width_request(220)
        .vexpand(true)
        .build()
}

/// What: the faithful benchmark: a 2D grid of many mixed panes, panned diagonally, reporting
///       frames per second off the GTK frame clock.
/// Why: an honest GTK fast-scroll number on the real UI shape. A horizontal strip of columns,
///       each a virtualized vertical pane list (panes are previews or small lists); the window
///       tick sweeps the outer horizontal scroll and every column's vertical scroll at once
///       (diagonal) and counts frames. FMGTK_IMGS points at the 384x256 thumbnail pool.
fn build_bench_ui(app: &Application) {
    let imgs = std::env::var("FMGTK_IMGS").unwrap_or_else(|_| "imgs".to_owned());
    // Decode the thumbnail pool once into a texture cache. A real file manager caches
    // thumbnails (and decodes off-thread on first view); the point here is that decode must
    // not run on the render path, since synchronous per-frame decode drops this to ~4 fps.
    let cache: Vec<Texture> = (1..=256u32)
        .filter_map(|n| Texture::from_filename(format!("{imgs}/img_{n:03}.png")).ok())
        .collect();
    let cache = std::rc::Rc::new(cache);
    tracing::info!(thumbnails = cache.len(), "decoded thumbnail cache");

    let strip = GtkBox::new(Orientation::Horizontal, 2);
    for _ in 0..COLUMN_COUNT {
        strip.append(&build_pane_column(&cache));
    }
    let outer_scrolled = ScrolledWindow::builder()
        .child(&strip)
        .vexpand(true)
        .hexpand(true)
        .build();

    let window = ApplicationWindow::builder()
        .application(app)
        .title("GTK4 diagonal grid-of-panes fps bench")
        .default_width(1400)
        .default_height(900)
        .child(&outer_scrolled)
        .build();
    window.present();

    let hadj = outer_scrolled.hadjustment();
    let strip_ref = strip.clone();
    let start = std::time::Instant::now();
    let frames = std::rc::Rc::new(std::cell::Cell::new(0u32));
    let sec = std::rc::Rc::new(std::cell::Cell::new(std::time::Instant::now()));
    let tick = window.add_tick_callback(move |_, _| {
        let elapsed = start.elapsed().as_secs_f64();
        let triangle = |phase: f64| if phase < 0.5 { phase * 2.0 } else { 2.0 - phase * 2.0 };
        let hspan = (hadj.upper() - hadj.page_size()).max(0.0);
        hadj.set_value(triangle((elapsed % 12.0) / 12.0) * hspan);
        let vphase = triangle((elapsed % 5.0) / 5.0);
        let mut child = strip_ref.first_child();
        while let Some(node) = child {
            if let Some(column) = node.downcast_ref::<ScrolledWindow>() {
                let adj = column.vadjustment();
                let vspan = (adj.upper() - adj.page_size()).max(0.0);
                adj.set_value(vphase * vspan);
            }
            child = node.next_sibling();
        }
        frames.set(frames.get() + 1);
        if sec.get().elapsed().as_secs_f64() >= 1.0 {
            tracing::info!(fps = frames.get(), "diagonal grid bench");
            frames.set(0);
            sec.set(std::time::Instant::now());
        }
        gtk4::glib::ControlFlow::Continue
    });
    std::mem::forget(tick);

    let app_quit = app.clone();
    gtk4::glib::timeout_add_local_once(std::time::Duration::from_millis(16000), move || {
        app_quit.quit();
    });
}
