// File summary (folded in from the old KDoc that floated above the constants):
//
// True-peak measurement and the attenuate-only normalization gain it feeds. This is a faithful port
// of the desktop player's `truepeak.rs`; pure logic only, with the platform audio decoder deferred
// (the decoder is injected into `measureTruePeak` as a lazy sequence of sample chunks instead of being
// opened here, see that function below).
//
// "True peak" (also called inter-sample peak) is the highest level the analog waveform reaches AFTER a
// DAC (digital-to-analog converter) reconstructs it BETWEEN the stored samples, so the true peak can
// sit above the largest stored sample. It is estimated by oversampling each channel about 4x with a
// cubic (Catmull-Rom) interpolation and taking the largest magnitude seen. `normalizationGain` turns a
// measured true peak into a single constant gain that brings the track down to a -1 dBTP ceiling
// (never up), so playback cannot overflow the converter.
//
// Numeric-type policy for the whole file: every value is `Float` (Kotlin's 32-bit IEEE float, the
// sibling being `Double`, the 64-bit one). The desktop Rust is `f32` end to end, and using `Float`
// here keeps the interpolation math sample-for-sample identical to the desktop. So whenever a block
// below says "Float (not Double)", the one-line reason is always this: match the desktop's f32 so the
// measured peak is bit-for-bit the same. Counts and indices use `Int` (32-bit signed; siblings `Long`
// 64-bit and `Short` 16-bit); the desktop used Rust's `usize` for those, but plain `Int` is the
// natural Kotlin choice for small array sizes and loop counters.

// What:     `package dev.monochromatic.musicplayer.core` names the namespace (package) this file's
//           declarations live in. A package in Kotlin/Java is a dotted path that groups types and
//           functions and maps to a directory tree on disk. Every other file in this same package can
//           refer to these declarations without an import.
// Why:      We need the file to belong to the `core` package so the rest of the app (the audio engine,
//           the normalization cache) can find `measureTruePeak`, `normalizationGain`, etc.
//
// In TS you'd write (pseudocode):
// ```ts
// // (implicit) this module lives under core/ and others import from it by path
// ```
package dev.monochromatic.musicplayer.core

// What:     `import kotlin.math.abs` pulls in the standalone `abs` function (absolute value) from the
//           Kotlin standard library's `kotlin.math` package. `abs` is a FREE/top-level function here,
//           not a method on a number, so you call it as `abs(x)`, not `x.abs()`.
// Why:      The peak scan needs the magnitude (unsigned size) of signed PCM samples and interpolated
//           values; `abs` gives that.
//
// In TS you'd write (pseudocode):
// ```ts
// // no import needed; use Math.abs(x)
// ```
import kotlin.math.abs

// What:     `import kotlin.math.max` pulls in the standalone two-argument `max` function (returns the
//           larger of two values) from `kotlin.math`. Also a free function: `max(a, b)`.
// Why:      The running peak is a max-fold over candidate magnitudes, so we need `max`.
//
// In TS you'd write (pseudocode):
// ```ts
// // no import needed; use Math.max(a, b)
// ```
import kotlin.math.max

// What:     `import kotlin.math.min` pulls in the standalone two-argument `min` function (returns the
//           smaller of two values) from `kotlin.math`. Free function: `min(a, b)`.
// Why:      Used to cap the per-channel filled-sample counter at WINDOW and to clamp the normalization
//           gain so it never exceeds 1.0.
//
// In TS you'd write (pseudocode):
// ```ts
// // no import needed; use Math.min(a, b)
// ```
import kotlin.math.min

// What:     `internal const val HALF: Float = 1.0f / 2.0f` declares a compile-time constant named
//           `HALF`. `const val` means the value is known at compile time and inlined wherever used
//           (stronger than a plain `val`, which is just a runtime read-only binding). `internal`
//           visibility means "visible everywhere inside this Gradle module" (siblings: `private` =
//           this file only, `public` = visible to other modules too); `internal` because the unit
//           tests in this module read it but it is not part of any public API. The `f` suffix on
//           `1.0f` / `2.0f` makes each literal a `Float` (32-bit) instead of the default `Double`
//           (64-bit); without `f` they would be `Double` and the division would widen.
// Why:      The repo bans bare fractional literals like `0.5`, so one-half is composed from the
//           always-allowed `-2..2` integer-ish range (1.0 and 2.0); HALF is reused as the Catmull-Rom
//           1/2 scale factor and as the basis for the sample-offset constants below.
//
// In TS you'd write (pseudocode):
// ```ts
// const HALF = 1 / 2;
// ```
/**
 * Defines half value for this music-player component; the TypeScript-oriented notes above explain its source and
 * use.
 */
internal const val HALF: Float = 1.0f / 2.0f

