package dev.monochromatic.musicplayer

import android.content.Context
import android.net.Uri
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * On-device verification of [Media3TruePeakDecoder] against known-peak fixtures. The decoder drives a
 * real [android.media.MediaExtractor] plus [android.media.MediaCodec], which only exist on a device,
 * so this runs as a connected (instrumented) test, not on the host JVM.
 *
 * The oracle is deliberately INDEPENDENT of the core true-peak DSP: each fixture is a signal whose
 * peak follows from its construction (a constant level, or an isolated loud spike), so the assertions
 * cannot be satisfied by a decoder that happens to share the meter's arithmetic. The core DSP is also
 * `internal` and thus invisible to this separate test module, which reinforces the same separation.
 *
 * Every fixture is uncompressed 16-bit PCM in a WAV container, so the decoded samples equal the
 * written samples; the tests therefore pin the decode plumbing exactly: the extractor/codec dequeue
 * loop, end-of-stream handling (a spike near the END would be lost to an early stop), the signed
 * 16-bit to float scaling, and interleaved channel routing. The decode produces no audio output
 * (decode-only, no playback), so it is silent and safe to run while others are nearby.
 */
@RunWith(AndroidJUnit4::class)
class Media3TruePeakDecoderTest {
    private val context: Context get() = ApplicationProvider.getApplicationContext()

    /**
     * Measure a fixture built from [samples] (interleaved 16-bit PCM) by writing it to a WAV file in
     * the app cache and decoding it through [Media3TruePeakDecoder].
     *
     * @param samples Interleaved signed 16-bit PCM, [channels]-wide.
     * @param channels Channel count the WAV header declares; routes interleaved samples.
     * @param name Distinct file name so concurrent fixtures do not collide.
     * @return Measured true peak for the decoded fixture.
     */
    private fun measureFixture(samples: ShortArray, channels: Int, name: String): Float {
        val file: File = File(context.cacheDir, name)
        file.writeBytes(encodeWav16(samples, channels, SAMPLE_RATE))
        return runBlocking { Media3TruePeakDecoder.measure(context, Uri.fromFile(file)) }
    }

    @Test
    fun decodesConstantHalfScaleToExactlyHalf() {
        // Every sample is +0.5 full scale exactly (16384 / 32768 == 0.5), so the true peak is 0.5
        // with no inter-sample overshoot; a wrong byte-to-float scale (e.g. a factor-of-2 error)
        // would land at 0.25 or 1.0 and fail this tight bound.
        val samples = ShortArray(MONO_FRAMES) { HALF_SCALE_SHORT }
        val measured: Float = measureFixture(samples, channels = 1, name = "truepeak-dc-half.wav")
        assertEquals(0.5f, measured, EXACT_TOLERANCE)
    }

    @Test
    fun measuresLoudSpikeNearStreamEnd() {
        // A quiet body with one loud sample placed near the END: if the decode loop stops early or
        // drops the tail, it never sees the spike and reports roughly the quiet level (~0.1), so this
        // proves the whole stream is decoded. The band's lower edge sits just below the spike's exact
        // 0.9 level; the upper edge allows the small Catmull-Rom inter-sample overshoot.
        val samples = ShortArray(MONO_FRAMES) { QUIET_SHORT }
        samples[MONO_FRAMES - SPIKE_FROM_END] = LOUD_SHORT
        val measured: Float = measureFixture(samples, channels = 1, name = "truepeak-spike.wav")
        assertTrue(
            "measured $measured should reach the loud spike near the end",
            measured >= SPIKE_LOWER_BOUND,
        )
        assertTrue("measured $measured should stay a sane level", measured <= SANE_UPPER_BOUND)
    }

    @Test
    fun routesInterleavedStereoSpikeInTheSecondChannel() {
        // Left channel quiet, right channel carries the spike. Interleaved as L,R,L,R,...; a decoder
        // that mis-handles channel count or interleaving would miss the right-channel spike. Frame
        // count is the same; the spike sits in the right (odd) lane near the end.
        val samples = ShortArray(STEREO_FRAMES * 2) { QUIET_SHORT }
        val spikeFrame: Int = STEREO_FRAMES - SPIKE_FROM_END
        samples[spikeFrame * 2 + 1] = LOUD_SHORT
        val measured: Float = measureFixture(samples, channels = 2, name = "truepeak-stereo.wav")
        assertTrue(
            "measured $measured should reach the right-channel spike",
            measured >= SPIKE_LOWER_BOUND,
        )
        assertTrue("measured $measured should stay a sane level", measured <= SANE_UPPER_BOUND)
    }

