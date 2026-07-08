//! Fixed-canvas pane strip: panes at fixed `(column, slot)` positions on a `GtkFixed`, panned via
//! a `ScrolledWindow`.
//!
//! Empty cells hold no widget, and a pan re-composites cached render nodes rather than re-running
//! virtualization or layout (the perf architecture from the toolkit handover: nested virtualized
//! lists collapse under a pan, fixed-position panes hold 60 fps). The `PaneStripState` machine owns
//! the Niri spawn/dedup/close rules; this module renders it and drives it from row activations.

/// What: imports the interior-mutability cells used for shared, closure-captured state.
/// Why: GTK signal closures are `'static`, so the model and widget map live behind `RefCell`, and
///      the read generation behind `Cell`, inside a single `Rc`.
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

/// What: imports the GTK widget-extension traits (fixed put/move, scroll adjustments, upcast).
/// Why: the canvas places panes and scrolls to reveal them through prelude trait methods.
use gtk4::prelude::*;
/// What: imports the key-symbol type used for column navigation.
/// Why: the strip intercepts Left/Right to move keyboard focus between columns.
use gtk4::gdk::Key;
/// What: imports the concrete GTK types the canvas is built from.
/// Why: named explicitly so construction reads without a glob import.
use gtk4::{
    Adjustment, EventControllerKey, Fixed, Label, PropagationPhase, ScrolledWindow, Widget, glib,
};

/// What: imports the pane-geometry constants.
/// Why: pane placement is computed from a single source of truth.
use crate::constants::{PANE_GAP, PANE_HEIGHT, PANE_WIDTH};
/// What: imports the pane-strip state machine.
/// Why: this module renders and mutates it.
use crate::model::PaneStripState;
/// What: imports the listing-pane builder.
/// Why: each directory pane widget is a listing pane wired to spawn on row activation.
use crate::pane::build_listing_pane;
/// What: imports the entry, id, and location domain types.
/// Why: spawning maps an activated `FileEntry` to a `PaneLocation` keyed by `PaneId`.
use crate::types::{FileEntry, PaneId, PaneLocation};

/// What: shared strip state captured by GTK closures: the canvas, the scroller, the model, the
///       per-pane widget map, and the monotonic read generation.
/// Why: one `Rc<StripInner>` is held by the controller and weakly by each pane's activation
///      closure, so a click can mutate the model and reconcile the canvas.
struct StripInner {
    /// The fixed canvas panes are placed on.
    fixed: Fixed,
    /// The scroller that pans the canvas.
    scrolled: ScrolledWindow,
    /// The pane-strip state machine.
    state: RefCell<PaneStripState>,
    /// One widget per live pane, for reconcile and removal.
    widgets: RefCell<HashMap<PaneId, Widget>>,
    /// Monotonic directory-read generation.
    generation: Cell<u64>,
    /// Column whose pane last received focus, for Left/Right keyboard navigation.
    focused_column: Cell<usize>,
}

/// What: owning handle to a built strip; keeps `StripInner` alive for the window's lifetime.
/// Why: the activation closures hold only a `Weak`, so this strong handle must outlive the window
///      (the window keeps it via a destroy-time capture) or spawning would silently stop working.
pub struct StripController {
    /// The shared inner state.
    inner: Rc<StripInner>,
}

/// What: the strip's public surface: construct-and-render, root-widget accessor, and the
///       verification-only autospawn helper.
/// Why: callers build a strip, place its widget, and keep the handle alive; the rest reads state.
impl StripController {
    /// What: build a strip rooted at `root`, render its root pane, and return the controller.
    /// Why: the root directory opens in column 0; reconcile places its widget on the canvas.
    pub fn new(root: &Path) -> Self {
        let fixed = Fixed::new();
        let scrolled = ScrolledWindow::builder()
            .child(&fixed)
            .vexpand(true)
            .hexpand(true)
            .build();
        let inner = Rc::new(StripInner {
            fixed,
            scrolled,
            state: RefCell::new(PaneStripState::new()),
            widgets: RefCell::new(HashMap::new()),
            generation: Cell::new(0),
            focused_column: Cell::new(0),
        });
        inner
            .state
            .borrow_mut()
            .open_root(PaneLocation::Directory(root.to_path_buf()));
        reconcile(&inner);
        install_column_nav(&inner);
        Self { inner }
    }

