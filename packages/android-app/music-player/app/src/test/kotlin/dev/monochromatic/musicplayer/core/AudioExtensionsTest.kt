package dev.monochromatic.musicplayer.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Host JVM unit tests for [isAudioFile] and [audioFilesSorted], ported from the desktop's
 * `playback_tests.rs` so the Kotlin port stays faithful to the Rust behavior. The predicate test
 * ports one-to-one; the two filesystem-walk tests are adapted to the pure [audioFilesSorted]
 * ordering primitive with the same filename vectors and expected results, since the recursive
 * directory traversal they exercised in Rust is deferred to the Android storage layer.
 */
class AudioExtensionsTest {
    @Test
    fun isAudioFileMatchesExtensionsCaseInsensitively() {
        assertTrue(isAudioFile("a.flac"))
        assertTrue(isAudioFile("A.FLAC"))
        assertTrue(isAudioFile("/x/y/b.OpUs"))
        assertFalse(isAudioFile("cover.jpg"))
        assertFalse(isAudioFile(".DS_Store"))
        assertFalse(isAudioFile("noext"))
    }

    @Test
    fun isAudioFileRejectsLeadingDotEvenWhenExtensionWouldMatch() {
        assertFalse(isAudioFile(".flac"))
        assertFalse(isAudioFile("/music/.opus"))
    }

    @Test
    fun isAudioFileAcceptsEveryAllowlistedExtension() {
        AUDIO_EXTENSIONS.forEach { extension ->
            assertTrue(extension, isAudioFile("track.$extension"))
        }
    }

    @Test
    fun isAudioFileIgnoresDotsInParentDirectories() {
        assertFalse(isAudioFile("/cover.jpg/noext"))
        assertTrue(isAudioFile("/album.2020/01.flac"))
    }

    @Test
    fun audioFilesSortedKeepsOnlyAudioFilesAndSkipsJunk() {
        val got =
            audioFilesSorted(
                listOf(
                    "song.mp3",
                    "tune.flac",
                    "cover.jpg",
                    "playlist.m3u",
                    ".DS_Store",
                    ".nomedia",
                    ".database_uuid",
                ),
            )
        assertEquals(listOf("song.mp3", "tune.flac"), got)
    }

    @Test
    fun audioFilesSortedSortsRetainedFiles() {
        assertEquals(
            listOf("a.flac", "b.flac"),
            audioFilesSorted(listOf("b.flac", "a.flac")),
        )
    }

    @Test
    fun audioFilesSortedIsCaseSensitiveCodeUnitOrder() {
        assertEquals(
            listOf("A.flac", "a.flac"),
            audioFilesSorted(listOf("a.flac", "A.flac")),
        )
    }

    @Test
    fun audioFilesSortedYieldsEmptyWhenNoAudioPresent() {
        assertTrue(audioFilesSorted(listOf("cover.jpg", ".nomedia", "noext")).isEmpty())
    }
}
