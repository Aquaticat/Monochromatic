//! Stateless GTK layout adapter for the sticky pane strip.
//!
//! The original's `layout.rs` plus `layout/lane.rs` own per-lane offsets, chain accumulation, rail
//! clamping, relaxation passes, and reveal machinery. This adapter keeps only the GTK plumbing
//! (scroller, static canvases, widget map, reveal retries) and delegates every position decision
//! to the pure `band` module: on each scroll change it re-places every pane at
//! `band::sticky_y(band, scroll)` and nothing else.

/// What: imports cells for closure-captured GTK state.
/// Why: focus state and the scroll callback mutate from signal handlers.
use std::cell::{Cell, RefCell};
/// What: imports the hash-map container.
/// Why: pane widgets are keyed by stable `PaneId`.
use std::collections::HashMap;
/// What: imports the reference-counted pointer.
/// Why: GTK signal closures hold weak references to the shared layout adapter.
use std::rc::Rc;

/// What: imports GTK widget-extension traits.
/// Why: layout construction, controller installation, focus, and fixed positioning use prelude
///      methods.
use gtk4::prelude::*;
/// What: imports concrete GTK layout and event-controller types plus glib timers.
/// Why: the strip is built from an outer scroller, overlay, horizontal box, fixed canvases, and
///      key controllers; reveal retries use glib timers.
use gtk4::{
    Adjustment, Align, Box as GtkBox, EventControllerKey, Fixed, Orientation, Overlay, PolicyType,
    ScrolledWindow, Widget, glib,
};

/// What: imports the pure band math and its placement snapshot type.
/// Why: every pane position is `sticky_y(band_for(placement), scroll)`; the adapter computes none
///      of it itself.
use crate::band::{self, Placement};
/// What: imports pane geometry constants and the debug-tint env name.
/// Why: canvas sizing and reveal extents share the pane grid; rails draw only in debug runs.
use crate::constants::{DEBUG_TINT_ENV, PANE_GAP, PANE_HEIGHT, PANE_WIDTH};

/// What: imports the stable pane identity type from the original app's crate.
/// Why: widget maps and placement snapshots are keyed by the shared `PaneId`.
use file_manager::types::PaneId;

/// What: how many timed passes to retry revealing a spawned pane before giving up.
/// Why: GTK settles scroll bounds a layout pass after content changes, so reveal must retry; the
///      count bounds the retry even if a pane can never fully fit. Same constant as the original,
///      and one honest cost the browser build does not pay (see the audit doc).
const MAX_REVEAL_ATTEMPTS: u32 = 20;

/// What: milliseconds between reveal retries.
/// Why: a real delay yields to the frame clock and layout between attempts.
const REVEAL_INTERVAL_MS: u64 = 8;

/// What: the sticky layout adapter for the pane strip.
/// Why: callers provide placements and widget builders; this adapter owns only GTK plumbing, no
///      per-lane scroll state of any kind.
pub(crate) struct StickyLayout {
    /// Outer scroller owning both axes for the whole app.
    outer: ScrolledWindow,
    /// Overlay whose main child is the column strip and whose overlay children are debug rails.
    strip_overlay: Overlay,
    /// Horizontal box containing static per-column fixed canvases.
    columns_box: GtkBox,
    /// Static per-column fixed canvases.
    columns: RefCell<Vec<Fixed>>,
    /// Pane widget map by stable pane id.
    widgets: RefCell<HashMap<PaneId, Widget>>,
    /// Latest placement snapshot, used by positioning and reveal without borrowing the model.
    placements: RefCell<Vec<Placement>>,
    /// Debug rail overlay widgets, redrawn from each snapshot.
    rails: RefCell<Vec<Widget>>,
    /// Column whose pane last received focus, used by Left/Right keyboard navigation.
    focused_column: Cell<usize>,
    /// Observer invoked after every scroll-driven reposition, used for state output.
    on_scroll: RefCell<Option<Box<dyn Fn()>>>,
}

