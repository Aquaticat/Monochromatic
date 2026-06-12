package dev.monochromatic.musicplayer

import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.util.Log
import dev.monochromatic.musicplayer.core.measureTruePeak
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Offline true-peak measurement for the Media3 flavor: decode an entire audio file at a `content://`
 * (or `file://`) URI to interleaved float PCM and run the pure [measureTruePeak] DSP over it. The
 * platform decoder is the integration seam the Kotlin core deliberately left open (see
 * [dev.monochromatic.musicplayer.core] `TruePeak`): the desktop opened a symphonia decoder here, the
 * Media3 flavor drives a [MediaExtractor] plus a [MediaCodec] decoder instead, and the full-Rust
 * flavor will feed symphonia again.
 *
 * The decode is one synchronous extractor/codec pass on [Dispatchers.IO]. The decoded PCM is streamed
 * through a lazy [Sequence] rather than collected into a list on purpose: the on-device library holds
 * 30-minute field recordings, and a single one decoded to float is on the order of a gigabyte, which
 * would exhaust the phone; producing and consuming one buffer at a time keeps the pass in roughly
 * constant memory (the meter itself is a few floats per channel).
 *
 * Float is not requested: the audio is decoded at the codec's default, which is signed 16-bit PCM for
 * every codec in this library, ample precision for a peak magnitude. Forcing float via
 * `KEY_PCM_ENCODING` is actively harmful, because the platform raw-PCM passthrough decoder (used for
 * WAV) then reports float output while still emitting the original 16-bit bytes, so the actual output
 * encoding is read back from the codec's output format (defaulting to 16-bit) and float is handled
 * only if a codec genuinely produces it. The whole pass is decode-only (no [android.view.Surface], no
 * rendering), so it produces no sound and is safe to run while the user is listening to something else.
 */
object Media3TruePeakDecoder {
    /** Distinct logcat tag for this offline pass, so its lines filter apart from playback's. */
    private const val DECODE_TAG: String = "Media3TruePeak"

    /**
     * Poll timeout for dequeuing OUTPUT buffers, small and positive so the loop waits briefly when no
     * decoded buffer is ready yet rather than spinning the CPU, but never blocks the IO thread for
     * long.
     */
    private const val DEQUEUE_TIMEOUT_US: Long = 10_000L

    /**
     * Non-blocking timeout for dequeuing INPUT buffers. The feed loop drains every free input slot
     * each pass with this timeout, so the decoder is never input-starved: feeding one buffer per
     * iteration and then waiting on output instead makes the whole decode crawl at roughly one buffer
     * per [DEQUEUE_TIMEOUT_US], which is the difference between a sub-second scan and a 100-second one.
     */
    private const val NON_BLOCKING_TIMEOUT_US: Long = 0L

    /**
     * Divisor turning a signed 16-bit sample into a float in `-1.0..1.0`. `Short.MIN_VALUE` is
     * `-32768`, so dividing by 32768 maps full-scale negative to exactly `-1.0`; this matches the
     * desktop's `f32` sample domain so the measured peak is comparable.
     */
    private const val PCM_16BIT_SCALE: Float = 32768.0f

    /** Nanoseconds per millisecond, for the measured-duration log. */
    private const val NANOS_PER_MILLI: Long = 1_000_000L