    /// What: the root widget to place in the window.
    /// Why: the window holds the scroller; a clone bumps the GTK refcount so both can hold it.
    pub fn widget(&self) -> Widget {
        self.inner.scrolled.clone().upcast::<Widget>()
    }

    /// What: programmatically spawn the first sub-directory's child pane from the root.
    /// Why: exercises the real activation -> spawn -> reconcile path for unattended verification,
    ///      without synthesizing a click; gated behind the autospawn env var by the caller.
    pub fn autospawn_first_dir_for_test(&self) {
        let inner = &self.inner;
        let Some(root_id) = inner.state.borrow().active() else {
            return;
        };
        let Some(PaneLocation::Directory(path)) =
            inner.state.borrow().pane(root_id).map(|pane| pane.location.clone())
        else {
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
}

/// What: mint and record the next directory-read generation.
/// Why: a newer read supersedes a stale snapshot; the counter only ever increases.
fn next_generation(inner: &Rc<StripInner>) -> u64 {
    let generation = inner.generation.get() + 1;
    inner.generation.set(generation);
    generation
}

/// What: the canvas position (in pixels) of the pane at `column`, `slot`.
/// Why: columns tile horizontally (lineage depth), slots stack vertically within a column.
fn position(column: usize, slot: usize) -> (i32, i32) {
    let x = column as i32 * (PANE_WIDTH + PANE_GAP);
    let y = slot as i32 * (PANE_HEIGHT + PANE_GAP);
    (x, y)
}

/// What: map every live pane to its `(column, slot)` grid position.
/// Why: reconcile needs both which panes exist and where each one goes.
fn column_slots(state: &PaneStripState) -> HashMap<PaneId, (usize, usize)> {
    let mut slots = HashMap::new();
    for (column, ids) in state.columns().iter().enumerate() {
        for (slot, &id) in ids.iter().enumerate() {
            slots.insert(id, (column, slot));
        }
    }
    slots
}

/// What: bring the canvas widgets into agreement with the model: drop panes that are gone, then
///       place or move every live pane to its grid position.
/// Why: one idempotent pass after any state change keeps the fixed canvas correct without tracking
///      diffs by hand.
fn reconcile(inner: &Rc<StripInner>) {
    let live = column_slots(&inner.state.borrow());
    remove_stale(inner, &live);
    for (&id, &(column, slot)) in &live {
        let (x, y) = position(column, slot);
        ensure_pane_widget(inner, id, x, y);
    }
}

/// What: remove canvas widgets for panes no longer in the model.
/// Why: a closed pane's widget must leave the fixed canvas and the widget map.
fn remove_stale(inner: &Rc<StripInner>, live: &HashMap<PaneId, (usize, usize)>) {
    let stale: Vec<PaneId> = inner
        .widgets
        .borrow()
        .keys()
        .copied()
        .filter(|id| !live.contains_key(id))
        .collect();
    for id in stale {
        if let Some(widget) = inner.widgets.borrow_mut().remove(&id) {
            inner.fixed.remove(&widget);
        }
    }
}

/// What: ensure the pane `id` has a widget at `(x, y)`: move an existing one, or build and place a
///       new one sized to the fixed pane box.
/// Why: reconcile calls this per live pane; a fixed size bounds each pane's list so an outer pan
///      never re-virtualizes it.
fn ensure_pane_widget(inner: &Rc<StripInner>, id: PaneId, x: i32, y: i32) {
    let existing = inner.widgets.borrow().get(&id).cloned();
    if let Some(widget) = existing {
        inner.fixed.move_(&widget, f64::from(x), f64::from(y));
        return;
    }
    let widget = build_pane_widget(inner, id);
    widget.set_size_request(PANE_WIDTH, PANE_HEIGHT);
    inner.fixed.put(&widget, f64::from(x), f64::from(y));
    inner.widgets.borrow_mut().insert(id, widget);
}

/// What: build the widget for pane `id` from its location.
/// Why: a directory location becomes a listing pane wired to spawn; a preview location is a
///      placeholder until the thumbnail milestone; a missing pane degrades to a label.
fn build_pane_widget(inner: &Rc<StripInner>, id: PaneId) -> Widget {
    let location = inner.state.borrow().pane(id).map(|pane| pane.location.clone());
    match location {
        Some(PaneLocation::Directory(path)) => build_directory_pane(inner, id, &path),
        Some(PaneLocation::Preview(path)) => build_preview_placeholder(&path),
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

/// What: build the temporary preview-pane placeholder for `path`.
/// Why: the thumbnail milestone replaces this with a real off-thread decoded preview.
fn build_preview_placeholder(path: &Path) -> Widget {
    Label::new(Some(&format!("preview: {}", path.display()))).upcast::<Widget>()
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
        panes = inner.state.borrow().len(),
        columns = inner.state.borrow().columns().len(),
        "spawned child pane"
    );
    spawned
}

/// What: close pane `id` and reconcile the canvas so its widget leaves.
/// Why: explicit close is the only way a pane dies; reconcile's `remove_stale` drops the widget.
fn close_pane(inner: &Rc<StripInner>, id: PaneId) {
    inner.state.borrow_mut().close(id);
    reconcile(inner);
    tracing::info!(closed = id.0, panes = inner.state.borrow().len(), "closed pane");
}

/// What: scroll the canvas so pane `id` is visible, deferred to idle so layout has settled.
/// Why: the scroll adjustments' bounds update on layout; setting them on the next idle tick avoids
///      clamping against stale bounds right after reconcile.
fn scroll_to_pane(inner: &Rc<StripInner>, id: PaneId) {
    let Some(&(column, slot)) = column_slots(&inner.state.borrow()).get(&id) else {
        return;
    };
    let (x, y) = position(column, slot);
    let scrolled = inner.scrolled.clone();
    let pane = inner.widgets.borrow().get(&id).cloned();
    glib::idle_add_local_once(move || {
        reveal(&scrolled.hadjustment(), f64::from(x), f64::from(PANE_WIDTH));
        reveal(&scrolled.vadjustment(), f64::from(y), f64::from(PANE_HEIGHT));
        if let Some(pane) = pane {
            pane.grab_focus();
        }
    });
}

/// What: install a capture-phase key controller on the scroller that moves keyboard focus between
///       columns on Left/Right.
/// Why: horizontal navigation is keyboard-primary; capture phase intercepts Left/Right before the
///      focused list, leaving its Up/Down row navigation untouched.
fn install_column_nav(inner: &Rc<StripInner>) {
    let keys = EventControllerKey::new();
    keys.set_propagation_phase(PropagationPhase::Capture);
    let weak = Rc::downgrade(inner);
    keys.connect_key_pressed(move |_, key, _, _| {
        let Some(inner) = weak.upgrade() else {
            return glib::Propagation::Proceed;
        };
        match key {
            Key::Left => focus_relative_column(&inner, -1),
            Key::Right => focus_relative_column(&inner, 1),
            _ => glib::Propagation::Proceed,
        }
    });
    inner.scrolled.add_controller(keys);
}

/// What: move keyboard focus to the first pane of the column `delta` away, if it exists, and record
///       it as the focused column.
/// Why: Left/Right walk the lineage; an out-of-range move is ignored and the key passes through.
fn focus_relative_column(inner: &Rc<StripInner>, delta: i32) -> glib::Propagation {
    let target = inner.focused_column.get() as i32 + delta;
    let columns = inner.state.borrow().columns().len() as i32;
    if target < 0 || target >= columns {
        return glib::Propagation::Proceed;
    }
    let target = target as usize;
    let first = inner
        .state
        .borrow()
        .columns()
        .get(target)
        .and_then(|column| column.first().copied());
    let Some(id) = first else {
        return glib::Propagation::Proceed;
    };
    let Some(widget) = inner.widgets.borrow().get(&id).cloned() else {
        return glib::Propagation::Proceed;
    };
    widget.grab_focus();
    inner.focused_column.set(target);
    glib::Propagation::Stop
}

/// What: adjust `adj` so the range `[start, start + extent)` is within the visible page.
/// Why: scroll only as far as needed to reveal the pane, clamped to the scrollable bounds.
fn reveal(adj: &Adjustment, start: f64, extent: f64) {
    let page = adj.page_size();
    if start < adj.value() {
        adj.set_value(start);
    } else if start + extent > adj.value() + page {
        let target = start + extent - page;
        adj.set_value(target.clamp(0.0, (adj.upper() - page).max(0.0)));
    }
}
