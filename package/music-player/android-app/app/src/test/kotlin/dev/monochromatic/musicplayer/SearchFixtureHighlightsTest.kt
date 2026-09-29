// What: Exercise the debug-only visual match painter independently of an Android screen.
// Why: Every occurrence and the runtime OS-accent input must affect the review as described.
package dev.monochromatic.musicplayer

// What: `Color` is Compose's value for a runtime theme pigment.
// Why: Distinct test accents expose an accidental fixed highlight color.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Color } from './ui-colors';
// ```
import androidx.compose.ui.graphics.Color

// What: `FontWeight` names the bold style used as a second match cue.
// Why: A fill alone would rely on color to identify matches.
//
// In TS you'd write (pseudocode):
// ```ts
// type FontWeight = 'normal' | 'bold';
// ```
import androidx.compose.ui.text.font.FontWeight

// What: `assertEquals` compares actual results against the expected value.
// Why: Span starts, ends and styles must stay exact after future fixture edits.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect } from 'test';
// ```
import org.junit.Assert.assertEquals

// `assertTrue` proves that changing the runtime accent changes the derived fill.
import org.junit.Assert.assertTrue

// What: `Test` marks each host-JVM check for the Android package's existing test task.
// Why: It catches regressions without opening a keyboard or modifying user media.
//
// In TS you'd write (pseudocode):
// ```ts
// test('...', () => { /* assertions */ });
// ```
import org.junit.Test

/**
 * What: Verify literal match ranges and theme-color adaptation in debug-only Search evidence.
 * Why: The ranking review should not silently publish a missing match or fixed purple pigment.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * describe('Search fixture highlights', () => { /* repeat, empty and accent tests */ });
 * ```
 */
class SearchFixtureHighlightsTest {
    /**
     * What: Check repeated uppercase and lowercase occurrences in the same title.
     * Why: The user's "all matches" request includes subsequent occurrences, not only the first.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * expect(highlightFixtureMatches('Cam cam CAM', 'cam').spans.map(s => [s.start, s.end]))
     *   .toEqual([[0, 3], [4, 7], [8, 11]]);
     * ```
     */
    @Test
    fun repeatedCaseVariantsAllReceiveTheSameTwoCues() {
        val foreground = Color(0xFF30323A)
        val fill = Color(0xFFC6D0E7)
        val annotated = highlightFixtureMatches("Cam cam CAM", "cam", foreground, fill)

        assertEquals("Cam cam CAM", annotated.text)
        assertEquals(listOf(0, 4, 8), annotated.spanStyles.map { it.start })
        assertEquals(listOf(3, 7, 11), annotated.spanStyles.map { it.end })
        assertTrue(annotated.spanStyles.all { it.item.color == foreground &&
            it.item.background == fill && it.item.fontWeight == FontWeight.Bold })
    }

    /** Checks that a parent-only result highlights its supporting folder, not an unrelated title. */
    @Test
    fun parentOnlyResultHighlightsOnlyMatchingContext() {
        val foreground = Color(0xFF30323A)
        val fill = Color(0xFFC6D0E7)
        val title = highlightFixtureMatches("Another Xronixle", "cam", foreground, fill)
        val detail = "Track · Camellia · parent-only match"
        val context = highlightFixtureMatches(detail, "cam", foreground, fill)

        assertTrue(title.spanStyles.isEmpty())
        assertEquals(listOf(detail.indexOf("Camellia")), context.spanStyles.map { it.start })
        assertEquals("cam".length, context.spanStyles.single().end - context.spanStyles.single().start)
    }

    /** Checks both the empty-query and nonmatching-text paths preserve plain text. */
    @Test
    fun emptyOrAbsentQueryNeverPaintsAResult() {
        val foreground = Color(0xFF30323A)
        val fill = Color(0xFFC6D0E7)
        val noQuery = highlightFixtureMatches("Camellia", "", foreground, fill)
        val noMatch = highlightFixtureMatches("Another Xronixle", "cam", foreground, fill)

        assertEquals("Camellia", noQuery.text)
        assertTrue(noQuery.spanStyles.isEmpty())
        assertEquals("Another Xronixle", noMatch.text)
        assertTrue(noMatch.spanStyles.isEmpty())
    }

    /** Checks the existing OKLCH mixer responds to runtime accent and light/dark scene. */
    @Test
    fun matchFillRespondsToThemeAccentAndScene() {
        val blue = Color(0xFF526594)
        val coral = Color(0xFFAD5D4C)
        val lightBlue = fixtureMatchBackground(blue, darkScene = false)
        val lightCoral = fixtureMatchBackground(coral, darkScene = false)
        val darkBlue = fixtureMatchBackground(blue, darkScene = true)

        assertTrue(lightBlue != lightCoral)
        assertTrue(lightBlue != darkBlue)
    }
}
