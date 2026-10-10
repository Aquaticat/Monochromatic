// Search results for the Search page. It turns the library and a query into one of five states: no query
// yet, unavailable, an empty library, no match, or a ranked list of folder and track results. Folder names
// and track titles are the only matched fields (D60), and folders and tracks share one relevance order (D61).

// What:     `package dev.monochromatic.musicplayer.core` places the results beside the matcher and folder index.
// Why:      Ranking and the state rules are pure logic over `Track` values, so they can be unit-tested on the JVM.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer.core

// What:     `import dev.monochromatic.musicplayer.Track` brings in the library track type.
// Why:      `Track` lives in the parent package, so the core package must import it by absolute name.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Track } from "dev.monochromatic.musicplayer/Track";
// ```
import dev.monochromatic.musicplayer.Track

// What:     `import java.text.Collator` brings in the locale-aware comparator type.
// Why:      Names with the same relevance are ordered by the same collator the folder rail uses.
//
// In TS you'd write (pseudocode):
// ```ts
// // Intl.Collator
// ```
import java.text.Collator

// What:     `const val SEARCH_RESULT_LIMIT: Int = 500` caps how many results one search returns.
// Why:      A huge library must not build an unbounded list, and the result reports when the cap cut it short.
//
// In TS you'd write (pseudocode):
// ```ts
// export const SEARCH_RESULT_LIMIT = 500;
// ```
/** Largest number of results one search returns before the list is cut short. */
const val SEARCH_RESULT_LIMIT: Int = 500

// What:     `private const val PATH_SEPARATOR: Char = '/'` separates the segments of a display path.
// Why:      The parent context is the display path without its last segment, so the split must use the
//           same separator.
//
// In TS you'd write (pseudocode):
// ```ts
// const PATH_SEPARATOR = "/";
// ```
/** Separator between the segments of a display path. */
private const val PATH_SEPARATOR: Char = '/'

// What:     `enum class SearchResultKind { FOLDER, TRACK }` names the two kinds of Search result.
// Why:      The row needs to know whether a tap opens a folder (D72) or plays a track (D73).
//
// In TS you'd write (pseudocode):
// ```ts
// type SearchResultKind = "folder" | "track";
// ```
/** The two kinds of entry a Search result can describe. */
enum class SearchResultKind {
    // What:     `FOLDER` is a top-level folder whose own name matched.
    // Why:      A folder result opens its folder without starting playback (D72).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const FOLDER = "folder";
    // ```
    /** A top-level folder whose own name matched the query. */
    FOLDER,

    // What:     `TRACK` is a track whose own file name, without its extension, matched the query.
    // Why:      A track result plays the track and carries its folder as context (D77).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const TRACK = "track";
    // ```
    /** A track whose own title, from its file name without the extension, matched the query. */
    TRACK,
}

// What:     `data class SearchResult(...)` is one matched folder or track, ready to draw.
// Why:      The row needs the title, the context line, the highlights for both, and the action target in one value.
//
// In TS you'd write (pseudocode):
// ```ts
// type SearchResult = { kind: SearchResultKind; name: string; parentContext: string | null; /* ... */ };
// ```
/** One matched folder or track in a Search result list. */
data class SearchResult(
    /** Whether this result is a folder or a track. */
    val kind: SearchResultKind,
    /** Folder name, or track title without its extension. */
    val name: String,
    /**
     * Folder path that holds the track as displayed. Null for a folder, and null for a root-level track,
     * which has no folder to name.
     */
    val parentContext: String?,
    /** Position of the track in the library list, or null for a folder. */
    val indexInLibrary: Int?,
    /** Top-level folder that owns this result, which is the folder itself for a folder result. */
    val folderName: String?,
    /** Relevance tier, where 0 is the best match and a larger value is a weaker match. */
    val tier: Int,
    /** Ranges of the name to emphasize, in the name's own offsets. */
    val nameHighlights: List<SearchHighlight>,
    /** Ranges of the parent context to emphasize, in the context's own offsets, and empty for a folder. */
    val parentHighlights: List<SearchHighlight>,
)

