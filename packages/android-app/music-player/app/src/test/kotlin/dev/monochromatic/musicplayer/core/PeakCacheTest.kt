package dev.monochromatic.musicplayer.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Host JVM unit tests for [fingerprint] and [PeakCache], ported from the desktop's
 * `peakcache_tests.rs` so the Kotlin port stays faithful to the Rust behavior.
 *
 * Both Rust tests reach the disk: the first stats a real temp file to source size and mtime, the
 * second round-trips the cache through a temp JSON file. Filesystem and JSON are platform I/O and
 * are deferred from this pure port, so each test is adapted to drive the pure surface directly,
 * feeding fixed (path, size, mtime) vectors instead of stat'ing a file and exercising the in-memory
 * map instead of save/reload. The expected fingerprints are the exact 64-bit FNV-1a outputs of the
 * Rust key material (path UTF-8 bytes, then size as 8 little-endian bytes, then mtime as 16
 * little-endian bytes).
 */
class PeakCacheTest {
    /**
     * Path used across the fingerprint vectors; its basename stands in for the Rust temp file's
     * `a.flac` suffix so the opacity assertion checks the same leak the Rust test guards.
     */
    private val trackPath: String = "/music/Artist/Album/a.flac"

    /**
     * Adapted from `fingerprint_is_stable_opaque_and_change_sensitive`: determinism, opacity (a
     * 16-char hex key that does not leak the path), and change-sensitivity to size and mtime. The
     * Rust file-stat and its missing-file `None` branch are deferred with the rest of the I/O layer.
     */
    @Test
    fun fingerprintIsStableOpaqueAndChangeSensitive() {
        val size = 5uL
        val mtimeNanos = 1_000_000_000uL

        val first = fingerprint(trackPath, size, mtimeNanos)
        // Same inputs fingerprint identically: determinism for cache hits.
        assertEquals(first, fingerprint(trackPath, size, mtimeNanos))
        // The key is the exact Rust 64-bit FNV-1a output for this material.
        assertEquals("75553bb5d36767ef", first)
        // The key is a 16-char hex string, not the path: no metadata exposed.
        assertEquals(16, first.length)
        assertFalse(first.contains("a.flac"))

        // A size change (re-encode) changes the key.
        assertNotEquals(first, fingerprint(trackPath, 6uL, mtimeNanos))
        // An mtime change (in-place edit) changes the key.
        assertNotEquals(first, fingerprint(trackPath, size, 2_000_000_000uL))
        // A path change changes the key.
        assertNotEquals(first, fingerprint("/music/Artist/Album/b.flac", size, mtimeNanos))
    }

    /**
     * Adapted from `save_and_reload_preserves_entries_without_metadata`: the pure in-memory map
     * preserves an inserted entry and reports a miss for an absent key. The disk save/reload and the
     * on-disk privacy assertions (the JSON holds only the opaque key, no `/`) are deferred with the
     * JSON layer; opacity of the key itself is covered by [fingerprintIsStableOpaqueAndChangeSensitive].
     */
    @Test
    fun insertAndGetPreservesEntries() {
        val cache = PeakCache()

        // Inserting a peak makes it retrievable by its key.
        cache.insert("deadbeef00000000", 0.75f)
        assertEquals(0.75f, cache.get("deadbeef00000000"))

        // A key that was never inserted is a miss.
        assertNull(cache.get("0000000000000000"))
    }
}
