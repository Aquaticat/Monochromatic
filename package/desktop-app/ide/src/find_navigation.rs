//! Relate accepted in-file matches to the reading selection without owning either.

/// Match ranges and their shared list come from the single matching function.
use crate::find::{FindMatches, FindRange, FindRanges};
/// What: `Arc` shares one immutable allocation between owners.
/// Why: A stale result returns an empty list without copying or exposing its outdated ranges.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const empty: ReadonlyArray<FindRange> = [];
/// ```
use std::sync::Arc;

/// What: `&[FindRange]` borrows a sorted list; `Option<usize>` is an index or nothing.
/// Why: The active match is derived from the selection, so reloads and clicks need no second cursor.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function active(ranges: FindRange[], start: number, end: number): number | undefined;
/// ```
pub fn active(ranges: &[FindRange], start: usize, end: usize) -> Option<usize> {
    // What: `partition_point` binary-searches a sorted list; `|range|` is a closure parameter.
    // Why: Up to ten thousand ranges are consulted on every selection change.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const index = lowerBound(ranges, range => range.start < start);
    // ```
    let index = ranges.partition_point(|range| return range.start < start);
    // What: `get` returns `Some(&range)` inside the list or `None` past its end.
    // Why: A selection after the last match must not index out of bounds.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const candidate = ranges[index]; if (candidate === undefined) return undefined;
    // ```
    let Some(candidate) = ranges.get(index) else {
        // None means the selection is not exactly one match.
        return None;
    };
    if candidate.start == start && candidate.end == end {
        // Some wraps the present index.
        return Some(index);
    }
    return None;
}

/// First match starting at or after `origin`, wrapping to the first match of the document.
/// Incremental typing passes the selection start; Enter passes the selection end.
pub fn at_or_after(ranges: &[FindRange], origin: usize) -> Option<usize> {
    if ranges.is_empty() {
        return None;
    }
    let index = ranges.partition_point(|range| return range.start < origin);
    if index == ranges.len() {
        return Some(0);
    }
    return Some(index);
}

/// Last match ending at or before `origin`, wrapping to the last match of the document.
/// Shift+Enter passes the selection start.
pub fn at_or_before(ranges: &[FindRange], origin: usize) -> Option<usize> {
    if ranges.is_empty() {
        return None;
    }
    let index = ranges.partition_point(|range| return range.end <= origin);
    if index == 0 {
        return Some(ranges.len() - 1);
    }
    return Some(index - 1);
}

/// What: The returned `&[FindRange]` borrows a contiguous part of the input list.
/// Why: Painting shapes rectangles only for matches intersecting the materialized rows.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function visible(ranges: FindRange[], start: number, end: number): FindRange[];
/// ```
pub fn visible(ranges: &[FindRange], start: usize, end: usize) -> &[FindRange] {
    let first = ranges.partition_point(|range| return range.end <= start);
    let last = ranges.partition_point(|range| return range.start < end);
    if last <= first {
        // What: `&ranges[0..0]` borrows an empty part of the same list.
        // Why: An inverted or empty window has no visible matches.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return [];
        // ```
        return &ranges[0..0];
    }
    return &ranges[first..last];
}

/// Visible count text and its spoken form; the two strings always describe the same state.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FindStatus {
    /// Compact "active/total" text, or "No matches".
    pub label: String,
    /// Full sentence for accessibility tools.
    pub detail: String,
    /// True only for a completed search without matches.
    pub no_match: bool,
}

/// Describe accepted matches relative to the optional active index.
pub fn status(matches: &FindMatches, active_index: Option<usize>) -> FindStatus {
    let total = matches.ranges.len();
    if total == 0 {
        // What: `to_string` copies a literal into an owned `String`.
        // Why: The status outlives this function and is handed to the window.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { label: 'No matches', detail: 'No matches', noMatch: true };
        // ```
        return FindStatus {
            label: "No matches".to_string(),
            detail: "No matches".to_string(),
            no_match: true,
        };
    }
    let mut suffix = "";
    let mut more = "";
    if matches.truncated {
        suffix = "+";
        more = " or more";
    }
    // What: `if let Some(index)` runs only when an active index is present.
    // Why: A selection away from every match still reports the total.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (activeIndex !== undefined) return { label: `${activeIndex + 1}/${total}`, ... };
    // ```
    if let Some(index) = active_index {
        let number = index + 1;
        return FindStatus {
            label: format!("{number}/{total}{suffix}"),
            detail: format!("Match {number} of {total}{more}"),
            no_match: false,
        };
    }
    return FindStatus {
        label: format!("0/{total}{suffix}"),
        detail: format!("{total}{more} matches, none selected"),
        no_match: false,
    };
}

/// Accepted matches remember the displayed file and revision whose positions they describe.
pub struct FindResults {
    /// File-open generation at acceptance.
    file: u64,
    /// Content revision at acceptance.
    revision: u64,
    /// Shared ranges and truncation state.
    matches: FindMatches,
}

/// Results are read only through an identity check, so stale positions cannot be painted.
impl FindResults {
    /// Record matches for exactly one displayed file generation and content revision.
    pub fn new(file: u64, revision: u64, matches: FindMatches) -> Self {
        return Self {
            file,
            revision,
            matches,
        };
    }

    /// Lend matches only while they describe the displayed document; otherwise there is nothing to show.
    pub fn current(&self, file: u64, revision: u64) -> Option<&FindMatches> {
        if self.file == file && self.revision == revision {
            return Some(&self.matches);
        }
        return None;
    }
}

/// What: `&Option<FindResults>` borrows results that may be absent; the answer borrows from them.
/// Why: Navigation after a reload or file switch must not move the selection to outdated positions.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function currentMatches(results: FindResults | undefined, file: number, revision: number): FindMatches | undefined;
/// ```
pub fn current_matches(
    results: &Option<FindResults>,
    file: u64,
    revision: u64,
) -> Option<&FindMatches> {
    let Some(accepted) = results else {
        return None;
    };
    return accepted.current(file, revision);
}

/// Ranges to paint for the displayed document; stale or absent results paint nothing.
pub fn paint_ranges(results: &Option<FindResults>, file: u64, revision: u64) -> FindRanges {
    if let Some(matches) = current_matches(results, file, revision) {
        // What: `Arc::clone` copies the pointer, not the ranges.
        // Why: The frame stamp keeps the same allocation and can compare identity cheaply.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return matches.ranges;
        // ```
        return Arc::clone(&matches.ranges);
    }
    return Arc::from([]);
}
