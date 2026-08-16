//! Derives LED cap end-corner ownership from Slint's actual wrapped rows.
//!
//! Slint owns text shaping and wrapping. Each cap reports its final rectangle through
//! `LedRowGeometry.report`; this module groups complete reports by measured position and
//! returns first/last membership. The full-width plate itself stays entirely in Slint.

/// What:     `RefCell` provides checked interior mutability on one UI thread.
/// Why:      Repeated geometry callbacks fill shared state before row classification.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const state = { controls: [] };
/// ```
use std::cell::RefCell;

/// What:     `Ordering` names comparison outcomes used while sorting measured controls.
/// Why:      Geometry reports can arrive in callback order rather than visual order.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Ordering = -1 | 0 | 1;
/// ```
use std::cmp::Ordering;

/// What:     `Rc` shares geometry state between registration scope and callbacks.
/// Why:      Slint callbacks run on one UI thread, so atomic ownership is unnecessary.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const state = new GeometryState();
/// ```
use std::rc::Rc;

/// What:     Generated window and LED row-global types cross the Rust-to-Slint seam.
/// Why:      Callback registration reads measured reports and writes row-edge models.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { AppWindow, LedRowGeometry } from "./generated/app.slint";
/// ```
use crate::{AppWindow, LedRowGeometry};

/// What:     Slint handle traits expose weak handles and model adapters.
/// Why:      Geometry callbacks must not keep the window alive.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { ComponentHandle, ModelRc, VecModel } from "slint";
/// ```
use slint::{ComponentHandle, ModelRc, VecModel};

/// Maximum coordinate drift treated as one visual row.
const ROW_EPSILON: f32 = 0.25;

/// One cap rectangle reported by Slint after flex layout.
#[derive(Clone, Copy, Debug, PartialEq)]
struct ControlGeometry {
    /// Horizontal origin relative to LED controls.
    x: f32,
    /// Vertical origin relative to LED controls.
    y: f32,
    /// Complete logical slot width including cap margins.
    width: f32,
}

/// Measured physical extent of one wrapped cap row.
#[derive(Clone, Copy, Debug, PartialEq)]
struct RowGeometry {
    /// Shared vertical origin for row members.
    y: f32,
    /// Minimum physical horizontal origin.
    left: f32,
    /// Maximum physical horizontal end.
    right: f32,
}

/// Complete per-cap edge ownership for one layout generation.
struct RowUpdate {
    /// Marks first physical cap on each visual row by page index.
    starts: Vec<bool>,
    /// Marks final physical cap on each visual row by page index.
    ends: Vec<bool>,
}

/// Accumulates asynchronous reports for current page-label set.
#[derive(Debug, Default)]
struct GeometryState {
    /// Monotonic generation issued for latest layout pass.
    generation: i32,
    /// Count attached to latest report generation.
    expected_count: usize,
    /// Latest geometry by page index.
    controls: Vec<Option<ControlGeometry>>,
}

/// Groups one geometry report before state mutation.
struct RecordOptions {
    /// Layout generation carried by reporting cap.
    generation: i32,
    /// Page index of reporting cap.
    index: usize,
    /// Current page-label count.
    count: usize,
    /// Final measured cap slot.
    geometry: ControlGeometry,
}

/// Mutates one callback generation while preserving page-index identity.
impl GeometryState {
    /// Starts one explicit layout generation and clears stale reports.
    fn begin(&mut self, count: usize) -> i32 {
        self.generation = self.generation.wrapping_add(1);
        self.expected_count = count;
        self.controls = vec![None; count];
        tracing::debug!(generation = self.generation, count, "beginning LED row geometry generation");
        self.generation
    }

    /// Records one report only when generation and count remain current.
    fn record(&mut self, options: RecordOptions) -> bool {
        let RecordOptions { generation, index, count, geometry } = options;
        if generation != self.generation || count != self.expected_count {
            tracing::trace!(
                generation,
                current_generation = self.generation,
                count,
                expected_count = self.expected_count,
                "ignoring stale LED row geometry report",
            );
            return false;
        }
        if let Some(slot) = self.controls.get_mut(index) {
            *slot = Some(geometry);
            return true;
        }
        tracing::warn!(index, count, "ignoring out-of-range LED row geometry report");
        false
    }
}

