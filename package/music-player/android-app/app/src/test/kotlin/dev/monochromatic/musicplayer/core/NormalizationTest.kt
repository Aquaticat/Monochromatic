// What:     `package dev.monochromatic.musicplayer.core` names the namespace this test file
//           lives under. It is the SAME package as the code under test (`Normalization.kt`), so this
//           file uses `normalizationGain`, `processSample`, and the constant `CEILING` by their short
//           names with no import. (Those declarations are `internal`, i.e. module-visible, and this
//           test is in the same module.) The package must mirror the directory path.
// Why:      Sharing the package and module lets the tests reach the `internal` normalization
//           functions and constants without importing them; test and main source sets merge into
//           one package at compile time.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — the file path IS the module; here it shares a namespace with the SUT.
// ```
package dev.monochromatic.musicplayer.core

// What:     `import kotlin.math.abs` imports the standard-library `abs` FUNCTION (absolute value)
//           from the `kotlin.math` package, so it can be called as `abs(x)`.
// Why:      The float-distance comparison helper below uses `abs`.
//
// In TS you'd write (pseudocode):
// ```ts
// // Use built-in Math.abs; no import needed in TS.
// ```
import kotlin.math.abs

// What:     `import org.junit.Assert.assertTrue` imports the static `assertTrue` function
//           (asserts a `Boolean` is `true`) from JUnit 4's `org.junit.Assert` class.
// Why:      Every assertion in this file routes through `assertTrue(approxEq(...))`.
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

// What:     `private const val HALF: Float = 1.0f / 2.0f` declares a file-private compile-time
//           constant for one-half. `const val` is inlined at compile time; `private` keeps it to this
//           test file (the production `HALF` that used to live in the core was removed with the Kotlin
//           scanner, and only these tests still need it). The `f` suffixes keep both literals `Float`.
// Why:      The repo bans bare fractional literals, so one-half is composed from the always-allowed
//           `-2..2` range; the gain assertions below use it as a below-ceiling peak and as the `1/2`
//           factor in `CEILING * HALF`.
//
// In TS you'd write (pseudocode):
// ```ts
// const HALF = 1 / 2;
// ```
private const val HALF: Float = 1.0f / 2.0f

// =============================================================================
// File summary
// =============================================================================
//
// Host-JVM unit tests for the attenuate-only normalization gain and the per-sample gain-then-clamp
// stage, ported from the desktop player's `truepeak_tests.rs` so the Kotlin port stays faithful to the
// Rust behaviour. The true-peak METER itself is no longer tested here: production measures peaks only
// in the native Rust crate, so its on-device coverage lives in
// `NativeBridgeTest.nativeTruePeakInterpolatesInterSamplePeaks` (which drives the real native meter
// through `nativeTruePeakSynthetic`). The former Kotlin scanner and its scanner-only tests were
// removed. The `CEILING` constant is referenced directly (single-sourced) so the expected values
// cannot drift from the implementation. The cases pin: the normalization gain curve (silence,
// below-ceiling, full-scale, loud) and the per-sample gain-then-clamp output stage.

// What:     `class NormalizationTest { ... }` declares a JUnit 4 test class the runner instantiates to
//           invoke each `@Test`-marked method. It also holds one private HELPER (`approxEq`) for
//           tolerant float comparison.
// Why:      Groups every normalization test plus the float-equality helper they share.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("Normalization", () => {
//   // ...helper + each @Test fun become a function / test(...) calls inside here...
// });
// ```
class NormalizationTest {
    // What:     `private fun approxEq(a: Float, b: Float): Boolean { ... }` declares a PRIVATE
    //           helper taking two `Float` parameters and returning `Boolean`, with a `{ ... }`
    //           BLOCK body (explicit `return`).
    // Why:      Distance-based float equality with the same `1e-4` tolerance the Rust tests use,
    //           because `==` on floats is fragile after the gain math accumulates rounding error.
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
        //           `assertTrue`. `HALF` is the file constant `0.5f` (a `Float`), referenced
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
        //           multiplication of the two constants (~0.891 * 0.5 ~ 0.4456). The condition
        //           checks the gain for a `2.0f` peak is within tolerance of that product.
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
}
