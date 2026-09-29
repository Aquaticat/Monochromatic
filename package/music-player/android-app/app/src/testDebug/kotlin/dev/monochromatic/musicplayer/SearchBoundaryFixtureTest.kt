// What: Compare two debug-only result fixtures before a user chooses middle-of-word matching.
// Why: Both options must preserve the already selected D/M results and differ only in direct interior hits.
package dev.monochromatic.musicplayer

// What: `Color` supplies theme-like ink and fill for a pure highlight-range check.
// Why: The interior matching characters should receive the existing D59 cues.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Color } from './ui-colors';
// ```
import androidx.compose.ui.graphics.Color

// What: `assertEquals` checks exact row order and span offsets.
// Why: A comparison that accidentally changes the accepted controls cannot answer the user's question.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect } from 'test';
// ```
import org.junit.Assert.assertEquals

// `assertTrue` checks that parent-only tracks remain absent from both direct-name variants.
import org.junit.Assert.assertTrue

// What: `Test` registers independent host-JVM checks for the Android debug variant.
// Why: No emulator, keyboard or user library is needed to verify fixture membership.
//
// In TS you'd write (pseudocode):
// ```ts
// test('...', () => { /* assertions */ });
// ```
import org.junit.Test

/**
 * What: Assert the selected direct-name controls stay fixed while optional interior-word rows appear.
 * Why: A visual comparison needs one independently varying rule, not a hidden scope or ranking change.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * describe('middle-of-word fixture', () => { /* ordered results and spans */ });
 * ```
 */
class SearchBoundaryFixtureTest {
    /** Checks that both variants retain the accepted exact, prefix and later-word examples. */
    @Test
    fun acceptedDirectNameControlsStayInMixedOrder() {
        val expected = listOf("Cam", "Camellia", "Live at Camellia")
        val wordStart = searchBoundaryHits(allowInterior = false)
        val anywhere = searchBoundaryHits(allowInterior = true)

        assertEquals(expected, wordStart.map { it.title })
        assertEquals(expected, anywhere.take(expected.size).map { it.title })
        assertEquals(listOf("Track", "Folder", "Track"), wordStart.map { it.kind })
        assertTrue(wordStart.none { it.title == "Another Xronixle" })
        assertTrue(anywhere.none { it.title == "Another Xronixle" })
    }

    /** Checks that middle-of-word matches occur only in the anywhere-substring variant. */
    @Test
    fun onlyAnywhereVariantAddsInteriorDirectTrackNames() {
        val wordStart = searchBoundaryHits(allowInterior = false)
        val anywhere = searchBoundaryHits(allowInterior = true)

        assertEquals(3, wordStart.size)
        assertEquals(listOf("Scamper", "Dreamcam"), anywhere.drop(wordStart.size).map { it.title })
        assertTrue(anywhere.drop(wordStart.size).all { it.kind == "Track" })
    }

    /** Checks D59's paint locates the interior substring without highlighting unrelated letters. */
    @Test
    fun interiorExamplesHighlightOnlyTheirCamSubstrings() {
        val foreground = Color(0xFF30323A)
        val fill = Color(0xFFC6D0E7)
        val scamper = highlightFixtureMatches("Scamper", "cam", foreground, fill)
        val dreamcam = highlightFixtureMatches("Dreamcam", "cam", foreground, fill)

        assertEquals(listOf(1 to 4), scamper.spanStyles.map { it.start to it.end })
        assertEquals(listOf(5 to 8), dreamcam.spanStyles.map { it.start to it.end })
    }
}
