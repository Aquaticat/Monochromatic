//! Lane-owned vertical scrolling for the pane strip.
//!
//! Full columns are static canvases. Vertical wheel input chooses the smallest visible lane under the
//! pointer, where a lane is one parent pane plus its direct children, and adjusts that lane's offset.
//! Offsets are hierarchical: scrolling a parent lane carries descendant lanes with it, while
//! scrolling a nested lane moves that parent and its descendants relative to the outer lane.

/// What: imports the reference-counted pointer.
/// Why: GTK scroll-controller closures hold weak references to `StripLayout`.
use std::rc::Rc;

/// What: imports GTK event-controller and widget traits.
/// Why: lane scrolling reads event positions, installs controllers, moves fixed children, and places
///      debug overlays.
use gtk4::prelude::*;
/// What: imports concrete GTK types used by lane scrolling and debug overlay positioning.
/// Why: lane hit-testing owns a scroll controller and debug rails need explicit alignment.
use gtk4::{Align, EventControllerScroll, EventControllerScrollFlags, PropagationPhase, glib};

/// What: imports pane and viewport geometry constants.
/// Why: lane boxes, hit-tests, clamping, and snapping share the same pixel grid.
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
/// Why: grouping, rectangles, scroll conversion, and snapping are pure calculations split out to
///      keep this file under the max-lines budget.
mod geometry;
/// What: imports lane geometry helper functions and rectangle type.
/// Why: lane scrolling uses these helpers while keeping GTK-specific code in this file.
use geometry::{
    LaneRect, direct_child_groups, lane_base_bottom, lane_width, nearest_snap, placement_by_id,
    scroll_pixels,
};

/// What: lane scrolling and debug-lane methods on the layout adapter.
/// Why: vertical scroll ownership lives here rather than in static column canvases.
impl StripLayout {
    /// What: install capture-phase wheel handling on the outer scroller.
    /// Why: lane groups own vertical wheel input before inner list scrollers can consume it.
    pub(super) fn install_lane_scroll(self: &Rc<Self>) {
        let scroll = EventControllerScroll::new(EventControllerScrollFlags::VERTICAL);
        scroll.set_propagation_phase(PropagationPhase::Capture);
        let weak = Rc::downgrade(self);
        scroll.connect_scroll(move |controller, _dx, dy| {
            let Some(layout) = weak.upgrade() else {
                return glib::Propagation::Proceed;
            };
            if dy.abs() <= f64::EPSILON {
                return glib::Propagation::Proceed;
            }
            let Some((x, y)) = controller.current_event().and_then(|event| event.position()) else {
                return glib::Propagation::Proceed;
            };
            let content_x = x + layout.outer.hadjustment().value();
            let Some(parent) = layout.smallest_lane_at(content_x, y) else {
                return glib::Propagation::Proceed;
            };
            layout.scroll_lane(parent, scroll_pixels(dy));
            glib::Propagation::Stop
        });
        self.outer.add_controller(scroll);
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
    }

    /// What: move every pane widget to its lane-offset-adjusted visual row.
    /// Why: columns are static canvases, so lane scroll is implemented by moving the panes.
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

    /// What: reveal `placement` vertically by adjusting its parent lane, returning whether visible.
    /// Why: spawning a child should bring that child into view even though columns no longer scroll.
    pub(super) fn reveal_lane_member(&self, placement: PanePlacement) -> bool {
        let placements = self.placements.borrow().clone();
        let groups = direct_child_groups(&placements);
        let parent = placement.parent.unwrap_or(placement.id);
        let Some(children) = groups.get(&parent) else {
            return true;
        };
        let Some(parent_placement) = placement_by_id(&placements, parent) else {
            return true;
        };
        let current = self.lane_offsets.borrow().get(&parent).copied().unwrap_or(0.0);
        let start = self.visual_y_for_pane(placement);
        let page = self.viewport_height();
        let target = if start < 0.0 {
            current + start
        } else if start + f64::from(PANE_HEIGHT) > page {
            current + start + f64::from(PANE_HEIGHT) - page
        } else {
            current
        };
        let max = self.lane_max_offset(parent_placement, children);
        self.lane_offsets
            .borrow_mut()
            .insert(parent, target.clamp(0.0, max));
        self.position_all_widgets();
        self.refresh_child_lanes();
        let settled = self.visual_y_for_pane(placement);
        settled >= 0.0 && settled + f64::from(PANE_HEIGHT) <= page
    }