    /**
     * Decode the whole file at [contentUri] and return its measured true peak, linear and typically
     * near `1.0` for full-scale material. A zero-channel or empty stream yields `0.0` (the core's
     * silence guard), which downstream maps to unity normalization gain.
     *
     * Runs on [Dispatchers.IO]. The pass is intentionally not cancellable mid-decode: a single track
     * is bounded work, and the measure-on-miss caller would rather let it finish and cache the result
     * than waste a partial decode; cancellation is honored at the track boundary by the batch sweep,
     * not inside one decode.
     *
     * @param context Resolves [contentUri] through its `ContentResolver`; required because a
     *   `content://` URI is opened via the provider, not a raw path.
     * @param contentUri Audio URI from MediaStore or a SAF document tree (`content://`), or a
     *   `file://` URI for a test fixture.
     * @return Measured true peak across the stream; `0.0` for a zero-channel stream.
     * @throws IllegalArgumentException When [contentUri] exposes no audio track to decode.
     * @throws IllegalStateException When the selected track lacks a MIME type, or the decoder emits a
     *   PCM encoding that is neither 16-bit nor float (surfaced rather than silently mismeasured).
     * @throws java.io.IOException When the data source cannot be opened or the codec fails.
     * @example
     * ```kotlin
     * val peak = Media3TruePeakDecoder.measure(context, track.uri.toUri())
     * val gain = normalizationGain(peak)
     * ```
     */
    suspend fun measure(context: Context, contentUri: Uri): Float = withContext(Dispatchers.IO) {
        val extractor = MediaExtractor()
        // setDataSource(context, uri, null): the null headers map is allowed; for a content:// URI
        // the framework opens it via the ContentResolver itself, so no manual fd handling is needed.
        extractor.setDataSource(context, contentUri, null)

        val trackIndex: Int = firstAudioTrack(extractor)
            ?: throw IllegalArgumentException("no audio track in $contentUri")
        val inputFormat: MediaFormat = extractor.getTrackFormat(trackIndex)
        extractor.selectTrack(trackIndex)

        val mime: String = inputFormat.getString(MediaFormat.KEY_MIME)
            ?: throw IllegalStateException("audio track $trackIndex in $contentUri has no MIME type")

        // measureTruePeak needs the channel count eagerly, but the decoder's OUTPUT format only
        // exists after INFO_OUTPUT_FORMAT_CHANGED, which fires only once the lazy sequence is
        // iterated. The container's input track carries the channel count for every audio codec in
        // this library, so take it here; the loop cross-checks the output count and logs a mismatch.
        val channelCount: Int = inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)

