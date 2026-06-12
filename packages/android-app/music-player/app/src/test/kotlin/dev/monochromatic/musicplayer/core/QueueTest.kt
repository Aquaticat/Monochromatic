package dev.monochromatic.musicplayer.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Host JVM unit tests for [Queue], ported from the desktop's `queue_tests.rs` so the Kotlin port
 * stays faithful to the Rust behavior. The cursor/scope tests carry the Rust vectors verbatim; the
 * shuffle tests already assert RNG-independent invariants (coverage and page confinement) in the
 * oracle, so they port unchanged, and two extra tests pin the seeded-shuffle invariants the RNG
 * caveat calls for: a shuffled scope is a permutation of exactly the in-scope tracks, and the same
 * seed yields the same order.
 */
class QueueTest {
    /**
     * Build [n] fake root-level paths "0".."n-1" (no folder, so they share one `#` letter page),
     * mirroring the Rust `paths` helper.
     *
     * @param n Number of dummy tracks.
     * @return Distinct dummy paths with no folder, in load order.
     */
    private fun paths(n: Int): List<String> = (0 until n).map { it.toString() }

    /**
     * Turn string literals (often with folders like "A/1.flac") into paths, mirroring the Rust
     * `track_paths` helper.
     *
     * @param list Track path literals.
     * @return The same paths as a list, preserving folders.
     */
    private fun trackPaths(vararg list: String): List<String> = list.toList()

    @Test
    fun emptyQueueHasNoCurrentAndAdvanceIsNone() {
        val q = Queue.withRngSeed(1)
        assertNull(q.currentIndex())
        assertNull(q.advance(false))
        assertTrue(q.isEmpty())
    }

    @Test
    fun setTracksStartsAtFirst() {
        val q = Queue.withRngSeed(1)
        q.setTracks(paths(3))
        assertEquals(0, q.currentIndex())
        assertEquals(3, q.len())
    }

    @Test
    fun advanceLoopsWithinScopeWhenRepeatTrackOff() {
        val q = Queue.withRngSeed(1)
        q.setTracks(paths(3))
        assertEquals(1, q.advance(false))
        assertEquals(2, q.advance(false))
        assertEquals(0, q.advance(false))
        assertEquals(1, q.advance(false))
    }

    @Test
    fun repeatTrackReplaysOnNaturalEndOnly() {
        val q = Queue.withRngSeed(1)
        q.setTracks(paths(3))
        q.setRepeatTrack(true)
        assertEquals(0, q.advance(true))
        assertEquals(1, q.advance(false))
    }

    @Test
    fun prevStepsBackThenWrapsToLast() {
        val q = Queue.withRngSeed(1)
        q.setTracks(paths(3))
        assertEquals(1, q.advance(false))
        assertEquals(0, q.prev())
        assertEquals(2, q.prev())
    }

    @Test
    fun playIndexSelectsTrack() {
        val q = Queue.withRngSeed(1)
        q.setTracks(paths(5))
        assertEquals(3, q.playIndex(3))
        assertEquals(3, q.currentIndex())
        assertNull(q.playIndex(99))
        assertEquals(3, q.currentIndex())
    }

    @Test
    fun shuffleAllKeepsCurrentTrackAndCoversAll() {
        val q = Queue.withRngSeed(12345)
        q.setTracks(paths(6))
        assertEquals(1, q.advance(false))
        assertEquals(2, q.advance(false))
        q.setShuffle(ShuffleMode.ALL)
        assertEquals(2, q.currentIndex())
        val seen: MutableSet<Int> = mutableSetOf()
        seen.add(2)
        repeat(6) {
            q.advance(false)?.let { seen.add(it) }
        }
        assertEquals(6, seen.size)
    }

    @Test
    fun turningShuffleOffRestoresLoadOrder() {
        val q = Queue.withRngSeed(999)
        q.setTracks(paths(4))
        q.setShuffle(ShuffleMode.ALL)
        q.setShuffle(ShuffleMode.OFF)
        assertEquals(0, q.currentIndex())
        assertEquals(1, q.advance(false))
        assertEquals(2, q.advance(false))
        assertEquals(3, q.advance(false))
    }

    @Test
    fun shuffleOffConfinesToTopFolderPage() {
        val q = Queue.withRngSeed(1)
        q.setTracks(trackPaths("A/1.flac", "A/2.flac", "B/3.flac"))
        assertEquals(0, q.currentIndex())
        assertEquals(1, q.advance(false))
        assertEquals(0, q.advance(false))
        assertEquals(1, q.advance(false))
    }

