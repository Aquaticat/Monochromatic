//! Pure Search page model: the rows, emphasis segments and status text for one query.
//!
//! What: `search_view` runs the library search and turns each result into plain rows.
//! Why: row order, emphasis spans and the status claim are decided here, so the window only places text.

use music_player::search_page_model::{
    is_current_track_result, search_emphasis_spans, search_row_second_line, search_status_line,
};
use music_player::search_results::{SearchResult, SearchResultKind, SearchState, search_library};
use music_player::track::Track;

/// What: `Segment` is one piece of a result line, plain or emphasized (a query match).
/// Why: the pane draws emphasized pieces bold on a tint, so each line arrives pre-split.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Segment = { text: string; emphasized: boolean };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Segment {
    /// Text of this piece.
    pub text: String,
    /// Whether this piece is a query match.
    pub emphasized: bool,
}

/// What: `SearchRowView` is one Search result row before it becomes a window struct.
/// Why: the window needs plain values, and the tests need the row without Slint.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type SearchRowView = { kind: 0 | 1; title: Segment[]; parent: Segment[]; hasParent: boolean; ... };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SearchRowView {
    /// 0 for a folder result, 1 for a track result.
    pub kind: i32,
    /// Title line split into emphasized pieces.
    pub title: Vec<Segment>,
    /// Parent folder line split into emphasized pieces; empty when `has_parent` is false.
    pub parent: Vec<Segment>,
    /// Whether the second line is shown.
    pub has_parent: bool,
    /// Whether this track is the current track.
    pub current: bool,
    /// Whether the current track is playing.
    pub playing: bool,
    /// Position of the result in the result list, which `open` reports back.
    pub index: i32,
}

/// What: `SearchView` is the Search page's rows and status block for one query.
/// Why: the status block shows when there are no rows, so both come from one query run.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type SearchView = { rows: SearchRowView[]; statusTitle: string; statusDetail: string };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SearchView {
    /// Result rows in result order; empty when the status block is shown.
    pub rows: Vec<SearchRowView>,
    /// Status block title, or empty when results are shown.
    pub status_title: String,
    /// Status block detail, or empty when there is none.
    pub status_detail: String,
    /// The result list the row indices refer to.
    pub results: Vec<SearchResult>,
}

/// What: `segments` splits `text` into plain and emphasized pieces at the highlight spans.
/// Why: the search highlights are character offsets, so the split walks characters, not bytes.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const segments = (text: string, spans: Span[]): Segment[] => { ... };
/// ```
pub fn segments(text: &str, highlights: &[music_player::search_matcher::SearchHighlight]) -> Vec<Segment> {
    let spans = search_emphasis_spans(text, highlights);
    let mut pieces: Vec<Segment> = Vec::new();
    for (position, ch) in text.chars().enumerate() {
        let offset = i32::try_from(position).unwrap_or(i32::MAX);
        let emphasized = spans.iter().any(|span| return offset >= span.start && offset < span.end);
        match pieces.last_mut() {
            Some(last) if last.emphasized == emphasized => last.text.push(ch),
            _ => pieces.push(Segment {
                text: ch.to_string(),
                emphasized,
            }),
        }
    }
    return pieces;
}

/// What: `row_view` converts one result into a row at `position` in the result list.
/// Why: folder and track results share one row shape, with the track-only fields left empty for folders.
fn row_view(result: &SearchResult, position: usize, current_index: Option<usize>, playing: bool) -> SearchRowView {
    let current = is_current_track_result(result, current_index);
    let parent_text = search_row_second_line(result);
    let parent_segments = match &parent_text {
        Some(text) => segments(text, &result.parent_highlights),
        None => Vec::new(),
    };
    return SearchRowView {
        kind: match result.kind {
            SearchResultKind::Folder => 0,
            SearchResultKind::Track => 1,
        },
        title: segments(&result.name, &result.name_highlights),
        parent: parent_segments,
        has_parent: parent_text.is_some(),
        current,
        playing: current && playing,
        index: i32::try_from(position).unwrap_or(-1),
    };
}

/// What: `search_view` runs the query over the library and returns the rows or the status block.
/// Why: an empty query, an empty library and a query with no match each show a different status claim.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const searchView = (query: string, tracks: Track[], current?: number, playing?: boolean): SearchView => { ... };
/// ```
pub fn search_view(query: &str, tracks: &[Track], current_index: Option<usize>, playing: bool) -> SearchView {
    let state = search_library(query, tracks, true);
    let results: Vec<SearchResult> = match &state {
        SearchState::Results { items, .. } => items.clone(),
        _ => Vec::new(),
    };
    let rows: Vec<SearchRowView> = results
        .iter()
        .enumerate()
        .map(|(position, result)| return row_view(result, position, current_index, playing))
        .collect();
    let (status_title, status_detail) = match search_status_line(&state) {
        Some(line) => (line.title, line.detail.unwrap_or("").to_string()),
        None => (String::new(), String::new()),
    };
    return SearchView {
        rows,
        status_title,
        status_detail,
        results,
    };
}

#[cfg(test)]
#[path = "ui_search_model_tests.rs"]
mod tests;
