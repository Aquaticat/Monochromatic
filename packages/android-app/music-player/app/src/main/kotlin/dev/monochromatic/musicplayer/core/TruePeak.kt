package dev.monochromatic.musicplayer.core

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * True-peak measurement and the attenuate-only normalization gain it feeds. Faithful port of the
 * desktop's `truepeak.rs`; pure logic only, with the platform decoder deferred (see [measureTruePeak]).
 *
 * "True peak" (inter-sample peak) is the highest level the analog waveform reaches after a DAC
 * reconstructs it between the stored samples, so it can sit above the largest stored sample. It is
 * estimated by oversampling each channel about 4x with a cubic (Catmull-Rom) interpolation and taking
 * the largest magnitude seen. [normalizationGain] turns a measured true peak into a single constant
 * gain that brings the track down to a -1 dBTP ceiling (never up), so playback cannot overflow the
 * converter.
 *
 * Every value is [Float] (the Rust is `f32` end to end) so the interpolation math stays
 * sample-for-sample identical to the desktop.
 */

/** One-half (0.5), composed from the always-allowed range rather than written as a bare literal. */
internal const val HALF: Float = 1.0f / 2.0f

/** One-quarter (0.25), the first interior sample position, built from [HALF]. */
private const val QUARTER: Float = HALF / 2.0f

/** Three-quarters (0.75), the third interior sample position, built from [HALF] and [QUARTER]. */
private const val THREE_QUARTERS: Float = HALF + QUARTER

/**
 * The true-peak target, 10^(-1/20), i.e. -1 dBTP linear. Precomputed because `pow` is not a
 * compile-time constant; the value normalization scales each track's true peak down to. -1 dBTP is
 * the EBU R128 / ATSC A/85 ceiling that leaves room for the DAC's reconstruction.
 */
internal const val CEILING: Float = 0.8912509f

/**
 * Number of consecutive samples the cubic interpolation needs (two on each side of the interval it
 * fills); Catmull-Rom evaluates the curve between the 2nd and 3rd of four points.
 */
private const val WINDOW: Int = 4

/** [QUARTER] squared, the `t²` term of the cubic at the first interior position, as a constant. */
private const val QUARTER_SQ: Float = QUARTER * QUARTER

/** [QUARTER] cubed, the `t³` term of the cubic at the first interior position, as a constant. */
private const val QUARTER_CUBE: Float = QUARTER_SQ * QUARTER

/** [HALF] squared, the `t²` term of the cubic at the middle interior position, as a constant. */
private const val HALF_SQ: Float = HALF * HALF

/** [HALF] cubed, the `t³` term of the cubic at the middle interior position, as a constant. */
private const val HALF_CUBE: Float = HALF_SQ * HALF

/** [THREE_QUARTERS] squared, the `t²` term of the cubic at the last interior position, as a constant. */
private const val THREE_QUARTERS_SQ: Float = THREE_QUARTERS * THREE_QUARTERS

/** [THREE_QUARTERS] cubed, the `t³` term of the cubic at the last interior position, as a constant. */
private const val THREE_QUARTERS_CUBE: Float = THREE_QUARTERS_SQ * THREE_QUARTERS

/**
 * Evaluate the Catmull-Rom cubic through four equally-spaced points at position [t] on the segment
 * between [p1] and [p2], estimating the waveform where inter-sample peaks live. The literal
 * coefficients (2, 3, 4, 5) are the standard spline matrix entries; [HALF] is the 1/2 normalization.
 *
 * @param p0 Sample before the segment, the left neighbour.
 * @param p1 Segment start; the curve passes through it at `t == 0`.
 * @param p2 Segment end; the curve passes through it at `t == 1`.
 * @param p3 Sample after the segment, the right neighbour.
 * @param t Position along the segment, normally in `0.0..1.0`.
 * @return Interpolated waveform value at [t].
 */
internal fun catmullRom(p0: Float, p1: Float, p2: Float, p3: Float, t: Float): Float {
    val t2: Float = t * t
    val t3: Float = t2 * t
    return HALF * (
        2.0f * p1 +
            (p2 - p0) * t +
            (2.0f * p0 - 5.0f * p1 + 4.0f * p2 - p3) * t2 +
            (3.0f * p1 - 3.0f * p2 + p3 - p0) * t3
        )
}

