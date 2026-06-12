package dev.monochromatic.musicplayer.core

import kotlin.random.Random

/**
 * The play queue: an ordered list of tracks plus a cursor, with shuffle and "repeat track" behavior.
 * Pure logic, no audio, no I/O, so it is fully unit-tested. Faithful port of the desktop's
 * `queue.rs`.
 *
 * Playback has a scope that it loops over, chosen by the shuffle mode (see [ShuffleMode]):
 *
 * - [ShuffleMode.OFF] and [ShuffleMode.WITHIN_PAGE] confine playback to the current track's page
 *   (its top-level folder under the loaded root, or its A-Z/`#` letter bucket for a root-level
 *   track; the same grouping the UI tabs use, computed by [paginate]). [ShuffleMode.OFF] plays the
 *   page in load order; [ShuffleMode.WITHIN_PAGE] shuffles the page. Either way, reaching the end of
 *   the page loops back to its start.
 * - [ShuffleMode.ALL] scopes playback to the whole queue, shuffled, and loops the whole queue.
 *
 * "Repeat track" is independent: when on, a track that ends naturally replays itself; a manual
 * Next/Prev still moves within the scope. Because [ShuffleMode.OFF]/[ShuffleMode.WITHIN_PAGE] are
 * page-confined and always loop the page, there is deliberately no way to play the whole queue in
 * load order and loop the whole queue; when not shuffling, the user stays inside the current page.
 *
 * The desktop's deterministic shuffle uses a seeded xorshift64 PRNG. That exact cross-language
 * sequence is not portable, so this port shuffles with a seeded [Random]; the same seed still yields
 * the same order on this platform, which is what the tests (and the session restore) rely on.
 *
 * @constructor Builds an empty queue driven by the given seeded [Random]; use [withRngSeed] or [new]
 *   instead of calling this directly.
 * @param rng Seeded random source for the Fisher-Yates shuffle.
 */
class Queue private constructor(private val rng: Random) {
    //region State
    /** Tracks in the order the user loaded them; the displayed queue list uses this order. */
    private var tracks: List<String> = emptyList()

    /**
     * Current scope's playback order: the load-order indices of the tracks playback walks right now
     * (the current page for [ShuffleMode.OFF]/[ShuffleMode.WITHIN_PAGE], or the whole queue for
     * [ShuffleMode.ALL]), sequential or shuffled.
     */
    private var order: List<Int> = emptyList()

    /** Cursor's position within [order]; `null` means the queue is empty / nothing selected. */
    private var pos: Int? = null

    /** Three-state shuffle/scope setting; decides both the scope and the ordering. */
    private var shuffle: ShuffleMode = ShuffleMode.OFF

    /** When true, a track that ends naturally replays itself; the "repeat track" checkbox. */
    private var repeatTrackFlag: Boolean = false
    //endregion

    //region Factories
    /**
     * Companion factories mirroring the Rust `new`/`with_rng_seed` constructors.
     */
    companion object {
        /**
         * Create an empty queue seeded from the wall clock so first-run shuffles differ between
         * launches, mirroring the Rust `Queue::new`.
         *
         * @return Fresh empty queue with a nondeterministic shuffle seed.
         */
        fun new(): Queue = withRngSeed(System.nanoTime())

        /**
         * Create an empty queue with a caller-chosen PRNG seed, mirroring the Rust
         * `Queue::with_rng_seed`; tests pass a fixed seed to get a deterministic shuffle.
         *
         * @param seed Seed for the shuffle's [Random]; the same seed yields the same shuffle order.
         * @return Fresh empty queue whose shuffles are determined by [seed].
         */
        fun withRngSeed(seed: Long): Queue = Queue(Random(seed))
    }
    //endregion

    //region Read-only accessors
    /**
     * Number of tracks in the queue.
     *
     * @return Count of loaded tracks.
     */
    fun len(): Int = tracks.size

