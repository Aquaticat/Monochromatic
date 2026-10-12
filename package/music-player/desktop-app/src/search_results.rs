//! Search results for the Search page:
//!  the five page states and the ranked list of folder and track matches.
//!
//! Ported from `core/SearchResults.kt`.
//!  Folder names and track titles are the only matched fields (D60),
//!  and
//! folders and tracks share one relevance order (D61).
//!  The result cap applies after ordering,
//!  so the strongest
//! matches always survive it.
//!
//! Highlight offsets come from `search_matcher`:
//!  character offsets into the name or the parent context.
//! Ordering keys match Kotlin:
//!  tier,
//!  then the normalized name length in UTF-16 units (as Kotlin's `String.length`
//! counts them),
//!  then the collation key that stands in for the rail collator,
//!  then the display path by code point,
//! then the kind,
//!  then the library position.

/// Ordering result used when sorting search matches.
use std::cmp::Ordering;

/// Folder types and the folder index used to group results.
use crate::folder_index::{
    FolderEntry, FolderListItem, FolderTrackRow, UNFILED_FOLDER_NAME, folder_index,
};
/// Sort key that orders names the way the folder rail collates them.
use crate::folder_rail::collation_key;
/// Matcher helpers and the highlight type used by each result.
use crate::search_matcher::{
    SearchHighlight, highlight_ranges, match_tier, normalize_for_search, search_terms,
    trim_kotlin_whitespace,
};
/// One track with its URI and display path.
use crate::track::Track;
/// Title of a track,
///  from its display path.
use crate::track_entries::track_title_for;

/// What:
///      `pub const SEARCH_RESULT_LIMIT: usize = 500`.
///  The most results one search returns.
/// Why:
///       A huge library must not build an unbounded list,
///  and the state reports when the cap cut it short.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const SEARCH_RESULT_LIMIT = 500;
/// ```
pub const SEARCH_RESULT_LIMIT: usize = 500;

/// What:
///      `const PATH_SEPARATOR: char = '/'`.
///  The separator between the segments of a display path.
/// Why:
///       The parent context is the display path without its last segment,
///  so the split must use the same separator.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const PATH_SEPARATOR = "/";
/// ```
const PATH_SEPARATOR: char = '/';

/// What:
///      `pub enum SearchResultKind { Folder, Track }`.
///  The two kinds of entry a result can describe.
/// Why:
///       A row opens a folder (D72) or plays a track (D73),
///  so the kind decides the action.
///  Declaration order
///  makes `Folder` sort before `Track`,
///  which the relevance order relies on.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type SearchResultKind = "folder" | "track";
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum SearchResultKind {
    /// A top-level folder whose own name matched the query.
    Folder,
    /// A track whose own title,
    ///  from its file name without the extension,
    ///  matched the query.
    Track,
}

/// What:
///      `pub struct SearchResult { ... }`.
///  One matched folder or track,
///  ready to draw.
/// Why:
///       A row needs the title,
///  the context line,
///  the highlights for both,
///  and the action target in one value.
///  `folder_name` is always set,
///  because a folder result names itself and a track names its top-level folder,
///  so the Kotlin nullable type is not needed.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type SearchResult = { kind: SearchResultKind; name: string; parentContext: string | null; /* ... */ };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SearchResult {
    /// Whether this result is a folder or a track.
    pub kind: SearchResultKind,
    /// Folder name,
    ///  or track title without its extension.
    pub name: String,
    /// Folder path that holds the track as displayed.
    ///  `None` for a folder and for a root-level track.
    pub parent_context: Option<String>,
    /// Position of the track in the library list,
    ///  or `None` for a folder.
    pub index_in_library: Option<usize>,
    /// Top-level folder that owns this result,
    ///  which is the folder itself for a folder result.
    pub folder_name: String,
    /// Relevance tier,
    ///  where 0 is the best match and a larger value is a weaker match.
    pub tier: i32,
    /// Ranges of the name to emphasize,
    ///  in the name's own character offsets.
    pub name_highlights: Vec<SearchHighlight>,
    /// Ranges of the parent context to emphasize,
    ///  in its own character offsets,
    ///  and empty for a folder.
    pub parent_highlights: Vec<SearchHighlight>,
}

/// What:
///      `pub enum SearchState`.
///  The five states the Search page can be in.
/// Why:
///       The page must tell an empty prompt,
///  an unavailable library,
///  a finished no-match,
///  and results apart (D69).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type SearchState =
///   | { kind: "emptyQuery" }
///   | { kind: "unavailable" }
///   | { kind: "emptyInventory" }
///   | { kind: "noMatch"; query: string }
///   | { kind: "results"; items: SearchResult[]; truncated: boolean };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SearchState {
    /// No usable query was typed,
    ///  so the page shows its invitation (D70).
    EmptyQuery,
    /// The source is usable and confirmed to hold no tracks,
    ///  so no name can be searched.
    EmptyInventory,
    /// The library cannot be searched right now,
    ///  so no result claim is made (D71).
    Unavailable,
    /// The query was evaluated and no folder or track name matched it.
    ///  Carries the query,
    ///  trimmed (D70).
    NoMatch(
        /// The query text,
        ///  trimmed.
        String,
    ),
    /// Ranked matches,
    ///  with a flag that says whether the limit cut the list short.
    Results {
        /// Matched folders and tracks in relevance order,
        ///  at most `SEARCH_RESULT_LIMIT` of them.
        items: Vec<SearchResult>,
        /// Whether more matches existed than `items` holds.
        truncated: bool,
    },
}

