//! Directory-listing pane: a virtualized `ListView` over a `DirectorySnapshot`'s entries.
//!
//! Only visible rows are realized (`GtkListView` virtualizes the model), so a large directory
//! stays cheap. Each row is a themed icon plus the entry name; icons and previews beyond the OS
//! theme name come with the thumbnail milestone.

/// What: imports the GTK widget-extension traits (builders, list/box helpers, `set_child`).
/// Why: the factory sets row children and the pane presents a scrolled list, all via prelude traits.
use gtk4::prelude::*;
/// What: imports the boxed-any wrapper that carries a Rust value through a `gio::ListModel`.
/// Why: `FileEntry` is not a GObject, so each row model item is a `BoxedAnyObject` holding one.
use gtk4::glib::BoxedAnyObject;
/// What: imports the list-store model type.
/// Why: the pane's rows live in a `ListStore` of boxed entries feeding the `ListView`.
use gtk4::gio::ListStore;
/// What: imports the concrete widget and factory types the pane is built from.
/// Why: named explicitly so construction reads without a glob import.
use gtk4::{
    Box as GtkBox, Image, Label, ListItem, ListView, Orientation, ScrolledWindow,
    SignalListItemFactory, SingleSelection,
};

/// What: imports the snapshot, entry, and kind domain types.
/// Why: the pane renders a `DirectorySnapshot` of `FileEntry` rows, choosing an icon per `EntryKind`.
use crate::types::{DirectorySnapshot, EntryKind, FileEntry};

/// What: horizontal gap in pixels between a row's icon and its name label.
/// Why: named so the one spacing value is not a bare magic literal.
const ROW_SPACING: i32 = 6;

/// What: build a directory-listing pane widget from `snapshot`.
/// Why: the pane is a header showing the directory path over a virtualized list of its entries;
///      returned as a `GtkBox` the strip can place on its canvas.
pub fn build_listing_pane(snapshot: &DirectorySnapshot) -> GtkBox {
    let store = ListStore::new::<BoxedAnyObject>();
    for entry in &snapshot.entries {
        store.append(&BoxedAnyObject::new(entry.clone()));
    }
    let selection = SingleSelection::new(Some(store));
    let list = ListView::new(Some(selection), Some(build_row_factory()));
    let scrolled = ScrolledWindow::builder()
        .child(&list)
        .vexpand(true)
        .hexpand(true)
        .build();

    let header = Label::builder()
        .label(snapshot.path.display().to_string())
        .xalign(0.0)
        .build();
    let container = GtkBox::new(Orientation::Vertical, 0);
    container.append(&header);
    container.append(&scrolled);
    container
}

/// What: build the factory that creates and binds one row (icon + name label).
/// Why: `setup` builds an empty row once per realized slot; `bind` fills it from the row's boxed
///      `FileEntry`, so only visible rows ever touch a `FileEntry`.
fn build_row_factory() -> SignalListItemFactory {
    let factory = SignalListItemFactory::new();
    factory.connect_setup(|_, item| {
        let item = item.downcast_ref::<ListItem>().expect("list item");
        let row = GtkBox::new(Orientation::Horizontal, ROW_SPACING);
        row.append(&Image::new());
        row.append(&Label::builder().xalign(0.0).build());
        item.set_child(Some(&row));
    });
    factory.connect_bind(|_, item| {
        let item = item.downcast_ref::<ListItem>().expect("list item");
        let boxed = item.item().and_downcast::<BoxedAnyObject>().expect("boxed entry");
        let entry = boxed.borrow::<FileEntry>();
        let row = item.child().and_downcast::<GtkBox>().expect("row box");
        let icon = row.first_child().and_downcast::<Image>().expect("row icon");
        let label = row.last_child().and_downcast::<Label>().expect("row label");
        icon.set_icon_name(Some(icon_name(entry.kind)));
        label.set_text(&entry.name);
    });
    factory
}

/// What: map an `EntryKind` to a freedesktop icon-theme name.
/// Why: uses the OS icon theme for a real, cheap glyph per kind until the thumbnail milestone adds
///      per-file previews.
fn icon_name(kind: EntryKind) -> &'static str {
    match kind {
        EntryKind::Directory => "folder",
        EntryKind::File => "text-x-generic",
        EntryKind::Symlink => "emblem-symbolic-link",
    }
}