    /**
     * Tracks in load order (as opened), regardless of shuffle; the session save persists these.
     *
     * @return Read-only view of the load-order paths.
     */
    fun tracks(): List<String> = tracks

    /**
     * Whether the queue has no tracks.
     *
     * @return True when the queue is empty.
     */
    fun isEmpty(): Boolean = tracks.isEmpty()

    /**
     * Whether "repeat track" is on; the engine mirrors this flag to the UI checkbox.
     *
     * @return Current "repeat track" flag.
     */
    fun repeatTrack(): Boolean = repeatTrackFlag

    /**
     * Current shuffle mode; the engine mirrors it to the UI radio group.
     *
     * @return Active [ShuffleMode].
     */
    fun shuffleMode(): ShuffleMode = shuffle

    /**
     * Display strings in load order: each track's path relative to the queue's common root, so the
     * UI shows the folder a track lives in and pagination can group by folder.
     *
     * @return One relative display string per track, in load order.
     */
    fun displayPaths(): List<String> = relativeDisplayPaths(tracks)

    /**
     * Load-order index of the current track, or `null`; the UI highlights this row.
     *
     * @return Index into [tracks] of the current track, or `null` when nothing is selected.
     */
    fun currentIndex(): Int? = pos?.let { order[it] }

    /**
     * Path of the current track, or `null`; the engine needs it to open the file.
     *
     * @return Current track's load-order path, or `null` when nothing is selected.
     */
    fun currentPath(): String? = currentIndex()?.let { tracks[it] }

    /**
     * Current scope's playback order as load-order indices: the sequence playback walks right now,
     * the same order a [MediaSession] timeline must report so its (framework-computed) next/previous
     * navigation matches this queue. Position `i` in the result is timeline window index `i`.
     *
     * @return Load-order indices in playback order; empty when the queue is empty.
     */
    fun playbackOrder(): List<Int> = order

    /**
     * Cursor's position within [playbackOrder] (the current timeline window index), or `null` when
     * the queue is empty; the [MediaSession] reports this as the current media-item index.
     *
     * @return Index into [playbackOrder] of the current track, or `null` when nothing is selected.
     */
    fun cursorPosition(): Int? = pos
    //endregion

    //region Mutators
    /**
     * Toggle "repeat track"; [advance] reads it on a natural end.
     *
     * @param on New "repeat track" flag.
     */
    fun setRepeatTrack(on: Boolean) {
        repeatTrackFlag = on
    }

    /**
     * Replace the queue when the user opens new files, anchoring playback on the first track (or
     * leaving it empty when there are no tracks).
     *
     * @param newTracks Replacement tracks in load order.
     */
    fun setTracks(newTracks: List<String>) {
        tracks = newTracks
        rebuildScopeOrder(0)
    }

    /**
     * Change the shuffle/scope mode while keeping the currently-playing track current, so switching
     * shuffle does not interrupt the current song.
     *
     * @param mode New [ShuffleMode]; a no-op change is ignored so the cursor never jumps needlessly.
     */
    fun setShuffle(mode: ShuffleMode) {
        if (mode == shuffle) return
        val current: Int? = currentIndex()
        shuffle = mode
        rebuildScopeOrder(current)
    }

    /**
     * Select a specific track as current, switching the playback scope when the track is on another
     * page; the user clicked a row in the queue list.
     *
     * @param track Load-order index of the clicked track.
     * @return The now-current track index, or `null` for an out-of-range click (which moves nothing).
     */
    fun playIndex(track: Int): Int? {
        if (track >= tracks.size) return null
        val position: Int = order.indexOf(track)
        if (position >= 0) {
            pos = position
        } else {
            rebuildScopeOrder(track)
        }
        return track
    }