// What:     `sealed interface SearchState` lists the five states the Search page can be in.
// Why:      The page must tell an empty prompt, an unavailable library, a finished no-match, and results apart (D69).
//
// In TS you'd write (pseudocode):
// ```ts
// type SearchState =
//   | { kind: "emptyQuery" }
//   | { kind: "unavailable" }
//   | { kind: "emptyInventory" }
//   | { kind: "noMatch"; query: string }
//   | { kind: "results"; items: SearchResult[]; truncated: boolean };
// ```
/** The state of the Search page for one query and library snapshot. */
sealed interface SearchState {
    // What:     `data object EmptyQuery` is the state for a blank query.
    // Why:      A blank query shows the search invitation, not a failed lookup (D70).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "emptyQuery" }
    // ```
    /** No usable query was typed, so the page shows its invitation. */
    data object EmptyQuery : SearchState

    // What:     `data object EmptyInventory` is the state for a usable source that holds no tracks.
    // Why:      A confirmed empty inventory is not a finished no-match (D69), so it gets its own copy.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "emptyInventory" }
    // ```
    /** The source is usable and confirmed to hold no tracks, so no name can be searched. */
    data object EmptyInventory : SearchState

    // What:     `data object Unavailable` is the state when the current source cannot be searched.
    // Why:      A known source failure takes precedence over every query state (D69 and D71).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "unavailable" }
    // ```
    /** The library cannot be searched right now, so no result claim is made. */
    data object Unavailable : SearchState

    // What:     `data class NoMatch(val query: String)` is the state for a finished search with no hits.
    // Why:      The page names the entered text so the user knows which query found nothing (D70).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "noMatch"; query: string }
    // ```
    /** The query was evaluated against the library and no folder or track name matched it. */
    data class NoMatch(
        /** The entered query, trimmed of surrounding whitespace. */
        val query: String,
    ) : SearchState

    // What:     `data class Results(...)` is the state for one or more matches.
    // Why:      Results carry their order, and the truncated flag tells the page the list is not the whole answer.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "results"; items: SearchResult[]; truncated: boolean }
    // ```
    /** Ranked matches for a query, with a flag that says whether the limit cut the list short. */
    data class Results(
        /** Matched folders and tracks in relevance order, at most `SEARCH_RESULT_LIMIT` of them. */
        val items: List<SearchResult>,
        /** Whether more matches existed than `items` holds. */
        val truncated: Boolean,
    ) : SearchState
}

// What:     `private data class SearchCandidate(...)` pairs a result with the values used only for ordering.
// Why:      The display path and normalized length decide order but are not shown, so they stay out of the result.
//
// In TS you'd write (pseudocode):
// ```ts
// type SearchCandidate = { result: SearchResult; normalizedLength: number; sortPath: string };
// ```
/** A matched result together with the sort keys that order it. */
private data class SearchCandidate(
    /** The result that will be shown if the candidate survives the limit. */
    val result: SearchResult,
    /** Length of the normalized, trimmed name, used before the collator to order equal tiers. */
    val normalizedLength: Int,
    /** Display path of the folder or track, used as the last ordering key before the kind and library position. */
    val sortPath: String,
)

// What:     `private fun parentContextFor(displayPath: String): String?` returns the folder path that holds a track,
//           or null for a root-level track.
// Why:      The second line of a track result names its folder (D77). A root-level track has no parent folder, so
//           it has no second line, and no parent is invented for it.
//
// In TS you'd write (pseudocode):
// ```ts
// const parentContextFor = (path: string) => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : null;
// ```
/** Returns the folder path of a track as displayed, or null when the track sits at the library root. */
private fun parentContextFor(displayPath: String): String? {
    /** The display path without its last segment, which is empty for a root-level track. */
    val parent: String = displayPath.substringBeforeLast(PATH_SEPARATOR, "")
    if (parent.isEmpty()) {
        return null
    }
    return parent
}

