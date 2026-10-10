// Cases for the pure computations behind the Search page: crease dp, match fill, row keys, and highlight spans.

// What:     `package dev.monochromatic.musicplayer` places these tests beside the page they cover.
// Why:      The tests reach the module-internal helpers in SearchPage.kt without exposing them publicly.
//
// In TS you'd write (pseudocode):
// ```ts
// // File path supplies the test module namespace.
// ```
package dev.monochromatic.musicplayer

// What:     `import androidx.compose.ui.graphics.Color` builds the accent and compared colors.
// Why:      The fill rules are checked on real Compose colors, so the OKLCH mix runs as it does on device.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Color } from "compose/ui/graphics";
// ```
import androidx.compose.ui.graphics.Color

// What:     `import androidx.compose.ui.graphics.luminance` reads the relative brightness of a color.
// Why:      The dark fill must be darker than its accent and the light fill lighter, which luminance compares.
//
// In TS you'd write (pseudocode):
// ```ts
// const luminance = (c: Color) => c.luminance();
// ```
import androidx.compose.ui.graphics.luminance

// What:     `import androidx.compose.ui.text.buildAnnotatedString` builds the highlighted text under test.
// Why:      The span count and text are read from the same annotated string the page draws.
//
// In TS you'd write (pseudocode):
// ```ts
// const annotated = buildAnnotatedString(() => { /* ... */ });
// ```

// What:     `import dev.monochromatic.musicplayer.core.SearchHighlight` names one emphasized range.
// Why:      The highlight cases pass explicit ranges into the annotated string builder.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { SearchHighlight } from "dev.monochromatic.musicplayer/core/SearchMatcher";
// ```
import dev.monochromatic.musicplayer.core.SearchHighlight

// What:     `import dev.monochromatic.musicplayer.core.SearchResult` names one result row.
// Why:      The key cases build folder and track results to compare their list keys.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { SearchResult } from "dev.monochromatic.musicplayer/core/SearchResults";
// ```
import dev.monochromatic.musicplayer.core.SearchResult

// What:     `import dev.monochromatic.musicplayer.core.SearchResultKind` names the folder and track kinds.
// Why:      The fixtures set the kind that the key function branches on.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { SearchResultKind } from "dev.monochromatic.musicplayer/core/SearchResults";
// ```
import dev.monochromatic.musicplayer.core.SearchResultKind

// What:     JUnit's assertions and test annotation register each case.
// Why:      Each case compares one computed value, so the boundary and branch are checked exactly.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect, test } from "test";
// ```
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

// What:     `private fun searchFolderFixture(name: String): SearchResult` builds a folder result.
// Why:      Key cases need a folder whose name can collide with a track title.
//
// In TS you'd write (pseudocode):
// ```ts
// const folder = (name: string): SearchResult => ({ kind: "folder", name, /* ... */ });
// ```
/** Builds a folder result whose own name is the given text. */
private fun searchFolderFixture(name: String): SearchResult = SearchResult(
    kind = SearchResultKind.FOLDER,
    name = name,
    parentContext = null,
    indexInLibrary = null,
    folderName = name,
    tier = 0,
    nameHighlights = emptyList(),
    parentHighlights = emptyList(),
)

// What:     `private fun searchTrackFixture(name: String, index: Int): SearchResult` builds a track result.
// Why:      Key cases need two tracks with one title that differ only by library position.
//
// In TS you'd write (pseudocode):
// ```ts
// const track = (name: string, index: number): SearchResult => ({ kind: "track", name, indexInLibrary: index });
// ```
/** Builds a track result with the given title and library position. */
private fun searchTrackFixture(name: String, index: Int): SearchResult = SearchResult(
    kind = SearchResultKind.TRACK,
    name = name,
    parentContext = "Live",
    indexInLibrary = index,
    folderName = "Live",
    tier = 0,
    nameHighlights = emptyList(),
    parentHighlights = emptyList(),
)

// What:     `class SearchPageLayoutTest` groups the crease, fill, key, and highlight cases.
// Why:      The page's only non-trivial computations are these four, so each has its own cases here.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("SearchPage layout", () => { /* cases */ });
// ```
/** Verifies the crease conversion, the OKLCH match fill, the row keys, and the highlight spans of the Search page. */
class SearchPageLayoutTest {
    // What:     `@Test fun creaseHalfMatchesPhysicalPixelsAtUnitDensity()` checks the crease at density one.
    // Why:      At one pixel per dp the half crease equals its physical pixel count, which fixes the conversion.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("half crease at unit density", () => { /* ... */ });
    // ```
    /** At one pixel per dp, the half crease is the physical pixel half-width of 7.5mm on the 2076px panel. */
    @Test
    fun creaseHalfMatchesPhysicalPixelsAtUnitDensity() {
        /** Expected half crease in physical pixels from the published panel width. */
        val expected: Float = 7.5f / 141.08f * 2076f / 2f
        assertEquals(expected, searchCreaseHalfDp(1f), 0.001f)
    }

    // What:     `@Test fun creaseHalfShrinksInDpAsDensityGrows()` checks the density scaling.
    // Why:      A denser display fits more pixels in each dp, so the same physical crease takes fewer dp.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("half crease scales with density", () => { /* ... */ });
    // ```
    /** Doubling the density halves the crease in dp, so the clear zone is physical, not fixed in dp (E2). */
    @Test
    fun creaseHalfShrinksInDpAsDensityGrows() {
        assertEquals(searchCreaseHalfDp(1f) / 2f, searchCreaseHalfDp(2f), 0.001f)
    }

