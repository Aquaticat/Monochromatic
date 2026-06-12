package dev.monochromatic.musicplayer.core

/**
 * Pure queue pagination on two axes, a faithful port of the desktop's `pagination.rs`. Each track's
 * display string (its queue-relative path, see [relativeDisplayPaths]) is grouped onto a [Page]:
 *
 * - A track inside a subfolder (its relative path contains `/`) groups by its top-level folder under
 *   the loaded root (one level only); the page label is that single folder.
 * - A track sitting directly at the root (no `/`) groups by first letter, with fixed buckets: the 26
 *   English letters A-Z (case-insensitive), plus a single `#` catch-all for digits, symbols, CJK,
 *   and non-English letters.
 *
 * Pages come out folder-pages-first (case-insensitively by path), then the A-Z letter pages, then
 * the `#` catch-all. Folder labels are case-folded for the sort only (never for display or
 * bucketing), so lowercase-led folders interleave with capitalized ones instead of trailing after
 * the last uppercase folder. [Queue] consumes [paginate] and [pageOfIndex] to confine playback to a
 * page, so the playback scope and the visible tab can never drift.
 */

/** Path separator the display strings use; matches the join character in [relativeDisplayPaths]. */
private const val PAGE_SEPARATOR: String = "/"

/** Sort-group tag for folder pages; sorts before letter pages regardless of label text. */
private const val FOLDER_GROUP: Int = 0

/** Sort-group tag for the A-Z letter pages; sorts after folder pages, before the catch-all. */
private const val LETTER_GROUP: Int = 1

/** Sort-group tag for the `#` page; sorts last, after every A-Z letter page. */
private const val CATCH_ALL_GROUP: Int = 2

/** Label of the catch-all page that collects every non-English-letter root-level track. */
private const val CATCH_ALL_LABEL: String = "#"

/**
 * The `(sortGroup, label)` page key for a root-level track (one with no folder), using its first
 * letter: the 26 English letters case-folded to their uppercase bucket, everything else `#`.
 *
 * @param name Display string of a root-level track (no `/`).
 * @return Pair of sort-group tag and bucket label; non-English-letter or empty names map to the
 *   catch-all bucket so a flat folder paginates by letter without exploding into one page per char.
 */
private fun letterKey(name: String): Pair<Int, String> {
    val first: Char? = name.firstOrNull()
    return if (first != null && (first in 'a'..'z' || first in 'A'..'Z')) {
        Pair(LETTER_GROUP, first.uppercaseChar().toString())
    } else {
        Pair(CATCH_ALL_GROUP, CATCH_ALL_LABEL)
    }
}

/**
 * The `(sortGroup, label)` page key for a track: its top-level folder when the display string
 * contains a `/`, otherwise its first-letter bucket. One spot decides grouping so the bucket key and
 * the displayed label can never drift apart.
 *
 * @param name Track's display string (queue-relative path).
 * @return Pair of sort-group tag and page label; a subfolder track groups by its top-level folder
 *   (one level only), a root-level track by [letterKey].
 */
private fun pageKey(name: String): Pair<Int, String> {
    val slash: Int = name.indexOf(PAGE_SEPARATOR)
    return if (slash >= 0) {
        Pair(FOLDER_GROUP, name.substring(0, slash))
    } else {
        letterKey(name)
    }
}

/**
 * Case-folded form of a page label, used only to order pages, never to display or bucket them.
 * Folding case first gives the human "ignore case" order the tab bar wants instead of raw codepoint
 * order, which would sort every uppercase letter before every lowercase one.
 *
 * @param label Original page label (a raw folder name, an A-Z letter, or `#`).
 * @return Uppercased label; the identity for already-uppercase letter pages and the `#` catch-all.
 */
private fun sortKey(label: String): String = label.uppercase()

