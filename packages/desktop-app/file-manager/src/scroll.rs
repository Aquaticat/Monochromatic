//! Scrolling for the detached-column strip.
//!
//! Reveals a spawned pane in its own column (vertically) and in the outer horizontal viewport, and
//! provides the shared row-to-pixel mapping. The parent-tether coupling and full-pane snapping will
//! build on this module.

/// What: imports the single-slot cell.
/// Why: the reveal retry counts its attempts in a `Cell` captured by the timer closure.
use std::cell::Cell;
/// What: imports the reference-counted pointer.
/// Why: the reveal timer holds the strip's inner state.
use std::rc::Rc;

/// What: imports the GTK adjustment/widget extension traits.
/// Why: revealing sets scroll-adjustment values and grabs focus via prelude traits.
use gtk4::prelude::*;
/// What: imports the scroll-adjustment type and the glib module.
/// Why: `reveal` operates on an `Adjustment`; the retry runs on a `glib` timer.
use gtk4::{Adjustment, glib};

/// What: imports the pane-geometry constants.
/// Why: the row-to-pixel stride and reveal extents come from a single source of truth.
use crate::constants::{PANE_GAP, PANE_HEIGHT, PANE_WIDTH};
/// What: imports the strip's shared inner state.
/// Why: scrolling reads the model, the outer scroller, the columns, and the widget map.
use crate::strip::StripInner;
/// What: imports the pane identity type.
/// Why: the reveal targets a pane by id.
use crate::types::PaneId;

/// What: how many timed passes to retry revealing a spawned pane before giving up.
/// Why: scroll bounds settle a layout pass after content changes; the retry bounds itself so it
///      always terminates even if the pane can never fully fit.
const MAX_REVEAL_ATTEMPTS: u32 = 20;

/// What: milliseconds between reveal retries.
/// Why: a real delay yields to the frame clock and layout between attempts so the scroll bounds
///      actually update; an idle-only retry can spin through every attempt before layout runs.
const REVEAL_INTERVAL_MS: u64 = 8;

/// What: milliseconds of scroll quiet before the columns snap to whole-pane positions.
/// Why: snapping mid-scroll would fight the gesture; a short debounce snaps only once the user
///      stops, so few panes end up partially clipped and a live gesture is never disturbed.
const SNAP_DELAY_MS: u64 = 120;

/// What: the vertical pixel offset of `row` within a column's canvas.
/// Why: rows tile down each column at a fixed stride shared by every column, so equal offsets align.
pub(crate) fn row_y(row: usize) -> f64 {
    row as f64 * f64::from(PANE_HEIGHT + PANE_GAP)
}

