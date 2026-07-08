//! Deep GTK layout adapter for the pane strip.
//!
//! The product model only says that a pane has a `(column, row)` placement and an optional parent.
//! This module hides every GTK detail needed to render and scroll that placement graph: the outer
//! horizontal scroller, per-column vertical scrollers, fixed canvases, pane-widget map, reveal
//! retries, parent-child tethering, and quiet-period snapping. `strip.rs` now only mutates the pane
//! model and asks this adapter to reconcile a placement snapshot.

/// What: imports cells for closure-captured GTK state.
/// Why: column views, pane widgets, scroll epochs, and focus state mutate from signal handlers.
use std::cell::{Cell, RefCell};
/// What: imports the hash-map container.
/// Why: pane widgets are keyed by stable `PaneId` during reconciliation.
use std::collections::HashMap;
/// What: imports the reference-counted pointer.
/// Why: GTK signal closures hold weak references to the shared layout adapter.
use std::rc::Rc;

/// What: imports GTK widget-extension traits.
/// Why: layout construction, controller installation, focus, fixed positioning, and adjustments use
///      prelude methods.
use gtk4::prelude::*;
/// What: imports concrete GTK layout and event-controller types.
/// Why: the strip is built from scrollers, boxes, fixed canvases, widgets, and key controllers.
use gtk4::{Box as GtkBox, EventControllerKey, Fixed, Orientation, PolicyType, ScrolledWindow, Widget};

/// What: imports pane geometry constants.
/// Why: every placement and scroll calculation uses one pane-size source of truth.
use crate::constants::{PANE_GAP, PANE_HEIGHT, PANE_WIDTH};
/// What: imports the stable pane identity type.
/// Why: widget maps and placement snapshots are keyed by `PaneId`.
use crate::types::PaneId;

/// What: scroll/reveal/tether implementation for `StripLayout`.
/// Why: keeps the layout interface file under the max-lines budget while preserving one layout seam.
mod scroll;

/// What: immutable placement snapshot for one pane.
/// Why: `StripLayout` needs only geometry and parent links, not the full `PaneStripState` interface.
#[derive(Clone, Copy, Debug)]
pub(crate) struct PanePlacement {
    /// Stable pane identity.
    pub(crate) id: PaneId,
    /// Zero-based lineage column.
    pub(crate) column: usize,
    /// Zero-based vertical row within the global row coordinate space.
    pub(crate) row: usize,
    /// Parent pane identity, if this pane was spawned from another pane.
    pub(crate) parent: Option<PaneId>,
}

/// What: one column's GTK widgets.
/// Why: each column owns its own vertical scroller over a fixed canvas.
struct ColumnView {
    /// Vertical scroller for this column.
    scroller: ScrolledWindow,
    /// Fixed canvas holding pane widgets at `row * ROW_STRIDE`.
    fixed: Fixed,
}

/// What: deep layout module for the pane strip.
/// Why: callers only provide pane placements and widget builders; this implementation owns GTK
///      scrollers, fixed canvases, focus bookkeeping, reveal, tether, and snap behavior.
pub(crate) struct StripLayout {
    /// Outer horizontal scroller holding all columns.
    outer: ScrolledWindow,
    /// Horizontal box containing per-column vertical scrollers.
    columns_box: GtkBox,
    /// Column views by column index.
    columns: RefCell<Vec<ColumnView>>,
    /// Pane widget map by stable pane id.
    widgets: RefCell<HashMap<PaneId, Widget>>,
    /// Latest placement snapshot, used by reveal and tether without borrowing the pane model.
    placements: RefCell<Vec<PanePlacement>>,
    /// Column whose pane last received focus, used by Left/Right keyboard navigation.
    focused_column: Cell<usize>,
    /// Re-entrancy guard while tether or snap code adjusts scroll offsets.
    tethering: Cell<bool>,
    /// Scroll epoch for debouncing quiet-period snapping.
    scroll_epoch: Cell<u64>,
}

/// What: public interface for constructing, reconciling, focusing, and scrolling the strip layout.
/// Why: keeps GTK layout policy behind a narrow seam so `strip.rs` remains a model/controller layer.
impl StripLayout {
    /// What: build the GTK layout adapter and return it behind `Rc`.
    /// Why: per-column scroll signals need weak references back to the adapter.
    pub(crate) fn new() -> Rc<Self> {
        let columns_box = GtkBox::new(Orientation::Horizontal, PANE_GAP);
        let outer = ScrolledWindow::builder()
            .child(&columns_box)
            .hscrollbar_policy(PolicyType::Automatic)
            .vscrollbar_policy(PolicyType::Never)
            .vexpand(true)
            .hexpand(true)
            .build();
        Rc::new(Self {
            outer,
            columns_box,
            columns: RefCell::new(Vec::new()),
            widgets: RefCell::new(HashMap::new()),
            placements: RefCell::new(Vec::new()),
            focused_column: Cell::new(0),
            tethering: Cell::new(false),
            scroll_epoch: Cell::new(0),
        })
    }

    /// What: clone the root GTK widget for insertion into the window.
    /// Why: callers should not know the root happens to be a `GtkScrolledWindow`.
    pub(crate) fn widget(&self) -> Widget {
        self.outer.clone().upcast::<Widget>()
    }

    /// What: attach a key controller to the layout's root scroller.
    /// Why: keyboard navigation is installed by `keys.rs`, but the concrete root widget stays hidden.
    pub(crate) fn add_column_key_controller(&self, controller: EventControllerKey) {
        self.outer.add_controller(controller);
    }

