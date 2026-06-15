// What:     Unit tests for `truepeak.rs`, pulled in by
//           `#[cfg(test)] #[path = "truepeak_tests.rs"] mod tests;` at
//           the bottom of `truepeak.rs`. Compiles only under
//           `cargo nextest run` / `cargo test`; reaches the module items
//           (including private ones) via `use super::*` because this file is
//           the `tests` CHILD of truepeak.
// Why:      Keep the tests beside the code without inflating
//           `truepeak.rs` or its max-lines budget (sibling
//           `*_tests.rs` files are exempt from the linter).

// What:     `use super::*;`. Bring the module's items into the test scope.
// Why:      Tests call `normalization_gain`, `catmull_rom`, `measure_true_peak`.
use super::*;

// What:     `fn approx_eq(a: f32, b: f32) -> bool`. Distance-based float equality.
// Why:      Float math is not bit-exact; `==` on floats is fragile and clippy-flagged.
fn approx_eq(a: f32, b: f32) -> bool {
    // What:     `const TOLERANCE: f32 = 1e-4;`. Allowed difference; `1e-4` = 0.0001.
    // Why:      Loose enough for cubic-math rounding, tight enough to catch bugs.
    const TOLERANCE: f32 = 1e-4;
    // What:     `(a - b).abs() < TOLERANCE`. Tail expression -> return.
    // Why:      Compare distances, not exact bits.
    (a - b).abs() < TOLERANCE
}

// What:     `#[test]` test for the gain math.
// Why:      Pin attenuate-only behaviour at the boundaries.
#[test]
fn normalization_gain_attenuates_only() {
    // What:     silence -> no change.
    // Why:      Zero peak must not divide or boost.
    assert!(approx_eq(normalization_gain(0.0), 1.0));
    // What:     a peak below the ceiling stays at gain 1.0 (no boost).
    // Why:      Quiet tracks are left alone.
    assert!(approx_eq(normalization_gain(HALF), 1.0));
    // What:     a full-scale peak (1.0) is attenuated to exactly the ceiling.
    // Why:      Leaves the -1 dBTP headroom.
    assert!(approx_eq(normalization_gain(1.0), CEILING));
    // What:     a 2.0 peak is attenuated to half the ceiling.
    // Why:      gain = ceiling / peak for louder-than-ceiling material.
    assert!(approx_eq(normalization_gain(2.0), CEILING * HALF));
}

// What:     `#[test]` for the spline endpoints.
// Why:      Catmull-Rom must pass through p1 at t=0 and p2 at t=1.
#[test]
fn catmull_rom_passes_through_control_points() {
    // What:     `let (p0, p1, p2, p3) = (0.0_f32, 1.0, -1.0, 0.5);`. Four sample
    //           points; the `_f32` suffix pins the literal type.
    // Why:      Arbitrary distinct values to test the curve.
    let (p0, p1, p2, p3) = (0.0_f32, 1.0, -1.0, 0.5);
    // What:     at t=0 the curve equals p1.
    // Why:      Spline interpolation property.
    assert!(approx_eq(catmull_rom(p0, p1, p2, p3, 0.0), p1));
    // What:     at t=1 the curve equals p2.
    // Why:      Spline interpolation property.
    assert!(approx_eq(catmull_rom(p0, p1, p2, p3, 1.0), p2));
}

// What:     `#[test]` measuring a committed fixture end-to-end.
// Why:      Prove the streaming scan decodes and produces a sane true peak.
#[test]
fn measure_true_peak_of_fixture_is_sane() {
    // What:     `let peak = measure_true_peak(Path::new("fixtures/tone.flac")).unwrap();`.
    //           Measure the committed 440 Hz tone. `Path::new(...)` borrows a path
    //           from the string literal; `.unwrap()` fails the test on decode error.
    // Why:      A real decode through the production path.
    let peak = measure_true_peak(Path::new("fixtures/tone.flac")).unwrap();
    // What:     `assert!(peak > 0.05 && peak < 0.2, ...)`. The committed tone sits at
    //           about -21 dBFS (verified with `ffmpeg volumedetect`: max_volume
    //           -21.1 dB ~= 0.088 linear); the measured true peak is just above the
    //           raw sample peak, exactly the inter-sample overshoot we look for.
    // Why:      Confirm the streaming scan decodes end-to-end and reports the real
    //           level (not silence, not an absurd value).
    assert!(peak > 0.05 && peak < 0.2, "measured peak was {peak}");
}
