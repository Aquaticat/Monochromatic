package dev.monochromatic.musicplayer.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Host JVM unit tests for [Session] and [isAudioFile], ported from the desktop's `session_tests.rs`
 * (and the `is_audio_file` case in `playback_tests.rs`) so the Kotlin port stays faithful to the
 * Rust behavior. The desktop's prune tests write real temp files so `Path::exists` is true; here
 * that filesystem check is supplied as a predicate over a set of "present" paths, keeping the same
 * path vectors and the same expected survivors and cursor remapping without touching disk. The JSON
 * round-trip test becomes a field-by-field plus structural-equality check, since this core carries
 * no serialization library.
 */
class SessionTest {
    /**
     * Predicate building a stand-in for the desktop's `Path::exists` from an explicit set of present
     * paths, so prune tests stay deterministic and disk-free.
     *
     * @param present Paths to report as existing.
     * @return Predicate true exactly for the [present] paths.
     */
    private fun existsAmong(present: Set<String>): (String) -> Boolean = { it in present }

    @Test
    fun roundTripPreservesFields() {
        val original = Session(
            tracks = listOf("/a.flac", "/b.opus"),
            current = 1,
            positionSecs = 12.5,
            volume = 0.7f,
            shuffle = ShuffleMode.WITHIN_PAGE,
            repeatTrack = true,
        )
        val back = original.copy()
        assertEquals(original.tracks, back.tracks)
        assertEquals(original.current, back.current)
        assertEquals(original.positionSecs, back.positionSecs, 0.0)
        assertEquals(original.volume, back.volume, 0.0f)
        assertEquals(original.shuffle, back.shuffle)
        assertEquals(original.repeatTrack, back.repeatTrack)
        assertEquals(original, back)
    }

    @Test
    fun pruneDropsMissingAndRemapsCurrent() {
        val present = "/tmp/player_prune_test_present.wav"
        val missing = "/tmp/player_prune_test_missing_xyz.wav"
        val session = Session(
            tracks = listOf(missing, present),
            current = 1,
            positionSecs = 5.0,
            volume = 1.0f,
            shuffle = ShuffleMode.OFF,
            repeatTrack = false,
        )
        val pruned = session.pruneUnplayable(existsAmong(setOf(present)))
        assertEquals(1, pruned.tracks.size)
        assertEquals(present, pruned.tracks[0])
        assertEquals(0 as Int?, pruned.current)
    }

    @Test
    fun pruneClearsPositionWhenCurrentTrackGone() {
        val session = Session(
            tracks = listOf("/definitely/not/here_404.flac"),
            current = 0,
            positionSecs = 9.0,
            volume = 1.0f,
            shuffle = ShuffleMode.OFF,
            repeatTrack = false,
        )
        val pruned = session.pruneUnplayable(existsAmong(emptySet()))
        assertEquals(0, pruned.tracks.size)
        assertNull(pruned.current)
        assertEquals(0.0, pruned.positionSecs, 0.0)
    }

    @Test
    fun pruneDropsPresentNonAudioAndRemapsCurrent() {
        val junk = "/tmp/player_prune_cover_xyz.jpg"
        val audio = "/tmp/player_prune_song_xyz.flac"
        val session = Session(
            tracks = listOf(junk, audio),
            current = 1,
            positionSecs = 3.0,
            volume = 1.0f,
            shuffle = ShuffleMode.OFF,
            repeatTrack = false,
        )
        val pruned = session.pruneUnplayable(existsAmong(setOf(junk, audio)))
        assertEquals(listOf(audio), pruned.tracks)
        assertEquals(0 as Int?, pruned.current)
    }

    @Test
    fun isAudioFileMatchesExtensionsCaseInsensitively() {
        assertTrue(isAudioFile("a.flac"))
        assertTrue(isAudioFile("A.FLAC"))
        assertTrue(isAudioFile("/x/y/b.OpUs"))
        assertFalse(isAudioFile("cover.jpg"))
        assertFalse(isAudioFile(".DS_Store"))
        assertFalse(isAudioFile("noext"))
    }
}
