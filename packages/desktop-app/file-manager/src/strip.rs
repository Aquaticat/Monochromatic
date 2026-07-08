//! Detached-column pane strip: each lineage column is its own vertically-scrolling region, laid
//! out left-to-right inside one horizontally-scrolling outer viewport.
//!
//! A pane sits in its column's canvas at `row * ROW_STRIDE`; every column shares the same content
//! height, so equal vertical offsets align a child with its parent's row. Columns scroll
//! independently (stage 1); a later stage tethers each parent inside its children block and snaps
//! offsets so few panes are partially clipped. The `PaneStripState` machine owns the tree and the
//! spawn/dedup/close rules; this module renders it and drives it from row activations.

/// What: imports the interior-mutability cells used for shared, closure-captured state.
/// Why: GTK signal closures are `'static`, so the model, widget map, and columns live behind
///      `RefCell`, and counters behind `Cell`, inside a single `Rc`.
use std::cell::{Cell, RefCell};
/// What: imports the hash-map container.
/// Why: the strip tracks one widget per live `PaneId` for reconcile.
use std::collections::HashMap;
/// What: imports the borrowed path type.
/// Why: the root pane and directory reads take paths by reference.
use std::path::Path;
/// What: imports the reference-counted pointer and its weak companion.
/// Why: the controller shares one `StripInner` with the row-activation closures via `Weak`.
use std::rc::Rc;

/// What: imports the GTK widget-extension traits (box append, fixed put/move, scroll adjustments).
/// Why: columns are assembled and scrolled through prelude trait methods.
use gtk4::prelude::*;
/// What: imports the concrete GTK types the strip is built from.
/// Why: named explicitly so construction reads without a glob import.
use gtk4::{Box as GtkBox, Fixed, Label, Orientation, PolicyType, ScrolledWindow, Widget};

/// What: imports the pane-geometry constants.
/// Why: pane placement is computed from a single source of truth.
use crate::constants::{PANE_GAP, PANE_HEIGHT, PANE_WIDTH};
/// What: imports the pane-strip state machine.
/// Why: this module renders and mutates it.
use crate::model::PaneStripState;
/// What: imports the listing-pane and shared-header builders.
/// Why: a directory pane is a listing pane; a preview pane reuses the shared header.
use crate::pane::{build_listing_pane, build_preview_pane};
/// What: imports the thumbnail service and the image-detection helper.
/// Why: preview panes need the service; autopreview branches on `is_image`.
use crate::thumbs::{Thumbnails, is_image};
/// What: imports the entry, id, and location domain types.
/// Why: spawning maps an activated `FileEntry` to a `PaneLocation` keyed by `PaneId`.
use crate::types::{FileEntry, PaneId, PaneLocation};

/// What: imports the row-to-pixel mapping and the reveal-on-spawn helper.
/// Why: reconcile places panes with `row_y`; a spawn reveals the new pane in its column.
use crate::scroll::{row_y, scroll_to_pane};

/// What: one column's widgets: its vertical scroller and the canvas panes are placed on.
/// Why: each column scrolls independently, so it owns its own `ScrolledWindow` over a `Fixed`.
pub(crate) struct ColumnView {
    /// Vertical scroller for this column (horizontal scrollbar off, vertical scrollbar hidden).
    pub(crate) scroller: ScrolledWindow,
    /// Canvas holding this column's pane widgets at `row * ROW_STRIDE`.
    fixed: Fixed,
}

/// What: shared strip state captured by GTK closures: the outer scroller, the columns box, the
///       per-column views, the model, the widget map, and counters.
/// Why: one `Rc<StripInner>` is held by the controller and weakly by each pane's activation
///      closure, so a click can mutate the model and reconcile the canvas.
pub(crate) struct StripInner {
    /// The outer horizontal scroller holding the columns box.
    pub(crate) outer: ScrolledWindow,
    /// Horizontal box of per-column scrollers.
    columns_box: GtkBox,
    /// One view per column (index = column depth).
    pub(crate) columns: RefCell<Vec<ColumnView>>,
    /// The pane-strip state machine.
    pub(crate) state: RefCell<PaneStripState>,
    /// One widget per live pane, for reconcile and removal.
    pub(crate) widgets: RefCell<HashMap<PaneId, Widget>>,
    /// Monotonic directory-read generation.
    generation: Cell<u64>,
    /// Column whose pane last received focus, for Left/Right keyboard navigation.
    pub(crate) focused_column: Cell<usize>,
    /// Off-thread thumbnail decoder + bounded cache, shared by preview panes.
    thumbs: Thumbnails,
}

