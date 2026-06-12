package dev.monochromatic.musicplayer

import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import dev.monochromatic.musicplayer.core.processSample
import java.nio.ByteBuffer
import kotlin.math.roundToInt

/**
 * The ExoPlayer audio-pipeline stage that applies a track's true-peak normalization [gain] to every
 * sample, the Media3 implementation of the desktop's per-sample output stage (`process_sample`). It
 * sits in [GainRenderersFactory]'s [androidx.media3.exoplayer.audio.DefaultAudioSink], which builds
 * its PCM pipeline as trim, channel-map, convert-to-16-bit, then the app processors, so this stage
 * always receives signed 16-bit PCM (float output is forced off in the factory precisely so a
 * high-resolution source cannot bypass it). The user volume is applied separately and downstream by
 * the platform `AudioTrack` ([Media3Engine] sets `player.volume`), so the composed result is
 * `clamp(sample * trackGain) * userVolume`, matching the desktop's `volume * track_gain` for every
 * sample where the clamp does not fire (the designed-for case once true-peak normalization has
 * brought the level under the ceiling).
 *
 * [gain] is read on the audio thread and written from the main thread when a track loads, so it is
 * `@Volatile`; it is snapshotted once per [queueInput] so the whole buffer uses one consistent value.
 * The gain is attenuate-only (`0.0..1.0`), so the [processSample] clamp is a backstop that does not
 * fire in normal operation; a [gain] of exactly [UNITY_GAIN] takes a fast path that copies the 16-bit
 * samples through unchanged, avoiding any requantization for a track that needs no attenuation.
 *
 * @see processSample
 */
@OptIn(UnstableApi::class)
class GainNormalizationProcessor : BaseAudioProcessor() {
    /**
     * The current track's normalization gain (`0.0..1.0`), applied to every sample. `@Volatile` so a
     * main-thread write (on track load) is visible to the audio thread; defaults to [UNITY_GAIN]
     * (passthrough) until a track's gain is resolved.
     */
    @Volatile
    var gain: Float = UNITY_GAIN

    /**
     * Accept only signed 16-bit PCM (what the sink feeds app processors) and pass the format through
     * unchanged, since the gain stage does not alter the sample rate, channel count, or encoding.
     * Any other encoding is rejected rather than silently mishandled; it cannot occur while the
     * factory forces float output off, so this is a guard against a future configuration change.
     *
     * @param inputAudioFormat Format the sink offers this stage.
     * @return [inputAudioFormat] unchanged (16-bit in, 16-bit out); returning a set format keeps the
     *   stage active for every accepted stream.
     * @throws AudioProcessor.UnhandledAudioFormatException When the encoding is not 16-bit PCM.
     */
    override fun onConfigure(
        inputAudioFormat: AudioProcessor.AudioFormat,
    ): AudioProcessor.AudioFormat {
        if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT) {
            throw AudioProcessor.UnhandledAudioFormatException(inputAudioFormat)
        }
        return inputAudioFormat
    }

    /**
     * Apply the snapshotted [gain] to each 16-bit sample of [inputBuffer] and write the result to the
     * stage's output buffer. At [UNITY_GAIN] the bytes are copied through without requantizing;
     * otherwise each sample is taken to float (`sample / 32768`), run through the tested [processSample]
     * (gain then clamp), and quantized back to 16-bit (`* 32767`, which stays in range because the
     * clamp bounds the value to `-1.0..1.0`). Byte order is left at the buffers' native order, which
     * the [AudioProcessor] contract guarantees for both the input and the allocated output buffer.
     *
     * @param inputBuffer Interleaved signed 16-bit PCM for one or more whole frames.
     */
    override fun queueInput(inputBuffer: ByteBuffer) {
        if (!inputBuffer.hasRemaining()) {
            return
        }
        val output: ByteBuffer = replaceOutputBuffer(inputBuffer.remaining())
        val currentGain: Float = gain
        if (currentGain == UNITY_GAIN) {
            // No attenuation: copy the 16-bit samples through without requantizing them.
            output.put(inputBuffer)
        } else {
            while (inputBuffer.hasRemaining()) {
                val sample: Float = inputBuffer.short / SAMPLE_SCALE_IN
                val processed: Float = processSample(sample, currentGain)
                output.putShort((processed * SAMPLE_SCALE_OUT).roundToInt().toShort())
            }
        }
        output.flip()
    }

    companion object {
        /** Gain that leaves the signal unchanged; the default and the fast-path copy threshold. */
        const val UNITY_GAIN: Float = 1.0f

        /** Divisor mapping a signed 16-bit sample to a float in `-1.0..1.0` (`Short.MIN` -> `-1.0`). */
        private const val SAMPLE_SCALE_IN: Float = 32768.0f

        /** Multiplier mapping a clamped `-1.0..1.0` float back to signed 16-bit (`1.0` -> `Short.MAX`). */
        private const val SAMPLE_SCALE_OUT: Float = 32767.0f
    }
}
