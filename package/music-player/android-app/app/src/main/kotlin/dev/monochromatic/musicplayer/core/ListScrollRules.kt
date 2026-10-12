// Pure scroll rules for the track list pane: what identifies a page, which playing row position is current, and
// which item a page change scrolls to. This file has no Compose imports, so it is unit-tested on the JVM.

// What:     `package dev.monochromatic.musicplayer.core` places these rules beside the entries they read.
// Why:      The rules take `TrackListEntry` values only, so they share its package and need no import.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer.core

// What:     `internal fun entryKeyOf(entry: TrackListEntry): String` gives each entry a stable list key.
// Why:      Keys keep row state with its track as the list changes, and the prefixes keep rows and headers apart.
//
// In TS you'd write (pseudocode):
// ```ts
// const entryKeyOf = (entry: TrackListEntry): string =>
//   entry.kind === "row" ? `row-${entry.row.indexInLibrary}` : `header-${entry.name}`;
// ```
/** Stable key for one entry, built from the library index for rows and the subfolder name for headers. */
internal fun entryKeyOf(entry: TrackListEntry): String = when (entry) {
    is TrackListEntry.RowEntry -> "row-" + entry.row.indexInLibrary
    is TrackListEntry.HeaderEntry -> "header-" + entry.name
}

// What:     `private fun pageTokenOf(entry: TrackListEntry): String` gives one entry its index-free page token.
// Why:      A row is identified by its title and a header by its name, so a library scan that shifts library indexes
//           leaves the token unchanged. The prefixes keep a row and a header with one text apart.
//
// In TS you'd write (pseudocode):
// ```ts
// const pageTokenOf = (entry: TrackListEntry): string =>
//   entry.kind === "row" ? `row:${entry.row.title}` : `header:${entry.name}`;
// ```
/** Index-free token for one entry, built from the track title for rows and the subfolder name for headers. */
private fun pageTokenOf(entry: TrackListEntry): String = when (entry) {
    is TrackListEntry.RowEntry -> "row:" + entry.row.title
    is TrackListEntry.HeaderEntry -> "header:" + entry.name
}

// What:     `internal fun pageIdentityOf(entries: List<TrackListEntry>): List<String>` lists the page tokens in order.
// Why:      The tokens follow the shown folder's tracks, and stay the same when the playing row, a measure, or a
//           library index changes. A track added to or removed from the folder changes the list, which
//           isSamePageUpdate reads.
//
// In TS you'd write (pseudocode):
// ```ts
// const pageIdentityOf = (entries: TrackListEntry[]): string[] => entries.map(pageTokenOf);
// ```
/** Ordered tokens of the entries on one page, which identify the page while its tracks and headers stay the same. */
internal fun pageIdentityOf(entries: List<TrackListEntry>): List<String> = entries.map { entry -> pageTokenOf(entry) }

// What:     `private fun isSubsequence(shorter: List<String>, longer: List<String>): Boolean` tells whether the
//           tokens of `shorter` appear in `longer` in the same order.
// Why:      A scan inserts tracks between existing ones and a rescan drops some, so the old page stays an ordered
//           subsequence of the new one. Tokens of other tracks may sit between the matched ones.
//
// In TS you'd write (pseudocode):
// ```ts
// const isSubsequence = (shorter: string[], longer: string[]): boolean => {
//   let matched = 0;
//   for (const token of longer) if (matched < shorter.length && shorter[matched] === token) matched++;
//   return matched === shorter.length;
// };
// ```
/** Whether every token of [shorter] appears in [longer] in the same order, with other tokens allowed between them. */
private fun isSubsequence(shorter: List<String>, longer: List<String>): Boolean {
    /** Count of leading tokens of [shorter] already matched while walking [longer]. */
    var matched: Int = 0
    for (token in longer) {
        if (matched < shorter.size && shorter[matched] == token) {
            matched += 1
        }
    }
    return matched == shorter.size
}

// What:     `internal fun isSamePageUpdate(previous: List<String>?, next: List<String>): Boolean` tells whether a new
//           identity is the page that was already shown.
// Why:      A library scan that adds or drops tracks in the shown folder keeps the page, so the list must not scroll.
//           A first population, an emptied page, or a different folder is a page change.
//
// In TS you'd write (pseudocode):
// ```ts
// const isSamePageUpdate = (previous: string[] | null, next: string[]): boolean =>
//   previous !== null && previous.length > 0 && next.length > 0 &&
//   (isSubsequence(previous, next) || isSubsequence(next, previous));
// ```
/** Whether [next] is the page shown in [previous], which holds when one token list is an ordered subsequence of it. */
internal fun isSamePageUpdate(previous: List<String>?, next: List<String>): Boolean {
    if (previous == null || previous.isEmpty() || next.isEmpty()) {
        return false
    }
    return isSubsequence(previous, next) || isSubsequence(next, previous)
}

// What:     `internal fun currentPositionOf(entries: List<TrackListEntry>): Int?` finds the playing row's position.
// Why:      The reveal and page scrolls need the list position of the playing row, and a list without one has none.
//
// In TS you'd write (pseudocode):
// ```ts
// const currentPositionOf = (entries: TrackListEntry[]): number | null => {
//   const position = entries.findIndex((e) => e.kind === "row" && e.row.isCurrent);
//   return position < 0 ? null : position;
// };
// ```
/** Position of the current track row among the entries, or null when no row is current. */
internal fun currentPositionOf(entries: List<TrackListEntry>): Int? {
    /** Index of the first current row, or a negative value when no row is current. */
    val position: Int = entries.indexOfFirst { entry ->
        entry is TrackListEntry.RowEntry && entry.row.isCurrent
    }
    if (position < 0) {
        return null
    }
    return position
}

// What:     `internal fun pageEntryScrollTarget(entries: List<TrackListEntry>): Int` gives the item a page scrolls to.
// Why:      A page that holds the playing row starts at that row, and any other page starts at its top.
//
// In TS you'd write (pseudocode):
// ```ts
// const pageEntryScrollTarget = (entries: TrackListEntry[]): number => currentPositionOf(entries) ?? 0;
// ```
/** Item the list scrolls to when a page appears or changes: the playing row, or the top when no row is playing. */
internal fun pageEntryScrollTarget(entries: List<TrackListEntry>): Int = currentPositionOf(entries) ?: 0