    /// What: return the column that most recently received pane focus.
    /// Why: Left/Right navigation computes its target relative to this value.
    pub(crate) fn focused_column(&self) -> usize {
        self.focused_column.get()
    }

    /// What: record the column that just received pane focus.
    /// Why: spawn and keyboard navigation both update the origin for the next Left/Right move.
    pub(crate) fn set_focused_column(&self, column: usize) {
        self.focused_column.set(column);
    }

    /// What: focus pane widget `id`, returning whether it existed.
    /// Why: keyboard navigation can stop event propagation only when focus actually moved.
    pub(crate) fn focus_widget(&self, id: PaneId) -> bool {
        let Some(widget) = self.widgets.borrow().get(&id).cloned() else {
            return false;
        };
        widget.grab_focus();
        true
    }

    /// What: reconcile GTK widgets to `placements`, building missing pane widgets through
    ///       `build_widget`.
    /// Why: one idempotent pass after each model mutation grows/shrinks columns, removes stale
    ///      widgets, creates missing widgets, moves live widgets, and equalizes content height.
    pub(crate) fn reconcile(
        self: &Rc<Self>,
        placements: Vec<PanePlacement>,
        mut build_widget: impl FnMut(PaneId) -> Widget,
    ) {
        self.placements.replace(placements.clone());
        let column_count = placements
            .iter()
            .map(|placement| placement.column + 1)
            .max()
            .unwrap_or(0);
        self.ensure_columns(column_count);
        let live: HashMap<PaneId, (usize, usize)> = placements
            .iter()
            .map(|placement| (placement.id, (placement.column, placement.row)))
            .collect();
        self.remove_stale(&live);
        for placement in &placements {
            self.ensure_pane_widget(placement, &mut build_widget);
        }
        self.set_content_height(&live);
    }

    /// What: grow or shrink the column views to exactly `count`.
    /// Why: descending adds columns and bulk-close removes them; each new column owns a hidden
    ///      vertical scroller over a fixed pane canvas.
    fn ensure_columns(self: &Rc<Self>, count: usize) {
        let mut columns = self.columns.borrow_mut();
        while columns.len() < count {
            let index = columns.len();
            let fixed = Fixed::new();
            let scroller = ScrolledWindow::builder()
                .child(&fixed)
                .hscrollbar_policy(PolicyType::Never)
                .vscrollbar_policy(PolicyType::External)
                .width_request(PANE_WIDTH)
                .vexpand(true)
                .build();
            scroller.add_css_class("fm-column");
            fixed.add_css_class("fm-canvas");
            let weak = Rc::downgrade(self);
            scroller.vadjustment().connect_value_changed(move |_| {
                if let Some(layout) = weak.upgrade() {
                    layout.enforce_tether(index);
                }
            });
            self.columns_box.append(&scroller);
            columns.push(ColumnView { scroller, fixed });
        }
        while columns.len() > count {
            if let Some(view) = columns.pop() {
                self.columns_box.remove(&view.scroller);
            }
        }
    }

    /// What: remove pane widgets whose ids no longer appear in `live`.
    /// Why: closed panes must leave their column canvas and the widget map.
    fn remove_stale(&self, live: &HashMap<PaneId, (usize, usize)>) {
        let stale: Vec<PaneId> = self
            .widgets
            .borrow()
            .keys()
            .copied()
            .filter(|id| !live.contains_key(id))
            .collect();
        for id in stale {
            if let Some(widget) = self.widgets.borrow_mut().remove(&id)
                && let Some(fixed) = widget.parent().and_downcast::<Fixed>()
            {
                fixed.remove(&widget);
            }
        }
    }

    /// What: ensure `placement.id` has a widget at its target column and row.
    /// Why: existing widgets move; missing widgets are built and inserted at a deterministic fixed
    ///      canvas coordinate.
    fn ensure_pane_widget(
        &self,
        placement: &PanePlacement,
        build_widget: &mut impl FnMut(PaneId) -> Widget,
    ) {
        let existing = self.widgets.borrow().get(&placement.id).cloned();
        let columns = self.columns.borrow();
        let Some(view) = columns.get(placement.column) else {
            return;
        };
        if let Some(widget) = existing {
            view.fixed.move_(&widget, 0.0, scroll::row_y(placement.row));
            return;
        }
        drop(columns);
        let widget = build_widget(placement.id);
        widget.set_size_request(PANE_WIDTH, PANE_HEIGHT);
        if let Some(view) = self.columns.borrow().get(placement.column) {
            view.fixed.put(&widget, 0.0, scroll::row_y(placement.row));
        }
        self.widgets.borrow_mut().insert(placement.id, widget);
    }

    /// What: size each column canvas to that column's deepest pane row.
    /// Why: columns keep the shared row coordinate for alignment, but a short column should not
    ///      gain blank scroll range just because a different column has deeper rows.
    fn set_content_height(&self, live: &HashMap<PaneId, (usize, usize)>) {
        for (index, view) in self.columns.borrow().iter().enumerate() {
            let max_row = live
                .values()
                .filter_map(|&(column, row)| (column == index).then_some(row))
                .max()
                .unwrap_or(0);
            let height = (scroll::row_y(max_row) + f64::from(PANE_HEIGHT)) as i32;
            view.fixed.set_size_request(PANE_WIDTH, height);
        }
    }

}
