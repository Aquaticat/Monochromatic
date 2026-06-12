package dev.monochromatic.musicplayer

import android.content.Context
import android.util.Log
import androidx.annotation.OptIn
import androidx.core.net.toUri
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import dev.monochromatic.musicplayer.core.normalizationGain
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * The pure-Kotlin engine: a thin wrapper over ExoPlayer using its default renderers, so audio is
 * decoded by the platform MediaCodec (no media3-decoder extension; the Pixel 6 decodes Opus and FLAC
 * natively, verified on device). Created and driven on the main thread, which owns the player's
 * application looper. One track at a time; [PlayerController] owns the queue and advances on
 * [setOnTrackEnded].
 *
 * ExoPlayer handles audio focus and the "becoming noisy" (headphone unplug) broadcast itself once
 * enabled, so a phone call ducks/pauses this player and unplugging headphones pauses it, with no
 * focus code of our own. Focus lives in the inner ExoPlayer (not the [MediaSession] wrapper or the
 * session module), so it must be enabled here; a focus-induced pause surfaces through
 * [setOnPlayingChanged] like any other pause, which is what keeps the notification/lockscreen state
 * correct.
 *
 * @param context Context used to build the underlying ExoPlayer.
 */
@OptIn(UnstableApi::class)
class Media3Engine(context: Context) : AudioEngine {
    /**
     * True-peak normalization stage installed in the ExoPlayer audio pipeline (via
     * [GainRenderersFactory]). The engine sets its per-track [GainNormalizationProcessor.gain] when a
     * track loads; it starts at unity (passthrough) until a gain is resolved.
     */
    private val gainProcessor: GainNormalizationProcessor = GainNormalizationProcessor()

    private val player: ExoPlayer = ExoPlayer.Builder(context)
        // Apply per-track true-peak normalization inside ExoPlayer's own audio pipeline.
        .setRenderersFactory(GainRenderersFactory(context, gainProcessor))
        // Pause/resume around a headphone unplug; without it audio keeps blaring on the speaker.
        .setHandleAudioBecomingNoisy(true)
        .build()
        .apply {
            // handleAudioFocus=true: ExoPlayer requests focus and pauses/ducks on loss (phone call,
            // another media app) by itself. AudioAttributes.DEFAULT already carries usage=USAGE_MEDIA,
            // which the focus path requires, so this cannot throw.
            setAudioAttributes(AudioAttributes.DEFAULT, /* handleAudioFocus = */ true)
        }
    private var onPlayingChanged: ((Boolean) -> Unit)? = null
    private var onTrackEnded: (() -> Unit)? = null

    /** Application context for the off-thread gain resolution (cache + measure), held without leaking the activity. */
    private val appContext: Context = context.applicationContext

    /** Scope for the per-track gain resolution; cancelled in [release] so a pending measure cannot outlive the engine. */
    private val resolveScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /**
     * Monotonic load counter. Each [load] bumps it; a resolved gain is applied only when the load
     * that requested it is still current, so a measure that finishes after the user skipped ahead
     * cannot retag the new track with the old track's gain. `@Volatile` because [load] writes it on
     * the main thread and the resolution coroutine reads it on a background thread.
     */
    @Volatile
    private var loadGeneration: Int = 0

    init {
        player.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                onPlayingChanged?.invoke(isPlaying)
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) {
                    onTrackEnded?.invoke()
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                Log.e(LOG_TAG, "ExoPlayer error: ${error.errorCodeName}", error)
            }
        })
    }

    override fun load(uri: String, play: Boolean) {
        Log.i(LOG_TAG, "Media3Engine.load ${uri.substringAfterLast('/')} play=$play")
        // Reset to unity so the new track never plays at the previous track's gain.
        gainProcessor.gain = GainNormalizationProcessor.UNITY_GAIN
        val generation: Int = ++loadGeneration
        player.setMediaItem(MediaItem.fromUri(uri))
        player.prepare()
        // Start playback immediately (so start latency stays well under a second) and resolve the gain
        // in parallel. ExoPlayer buffers for a few hundred milliseconds before the first audible
        // sample, and a cache hit or fast measure resolves within that window, so a cached or fast
        // track is already at its correct gain from the first sound, the desktop's "measure before
        // playing" effect without delaying the start. A slow miss plays at unity until its measurement
        // lands, then a brief one-time level correction. Delaying the start to block on the gain was
        // tried and rejected: it pushed start past a second because ExoPlayer buffers after the
        // deferred start.
        player.playWhenReady = play
        resolveScope.launch {
            val resolved: Float = resolveNormalizationGain(uri)
            // Apply only if this load is still current; the measurement was cached regardless, so a
            // superseded load's work is not wasted.
            if (generation == loadGeneration) {
                gainProcessor.gain = resolved
                Log.i(LOG_TAG, "normalization gain $resolved for ${uri.substringAfterLast('/')}")
            }
        }
    }

    /**
     * Resolve the track's true-peak normalization gain: a [PeakCacheStore] hit returns immediately,
     * a miss measures the track now (a full offline decode via [Media3TruePeakDecoder]), caches the
     * peak unconditionally, and returns the gain. A track whose size cannot be fingerprinted, or whose
     * decode fails, plays at unity gain (the downstream clamp still guards against clipping). The
     * cancellation of a superseded load is propagated so structured cancellation still works.
     *
     * @param uri Track URI being loaded.
     * @return Normalization gain in `0.0..1.0`.
     */
    private suspend fun resolveNormalizationGain(uri: String): Float {
        val parsed = uri.toUri()
        val key: String = TrackFingerprint.of(appContext, parsed)
            ?: return GainNormalizationProcessor.UNITY_GAIN
        PeakCacheStore.get(appContext, key)?.let { cachedPeak ->
            return normalizationGain(cachedPeak)
        }
        val peak: Float = try {
            Media3TruePeakDecoder.measure(appContext, parsed)
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (failure: Exception) {
            Log.w(LOG_TAG, "true-peak measure failed for $uri; using unity gain", failure)
            return GainNormalizationProcessor.UNITY_GAIN
        }
        PeakCacheStore.put(appContext, key, peak)
        PeakCacheStore.flush(appContext)
        return normalizationGain(peak)
    }

    override fun play() {
        player.play()
    }

    override fun pause() {
        player.pause()
    }

    override fun seekTo(positionSec: Double) {
        player.seekTo((positionSec * MILLIS_PER_SEC).toLong())
    }

    override fun setVolume(volume: Float) {
        player.volume = volume
    }

    override fun positionSec(): Double {
        val pos = player.currentPosition
        return if (pos < 0L) 0.0 else pos / MILLIS_PER_SEC
    }

    override fun durationSec(): Double {
        val dur = player.duration
        return if (dur == C.TIME_UNSET || dur < 0L) 0.0 else dur / MILLIS_PER_SEC
    }

    override fun playWhenReady(): Boolean = player.playWhenReady

    override fun setOnPlayingChanged(callback: (Boolean) -> Unit) {
        onPlayingChanged = callback
    }

    override fun setOnTrackEnded(callback: () -> Unit) {
        onTrackEnded = callback
    }

    override fun release() {
        resolveScope.cancel()
        player.release()
    }

    companion object {
        /** Milliseconds per second, the unit ExoPlayer reports position/duration in. */
        private const val MILLIS_PER_SEC: Double = 1000.0
    }
}
