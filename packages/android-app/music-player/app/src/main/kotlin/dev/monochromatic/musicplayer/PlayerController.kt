package dev.monochromatic.musicplayer

import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import dev.monochromatic.musicplayer.core.Page
import dev.monochromatic.musicplayer.core.Queue
import dev.monochromatic.musicplayer.core.ShuffleMode
import dev.monochromatic.musicplayer.core.pageOfIndex
import dev.monochromatic.musicplayer.core.paginate

/**
 * Orchestrates the queue, pagination, shuffle/scope, and transport on top of an [AudioEngine],
 * mirroring the desktop's controller. It owns the ported [Queue] and the paginated view, drives the
 * engine to play the current track, follows the playing track's page, and advances on a natural end.
 * State the UI renders is exposed as the Compose-observable [uiState]; position/duration are read
 * live via [positionSec]/[durationSec]. Created and called on the main thread.
 *
 * @param engine Flavor-specific audio primitive this controller drives.
 */
class PlayerController(private val engine: AudioEngine) {
    private val queue: Queue = Queue.new()
    private var pages: List<Page> = emptyList()
    private var loadedIndex: Int? = null
    private var isPlaying: Boolean = false

    /**
     * Playback URIs aligned by load-order index with the display paths fed to [queue]; the queue
     * never reorders its track list (shuffle permutes a separate index list), so `uris[index]` is
     * always the URI for the track the queue reports at that load-order index.
     */
    private var uris: List<String> = emptyList()

    /** Compose-observable snapshot the screen renders; reassigned by [refresh]. */
    var uiState: PlayerUiState by mutableStateOf(PlayerUiState())
        private set

    /**
     * Invoked at the end of every [refresh] so a [MediaSession] projection ([BrainPlayer]) can
     * re-pull its state on a discontinuity (track change, play/pause, scope change). Left null when
     * no session is attached; the callback must post `invalidateState` to the looper rather than run
     * it synchronously, since some refreshes happen inside a player command.
     */
    var onStateChanged: (() -> Unit)? = null

    init {
        engine.setOnPlayingChanged { playing ->
            isPlaying = playing
            refresh()
        }
        engine.setOnTrackEnded {
            Log.i(LOG_TAG, "track ended; advancing")
            queue.advance(natural = true)
            playCurrent()
        }
    }

    /**
     * Replace the library with [tracks] (load order): keep their playback URIs in [uris], feed their
     * display paths to the queue (whose pagination trims the shared root and groups by folder,
     * exactly as on the desktop), repaginate, and show the first page without starting playback
     * (Android is tap-to-play).
     *
     * @param tracks Library entries in load order, each pairing a playback URI with a display path.
     */
    fun openLibrary(tracks: List<Track>) {
        uris = tracks.map { it.uri }
        queue.setTracks(tracks.map { it.displayPath })
        pages = paginate(queue.displayPaths())
        loadedIndex = null
        refresh(followCurrent = true)
    }

    /**
     * Load and play the track at load-order index [index] (tap on a non-current row).
     *
     * @param index Load-order queue index of the tapped track.
     */
    fun playIndex(index: Int) {
        queue.playIndex(index)
        playCurrent()
    }

    /**
     * Move to scope position [scopeIndex] (a [MediaSession] timeline window index the framework
     * computed for Next/Previous or a queue-item jump) and play it; an out-of-range index does
     * nothing, matching the framework's no-op.
     *
     * @param scopeIndex Target position within the current playback scope.
     */
    fun seekToScopeIndex(scopeIndex: Int) {
        if (queue.moveCursorTo(scopeIndex) == null) {
            return
        }
        playCurrent()
    }

    /** Toggle play/pause: pause if playing, resume the loaded track, else load and play the current track. */
    fun togglePlay() {
        if (isPlaying) {
            engine.pause()
        } else if (loadedIndex != null && loadedIndex == queue.currentIndex()) {
            engine.play()
        } else {
            playCurrent()
        }
        refresh()
    }

    /**
     * Set the play intent explicitly (the [MediaSession]'s play/pause command and the system media
     * buttons): resume or start the current track, or pause it. Unlike [togglePlay] the caller names
     * the target state, so a duplicate command (pause while already paused) is a safe no-op.
     *
     * @param play True to play (resume the loaded track or load and play the current one), false to pause.
     */
    fun setPlayWhenReady(play: Boolean) {
        if (play) {
            if (loadedIndex != null && loadedIndex == queue.currentIndex()) {
                engine.play()
            } else {
                playCurrent()
            }
        } else {
            engine.pause()
        }
        refresh()
    }