// What:     `private const val QUARTER: Float = HALF / 2.0f` declares the compile-time constant
//           one-quarter (0.25), built by halving HALF. `private` (sibling: `internal`/`public`) keeps
//           it to this file because nothing outside needs it. `Float` (not `Double`): match the f32
//           policy. The `f` on `2.0f` keeps the divisor a Float so the result stays Float.
// Why:      QUARTER is the first of three interior sample positions (1/4 of the way) between two
//           stored samples where an inter-sample peak might fall.
//
// In TS you'd write (pseudocode):
// ```ts
// const QUARTER = HALF / 2;
// ```
/**
 * Defines quarter value for this music-player component; the TypeScript-oriented notes above explain its source
 * and use.
 */
private const val QUARTER: Float = HALF / 2.0f

// What:     `private const val THREE_QUARTERS: Float = HALF + QUARTER` declares the compile-time
//           constant three-quarters (0.75), composed from HALF + QUARTER so it is still built only
//           from allowed pieces. `private`, `Float` (not `Double`): same reasons as above.
// Why:      THREE_QUARTERS is the third interior sample position (3/4 of the way) between two samples.
//
// In TS you'd write (pseudocode):
// ```ts
// const THREE_QUARTERS = HALF + QUARTER;
// ```
/**
 * Defines three quarters value for this music-player component; the TypeScript-oriented notes above explain its
 * source and use.
 */
private const val THREE_QUARTERS: Float = HALF + QUARTER

// What:     `internal const val CEILING: Float = 0.8912509f` declares the true-peak target as a
//           compile-time constant. The value is 10^(-1/20), i.e. -1 dBTP expressed as a linear
//           amplitude. It is written as a precomputed literal (the `f` suffix makes it a `Float`, not
//           a `Double`) because raising 10 to a fractional power is not a compile-time operation, so
//           it cannot be computed in a `const val`. `internal` because the tests read it.
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

// What:     `private const val WINDOW: Int = 4` declares the constant window length. `Int` is Kotlin's
//           32-bit signed integer (siblings: `Long` 64-bit, `Short` 16-bit); `Int` is the natural
//           choice for a tiny array length and the desktop used Rust's `usize` here. `private` because
//           only this file uses it.
// Why:      The cubic interpolation needs four consecutive samples (two on each side of the interval
//           it fills); Catmull-Rom evaluates the curve between the 2nd and 3rd of those four points.
//
// In TS you'd write (pseudocode):
// ```ts
// const WINDOW = 4;
// ```
/**
 * Defines window value for this music-player component; the TypeScript-oriented notes above explain its source
 * and use.
 */
private const val WINDOW: Int = 4

// What:     `private const val QUARTER_SQ: Float = QUARTER * QUARTER` precomputes QUARTER squared
//           (the t-squared term of the cubic when t = 1/4). `private`, `Float` (not `Double`) per the
//           file policy.
// Why:      `maxInteriorAbs` below evaluates the cubic at the three fixed interior positions; their
//           powers of t are compile-time constants, so squaring once here avoids redoing it per
//           sample (tens of millions of samples per track).
//
// In TS you'd write (pseudocode):
// ```ts
// const QUARTER_SQ = QUARTER * QUARTER;
// ```
/**
 * Defines quarter sq value for this music-player component; the TypeScript-oriented notes above explain its
 * source and use.
 */
private const val QUARTER_SQ: Float = QUARTER * QUARTER

// What:     `private const val QUARTER_CUBE: Float = QUARTER_SQ * QUARTER` precomputes QUARTER cubed
//           (the t-cubed term of the cubic at t = 1/4). `private`, `Float` (not `Double`).
// Why:      Same optimization: the t-cubed term at this fixed position is constant, so compute it once.
//
// In TS you'd write (pseudocode):
// ```ts
// const QUARTER_CUBE = QUARTER_SQ * QUARTER;
// ```
/**
 * Defines quarter cube value for this music-player component; the TypeScript-oriented notes above explain its
 * source and use.
 */
private const val QUARTER_CUBE: Float = QUARTER_SQ * QUARTER

// What:     `private const val HALF_SQ: Float = HALF * HALF` precomputes HALF squared (the t-squared
//           term of the cubic at the middle position t = 1/2). `private`, `Float` (not `Double`).
// Why:      Constant t-squared term at the middle interior position, computed once.
//
// In TS you'd write (pseudocode):
// ```ts
// const HALF_SQ = HALF * HALF;
// ```
/**
 * Defines half sq value for this music-player component; the TypeScript-oriented notes above explain its source
 * and use.
 */
private const val HALF_SQ: Float = HALF * HALF