        val codec: MediaCodec = MediaCodec.createDecoderByType(mime)
        try {
            // Decode at the codec's default encoding (16-bit for this library). Do NOT request float:
            // the raw-PCM passthrough decoder would then mislabel its 16-bit output as float.
            // decodeChunks reads the encoding the codec actually reports and handles either.
            codec.configure(inputFormat, /* surface = */ null, /* crypto = */ null, /* flags = */ 0)
            codec.start()

            // The sequence is consumed here, inside the try, so the codec stays alive for the whole
            // measurement and the finally below releases it only after the pass has drained. The
            // sample count and elapsed time are logged so the scan's throughput stays observable.
            var sampleCount = 0L
            val startNanos: Long = System.nanoTime()
            val peak: Float = measureTruePeak(
                channelCount,
                decodeChunks(extractor, codec, channelCount).onEach { chunk -> sampleCount += chunk.size },
            )
            val elapsedMs: Long = (System.nanoTime() - startNanos) / NANOS_PER_MILLI
            Log.i(
                DECODE_TAG,
                "measured true peak $peak for $contentUri ($channelCount ch, $mime) " +
                    "in ${elapsedMs}ms over $sampleCount samples",
            )
            peak
        } finally {
            // MediaCodec and MediaExtractor are final classes that do not implement AutoCloseable, so
            // `use {}` will not compile; release by hand. stop() can throw when the codec is already
            // in an error state, so guard it, but release()/extractor.release() must always run.
            runCatching { codec.stop() }
            codec.release()
            extractor.release()
        }
    }

    /**
     * First track whose MIME type names audio, or `null` when the container exposes none.
     *
     * @param extractor Extractor with its data source already set, so track formats are readable.
     * @return Index to [MediaExtractor.selectTrack], or `null` for a non-audio container.
     */
    private fun firstAudioTrack(extractor: MediaExtractor): Int? =
        (0 until extractor.trackCount).firstOrNull { index ->
            extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)
                ?.startsWith("audio/") == true
        }

    /**
     * Lazily decode the selected track to interleaved float chunks in decode order, one [FloatArray]
     * per non-empty output buffer, stopping at end-of-stream. It never yields an empty array: the
     * core meter treats an empty chunk as end-of-stream, and the codec routinely emits a zero-size
     * buffer at the final flag and sometimes at the format change, so those are released and skipped.
     *
     * @param extractor Extractor with the audio track selected, read for input samples.
     * @param codec Started decoder configured for the extractor's track.
     * @param expectedChannels Channel count from the input format, cross-checked against the output.
     * @return Lazy sequence of interleaved PCM chunks, consumed by the meter in [measure].
     */
    private fun decodeChunks(
        extractor: MediaExtractor,
        codec: MediaCodec,
        expectedChannels: Int,
    ): Sequence<FloatArray> = sequence {
        val info = MediaCodec.BufferInfo()
        // A missing KEY_PCM_ENCODING in the output format means signed 16-bit, so default to it and
        // overwrite once the real format arrives.
        var pcmEncoding: Int = AudioFormat.ENCODING_PCM_16BIT
        var queuedEndOfInput = false
        var drainedEndOfOutput = false

        while (!drainedEndOfOutput) {
            // region feed every free input buffer (non-blocking) so the decoder never starves
            while (!queuedEndOfInput) {
                val inputIndex: Int = codec.dequeueInputBuffer(NON_BLOCKING_TIMEOUT_US)
                if (inputIndex < 0) {
                    // No free input slot right now; go drain output and come back.
                    break
                }
                val inputBuffer: ByteBuffer = codec.getInputBuffer(inputIndex)
                    ?: error("dequeued input buffer $inputIndex was null")
                val sampleSize: Int = extractor.readSampleData(inputBuffer, /* offset = */ 0)
                if (sampleSize < 0) {
                    // -1 signals no more samples: queue a zero-size buffer flagged end-of-stream.
                    codec.queueInputBuffer(inputIndex, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                    queuedEndOfInput = true
                } else {
                    codec.queueInputBuffer(inputIndex, 0, sampleSize, extractor.sampleTime, 0)
                    extractor.advance()
                }
            }
            // endregion

            // region drain available output
            val outputIndex: Int = codec.dequeueOutputBuffer(info, DEQUEUE_TIMEOUT_US)
            if (outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                val outputFormat: MediaFormat = codec.outputFormat
                // A missing KEY_PCM_ENCODING is the documented signal for signed 16-bit.
                pcmEncoding = outputFormat.getInteger(
                    MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT,
                )
                val outputChannels: Int = outputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                if (outputChannels != expectedChannels) {
                    Log.w(
                        DECODE_TAG,
                        "channel count mismatch: input $expectedChannels, output $outputChannels",
                    )
                }
            } else if (outputIndex >= 0) {
                val isCodecConfig: Boolean =
                    (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0
                // Yield only real PCM: skip codec-config buffers and any zero-size buffer, since the
                // meter would read an empty chunk as end-of-stream and stop early.
                if (info.size > 0 && !isCodecConfig) {
                    val outputBuffer: ByteBuffer = codec.getOutputBuffer(outputIndex)
                        ?: error("dequeued output buffer $outputIndex was null")
                    yield(toFloatChunk(outputBuffer, info.offset, info.size, pcmEncoding))
                }
                codec.releaseOutputBuffer(outputIndex, /* render = */ false)
                if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                    drainedEndOfOutput = true
                }
            }
            // INFO_TRY_AGAIN_LATER (and the deprecated INFO_OUTPUT_BUFFERS_CHANGED) need no handling:
            // the loop simply cycles back to feed another input buffer and poll again.
            // endregion
        }
    }

    /**
     * Convert one decoded output buffer to an interleaved [FloatArray], honoring the actual PCM
     * [pcmEncoding]: 16-bit samples are scaled by [PCM_16BIT_SCALE], float samples are copied. Both
     * read in the device's native byte order, which is what a platform decoder emits. The valid span
     * is taken from [offset] and [size] (the [MediaCodec.BufferInfo] authority), independent of the
     * buffer's own position and limit.
     *
     * @param buffer Read-only codec output buffer for one decoded block.
     * @param offset Byte start of the valid data within [buffer].
     * @param size Byte length of the valid data within [buffer].
     * @param pcmEncoding Encoding the codec actually produced ([AudioFormat.ENCODING_PCM_FLOAT] or
     *   [AudioFormat.ENCODING_PCM_16BIT]).
     * @return Interleaved float samples for this block.
     * @throws IllegalStateException When [pcmEncoding] is neither float nor 16-bit, so an unexpected
     *   format is reported rather than measured as garbage.
     */
    private fun toFloatChunk(
        buffer: ByteBuffer,
        offset: Int,
        size: Int,
        pcmEncoding: Int,
    ): FloatArray {
        val region: ByteBuffer = buffer.duplicate().apply {
            position(offset)
            limit(offset + size)
            order(ByteOrder.nativeOrder())
        }
        if (pcmEncoding == AudioFormat.ENCODING_PCM_FLOAT) {
            val floats = region.asFloatBuffer()
            return FloatArray(floats.remaining()).also { floats.get(it) }
        }
        if (pcmEncoding == AudioFormat.ENCODING_PCM_16BIT) {
            val shorts = region.asShortBuffer()
            return FloatArray(shorts.remaining()) { index -> shorts.get(index) / PCM_16BIT_SCALE }
        }
        throw IllegalStateException("unsupported PCM encoding $pcmEncoding from decoder")
    }
}
