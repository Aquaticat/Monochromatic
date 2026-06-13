// What:     `package dev.monochromatic.musicplayer.core` names the namespace this test file
//           lives under. It is the SAME package as the code under test (`TruePeak.kt`), so this
//           file uses `normalizationGain`, `catmullRom`, `measureTruePeak`, `processSample`,
//           `maxInteriorAbs`, and the constants `CEILING`/`HALF` by their short names with no
//           import. (Those declarations are `internal`, i.e. module-visible, and this test is in
//           the same module.) The package must mirror the directory path.
// Why:      Sharing the package and module lets the tests reach the `internal` true-peak
//           functions and constants without importing them; test and main source sets merge into
//           one package at compile time.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — the file path IS the module; here it shares a namespace with the SUT.
// ```
package dev.monochromatic.musicplayer.core

// What:     `import kotlin.math.abs` imports the standard-library `abs` FUNCTION (absolute value)
//           from the `kotlin.math` package, so it can be called as `abs(x)`. Unlike the JUnit
//           imports below, this is a stdlib math function, not a test helper.
// Why:      The float-distance comparisons and signal-magnitude calculations below use `abs`.
//
// In TS you'd write (pseudocode):
// ```ts
// // Use built-in Math.abs; no import needed in TS.
// ```
import kotlin.math.abs

// What:     `import org.junit.Assert.assertTrue` imports the static `assertTrue` function
//           (asserts a `Boolean` is `true`) from JUnit 4's `org.junit.Assert` class.
// Why:      Every assertion in this file routes through `assertTrue` (often
//           `assertTrue(approxEq(...))` or the two-arg message form).
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertTrue } from "@junit/assert";
// ```
import org.junit.Assert.assertTrue

// What:     `import org.junit.Test` imports the `Test` ANNOTATION class (a type) used as the
//           `@Test` marker on each test method; the runner runs every method tagged with it.
// Why:      Without it we could not write `@Test`, and the runner would find no tests.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from "vitest"; // each @Test method becomes a test("...", () => {...})
// ```
import org.junit.Test

// =============================================================================
// File summary (folds in the old class KDoc's domain content)
// =============================================================================
//
// Host-JVM unit tests for the true-peak meter and its normalisation gain, ported from the
// desktop player's `truepeak_tests.rs` so the Kotlin port stays faithful to the Rust behaviour.
// The four normalisation assertions and the two Catmull-Rom assertions become one focused test
// each (six in total); the Rust fixture test, which decoded a committed FLAC, is adapted to a
// SYNTHETIC in-memory signal because no FLAC decoder exists in this pure-logic core (see
// `meterReportsInterSamplePeak`). The `CEILING` and `HALF` constants are referenced directly
// (single-sourced, as the Rust test did via `use super::*`) so the expected values cannot drift
// from the implementation. The cases pin: the normalisation gain curve (silence, below-ceiling,
// full-scale, loud), Catmull-Rom passing through its segment endpoints, the meter reporting an
// inter-sample peak at least the raw peak, the per-sample gain-then-clamp stage, chunk-boundary
// independence of the measured peak, and the optimised `maxInteriorAbs` matching the `catmullRom`
// reference.