    @Test
    fun silenceMeasuresZero() {
        // An all-zero stream must measure exactly 0.0 (the silence guard maps it to unity gain).
        val samples = ShortArray(MONO_FRAMES) { 0 }
        val measured: Float = measureFixture(samples, channels = 1, name = "truepeak-silence.wav")
        assertEquals(0.0f, measured, EXACT_TOLERANCE)
    }

    /**
     * Encode interleaved 16-bit PCM [samples] as a little-endian WAV byte array (44-byte canonical
     * PCM header plus the sample data). WAV is lossless, so the decoder reconstructs [samples]
     * exactly, which is what makes the fixtures known-peak oracles.
     *
     * @param samples Interleaved signed 16-bit PCM, [channels]-wide.
     * @param channels Channel count to declare in the format chunk.
     * @param sampleRate Sample rate to declare in the format chunk.
     * @return Complete WAV file bytes.
     */
    private fun encodeWav16(samples: ShortArray, channels: Int, sampleRate: Int): ByteArray {
        val dataSize: Int = samples.size * BYTES_PER_SAMPLE
        val buffer: ByteBuffer = ByteBuffer
            .allocate(WAV_HEADER_BYTES + dataSize)
            .order(ByteOrder.LITTLE_ENDIAN)
        buffer.put("RIFF".toByteArray(Charsets.US_ASCII))
        buffer.putInt(WAV_HEADER_BYTES - RIFF_CHUNK_OVERHEAD + dataSize)
        buffer.put("WAVE".toByteArray(Charsets.US_ASCII))
        buffer.put("fmt ".toByteArray(Charsets.US_ASCII))
        buffer.putInt(PCM_FMT_CHUNK_SIZE)
        buffer.putShort(PCM_FORMAT_TAG)
        buffer.putShort(channels.toShort())
        buffer.putInt(sampleRate)
        buffer.putInt(sampleRate * channels * BYTES_PER_SAMPLE)
        buffer.putShort((channels * BYTES_PER_SAMPLE).toShort())
        buffer.putShort(BITS_PER_SAMPLE)
        buffer.put("data".toByteArray(Charsets.US_ASCII))
        buffer.putInt(dataSize)
        samples.forEach { buffer.putShort(it) }
        return buffer.array()
    }

    private companion object {
        /** Fixture sample rate; any standard rate works since the oracle is amplitude-based. */
        private const val SAMPLE_RATE: Int = 48_000

        /** Mono fixture length in frames (0.1 s at [SAMPLE_RATE]); long enough to exercise chunking. */
        private const val MONO_FRAMES: Int = 4_800

        /** Stereo fixture length in frames. */
        private const val STEREO_FRAMES: Int = 4_800

        /** +0.5 full scale exactly: 16384 / 32768 == 0.5, so the constant fixture has peak 0.5. */
        private const val HALF_SCALE_SHORT: Short = 16_384

        /** Quiet body level, about 0.1 full scale (3277 / 32768). */
        private const val QUIET_SHORT: Short = 3_277

        /** Loud spike level, about 0.9 full scale (29491 / 32768). */
        private const val LOUD_SHORT: Short = 29_491

        /** Spike offset measured from the last frame, so an early stop would miss it. */
        private const val SPIKE_FROM_END: Int = 64

        /** Lower bound just under the spike's exact 0.9 level, catching an early-stop decode. */
        private const val SPIKE_LOWER_BOUND: Float = 0.89f

        /** Sane upper bound leaving room for the inter-sample overshoot, catching an over-scale bug. */
        private const val SANE_UPPER_BOUND: Float = 1.1f

        /** Tolerance for the exact (constant and silent) fixtures; WAV is lossless. */
        private const val EXACT_TOLERANCE: Float = 1e-3f

        /** Bytes per 16-bit sample. */
        private const val BYTES_PER_SAMPLE: Int = 2

        /** Declared bits per sample in the WAV format chunk. */
        private const val BITS_PER_SAMPLE: Short = 16

        /** Canonical PCM WAV header size in bytes. */
        private const val WAV_HEADER_BYTES: Int = 44

        /** Bytes of the RIFF header that precede the chunk-size field's coverage (`RIFF` + size). */
        private const val RIFF_CHUNK_OVERHEAD: Int = 8

        /** `fmt ` chunk body size for PCM. */
        private const val PCM_FMT_CHUNK_SIZE: Int = 16

        /** WAV format tag for uncompressed PCM. */
        private const val PCM_FORMAT_TAG: Short = 1
    }
}
