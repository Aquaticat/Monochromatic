//! Pure regression tests for measured one-piece LED plate geometry.

/// Imports private implementation details from parent module.
use super::*;

/// Confirms plate waits until every control reports final geometry.
#[test]
fn incomplete_reports_do_not_build_plate() {
    let controls = vec![
        Some(ControlGeometry { x: 0.0, y: 0.0, width: 80.0, height: 60.0 }),
        None,
    ];
    assert_eq!(measured_rows(&controls), None);
}

/// Confirms callback order cannot change visual row grouping or content width.
#[test]
fn reports_group_by_measured_position() {
    let controls = vec![
        Some(ControlGeometry { x: 0.0, y: 52.0, width: 100.0, height: 60.0 }),
        Some(ControlGeometry { x: 0.0, y: 0.0, width: 80.0, height: 60.0 }),
        Some(ControlGeometry { x: 72.0, y: 0.0, width: 120.0, height: 60.0 }),
    ];
    assert_eq!(
        measured_rows(&controls),
        Some(vec![
            RowGeometry { y: 0.0, left: 0.0, width: 192.0, height: 60.0 },
            RowGeometry { y: 52.0, left: 0.0, width: 100.0, height: 60.0 },
        ]),
    );
}

/// Confirms one row uses source radius and exact content bounds.
#[test]
fn one_row_builds_one_closed_outline() {
    let plate = plate_geometry(&[RowGeometry { y: 0.0, left: 0.0, width: 392.0, height: 60.0 }])
        .expect("one row builds a plate");
    assert_eq!(plate.x, 0.0);
    assert_eq!(plate.width, 392.0);
    assert_eq!(plate.height, 60.0);
    assert!(plate.path.starts_with("M 17.000 0 H 375.000"));
    assert!(plate.path.ends_with("Z"));
}

/// Confirms a shorter second row forms one rounded inward step and shared height.
#[test]
fn shorter_second_row_builds_inward_step() {
    let plate = plate_geometry(&[
        RowGeometry { y: 0.0, left: 0.0, width: 954.0, height: 60.0 },
        RowGeometry { y: 52.0, left: 0.0, width: 515.0, height: 60.0 },
    ])
    .expect("two rows build one plate");
    assert_eq!(plate.width, 954.0);
    assert_eq!(plate.height, 112.0);
    assert!(plate.path.contains("H 517.000 Q 515.000 56.000 515.000 58.000"));
}

/// Confirms a wider second row forms one rounded outward step.
#[test]
fn wider_second_row_builds_outward_step() {
    let plate = plate_geometry(&[
        RowGeometry { y: 0.0, left: 0.0, width: 200.0, height: 60.0 },
        RowGeometry { y: 52.0, left: 0.0, width: 300.0, height: 60.0 },
    ])
    .expect("two rows build one plate");
    assert_eq!(plate.width, 300.0);
    assert!(plate.path.contains("V 54.000 Q 200.000 56.000 202.000 56.000"));
    assert!(plate.path.contains("H 283.000 Q 300.000 56.000 300.000 73.000"));
}

/// Confirms equal-width rows keep one continuous right edge without a step.
#[test]
fn equal_width_rows_keep_continuous_edge() {
    let plate = plate_geometry(&[
        RowGeometry { y: 0.0, left: 0.0, width: 200.0, height: 60.0 },
        RowGeometry { y: 52.0, left: 0.0, width: 200.0, height: 60.0 },
    ])
    .expect("two rows build one plate");
    assert!(plate.path.contains("V 56.000 V 95.000"));
}


/// Confirms right-aligned rows step on left edge while keeping right edge continuous.
#[test]
fn right_aligned_rows_build_left_edge_step() {
    let plate = plate_geometry(&[
        RowGeometry { y: 0.0, left: 0.0, width: 300.0, height: 60.0 },
        RowGeometry { y: 52.0, left: 100.0, width: 300.0, height: 60.0 },
    ])
    .expect("right-aligned rows build one plate");
    assert_eq!(plate.width, 300.0);
    assert!(plate.path.contains("V 58.000 Q 100.000 56.000 98.000 56.000 H 17.000 Q 0.000 56.000 0.000 39.000"));
}


/// Confirms nonzero row origins become explicit paint position and normalized path bounds.
#[test]
fn shifted_rows_normalize_path_bounds() {
    let plate = plate_geometry(&[RowGeometry { y: 12.0, left: 100.0, width: 300.0, height: 60.0 }])
        .expect("shifted row builds a plate");
    assert_eq!(plate.x, 100.0);
    assert_eq!(plate.width, 200.0);
    assert!(plate.path.starts_with("M 17.000 0 H 183.000"));
}

/// Confirms edge ownership comes from measured row membership rather than label prediction.
#[test]
fn completed_update_marks_measured_row_edges() {
    let update = completed_update(&[
        Some(ControlGeometry { x: 0.0, y: 0.0, width: 80.0, height: 60.0 }),
        Some(ControlGeometry { x: 72.0, y: 0.0, width: 120.0, height: 60.0 }),
        Some(ControlGeometry { x: 92.0, y: 52.0, width: 100.0, height: 60.0 }),
    ])
    .expect("complete reports build update");
    assert_eq!(update.starts, vec![true, false, true]);
    assert_eq!(update.ends, vec![false, true, true]);
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
        geometry: ControlGeometry { x: 0.0, y: 0.0, width: 80.0, height: 60.0 },
    }));
    let second_generation = state.begin(2);
    assert_ne!(first_generation, second_generation);
    assert!(!state.record(RecordOptions {
        generation: first_generation,
        index: 1,
        count: 2,
        geometry: ControlGeometry { x: 72.0, y: 0.0, width: 80.0, height: 60.0 },
    }));
    assert_eq!(state.controls, vec![None, None]);
}

/// Confirms empty generation has no controls from which stale plate can be rebuilt.
#[test]
fn empty_generation_clears_geometry_state() {
    let mut state = GeometryState::default();
    state.begin(1);
    state.begin(0);
    assert!(state.controls.is_empty());
    assert!(completed_update(&state.controls).is_none());
}
