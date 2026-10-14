//! Coverage and opacity controls exercise the subpixel clipping branches without font-dependent pixels.

/// Test the production pixel helpers directly.
use super::{coverage, ink};

/// Empty,
///  whole,
///  and fractional coverage remain bounded at a pixel edge.
#[test]
fn fractional_selection_coverage_is_bounded() {
    assert_eq!(coverage(0, &[]), 0.0);
    assert_eq!(coverage(0, &[(0.0, 1.0)]), 1.0);
    assert_eq!(coverage(0, &[(0.25, 2.0)]), 0.75);
    assert_eq!(coverage(0, &[(0.0, 0.25), (0.75, 1.0)]), 0.5);
    assert_eq!(coverage(2, &[(0.0, 1.0)]), 0.0);
}

/// Blending uses alpha-weighted color rather than introducing transparent-color fringes.
#[test]
fn selection_edge_respects_foreground_opacity() {
    assert_eq!(
        ink([255, 0, 0, 200], [0, 255, 0, 100], 0.5, 255),
        [170, 85, 0, 150]
    );
    assert_eq!(
        ink([255, 0, 0, 0], [0, 0, 255, 128], 0.5, 255),
        [0, 0, 255, 64]
    );
    assert_eq!(ink([255, 0, 0, 0], [0, 0, 255, 0], 0.5, 255), [0; 4]);
}

/// Unselected and fully selected masks retain exact original integer alpha behavior.
#[test]
fn complete_coverage_preserves_mask_rounding() {
    assert_eq!(
        ink([255, 0, 0, 255], [0, 255, 0, 255], 0.0, 127),
        [255, 0, 0, 127]
    );
    assert_eq!(
        ink([255, 0, 0, 255], [0, 255, 0, 255], 1.0, 127),
        [0, 255, 0, 127]
    );
}
