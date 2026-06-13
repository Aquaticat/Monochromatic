package dev.monochromatic.musicplayer.core

import kotlin.math.abs
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Host JVM unit tests for the true-peak meter and its normalization gain, ported from the desktop's
 * `truepeak_tests.rs` so the Kotlin port stays faithful to the Rust behavior. The four normalization
 * assertions and the two Catmull-Rom assertions become one focused test each (six in total); the
 * Rust fixture test, which decoded a committed FLAC, is adapted to a synthetic in-memory signal
 * because no FLAC decoder is available in this pure-logic core (see [meterReportsInterSamplePeak]).
 * The [CEILING] and [HALF] constants are referenced directly (single-sourced, as the Rust test did
 * via `use super::*`) so the expected values cannot drift from the implementation.
 */
class TruePeakTest {
    /**
     * Distance-based float equality with the same `1e-4` tolerance the Rust tests use; `==` on
     * floats is fragile after cubic math.
     *
     * @param a First value.
     * @param b Second value.
     * @return Whether [a] and [b] differ by less than the tolerance.
     */
    private fun approxEq(a: Float, b: Float): Boolean {
        val tolerance = 1e-4f
        return abs(a - b) < tolerance
    }

    @Test
    fun normalizationGainLeavesSilenceUnchanged() {
        assertTrue(approxEq(normalizationGain(0.0f), 1.0f))
    }

    @Test
    fun normalizationGainDoesNotBoostBelowCeiling() {
        assertTrue(approxEq(normalizationGain(HALF), 1.0f))
    }

    @Test
    fun normalizationGainAttenuatesFullScaleToCeiling() {
        assertTrue(approxEq(normalizationGain(1.0f), CEILING))
    }

    @Test
    fun normalizationGainAttenuatesLoudToHalfCeiling() {
        assertTrue(approxEq(normalizationGain(2.0f), CEILING * HALF))
    }

    @Test
    fun catmullRomPassesThroughSegmentStartAtZero() {
        val p0 = 0.0f
        val p1 = 1.0f
        val p2 = -1.0f
        val p3 = 0.5f
        assertTrue(approxEq(catmullRom(p0, p1, p2, p3, 0.0f), p1))
    }

    @Test
    fun catmullRomPassesThroughSegmentEndAtOne() {
        val p0 = 0.0f
        val p1 = 1.0f
        val p2 = -1.0f
        val p3 = 0.5f
        assertTrue(approxEq(catmullRom(p0, p1, p2, p3, 1.0f), p2))
    }

    /**
     * Adapted from the Rust `measure_true_peak_of_fixture_is_sane`, which decoded a committed FLAC
     * tone. With no FLAC decoder in the pure-logic core, a synthetic mono signal with a sharp
     * transient is fed through the meter; the meter must report a true peak at least as large as the
     * largest raw sample magnitude, because the inter-sample interpolation can only overshoot, never
     * undershoot, the stored peak. This pins the streaming scan (feed/push plus the Catmull-Rom
     * oversampling) end-to-end the way the fixture test did.
     */
    @Test
    fun meterReportsInterSamplePeak() {
        val signal = floatArrayOf(0.0f, 0.0f, 0.9f, -0.9f, 0.9f, -0.9f, 0.0f, 0.0f)
        val rawPeak = signal.maxOf { abs(it) }
        val measured = measureTruePeak(channels = 1, chunks = sequenceOf(signal))
        assertTrue(
            "measured peak $measured should be at least the raw peak $rawPeak",
            measured >= rawPeak - 1e-4f,
        )
        assertTrue("measured peak $measured should be a sane, finite level", measured < 4.0f)
    }

    /**
     * Ported from the Rust `process_sample_applies_gain_then_clamps`: silence stays silence at any
     * gain, unity gain is a passthrough below full scale, the gain multiplies, and a result outside
     * `-1.0..1.0` is clamped symmetrically to the nearest bound. Pins the gain-then-clamp output
     * stage the engine's audio processor applies per sample.
     */
    @Test
    fun processSampleAppliesGainThenClamps() {
        assertTrue(approxEq(processSample(0.0f, 1.0f), 0.0f))
        assertTrue(approxEq(processSample(HALF, 1.0f), HALF))
        assertTrue(approxEq(processSample(0.8f, HALF), 0.4f))
        assertTrue(approxEq(processSample(1.5f, 1.0f), 1.0f))
        assertTrue(approxEq(processSample(-2.0f, 1.0f), -1.0f))
    }

    /**
     * The measured peak must not depend on how the stream is chunked: feeding a signal whole and
     * feeding it split across several chunks yield the same peak. This pins the sliding window's
     * persistence across `feed` calls, which the streaming decoder depends on and which the in-place
     * window advance must preserve.
     */
    @Test
    fun chunkBoundariesDoNotChangeTheMeasuredPeak() {
        val signal = floatArrayOf(0.0f, 0.0f, 0.9f, -0.9f, 0.9f, -0.9f, 0.1f, 0.2f, -0.3f, 0.0f)
        val whole = measureTruePeak(channels = 1, chunks = sequenceOf(signal))
        val split = measureTruePeak(
            channels = 1,
            chunks = sequenceOf(
                signal.copyOfRange(0, 3),
                signal.copyOfRange(3, 4),
                signal.copyOfRange(4, 10),
            ),
        )
        assertTrue("whole $whole and split $split should match", approxEq(whole, split))
    }

    /**
     * The optimized [maxInteriorAbs] (hoisted window combinations, one pass) must equal the reference
     * it replaced: `max` of `abs(catmullRom(...))` over the three interior positions 0.25, 0.5, 0.75.
     * This pins the meter's per-sample core to the tested [catmullRom] primitive, so the speed-up
     * cannot silently change a measured true peak; several window shapes (transient, ramp, alternating,
     * constant, mixed) exercise the cubic's full sign range.
     */
    @Test
    fun maxInteriorAbsMatchesCatmullRom() {
        val windows = arrayOf(
            floatArrayOf(0.0f, 0.9f, -0.9f, 0.0f),
            floatArrayOf(0.1f, 0.2f, 0.3f, 0.4f),
            floatArrayOf(-1.0f, 1.0f, -1.0f, 1.0f),
            floatArrayOf(0.5f, 0.5f, 0.5f, 0.5f),
            floatArrayOf(0.3f, -0.7f, 0.8f, -0.2f),
        )
        for (w in windows) {
            val reference = maxOf(
                abs(catmullRom(w[0], w[1], w[2], w[3], 0.25f)),
                abs(catmullRom(w[0], w[1], w[2], w[3], 0.5f)),
                abs(catmullRom(w[0], w[1], w[2], w[3], 0.75f)),
            )
            val actual = maxInteriorAbs(w[0], w[1], w[2], w[3])
            assertTrue(
                "maxInteriorAbs $actual should match the catmullRom reference $reference",
                approxEq(actual, reference),
            )
        }
    }
}
