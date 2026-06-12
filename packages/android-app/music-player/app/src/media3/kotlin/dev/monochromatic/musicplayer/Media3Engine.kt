package dev.monochromatic.musicplayer

import android.content.Context
import android.util.Log
import androidx.media3.common.AudioAttributes
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
 * ExoPlayer handles audio focus and the "becoming noisy" (headphone unplug) broadcast itself once
 * enabled, so a phone call ducks/pauses this player and unplugging headphones pauses it, with no
 * focus code of our own. Focus lives in the inner ExoPlayer (not the [MediaSession] wrapper or the
 * session module), so it must be enabled here; a focus-induced pause surfaces through
 * [setOnPlayingChanged] like any other pause, which is what keeps the notification/lockscreen state
 * correct.
 *
 * @param context Context used to build the underlying ExoPlayer.
 */
class Media3Engine(context: Context) : AudioEngine {
    private val player: ExoPlayer = ExoPlayer.Builder(context)
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
