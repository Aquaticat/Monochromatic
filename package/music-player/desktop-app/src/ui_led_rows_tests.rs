//! Pure regression tests for measured LED cap row membership.

/// Imports private implementation details from parent module.
use super::*;

/// Confirms ownership waits until every control reports final geometry.
#[test]
fn incomplete_reports_do_not_classify_rows() {
    let controls = vec![Some(ControlGeometry { x: 0.0, y: 0.0, width: 80.0 }), None];
    assert_eq!(measured_rows(&controls), None);
}

/// Confirms callback order cannot change visual row grouping or extents.
#[test]
fn reports_group_by_measured_position() {
    let controls = vec![
        Some(ControlGeometry { x: 0.0, y: 52.0, width: 100.0 }),
        Some(ControlGeometry { x: 0.0, y: 0.0, width: 80.0 }),
        Some(ControlGeometry { x: 72.0, y: 0.0, width: 120.0 }),
    ];
    assert_eq!(
        measured_rows(&controls),
        Some(vec![
            RowGeometry { y: 0.0, left: 0.0, right: 192.0 },
            RowGeometry { y: 52.0, left: 0.0, right: 100.0 },
        ]),
    );
}

/// Confirms edge ownership comes from measured row membership rather than label prediction.
#[test]
fn completed_update_marks_measured_row_edges() {
    let update = completed_update(&[
        Some(ControlGeometry { x: 0.0, y: 0.0, width: 80.0 }),
        Some(ControlGeometry { x: 72.0, y: 0.0, width: 120.0 }),
        Some(ControlGeometry { x: 92.0, y: 52.0, width: 100.0 }),
    ])
    .expect("complete reports build row update");
    assert_eq!(update.starts, vec![true, false, true]);
    assert_eq!(update.ends, vec![false, true, true]);
}

/// Confirms physical edge ownership handles rows with nonzero origins.
#[test]
fn shifted_rows_keep_physical_edge_ownership() {
    let update = completed_update(&[
        Some(ControlGeometry { x: 100.0, y: 12.0, width: 80.0 }),
        Some(ControlGeometry { x: 172.0, y: 12.0, width: 120.0 }),
    ])
    .expect("shifted complete row builds update");
    assert_eq!(update.starts, vec![true, false]);
    assert_eq!(update.ends, vec![false, true]);
}

/// Confirms same-count layout reset rejects late reports from previous generation.
#[test]
fn stale_same_count_report_is_ignored() {
    let mut state = GeometryState::default();
    let first_generation = state.begin(2);
    assert!(state.record(RecordOptions {
        generation: first_generation,
        index: 0,
        count: 2,
        geometry: ControlGeometry { x: 0.0, y: 0.0, width: 80.0 },
    }));
    let second_generation = state.begin(2);
    assert_ne!(first_generation, second_generation);
    assert!(!state.record(RecordOptions {
        generation: first_generation,
        index: 1,
        count: 2,
        geometry: ControlGeometry { x: 72.0, y: 0.0, width: 80.0 },
    }));
    assert_eq!(state.controls, vec![None, None]);
}

/// Confirms empty generation has no controls or row ownership.
#[test]
fn empty_generation_clears_geometry_state() {
    let mut state = GeometryState::default();
    state.begin(1);
    state.begin(0);
    assert!(state.controls.is_empty());
    assert!(completed_update(&state.controls).is_none());
}