/// Groups completed reports into visual rows ordered top-to-bottom.
fn measured_rows(controls: &[Option<ControlGeometry>]) -> Option<Vec<RowGeometry>> {
    let mut measured = controls.iter().copied().collect::<Option<Vec<_>>>()?;
    if measured.is_empty() {
        return None;
    }
    measured.sort_by(|left, right| {
        left.y
            .partial_cmp(&right.y)
            .unwrap_or(Ordering::Equal)
            .then_with(|| left.x.partial_cmp(&right.x).unwrap_or(Ordering::Equal))
    });
    let rows = measured.into_iter().fold(Vec::<RowGeometry>::new(), |mut rows, control| {
        if let Some(row) = rows.last_mut()
            && (row.y - control.y).abs() <= ROW_EPSILON
        {
            row.left = row.left.min(control.x);
            row.right = row.right.max(control.x + control.width);
            return rows;
        }
        rows.push(RowGeometry {
            y: control.y,
            left: control.x,
            right: control.x + control.width,
        });
        rows
    });
    Some(rows)
}

/// Builds row-edge ownership only after every cap reports.
fn completed_update(controls: &[Option<ControlGeometry>]) -> Option<RowUpdate> {
    let rows = measured_rows(controls)?;
    let measured = controls.iter().copied().collect::<Option<Vec<_>>>()?;
    let starts = measured
        .iter()
        .map(|control| {
            rows.iter().any(|row| {
                (row.y - control.y).abs() <= ROW_EPSILON && (row.left - control.x).abs() <= ROW_EPSILON
            })
        })
        .collect();
    let ends = measured
        .iter()
        .map(|control| {
            rows.iter().any(|row| {
                (row.y - control.y).abs() <= ROW_EPSILON
                    && (row.right - control.x - control.width).abs() <= ROW_EPSILON
            })
        })
        .collect();
    Some(RowUpdate { starts, ends })
}

/// Writes complete row ownership or clears it for an empty generation.
fn update_global(global: &LedRowGeometry<'_>, update: Option<RowUpdate>) {
    if let Some(update) = update {
        tracing::debug!("updating measured LED row-edge ownership");
        global.set_starts(ModelRc::new(VecModel::from(update.starts)));
        global.set_ends(ModelRc::new(VecModel::from(update.ends)));
        return;
    }
    global.set_starts(ModelRc::default());
    global.set_ends(ModelRc::default());
}

/// Registers measured Slint row classification for LED cap corner ownership.
pub(crate) fn apply(app: &AppWindow) {
    tracing::debug!("registering LED row geometry adapter");
    let state = Rc::new(RefCell::new(GeometryState::default()));
    let begin_state = Rc::clone(&state);
    let begin_weak = app.as_weak();
    let global = app.global::<LedRowGeometry>();
    global.on_begin(move |count| {
        tracing::trace!(count, "received LED row generation start");
        let Ok(count) = usize::try_from(count) else {
            tracing::warn!(count, "ignoring negative LED row count");
            return begin_state.borrow().generation;
        };
        let generation = begin_state.borrow_mut().begin(count);
        if count == 0 && let Some(app) = begin_weak.upgrade() {
            update_global(&app.global::<LedRowGeometry>(), None);
        }
        generation
    });
    let report_weak = app.as_weak();
    global.on_report(move |generation, index, count, x, y, width| {
        tracing::trace!(generation, index, count, x, y, width, "received LED cap row geometry");
        let (Ok(index), Ok(count)) = (usize::try_from(index), usize::try_from(count)) else {
            tracing::warn!(index, count, "ignoring negative LED row index or count");
            return;
        };
        let Some(app) = report_weak.upgrade() else {
            return;
        };
        let update = {
            let mut state = state.borrow_mut();
            if !state.record(RecordOptions {
                generation,
                index,
                count,
                geometry: ControlGeometry { x, y, width },
            }) {
                return;
            }
            completed_update(&state.controls)
        };
        if update.is_some() {
            update_global(&app.global::<LedRowGeometry>(), update);
        }
    });
    global.set_adapter_ready(true);
}

/// Compiles pure row-membership regression tests beside implementation internals.
#[cfg(test)]
#[path = "ui_led_rows_tests.rs"]
mod tests;