// What:     `private const val HALF_CUBE: Float = HALF_SQ * HALF` precomputes HALF cubed (the t-cubed
//           term of the cubic at t = 1/2). `private`, `Float` (not `Double`).
// Why:      Constant t-cubed term at the middle interior position, computed once.
//
// In TS you'd write (pseudocode):
// ```ts
// const HALF_CUBE = HALF_SQ * HALF;
// ```
/**
 * Defines half cube value for this music-player component; the TypeScript-oriented notes above explain its
 * source and use.
 */
private const val HALF_CUBE: Float = HALF_SQ * HALF

// What:     `private const val THREE_QUARTERS_SQ: Float = THREE_QUARTERS * THREE_QUARTERS` precomputes
//           THREE_QUARTERS squared (the t-squared term of the cubic at t = 3/4). `private`, `Float`
//           (not `Double`).
// Why:      Constant t-squared term at the last interior position, computed once.
//
// In TS you'd write (pseudocode):
// ```ts
// const THREE_QUARTERS_SQ = THREE_QUARTERS * THREE_QUARTERS;
// ```
/**
 * Defines three quarters sq value for this music-player component; the TypeScript-oriented notes above explain
 * its source and use.
 */
private const val THREE_QUARTERS_SQ: Float = THREE_QUARTERS * THREE_QUARTERS

// What:     `private const val THREE_QUARTERS_CUBE: Float = THREE_QUARTERS_SQ * THREE_QUARTERS`
//           precomputes THREE_QUARTERS cubed (the t-cubed term of the cubic at t = 3/4). `private`,
//           `Float` (not `Double`).
// Why:      Constant t-cubed term at the last interior position, computed once.
//
// In TS you'd write (pseudocode):
// ```ts
// const THREE_QUARTERS_CUBE = THREE_QUARTERS_SQ * THREE_QUARTERS;
// ```
/**
 * Defines three quarters cube value for this music-player component; the TypeScript-oriented notes above explain
 * its source and use.
 */
private const val THREE_QUARTERS_CUBE: Float = THREE_QUARTERS_SQ * THREE_QUARTERS

// What:     `internal fun catmullRom(p0: Float, p1: Float, p2: Float, p3: Float, t: Float): Float { ... }`
//           declares a function named `catmullRom`. `fun` is Kotlin's function keyword. It takes five
//           `Float` parameters (the four sample values around a segment plus the position `t`) and
//           returns a `Float`. The parameters are positional, not a destructured object: the existing
//           Rust port is positional too, and this is a tiny math function whose argument order
//           (p0,p1,p2,p3,t) is itself the convention, so an object param would add noise. `internal`
//           so the unit tests in this module can call it directly.
// Why:      We need a function that, given four equally-spaced samples, estimates the waveform value at
//           a fractional position `t` on the segment BETWEEN p1 and p2, which is where inter-sample
//           peaks live. The literal coefficients (2, 3, 4, 5) inside are the standard Catmull-Rom
//           spline matrix entries; HALF is the 1/2 normalization.
//
// In TS you'd write (pseudocode):
// ```ts
// function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number { ... }
// ```
/**
 * Defines catmull rom behavior for this music-player component; the TypeScript-oriented notes above explain its
 * call shape and effects.
 */
internal fun catmullRom(p0: Float, p1: Float, p2: Float, p3: Float, t: Float): Float {
    // What:     `val t2: Float = t * t` binds a read-only local `t2` to t squared. `val` is an
    //           immutable binding (sibling: `var`, reassignable); `val` because t2 never changes. The
    //           explicit `: Float` annotation is redundant with inference but stated for clarity and
    //           to keep the type pinned to Float (not Double).
    // Why:      The cubic polynomial below uses t, t-squared, and t-cubed; compute t-squared once.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const t2 = t * t;
    // ```
    /**
     * Defines t2 value for this music-player component; the TypeScript-oriented notes above explain its source
     * and use.
     */
    val t2: Float = t * t
    // What:     `val t3: Float = t2 * t` binds the read-only local `t3` to t cubed (t-squared times t).
    //           `val` immutable, `Float` (not `Double`).
    // Why:      The cubic's last term needs t-cubed; compute it once from t2.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const t3 = t2 * t;
    // ```
    /**
     * Defines t3 value for this music-player component; the TypeScript-oriented notes above explain its source
     * and use.
     */
    val t3: Float = t2 * t
    // What:     `return HALF * ( ... )` is an explicit return of the Catmull-Rom basis evaluated for
    //           these four points. The whole multi-line parenthesized expression is the value: HALF
    //           (the 1/2 normalization) times the polynomial `2*p1 + (p2-p0)*t + (2*p0-5*p1+4*p2-p3)*t2
    //           + (3*p1-3*p2+p3-p0)*t3`. The literal coefficients 2, 3, 4, 5 are the standard spline
    //           matrix entries (Catmull and Rom, 1974); every operator here (`*`, `+`, `-`) is plain
    //           float arithmetic that reads the same in TS.
    // Why:      This closed form reproduces p1 at t=0 and p2 at t=1 with a smooth curve guided by the
    //           neighbours p0/p3, giving the estimated waveform value between two stored samples.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return 0.5 * (2*p1 + (p2-p0)*t + (2*p0-5*p1+4*p2-p3)*t2 + (3*p1-3*p2+p3-p0)*t3);
    // ```
    return HALF * (
        2.0f * p1 +
            (p2 - p0) * t +
            (2.0f * p0 - 5.0f * p1 + 4.0f * p2 - p3) * t2 +
            (3.0f * p1 - 3.0f * p2 + p3 - p0) * t3
        )
}