    /// What: move one lane by `delta` pixels and schedule snap after the scroll quiets.
    /// Why: wheel input changes only the smallest lane under the pointer.
    fn scroll_lane(self: &Rc<Self>, parent: PaneId, delta: f64) {
        let placements = self.placements.borrow().clone();
        let groups = direct_child_groups(&placements);
        let Some(children) = groups.get(&parent) else {
            return;
        };
        let Some(parent_placement) = placement_by_id(&placements, parent) else {
            return;
        };
        let max = self.lane_max_offset(parent_placement, children);
        let current = self.lane_offsets.borrow().get(&parent).copied().unwrap_or(0.0);
        let next = (current + delta).clamp(0.0, max);
        self.lane_offsets.borrow_mut().insert(parent, next);
        self.position_all_widgets();
        self.refresh_child_lanes();
        self.schedule_lane_snap();
    }

    /// What: find the smallest visible lane rectangle containing `x, y`.
    /// Why: nested lanes overlap; precise scrolling chooses the smallest lane under the pointer.
    fn smallest_lane_at(&self, x: f64, y: f64) -> Option<PaneId> {
        let placements = self.placements.borrow().clone();
        let groups = direct_child_groups(&placements);
        let mut best: Option<(PaneId, f64, usize)> = None;
        for (parent, children) in groups {
            let Some(parent_placement) = placement_by_id(&placements, parent) else {
                continue;
            };
            let rect = self.lane_rect(parent_placement, &children);
            if !rect.contains(x, y) {
                continue;
            }
            let area = rect.area();
            let depth = parent_placement.column;
            if best.is_none_or(|(_, best_area, best_depth)| {
                area < best_area || (area == best_area && depth > best_depth)
            }) {
                best = Some((parent, area, depth));
            }
        }
        best.map(|(parent, _, _)| parent)
    }

    /// What: choose the maximum scroll offset for a lane.
    /// Why: at max offset the lane's deepest direct child bottom reaches the viewport bottom.
    fn lane_max_offset(&self, parent: PanePlacement, children: &[PanePlacement]) -> f64 {
        let bottom = lane_base_bottom(parent, children);
        (bottom - self.viewport_height()).max(0.0)
    }

    /// What: compute `placement`'s visual y-coordinate after hierarchical lane offsets.
    /// Why: every pane moves with its own lane and ancestor lanes.
    pub(super) fn visual_y_for_pane(&self, placement: PanePlacement) -> f64 {
        scroll::row_y(placement.row) - self.effective_offset_for_pane(placement.id)
    }

    /// What: compute all lane offsets affecting `id`.
    /// Why: a pane scrolls with every ancestor lane plus its own lane when it is a parent.
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

    /// What: compute a lane's visible rectangle.
    /// Why: hit-testing and debug drawing need the same geometry.
    fn lane_rect(&self, parent: PanePlacement, children: &[PanePlacement]) -> LaneRect {
        let end_column = children
            .iter()
            .map(|child| child.column)
            .max()
            .unwrap_or(parent.column);
        let column_span = end_column - parent.column + 1;
        let x = parent.column as f64 * f64::from(PANE_WIDTH + PANE_GAP);
        let y = scroll::row_y(parent.row) - self.effective_offset_for_pane(parent.id);
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

    /// What: schedule a quiet-period snap after the latest lane scroll event.
    /// Why: an epoch makes only the final timer after a burst perform the snap.
    fn schedule_lane_snap(self: &Rc<Self>) {
        let epoch = self.scroll_epoch.get().wrapping_add(1);
        self.scroll_epoch.set(epoch);
        let weak = Rc::downgrade(self);
        glib::timeout_add_local_once(std::time::Duration::from_millis(SNAP_DELAY_MS), move || {
            if let Some(layout) = weak.upgrade()
                && layout.scroll_epoch.get() == epoch
            {
                layout.snap_lanes();
            }
        });
    }

    /// What: snap every lane offset to the nearest reachable row boundary.
    /// Why: lane-owned scrolling should settle on the same row grid the panes are placed on.
    fn snap_lanes(&self) {
        let placements = self.placements.borrow().clone();
        let groups = direct_child_groups(&placements);
        let mut updates = Vec::new();
        for (parent, value) in self.lane_offsets.borrow().iter() {
            let Some(parent_placement) = placement_by_id(&placements, *parent) else {
                continue;
            };
            let Some(children) = groups.get(parent) else {
                continue;
            };
            let max = self.lane_max_offset(parent_placement, children);
            updates.push((*parent, nearest_snap(*value, max)));
        }
        for (parent, value) in updates {
            self.lane_offsets.borrow_mut().insert(parent, value);
        }
        self.position_all_widgets();
        self.refresh_child_lanes();
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

/// What: milliseconds of scroll quiet before lane offsets snap to whole-pane positions.
/// Why: snapping during a gesture fights the user; a debounce snaps after the gesture settles.
const SNAP_DELAY_MS: u64 = 120;