/**
 * Compare two strings by Unicode code point, matching Rust's UTF-8 byte-lexicographic `String`
 * ordering (which equals code-point order) instead of Kotlin's default UTF-16 code-unit `compareTo`;
 * the two diverge only for supplementary characters, so this keeps the page sort faithful for any
 * folder name, not only the ASCII test vectors.
 *
 * @param left First string to compare.
 * @param right Second string to compare.
 * @return Negative, zero, or positive when [left] sorts before, equal to, or after [right].
 */
private fun compareByCodePoint(left: String, right: String): Int {
    var leftOffset = 0
    var rightOffset = 0
    while (leftOffset < left.length && rightOffset < right.length) {
        val leftCodePoint: Int = left.codePointAt(leftOffset)
        val rightCodePoint: Int = right.codePointAt(rightOffset)
        if (leftCodePoint != rightCodePoint) {
            return leftCodePoint.compareTo(rightCodePoint)
        }
        leftOffset += Character.charCount(leftCodePoint)
        rightOffset += Character.charCount(rightCodePoint)
    }
    return (left.length - leftOffset).compareTo(right.length - rightOffset)
}

/**
 * Composite map key ordering pages: sort-group first, then the case-folded label, then the original
 * label as a tiebreaker so two folders that case-fold alike (`Reol` and `REOL`) stay separate
 * buckets, ordered deterministically. Mirrors the Rust `BTreeMap` key tuple `(u8, String, String)`.
 *
 * @property group Sort-group tag ([FOLDER_GROUP], [LETTER_GROUP], or [CATCH_ALL_GROUP]).
 * @property fold Case-folded label, the primary text ordering within a group.
 * @property label Original label, retained both for display and as the equal-fold tiebreaker.
 */
private data class PageSortKey(
    val group: Int,
    val fold: String,
    val label: String,
) : Comparable<PageSortKey> {
    /**
     * Lexicographic comparison matching the Rust tuple sort: group, then case-folded label, then
     * original label, with code-point string ordering to mirror Rust's `String: Ord`.
     *
     * @param other Key to compare against.
     * @return Negative, zero, or positive per the first differing component.
     */
    override fun compareTo(other: PageSortKey): Int {
        val byGroup: Int = group.compareTo(other.group)
        if (byGroup != 0) return byGroup
        val byFold: Int = compareByCodePoint(fold, other.fold)
        if (byFold != 0) return byFold
        return compareByCodePoint(label, other.label)
    }
}

/**
 * Group the display strings into pages, sorted folder-pages-first (case-insensitively), then A-Z
 * letter pages, then the `#` catch-all; entries within each page stay in load order.
 *
 * Example:
 *
 * ```
 * paginate(listOf("Pop/b.flac", "Jazz/a.flac")).map { it.label } // ["Jazz", "Pop"]
 * ```
 *
 * @param names Track display strings in load order (one per queue track).
 * @return Pages in tab order; each [PageEntry] keeps its load-order index so a filtered row maps
 *   back to its real queue position. An empty input yields an empty list, not one empty page.
 */
fun paginate(names: List<String>): List<Page> {
    val groups: MutableMap<PageSortKey, MutableList<PageEntry>> = mutableMapOf()
    names.forEachIndexed { index, name ->
        val (group, label) = pageKey(name)
        val key = PageSortKey(group, sortKey(label), label)
        groups.getOrPut(key) { mutableListOf() }.add(PageEntry(index = index, name = name))
    }
    return groups.entries
        .sortedBy { it.key }
        .map { (key, entries) -> Page(label = key.label, entries = entries.toList()) }
}

/**
 * Find which page holds a given load-order track index, for auto-following the now-playing track to
 * its tab.
 *
 * @param pages Pages produced by [paginate].
 * @param index Load-order track index to locate.
 * @return Position of the first page whose entries include [index], or `null` when no page holds it.
 */
fun pageOfIndex(pages: List<Page>, index: Int): Int? {
    val position: Int = pages.indexOfFirst { page -> page.entries.any { it.index == index } }
    return if (position < 0) null else position
}