// What:     `class TruePeakTest { ... }` declares a JUnit 4 test class the runner instantiates to
//           invoke each `@Test`-marked method. It also holds one private HELPER (`approxEq`) for
//           tolerant float comparison.
// Why:      Groups every true-peak test plus the float-equality helper they share.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("TruePeak", () => {
//   // ...helper + each @Test fun become a function / test(...) calls inside here...
// });
// ```
class TruePeakTest {
    // What:     `private fun approxEq(a: Float, b: Float): Boolean { ... }` declares a PRIVATE
    //           helper taking two `Float` parameters and returning `Boolean`, with a `{ ... }`
    //           BLOCK body (explicit `return`).
    // Why:      Distance-based float equality with the same `1e-4` tolerance the Rust tests use,
    //           because `==` on floats is fragile after cubic (Catmull-Rom) math accumulates
    //           rounding error.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function approxEq(a: number, b: number): boolean {
    //   const tolerance = 1e-4;
    //   return Math.abs(a - b) < tolerance;
    // }
    // ```
    private fun approxEq(a: Float, b: Float): Boolean {
        // What:     `val tolerance = 1e-4f` declares a read-only local `tolerance`. The literal
        //           `1e-4f` uses SCIENTIFIC notation (`1e-4` = 0.0001) with the `f` suffix making
        //           it a `Float` (32-bit). Sibling: `1e-4` with NO suffix would be a `Double`
        //           (64-bit). The type is inferred as `Float`.
        // Why:      The comparison tolerance, matched to the Rust tests' `1e-4`.
        // Gotcha:   The `f` suffix matters: without it, `1e-4` is a `Double` and would not match a
        //           `Float` context without conversion.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const tolerance = 1e-4;
        // ```
        val tolerance = 1e-4f
        // What:     `return abs(a - b) < tolerance` is the explicit return. `a - b` is `Float`
        //           subtraction; `abs(...)` (the imported stdlib function) takes its magnitude; `<`
        //           compares that distance to `tolerance`, yielding the `Boolean` result.
        // Why:      Two floats count as equal when their absolute difference is under the tolerance.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return Math.abs(a - b) < tolerance;
        // ```
        return abs(a - b) < tolerance
    }

