// Unit tests for the duration cache text codec: the round trip and the handling of damaged lines.

// What:     This package matches the codec's package, so the tests reach its functions directly.
// Why:      The codec is platform-free, so its rules are checked without a device.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the path.
// ```
package dev.monochromatic.musicplayer.core

// What:     JUnit assertions and the test annotation for the codec rules.
// Why:      Each round trip and each dropped line is checked exactly.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect, test } from "test";
// ```
import org.junit.Assert.assertEquals
import org.junit.Test

// What:     `class MeasureDurationStoreTest` groups the codec tests.
// Why:      The write and the read of the cache file are one feature.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("duration cache codec", () => { /* ... */ });
// ```
/** Verifies that the duration cache text round trips and that damaged lines are dropped. */
class MeasureDurationStoreTest {
    // What:     `@Test fun roundTripKeepsEveryEntry()` writes the cache and reads it back unchanged.
    // Why:      A saved duration must come back for the same fingerprint, including a negative fingerprint.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("round trip", () => expect(decodeDurations(encodeDurations(m))).toEqual(m));
    // ```
    /** Every entry, including a negative fingerprint, survives a write and a read. */
    @Test
    fun roundTripKeepsEveryEntry() {
        val durations: Map<Long, Long> = mapOf(1L to 275_000L, -42L to 3_000L, Long.MAX_VALUE to 0L)
        assertEquals(durations, measureDecodeDurations(measureEncodeDurations(durations)))
    }

    // What:     `@Test fun emptyCacheWritesNothing()` checks that an empty cache writes an empty file.
    // Why:      A fresh install has no durations, and its file must read back as an empty map.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("empty", () => expect(encodeDurations(new Map())).toBe(""));
    // ```
    /** An empty map encodes to empty text and decodes back to an empty map. */
    @Test
    fun emptyCacheWritesNothing() {
        assertEquals("", measureEncodeDurations(emptyMap()))
        assertEquals(emptyMap<Long, Long>(), measureDecodeDurations(""))
    }

    // What:     `@Test fun damagedLinesAreDroppedAndGoodLinesKept()` feeds malformed, negative, and valid lines.
    // Why:      One damaged line must cost only its own track, never the whole cache.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("damaged", () => expect(decodeDurations(text)).toEqual(new Map([[1n, 5n]])));
    // ```
    /** Lines with a wrong field count, a non-number, or a negative duration are skipped; valid lines remain. */
    @Test
    fun damagedLinesAreDroppedAndGoodLinesKept() {
        val text = listOf(
            "1\t5000",
            "not-a-number\t5000",
            "2\t-7",
            "3",
            "4\t6000\t7",
            "",
            "5\tabc",
        ).joinToString(separator = "\n")
        assertEquals(mapOf(1L to 5000L), measureDecodeDurations(text))
    }
}
