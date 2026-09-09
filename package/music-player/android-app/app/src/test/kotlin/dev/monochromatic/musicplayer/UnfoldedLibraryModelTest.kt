// What:     `package dev.monochromatic.musicplayer` places this test beside the pure
//           unfolded model functions and `PlayerUiState`.
// Why:      The host test reaches internal presentation logic with no Android device.
//
// In TS you'd write (pseudocode):
// ```ts
// // The file path supplies module identity.
// ```
package dev.monochromatic.musicplayer

// What:     `import org.junit.Assert.assertEquals` brings JUnit's structural equality
//           assertion into scope.
// Why:      Every expected folder target, rail label, and resolved page index is a value.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect } from "test-framework";
// ```
import org.junit.Assert.assertEquals

// What:     `import org.junit.Assert.assertNull` brings JUnit's null assertion into scope.
// Why:      A missing rail target must return null rather than an invented page index.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect } from "test-framework";
// ```
import org.junit.Assert.assertNull

// What:     `import org.junit.Test` brings in JUnit's method-discovery annotation.
// Why:      The JVM runner needs to identify each test method below.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from "test-framework";
// ```
import org.junit.Test

// What:     `class UnfoldedLibraryModelTest` declares a constructable test container.
// Why:      JUnit creates it and runs each annotated method independently.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("unfolded library model", () => { /* tests */ });
// ```
/** Verifies identity-safe folder and writing-system targets for the unfolded picker. */
class UnfoldedLibraryModelTest {
    // What:     `private fun ambiguousState(): PlayerUiState` declares a test helper returning
    //           one immutable screen snapshot. `private` limits it to this class.
    // Why:      All tests need the same duplicate `A` folder/root caption and invalid index.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function ambiguousState(): PlayerUiState { /* fixture */ }
    // ```
    /** Builds duplicate page labels whose indices retain distinct domain identities. */
    private fun ambiguousState(): PlayerUiState {
        // What:     `return PlayerUiState(...)` constructs and immediately returns one snapshot
        //           through named arguments. `listOf` creates read-only ordered lists whose
        //           element types are inferred from their values.
        // Why:      The fixture covers a one-letter folder, same-label root bucket, another
        //           folder, catch-all root bucket, and one stale folder index.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { pageLabels: ["A", "A", "Camellia", "#"], folderPageIndices: [0, 2, 99] };
        // ```
        return PlayerUiState(
            pageLabels = listOf("A", "A", "Camellia", "#"),
            folderPageIndices = listOf(0, 2, 99),
        )
    }

    // What:     `@Test fun folderTargetsKeepPageIndices()` registers one no-argument test.
    // Why:      The visual folder list must route duplicate labels to their real pages.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("folder targets keep page indices", () => { /* assertion */ });
    // ```
    /** Confirms valid folder indices become targets while stale indices disappear. */
    @Test
    fun folderTargetsKeepPageIndices() {
        // The structural assertion pins target order, labels, indices, and stale-index filtering.
        assertEquals(
            listOf(
                UnfoldedPageTarget(pageIndex = 0, label = "A"),
                UnfoldedPageTarget(pageIndex = 2, label = "Camellia"),
            ),
            unfoldedFolderTargets(ambiguousState()),
        )
    }

    // What:     `@Test fun letterTargetsMergeFolderAndRootLabels()` registers the rail-list test.
    // Why:      Duplicate folder/root initials must produce one visible 48dp target.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("letter targets merge folder and root labels", () => { /* assertion */ });
    // ```
    /** Confirms initials deduplicate, sort alphabetically, and keep catch-all last. */
    @Test
    fun letterTargetsMergeFolderAndRootLabels() {
        // The expected list has one `A`, one `C`, then the catch-all label.
        assertEquals(listOf("A", "C", "#"), unfoldedLetterTargets(ambiguousState()))
    }

    // What:     `@Test fun folderMatchWinsOverRootBucket()` registers the duplicate-label lookup.
    // Why:      Tapping `A` should keep the folder picker focused on folders when one exists.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("folder match wins over root bucket", () => { /* assertion */ });
    // ```
    /** Confirms a matching folder is preferred over a same-label root page. */
    @Test
    fun folderMatchWinsOverRootBucket() {
        // Index zero is folder `A`; index one is root bucket `A` and must not win.
        assertEquals(0, unfoldedPageForLetter(ambiguousState(), "a"))
    }

    // What:     `@Test fun rootBucketHandlesMissingFolderInitial()` registers the fallback path.
    // Why:      Root-only libraries still need functioning alphabetic navigation.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("root bucket handles missing folder initial", () => { /* assertion */ });
    // ```
    /** Confirms a root bucket handles a rail label when no folder starts with it. */
    @Test
    fun rootBucketHandlesMissingFolderInitial() {
        // A dedicated root-only snapshot exercises the second lookup branch.
        val state: PlayerUiState = PlayerUiState(pageLabels = listOf("B"))
        // Root bucket zero is returned because there is no matching folder.
        assertEquals(0, unfoldedPageForLetter(state, "b"))
    }

    // What:     `@Test fun missingLetterReturnsNull()` registers the total miss path.
    // Why:      Stale UI input must not select an unrelated page.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("missing letter returns null", () => { /* assertion */ });
    // ```
    /** Confirms an absent folder initial and root bucket resolve to no page. */
    @Test
    fun missingLetterReturnsNull() {
        // The null assertion pins the no-match result rather than an index sentinel such as -1.
        assertNull(unfoldedPageForLetter(ambiguousState(), "Z"))
    }

    /** Confirms accepted track titles drop folder prefixes and only the final extension. */
    @Test
    fun trackTitleUsesFinalPathStem() {
        assertEquals("Another Xronixle", unfoldedTrackTitle("Camellia/Another Xronixle.opus"))
        assertEquals("mix.final", unfoldedTrackTitle("folder/mix.final.flac"))
    }

    /** Confirms extension-free names and dotfiles remain complete. */
    @Test
    fun trackTitlePreservesNamesWithoutFinalExtension() {
        assertEquals("README", unfoldedTrackTitle("folder/README"))
        assertEquals(".hidden", unfoldedTrackTitle("folder/.hidden"))
    }
}