    // What:     `@Test` is an ANNOTATION (metadata, no code) marking the method below as a test
    //           the JUnit runner executes and reports.
    // Why:      Registers `normalizationGainLeavesSilenceUnchanged` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("normalization gain leaves silence unchanged", () => {
    // ```
    @Test
    // What:     `fun normalizationGainLeavesSilenceUnchanged() { ... }` declares a no-parameter
    //           test method returning `Unit` (Kotlin's "void"), block body.
    // Why:      Pins that the normalisation gain for a silent (zero-peak) signal is unity (1.0):
    //           silence is left unchanged, never boosted toward the ceiling.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertion below... *\/ }
    // ```
    fun normalizationGainLeavesSilenceUnchanged() {
        // What:     `assertTrue(approxEq(normalizationGain(0.0f), 1.0f))` is the single-arg
        //           `assertTrue(condition)`. The condition `approxEq(normalizationGain(0.0f), 1.0f)`
        //           computes the gain for a zero peak (`0.0f`, a `Float`) and checks it is within
        //           tolerance of `1.0f` (unity gain).
        // Why:      A silent signal gets unity gain (no change).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(approxEq(normalizationGain(0.0), 1.0)).toBe(true);
        // ```
        assertTrue(approxEq(normalizationGain(0.0f), 1.0f))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `normalizationGainDoesNotBoostBelowCeiling` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("normalization gain does not boost below ceiling", () => {
    // ```
    @Test
    // What:     `fun normalizationGainDoesNotBoostBelowCeiling() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that a peak BELOW the ceiling (here `HALF` = 0.5, under `CEILING` ~ 0.891) is
    //           NOT amplified: gain stays unity. Normalisation only attenuates loud signals, never
    //           boosts quiet ones.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertion below... *\/ }
    // ```
    fun normalizationGainDoesNotBoostBelowCeiling() {
        // What:     `assertTrue(approxEq(normalizationGain(HALF), 1.0f))` is the single-arg
        //           `assertTrue`. `HALF` is the module constant `0.5f` (a `Float`), referenced
        //           directly so the test cannot drift from the implementation. The condition checks
        //           the gain for a 0.5 peak is within tolerance of `1.0f`.
        // Why:      A below-ceiling peak gets unity gain (no boost).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(approxEq(normalizationGain(HALF), 1.0)).toBe(true);
        // ```
        assertTrue(approxEq(normalizationGain(HALF), 1.0f))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `normalizationGainAttenuatesFullScaleToCeiling` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("normalization gain attenuates full scale to ceiling", () => {
    // ```
    @Test
    // What:     `fun normalizationGainAttenuatesFullScaleToCeiling() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that a full-scale peak (1.0) is attenuated so that peak * gain == CEILING:
    //           since peak is 1.0, the gain itself equals `CEILING`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertion below... *\/ }
    // ```
    fun normalizationGainAttenuatesFullScaleToCeiling() {
        // What:     `assertTrue(approxEq(normalizationGain(1.0f), CEILING))` is the single-arg
        //           `assertTrue`. `CEILING` is the module constant `0.8912509f` (a `Float`),
        //           referenced directly. The condition checks the gain for a full-scale `1.0f`
        //           peak is within tolerance of `CEILING`.
        // Why:      For a peak of 1.0, the gain that brings it to the ceiling is `CEILING` itself.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(approxEq(normalizationGain(1.0), CEILING)).toBe(true);
        // ```
        assertTrue(approxEq(normalizationGain(1.0f), CEILING))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `normalizationGainAttenuatesLoudToHalfCeiling` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("normalization gain attenuates loud to half ceiling", () => {
    // ```
    @Test
    // What:     `fun normalizationGainAttenuatesLoudToHalfCeiling() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that for a peak of 2.0 (twice full scale), the gain is `CEILING / 2`, written
    //           here as `CEILING * HALF`: bringing the peak to the ceiling halves it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertion below... *\/ }
    // ```
    fun normalizationGainAttenuatesLoudToHalfCeiling() {
        // What:     `assertTrue(approxEq(normalizationGain(2.0f), CEILING * HALF))` is the
        //           single-arg `assertTrue`. The expected value `CEILING * HALF` is `Float`
        //           multiplication of the two module constants (~0.891 * 0.5 ~ 0.4456). The
        //           condition checks the gain for a `2.0f` peak is within tolerance of that
        //           product.
        // Why:      A peak of 2.0 needs gain `CEILING / 2.0` = `CEILING * HALF` to reach the
        //           ceiling.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(approxEq(normalizationGain(2.0), CEILING * HALF)).toBe(true);
        // ```
        assertTrue(approxEq(normalizationGain(2.0f), CEILING * HALF))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `catmullRomPassesThroughSegmentStartAtZero` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("catmull-rom passes through segment start at zero", () => {
    // ```
    @Test
    // What:     `fun catmullRomPassesThroughSegmentStartAtZero() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins the Catmull-Rom spline's interpolation property at t=0: the curve passes
    //           EXACTLY through its segment-start control point `p1`. This is the guarantee the
    //           oversampling relies on (the curve hits the real samples).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertion below... *\/ }
    // ```
    fun catmullRomPassesThroughSegmentStartAtZero() {
        // What:     `val p0 = 0.0f` declares a read-only `Float` local control point. `0.0f` is a
        //           `Float` literal (the `f`; sibling `0.0` is a `Double`).
        // Why:      The point BEFORE the segment (Catmull-Rom uses four points p0..p3).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const p0 = 0.0;
        // ```
        val p0 = 0.0f
        // What:     `val p1 = 1.0f` declares a `Float` local, the SEGMENT-START control point.
        // Why:      The curve must pass through `p1` at t=0.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const p1 = 1.0;
        // ```
        val p1 = 1.0f
        // What:     `val p2 = -1.0f` declares a `Float` local, the SEGMENT-END control point.
        // Why:      The far end of the interpolated segment (used at t=1, not here).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const p2 = -1.0;
        // ```
        val p2 = -1.0f
        // What:     `val p3 = 0.5f` declares a `Float` local, the point AFTER the segment.
        // Why:      The fourth Catmull-Rom control point (shapes the tangent at p2).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const p3 = 0.5;
        // ```
        val p3 = 0.5f
        // What:     `assertTrue(approxEq(catmullRom(p0, p1, p2, p3, 0.0f), p1))` is the single-arg
        //           `assertTrue`. `catmullRom(p0, p1, p2, p3, 0.0f)` evaluates the cubic at
        //           t=`0.0f`; `approxEq(..., p1)` checks it is within tolerance of `p1`.
        // Why:      At t=0 the spline must hit the segment-start point `p1`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(approxEq(catmullRom(p0, p1, p2, p3, 0.0), p1)).toBe(true);
        // ```
        assertTrue(approxEq(catmullRom(p0, p1, p2, p3, 0.0f), p1))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `catmullRomPassesThroughSegmentEndAtOne` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("catmull-rom passes through segment end at one", () => {
    // ```
    @Test
    // What:     `fun catmullRomPassesThroughSegmentEndAtOne() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins the complementary property at t=1: the curve passes EXACTLY through its
    //           segment-end control point `p2`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertion below... *\/ }
    // ```
    fun catmullRomPassesThroughSegmentEndAtOne() {
        // What:     `val p0 = 0.0f` declares the pre-segment `Float` control point (`f` suffix).
        // Why:      Same four-point setup as the previous test.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const p0 = 0.0;
        // ```
        val p0 = 0.0f
        // What:     `val p1 = 1.0f` declares the segment-start `Float` control point.
        // Why:      Used at t=0 (not asserted here).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const p1 = 1.0;
        // ```
        val p1 = 1.0f
        // What:     `val p2 = -1.0f` declares the segment-end `Float` control point.
        // Why:      The curve must pass through `p2` at t=1.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const p2 = -1.0;
        // ```
        val p2 = -1.0f
        // What:     `val p3 = 0.5f` declares the post-segment `Float` control point.
        // Why:      The fourth control point shaping the tangent at p2.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const p3 = 0.5;
        // ```
        val p3 = 0.5f
        // What:     `assertTrue(approxEq(catmullRom(p0, p1, p2, p3, 1.0f), p2))` evaluates the cubic
        //           at t=`1.0f` and checks it is within tolerance of `p2`.
        // Why:      At t=1 the spline must hit the segment-end point `p2`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(approxEq(catmullRom(p0, p1, p2, p3, 1.0), p2)).toBe(true);
        // ```
        assertTrue(approxEq(catmullRom(p0, p1, p2, p3, 1.0f), p2))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `meterReportsInterSamplePeak` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("meter reports inter-sample peak", () => {
    // ```
    @Test
    // What:     `fun meterReportsInterSamplePeak() { ... }` declares a no-arg `Unit`-returning test
    //           method, block body.
    // Why:      Adapted from the Rust `measure_true_peak_of_fixture_is_sane` (which decoded a
    //           committed FLAC). With no FLAC decoder in this pure core, a SYNTHETIC mono signal
    //           with a sharp transient is fed through the meter; the meter must report a true peak
    //           AT LEAST the largest raw sample magnitude, because inter-sample interpolation can
    //           only OVERSHOOT, never undershoot, the stored peak. Pins the streaming scan
    //           (feed/push plus Catmull-Rom oversampling) end-to-end.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun meterReportsInterSamplePeak() {
        // What:     `val signal = floatArrayOf(0.0f, 0.0f, 0.9f, -0.9f, 0.9f, -0.9f, 0.0f, 0.0f)`
        //           declares a read-only local `signal`. `floatArrayOf(...)` is a factory building
        //           a PRIMITIVE `FloatArray` (a packed array of 32-bit floats). Sibling:
        //           `arrayOf<Float>(...)` builds a BOXED `Array<Float>` (each element a boxed
        //           object). `FloatArray` is chosen to match the meter's `Sequence<FloatArray>`
        //           input and avoid boxing.
        // Why:      A synthetic mono signal with a sharp alternating transient (the `0.9, -0.9`
        //           runs) whose inter-sample peak should exceed the raw 0.9.
        // Gotcha:   `floatArrayOf` is a PRIMITIVE array (no boxing), distinct from `arrayOf` which
        //           boxes; for a TS reader that distinction shows up as `Float32Array` vs `number[]`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const signal = new Float32Array([0.0, 0.0, 0.9, -0.9, 0.9, -0.9, 0.0, 0.0]);
        // ```
        val signal = floatArrayOf(0.0f, 0.0f, 0.9f, -0.9f, 0.9f, -0.9f, 0.0f, 0.0f)
        // What:     `val rawPeak = signal.maxOf { abs(it) }` declares a read-only `Float` local
        //           `rawPeak`. `.maxOf { ... }` runs the TRAILING LAMBDA over each element and
        //           returns the MAXIMUM result; `it` is the implicit single parameter (one `Float`
        //           sample); `abs(it)` is its magnitude. So `rawPeak` is the largest sample
        //           magnitude (0.9 here).
        // Why:      The raw (stored-sample) peak to compare the meter's inter-sample result against.
        // Gotcha:   `.maxOf { transform }` returns the max of the TRANSFORMED values, not the max
        //           element; here it is the max ABSOLUTE value, since the lambda applies `abs`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const rawPeak = Math.max(...Array.from(signal, (x) => Math.abs(x)));
        // ```
        val rawPeak = signal.maxOf { abs(it) }
        // What:     `val measured = measureTruePeak(channels = 1, chunks = sequenceOf(signal))`
        //           declares a read-only `Float` local `measured`, calling the meter with NAMED
        //           ARGUMENTS:
        //           - `channels = 1` — one (mono) channel (an `Int`).
        //           - `chunks = sequenceOf(signal)` — `sequenceOf(...)` builds a lazy `Sequence`
        //             (here a `Sequence<FloatArray>`) with the single `signal` chunk. Sibling
        //             factory: `listOf(...)` (an eager `List`). `Sequence` matches the meter's
        //             streaming `chunks: Sequence<FloatArray>` parameter.
        // Why:      Run the true-peak meter over the whole signal as one streamed chunk.
        // Gotcha:   `Sequence` is LAZY (evaluated on demand), unlike an eager `List`/array; the
        //           meter pulls chunks as it scans.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const measured = measureTruePeak({ channels: 1, chunks: [signal] });
        // ```
        val measured = measureTruePeak(channels = 1, chunks = sequenceOf(signal))
        // What:     `assertTrue("measured peak $measured should be at least the raw peak $rawPeak", measured >= rawPeak - 1e-4f)`
        //           is the TWO-argument `assertTrue(message, condition)`.
        //           - FIRST arg is the failure MESSAGE; `"...$measured...$rawPeak"` uses STRING
        //             INTERPOLATION (`$name` with no braces) to splice the two `Float` values in.
        //           - SECOND arg `measured >= rawPeak - 1e-4f` is the condition: the measured peak
        //             must be at least the raw peak, minus a `1e-4f` (`Float` scientific) tolerance.
        // Why:      Inter-sample interpolation can only overshoot, so the measured true peak must
        //           be >= the raw peak (within tolerance).
        // Gotcha:   Two traps. (1) Message-FIRST overload: `assertTrue(message, cond)` is backwards
        //           from `expect(cond)`. (2) Interpolation: Kotlin uses `$name` with NO braces,
        //           unlike TS's `${...}` inside backticks.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(measured >= rawPeak - 1e-4).toBe(true); // message arg has no expect() analogue
        // ```
        assertTrue(
            "measured peak $measured should be at least the raw peak $rawPeak",
            measured >= rawPeak - 1e-4f,
        )
        // What:     `assertTrue("measured peak $measured should be a sane, finite level", measured < 4.0f)`
        //           is the two-arg `assertTrue(message, condition)`. The message interpolates
        //           `$measured`; the condition `measured < 4.0f` checks the peak is below a sane
        //           bound (`4.0f`, a `Float`).
        // Why:      Guard against a runaway/NaN/infinite result: a real inter-sample peak for this
        //           signal stays well under 4.0.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(measured < 4.0).toBe(true);
        // ```
        assertTrue("measured peak $measured should be a sane, finite level", measured < 4.0f)
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `processSampleAppliesGainThenClamps` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("process sample applies gain then clamps", () => {
    // ```
    @Test
    // What:     `fun processSampleAppliesGainThenClamps() { ... }` declares a no-arg `Unit`-returning
    //           test method, block body.
    // Why:      Ported from the Rust `process_sample_applies_gain_then_clamps`: silence stays
    //           silence at any gain, unity gain is a passthrough below full scale, the gain
    //           MULTIPLIES, and a result outside `-1.0..1.0` is CLAMPED symmetrically to the
    //           nearest bound. Pins the per-sample gain-then-clamp output stage.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertions below... *\/ }
    // ```
    fun processSampleAppliesGainThenClamps() {
        // What:     `assertTrue(approxEq(processSample(0.0f, 1.0f), 0.0f))` is the single-arg
        //           `assertTrue`. `processSample(sample, gain)` applies the gain then clamps; here
        //           sample `0.0f` at gain `1.0f` gives `0.0f`. `approxEq(..., 0.0f)` checks it.
        // Why:      Silence times any gain is silence.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(approxEq(processSample(0.0, 1.0), 0.0)).toBe(true);
        // ```
        assertTrue(approxEq(processSample(0.0f, 1.0f), 0.0f))
        // What:     `assertTrue(approxEq(processSample(HALF, 1.0f), HALF))` checks sample `HALF`
        //           (0.5) at unity gain `1.0f` passes through as `HALF` (no clamp, since 0.5 is in
        //           range).
        // Why:      Unity gain below full scale is a passthrough.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(approxEq(processSample(HALF, 1.0), HALF)).toBe(true);
        // ```
        assertTrue(approxEq(processSample(HALF, 1.0f), HALF))
        // What:     `assertTrue(approxEq(processSample(0.8f, HALF), 0.4f))` checks sample `0.8f` at
        //           gain `HALF` (0.5) gives `0.4f` (0.8 * 0.5), within range so no clamp.
        // Why:      The gain multiplies the sample (0.8 * 0.5 = 0.4).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(approxEq(processSample(0.8, HALF), 0.4)).toBe(true);
        // ```
        assertTrue(approxEq(processSample(0.8f, HALF), 0.4f))
        // What:     `assertTrue(approxEq(processSample(1.5f, 1.0f), 1.0f))` checks sample `1.5f` at
        //           unity gain CLAMPS to the upper bound `1.0f` (1.5 is out of range).
        // Why:      A result above 1.0 is clamped down to 1.0.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(approxEq(processSample(1.5, 1.0), 1.0)).toBe(true);
        // ```
        assertTrue(approxEq(processSample(1.5f, 1.0f), 1.0f))
        // What:     `assertTrue(approxEq(processSample(-2.0f, 1.0f), -1.0f))` checks sample `-2.0f`
        //           at unity gain CLAMPS to the lower bound `-1.0f`.
        // Why:      A result below -1.0 is clamped up to -1.0 (symmetric clamp).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(approxEq(processSample(-2.0, 1.0), -1.0)).toBe(true);
        // ```
        assertTrue(approxEq(processSample(-2.0f, 1.0f), -1.0f))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `chunkBoundariesDoNotChangeTheMeasuredPeak` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("chunk boundaries do not change the measured peak", () => {
    // ```
    @Test
    // What:     `fun chunkBoundariesDoNotChangeTheMeasuredPeak() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that the measured peak does NOT depend on how the stream is chunked: feeding a
    //           signal whole vs split across several chunks yields the same peak. This pins the
    //           sliding window's persistence across `feed` calls (the in-place window advance must
    //           preserve state between chunks).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertion below... *\/ }
    // ```
    fun chunkBoundariesDoNotChangeTheMeasuredPeak() {
        // What:     `val signal = floatArrayOf(0.0f, 0.0f, 0.9f, -0.9f, 0.9f, -0.9f, 0.1f, 0.2f, -0.3f, 0.0f)`
        //           declares a read-only `FloatArray` local (primitive float array; sibling boxed
        //           `Array<Float>`) holding a ten-sample signal with a transient.
        // Why:      A signal long enough to split at awkward boundaries.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const signal = new Float32Array([0.0, 0.0, 0.9, -0.9, 0.9, -0.9, 0.1, 0.2, -0.3, 0.0]);
        // ```
        val signal = floatArrayOf(0.0f, 0.0f, 0.9f, -0.9f, 0.9f, -0.9f, 0.1f, 0.2f, -0.3f, 0.0f)
        // What:     `val whole = measureTruePeak(channels = 1, chunks = sequenceOf(signal))`
        //           measures the peak with the WHOLE signal as one chunk (named args; `sequenceOf`
        //           builds a one-element lazy `Sequence<FloatArray>`).
        // Why:      The reference measurement to compare the split one against.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const whole = measureTruePeak({ channels: 1, chunks: [signal] });
        // ```
        val whole = measureTruePeak(channels = 1, chunks = sequenceOf(signal))
        // What:     `val split = measureTruePeak(channels = 1, chunks = sequenceOf(signal.copyOfRange(0, 3), signal.copyOfRange(3, 4), signal.copyOfRange(4, 10)))`
        //           measures the peak with the SAME signal split into THREE chunks. `sequenceOf(...)`
        //           takes three `FloatArray` chunks; `signal.copyOfRange(from, to)` returns a NEW
        //           `FloatArray` slice from `from` (inclusive) to `to` (EXCLUSIVE), so the three
        //           ranges 0..3, 3..4, 4..10 partition the ten samples.
        // Why:      Re-measure with awkward chunk boundaries (including a single-sample chunk) to
        //           prove the result is boundary-independent.
        // Gotcha:   `copyOfRange` COPIES (the chunks are independent arrays) and the end index is
        //           EXCLUSIVE, exactly like TS `slice`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const split = measureTruePeak({
        //   channels: 1,
        //   chunks: [signal.slice(0, 3), signal.slice(3, 4), signal.slice(4, 10)],
        // });
        // ```
        val split = measureTruePeak(
            channels = 1,
            chunks = sequenceOf(
                signal.copyOfRange(0, 3),
                signal.copyOfRange(3, 4),
                signal.copyOfRange(4, 10),
            ),
        )
        // What:     `assertTrue("whole $whole and split $split should match", approxEq(whole, split))`
        //           is the two-arg `assertTrue(message, condition)`. The message interpolates
        //           `$whole` and `$split`; the condition `approxEq(whole, split)` checks the two
        //           measurements are within tolerance.
        // Why:      The whole-stream and split-stream peaks must match, proving chunking does not
        //           change the result.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(approxEq(whole, split)).toBe(true);
        // ```
        assertTrue("whole $whole and split $split should match", approxEq(whole, split))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `maxInteriorAbsMatchesCatmullRom` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("max interior abs matches catmull-rom", () => {
    // ```
    @Test
    // What:     `fun maxInteriorAbsMatchesCatmullRom() { ... }` declares a no-arg `Unit`-returning
    //           test method, block body.
    // Why:      Pins that the OPTIMISED `maxInteriorAbs` (hoisted window combinations, one pass)
    //           equals the reference it replaced: the `max` of `abs(catmullRom(...))` over the
    //           three interior positions 0.25, 0.5, 0.75. Several window shapes (transient, ramp,
    //           alternating, constant, mixed) exercise the cubic's full sign range, so the speed-up
    //           cannot silently change a measured true peak.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + loop below... *\/ }
    // ```
    fun maxInteriorAbsMatchesCatmullRom() {
        // What:     `val windows = arrayOf(floatArrayOf(...), floatArrayOf(...), ...)` declares a
        //           read-only local `windows`. `arrayOf(...)` builds a BOXED `Array<FloatArray>`
        //           whose elements are five four-sample `FloatArray` windows (each from
        //           `floatArrayOf`). Sibling: `listOf(...)` would build a `List<FloatArray>`.
        // Why:      A set of diverse four-point windows to test `maxInteriorAbs` against the
        //           reference across many shapes.
        // Gotcha:   `arrayOf` makes a boxed `Array<T>` (here `Array<FloatArray>`), whereas the
        //           inner `floatArrayOf` makes primitive float arrays; nesting them is "array of
        //           typed arrays".
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const windows = [
        //   new Float32Array([0.0, 0.9, -0.9, 0.0]),
        //   new Float32Array([0.1, 0.2, 0.3, 0.4]),
        //   new Float32Array([-1.0, 1.0, -1.0, 1.0]),
        //   new Float32Array([0.5, 0.5, 0.5, 0.5]),
        //   new Float32Array([0.3, -0.7, 0.8, -0.2]),
        // ];
        // ```
        val windows = arrayOf(
            floatArrayOf(0.0f, 0.9f, -0.9f, 0.0f),
            floatArrayOf(0.1f, 0.2f, 0.3f, 0.4f),
            floatArrayOf(-1.0f, 1.0f, -1.0f, 1.0f),
            floatArrayOf(0.5f, 0.5f, 0.5f, 0.5f),
            floatArrayOf(0.3f, -0.7f, 0.8f, -0.2f),
        )
        // What:     `for (w in windows) { ... }` is a FOR-EACH loop: `w` is bound to each element
        //           (one `FloatArray` window) in turn. This is iteration over a collection, the
        //           same as TS's `for...of`.
        // Why:      Run the reference-vs-optimised comparison for every window shape.
        // Gotcha:   Kotlin's `for (x in coll)` iterates VALUES (like TS `for...of`), NOT keys; do
        //           not read it as JS `for...in` (which iterates property keys).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (const w of windows) {
        //   // ...body below...
        // }
        // ```
        for (w in windows) {
            // What:     `val reference = maxOf(abs(catmullRom(w[0], w[1], w[2], w[3], 0.25f)), abs(catmullRom(...0.5f)), abs(catmullRom(...0.75f)))`
            //           declares a read-only `Float` local `reference`. `maxOf(a, b, c)` is a stdlib
            //           function returning the largest of its arguments. Each argument is
            //           `abs(catmullRom(w[0], w[1], w[2], w[3], t))` for t = 0.25, 0.5, 0.75:
            //           `w[i]` indexes the window's `FloatArray`; `catmullRom(...)` evaluates the
            //           cubic at that interior position; `abs(...)` takes its magnitude.
            // Why:      Compute the straightforward reference (max absolute cubic value at the three
            //           interior oversample positions) to compare the optimised helper against.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const reference = Math.max(
            //   Math.abs(catmullRom(w[0], w[1], w[2], w[3], 0.25)),
            //   Math.abs(catmullRom(w[0], w[1], w[2], w[3], 0.5)),
            //   Math.abs(catmullRom(w[0], w[1], w[2], w[3], 0.75)),
            // );
            // ```
            val reference = maxOf(
                abs(catmullRom(w[0], w[1], w[2], w[3], 0.25f)),
                abs(catmullRom(w[0], w[1], w[2], w[3], 0.5f)),
                abs(catmullRom(w[0], w[1], w[2], w[3], 0.75f)),
            )
            // What:     `val actual = maxInteriorAbs(w[0], w[1], w[2], w[3])` declares a read-only
            //           `Float` local `actual`, calling the OPTIMISED one-pass helper on the same
            //           four window samples (`w[0]..w[3]`).
            // Why:      The value under test, which must equal the `reference` above.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const actual = maxInteriorAbs(w[0], w[1], w[2], w[3]);
            // ```
            val actual = maxInteriorAbs(w[0], w[1], w[2], w[3])
            // What:     `assertTrue("maxInteriorAbs $actual should match the catmullRom reference $reference", approxEq(actual, reference))`
            //           is the two-arg `assertTrue(message, condition)`. The message interpolates
            //           `$actual` and `$reference`; the condition `approxEq(actual, reference)`
            //           checks the optimised result is within tolerance of the reference.
            // Why:      Prove the speed-up `maxInteriorAbs` matches the reference for THIS window
            //           shape (the assertion runs once per loop iteration).
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // expect(approxEq(actual, reference)).toBe(true);
            // ```
            assertTrue(
                "maxInteriorAbs $actual should match the catmullRom reference $reference",
                approxEq(actual, reference),
            )
        }
    }
}
