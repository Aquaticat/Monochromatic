// Migration matrix for the former Android shuffle and repeat fields.

// What:     This package matches PlaybackMode's package.
// Why:      Tests exercise its storage-boundary helpers directly.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the path.
// ```
package dev.monochromatic.musicplayer.core

// What:     JUnit's value assertion and test annotation register matrix checks.
// Why:      Every legacy combination needs an explicit expected mode.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect, test } from "test";
// ```
import org.junit.Assert.assertEquals
import org.junit.Test

/** Verifies current decoding and every former shuffle/repeat combination. */
class PlaybackModeTest {
    /** Maps all six valid old combinations according to issue 460. */
    @Test
    fun migratesEveryLegacyCombination() {
        val cases: List<Triple<String, Boolean, PlaybackMode>> = listOf(
            Triple("OFF", false, PlaybackMode.IN_ORDER),
            Triple("WITHIN_PAGE", false, PlaybackMode.SHUFFLE_PAGE),
            Triple("ALL", false, PlaybackMode.SHUFFLE_ALL),
            Triple("OFF", true, PlaybackMode.REPEAT),
            Triple("WITHIN_PAGE", true, PlaybackMode.REPEAT),
            Triple("ALL", true, PlaybackMode.REPEAT),
        )
        cases.forEach { (shuffle, repeat, expected) ->
            assertEquals(expected, PlaybackMode.fromLegacy(shuffle, repeat))
        }
    }

    /** Uses In order for missing, corrupt, or future legacy shuffle text. */
    @Test
    fun unknownLegacyShuffleFallsBackToInOrder() {
        assertEquals(PlaybackMode.IN_ORDER, PlaybackMode.fromLegacy(null, false))
        assertEquals(PlaybackMode.IN_ORDER, PlaybackMode.fromLegacy("FUTURE", false))
    }

    /** Decodes all explicit current wire values and rejects unknown text safely. */
    @Test
    fun decodesCurrentStoredNames() {
        PlaybackMode.entries.forEach { mode ->
            assertEquals(mode, PlaybackMode.fromStoredName(mode.storedName))
        }
        assertEquals(PlaybackMode.IN_ORDER, PlaybackMode.fromStoredName("future_mode"))
    }
}