    /** Skip to the next track in scope and play it (user pressed Next). */
    fun next() {
        queue.advance(natural = false)
        playCurrent()
    }

    /** Skip to the previous track in scope and play it (user pressed Prev). */
    fun prev() {
        queue.prev()
        playCurrent()
    }

    /**
     * Change shuffle/scope, keeping the current track current.
     *
     * @param mode New shuffle mode.
     */
    fun setShuffle(mode: ShuffleMode) {
        queue.setShuffle(mode)
        refresh()
    }

    /**
     * Toggle "repeat track".
     *
     * @param on New repeat-track flag.
     */
    fun setRepeatTrack(on: Boolean) {
        queue.setRepeatTrack(on)
        refresh()
    }

    /**
     * Show a different page tab without moving playback.
     *
     * @param page Index of the page to show.
     */
    fun selectPage(page: Int) {
        if (page in pages.indices) {
            uiState = uiState.copy(selectedPage = page, pageItems = pages[page].entries)
        }
    }

    /**
     * Seek within the current track.
     *
     * @param positionSec Target position in seconds.
     */
    fun seek(positionSec: Double) {
        engine.seekTo(positionSec)
    }

    /**
     * Set the output gain.
     *
     * @param volume Linear gain in `0.0..1.0`.
     */
    fun setVolume(volume: Float) {
        engine.setVolume(volume)
        uiState = uiState.copy(volume = volume)
    }

    /**
     * Live playback position for the seek bar.
     *
     * @return Current position in seconds.
     */
    fun positionSec(): Double = engine.positionSec()

    /**
     * Live track duration for the seek bar.
     *
     * @return Current track duration in seconds, 0.0 when unknown.
     */
    fun durationSec(): Double = engine.durationSec()

    /**
     * Point-in-time view of the current scope and transport for the [MediaSession] projection
     * ([BrainPlayer]). The scope's tracks are reported in playback order so the session's
     * framework-computed Next/Previous matches this queue; position and duration are sampled here and
     * extrapolated by the session between pulls.
     *
     * @return Snapshot of the current playback scope and transport state.
     */
    fun snapshot(): PlaybackSnapshot {
        val order: List<Int> = queue.playbackOrder()
        val display: List<String> = queue.displayPaths()
        val items: List<SnapshotItem> = order.map { loadIndex ->
            SnapshotItem(uri = uris[loadIndex], title = display[loadIndex], loadIndex = loadIndex)
        }
        return PlaybackSnapshot(
            items = items,
            currentIndex = queue.cursorPosition(),
            playing = isPlaying,
            volume = uiState.volume,
            durationMs = (durationSec() * MILLIS_PER_SEC).toLong(),
            positionMs = (positionSec() * MILLIS_PER_SEC).toLong(),
        )
    }

    /** Release the underlying engine. */
    fun release() {
        engine.release()
    }

    /** Load the queue's current track and play it, or refresh idle state when the queue is empty. */
    private fun playCurrent() {
        val index = queue.currentIndex()
        if (index == null) {
            refresh()
            return
        }
        loadedIndex = index
        engine.load(uris[index], play = true)
        refresh(followCurrent = true)
    }

    /**
     * Rebuild [uiState] from the queue and pages.
     *
     * @param followCurrent When true, switch the visible page to the current track's page so the
     *   highlighted row stays on screen; otherwise keep the user's selected page.
     */
    private fun refresh(followCurrent: Boolean = false) {
        val current = queue.currentIndex()
        val selected = if (followCurrent && current != null) {
            pageOfIndex(pages, current) ?: uiState.selectedPage
        } else {
            uiState.selectedPage.coerceIn(0, maxOf(0, pages.size - 1))
        }
        uiState = PlayerUiState(
            pageLabels = pages.map { it.label },
            selectedPage = selected,
            pageItems = pages.getOrNull(selected)?.entries ?: emptyList(),
            currentIndex = current,
            playing = isPlaying,
            shuffle = queue.shuffleMode(),
            repeatTrack = queue.repeatTrack(),
            volume = uiState.volume,
            queueSize = queue.len(),
        )
        onStateChanged?.invoke()
    }

    companion object {
        /** Milliseconds per second, for the snapshot's millisecond position/duration. */
        private const val MILLIS_PER_SEC: Double = 1000.0
    }
}
