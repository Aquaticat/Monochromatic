// What:     `package dev.monochromatic.musicplayer.core` places these tests beside `Page`
//           and `isFolderPage`, so both names are available without imports.
// Why:      The tests exercise the production page-kind seam directly.
//
// In TS you'd write (pseudocode):
// ```ts
// // The file path supplies module identity.
// ```
package dev.monochromatic.musicplayer.core

// What:     `import org.junit.Assert.assertFalse` brings JUnit's failing false assertion
//           into scope under its short name.
// Why:      Root and empty pages must be proven not to identify as folders.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect } from "test-framework";
// ```
import org.junit.Assert.assertFalse

// What:     `import org.junit.Assert.assertTrue` brings JUnit's failing true assertion
//           into scope under its short name.
// Why:      A real folder page must be proven to retain its folder identity.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect } from "test-framework";
// ```
import org.junit.Assert.assertTrue

// What:     `import org.junit.Test` brings in JUnit's test annotation. An annotation marks
//           a method for the runner, comparable to registering a TS `test(...)` callback.
// Why:      The JVM runner needs to discover each verification method below.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from "test-framework";
// ```
import org.junit.Test

// What:     `class PageKindTest` declares one constructable test container. Kotlin classes
//           are reference types like TS classes; no inheritance is needed here.
// Why:      JUnit creates this container and invokes every annotated method independently.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("page kind", () => { /* tests */ });
// ```
/** Verifies folder identity from page contents instead of ambiguous display labels. */
class PageKindTest {
    // What:     `@Test fun oneCharacterFolderRemainsFolder()` marks a no-argument method as
    //           one independently runnable test. The inferred return is Kotlin `Unit`, like
    //           a TS function returning `void`.
    // Why:      Folder `A` and root bucket `A` share text, so contents must preserve identity.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("one-character folder remains folder", () => { /* assertion */ });
    // ```
    /** Proves a one-character folder is not confused with the same root-letter label. */
    @Test
    fun oneCharacterFolderRemainsFolder() {
        // What:     `Page("A", listOf(PageEntry(0, "A/Track.opus")))` constructs one page
        //           with an immutable one-element list. Generic element type is inferred as
        //           `PageEntry`; siblings include mutable `MutableList` and fixed `Array`.
        // Why:      This fixture has the exact ambiguous label but a folder-prefixed entry.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const page = { label: "A", entries: [{ index: 0, name: "A/Track.opus" }] };
        // ```
        val page: Page = Page("A", listOf(PageEntry(0, "A/Track.opus")))
        // What:     `assertTrue(page.isFolderPage())` evaluates the production predicate and
        //           fails this test unless it returns true.
        // Why:      The unfolded picker must include the real one-character folder.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isFolderPage(page)).toBe(true);
        // ```
        assertTrue(page.isFolderPage())
    }

    // What:     `@Test fun rootLetterPageIsNotFolder()` registers the false branch for a
    //           populated root page with the same visible `A` label.
    // Why:      The rail must own root buckets instead of duplicating them as folders.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("root letter page is not folder", () => { /* assertion */ });
    // ```
    /** Proves root-level names do not become folder links from their page label alone. */
    @Test
    fun rootLetterPageIsNotFolder() {
        // This populated root fixture lacks the `<label>/` prefix that proves folder identity.
        val page: Page = Page("A", listOf(PageEntry(0, "Another Xronixle.opus")))
        // The false assertion pins the populated non-folder branch.
        assertFalse(page.isFolderPage())
    }

    // What:     `@Test fun emptyPageIsNotFolder()` registers the absent-entry branch.
    // Why:      Manually constructed empty states must remain total and non-crashing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("empty page is not folder", () => { /* assertion */ });
    // ```
    /** Proves an empty page has no invented folder identity. */
    @Test
    fun emptyPageIsNotFolder() {
        // `emptyList<PageEntry>()` returns a shared immutable empty list with explicit element type.
        val page: Page = Page("A", emptyList())
        // The false assertion pins the null-safe empty branch.
        assertFalse(page.isFolderPage())
    }
}
