package dev.monochromatic.musicplayer

import dev.monochromatic.musicplayer.core.PageEntry
import dev.monochromatic.musicplayer.core.ShuffleMode

/**
 * Immutable snapshot of everything the player screen renders, recomputed by [PlayerController]
 * whenever the queue, current track, visible page, shuffle, repeat, or play state changes. Position
 * and duration are deliberately excluded: they tick every frame and are polled directly off the
 * engine by the seek bar, so they do not churn this snapshot.
 *
 * @property pageLabels Page-tab captions in order (folder names, then A-Z letters, then `#`).
 * @property selectedPage Index of the visible page tab.
 * @property pageItems Tracks on the visible page, each with its load-order queue index.
 * @property currentIndex Load-order index of the current track, or null when nothing is selected.
 * @property playing Whether audio is currently playing.
 * @property shuffle Active shuffle/scope mode.
 * @property repeatTrack Whether "repeat track" is on.
 * @property volume Output gain in `0.0..1.0`.
 * @property queueSize Number of tracks in the queue.
 * @property loading Whether a library load or folder scan is in progress, so the screen can show a
 *   loading notice rather than the empty-library message while a slow source scan runs; an empty
 *   queue means "no music" only once this is false.
 */
data class PlayerUiState(
    val pageLabels: List<String> = emptyList(),
    val selectedPage: Int = 0,
    val pageItems: List<PageEntry> = emptyList(),
    val currentIndex: Int? = null,
    val playing: Boolean = false,
    val shuffle: ShuffleMode = ShuffleMode.OFF,
    val repeatTrack: Boolean = false,
    val volume: Float = 1.0f,
    val queueSize: Int = 0,
    val loading: Boolean = false,
)