/**
 * Largest absolute interpolated value across the three interior oversampling positions ([QUARTER],
 * [HALF], [THREE_QUARTERS]) of one four-point window, the per-sample core of the inter-sample peak
 * scan. Algebraically equal to `max` of `abs(catmullRom(p0, p1, p2, p3, t))` over those three `t`
 * (pinned by [the host test][maxInteriorAbsMatchesCatmullRom]), and computed with the identical float
 * operations, so the measured peak is bit-for-bit the same as evaluating [catmullRom] three times.
 *
 * The speed-up is structural: the three window-only combinations ([linear][a], [t²][b], [t³][c] terms)
 * do not depend on `t`, so they are computed once here and reused across the three positions, whose
 * `t`, `t²`, `t³` are compile-time constants. [catmullRom] recomputed all of them on every call, and
 * `push` called it three times per sample; device profiling of an opus track showed that per-sample
 * cubic work, tens of millions of calls, dominated the scan (about seventeen seconds), so collapsing
 * three calls and their repeated combinations into one pass is the meter's main cost lever.
 *
 * @param p0 Sample before the segment, the left neighbour.
 * @param p1 Segment start; the curve passes through it at `t == 0`.
 * @param p2 Segment end; the curve passes through it at `t == 1`.
 * @param p3 Sample after the segment, the right neighbour.
 * @return Largest absolute interpolated magnitude at the three interior positions.
 * @example
 * ```kotlin
 * val overshoot = maxInteriorAbs(0.0f, 0.9f, -0.9f, 0.0f) // inter-sample peak between p1 and p2
 * ```
 */
internal fun maxInteriorAbs(p0: Float, p1: Float, p2: Float, p3: Float): Float {
    val twoP1: Float = 2.0f * p1
    val a: Float = p2 - p0
    val b: Float = 2.0f * p0 - 5.0f * p1 + 4.0f * p2 - p3
    val c: Float = 3.0f * p1 - 3.0f * p2 + p3 - p0
    val atQuarter: Float = HALF * (twoP1 + a * QUARTER + b * QUARTER_SQ + c * QUARTER_CUBE)
    val atHalf: Float = HALF * (twoP1 + a * HALF + b * HALF_SQ + c * HALF_CUBE)
    val atThreeQuarters: Float =
        HALF * (twoP1 + a * THREE_QUARTERS + b * THREE_QUARTERS_SQ + c * THREE_QUARTERS_CUBE)
    return max(abs(atQuarter), max(abs(atHalf), abs(atThreeQuarters)))
}

/**
 * Running state for the streaming peak scan: a 4-sample sliding window per channel, how many real
 * samples each channel has seen (capped at [WINDOW]), and the largest magnitude so far. Scans audio
 * chunk by chunk in constant memory (a few floats per channel) without holding the whole track.
 *
 * @property channels Channel count (interleave width); routes each interleaved sample to its window.
 */
internal class TruePeakMeter(private val channels: Int) {
    /** One window of the last [WINDOW] samples per channel, all zeroed at construction. */
    private val win: Array<FloatArray> = Array(channels) { FloatArray(WINDOW) }

    /** Per channel, how many real samples have arrived, capped at [WINDOW]. */
    private val filled: IntArray = IntArray(channels)

    /** Largest absolute sample or interpolated value seen so far; the measured true peak when done. */
    var peak: Float = 0.0f
        private set

    /**
     * Push one interleaved chunk of samples through the meter, updating the running [peak]. The
     * sample at index `i` belongs to channel `i % channels` in the interleaved layout.
     *
     * @param chunk Interleaved PCM samples for all channels.
     */
    fun feed(chunk: FloatArray) {
        chunk.forEachIndexed { i, s ->
            push(i % channels, s)
        }
    }