/// What: constructing, reconciling, positioning, focusing, and revealing the sticky strip.
/// Why: keeps GTK layout policy behind one narrow seam so `strip.rs` stays a model/controller
///      layer, mirroring the original's interface with the lane engine deleted.
impl StickyLayout {
    /// What: build the GTK layout adapter and return it behind `Rc`.
    /// Why: the scroll handler needs a weak reference back to the adapter.
    pub(crate) fn new() -> Rc<Self> {
        let columns_box = GtkBox::new(Orientation::Horizontal, PANE_GAP);
        let strip_overlay = Overlay::new();
        strip_overlay.set_child(Some(&columns_box));
        let outer = ScrolledWindow::builder()
            .child(&strip_overlay)
            .hscrollbar_policy(PolicyType::Automatic)
            .vscrollbar_policy(PolicyType::Automatic)
            .vexpand(true)
            .hexpand(true)
            .build();
        let layout = Rc::new(Self {
            outer,
            strip_overlay,
            columns_box,
            columns: RefCell::new(Vec::new()),
            widgets: RefCell::new(HashMap::new()),
            placements: RefCell::new(Vec::new()),
            rails: RefCell::new(Vec::new()),
            focused_column: Cell::new(0),
            on_scroll: RefCell::new(None),
        });
        let weak = Rc::downgrade(&layout);
        layout.outer.vadjustment().connect_value_changed(move |_| {
            if let Some(layout) = weak.upgrade() {
                layout.position_all();
                if let Some(observer) = layout.on_scroll.borrow().as_ref() {
                    observer();
                }
            }
        });
        layout
    }

    /// What: register the observer invoked after every scroll-driven reposition.
    /// Why: the controller mirrors observable state into the boundary-test file on scroll.
    pub(crate) fn set_on_scroll(&self, observer: Box<dyn Fn()>) {
        self.on_scroll.replace(Some(observer));
    }

    /// What: clone the root GTK widget for insertion into the window.
    /// Why: callers should not know the root happens to be a `GtkScrolledWindow`.
    pub(crate) fn widget(&self) -> Widget {
        self.outer.clone().upcast::<Widget>()
    }

    /// What: current vertical scroll offset of the whole app.
    /// Why: observed-state output reports it and computes pinning from it.
    pub(crate) fn vertical_scroll(&self) -> f64 {
        self.outer.vadjustment().value()
    }

    /// What: attach a key controller to the layout's root scroller.
    /// Why: keyboard navigation is installed by `keys.rs` without seeing the concrete root.
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

    /// What: reconcile GTK widgets to `placements`, building missing panes through `build_widget`.
    /// Why: one idempotent pass after each model mutation grows/shrinks columns, removes stale
    ///      widgets, creates missing widgets, sizes canvases, and re-places every pane.
    pub(crate) fn reconcile(
        self: &Rc<Self>,
        placements: Vec<Placement>,
        mut build_widget: impl FnMut(PaneId) -> Widget,
    ) {
        self.placements.replace(placements.clone());
        let column_count = placements
            .iter()
            .map(|placement| placement.column + 1)
            .max()
            .unwrap_or(0);
        self.ensure_columns(column_count);
        let live: Vec<PaneId> = placements.iter().map(|placement| placement.id).collect();
        self.remove_stale(&live);
        for placement in &placements {
            self.ensure_pane_widget(placement, &mut build_widget);
        }
        self.set_content_heights(&placements);
        self.position_all();
        self.refresh_rails();
    }

    /// What: grow or shrink the static column canvases to exactly `count`.
    /// Why: descending adds columns and closes remove them.
    fn ensure_columns(&self, count: usize) {
        let mut columns = self.columns.borrow_mut();
        while columns.len() < count {
            let fixed = Fixed::new();
            fixed.set_width_request(PANE_WIDTH);
            fixed.set_vexpand(true);
            fixed.add_css_class("fm-canvas");
            self.columns_box.append(&fixed);
            columns.push(fixed);
        }
        while columns.len() > count {
            if let Some(fixed) = columns.pop() {
                self.columns_box.remove(&fixed);
            }
        }
    }

    /// What: remove pane widgets whose ids no longer appear in `live`.
    /// Why: closed panes must leave their column canvas and the widget map.
    fn remove_stale(&self, live: &[PaneId]) {
        let stale: Vec<PaneId> = self
            .widgets
            .borrow()
            .keys()
            .copied()
            .filter(|id| !live.contains(id))
            .collect();
        for id in stale {
            if let Some(widget) = self.widgets.borrow_mut().remove(&id)
                && let Some(fixed) = widget.parent().and_downcast::<Fixed>()
            {
                fixed.remove(&widget);
            }
        }
    }

    /// What: ensure `placement.id` has a widget in its target column.
    /// Why: missing widgets are built and inserted; positioning happens in one later pass.
    fn ensure_pane_widget(
        &self,
        placement: &Placement,
        build_widget: &mut impl FnMut(PaneId) -> Widget,
    ) {
        if self.widgets.borrow().contains_key(&placement.id) {
            return;
        }
        let widget = build_widget(placement.id);
        widget.set_size_request(PANE_WIDTH, PANE_HEIGHT);
        if let Some(fixed) = self.columns.borrow().get(placement.column) {
            fixed.put(&widget, 0.0, 0.0);
        }
        self.widgets.borrow_mut().insert(placement.id, widget);
    }

