// What:     Unit test for the desktop `truepeak.rs`, pulled in by
//           `#[cfg(test)] #[path = "truepeak_tests.rs"] mod tests;` at the bottom of
//           `truepeak.rs`. Compiles only under `cargo nextest run` / `cargo test`; reaches
//           the module items via `use super::*` because this file is the `tests` CHILD of
//           truepeak.
// Why:      Keep the test beside the code without inflating `truepeak.rs` or its max-lines
//           budget (sibling `*_tests.rs` files are exempt from the linter).
//
// Only the end-to-end fixture decode test remains here. The gain math
// (`normalization_gain`) and the Catmull-Rom spline are now owned by the shared
// `truepeak-core` crate and tested there (its `gain_tests.rs` and `meter_tests.rs`), so the
// former desktop copies of those tests were removed rather than duplicated.

// What:     `use super::*;`. Bring the parent module's items into the test scope, including
//           its `pub(crate)` `measure_true_peak` and its imported `Path`.
// Why:      The test calls `measure_true_peak(Path::new(...))`.
use super::*;

// What:     `#[test]` measuring a committed fixture end-to-end.
// Why:      Prove the desktop decode loop plus the shared meter produce a sane true peak on
//           real audio (this is the desktop-specific coverage the shared crate cannot give,
//           because it does not own the desktop decoder).
#[test]
fn measure_true_peak_of_fixture_is_sane() {
    // What:     `let peak = measure_true_peak(Path::new("fixtures/tone.flac")).unwrap();`.
    //           Measure the committed 440 Hz tone. `Path::new(...)` borrows a path from the
    //           string literal; `.unwrap()` extracts the `Ok` value and fails the test on a
    //           decode error (`Err`).
    // Why:      A real decode through the desktop path into the shared meter.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const peak = measureTruePeak("fixtures/tone.flac"); // throws on decode error
    // ```
    let peak = measure_true_peak(Path::new("fixtures/tone.flac")).unwrap();
    // What:     `assert!(peak > 0.05 && peak < 0.2, ...)`. The committed tone sits at about
    //           -21 dBFS (verified with `ffmpeg volumedetect`: max_volume -21.1 dB, about
    //           0.088 linear); the measured true peak is just above the raw sample peak,
    //           exactly the inter-sample overshoot we look for.
    // Why:      Confirm the scan decodes end-to-end and reports the real level (not silence,
    //           not an absurd value).
    assert!(peak > 0.05 && peak < 0.2, "measured peak was {peak}");
}
