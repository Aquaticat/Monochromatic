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
/// What: imports debug-tint helpers.
/// Why: debug mode draws labeled overlays for every scroll and lane region.
use crate::debug_tint;
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
    /// Root widget inserted into the horizontal column box.
    root: Widget,
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
    /// Debug child-lane overlays by parent pane id.
    lanes: RefCell<HashMap<PaneId, Widget>>,
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
            lanes: RefCell::new(HashMap::new()),
            placements: RefCell::new(Vec::new()),
            focused_column: Cell::new(0),
            tethering: Cell::new(false),
            scroll_epoch: Cell::new(0),
        })
    }

    /// What: clone the root GTK widget for insertion into the window.
    /// Why: callers should not know the root happens to be a `GtkScrolledWindow`.
    pub(crate) fn widget(&self) -> Widget {
        let detail = format!("columns={}", self.columns.borrow().len());
        debug_tint::wrap(&self.outer, debug_tint::Q8O_OUTER_STRIP, Some(&detail))
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
        self.reconcile_child_lanes(&placements);
    }

    /// What: grow or shrink the column views to exactly `count`.
    /// Why: descending adds columns and bulk-close removes them; each new column owns a hidden
    ///      vertical scroller over a fixed pane canvas.
    fn ensure_columns(self: &Rc<Self>, count: usize) {
        let mut columns = self.columns.borrow_mut();
        while columns.len() < count {
            let index = columns.len();
            let fixed = Fixed::new();
            fixed.add_css_class("fm-canvas");
            let canvas_detail = format!("column={index}");
            let canvas = debug_tint::wrap(
                &fixed,
                debug_tint::V6C_COLUMN_CANVAS,
                Some(&canvas_detail),
            );
            let scroller = ScrolledWindow::builder()
                .child(&canvas)
                .hscrollbar_policy(PolicyType::Never)
                .vscrollbar_policy(PolicyType::External)
                .width_request(PANE_WIDTH)
                .vexpand(true)
                .build();
            scroller.add_css_class("fm-column");
            let column_detail = format!("column={index}");
            let root = debug_tint::wrap(
                &scroller,
                debug_tint::C8L_COLUMN_SCROLL,
                Some(&column_detail),
            );
            root.add_css_class("fm-column-root");
            let weak = Rc::downgrade(self);
            scroller.vadjustment().connect_value_changed(move |_| {
                if let Some(layout) = weak.upgrade() {
                    layout.enforce_tether(index);
                }
            });
            self.columns_box.append(&root);
            columns.push(ColumnView {
                root,
                scroller,
                fixed,
            });
        }
        while columns.len() > count {
            if let Some(view) = columns.pop() {
                self.columns_box.remove(&view.root);
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
        let pane = build_widget(placement.id);
        pane.set_size_request(PANE_WIDTH, PANE_HEIGHT);
        let detail = format!(
            "pane={} column={} row={}",
            placement.id.0, placement.column, placement.row
        );
        let widget = debug_tint::wrap(&pane, debug_tint::P4N_PANE_SHELL, Some(&detail));
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

    /// What: rebuild debug rails for immediate-child pane groups.
    /// Why: lanes are abstract scroll-debug regions, not production widgets, so recreating them on
    ///      each reconcile keeps labels accurate and keeps production runs unchanged.
    fn reconcile_child_lanes(&self, placements: &[PanePlacement]) {
        for (_, lane) in self.lanes.borrow_mut().drain() {
            if let Some(fixed) = lane.parent().and_downcast::<Fixed>() {
                fixed.remove(&lane);
            }
        }
        if !debug_tint::enabled() {
            return;
        }
        let mut groups: HashMap<PaneId, Vec<PanePlacement>> = HashMap::new();
        for placement in placements {
            if let Some(parent) = placement.parent {
                groups.entry(parent).or_default().push(*placement);
            }
        }
        for (parent, children) in groups {
            self.add_child_lane(parent, &children);
        }
    }

    /// What: draw one immediate-child lane for `parent` across all its child panes.
    /// Why: this labels the shared scroll rail the user described: siblings keep their spacing as a
    ///      group while the lane moves within the column viewport.
    fn add_child_lane(&self, parent: PaneId, children: &[PanePlacement]) {
        let Some(first) = children.first() else {
            return;
        };
        let max_row = children.iter().map(|child| child.row).max().unwrap_or(first.row);
        let height = (scroll::row_y(max_row) + f64::from(PANE_HEIGHT)) as i32;
        let detail = format!(
            "parent={} column={} children={} rows=0..{}",
            parent.0,
            first.column,
            children.len(),
            max_row
        );
        let lane = debug_tint::lane(
            debug_tint::Y6L_CHILD_LANE,
            Some(&detail),
            PANE_WIDTH,
            height,
        );
        if let Some(view) = self.columns.borrow().get(first.column) {
            view.fixed.put(&lane, 0.0, 0.0);
            self.lanes.borrow_mut().insert(parent, lane);
        }
    }
}