    /// What: size each static column canvas to that column's deepest pane row.
    /// Why: columns keep the shared row coordinate for alignment; the scroll range follows the
    ///      tallest canvas.
    fn set_content_heights(&self, placements: &[Placement]) {
        for (index, fixed) in self.columns.borrow().iter().enumerate() {
            let max_row = placements
                .iter()
                .filter_map(|placement| (placement.column == index).then_some(placement.row))
                .max()
                .unwrap_or(0);
            let height = (band::row_y(max_row) + f64::from(PANE_HEIGHT)) as i32;
            fixed.set_size_request(PANE_WIDTH, height);
        }
    }

    /// What: re-place every pane at its sticky position for the current scroll.
    /// Why: the whole positioning policy is one pure call per pane; no offsets, no solver.
    fn position_all(&self) {
        let placements = self.placements.borrow().clone();
        let scroll = self.vertical_scroll();
        for (id, _, y) in band::positions(&placements, scroll) {
            let Some(widget) = self.widgets.borrow().get(&id).cloned() else {
                continue;
            };
            let Some(placement) = placements.iter().find(|placement| placement.id == id) else {
                continue;
            };
            if let Some(fixed) = self.columns.borrow().get(placement.column) {
                fixed.move_(&widget, 0.0, y);
            }
        }
    }

    /// What: redraw the debug rail overlays (each pane's fixed sticky band) when tint is enabled.
    /// Why: screenshots then show the bands panes ride within, comparable to the original's `Y6L`
    ///      lanes and the Electron prototype's `.rail` outlines.
    fn refresh_rails(&self) {
        for rail in self.rails.borrow_mut().drain(..) {
            self.strip_overlay.remove_overlay(&rail);
        }
        if std::env::var_os(DEBUG_TINT_ENV).is_none() {
            return;
        }
        let placements = self.placements.borrow().clone();
        for placement in &placements {
            let band = band::band_for(*placement, &placements);
            let rail = GtkBox::new(Orientation::Vertical, 0);
            rail.add_css_class("fm-sticky-rail");
            rail.set_size_request(PANE_WIDTH, band.height as i32);
            rail.set_halign(Align::Start);
            rail.set_valign(Align::Start);
            rail.set_margin_start((placement.column as i32) * (PANE_WIDTH + PANE_GAP));
            rail.set_margin_top(band.top as i32);
            self.strip_overlay.add_overlay(&rail);
            self.strip_overlay.set_measure_overlay(&rail, false);
            self.rails.borrow_mut().push(rail.upcast::<Widget>());
        }
    }

    /// What: reveal pane `id` horizontally and vertically, then focus it.
    /// Why: a spawn must bring the newly focused pane into view even though GTK updates scroll
    ///      bounds one layout pass after reconciliation; hence the bounded retry timer, a cost the
    ///      original also pays and the browser build does not.
    pub(crate) fn scroll_to_pane(self: &Rc<Self>, id: PaneId) {
        let Some(placement) = self
            .placements
            .borrow()
            .iter()
            .find(|placement| placement.id == id)
            .copied()
        else {
            return;
        };
        let pane = self.widgets.borrow().get(&id).cloned();
        let attempts = Cell::new(0u32);
        let weak = Rc::downgrade(self);
        glib::timeout_add_local(
            std::time::Duration::from_millis(REVEAL_INTERVAL_MS),
            move || {
                let Some(layout) = weak.upgrade() else {
                    return glib::ControlFlow::Break;
                };
                let column_x = placement.column as f64 * f64::from(PANE_WIDTH + PANE_GAP);
                let horizontal =
                    reveal(&layout.outer.hadjustment(), column_x, f64::from(PANE_WIDTH));
                let vertical = reveal(
                    &layout.outer.vadjustment(),
                    band::row_y(placement.row),
                    f64::from(PANE_HEIGHT),
                );
                attempts.set(attempts.get() + 1);
                if (horizontal && vertical) || attempts.get() >= MAX_REVEAL_ATTEMPTS {
                    if let Some(pane) = &pane {
                        pane.grab_focus();
                    }
                    return glib::ControlFlow::Break;
                }
                glib::ControlFlow::Continue
            },
        );
    }
}

/// What: scroll `adj` so `[start, start + extent)` is fully visible, returning whether it is.
/// Why: callers retry until layout settles because scroll bounds update after content changes.
fn reveal(adj: &Adjustment, start: f64, extent: f64) -> bool {
    let page = adj.page_size();
    let value = adj.value();
    if start >= value && start + extent <= value + page {
        return true;
    }
    let max = (adj.upper() - page).max(0.0);
    let target = if start < value {
        start
    } else {
        start + extent - page
    };
    adj.set_value(target.clamp(0.0, max));
    let settled = adj.value();
    start >= settled && start + extent <= settled + page
}