// What:     `internal fun maxInteriorAbs(p0: Float, p1: Float, p2: Float, p3: Float): Float { ... }`
//           declares a function that returns the largest absolute interpolated value across the three
//           interior oversampling positions (1/4, 1/2, 3/4) of one four-point window. Five... actually
//           four positional `Float` params (the window samples) and a `Float` return; positional for
//           the same reason as `catmullRom`. `internal` for the tests.
// Why:      This is the per-sample core of the inter-sample peak scan, and it is a hand-fused, faster
//           equivalent of calling `catmullRom` three times then taking the max of the absolute values.
//           It is algebraically equal to that (pinned by a host test) and uses the identical float
//           operations, so the measured peak is bit-for-bit the same. The speed-up is structural: the
//           three window-only combinations (the linear, t-squared, and t-cubed coefficient bundles)
//           do not depend on `t`, so they are computed once here and reused across the three positions
//           whose powers of t are compile-time constants; `catmullRom` recomputed them on every call.
//
// In TS you'd write (pseudocode):
// ```ts
// function maxInteriorAbs(p0: number, p1: number, p2: number, p3: number): number { ... }
// ```
/**
 * Defines max interior abs behavior for this music-player component; the TypeScript-oriented notes above explain
 * its call shape and effects.
 */
internal fun maxInteriorAbs(p0: Float, p1: Float, p2: Float, p3: Float): Float {
    // What:     `val twoP1: Float = 2.0f * p1` binds the read-only local `twoP1` to two times p1. `val`
    //           immutable, `Float` (not `Double`), `2.0f` is a Float literal.
    // Why:      `2*p1` is the constant (t-independent) term of the cubic; compute it once for reuse at
    //           all three positions.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const twoP1 = 2 * p1;
    // ```
    /**
     * Defines two p1 value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val twoP1: Float = 2.0f * p1
    // What:     `val a: Float = p2 - p0` binds the read-only local `a` to the linear coefficient
    //           `(p2 - p0)` of the cubic. `val` immutable, `Float` (not `Double`).
    // Why:      `a` multiplies `t` at each position; computing it once avoids redoing the subtraction.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const a = p2 - p0;
    // ```
    /**
     * Defines a value for this music-player component; the TypeScript-oriented notes above explain its source
     * and use.
     */
    val a: Float = p2 - p0
    // What:     `val b: Float = 2.0f * p0 - 5.0f * p1 + 4.0f * p2 - p3` binds the read-only local `b`
    //           to the t-squared coefficient of the cubic. `val` immutable, `Float` (not `Double`); the
    //           `f`-suffixed literals keep every term a Float.
    // Why:      `b` multiplies `t-squared` at each position; compute it once.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const b = 2*p0 - 5*p1 + 4*p2 - p3;
    // ```
    /**
     * Defines b value for this music-player component; the TypeScript-oriented notes above explain its source
     * and use.
     */
    val b: Float = 2.0f * p0 - 5.0f * p1 + 4.0f * p2 - p3
    // What:     `val c: Float = 3.0f * p1 - 3.0f * p2 + p3 - p0` binds the read-only local `c` to the
    //           t-cubed coefficient of the cubic. `val` immutable, `Float` (not `Double`).
    // Why:      `c` multiplies `t-cubed` at each position; compute it once.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const c = 3*p1 - 3*p2 + p3 - p0;
    // ```
    /**
     * Defines c value for this music-player component; the TypeScript-oriented notes above explain its source
     * and use.
     */
    val c: Float = 3.0f * p1 - 3.0f * p2 + p3 - p0
    // What:     `val atQuarter: Float = HALF * (twoP1 + a * QUARTER + b * QUARTER_SQ + c * QUARTER_CUBE)`
    //           evaluates the cubic at the t = 1/4 position using the precomputed coefficients and the
    //           precomputed powers of 1/4. `val` immutable, `Float` (not `Double`); HALF is the 1/2
    //           normalization, matching `catmullRom`.
    // Why:      This is the interpolated waveform value a quarter of the way between p1 and p2, one of
    //           the three inter-sample peak candidates.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const atQuarter = HALF * (twoP1 + a*QUARTER + b*QUARTER_SQ + c*QUARTER_CUBE);
    // ```
    /**
     * Defines at quarter value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val atQuarter: Float = HALF * (twoP1 + a * QUARTER + b * QUARTER_SQ + c * QUARTER_CUBE)
    // What:     `val atHalf: Float = HALF * (twoP1 + a * HALF + b * HALF_SQ + c * HALF_CUBE)` evaluates
    //           the cubic at the t = 1/2 (middle) position. `val` immutable, `Float` (not `Double`).
    // Why:      The interpolated value halfway between p1 and p2, the second peak candidate.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const atHalf = HALF * (twoP1 + a*HALF + b*HALF_SQ + c*HALF_CUBE);
    // ```
    /**
     * Defines at half value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val atHalf: Float = HALF * (twoP1 + a * HALF + b * HALF_SQ + c * HALF_CUBE)
    // What:     `val atThreeQuarters: Float = HALF * (twoP1 + a * THREE_QUARTERS + b * THREE_QUARTERS_SQ
    //           + c * THREE_QUARTERS_CUBE)` evaluates the cubic at the t = 3/4 position. The `=` and the
    //           expression are split across two physical lines (the value begins on the next line);
    //           Kotlin allows this because the line ends with `=`, which cannot terminate a statement,
    //           so the parser keeps reading. `val` immutable, `Float` (not `Double`).
    // Why:      The interpolated value three-quarters of the way between p1 and p2, the third candidate.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const atThreeQuarters = HALF * (twoP1 + a*THREE_QUARTERS + b*THREE_QUARTERS_SQ + c*THREE_QUARTERS_CUBE);
    // ```
    /**
     * Defines at three quarters value for this music-player component; the TypeScript-oriented notes above
     * explain its source and use.
     */
    val atThreeQuarters: Float =
        HALF * (twoP1 + a * THREE_QUARTERS + b * THREE_QUARTERS_SQ + c * THREE_QUARTERS_CUBE)
    // What:     `return max(abs(atQuarter), max(abs(atHalf), abs(atThreeQuarters)))` explicitly returns
    //           the largest of the three absolute interpolated values. `abs(...)` (free function from
    //           kotlin.math) takes the magnitude of each; the two nested `max(...)` calls (also free
    //           functions, each two-argument) fold the three magnitudes into the single biggest one.
    // Why:      The inter-sample peak contributed by this window is the largest magnitude among the
    //           three interior positions; we return it to the caller to fold into the running peak.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return Math.max(Math.abs(atQuarter), Math.max(Math.abs(atHalf), Math.abs(atThreeQuarters)));
    // ```
    return max(abs(atQuarter), max(abs(atHalf), abs(atThreeQuarters)))
}

