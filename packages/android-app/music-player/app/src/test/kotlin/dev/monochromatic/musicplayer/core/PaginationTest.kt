package dev.monochromatic.musicplayer.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Host JVM unit tests for [paginate] and [pageOfIndex], ported one-to-one from the desktop's inline
 * `pagination.rs` test module so the Kotlin port stays faithful to the Rust behavior. Every vector
 * and expected value matches the Rust oracle; pagination is pure (no RNG, JSON, or filesystem), so
 * no test needed adaptation beyond translating `Vec`/`Some`/`None` to Kotlin `List`/`Int?`/`null`.
 */
class PaginationTest {
    /** Pull just the load-order indices out of a page's entries, mirroring the Rust test helper. */
    private fun indicesOf(page: Page): List<Int> = page.entries.map { it.index }

    /** Collect page labels in tab order, mirroring the Rust `pages.iter().map(|p| p.label)`. */
    private fun labelsOf(pages: List<Page>): List<String> = pages.map { it.label }

    /** Ported from `empty_input_yields_no_pages`: no names means no pages, not one empty page. */
    @Test
    fun emptyInputYieldsNoPages() {
        assertTrue(paginate(emptyList()).isEmpty())
    }

    /**
     * Ported from `same_top_folder_collapses_one_level`: two tracks in different deeper subfolders but
     * the same top folder collapse onto one `Artist` page, keeping their load-order indices.
     */
    @Test
    fun sameTopFolderCollapsesOneLevel() {
        val pages = paginate(listOf("Artist/Album1/01.flac", "Artist/Album2/01.flac"))
        assertEquals(1, pages.size)
        assertEquals("Artist", pages[0].label)
        assertEquals(listOf(0, 1), indicesOf(pages[0]))
    }

    /**
     * Ported from `distinct_folders_sorted_by_path`: two tracks in different folders, given out of
     * sorted order, come out as separate pages sorted by folder path, each entry keeping its index.
     */
    @Test
    fun distinctFoldersSortedByPath() {
        val pages = paginate(listOf("Pop/b.flac", "Jazz/a.flac"))
        assertEquals(listOf("Jazz", "Pop"), labelsOf(pages))
        // The Jazz page holds the second input (load index 1) despite sorting first.
        assertEquals(1, pages[0].entries[0].index)
    }

    /**
     * Ported from `folder_pages_sort_case_insensitively`: folder tops with mixed-case first letters,
     * given in an order a raw codepoint sort would mangle, interleave case-insensitively while their
     * displayed labels keep their original casing (`r-906` precedes `Reol` because `-` sorts before `E`).
     */
    @Test
    fun folderPagesSortCaseInsensitively() {
        val pages = paginate(
            listOf(
                "Zedd/a.flac",
                "daniwellP/b.flac",
                "Reol/c.flac",
                "r-906/d.flac",
            ),
        )
        assertEquals(listOf("daniwellP", "r-906", "Reol", "Zedd"), labelsOf(pages))
    }

    /**
     * Ported from `case_variant_folders_stay_distinct_pages`: two folders differing only in case stay
     * separate pages, ordered by the original label after the shared case-folded key (uppercase-led first).
     */
    @Test
    fun caseVariantFoldersStayDistinctPages() {
        val pages = paginate(listOf("REOL/a.flac", "Reol/b.flac"))
        assertEquals(2, pages.size)
        assertEquals(listOf("REOL", "Reol"), labelsOf(pages))
    }

    /**
     * Ported from `root_letters_merge_case_insensitively`: three root-level names starting with the
     * same letter in different cases merge onto one `A` letter page, indices preserved in load order.
     */
    @Test
    fun rootLettersMergeCaseInsensitively() {
        val pages = paginate(listOf("apple.flac", "Apricot.flac", "AVOCADO.flac"))
        assertEquals(1, pages.size)
        assertEquals("A", pages[0].label)
        assertEquals(listOf(0, 1, 2), indicesOf(pages[0]))
    }

    /**
     * Ported from `non_letter_root_names_go_to_catch_all`: root-level names whose first char is a
     * digit, CJK, symbol, and accented (non-English) letter all land on the single `#` catch-all page.
     */
    @Test
    fun nonLetterRootNamesGoToCatchAll() {
        val pages = paginate(listOf("1 song.flac", "初音.flac", "#tag.flac", "élan.flac"))
        assertEquals(1, pages.size)
        assertEquals("#", pages[0].label)
        assertEquals(listOf(0, 1, 2, 3), indicesOf(pages[0]))
    }

    /**
     * Ported from `folders_precede_letters_precede_catch_all`: a folder, a letter, and a catch-all
     * track ordered so the folder's label sorts after the letter's prove the sort group, not the label
     * text, orders the three axes (`Zed` folder, then `A` letter, then `#`).
     */
    @Test
    fun foldersPrecedeLettersPrecedeCatchAll() {
        val pages = paginate(listOf("Zed/x.flac", "apple.flac", "1.flac"))
        assertEquals(listOf("Zed", "A", "#"), labelsOf(pages))
    }

    /**
     * Ported from `page_of_index_finds_and_misses`: load index 2 (`c.flac`) lives on the third page
     * (the `C` letter page after two folder pages), and an out-of-range index belongs to no page.
     */
    @Test
    fun pageOfIndexFindsAndMisses() {
        val pages = paginate(listOf("A/x.flac", "B/y.flac", "c.flac"))
        assertEquals(2, pageOfIndex(pages, 2))
        assertNull(pageOfIndex(pages, 99))
    }
}
