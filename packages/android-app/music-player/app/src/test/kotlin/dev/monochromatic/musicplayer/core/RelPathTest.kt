package dev.monochromatic.musicplayer.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Host JVM unit tests for [relativeDisplayPaths], ported one-to-one from the desktop's
 * `relpath_tests.rs` so the Kotlin port stays faithful to the Rust behavior.
 */
class RelPathTest {
    @Test
    fun emptyInputYieldsEmpty() {
        assertTrue(relativeDisplayPaths(emptyList()).isEmpty())
    }

    @Test
    fun singleTrackKeepsOnlyFilename() {
        assertEquals(
            listOf("01.flac"),
            relativeDisplayPaths(listOf("/music/Artist/Album/01.flac")),
        )
    }

    @Test
    fun distinctAlbumsKeepRelativeFolders() {
        assertEquals(
            listOf("A/Alb/01.flac", "B/Alb/01.flac"),
            relativeDisplayPaths(listOf("/music/A/Alb/01.flac", "/music/B/Alb/01.flac")),
        )
    }

    @Test
    fun singleFolderYieldsBareFilenames() {
        assertEquals(
            listOf("01.flac", "02.flac"),
            relativeDisplayPaths(listOf("/m/A/Alb/01.flac", "/m/A/Alb/02.flac")),
        )
    }

    @Test
    fun mixedDepthStripsOnlySharedTop() {
        assertEquals(
            listOf("loose.flac", "A/Alb/01.flac"),
            relativeDisplayPaths(listOf("/m/loose.flac", "/m/A/Alb/01.flac")),
        )
    }

    @Test
    fun duplicatePathsKeepFilename() {
        assertEquals(
            listOf("x.flac", "x.flac"),
            relativeDisplayPaths(listOf("/m/A/x.flac", "/m/A/x.flac")),
        )
    }
}
