// File summary:
//
// Attenuate-only loudness-normalization gain, and the per-sample gain-then-clamp rule it pairs with.
// This is the Kotlin side of normalization; the true-peak MEASUREMENT that feeds it lives only in the
// native Rust crate (`rust/src/truepeak.rs`, reached through `NativeBridge.nativeMeasureTruePeak`). The
// old Kotlin true-peak scanner that used to share this file was removed: production measured peaks in
// Rust, so the Kotlin scanner was an unused second implementation. See
// `kotlin-rust-boundary.md` for the boundary rationale.
//
// `normalizationGain` turns a measured true peak into a single constant gain that brings a track down to
// a -1 dBTP ceiling (never up), so playback cannot overflow the converter. `processSample` mirrors the
// production Rust realtime callback's gain-then-clamp step (`(sample * gain).clamp(-1, 1)`) as a small
// JVM-side reference the unit tests pin.
//
// Numeric-type policy: every value is `Float` (Kotlin's 32-bit IEEE float, sibling `Double` the 64-bit
// one), matching the native engine's `f32` end to end so the gain math is bit-for-bit consistent across
// the JNI boundary.

// What:     `package dev.monochromatic.musicplayer.core` names the namespace (package) this file's
//           declarations live in. A package in Kotlin/Java is a dotted path that groups types and
//           functions and maps to a directory tree on disk. Every other file in this same package can
//           refer to these declarations without an import.
// Why:      We need the file to belong to the `core` package so the rest of the app (the audio engine,
//           the normalization cache) can find `normalizationGain` by the same fully-qualified name it
//           used when this lived in `TruePeak.kt`; the import in `RustEngine.kt` is unchanged.
//
// In TS you'd write (pseudocode):
// ```ts
// // (implicit) this module lives under core/ and others import from it by path
// ```
package dev.monochromatic.musicplayer.core

// What:     `import kotlin.math.min` pulls in the standalone two-argument `min` function (returns the
//           smaller of two values) from `kotlin.math`. Free function: `min(a, b)`.
// Why:      `normalizationGain` clamps the scale-to-ceiling gain so it never exceeds 1.0, which `min`
//           expresses directly.
//
// In TS you'd write (pseudocode):
// ```ts
// // no import needed; use Math.min(a, b)
// ```
import kotlin.math.min

// What:     `internal const val CEILING: Float = 0.8912509f` declares the true-peak target as a
//           compile-time constant. The value is 10^(-1/20), i.e. -1 dBTP expressed as a linear
//           amplitude. It is written as a precomputed literal (the `f` suffix makes it a `Float`, not
//           a `Double`) because raising 10 to a fractional power is not a compile-time operation, so
//           it cannot be computed in a `const val`. `internal` so the engine and the unit tests reach
//           it (siblings: `private` = this file only, `public` = other modules too).
// Why:      Normalization scales each track's measured true peak DOWN to this level; -1 dBTP is the
//           EBU R128 / ATSC A/85 broadcast ceiling that leaves headroom for the DAC's reconstruction.
//
// In TS you'd write (pseudocode):
// ```ts
// const CEILING = 10 ** (-1 / 20); // -1 dBTP, about 0.8912509
// ```
/**
 * Defines ceiling value for this music-player component; the TypeScript-oriented notes above explain its source
 * and use.
 */
internal const val CEILING: Float = 0.8912509f

// What:     `internal fun normalizationGain(truePeak: Float): Float { ... }` declares a top-level
//           function that turns a measured true peak (`truePeak: Float`, not `Double`) into the
//           constant gain (also `Float`) that brings the track down to CEILING, never amplifying.
//           `internal` for the engine and tests.
// Why:      Attenuate-only normalization prevents inter-sample overflow without ever boosting a quiet
//           track (boosting could produce a sudden loud, possibly harmful level and is outside the
//           clipping-prevention intent). A silent or invalid measurement leaves the signal unchanged,
//           which also avoids dividing by zero.
//
// In TS you'd write (pseudocode):
// ```ts
// function normalizationGain(truePeak: number): number { ... }
// ```
/**
 * Defines normalization gain behavior for this music-player component; the TypeScript-oriented notes above
 * explain its call shape and effects.
 */
internal fun normalizationGain(truePeak: Float): Float {
    // What:     `if (truePeak <= 0.0f) { return 1.0f }` returns a unity gain (`1.0f`, a `Float` literal,
    //           meaning "leave the sample unchanged") whenever the measured peak is zero or negative.
    // Why:      A silent or invalid measurement must not be scaled; returning 1.0 both leaves the
    //           signal untouched and avoids the divide-by-zero in the gain formula below.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (truePeak <= 0) return 1;
    // ```
    if (truePeak <= 0.0f) {
        return 1.0f
    }
    // What:     `return min(CEILING / truePeak, 1.0f)` returns the smaller of the scale-to-ceiling gain
    //           `CEILING / truePeak` and `1.0f`, using the free function `min`. The division yields the
    //           factor that would bring `truePeak` exactly down to CEILING; clamping with `min(..., 1)`
    //           ensures the gain never exceeds 1.0 (so a quieter-than-ceiling track is left as-is, never
    //           boosted).
    // Why:      Louder-than-ceiling tracks get attenuated to the ceiling; quieter tracks pass through
    //           unchanged at gain 1.0.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return Math.min(CEILING / truePeak, 1);
    // ```
    return min(CEILING / truePeak, 1.0f)
}

// What:     `internal fun processSample(sample: Float, gain: Float): Float = (sample * gain).coerceIn(
//           -1.0f, 1.0f)` declares a top-level function with an EXPRESSION BODY: instead of `{ ... }`
//           with a `return`, the whole function is `= <expression>`, and that expression's value is the
//           return value. It takes a raw PCM `sample` and a linear `gain` (both `Float`, not `Double`)
//           and returns a `Float`. `(sample * gain)` is plain float multiply; `.coerceIn(-1.0f, 1.0f)`
//           is Kotlin's standard-library clamp method (the analogue of Rust's `.clamp`): it forces the
//           value into the inclusive range -1.0..1.0, returning -1.0 below the floor and 1.0 above the
//           ceiling. The bounds are bare literals because the repo's named-constant rule exempts the
//           -2..2 range. `internal` for the audio engine and tests.
// Why:      Apply the combined linear gain to one PCM sample then hard-clamp it into the valid
//           -1.0..1.0 range, kept as one tested unit so the gain-then-clamp rule lives in a single
//           place for reference tests. The production Rust callback applies user volume and the
//           track's normalization gain together; this Kotlin helper preserves the same clamp rule for
//           the JVM-side test oracle.
//
// In TS you'd write (pseudocode):
// ```ts
// function processSample(sample: number, gain: number): number {
//   const scaled = sample * gain;
//   return Math.min(Math.max(scaled, -1), 1);
// }
// ```
/**
 * Defines process sample behavior for this music-player component; the TypeScript-oriented notes above explain
 * its call shape and effects.
 */
internal fun processSample(sample: Float, gain: Float): Float =
    (sample * gain).coerceIn(-1.0f, 1.0f)
