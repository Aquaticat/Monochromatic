//! Lane-owned vertical scrolling for the pane strip.
//!
//! Full columns are static canvases. The outer scroller owns vertical wheel input for the whole app.
//! Each sibling-group lane, one parent pane plus its direct children, reacts to that global app
//! scroll and independently applies a bounded sticky offset inside its green-box range.

/// What: imports the reference-counted pointer.
/// Why: GTK adjustment callbacks hold weak references to `StripLayout`.
use std::rc::Rc;

/// What: imports GTK widget traits.
/// Why: lane sync moves fixed children and places debug overlays.
use gtk4::prelude::*;
/// What: imports concrete GTK alignment type used by debug overlay positioning.
/// Why: debug rails need explicit alignment inside the strip overlay.
use gtk4::Align;

/// What: imports pane and viewport geometry constants.
/// Why: lane boxes, sticky offsets, and clamping share the same pixel grid.
use crate::constants::{DEFAULT_HEIGHT, PANE_GAP, PANE_HEIGHT, PANE_WIDTH};
/// What: imports debug-tint helpers.
/// Why: debug mode draws rounded green lane boxes with labels.
use crate::debug_tint;
/// What: imports the stable pane identity type.
/// Why: lane offsets are keyed by parent pane id.
use crate::types::PaneId;

/// What: imports parent layout types and row-coordinate helper.
/// Why: lane methods extend `StripLayout` and use `PanePlacement` snapshots.
use super::{PanePlacement, StripLayout, scroll};

/// What: lane geometry helpers.
/// Why: grouping, rectangles, and lane dimensions are pure calculations split out to keep this file
///      under the max-lines budget.
mod geometry;
/// What: imports lane geometry helper functions and rectangle type.
/// Why: app-scroll sync uses these helpers while keeping GTK-specific code in this file.
use geometry::{LaneRect, direct_child_groups, lane_base_bottom, lane_width, placement_by_id};

/// What: app-scroll sync and debug-lane methods on the layout adapter.
/// Why: vertical scroll ownership belongs to the whole app, while lane offsets react here.
impl StripLayout {
    /// What: sync lane offsets whenever the whole-app vertical scroller moves.
    /// Why: wheel input should scroll the entire app first; lanes then independently try to remain
    ///      visible within their green-box limits.
    pub(super) fn install_app_scroll_sync(self: &Rc<Self>) {
        let weak = Rc::downgrade(self);
        self.outer.vadjustment().connect_value_changed(move |_| {
            if let Some(layout) = weak.upgrade() {
                layout.sync_lane_offsets_to_app_scroll();
            }
        });
    }

    /// What: prune stale lane offsets and clamp live offsets to their current scroll ranges.
    /// Why: closing panes or relayout can remove lanes or shrink how far they may scroll.
    pub(super) fn prune_lane_offsets(&self) {
        let placements = self.placements.borrow().clone();
        let groups = direct_child_groups(&placements);
        let active: Vec<PaneId> = groups.keys().copied().collect();
        self.lane_offsets
            .borrow_mut()
            .retain(|parent, _| active.contains(parent));
        let mut updates = Vec::new();
        for parent in active {
            if let Some(parent_placement) = placement_by_id(&placements, parent)
                && let Some(children) = groups.get(&parent)
            {
                let max = self.lane_max_offset(parent_placement, children);
                let current = self.lane_offsets.borrow().get(&parent).copied().unwrap_or(0.0);
                updates.push((parent, current.clamp(0.0, max)));
            }
        }
        for (parent, value) in updates {
            self.lane_offsets.borrow_mut().insert(parent, value);
        }
        self.sync_lane_offsets_to_app_scroll();
    }

    /// What: move every pane widget to its lane-offset-adjusted visual row.
    /// Why: columns are static canvases, so lane sticky offsets are implemented by moving panes.
    pub(super) fn position_all_widgets(&self) {
        let placements = self.placements.borrow().clone();
        for placement in &placements {
            let widget = self.widgets.borrow().get(&placement.id).cloned();
            let Some(widget) = widget else {
                continue;
            };
            if let Some(view) = self.columns.borrow().get(placement.column) {
                view.fixed.move_(&widget, 0.0, self.visual_y_for_pane(*placement));
            }
        }
    }

    /// What: redraw debug child-lane overlays from the latest placement snapshot.
    /// Why: lane rectangles live over the visible column viewports, so scroll changes require moving
    ///      them even when pane placements have not changed.
    pub(super) fn refresh_child_lanes(&self) {
        self.clear_child_lanes();
        if !debug_tint::enabled() {
            return;
        }
        let placements = self.placements.borrow().clone();
        let groups = direct_child_groups(&placements);
        for (parent, children) in groups {
            if let Some(parent_placement) = placement_by_id(&placements, parent) {
                self.add_child_lane(parent_placement, &children);
            }
        }
    }

    /// What: clear every debug child-lane overlay.
    /// Why: lane geometry depends on placement and current offsets, so redraw is simpler and less
    ///      error-prone than incremental geometry updates.
    fn clear_child_lanes(&self) {
        for (_, lane) in self.lanes.borrow_mut().drain() {
            self.strip_overlay.remove_overlay(&lane);
        }
    }