// What:     `internal class TruePeakMeter(private val channels: Int) { ... }` declares a class named
//           `TruePeakMeter`. The part in parentheses `(private val channels: Int)` is Kotlin's PRIMARY
//           CONSTRUCTOR written inline on the class header: it declares one constructor parameter
//           `channels` and, because of `private val`, simultaneously stores it as a read-only `private`
//           property of the instance (no separate field/assignment needed). `channels` is the channel
//           count (interleave width); `Int` (not `Long`) because it is a small count and indexes the
//           per-channel arrays. `internal` so tests can construct it.
// Why:      We need a small stateful object that scans audio chunk by chunk in constant memory (a few
//           floats per channel), holding a 4-sample sliding window per channel, a per-channel
//           filled-count, and the running peak, instead of buffering the whole track.
//
// In TS you'd write (pseudocode):
// ```ts
// class TruePeakMeter {
//   constructor(private readonly channels: number) {}
//   // ...properties and methods...
// }
// ```
/**
 * Defines true peak meter type for this music-player component; the TypeScript-oriented notes above explain its
 * role.
 */
internal class TruePeakMeter(private val channels: Int) {
    // What:     `private val win: Array<FloatArray> = Array(channels) { FloatArray(WINDOW) }` declares
    //           a read-only property `win` whose type is `Array<FloatArray>` (an array whose elements
    //           are each a `FloatArray`). `FloatArray` is Kotlin's PRIMITIVE-SPECIALIZED float array
    //           (the sibling `Array<Float>` would box each element into a heap `Float` object;
    //           `FloatArray` stores raw 32-bit floats with no boxing, which matters because this is
    //           touched per sample). The right side `Array(channels) { FloatArray(WINDOW) }` is the
    //           `Array` constructor with a TRAILING LAMBDA `{ FloatArray(WINDOW) }`: in Kotlin, when a
    //           function's last argument is a lambda you may write it in braces after the parentheses.
    //           The lambda runs once per index 0..channels-1 and returns the element for that index,
    //           here a fresh `FloatArray(WINDOW)` (a 4-long float array, all zeros by default). So this
    //           builds `channels` separate zeroed 4-element windows. `val` because the outer array
    //           reference never changes (its contents do).
    // Why:      Cubic interpolation needs the latest four samples of each channel; one window per
    //           channel lets us interpolate per channel without buffering the track.
    // Gotcha:   `FloatArray` is a mutable, fixed-length, reference object: assigning it to another
    //           variable (see `val w` in `push`) aliases the SAME array, exactly like a TS array; it
    //           is NOT a value copy.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private win: number[][] = Array.from({ length: channels }, () => [0, 0, 0, 0]);
    // ```
    /**
     * Defines win value for this music-player component; the TypeScript-oriented notes above explain its source
     * and use.
     */
    private val win: Array<FloatArray> = Array(channels) { FloatArray(WINDOW) }