    /**
     * Slide one sample into a channel's window, update the raw peak, and (once the window holds
     * [WINDOW] real samples) sample the interpolated curve at three interior positions between the
     * two middle window points to catch inter-sample peaks.
     *
     * @param channel Channel index the sample belongs to.
     * @param s Sample magnitude (signed PCM value) for that channel.
     */
    private fun push(channel: Int, s: Float) {
        val w: FloatArray = win[channel]
        // Advance the window in place: drop the oldest sample, append s. The Rust port copies a
        // `[f32; 4]` by value, a cheap stack move, but allocating a fresh Kotlin array per sample
        // would heap-allocate once per PCM sample (tens of millions per track) and dominate the
        // scan. Nothing else references this window, so the in-place shift cannot corrupt a stored
        // copy; the interpolation below reads the just-advanced window.
        w[0] = w[1]
        w[1] = w[2]
        w[2] = w[3]
        w[3] = s
        filled[channel] = min(filled[channel] + 1, WINDOW)
        var localPeak: Float = abs(s)
        if (filled[channel] == WINDOW) {
            localPeak = max(localPeak, maxInteriorAbs(w[0], w[1], w[2], w[3]))
        }
        peak = max(peak, localPeak)
    }
}

/**
 * Scan a decoded stream chunk by chunk and return its estimated true peak (linear, typically near
 * 1.0 for full-scale material). Faithful port of the desktop's `measure_true_peak`, with the
 * platform decoder injected as [chunks] so this stays pure logic; the desktop opened a FLAC decoder
 * here and read interleaved chunks until end-of-stream.
 *
 * A zero-channel stream is treated as silence (peak 0.0), guarding the channel routing against a
 * divide-by-zero just as the Rust does.
 *
 * @param channels Interleave width reported by the decoder.
 * @param chunks Interleaved PCM chunks in decode order; an exhausted sequence signals end-of-stream.
 * @return Measured true peak across the whole stream.
 */
internal fun measureTruePeak(channels: Int, chunks: Sequence<FloatArray>): Float {
    if (channels == 0) {
        return 0.0f
    }
    val meter = TruePeakMeter(channels)
    for (chunk in chunks) {
        if (chunk.isEmpty()) {
            break
        }
        meter.feed(chunk)
    }
    return meter.peak
}

/**
 * Turn a measured true peak into the constant gain that brings it down to [CEILING], never
 * amplifying (gain is capped at 1.0). Attenuate-only normalization prevents inter-sample overflow
 * without ever boosting a quiet track. A silent or invalid measurement leaves the signal unchanged,
 * which also avoids dividing by zero.
 *
 * @param truePeak Measured true peak of the track (linear).
 * @return Gain in `0.0..1.0`: `CEILING / truePeak` for louder-than-ceiling material, else 1.0.
 */
internal fun normalizationGain(truePeak: Float): Float {
    if (truePeak <= 0.0f) {
        return 1.0f
    }
    return min(CEILING / truePeak, 1.0f)
}

/**
 * Apply a combined linear gain to one PCM sample, then hard-clamp into the valid `-1.0..1.0` range.
 * Faithful port of the desktop's `process_sample` (the per-sample output stage in `playback.rs`),
 * kept as one tested unit so the gain-then-clamp rule lives in a single place the engine's audio
 * processor calls per sample, rather than being re-expressed inside platform DSP code.
 *
 * On the desktop [gain] is the user volume times the track's true-peak [normalizationGain], applied
 * to every sample. On Android the user-volume factor is applied downstream by the platform audio
 * sink (ExoPlayer's `player.volume`), so the engine's gain processor passes only the track's
 * [normalizationGain] here; the two compose to the desktop's `volume * track_gain` for every sample
 * where the clamp does not fire, which is the designed-for case once true-peak normalization has
 * already brought the level under the ceiling. The clamp still backstops measurement error and any
 * source that was above full scale to begin with.
 *
 * The bounds `-1.0`/`1.0` are written as bare literals (the `-2..2` range is exempt from the
 * named-constant rule), matching the desktop's `.clamp(-1.0, 1.0)`.
 *
 * @param sample Raw PCM sample to gain and clamp, normally already within `-1.0..1.0`.
 * @param gain Combined linear gain to apply; `1.0` passes [sample] through unchanged before the clamp.
 * @return [sample] scaled by [gain] and clamped to `-1.0..1.0`.
 * @example
 * ```kotlin
 * processSample(0.8f, 0.5f) // 0.4f  (gain multiplies)
 * processSample(1.5f, 1.0f) // 1.0f  (clamped to full scale)
 * ```
 */
internal fun processSample(sample: Float, gain: Float): Float =
    (sample * gain).coerceIn(-1.0f, 1.0f)
