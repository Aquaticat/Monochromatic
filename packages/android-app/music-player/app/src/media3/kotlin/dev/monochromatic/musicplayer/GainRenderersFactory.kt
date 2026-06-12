package dev.monochromatic.musicplayer

import android.content.Context
import androidx.annotation.OptIn
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink

/**
 * A [DefaultRenderersFactory] that builds the audio sink with one extra processing stage, the
 * [gainProcessor], so ExoPlayer applies true-peak normalization in its own audio pipeline. This is
 * the supported injection point in Media3 1.10.1: overriding `buildAudioSink` to return a
 * [DefaultAudioSink] configured via `setAudioProcessors`, wired into the player with
 * `ExoPlayer.Builder.setRenderersFactory`.
 *
 * Float output is forced off. The sink only routes app-supplied processors when it is NOT using float
 * output; with float output enabled a high-resolution source is converted to float and the app
 * processors are dropped entirely, which would silently skip normalization for those tracks. Forcing
 * 16-bit guarantees the [gainProcessor] always runs. Replacing the processor list also drops the
 * default `SonicAudioProcessor` (playback speed and pitch), which this player does not use; the base
 * audio-output playback-parameter setting is preserved so any speed change still routes through the
 * `AudioTrack` rather than Sonic.
 *
 * @param context Context the base factory and the sink builder need.
 * @param gainProcessor Normalization stage to insert; the engine holds the same instance to set its
 *   per-track gain.
 */
@OptIn(UnstableApi::class)
class GainRenderersFactory(
    context: Context,
    private val gainProcessor: GainNormalizationProcessor,
) : DefaultRenderersFactory(context) {
    /**
     * Build a [DefaultAudioSink] carrying the [gainProcessor], with float output forced off so the
     * processor is never bypassed.
     *
     * @param context Context for the sink builder.
     * @param enableFloatOutput Ignored on purpose; float output is forced off (see the class doc).
     * @param enableAudioOutputPlaybackParameters Forwarded to preserve the base behavior for any
     *   playback-speed change.
     * @return Audio sink with the normalization stage installed.
     */
    override fun buildAudioSink(
        context: Context,
        enableFloatOutput: Boolean,
        enableAudioOutputPlaybackParameters: Boolean,
    ): AudioSink =
        DefaultAudioSink.Builder(context)
            .setAudioProcessors(arrayOf<AudioProcessor>(gainProcessor))
            .setEnableFloatOutput(false)
            .setEnableAudioOutputPlaybackParameters(enableAudioOutputPlaybackParameters)
            .build()
}