    @Test
    fun shuffleWithinPageCoversOnlyCurrentPage() {
        val q = Queue.withRngSeed(777)
        q.setTracks(trackPaths("A/1.flac", "A/2.flac", "A/3.flac", "B/4.flac"))
        q.setShuffle(ShuffleMode.WITHIN_PAGE)
        assertEquals(0, q.currentIndex())
        val seen: MutableSet<Int> = mutableSetOf()
        seen.add(q.currentIndex()!!)
        repeat(3) {
            seen.add(q.advance(false)!!)
        }
        assertFalse(seen.contains(3))
        assertEquals(3, seen.size)
    }

    @Test
    fun shuffleAllCrossesPages() {
        val q = Queue.withRngSeed(55)
        q.setTracks(trackPaths("A/1.flac", "A/2.flac", "B/3.flac"))
        q.setShuffle(ShuffleMode.ALL)
        val seen: MutableSet<Int> = mutableSetOf()
        seen.add(q.currentIndex()!!)
        repeat(3) {
            seen.add(q.advance(false)!!)
        }
        assertEquals(3, seen.size)
        assertTrue(seen.contains(2))
    }

    @Test
    fun playIndexSwitchesPageScope() {
        val q = Queue.withRngSeed(1)
        q.setTracks(trackPaths("A/1.flac", "A/2.flac", "B/3.flac"))
        assertEquals(2, q.playIndex(2))
        assertEquals(2, q.currentIndex())
        assertEquals(2, q.advance(false))
        assertEquals(2, q.advance(false))
    }

    @Test
    fun playbackOrderAndCursorTrackTheTimelineWindow() {
        val q = Queue.withRngSeed(1)
        q.setTracks(paths(4))
        assertEquals(listOf(0, 1, 2, 3), q.playbackOrder())
        assertEquals(0, q.cursorPosition())
        q.advance(false)
        assertEquals(1, q.cursorPosition())
        assertEquals(q.playbackOrder()[q.cursorPosition()!!], q.currentIndex())
    }

    @Test
    fun emptyQueueHasNoCursor() {
        val q = Queue.withRngSeed(1)
        assertTrue(q.playbackOrder().isEmpty())
        assertNull(q.cursorPosition())
    }

    @Test
    fun moveCursorToJumpsToScopePositionAndRejectsOutOfRange() {
        val q = Queue.withRngSeed(1)
        q.setTracks(paths(4))
        assertEquals(2, q.moveCursorTo(2))
        assertEquals(2, q.currentIndex())
        assertEquals(2, q.cursorPosition())
        assertNull(q.moveCursorTo(4))
        assertNull(q.moveCursorTo(-1))
        assertEquals(2, q.cursorPosition())
    }

    @Test
    fun moveCursorToFollowsScopeOrderUnderShuffle() {
        val q = Queue.withRngSeed(31)
        q.setTracks(paths(6))
        q.setShuffle(ShuffleMode.ALL)
        val order: List<Int> = q.playbackOrder()
        assertEquals(order[3], q.moveCursorTo(3))
        assertEquals(order[3], q.currentIndex())
    }

    @Test
    fun displayPathsStripsCommonPrefix() {
        val q = Queue.withRngSeed(1)
        q.setTracks(listOf("/music/A/Alb/01.flac", "/music/B/Alb/01.flac"))
        assertEquals(
            listOf("A/Alb/01.flac", "B/Alb/01.flac"),
            q.displayPaths(),
        )
    }

    //region Seeded-shuffle invariants (replace the Rust RNG's exact-order coverage with
    // RNG-independent checks per the port's RNG caveat)
    @Test
    fun shuffleAllScopeIsPermutationOfWholeQueue() {
        val q = Queue.withRngSeed(2024)
        q.setTracks(paths(8))
        q.setShuffle(ShuffleMode.ALL)
        val seen: MutableSet<Int> = mutableSetOf()
        seen.add(q.currentIndex()!!)
        repeat(8) {
            seen.add(q.advance(false)!!)
        }
        assertEquals((0 until 8).toSet(), seen)
    }

    @Test
    fun sameSeedYieldsSameShuffleOrder() {
        val first = Queue.withRngSeed(424242)
        first.setTracks(paths(10))
        first.setShuffle(ShuffleMode.ALL)
        val firstOrder: List<Int> = (0 until 10).map { first.advance(false)!! }

        val second = Queue.withRngSeed(424242)
        second.setTracks(paths(10))
        second.setShuffle(ShuffleMode.ALL)
        val secondOrder: List<Int> = (0 until 10).map { second.advance(false)!! }

        assertEquals(firstOrder, secondOrder)
    }
    //endregion
}
