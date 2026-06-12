package dev.monochromatic.musicplayer

import android.content.Context
import android.util.Log
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer

/**
 * The pure-Kotlin engine: a thin wrapper over ExoPlayer using its default renderers, so audio is
 * decoded by the platform MediaCodec (no media3-decoder extension; the Pixel 6 decodes Opus and FLAC
 * natively, verified on device). Created and driven on the main thread, which owns the player's
 * application looper. One track at a time; [PlayerController] owns the queue and advances on
 * [setOnTrackEnded].
 *
 * @param context Context used to build the underlying ExoPlayer.
 */
class Media3Engine(context: Context) : AudioEngine {
    private val player: ExoPlayer = ExoPlayer.Builder(context).build()
    private var onPlayingChanged: ((Boolean) -> Unit)? = null
    private var onTrackEnded: (() -> Unit)? = null

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
        player.setMediaItem(MediaItem.fromUri(uri))
        player.prepare()
        player.playWhenReady = play
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

    override fun setOnPlayingChanged(callback: (Boolean) -> Unit) {
        onPlayingChanged = callback
    }

    override fun setOnTrackEnded(callback: () -> Unit) {
        onTrackEnded = callback
    }

    override fun release() {
        player.release()
    }

    companion object {
        /** Milliseconds per second, the unit ExoPlayer reports position/duration in. */
        private const val MILLIS_PER_SEC: Double = 1000.0
    }
}
