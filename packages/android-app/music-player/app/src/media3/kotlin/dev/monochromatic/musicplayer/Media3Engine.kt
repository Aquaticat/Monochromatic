package dev.monochromatic.musicplayer

import android.content.Context
import android.util.Log
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer

/**
 * The pure-Kotlin engine: a thin wrapper over ExoPlayer using its default renderers, so audio
 * is decoded by the platform's MediaCodec (no media3-decoder extension). Created and driven on
 * the main thread, which owns the player's application looper.
 *
 * @param context Application or activity context used to build the underlying ExoPlayer.
 */
class Media3Engine(context: Context) : AudioEngine {
    private val player: ExoPlayer = ExoPlayer.Builder(context).build()
    private var onState: ((EngineState) -> Unit)? = null
    private var current: String? = null

    init {
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) = emit()
            override fun onIsPlayingChanged(isPlaying: Boolean) = emit()
            override fun onPlayerError(error: PlaybackException) {
                Log.e(LOG_TAG, "ExoPlayer error: ${error.errorCodeName}", error)
                onState?.invoke(EngineState("error: ${error.errorCodeName}", current))
            }
        })
    }

    /** Map the player's current transport into an [EngineState] and push it to the callback. */
    private fun emit() {
        val status = when (player.playbackState) {
            Player.STATE_IDLE -> "idle"
            Player.STATE_BUFFERING -> "buffering"
            Player.STATE_READY -> if (player.isPlaying) "playing" else "paused"
            Player.STATE_ENDED -> "ended"
            else -> "unknown"
        }
        onState?.invoke(EngineState(status, current))
    }

    override fun play(path: String) {
        current = path.substringAfterLast('/')
        Log.i(LOG_TAG, "Media3Engine.play $current")
        player.setMediaItem(MediaItem.fromUri(path))
        player.prepare()
        player.play()
        emit()
    }

    override fun pause() {
        player.pause()
    }

    override fun stop() {
        player.stop()
        current = null
        emit()
    }

    override fun release() {
        player.release()
    }

    override fun setOnState(callback: (EngineState) -> Unit) {
        onState = callback
    }
}
