//! Geometry helpers for lane-owned scrolling.
//!
//! Kept separate so `lane.rs` stays under the Rust max-lines budget while the math remains named.

/// What: imports the hash-map container.
/// Why: lane grouping is keyed by parent `PaneId`.
use std::collections::HashMap;

/// What: imports pane geometry constants.
/// Why: rectangles, scroll conversion, and snap targets share the pane grid.
use crate::constants::{PANE_GAP, PANE_HEIGHT, PANE_WIDTH};
/// What: imports stable pane identity.
/// Why: direct-child groups are keyed by parent pane id.
use crate::types::PaneId;

/// What: imports parent placement type and row-coordinate helper.
/// Why: lane geometry is computed from placement snapshots.
use super::super::{PanePlacement, scroll};

/// What: pixel distance for one discrete wheel unit.
/// Why: GTK reports high-resolution scrolling as pixel-ish deltas, but classic wheel devices often
///      report `1`; this constant makes discrete wheels move a useful amount.
const DISCRETE_SCROLL_PIXELS: f64 = 80.0;

/// What: lane rectangle in strip-overlay coordinates.
/// Why: hit-testing, debug drawing, and area ranking share one rectangle calculation.
#[derive(Clone, Copy)]
pub(super) struct LaneRect {
    /// Left edge in horizontal strip content coordinates.
    pub(super) x: f64,
    /// Top edge in visible viewport coordinates.
    pub(super) y: f64,
    /// Rectangle width in pixels.
    pub(super) width: f64,
    /// Rectangle height in pixels.
    pub(super) height: f64,
}

/// What: rectangle helpers for hit-testing and ranking.
/// Why: keep bounds math named instead of open-coded at each caller.
impl LaneRect {
    /// What: report whether point `x, y` sits inside the rectangle.
    /// Why: lane hit-testing chooses among visible rectangles under the pointer.
    pub(super) fn contains(&self, x: f64, y: f64) -> bool {
        x >= self.x && x <= self.x + self.width && y >= self.y && y <= self.y + self.height
    }

    /// What: rectangle area in square pixels.
    /// Why: overlapping lanes choose the smallest area under the pointer.
    pub(super) fn area(&self) -> f64 {
        self.width * self.height
    }
}

/// What: compute direct-child groups keyed by their parent pane id.
/// Why: every parent with children owns one lane.
pub(super) fn direct_child_groups(
    placements: &[PanePlacement],
) -> HashMap<PaneId, Vec<PanePlacement>> {
    let mut groups: HashMap<PaneId, Vec<PanePlacement>> = HashMap::new();
    for placement in placements {
        if let Some(parent) = placement.parent {
            groups.entry(parent).or_default().push(*placement);
        }
    }
    groups
}

/// What: look up a placement by id.
/// Why: lane maps store parent ids but geometry needs the parent placement snapshot.
pub(super) fn placement_by_id(
    placements: &[PanePlacement],
    id: PaneId,
) -> Option<PanePlacement> {
    placements
        .iter()
        .find(|placement| placement.id == id)
        .copied()
}

/// What: base-coordinate bottom edge for a parent-plus-direct-children lane.
/// Why: the lane rectangle includes the parent pane and the deepest direct child pane.
pub(super) fn lane_base_bottom(parent: PanePlacement, children: &[PanePlacement]) -> f64 {
    children.iter().fold(
        scroll::row_y(parent.row) + f64::from(PANE_HEIGHT),
        |current, child| current.max(scroll::row_y(child.row) + f64::from(PANE_HEIGHT)),
    )
}

/// What: convert GTK scroll delta to pixels.
/// Why: smooth devices tend to produce pixel-like deltas while discrete wheels often produce unit
///      deltas that need scaling.
pub(super) fn scroll_pixels(delta: f64) -> f64 {
    if delta.abs() <= 1.0 {
        return delta * DISCRETE_SCROLL_PIXELS;
    }
    delta
}

/// What: choose the closest row-boundary snap target after clamping both neighboring rows.
/// Why: bottom-of-range must remain reachable even when the max offset lands between row boundaries.
pub(super) fn nearest_snap(value: f64, max: f64) -> f64 {
    let stride = f64::from(PANE_HEIGHT + PANE_GAP);
    let lower = ((value / stride).floor() * stride).clamp(0.0, max);
    let upper = ((value / stride).ceil() * stride).clamp(0.0, max);
    if (value - lower).abs() <= (upper - value).abs() {
        lower
    } else {
        upper
    }
}

/// What: compute width for a lane spanning `column_span` columns.
/// Why: debug lane boxes must include pane columns and the gaps between them.
pub(super) fn lane_width(column_span: usize) -> f64 {
    f64::from(column_span as i32 * PANE_WIDTH + (column_span - 1) as i32 * PANE_GAP)
}
