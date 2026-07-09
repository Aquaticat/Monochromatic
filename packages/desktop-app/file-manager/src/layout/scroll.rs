//! Scroll, reveal, tether, and snap implementation for `StripLayout`.
//!
//! This child module keeps the public layout-interface file small while staying inside the same
//! `layout` module privacy boundary. Callers still see one deep `StripLayout` interface.

/// What: imports the single-slot cell.
/// Why: reveal retries count attempts in a `Cell` captured by the timer closure.
use std::cell::Cell;
/// What: imports the reference-counted pointer.
/// Why: tether and snap timers hold weak references to `StripLayout`.
use std::rc::Rc;

/// What: imports GTK adjustment and focus extension traits.
/// Why: reveal, tether, and snap read/write scroll adjustments and focus pane widgets.
use gtk4::prelude::*;
/// What: imports the scroll-adjustment type and GLib timer module.
/// Why: reveal operates on `Adjustment`; retries and debounce use GLib timers.
use gtk4::{Adjustment, glib};

/// What: imports pane geometry constants.
/// Why: row offsets, reveal extents, and snap stride all share pane geometry.
use crate::constants::{PANE_GAP, PANE_HEIGHT, PANE_WIDTH};
/// What: imports stable pane identity.
/// Why: reveal targets a pane widget by id.
use crate::types::PaneId;

/// What: imports the parent module's layout type.
/// Why: this module extends `StripLayout` while retaining access to its private fields.
use super::StripLayout;

/// What: how many timed passes to retry revealing a spawned pane before giving up.
/// Why: scroll bounds settle a layout pass after content changes; the retry must terminate even if a
///      pane can never fully fit.
const MAX_REVEAL_ATTEMPTS: u32 = 20;

/// What: milliseconds between reveal retries.
/// Why: a real delay yields to the frame clock and layout between attempts so scroll bounds update.
const REVEAL_INTERVAL_MS: u64 = 8;

/// What: milliseconds of scroll quiet before the columns snap to whole-pane positions.
/// Why: snapping during a gesture fights the user; a debounce snaps after the gesture settles.
const SNAP_DELAY_MS: u64 = 120;

/// What: scroll-specific methods on the deep layout adapter.
/// Why: placement callers get reveal/tether/snap through `StripLayout` without touching GTK pieces.
impl StripLayout {
    /// What: reveal pane `id` horizontally and vertically, then focus it.
    /// Why: a spawn must bring the newly focused pane into view even though GTK updates scroll
    ///      bounds one layout pass after reconciliation.
    pub(crate) fn scroll_to_pane(&self, id: PaneId) {
        let Some(placement) = self
            .placements
            .borrow()
            .iter()
            .find(|placement| placement.id == id)
            .copied()
        else {
            return;
        };
        let outer_h = self.outer.hadjustment();
        let column_x = placement.column as f64 * f64::from(PANE_WIDTH + PANE_GAP);
        let column_view = self
            .columns
            .borrow()
            .get(placement.column)
            .map(|view| view.scroller.clone());
        let pane = self.widgets.borrow().get(&id).cloned();
        let attempts = Cell::new(0u32);
        glib::timeout_add_local(
            std::time::Duration::from_millis(REVEAL_INTERVAL_MS),
            move || {
                let horizontal = reveal(&outer_h, column_x, f64::from(PANE_WIDTH));
                let vertical = column_view.as_ref().is_none_or(|view| {
                    reveal(
                        &view.vadjustment(),
                        row_y(placement.row),
                        f64::from(PANE_HEIGHT),
                    )
                });
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

    /// What: hold the parent-within-children tether after column `initiator` scrolled.
    /// Why: neighbors clamp outward so relative offsets stay inside each parent-child slack range;
    ///      the initiator keeps its own offset while adjacent columns couple at the boundary.
    pub(super) fn enforce_tether(self: &Rc<Self>, initiator: usize) {
        if self.tethering.replace(true) {
            return;
        }
        let slacks = self.column_slacks();
        let columns = self.columns.borrow();
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
        self.tethering.set(false);
        self.refresh_child_lanes();
        self.schedule_snap();
    }

    /// What: compute pixel slack for each adjacent column pair.
    /// Why: slack is how far a child column may scroll below the parent before a parent would leave
    ///      its direct children block.
    fn column_slacks(&self) -> Vec<f64> {
        let placements = self.placements.borrow();
        let pairs = placements
            .iter()
            .map(|placement| placement.column + 1)
            .max()
            .unwrap_or(0)
            .saturating_sub(1);
        let mut slacks = vec![f64::INFINITY; pairs];
        for parent in placements.iter() {
            let deepest = placements
                .iter()
                .filter(|placement| placement.parent == Some(parent.id))
                .map(|placement| placement.row)
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

    /// What: schedule a quiet-period snap after the latest scroll event.
    /// Why: an epoch makes only the final timer after a burst perform the snap.
    fn schedule_snap(self: &Rc<Self>) {
        let epoch = self.scroll_epoch.get().wrapping_add(1);
        self.scroll_epoch.set(epoch);
        let weak = Rc::downgrade(self);
        glib::timeout_add_local_once(std::time::Duration::from_millis(SNAP_DELAY_MS), move || {
            if let Some(layout) = weak.upgrade()
                && layout.scroll_epoch.get() == epoch
            {
                layout.snap_columns();
            }
        });
    }

    /// What: snap each column's vertical offset to the nearest reachable pane-height boundary.
    /// Why: aligning pane tops to the viewport top is ideal, but a short scroll range's bottom can
    ///      be between snap rows, so bottom itself must be a candidate instead of rounding to top.
    fn snap_columns(&self) {
        if self.tethering.replace(true) {
            return;
        }
        let stride = f64::from(PANE_HEIGHT + PANE_GAP);
        for view in self.columns.borrow().iter() {
            let adj = view.scroller.vadjustment();
            let max = (adj.upper() - adj.page_size()).max(0.0);
            let snapped = nearest_snap(adj.value(), max, stride);
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
        self.tethering.set(false);
        self.refresh_child_lanes();
    }
}

/// What: choose the closest snap target after clamping both neighboring row boundaries to the
///       reachable scroll range.
/// Why: rounding first and clamping after maps a short range like `0..252` to `0` even when the user
///      reached the bottom; treating `max` as the clamped upper candidate preserves bottom scroll.
fn nearest_snap(value: f64, max: f64, stride: f64) -> f64 {
    let lower = ((value / stride).floor() * stride).clamp(0.0, max);
    let upper = ((value / stride).ceil() * stride).clamp(0.0, max);
    if (value - lower).abs() <= (upper - value).abs() {
        lower
    } else {
        upper
    }
}

/// What: vertical pixel offset of `row` within a column canvas.
/// Why: panes tile down each column at a fixed stride shared by every column.
pub(super) fn row_y(row: usize) -> f64 {
    row as f64 * f64::from(PANE_HEIGHT + PANE_GAP)
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
