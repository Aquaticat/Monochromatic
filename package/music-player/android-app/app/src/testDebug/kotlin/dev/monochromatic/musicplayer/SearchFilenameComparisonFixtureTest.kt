// What: Use the debug test namespace so no presentation helper enters release code.
// Why: Host tests validate authored alternatives without native matching or media files.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity is its source path.
// ```
package dev.monochromatic.musicplayer

// What: JUnit Test marks runnable methods, not native event callbacks.
// Why: The existing package unit task discovers every independent fixture contract.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from 'test';
// ```
import org.junit.Test

// What: assertEquals throws when complete expected and actual values differ.
// Why: Preserve exact literal suffixes and context instead of checking approximate counts only.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect } from 'test';
// ```
import org.junit.Assert.assertEquals
// Check authored inclusion and cue requirements as explicit true values.
import org.junit.Assert.assertTrue
// Check non-displayed partners and separate-mode flags as explicit false values.
import org.junit.Assert.assertFalse

/**
 * What: A plain test class groups annotated methods, unlike a singleton object.
 * Why: JUnit creates a fresh owner for each independent comparison check.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * describe('filename comparison fixtures', () => { /* tests */ });
 * ```
 */
class SearchFilenameComparisonFixtureTest {
    /**
     * What: @Test registers a no-argument method with an explicit Unit body.
     * Why: Placement alternatives retain the exact long-name control membership and cues.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('placement moves suffixes without removing identity', () => { /* ... */ });
     * ```
     */
    @Test fun longPlacementRetainsExactSuffixAndContext() {
        // What: List<SearchRankingHit> is a read-only ordered collection, not MutableList or Array.
        // Why: Compare every row while keeping the source fixture unchanged.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const full: readonly SearchRankingHit[] = filenameComparisonHits('rankfileplacementfull');
        // ```
        val full: List<SearchRankingHit> = filenameComparisonHits("rankfileplacementfull")
        // Read the independent stem-first alternative as another immutable result list.
        val moved: List<SearchRankingHit> = filenameComparisonHits("rankfileplacementsupport")
        assertEquals(searchFilenameHits("rankfilelong"), full)
        assertEquals(full.size, moved.size)
        assertEquals("Camellia Waltz (Live at Miraikan 2026, Extended Archive Version)", moved[0].title)
        assertEquals(moved[0].title, moved[1].title)
        assertEquals("Track · .flac · Cult of Luna / Live · Play", moved[0].detail)
        assertEquals("Track · .mp3 · Cult of Luna / Live · Play", moved[1].detail)
        assertEquals(full[2], moved[2])
        assertEquals(full[0].kind, moved[0].kind)
        assertEquals(full[1].kind, moved[1].kind)
    }

    /** Check ancestor context and dotted folders remain literal after suffix placement changes. */
    @Test fun literalPlacementRetainsAncestorsAndFolderIdentity() {
        // Reuse immutable result lists for the second independent corpus.
        val full = filenameComparisonHits("rankfileliteralfull")
        val moved = filenameComparisonHits("rankfileliteralsupport")
        assertEquals("Cam.flac", full[0].title)
        assertEquals(full[0].title, full[1].title)
        assertEquals("Track · .flac · Collection A / Live · Play", moved[0].detail)
        assertEquals("Track · .flac · Collection B / Live · Play", moved[1].detail)
        assertEquals("Camellia.flac", moved[2].title)
        assertEquals("Folder · library root · Open", moved[2].detail)
        assertEquals(full[2], moved[2])
        assertEquals(full[6], moved[6])
        assertEquals("Cam", moved[6].title)
    }

    /** Check uppercase, internal/leading dots and Unicode are not normalized by the authored pieces. */
    @Test fun literalPlacementRetainsExactSpelling() {
        val full = filenameComparisonHits("rankfileliteralfull")
        val moved = filenameComparisonHits("rankfileliteralsupport")
        assertEquals("Cam.mix.2026.FLAC", full[3].title)
        assertEquals("Cam.mix.2026", moved[3].title)
        assertEquals("Track · .FLAC · library root · Play", moved[3].detail)
        assertEquals(".Cam.session.opus", full[4].title)
        assertEquals(".Cam.session", moved[4].title)
        assertEquals("Track · .opus · Archive / Live · Play", moved[4].detail)
        assertEquals("かめりあ(Camellia) - Camellia Waltz.flac", full[5].title)
        assertEquals("かめりあ(Camellia) - Camellia Waltz", moved[5].title)
        assertEquals("Track · .flac · Camellia · Play", moved[5].detail)
    }

    /** Check conditional omission changes only the explicitly unambiguous authored item. */
    @Test fun visibilityChangesOnlyAuthoredEligibleSuffix() {
        val full = filenameComparisonHits("rankfilevisibilityfull")
        val conditional = filenameComparisonHits("rankfilevisibilityconditional")
        assertEquals(5, full.size)
        assertEquals(full.size, conditional.size)
        assertEquals("Cam Solo.opus", full[0].title)
        assertEquals("Cam Solo", conditional[0].title)
        assertEquals(full[0].detail, conditional[0].detail)
        assertEquals(full[0].kind, conditional[0].kind)
        // What: A for loop visits the bounded integer range rather than recurse or rebuild lists.
        // Why: Every remaining displayed row must be identical between visibility alternatives.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (let index = 1; index < full.length; index++) expect(conditional[index]).toEqual(full[index]);
        // ```
        for (index in 1 until full.size) {
            assertEquals(full[index], conditional[index])
        }
    }

    /** Check a non-displayed same-parent partner still requires the displayed name's suffix cue. */
    @Test fun nonDisplayedPartnerRemainsInAuthoredScope() {
        val scope = filenameVisibilityAuthoredScope()
        assertEquals(scope[3].stem, scope[4].stem)
        assertEquals(scope[3].parent, scope[4].parent)
        assertTrue(scope[3].displayed)
        assertFalse(scope[4].displayed)
        assertTrue(scope[3].suffixCueRequired)
        assertTrue(scope[4].suffixCueRequired)
        assertEquals(".flac", scope[3].literalSuffix)
        assertEquals(".mp3", scope[4].literalSuffix)
        assertEquals("Cam Outside.flac", filenameComparisonHits("rankfilevisibilityconditional")[3].title)
    }

    /** Check every comparison reaches the real shared fixture entry point with either parent flag. */
    @Test fun sharedRendererEntryRoutesEveryComparison() {
        // Reuse element iteration for the authoritative scene registry.
        for (scene in filenameComparisonScenes) {
            assertEquals(filenameComparisonHits(scene), searchRankingHits(scene, includeParent = false))
            assertEquals(filenameComparisonHits(scene), searchRankingHits(scene, includeParent = true))
            assertEquals(scene, filenameComparisonSceneOrEmpty("search-deck-right-lift-retain-e2floor7p5-imeviewport-$scene-results-light"))
            assertEquals(scene, filenameComparisonSceneOrEmpty("search-layout-docked-$scene-results"))
        }
    }

    /** Check absent or partial scene markers preserve the existing host fallback. */
    @Test fun unrelatedCandidateReturnsEmptySceneSentinel() {
        assertEquals("", filenameComparisonSceneOrEmpty("search-deck-right-rankmixed-results"))
        assertEquals("", filenameComparisonSceneOrEmpty("search-deck-rankfileplacementfuller-results"))
        assertEquals("", filenameComparisonSceneOrEmpty("rankfileplacementfull"))
    }

    /** Check causal study modes cannot accidentally change both independent dimensions at once. */
    @Test fun combinedStudyModesAreRejected() {
        // What: try/catch narrows the thrown class; the binding's message is checked, not discarded.
        // Why: Rejection must come from the intended independent-study guard.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // try { format({ item, suffixInSupport: true, conditionalVisibility: true }); }
        // catch (error) { expect(error.message).toEqual(expected); return; }
        // throw new Error('Combined study modes did not throw.');
        // ```
        try {
            // What: Construct the immutable presentation request, not a native result action.
            // Why: The invalid fixture request is tested directly at its owned boundary.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const request = { item: items[0], suffixInSupport: true, conditionalVisibility: true };
            // ```
            val request = FilenameComparisonPresentation(filenamePlacementLongItems()[0], true, true)
            filenameComparisonHit(request)
        } catch (error: IllegalArgumentException) {
            assertEquals("Comparison fixture varies suffix placement or visibility, not both at once.", error.message)
            return
        }
        throw AssertionError("Combined study modes did not throw.")
    }

    /** Check unknown comparison routing never silently substitutes a presentation. */
    @Test fun unknownComparisonIsRejected() {
        // Reuse the typed catch and explicit failure proof for independent scene routing.
        try {
            filenameComparisonHits("rankfilecomparisonmissing")
        } catch (error: IllegalArgumentException) {
            assertEquals("Unknown filename comparison fixture: rankfilecomparisonmissing", error.message)
            return
        }
        throw AssertionError("Unknown filename comparison scene did not throw.")
    }
}