/// What: owning handle to a built strip; keeps `StripInner` alive for the window's lifetime.
/// Why: the activation closures hold only a `Weak`, so this strong handle must outlive the window,
///      or spawning would silently stop working.
pub struct StripController {
    /// The shared inner state.
    inner: Rc<StripInner>,
}

/// What: the strip's public surface: construct-and-render, root-widget accessor, and the
///       verification-only autospawn/autopreview helpers.
/// Why: callers build a strip, place its widget, and keep the handle alive; the rest reads state.
impl StripController {
    /// What: build a strip rooted at `root`, render its root pane, and return the controller.
    /// Why: the root directory opens in column 0; reconcile creates that column and places its pane.
    pub fn new(root: &Path) -> Self {
        let columns_box = GtkBox::new(Orientation::Horizontal, PANE_GAP);
        let outer = ScrolledWindow::builder()
            .child(&columns_box)
            .hscrollbar_policy(PolicyType::Automatic)
            .vscrollbar_policy(PolicyType::Never)
            .vexpand(true)
            .hexpand(true)
            .build();
        let inner = Rc::new(StripInner {
            outer,
            columns_box,
            columns: RefCell::new(Vec::new()),
            state: RefCell::new(PaneStripState::new()),
            widgets: RefCell::new(HashMap::new()),
            generation: Cell::new(0),
            focused_column: Cell::new(0),
            thumbs: Thumbnails::start(),
        });
        inner
            .state
            .borrow_mut()
            .open_root(PaneLocation::Directory(root.to_path_buf()));
        reconcile(&inner);
        crate::keys::install_column_nav(&inner);
        Self { inner }
    }

    /// What: the root widget to place in the window.
    /// Why: the window holds the outer scroller; a clone bumps the GTK refcount so both can hold it.
    pub fn widget(&self) -> Widget {
        self.inner.outer.clone().upcast::<Widget>()
    }

    /// What: programmatically spawn the first sub-directory's child pane from the root, then close it.
    /// Why: exercises the real activation -> spawn -> reconcile -> close path for unattended
    ///      verification; gated behind the autospawn env var by the caller.
    pub fn autospawn_first_dir_for_test(&self) {
        let inner = &self.inner;
        let Some((root_id, path)) = root_directory(inner) else {
            return;
        };
        let generation = next_generation(inner);
        let Ok(snapshot) = crate::fs::read_directory(&path, generation) else {
            return;
        };
        if let Some(entry) = snapshot.entries.iter().find(|entry| entry.path.is_dir()) {
            let child = spawn_from(inner, root_id, entry, false);
            close_pane(inner, child);
        }
    }

    /// What: programmatically spawn a preview pane for the first image file in the start directory.
    /// Why: exercises the real activation -> preview -> off-thread decode -> cache path for
    ///      unattended verification; gated behind the autopreview env var by the caller.
    pub fn autopreview_first_image_for_test(&self) {
        let inner = &self.inner;
        let Some((root_id, path)) = root_directory(inner) else {
            return;
        };
        let generation = next_generation(inner);
        let Ok(snapshot) = crate::fs::read_directory(&path, generation) else {
            return;
        };
        if let Some(entry) = snapshot
            .entries
            .iter()
            .find(|entry| !entry.path.is_dir() && is_image(&entry.path))
        {
            spawn_from(inner, root_id, entry, false);
        }
    }
}

/// What: the active root pane's id and directory path, if the active pane is a directory.
/// Why: shared setup for the autospawn/autopreview test helpers.
fn root_directory(inner: &Rc<StripInner>) -> Option<(PaneId, std::path::PathBuf)> {
    let state = inner.state.borrow();
    let id = state.active()?;
    match state.pane(id).map(|pane| pane.location.clone()) {
        Some(PaneLocation::Directory(path)) => Some((id, path)),
        _ => None,
    }
}