/// What: scroll pane `id` into view: its column horizontally in the outer scroller, and its row
///       vertically in that column, retried until fully visible, then move focus there.
/// Why: a newly added column and its content settle a layout pass after reconcile, so a single
///      attempt clamps against stale bounds; a timed retry lets layout run in between.
pub(crate) fn scroll_to_pane(inner: &Rc<StripInner>, id: PaneId) {
    let Some((column, row)) = inner
        .state
        .borrow()
        .pane(id)
        .map(|pane| (pane.column, pane.row))
    else {
        return;
    };
    let outer_h = inner.outer.hadjustment();
    let column_x = column as f64 * f64::from(PANE_WIDTH + PANE_GAP);
    let column_view = inner
        .columns
        .borrow()
        .get(column)
        .map(|view| view.scroller.clone());
    let pane = inner.widgets.borrow().get(&id).cloned();
    let attempts = Cell::new(0u32);
    glib::timeout_add_local(
        std::time::Duration::from_millis(REVEAL_INTERVAL_MS),
        move || {
            let horizontal = reveal(&outer_h, column_x, f64::from(PANE_WIDTH));
            let vertical = column_view
                .as_ref()
                .is_none_or(|view| reveal(&view.vadjustment(), row_y(row), f64::from(PANE_HEIGHT)));
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

/// What: pixel slack per adjacent column pair: how far the child column may scroll below the parent
///       column before a parent would leave its children block.
/// Why: the tether clamps the relative offset to `[0, slack]`. Slack is the tightest (minimum) over
///      the parents in the left column, each allowing `(deepest child row - parent row)` of float; a
///      pair with no constraining parent stays unbounded (`INFINITY`).
fn column_slacks(inner: &Rc<StripInner>) -> Vec<f64> {
    let state = inner.state.borrow();
    let pairs = state.column_count().saturating_sub(1);
    let mut slacks = vec![f64::INFINITY; pairs];
    for parent in state.panes() {
        let deepest = state
            .panes()
            .filter(|pane| pane.parent == Some(parent.id))
            .map(|pane| pane.row)
            .max();
        if let Some(deepest_row) = deepest
            && parent.column < slacks.len()
        {
            let slack = row_y(deepest_row) - row_y(parent.row);
            slacks[parent.column] = slacks[parent.column].min(slack);
        }
    }
    slacks
}

/// What: hold the parent-within-children tether after column `initiator` scrolled, coupling the
///       columns on either side so no parent leaves its children block.
/// Why: columns scroll independently within slack; at the tether boundary they move together. The
///      initiator keeps its own value while neighbors clamp outward (right: the child column stays
///      in `[parent, parent + slack]`; left: the parent column stays in `[child - slack, child]`),
///      guarded against the re-entrant `value-changed` the clamps themselves fire.
pub(crate) fn enforce_tether(inner: &Rc<StripInner>, initiator: usize) {
    if inner.tethering.replace(true) {
        return;
    }
    let slacks = column_slacks(inner);
    let columns = inner.columns.borrow();
    let pairs = slacks.len().min(columns.len().saturating_sub(1));
    for pair in initiator..pairs {
        let base = columns[pair].scroller.vadjustment().value();
        let child = columns[pair + 1].scroller.vadjustment();
        let clamped = child.value().clamp(base, base + slacks[pair]);
        if (clamped - child.value()).abs() > f64::EPSILON {
            child.set_value(clamped);
        }
    }
    for pair in (0..initiator.min(pairs)).rev() {
        let base = columns[pair + 1].scroller.vadjustment().value();
        let parent = columns[pair].scroller.vadjustment();
        let clamped = parent.value().clamp(base - slacks[pair], base);
        if (clamped - parent.value()).abs() > f64::EPSILON {
            parent.set_value(clamped);
        }
    }
    tracing::debug!(
        initiator,
        offsets = ?columns
            .iter()
            .map(|view| view.scroller.vadjustment().value() as i64)
            .collect::<Vec<_>>(),
        "tether pass"
    );
    inner.tethering.set(false);
    schedule_snap(inner);
}

/// What: after a debounce, snap every column's scroll to whole-pane positions.
/// Why: bumps a scroll epoch and, if no further scroll arrives within the delay, snaps once, so a
///      pane rarely lands partially clipped while a live gesture is never disturbed.
fn schedule_snap(inner: &Rc<StripInner>) {
    let epoch = inner.scroll_epoch.get().wrapping_add(1);
    inner.scroll_epoch.set(epoch);
    let weak = Rc::downgrade(inner);
    glib::timeout_add_local_once(std::time::Duration::from_millis(SNAP_DELAY_MS), move || {
        if let Some(inner) = weak.upgrade()
            && inner.scroll_epoch.get() == epoch
        {
            snap_columns(&inner);
        }
    });
}

/// What: snap each column's vertical offset to its own nearest pane-height boundary.
/// Why: aligning pane tops to the viewport top tiles whole panes from the top so only the bottom
///      pane per column can be partial. Each column snaps independently and keeps its own scroll
///      position (rounded), which preserves cross-column alignment (all panes sit at stride
///      multiples) without re-anchoring on the left column, so a down-scrolled column is never
///      dragged back to the top. Guarded so the fired `value-changed` does not recurse.
fn snap_columns(inner: &Rc<StripInner>) {
    if inner.tethering.replace(true) {
        return;
    }
    let stride = f64::from(PANE_HEIGHT + PANE_GAP);
    for view in inner.columns.borrow().iter() {
        let adj = view.scroller.vadjustment();
        let max = (adj.upper() - adj.page_size()).max(0.0);
        let snapped = ((adj.value() / stride).round() * stride).clamp(0.0, max);
        if (snapped - adj.value()).abs() > f64::EPSILON {
            tracing::debug!(
                before = adj.value() as i64,
                after = snapped as i64,
                max = max as i64,
                page = adj.page_size() as i64,
                upper = adj.upper() as i64,
                "snap column"
            );
            adj.set_value(snapped);
        }
    }
    inner.tethering.set(false);
}

/// What: scroll `adj` so `[start, start + extent)` is fully within the visible page; return whether
///       it now is.
/// Why: the caller retries until this returns true, because scroll bounds update a layout pass after
///      content changes, and a stale `upper` clamps the value short of the target.
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
