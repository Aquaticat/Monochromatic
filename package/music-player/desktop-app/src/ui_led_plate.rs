//! Builds one multi-line LED backplate from Slint's actual flex geometry.
//!
//! Slint owns text shaping and wrapping. Each cap reports its final rectangle through
//! `LedPlateGeometry.report`; this module groups those rectangles into rows and returns
//! one SVG path. The path is paint-only, so updating it cannot change flex geometry.

/// What:     `RefCell` provides checked interior mutability on one UI thread.
/// Why:      Repeated geometry callbacks fill one shared state vector before path generation.
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

/// What:     `Rc` shares geometry state between registration scope and callback.
/// Why:      Slint callbacks run on one UI thread, so atomic ownership is unnecessary.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const state = new GeometryState();
/// ```
use std::rc::Rc;

/// What:     Generated window and LED global types cross the Rust-to-Slint seam.
/// Why:      Callback registration reads reports and writes final path properties.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { AppWindow, LedPlateGeometry } from "./generated/app.slint";
/// ```
use crate::{AppWindow, LedPlateGeometry};

/// What:     Slint handle traits expose weak handles and global adapters.
/// Why:      Geometry callback must not keep window alive.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { ComponentHandle, Global, SharedString } from "slint";
/// ```
use slint::{ComponentHandle, ModelRc, SharedString, VecModel};

/// Loads pure stepped-outline generation behind adapter state.
#[path = "ui_led_plate_path.rs"]
mod path;

/// Imports normalized plate and row geometry from pure path module.
use path::{plate_geometry, PlateGeometry, RowGeometry};

/// Maximum coordinate drift treated as one visual row.
const ROW_EPSILON: f32 = 0.25;

/// One cap rectangle reported by Slint after flex layout.
#[derive(Clone, Copy, Debug, PartialEq)]
struct ControlGeometry {
    /// Horizontal origin relative to LED controls.
    x: f32,
    /// Vertical origin relative to LED controls.
    y: f32,
    /// Complete logical slot width including plate margins.
    width: f32,
    /// Complete logical slot height including plate margins.
    height: f32,
}

/// Complete paint and per-cap edge ownership for one layout generation.
struct PlateUpdate {
    /// Holds normalized one-piece plate.
    plate: PlateGeometry,
    /// Marks first cap on each visual row by page index.
    starts: Vec<bool>,
    /// Marks final cap on each visual row by page index.
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
        tracing::debug!(generation = self.generation, count, "beginning LED plate geometry generation");
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
                "ignoring stale LED geometry report",
            );
            return false;
        }
        if let Some(slot) = self.controls.get_mut(index) {
            *slot = Some(geometry);
            return true;
        }
        tracing::warn!(index, count, "ignoring out-of-range LED geometry report");
        false
    }
}

/// Groups completed reports into visual rows ordered top-to-bottom.
fn measured_rows(controls: &[Option<ControlGeometry>]) -> Option<Vec<RowGeometry>> {
    let mut measured = controls.iter().copied().collect::<Option<Vec<_>>>()?;
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
            row.width = row.width.max(control.x + control.width);
            row.height = row.height.max(control.height);
            return rows;
        }
        rows.push(RowGeometry {
            y: control.y,
            left: control.x,
            width: control.x + control.width,
            height: control.height,
        });
        rows
    });
    Some(rows)
}

/// Builds plate and row-edge ownership only after every cap reports.
fn completed_update(controls: &[Option<ControlGeometry>]) -> Option<PlateUpdate> {
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
                    && (row.width - control.x - control.width).abs() <= ROW_EPSILON
            })
        })
        .collect();
    Some(PlateUpdate { plate: plate_geometry(&rows)?, starts, ends })
}

/// Writes complete plate or clears stale paint until every cap has reported.
fn update_global(global: &LedPlateGeometry<'_>, update: Option<PlateUpdate>) {
    if let Some(update) = update {
        let plate = update.plate;
        tracing::debug!(x = plate.x, width = plate.width, height = plate.height, "updating one-piece LED plate path");
        global.set_path(SharedString::from(plate.path));
        global.set_x(plate.x);
        global.set_width(plate.width);
        global.set_height(plate.height);
        global.set_starts(ModelRc::new(VecModel::from(update.starts)));
        global.set_ends(ModelRc::new(VecModel::from(update.ends)));
        return;
    }
    global.set_path(SharedString::default());
    global.set_x(0.0);
    global.set_width(0.0);
    global.set_height(0.0);
    global.set_starts(ModelRc::default());
    global.set_ends(ModelRc::default());
}

/// Registers Slint geometry adapter for one-piece multi-line LED plate.
pub(crate) fn apply(app: &AppWindow) {
    tracing::debug!("registering LED plate geometry adapter");
    let state = Rc::new(RefCell::new(GeometryState::default()));
    let begin_state = Rc::clone(&state);
    let begin_weak = app.as_weak();
    let global = app.global::<LedPlateGeometry>();
    global.on_begin(move |count, width| {
        tracing::trace!(count, width, "received LED layout generation start");
        let Ok(count) = usize::try_from(count) else {
            tracing::warn!(count, "ignoring negative LED geometry count");
            return begin_state.borrow().generation;
        };
        let generation = begin_state.borrow_mut().begin(count);
        if let Some(app) = begin_weak.upgrade() {
            update_global(&app.global::<LedPlateGeometry>(), None);
        }
        generation
    });
    let report_weak = app.as_weak();
    global.on_report(move |generation, index, count, x, y, width, height| {
        tracing::trace!(generation, index, count, x, y, width, height, "received LED cap geometry");
        let (Ok(index), Ok(count)) = (usize::try_from(index), usize::try_from(count)) else {
            tracing::warn!(index, count, "ignoring negative LED geometry index or count");
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
                geometry: ControlGeometry { x, y, width, height },
            }) {
                return;
            }
            completed_update(&state.controls)
        };
        update_global(&app.global::<LedPlateGeometry>(), update);
    });
    global.set_adapter_ready(true);
}

/// Compiles pure geometry regression tests beside implementation internals.
#[cfg(test)]
#[path = "ui_led_plate_tests.rs"]
mod tests;