/// What:
///      `struct SearchCandidate { result, normalized_length, name_key, sort_path }`.
///  A matched result with the
///  keys that order it.
/// Why:
///       The ordering keys are not shown,
///  so they stay out of `SearchResult`.
///  The collation key is computed once
///  per candidate,
///  so the sort does not rebuild it on every comparison.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type SearchCandidate = { result: SearchResult; normalizedLength: number; nameKey: string; sortPath: string };
/// ```
struct SearchCandidate {
    /// The result that will be shown if the candidate survives the limit.
    result: SearchResult,
    /// Length of the normalized,
    ///  trimmed name in UTF-16 units,
    ///  used before the collation key.
    normalized_length: usize,
    /// Collation key of the name that stands in for the rail collator.
    name_key: String,
    /// Display path of the folder or track,
    ///  used after the name key.
    sort_path: String,
}

/// What:
///      `fn utf16_length(text: &str) -> usize`.
///  The length of a text in UTF-16 code units.
/// Why:
///       Kotlin's `String.length` counts UTF-16 units,
///  and the length decides order,
///  so the same count keeps
///  the order identical for names with characters above U+FFFF.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const utf16Length = (s: string) => s.length;
/// ```
fn utf16_length(text: &str) -> usize {
    return text.encode_utf16().count();
}

/// What:
///      `fn parent_context_for(display_path: &str) -> Option<String>`.
///  The folder path that holds a track,
///  or `None`
///  for a root-level track.
/// Why:
///       The second line of a track result names its folder (D77).
///  A root-level track has no parent folder,
///  so no
///  parent is invented for it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const parentContextFor = (path: string) => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : null;
/// ```
fn parent_context_for(display_path: &str) -> Option<String> {
    let parent: &str = display_path
        .rsplit_once(PATH_SEPARATOR)
        .map_or("", |(parent_path, _file_name)| return parent_path);
    if parent.is_empty() {
        return None;
    }
    return Some(parent.to_string());
}

/// What:
///      `fn is_unfiled_entry(entry: &FolderEntry) -> bool`.
///  Tells the root-level Unfiled group apart from a real
///  top-level folder that is named `Unfiled`.
/// Why:
///       A real folder must stay searchable by its name (D60),
///  while the root-level group must not appear as a
///  folder result.
///  Real folder tracks always sit under `Unfiled/`,
///  and root-level tracks never do.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const isUnfiledEntry = (entry: FolderEntry) => entry.name === "Unfiled" && entry.items.every(isRootTrack);
/// ```
fn is_unfiled_entry(entry: &FolderEntry) -> bool {
    if entry.name != UNFILED_FOLDER_NAME {
        return false;
    }
    let folder_prefix: String = format!("{UNFILED_FOLDER_NAME}{PATH_SEPARATOR}");
    return entry.items.iter().all(|item| {
        return match item {
            FolderListItem::TrackItem(row) => !row.track.display_path.starts_with(&folder_prefix),
            FolderListItem::SubfolderHeader { .. } => false,
        };
    });
}

/// What:
///      `fn folder_candidate(entry: &FolderEntry, query: &str, terms: &[String]) -> Option<SearchCandidate>`.
///  Builds a folder result when the folder's own name matches every term.
/// Why:
///       Only the folder's name is matched (D60),
///  so the folder's tracks never enter the list through it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function folderCandidate(entry: FolderEntry, query: string, terms: string[]): SearchCandidate | null { /* ... */ }
/// ```
fn folder_candidate(entry: &FolderEntry, query: &str, terms: &[String]) -> Option<SearchCandidate> {
    let normalized_name: String =
        trim_kotlin_whitespace(&normalize_for_search(&entry.name)).to_string();
    let tier: i32 = match_tier(&normalized_name, terms)?;
    let name_highlights: Vec<SearchHighlight> = highlight_ranges(&entry.name, query);
    return Some(SearchCandidate {
        result: SearchResult {
            kind: SearchResultKind::Folder,
            name: entry.name.clone(),
            parent_context: None,
            index_in_library: None,
            folder_name: entry.name.clone(),
            tier,
            name_highlights,
            parent_highlights: Vec::new(),
        },
        normalized_length: utf16_length(&normalized_name),
        name_key: collation_key(&entry.name),
        sort_path: entry.name.clone(),
    });
}