    // What:     `@Test fun creaseHalfRejectsNonPositiveDensity()` checks the failure path.
    // Why:      A zero density has no meaningful dp conversion, so the function must throw.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("zero density throws", () => { expect(() => halfCrease(0)).toThrow(); });
    // ```
    /** A zero density throws the page's layout exception instead of returning a garbage crease. */
    @Test
    fun creaseHalfRejectsNonPositiveDensity() {
        assertThrows(SearchLayoutException::class.java) {
            searchCreaseHalfDp(0f)
        }
    }

    // What:     `@Test fun darkMatchFillIsDarkerThanAccent()` checks the dark-scene fill.
    // Why:      D59 darkens the accent in dark mode, so the fill must be darker than the accent.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("dark fill darker", () => { /* ... */ });
    // ```
    /** The dark-scene fill has less luminance than the accent it is derived from. */
    @Test
    fun darkMatchFillIsDarkerThanAccent() {
        /** Mid-brightness blue accent used as the theme primary in the check. */
        val accent: Color = Color(0xFF3366CC)
        assertTrue(searchMatchFill(accent, darkScene = true).luminance() < accent.luminance())
    }

    // What:     `@Test fun lightMatchFillIsLighterThanAccent()` checks the light-scene fill.
    // Why:      D59 lightens the accent in light mode, so the fill must be lighter than the accent.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("light fill lighter", () => { /* ... */ });
    // ```
    /** The light-scene fill has more luminance than the accent it is derived from. */
    @Test
    fun lightMatchFillIsLighterThanAccent() {
        /** Mid-brightness blue accent used as the theme primary in the check. */
        val accent: Color = Color(0xFF3366CC)
        assertTrue(searchMatchFill(accent, darkScene = false).luminance() > accent.luminance())
    }

    // What:     `@Test fun matchFillIsOpaque()` checks the fill's alpha.
    // Why:      The highlight must paint solid behind the text, not let the row show through.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("fill opaque", () => { /* ... */ });
    // ```
    /** The emphasis fill is fully opaque in both scenes. */
    @Test
    fun matchFillIsOpaque() {
        /** Blue accent whose alpha is one before the fill is derived. */
        val accent: Color = Color(0xFF3366CC)
        assertEquals(1f, searchMatchFill(accent, darkScene = true).alpha, 0.001f)
        assertEquals(1f, searchMatchFill(accent, darkScene = false).alpha, 0.001f)
    }

    // What:     `@Test fun folderAndTrackWithSameNameHaveDistinctKeys()` checks key separation by kind.
    // Why:      The lazy list rejects duplicate keys, and a folder and a track may share a name.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("folder and track keys differ", () => { /* ... */ });
    // ```
    /** A folder and a track with the same title receive different row keys. */
    @Test
    fun folderAndTrackWithSameNameHaveDistinctKeys() {
        assertNotEquals(
            searchResultKey(searchFolderFixture("Night")),
            searchResultKey(searchTrackFixture("Night", 0)),
        )
    }

    // What:     `@Test fun tracksWithSameTitleHaveDistinctKeys()` checks key separation by position.
    // Why:      Two tracks may share a title in different folders, so the library position must separate them.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("same title tracks differ by index", () => { /* ... */ });
    // ```
    /** Two tracks with one title but different library positions receive different row keys. */
    @Test
    fun tracksWithSameTitleHaveDistinctKeys() {
        assertNotEquals(
            searchResultKey(searchTrackFixture("Night", 0)),
            searchResultKey(searchTrackFixture("Night", 1)),
        )
    }

    // What:     `@Test fun highlightedTextKeepsOriginalCharacters()` checks that spans never edit the text.
    // Why:      The title must read exactly as the library names it, with only styles added.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("highlight keeps text", () => { /* ... */ });
    // ```
    /** The annotated text equals the input text after the emphasis spans are applied. */
    @Test
    fun highlightedTextKeepsOriginalCharacters() {
        /** Annotated title with one valid emphasis span. */
        val annotated = searchHighlightedText(
            text = "Cam Cam",
            highlights = listOf(SearchHighlight(0, 3)),
            fill = Color.Yellow,
            ink = Color.Black,
        )
        assertEquals("Cam Cam", annotated.text)
    }

    // What:     `@Test fun highlightedTextStylesOnlyValidRanges()` checks the span count.
    // Why:      Each valid range gets one style, and a range past the text gets none, so no span crashes the text.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("only valid ranges styled", () => { /* ... */ });
    // ```
    /** Two valid ranges produce two styles, and an out-of-range range produces none. */
    @Test
    fun highlightedTextStylesOnlyValidRanges() {
        /** Annotated title with two valid spans and one span past the end. */
        val annotated = searchHighlightedText(
            text = "Cam Cama",
            highlights = listOf(SearchHighlight(0, 3), SearchHighlight(5, 8), SearchHighlight(6, 12)),
            fill = Color.Yellow,
            ink = Color.Black,
        )
        assertEquals(2, annotated.spanStyles.size)
    }

    // What:     `@Test fun highlightedTextWithoutRangesHasNoStyles()` checks the empty-highlight case.
    // Why:      A plain title with no matches must draw exactly its text, with no styled spans.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("no highlights, no styles", () => { /* ... */ });
    // ```
    /** A title with no highlight ranges carries no span styles. */
    @Test
    fun highlightedTextWithoutRangesHasNoStyles() {
        /** Annotated plain title built from an empty highlight list. */
        val annotated = searchHighlightedText(
            text = "Camellia",
            highlights = emptyList(),
            fill = Color.Yellow,
            ink = Color.Black,
        )
        assertEquals(0, annotated.spanStyles.size)
    }
}
