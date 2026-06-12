package dev.monochromatic.musicplayer.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Host JVM unit tests for [sanitizeComponent] and [joinDisplayPath], the boundary where a
 * `DocumentsProvider`-supplied name becomes one path segment. A Storage Access Framework provider
 * (unlike a real filesystem) can hand back a name containing the path separator, `..`, or control
 * characters, so these cover the adversarial cases the transformer must neutralize: a separator
 * inside a name must not widen the path's depth (pagination keys folders on separator count), a
 * control character must not break single-line title display, and `..` must pass through untouched
 * because no path here is resolved against a filesystem.
 */
class DisplayPathTest {
    @Test
    fun joinsUnderAPrefixWithASingleSeparator() {
        assertEquals("Artist/Album/01 song.flac", joinDisplayPath("Artist/Album", "01 song.flac"))
    }

    @Test
    fun rootFileHasNoSeparator() {
        val got = joinDisplayPath("", "loose.flac")
        assertEquals("loose.flac", got)
        assertFalse("a root file must contribute no separator", got.contains('/'))
    }

    @Test
    fun separatorInsideANameCannotWidenDepth() {
        // A provider name "AC/DC" must become one segment, not two folder levels.
        val got = joinDisplayPath("Rock", "AC/DC - song.flac")
        assertEquals(1, got.count { it == '/' })
        assertFalse("the embedded slash must be neutralized", got.contains("AC/DC"))
        assertTrue(got.startsWith("Rock/"))
    }

    @Test
    fun controlCharactersCollapseToSpaces() {
        assertEquals("a b c", joinDisplayPath("", "a\nb\tc"))
        assertEquals("side a side b", joinDisplayPath("", "side a\rside b"))
    }

    @Test
    fun dotDotPassesThroughUnchanged() {
        // ".." is harmless: the playable URI is built from a document id, never from this path.
        assertEquals("Music/..", joinDisplayPath("Music", ".."))
    }

    @Test
    fun ordinaryNamesAreUnchanged() {
        assertEquals("Café del Mar", sanitizeComponent("Café del Mar"))
        assertEquals("track [01].opus", sanitizeComponent("track [01].opus"))
    }
}