    // What:     `private val filled: IntArray = IntArray(channels)` declares a read-only property
    //           `filled` of type `IntArray` (the primitive-specialized int array; sibling
    //           `Array<Int>` would box each element). `IntArray(channels)` builds a `channels`-long
    //           int array initialized to all zeros.
    // Why:      Per channel we count how many real samples have arrived (capped at WINDOW) so we only
    //           start interpolating once a channel's window holds four real samples.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private filled: number[] = new Array(channels).fill(0);
    // ```
    /**
     * Defines filled value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private val filled: IntArray = IntArray(channels)

    // What:     `var peak: Float = 0.0f` followed on the next line by `private set` declares a MUTABLE
    //           property `peak` (`var`, the reassignable sibling of `val`) with a CUSTOM SETTER
    //           VISIBILITY: `private set` means the value can be READ from anywhere this class is
    //           visible but only WRITTEN from inside the class. `Float` (not `Double`), starting at the
    //           Float literal `0.0f`. (`peak` itself has no visibility keyword, so it defaults to
    //           `public`, hence "read anywhere, write only here".)
    // Why:      `peak` is the largest absolute sample/interpolated value seen so far, which becomes the
    //           measured true peak once the scan finishes; outside code (and tests) must read it but
    //           must not be able to corrupt it mid-scan.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private _peak = 0;
    // get peak(): number { return this._peak; }
    // // writes to this._peak only happen inside the class
    // ```
    /**
     * Defines peak value for this music-player component; the TypeScript-oriented notes above explain its source
     * and use.
     */
    var peak: Float = 0.0f
        private set