/// What: mint and record the next directory-read generation.
/// Why: a newer read supersedes a stale snapshot; the counter only ever increases.
fn next_generation(inner: &Rc<StripInner>) -> u64 {
    let generation = inner.generation.get() + 1;
    inner.generation.set(generation);
    generation
}

/// What: bring the columns and pane widgets into agreement with the model.
/// Why: one idempotent pass after any state change: ensure a view per column, drop closed panes,
///      place each live pane in its column at its row, and give every column the same content
///      height so the scroll coordinate spaces line up.
fn reconcile(inner: &Rc<StripInner>) {
    let column_count = inner.state.borrow().column_count();
    ensure_columns(inner, column_count);
    let live: HashMap<PaneId, (usize, usize)> = inner
        .state
        .borrow()
        .panes()
        .map(|pane| (pane.id, (pane.column, pane.row)))
        .collect();
    remove_stale(inner, &live);
    for (&id, &(column, row)) in &live {
        ensure_pane_widget(inner, id, column, row);
    }
    set_content_height(inner, &live);
}

/// What: grow or shrink the column views to exactly `count`.
/// Why: descending adds columns and bulk-close removes them; each new column is a hidden-scrollbar
///      vertical scroller over a fixed canvas, appended to the horizontal columns box.
fn ensure_columns(inner: &Rc<StripInner>, count: usize) {
    let mut columns = inner.columns.borrow_mut();
    while columns.len() < count {
        let fixed = Fixed::new();
        let scroller = ScrolledWindow::builder()
            .child(&fixed)
            .hscrollbar_policy(PolicyType::Never)
            .vscrollbar_policy(PolicyType::External)
            .width_request(PANE_WIDTH)
            .vexpand(true)
            .build();
        inner.columns_box.append(&scroller);
        columns.push(ColumnView { scroller, fixed });
    }
    while columns.len() > count {
        if let Some(view) = columns.pop() {
            inner.columns_box.remove(&view.scroller);
        }
    }
}

/// What: remove pane widgets for panes no longer in the model.
/// Why: a closed pane's widget must leave its column canvas and the widget map.
fn remove_stale(inner: &Rc<StripInner>, live: &HashMap<PaneId, (usize, usize)>) {
    let stale: Vec<PaneId> = inner
        .widgets
        .borrow()
        .keys()
        .copied()
        .filter(|id| !live.contains_key(id))
        .collect();
    let columns = inner.columns.borrow();
    for id in stale {
        if let Some(widget) = inner.widgets.borrow_mut().remove(&id)
            && let Some(fixed) = widget.parent().and_downcast::<Fixed>()
        {
            let _ = &columns;
            fixed.remove(&widget);
        }
    }
}

/// What: ensure pane `id` has a widget in column `column` at `row`: move an existing one or build
///       and place a new one sized to the pane box.
/// Why: a pane's column never changes, so it stays in one column's canvas; only its row moves as
///      the tree re-lays-out.
fn ensure_pane_widget(inner: &Rc<StripInner>, id: PaneId, column: usize, row: usize) {
    let existing = inner.widgets.borrow().get(&id).cloned();
    let columns = inner.columns.borrow();
    let Some(view) = columns.get(column) else {
        return;
    };
    if let Some(widget) = existing {
        view.fixed.move_(&widget, 0.0, row_y(row));
        return;
    }
    drop(columns);
    let widget = build_pane_widget(inner, id);
    widget.set_size_request(PANE_WIDTH, PANE_HEIGHT);
    if let Some(view) = inner.columns.borrow().get(column) {
        view.fixed.put(&widget, 0.0, row_y(row));
    }
    inner.widgets.borrow_mut().insert(id, widget);
}