// What:     `private fun isUnfiledEntry(entry: FolderEntry): Boolean` tells the root-level Unfiled entry apart from a
//           real top-level folder that happens to be named `Unfiled`.
// Why:      A real folder must stay searchable by its name (D60), while the root-level group must not appear as a
//           folder result. Real folder tracks always sit under `Unfiled/`, and root-level tracks never do.
//
// In TS you'd write (pseudocode):
// ```ts
// const isUnfiledEntry = (entry: FolderEntry) => entry.name === "Unfiled" && entry.items.every(isRootTrack);
// ```
/** Reports whether a folder entry is the root-level group rather than a real folder named `Unfiled`. */
private fun isUnfiledEntry(entry: FolderEntry): Boolean {
    if (entry.name != UNFILED_FOLDER_NAME) {
        return false
    }
    /** Prefix that every track of a real folder named `Unfiled` carries in its display path. */
    val folderPrefix: String = UNFILED_FOLDER_NAME + PATH_SEPARATOR
    return entry.items.all { item ->
        item is FolderListItem.TrackItem && !item.row.track.displayPath.startsWith(folderPrefix)
    }
}

// What:     `private fun folderCandidate(entry: FolderEntry, query: String, terms: List<String>): SearchCandidate?`
//           builds a folder result when the folder's own name matches.
// Why:      Only the folder's name is matched (D60), so the folder's tracks never enter the list through it.
//
// In TS you'd write (pseudocode):
// ```ts
// function folderCandidate(entry: FolderEntry, query: string, terms: string[]): SearchCandidate | null { /* ... */ }
// ```
/** Builds a folder result for an entry whose name matches every term, or returns null when it does not. */
private fun folderCandidate(entry: FolderEntry, query: String, terms: List<String>): SearchCandidate? {
    /** Normalized, trimmed folder name that the matcher compares. */
    val normalizedName: String = normalizeForSearch(entry.name).trim()
    /** Relevance tier of the folder name, or null when the name does not match, which returns early. */
    val tier: Int = matchTier(normalizedName, terms) ?: return null
    return SearchCandidate(
        result = SearchResult(
            kind = SearchResultKind.FOLDER,
            name = entry.name,
            parentContext = null,
            indexInLibrary = null,
            folderName = entry.name,
            tier = tier,
            nameHighlights = highlightRanges(entry.name, query),
            parentHighlights = emptyList(),
        ),
        normalizedLength = normalizedName.length,
        sortPath = entry.name,
    )
}

// What:     `private fun trackCandidate(row: FolderTrackRow, folderName: String, query: String, terms: List<String>)`
//           builds a track result when the track's own title matches.
// Why:      Only the final file name without its extension is matched (D60). Its folder path is context,
//           never a source of hits.
//
// In TS you'd write (pseudocode):
// ```ts
// function trackCandidate(row, folderName, query, terms): SearchCandidate | null { /* ... */ }
// ```
/** Builds a track result for a row whose title matches every term, or returns null when it does not. */
private fun trackCandidate(
    row: FolderTrackRow,
    folderName: String,
    query: String,
    terms: List<String>,
): SearchCandidate? {
    /** Display path of the track, which supplies the title, the context, and the sort path. */
    val displayPath: String = row.track.displayPath
    /** Title of the track, which is its file name without the last extension. */
    val title: String = trackTitleFor(displayPath)
    /** Normalized, trimmed title that the matcher compares. */
    val normalizedTitle: String = normalizeForSearch(title).trim()
    /** Relevance tier of the track title, or null when the title does not match, which returns early. */
    val tier: Int = matchTier(normalizedTitle, terms) ?: return null
    /** Folder path that holds the track, shown as its context line, or null for a root-level track. */
    val parentContext: String? = parentContextFor(displayPath)
    return SearchCandidate(
        result = SearchResult(
            kind = SearchResultKind.TRACK,
            name = title,
            parentContext = parentContext,
            indexInLibrary = row.indexInLibrary,
            folderName = folderName,
            tier = tier,
            nameHighlights = highlightRanges(title, query),
            parentHighlights = if (parentContext == null) emptyList() else highlightRanges(parentContext, query),
        ),
        normalizedLength = normalizedTitle.length,
        sortPath = displayPath,
    )
}