    // What:     `fun feed(chunk: FloatArray) { ... }` declares a method `feed` taking one `FloatArray`
    //           (a primitive float array, not boxed `Array<Float>`) and returning nothing (`Unit`, the
    //           Kotlin equivalent of `void`, inferred here). No visibility keyword means `public`.
    // Why:      Callers push one interleaved chunk of PCM samples at a time so the meter can update its
    //           running peak without ever holding the whole track.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // feed(chunk: number[]): void { ... }
    // ```
    /**
     * Defines feed behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    fun feed(chunk: FloatArray) {
        // What:     `chunk.forEachIndexed { i, s -> push(i % channels, s) }` calls the standard-library
        //           `forEachIndexed` on the array, passing a TRAILING LAMBDA whose parameters are
        //           `i` (the index, an `Int`) and `s` (the sample at that index, a `Float`), written
        //           in Kotlin's `{ params -> body }` lambda syntax. The lambda body routes each sample
        //           to its channel: `i % channels` is the channel index in an interleaved layout (the
        //           sample at flat index `i` belongs to channel `i % channels`), and `push` feeds that
        //           one sample to that one channel. `%` is plain integer remainder.
        // Why:      An interleaved chunk holds [ch0, ch1, ..., ch0, ch1, ...]; we must demultiplex each
        //           sample to the right channel window before interpolating.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // chunk.forEach((s, i) => {
        //   this.push(i % this.channels, s);
        // });
        // ```
        chunk.forEachIndexed { i, s ->
            push(i % channels, s)
        }
    }

    // What:     `private fun push(channel: Int, s: Float) { ... }` declares a `private` method `push`
    //           taking the destination `channel` (`Int`, not `Long`: a small index) and one sample `s`
    //           (`Float`, not `Double`). Returns nothing (`Unit`). `private` because only `feed` calls
    //           it.
    // Why:      This is the per-sample core: slide one sample into a channel's window, update the raw
    //           peak, and (once the window holds four real samples) sample the interpolated curve at
    //           three interior positions between the two middle window points to catch inter-sample
    //           peaks.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private push(channel: number, s: number): void { ... }
    // ```
    /**
     * Defines push behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    private fun push(channel: Int, s: Float) {
        // What:     `val w: FloatArray = win[channel]` binds the read-only local `w` to this channel's
        //           window. `val` pins the BINDING (you cannot reassign `w` to a different array), but
        //           the FloatArray it points at is still mutable through `w`. `win[channel]` indexes
        //           the outer array; the result is a REFERENCE to the very same FloatArray stored in
        //           `win`, not a copy. `FloatArray` (not boxed `Array<Float>`) to avoid per-sample
        //           boxing.
        // Why:      We want a short name for this channel's window so the next four lines can shift it
        //           and the interpolation can read it.
        // Gotcha:   This ALIASES the stored window (Kotlin arrays are reference types, exactly like TS
        //           arrays), so writing through `w` below mutates `win[channel]` itself. That is
        //           intentional here. (The desktop Rust twin copies the small `[f32; 4]` BY VALUE and
        //           builds a fresh shifted array; this Kotlin version deliberately does NOT, to avoid
        //           allocating a new array per PCM sample, tens of millions per track.)
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const w = this.win[channel]; // reference to the same array, mutating w mutates win[channel]
        // ```
        /**
         * Defines w value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val w: FloatArray = win[channel]
        // What:     `w[0] = w[1]` overwrites slot 0 with the value currently in slot 1. Plain indexed
        //           array element assignment, identical to TS.
        // Why:      First step of an in-place left shift that drops the oldest sample.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // w[0] = w[1];
        // ```
        w[0] = w[1]
        // What:     `w[1] = w[2]` copies slot 2 down into slot 1. Plain element assignment.
        // Why:      Continue the in-place left shift.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // w[1] = w[2];
        // ```
        w[1] = w[2]
        // What:     `w[2] = w[3]` copies slot 3 down into slot 2. Plain element assignment.
        // Why:      Continue the in-place left shift.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // w[2] = w[3];
        // ```
        w[2] = w[3]
        // What:     `w[3] = s` stores the brand-new sample `s` in the last slot. Plain element
        //           assignment.
        // Why:      Append the newest sample, completing the slide: the window now holds the latest four
        //           samples in order, oldest at index 0.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // w[3] = s;
        // ```
        w[3] = s
        // What:     `filled[channel] = min(filled[channel] + 1, WINDOW)` increments this channel's
        //           real-sample count by one but caps it at WINDOW using the free function `min`
        //           (returns the smaller of the two). `filled[channel] + 1` is plain integer add; the
        //           assignment writes the capped result back into the IntArray slot.
        // Why:      We need to know when a channel has accumulated four real samples (so interpolation
        //           is valid) without letting the counter grow unbounded.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.filled[channel] = Math.min(this.filled[channel] + 1, WINDOW);
        // ```
        filled[channel] = min(filled[channel] + 1, WINDOW)
        // What:     `var localPeak: Float = abs(s)` declares a MUTABLE local `localPeak` (`var`, the
        //           reassignable sibling of `val`, because the interior-point check below may raise it)
        //           initialized to the magnitude of this sample via the free function `abs`. `Float`
        //           (not `Double`).
        // Why:      The stored sample's own magnitude is itself a peak candidate; start from it and
        //           possibly raise it with interpolated values.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let localPeak = Math.abs(s);
        // ```
        /**
         * Defines local peak value for this music-player component; the TypeScript-oriented notes above explain
         * its source and use.
         */
        var localPeak: Float = abs(s)
        // What:     `if (filled[channel] == WINDOW) { ... }` runs its body only when this channel has
        //           accumulated exactly WINDOW (four) real samples. `==` on `Int`s is plain value
        //           comparison (Kotlin's `==` calls structural equality, but on primitive `Int` that is
        //           just numeric equality, same as TS `===`).
        // Why:      Cubic interpolation needs all four window points; skip it while the window is still
        //           partly the zeroed startup values.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.filled[channel] === WINDOW) { ... }
        // ```
        if (filled[channel] == WINDOW) {
            // What:     `localPeak = max(localPeak, maxInteriorAbs(w[0], w[1], w[2], w[3]))` reassigns
            //           `localPeak` to the larger of itself and the inter-sample peak of this window.
            //           `maxInteriorAbs(w[0], w[1], w[2], w[3])` passes the four window samples and
            //           returns the largest absolute interpolated magnitude at the three interior
            //           positions; the free function `max` keeps whichever is bigger. This is the one
            //           reassignment that justified `var localPeak` above.
            // Why:      The true inter-sample peak may exceed every stored sample, so fold the
            //           interpolated magnitude into this sample's local peak candidate.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // localPeak = Math.max(localPeak, maxInteriorAbs(w[0], w[1], w[2], w[3]));
            // ```
            localPeak = max(localPeak, maxInteriorAbs(w[0], w[1], w[2], w[3]))
        }
        // What:     `peak = max(peak, localPeak)` updates the running maximum `peak` property to the
        //           larger of its current value and this sample's local peak candidate, using the free
        //           function `max`. This is a write to the `private set` property, allowed because we
        //           are inside the class.
        // Why:      The overall true peak is the maximum across the whole track; fold each sample's best
        //           candidate into it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this._peak = Math.max(this._peak, localPeak);
        // ```
        peak = max(peak, localPeak)
    }
}