/// What:
///      `fn track_candidate(row: &FolderTrackRow, folder_name: &str, query: &str, terms: &[String]) -> Option<SearchCandidate>`.
///  Builds a track result when the track's own title matches every term.
/// Why:
///       Only the final file name without its extension is matched (D60).
///  Its folder path is context,
///  never a source
///  of hits.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function trackCandidate(row, folderName, query, terms): SearchCandidate | null { /* ... */ }
/// ```
fn track_candidate(
    row: &FolderTrackRow,
    folder_name: &str,
    query: &str,
    terms: &[String],
) -> Option<SearchCandidate> {
    let display_path: &str = &row.track.display_path;
    let title: String = track_title_for(display_path);
    let normalized_title: String =
        trim_kotlin_whitespace(&normalize_for_search(&title)).to_string();
    let tier: i32 = match_tier(&normalized_title, terms)?;
    let parent_context: Option<String> = parent_context_for(display_path);
    let parent_highlights: Vec<SearchHighlight> = match &parent_context {
        Some(parent_path) => highlight_ranges(parent_path, query),
        None => Vec::new(),
    };
    let name_highlights: Vec<SearchHighlight> = highlight_ranges(&title, query);
    return Some(SearchCandidate {
        result: SearchResult {
            kind: SearchResultKind::Track,
            name: title.clone(),
            parent_context,
            index_in_library: Some(row.index_in_library),
            folder_name: folder_name.to_string(),
            tier,
            name_highlights,
            parent_highlights,
        },
        normalized_length: utf16_length(&normalized_title),
        name_key: collation_key(&title),
        sort_path: display_path.to_string(),
    });
}

/// What:
///      `fn candidates_for(query: &str, terms: &[String], tracks: &[Track]) -> Vec<SearchCandidate>`.
///  Gathers every
///  matching folder and track,
///  before ordering and the limit.
/// Why:
///       Folders come from the folder index without its root-level group,
///  and tracks come from every folder's track
///  rows,
///  so each track is searched exactly once.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function candidatesFor(query: string, terms: string[], tracks: Track[]): SearchCandidate[] { /* ... */ }
/// ```
fn candidates_for(query: &str, terms: &[String], tracks: &[Track]) -> Vec<SearchCandidate> {
    let entries: Vec<FolderEntry> = folder_index(tracks);
    let mut candidates: Vec<SearchCandidate> = entries
        .iter()
        .filter(|entry| return !is_unfiled_entry(entry))
        .filter_map(|entry| return folder_candidate(entry, query, terms))
        .collect();
    for entry in &entries {
        for item in &entry.items {
            if let FolderListItem::TrackItem(row) = item {
                candidates.extend(track_candidate(row, &entry.name, query, terms));
            }
        }
    }
    return candidates;
}

/// What:
///      `fn candidate_order(left: &SearchCandidate, right: &SearchCandidate) -> Ordering`.
///  The total order that ranks
///  candidates for display.
/// Why:
///       Ordering runs tier first,
///  then shorter names,
///  then the collation key,
///  then display path,
///  then kind and
///  library position.
///  Two equal results therefore never swap places between repeated searches.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const candidateOrder = (a, b) => a.tier - b.tier || a.len - b.len || /* ... */ 0;
/// ```
fn candidate_order(left: &SearchCandidate, right: &SearchCandidate) -> Ordering {
    return left
        .result
        .tier
        .cmp(&right.result.tier)
        .then_with(|| return left.normalized_length.cmp(&right.normalized_length))
        .then_with(|| return left.name_key.cmp(&right.name_key))
        .then_with(|| return left.sort_path.cmp(&right.sort_path))
        .then_with(|| return left.result.kind.cmp(&right.result.kind))
        .then_with(|| {
            return left
                .result
                .index_in_library
                .cmp(&right.result.index_in_library);
        });
}

/// What:
///      `pub fn search_library(query: &str, tracks: &[Track], available: bool) -> SearchState`.
///  Answers one Search
///  query against the library.
/// Why:
///       The page must know which state applies,
///  and a source failure must win over the query state (D69).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function searchLibrary(query: string, tracks: Track[], available: boolean): SearchState { /* ... */ }
/// ```
pub fn search_library(query: &str, tracks: &[Track], available: bool) -> SearchState {
    if !available {
        return SearchState::Unavailable;
    }
    let terms: Vec<String> = search_terms(query);
    if terms.is_empty() {
        return SearchState::EmptyQuery;
    }
    if tracks.is_empty() {
        return SearchState::EmptyInventory;
    }
    let mut candidates: Vec<SearchCandidate> = candidates_for(query, &terms, tracks);
    if candidates.is_empty() {
        return SearchState::NoMatch(trim_kotlin_whitespace(query).to_string());
    }
    candidates.sort_by(candidate_order);
    let truncated: bool = candidates.len() > SEARCH_RESULT_LIMIT;
    let items: Vec<SearchResult> = candidates
        .into_iter()
        .take(SEARCH_RESULT_LIMIT)
        .map(|candidate| return candidate.result)
        .collect();
    return SearchState::Results { items, truncated };
}

/// Unit tests in `search_results_tests.rs`,
///  pulled in at this point.
#[cfg(test)]
#[path = "search_results_tests.rs"]
mod tests;

/// Ordering and limit tests in `search_results_order_tests.rs`,
///  pulled in at this point.
#[cfg(test)]
#[path = "search_results_order_tests.rs"]
mod order_tests;
