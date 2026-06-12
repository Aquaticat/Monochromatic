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

    /** Compose-observable snapshot the screen renders; reassigned by [refresh]. */
    var uiState: PlayerUiState by mutableStateOf(PlayerUiState())
        private set

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
     * Replace the queue with [paths] (load order), repaginate, and show the first page without
     * starting playback (Android is tap-to-play).
     *
     * @param paths Track paths in load order.
     */
    fun openTracks(paths: List<String>) {
        queue.setTracks(paths)
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

    /** Toggle play/pause: pause if playing, resume the loaded track, else load and play the current track. */
    fun togglePlay() {
        if (isPlaying) {
            engine.pause()
        } else if (loadedIndex != null && loadedIndex == queue.currentIndex()) {
            engine.play()
        } else {
            playCurrent()
        }
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

    /** Release the underlying engine. */
    fun release() {
        engine.release()
    }

    /** Load the queue's current track and play it, or refresh idle state when the queue is empty. */
    private fun playCurrent() {
        val path = queue.currentPath()
        if (path == null) {
            refresh()
            return
        }
        loadedIndex = queue.currentIndex()
        engine.load(path, play = true)
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
    }
}
