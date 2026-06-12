package dev.monochromatic.musicplayer

import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.SimpleBasePlayer
import androidx.media3.common.SimpleBasePlayer.MediaItemData
import androidx.media3.common.SimpleBasePlayer.State
import androidx.media3.common.util.UnstableApi
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * Projects [PlayerController] (the queue/scope/transport brain) to a [MediaSession] as an
 * androidx.media3 [Player], so the system notification, lockscreen, headset buttons, and external
 * controllers (Android Auto, Wear) can show and drive playback. Built on [SimpleBasePlayer], whose
 * `getState()` pulls an immutable snapshot and whose `handle*` methods route commands back into the
 * brain; the brain stays the single source of truth (the in-app Compose UI reads the same brain
 * directly).
 *
 * The reported timeline is the brain's current playback scope in playback order, so the framework's
 * (final, non-overridable) Next/Previous index computation matches the queue. Repeat-track is NOT a
 * Player repeat mode here: the framework never auto-advances a [SimpleBasePlayer] (the brain advances
 * on the engine's track-end), so the reported repeat mode exists only to make manual Next/Previous
 * loop the scope, and is therefore always [Player.REPEAT_MODE_ALL]; replaying a track on natural end
 * stays inside the brain.
 *
 * Audio focus is not handled here: it lives in the inner ExoPlayer ([Media3Engine]) and surfaces as a
 * normal pause through the brain, which re-pulls this state, so a focus-induced pause flips the
 * notification correctly.
 *
 * @param controller Brain this player projects and drives.
 * @param looper Application looper all calls and listener callbacks happen on (the main looper); the
 *   wrapping [MediaSession] must be built on the same thread.
 */
@OptIn(UnstableApi::class)
class BrainPlayer(
    private val controller: PlayerController,
    looper: Looper,
) : SimpleBasePlayer(looper) {
    /** Posts `invalidateState` to [looper] so a brain change re-pulls state without re-entering a command. */
    private val handler: Handler = Handler(looper)

    init {
        // Every brain mutation (a UI action, a focus pause, an auto-advance) re-pulls state. Posting,
        // not calling directly, keeps invalidateState off the stack of any in-flight handle* command.
        controller.onStateChanged = {
            handler.post { invalidateState() }
        }
    }

    override fun getState(): State {
        val snapshot: PlaybackSnapshot = controller.snapshot()
        val playlist: List<MediaItemData> = snapshot.items.mapIndexed { index, item ->
            val durationUs: Long = if (index == snapshot.currentIndex && snapshot.durationMs > 0L) {
                snapshot.durationMs * MICROS_PER_MILLI
            } else {
                C.TIME_UNSET
            }
            MediaItemData.Builder(item.loadIndex)
                .setMediaItem(
                    MediaItem.Builder()
                        .setUri(item.uri)
                        .setMediaId(item.loadIndex.toString())
                        .setMediaMetadata(MediaMetadata.Builder().setTitle(item.title).build())
                        .build(),
                )
                .setIsSeekable(true)
                .setDurationUs(durationUs)
                .build()
        }
        val builder: State.Builder = State.Builder()
            .setAvailableCommands(AVAILABLE_COMMANDS)
            .setPlaylist(playlist)
            .setPlayWhenReady(snapshot.playWhenReady, Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST)
            .setPlaybackState(if (playlist.isEmpty()) Player.STATE_IDLE else Player.STATE_READY)
            .setContentPositionMs(snapshot.positionMs)
            .setVolume(snapshot.volume)
            // Scope loops on manual Next/Previous; repeat-track is handled inside the brain instead.
            .setRepeatMode(Player.REPEAT_MODE_ALL)
        val current: Int? = snapshot.currentIndex
        if (current != null && current in playlist.indices) {
            builder.setCurrentMediaItemIndex(current)
        }
        return builder.build()
    }

    override fun handleSetPlayWhenReady(playWhenReady: Boolean): ListenableFuture<*> {
        controller.setPlayWhenReady(playWhenReady)
        return Futures.immediateVoidFuture()
    }

    override fun handlePrepare(): ListenableFuture<*> {
        // The brain prepares the engine when it loads a track, so there is nothing to do here.
        return Futures.immediateVoidFuture()
    }

    override fun handleSeek(mediaItemIndex: Int, positionMs: Long, seekCommand: Int): ListenableFuture<*> {
        val hasPosition: Boolean = positionMs != C.TIME_UNSET
        val targetSec: Double = if (hasPosition) positionMs / MILLIS_PER_SEC else 0.0
        val staysOnCurrent: Boolean = mediaItemIndex == C.INDEX_UNSET || mediaItemIndex == controller.currentScopeIndex()
        if (staysOnCurrent) {
            // In-place seek within the current track (the scrubber, or a seek-to-current-item with a
            // position); never reload, so playback continues from the requested position.
            if (hasPosition) {
                controller.seek(targetSec)
            }
        } else {
            // Jump to another scope position (Next/Previous, or a seek to a specific item), honoring
            // a requested start position rather than always restarting at 0.
            controller.seekToScopeIndex(mediaItemIndex, targetSec)
        }
        return Futures.immediateVoidFuture()
    }

    override fun handleRelease(): ListenableFuture<*> {
        controller.onStateChanged = null
        controller.release()
        return Futures.immediateVoidFuture()
    }

    companion object {
        /** Microseconds per millisecond, for the per-item `durationUs` the timeline wants. */
        private const val MICROS_PER_MILLI: Long = 1000L

        /** Milliseconds per second, to turn a seek position back into the brain's seconds. */
        private const val MILLIS_PER_SEC: Double = 1000.0

        /**
         * Commands the player advertises: play/pause, prepare, the four Next/Previous variants and the
         * two seek-to variants (so the notification shows prev/next and a working scrubber), and the
         * metadata/timeline getters the notification reads for the title. Volume stays an in-app
         * control (the slider drives the brain directly; the lockscreen uses device volume), so no
         * `COMMAND_SET_VOLUME` is advertised; the reported volume is informational.
         */
        private val AVAILABLE_COMMANDS: Player.Commands = Player.Commands.Builder()
            .addAll(
                Player.COMMAND_PLAY_PAUSE,
                Player.COMMAND_PREPARE,
                // COMMAND_RELEASE must be advertised or SimpleBasePlayer.release() early-returns
                // before handleRelease() runs, leaking the inner ExoPlayer on every service destroy.
                Player.COMMAND_RELEASE,
                Player.COMMAND_SEEK_TO_NEXT,
                Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
                Player.COMMAND_SEEK_TO_PREVIOUS,
                Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
                Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM,
                Player.COMMAND_SEEK_TO_MEDIA_ITEM,
                Player.COMMAND_GET_CURRENT_MEDIA_ITEM,
                Player.COMMAND_GET_TIMELINE,
                Player.COMMAND_GET_METADATA,
            )
            .build()
    }
}