    /**
     * Move to the next track within the scope, looping to the scope's start at the end; a track that
     * ends naturally under "repeat track" replays itself instead.
     *
     * @param natural True when a track ended on its own, false when the user pressed Next; only a
     *   natural end honors "repeat track".
     * @return Load-order index of the track to play next, or `null` when the queue is empty.
     */
    fun advance(natural: Boolean): Int? {
        val current: Int = pos ?: return null
        if (natural && repeatTrackFlag) {
            return order[current]
        }
        val next: Int = current + 1
        if (next < order.size) {
            pos = next
            return order[next]
        }
        pos = 0
        return order[0]
    }

    /**
     * Move the cursor straight to scope position [scopeIndex] (a timeline window index), without
     * changing the scope; used when a [MediaSession] seek (Next/Previous from the notification, or a
     * jump to a queue item) resolves to an index the framework already computed against the reported
     * order. Out-of-range indices move nothing, matching the framework's `C.INDEX_UNSET` no-op.
     *
     * @param scopeIndex Target position within [playbackOrder].
     * @return Load-order index now current, or `null` when [scopeIndex] is out of range.
     */
    fun moveCursorTo(scopeIndex: Int): Int? {
        if (scopeIndex < 0 || scopeIndex >= order.size) {
            return null
        }
        pos = scopeIndex
        return order[scopeIndex]
    }

    /**
     * Move to the previous track within the scope, wrapping to the scope's end at the start; the
     * user pressed Previous.
     *
     * @return Load-order index of the previous track, or `null` when the queue is empty.
     */
    fun prev(): Int? {
        val current: Int = pos ?: return null
        if (current > 0) {
            pos = current - 1
            return order[current - 1]
        }
        val last: Int = order.size - 1
        pos = last
        return order[last]
    }
    //endregion

    //region Scope helpers
    /**
     * Load-order indices that make up the playback scope around the [anchor] track, in ascending
     * load order: the whole queue for [ShuffleMode.ALL], otherwise the anchor's page.
     *
     * @param anchor Load-order index the scope is centered on.
     * @return Scope indices in ascending load order; falls back to the whole queue when the anchor
     *   belongs to no page (an empty/invalid anchor), never producing an empty scope for a real
     *   track.
     */
    private fun scopeIndices(anchor: Int): List<Int> {
        if (shuffle == ShuffleMode.ALL) {
            return tracks.indices.toList()
        }
        val names: List<String> = displayPaths()
        val pages: List<Page> = paginate(names)
        val page: Int? = pageOfIndex(pages, anchor)
        return if (page != null) {
            pages[page].entries.map { it.index }
        } else {
            tracks.indices.toList()
        }
    }

    /**
     * Fisher-Yates shuffle of a scope's indices using the seeded [rng]; returns a new list so the
     * caller's input is left untouched.
     *
     * @param slice Scope indices to permute.
     * @return Shuffled copy of [slice]; unchanged for 0- or 1-element inputs.
     */
    private fun shuffleSlice(slice: List<Int>): List<Int> {
        if (slice.size < 2) return slice
        val result: MutableList<Int> = slice.toMutableList()
        var i: Int = result.size - 1
        while (i > 0) {
            val j: Int = rng.nextInt(i + 1)
            val swap: Int = result[i]
            result[i] = result[j]
            result[j] = swap
            i -= 1
        }
        return result
    }

    /**
     * Recompute the scope [order] and cursor [pos] so the [anchor] track stays current; called
     * whenever the scope might change ([setTracks], [setShuffle], [playIndex] to another page).
     *
     * @param anchor Load-order index to keep current, or `null` to default to the first track; a
     *   stale index past the end is clamped into range. An empty queue clears the order and cursor.
     */
    private fun rebuildScopeOrder(anchor: Int?) {
        if (tracks.isEmpty()) {
            order = emptyList()
            pos = null
            return
        }
        val clamped: Int = minOf(anchor ?: 0, tracks.size - 1)
        val scope: List<Int> = scopeIndices(clamped)
        val ordered: List<Int> = if (shuffle != ShuffleMode.OFF) shuffleSlice(scope) else scope
        val found: Int = ordered.indexOf(clamped)
        order = ordered
        pos = if (found < 0) 0 else found
    }
    //endregion
}