    /// What: reveal `placement` vertically by adjusting the whole-app vertical scroller.
    /// Why: spawning a child should bring that child into view while lanes react to app scroll.
    pub(super) fn reveal_lane_member(&self, placement: PanePlacement) -> bool {
        let adj = self.outer.vadjustment();
        let page = adj.page_size();
        let value = adj.value();
        let start = self.visual_y_for_pane(placement);
        if start >= value && start + f64::from(PANE_HEIGHT) <= value + page {
            return true;
        }
        let max = (adj.upper() - page).max(0.0);
        let target = if start < value {
            start
        } else {
            start + f64::from(PANE_HEIGHT) - page
        };
        adj.set_value(target.clamp(0.0, max));
        self.sync_lane_offsets_to_app_scroll();
        let settled = adj.value();
        let start = self.visual_y_for_pane(placement);
        start >= settled && start + f64::from(PANE_HEIGHT) <= settled + page
    }

    /// What: recompute every sibling-group lane offset from the whole-app vertical scroll.
    /// Why: the app scrolls first; each green-box lane then applies its own bounded sticky offset so
    ///      it tries to stay visible without preventing the app scroll.
    fn sync_lane_offsets_to_app_scroll(&self) {
        let placements = self.placements.borrow().clone();
        let groups = direct_child_groups(&placements);
        let scroll = self.outer.vadjustment().value();
        let updates: Vec<(PaneId, f64)> = groups
            .iter()
            .filter_map(|(parent, children)| {
                let parent_placement = placement_by_id(&placements, *parent)?;
                let max = self.lane_max_offset(parent_placement, children);
                let top = scroll::row_y(parent_placement.row);
                Some((*parent, (scroll - top).clamp(0.0, max)))
            })
            .collect();
        for (parent, next) in updates {
            self.lane_offsets.borrow_mut().insert(parent, next);
        }
        self.position_all_widgets();
        self.refresh_child_lanes();
    }

    /// What: choose the maximum scroll offset for a lane.
    /// Why: at max offset the lane's deepest direct child bottom reaches the viewport bottom.
    fn lane_max_offset(&self, parent: PanePlacement, children: &[PanePlacement]) -> f64 {
        let bottom = lane_base_bottom(parent, children);
        (bottom - self.viewport_height()).max(0.0)
    }

    /// What: compute `placement`'s content y-coordinate after hierarchical sticky offsets.
    /// Why: every pane reacts to its own sibling lane and ancestor lanes after the app scrolls.
    pub(super) fn visual_y_for_pane(&self, placement: PanePlacement) -> f64 {
        scroll::row_y(placement.row) + self.effective_offset_for_pane(placement.id)
    }

    /// What: compute all lane offsets affecting `id`.
    /// Why: a pane reacts to every ancestor lane plus its own lane when it is a parent.
    fn effective_offset_for_pane(&self, id: PaneId) -> f64 {
        let placements = self.placements.borrow();
        let offsets = self.lane_offsets.borrow();
        let mut total = 0.0;
        let mut current = Some(id);
        while let Some(pane_id) = current {
            total += offsets.get(&pane_id).copied().unwrap_or(0.0);
            current = placements
                .iter()
                .find(|placement| placement.id == pane_id)
                .and_then(|placement| placement.parent);
        }
        total
    }

    /// What: compute a lane's fixed app-layout rectangle.
    /// Why: green boxes are rails in the broader layout; panes may stick inside them, but the boxes
    ///      themselves must not receive sticky offsets.
    fn lane_rect(&self, parent: PanePlacement, children: &[PanePlacement]) -> LaneRect {
        let end_column = children
            .iter()
            .map(|child| child.column)
            .max()
            .unwrap_or(parent.column);
        let column_span = end_column - parent.column + 1;
        let x = parent.column as f64 * f64::from(PANE_WIDTH + PANE_GAP);
        let y = scroll::row_y(parent.row);
        let width = lane_width(column_span);
        let height = lane_base_bottom(parent, children) - scroll::row_y(parent.row);
        LaneRect {
            x,
            y,
            width,
            height,
        }
    }

    /// What: draw one immediate-child lane around `parent` and its direct child panes.
    /// Why: a lane spans from the parent column through the child column and from the parent row
    ///      down to the deepest direct child's bottom, including empty grid cells in that span.
    fn add_child_lane(&self, parent: PanePlacement, children: &[PanePlacement]) {
        let rect = self.lane_rect(parent, children);
        let max_child_row = children
            .iter()
            .map(|child| child.row)
            .max()
            .unwrap_or(parent.row);
        let end_column = children
            .iter()
            .map(|child| child.column)
            .max()
            .unwrap_or(parent.column);
        let detail = format!(
            "parent={} columns={}..{} rows={}..{} children={}",
            parent.id.0,
            parent.column,
            end_column,
            parent.row,
            max_child_row,
            children.len()
        );
        let lane = debug_tint::lane(
            debug_tint::Y6L_CHILD_LANE,
            Some(&detail),
            rect.width as i32,
            rect.height as i32,
        );
        lane.set_halign(Align::Start);
        lane.set_valign(Align::Start);
        lane.set_margin_start(rect.x as i32);
        lane.set_margin_top(rect.y as i32);
        self.strip_overlay.add_overlay(&lane);
        self.strip_overlay.set_measure_overlay(&lane, false);
        self.lanes.borrow_mut().insert(parent.id, lane);
    }

    /// What: visible viewport height in pixels.
    /// Why: lane max offsets and reveal behavior clamp against the actual window, with startup
    ///      fallback before GTK has allocated a height.
    fn viewport_height(&self) -> f64 {
        let height = self.outer.height();
        if height > 0 {
            return f64::from(height);
        }
        f64::from(DEFAULT_HEIGHT)
    }
}