// What:     `private fun candidatesFor(query: String, terms: List<String>, tracks: List<Track>)` returns the
//           `List<SearchCandidate>` of every folder and track that matches, before ordering and the limit.
// Why:      Folders come from the folder index without its root-level group, and tracks come from every folder's
//           track rows, so each track is searched exactly once.
//
// In TS you'd write (pseudocode):
// ```ts
// function candidatesFor(query: string, terms: string[], tracks: Track[]): SearchCandidate[] { /* ... */ }
// ```
/** Gathers every matching folder result and track result for the library, unordered. */
private fun candidatesFor(query: String, terms: List<String>, tracks: List<Track>): List<SearchCandidate> {
    /** Folder entries of the library, one per top-level folder plus the root-level group when it has tracks. */
    val entries: List<FolderEntry> = folderIndex(tracks)
    /** Folder results for entries whose own name matches, with the root-level group excluded. */
    val folderMatches: List<SearchCandidate> = entries
        .filterNot { entry -> isUnfiledEntry(entry) }
        .mapNotNull { entry -> folderCandidate(entry, query, terms) }
    /** Track results for every track row of every entry, each carrying its owning folder name. */
    val trackMatches: List<SearchCandidate> = entries.flatMap { entry ->
        entry.items
            .filterIsInstance<FolderListItem.TrackItem>()
            .mapNotNull { item -> trackCandidate(item.row, entry.name, query, terms) }
    }
    return folderMatches + trackMatches
}

// What:     `private fun candidateOrder(collator: Collator): Comparator<SearchCandidate>` orders candidates
//           for display.
// Why:      Ordering runs tier first, then shorter names, then collator order, then display path, then kind
//           and library position, so two equal results never swap places between repeated searches.
//
// In TS you'd write (pseudocode):
// ```ts
// const candidateOrder = (collator: Intl.Collator) => (a, b) => a.tier - b.tier || a.len - b.len || /* ... */ 0;
// ```
/** Builds the total order used to rank candidates, using the given collator for names. */
private fun candidateOrder(collator: Collator): Comparator<SearchCandidate> =
    compareBy<SearchCandidate>({ candidate -> candidate.result.tier }, { candidate -> candidate.normalizedLength })
        .thenComparator { left, right -> collator.compare(left.result.name, right.result.name) }
        .thenComparator { left, right -> compareByCodePoint(left.sortPath, right.sortPath) }
        .thenBy { candidate -> candidate.result.kind }
        .thenComparator { left, right -> compareValues(left.result.indexInLibrary, right.result.indexInLibrary) }

// What:     `fun searchLibrary(query: String, tracks: List<Track>, available: Boolean): SearchState` answers one
//           Search query against the library.
// Why:      The page must know which of the four states applies, and a source failure must win over the query state.
//
// In TS you'd write (pseudocode):
// ```ts
// function searchLibrary(query: string, tracks: Track[], available: boolean): SearchState { /* ... */ }
// ```
/**
 * Evaluates one query against the library and reports the page state.
 *
 * An unavailable source wins over a blank query, so a known failure is never hidden behind the search prompt (D69).
 * A blank query, or one that normalizes to no terms, returns `EmptyQuery`. A usable source with no tracks returns
 * `EmptyInventory`, which is not a finished no-match (D69). A complete evaluation with no hit returns `NoMatch`.
 * Otherwise the results are ordered and cut at `SEARCH_RESULT_LIMIT`.
 */
fun searchLibrary(query: String, tracks: List<Track>, available: Boolean): SearchState {
    if (!available) {
        return SearchState.Unavailable
    }
    /** Normalized query terms, which every match must satisfy. */
    val terms: List<String> = searchTerms(query)
    if (terms.isEmpty()) {
        return SearchState.EmptyQuery
    }
    if (tracks.isEmpty()) {
        return SearchState.EmptyInventory
    }
    /** Every matching folder and track, before ordering and the limit. */
    val candidates: List<SearchCandidate> = candidatesFor(query, terms, tracks)
    if (candidates.isEmpty()) {
        return SearchState.NoMatch(query.trim())
    }
    /** Candidates in display order, with the strongest matches first. */
    val ordered: List<SearchCandidate> = candidates.sortedWith(candidateOrder(railCollator()))
    return SearchState.Results(
        items = ordered.take(SEARCH_RESULT_LIMIT).map { candidate -> candidate.result },
        truncated = ordered.size > SEARCH_RESULT_LIMIT,
    )
}