/// What: give every column canvas the same height (one stride past the deepest row).
/// Why: a shared content height means equal vertical offsets map to the same on-screen row, which
///      the alignment and the later tether both rely on.
fn set_content_height(inner: &Rc<StripInner>, live: &HashMap<PaneId, (usize, usize)>) {
    let max_row = live.values().map(|&(_, row)| row).max().unwrap_or(0);
    let height = (row_y(max_row) + f64::from(PANE_HEIGHT)) as i32;
    for view in inner.columns.borrow().iter() {
        view.fixed.set_size_request(PANE_WIDTH, height);
    }
}

/// What: build the widget for pane `id` from its location.
/// Why: a directory becomes a listing pane wired to spawn; a preview becomes a thumbnail pane; a
///      missing pane degrades to a label.
fn build_pane_widget(inner: &Rc<StripInner>, id: PaneId) -> Widget {
    let location = inner.state.borrow().pane(id).map(|pane| pane.location.clone());
    match location {
        Some(PaneLocation::Directory(path)) => build_directory_pane(inner, id, &path),
        Some(PaneLocation::Preview(path)) => {
            let close_weak = Rc::downgrade(inner);
            build_preview_pane(&inner.thumbs, &path, move || {
                if let Some(inner) = close_weak.upgrade() {
                    close_pane(&inner, id);
                }
            })
            .upcast::<Widget>()
        }
        None => Label::new(Some("(missing pane)")).upcast::<Widget>(),
    }
}

/// What: build a directory listing pane for `id` at `path`, wiring row activation to spawn a child.
/// Why: activating a row spawns `path`'s child from this pane via a weak back-reference, so the
///      closure never keeps the strip alive.
fn build_directory_pane(inner: &Rc<StripInner>, id: PaneId, path: &Path) -> Widget {
    let generation = next_generation(inner);
    match crate::fs::read_directory(path, generation) {
        Ok(snapshot) => {
            let spawn_weak = Rc::downgrade(inner);
            let close_weak = Rc::downgrade(inner);
            build_listing_pane(
                &snapshot,
                move |entry, force_dup| {
                    if let Some(inner) = spawn_weak.upgrade() {
                        spawn_from(&inner, id, entry, force_dup);
                    }
                },
                move || {
                    if let Some(inner) = close_weak.upgrade() {
                        close_pane(&inner, id);
                    }
                },
            )
            .upcast::<Widget>()
        }
        Err(error) => {
            tracing::error!(%error, path = %path.display(), "failed to read directory for pane");
            Label::new(Some(&format!("Cannot read {}: {error}", path.display()))).upcast::<Widget>()
        }
    }
}

/// What: spawn a child pane from `source` for the activated `entry`, reconcile, reveal it, and
///       return the new pane id; `force_duplicate` skips dedup to mint a fresh pane.
/// Why: a directory (following symlinks) spawns a listing, anything else a preview; dedup-and-focus
///      lives in the model, so a revisit focuses the existing pane unless Ctrl forced a duplicate.
fn spawn_from(
    inner: &Rc<StripInner>,
    source: PaneId,
    entry: &FileEntry,
    force_duplicate: bool,
) -> PaneId {
    let location = if entry.path.is_dir() {
        PaneLocation::Directory(entry.path.clone())
    } else {
        PaneLocation::Preview(entry.path.clone())
    };
    let spawned = inner
        .state
        .borrow_mut()
        .spawn_child(source, location, force_duplicate);
    if let Some(column) = inner.state.borrow().pane(spawned).map(|pane| pane.column) {
        inner.focused_column.set(column);
    }
    reconcile(inner);
    scroll_to_pane(inner, spawned);
    tracing::info!(
        source = source.0,
        spawned = spawned.0,
        entry = %entry.path.display(),
        panes = inner.state.borrow().len(),
        columns = inner.state.borrow().column_count(),
        "spawned child pane"
    );
    spawned
}

/// What: close pane `id` and reconcile so its widget leaves and the tree re-lays-out.
/// Why: explicit close is the only way a pane dies; reconcile's `remove_stale` drops the widget.
fn close_pane(inner: &Rc<StripInner>, id: PaneId) {
    inner.state.borrow_mut().close(id);
    reconcile(inner);
    tracing::info!(closed = id.0, panes = inner.state.borrow().len(), "closed pane");
}