// What:     `internal fun measureTruePeak(channels: Int, chunks: Sequence<FloatArray>): Float { ... }`
//           declares a top-level function (NOT a method; it lives directly in the package) that scans a
//           decoded stream and returns its estimated true peak as a `Float`. `channels: Int` is the
//           interleave width reported by the decoder. `chunks: Sequence<FloatArray>` is Kotlin's LAZY
//           sequence type (sibling: the eager `List<FloatArray>`, which would materialize every chunk
//           in memory at once); `Sequence` is chosen so chunks are pulled on demand and the whole track
//           is never held in memory. `<FloatArray>` is the generic type argument: a sequence whose
//           elements are each a primitive float array. `internal` for the engine, cache, and tests.
// Why:      This is the measurement that per-track normalization is based on. The platform audio
//           decoder is INJECTED as `chunks` (instead of being opened here) so this function stays pure
//           logic and is easy to test; an exhausted sequence signals end-of-stream. (The desktop twin
//           opened a decoder here and returned a `Result`; this version takes the sequence and returns
//           a plain `Float`, with no error channel, because decoding errors are handled by whoever
//           builds the sequence.)
//
// In TS you'd write (pseudocode):
// ```ts
// function measureTruePeak(channels: number, chunks: Iterable<number[]>): number { ... }
// ```
/**
 * Defines measure true peak behavior for this music-player component; the TypeScript-oriented notes above
 * explain its call shape and effects.
 */
internal fun measureTruePeak(channels: Int, chunks: Sequence<FloatArray>): Float {
    // What:     `if (channels == 0) { return 0.0f }` guards against a malformed zero-channel stream and
    //           returns a peak of `0.0f` (a `Float` literal) immediately. `==` is numeric equality on
    //           Ints.
    // Why:      Treat a zero-channel stream as silence; this also avoids a divide-by-zero in the
    //           `i % channels` channel routing, and a zero peak later maps to a gain of 1.0.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (channels === 0) return 0;
    // ```
    if (channels == 0) {
        return 0.0f
    }
    // What:     `val meter = TruePeakMeter(channels)` constructs a new `TruePeakMeter` for this channel
    //           count and binds it to the read-only local `meter`. In Kotlin you call a constructor
    //           just like a function, with NO `new` keyword. `val` because we never reassign `meter`
    //           (we only mutate its internal state).
    // Why:      The meter accumulates the running peak across all chunks.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const meter = new TruePeakMeter(channels);
    // ```
    /**
     * Defines meter value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val meter = TruePeakMeter(channels)
    // What:     `for (chunk in chunks) { ... }` is Kotlin's for-each loop: it iterates `chunks`,
    //           binding each element to the read-only loop variable `chunk` (a `FloatArray`) in turn.
    //           Because `chunks` is a lazy `Sequence`, each iteration pulls (and decodes) the next
    //           chunk only when needed.
    // Why:      Walk the whole decoded stream chunk by chunk, feeding each block to the meter.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const chunk of chunks) { ... }
    // ```
    for (chunk in chunks) {
        // What:     `if (chunk.isEmpty()) { break }` checks whether the chunk has zero elements via the
        //           standard-library `isEmpty()` method and, if so, `break`s out of the for-each loop.
        // Why:      An empty chunk is the agreed end-of-stream signal; stop scanning there.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (chunk.length === 0) break;
        // ```
        if (chunk.isEmpty()) {
            break
        }
        // What:     `meter.feed(chunk)` passes this chunk to the meter's `feed` method, which routes
        //           each interleaved sample to its channel window and updates the running peak.
        // Why:      Fold this block of audio into the measurement.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // meter.feed(chunk);
        // ```
        meter.feed(chunk)
    }
    // What:     `return meter.peak` explicitly returns the meter's accumulated `peak` property (a
    //           `Float`) as the function result. Reading `peak` is allowed from here because only its
    //           setter is `private`.
    // Why:      Hand the measured true peak across the whole stream back to the caller.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return meter.peak;
    // ```
    return meter.peak
}

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
//           place the engine's per-sample audio processor calls. On Android the user-volume factor is
//           applied downstream by the platform audio sink (ExoPlayer's `player.volume`), so the engine
//           passes only the track's normalization gain here; the clamp still backstops measurement
//           error and any source that was above full scale to begin with.
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
