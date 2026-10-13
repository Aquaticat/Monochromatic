//! The order of the folder walk as a comparison, so a path can be found in the queue without walking the folder.
//!
//! What: `walk_cmp` orders two paths the way `scan_streaming` lists them (a folder's own files in natural order, then
//! its subfolders in natural order, each subfolder's tree in full), and `locate`, `subtree_range` and `direct_files`
//! use it to search the sorted queue by binary search.
//! Why: D113 refreshes only what the watcher named. Deciding whether a named path is already in a queue of a million
//! tracks must cost a few comparisons, not a walk of the library or a copy of the queue.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! const locate = (tracks: string[], root: string, path: string) => bsearch(tracks, (t) => walkCmp(root, t, path));
//! ```

use std::cmp::Ordering;
use std::ffi::OsStr;
use std::ops::Range;
use std::path::{Component, Path, PathBuf};

use crate::natural_order::natural_cmp;

/// What:
///      `fn compare_names(left: &OsStr, right: &OsStr) -> Ordering`.
///  Orders two path components the way the walk sorts siblings: natural order of the name, then the plain bytes.
/// Why:
///       `sort_naturally` in the folder walk breaks ties with the whole path; siblings share their parent, so the
///  components decide.
fn compare_names(left: &OsStr, right: &OsStr) -> Ordering {
    return natural_cmp(&left.to_string_lossy(), &right.to_string_lossy()).then_with(|| return left.cmp(right));
}

/// What:
///      `fn names_below<'a>(root: &Path, path: &'a Path) -> impl Iterator<Item = &'a OsStr>`.
///  The names of the path below the root, one per level.
/// Why:
///       Every comparison works level by level without building a list; a path outside the root keeps all its names.
fn names_below<'a>(root: &Path, path: &'a Path) -> impl Iterator<Item = &'a OsStr> {
    let below: &Path = path.strip_prefix(root).unwrap_or(path);
    return below.components().filter_map(|component| {
        return match component {
            Component::Normal(name) => Some(name),
            _ => None,
        };
    });
}

/// What:
///      `pub(crate) fn walk_cmp(root: &Path, left: &Path, right: &Path) -> Ordering`.
///  Compares two file paths in the order the folder walk lists them.
/// Why:
///       At the first level where the names differ, a file (the last level of its path) comes before a subfolder (a
///  level with more below it), and two of the same kind compare by name. This is exactly the walk: files first, then
///  each subfolder with everything under it.
pub(crate) fn walk_cmp(root: &Path, left: &Path, right: &Path) -> Ordering {
    let mut left_names = names_below(root, left).peekable();
    let mut right_names = names_below(root, right).peekable();
    loop {
        let (a, b) = match (left_names.next(), right_names.next()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(a), Some(b)) => (a, b),
        };
        if a == b {
            continue;
        }
        return match (left_names.peek().is_none(), right_names.peek().is_none()) {
            (true, false) => Ordering::Less,
            (false, true) => Ordering::Greater,
            _ => compare_names(a, b),
        };
    }
}

/// What:
///      `pub(crate) fn locate(tracks: &[PathBuf], root: &Path, path: &Path) -> Result<usize, usize>`.
///  Finds a file in the sorted queue: its index, or where it would be inserted.
/// Why:
///       A binary search over the walk order; the queue is exactly the walk of its root, so the order holds.
pub(crate) fn locate(tracks: &[PathBuf], root: &Path, path: &Path) -> Result<usize, usize> {
    return tracks.binary_search_by(|track| return walk_cmp(root, track, path));
}

/// What:
///      `fn against_folder(root: &Path, track: &Path, folder: &[&OsStr]) -> Ordering`.
///  Where a track lies relative to everything under a folder: `Less` before it, `Equal` inside it, `Greater` after it.
/// Why:
///       The tracks under one folder are one run of the walk, so two partition points bound the run.
fn against_folder(root: &Path, track: &Path, folder: &[&OsStr]) -> Ordering {
    let mut names = names_below(root, track).peekable();
    for wanted in folder {
        let Some(name) = names.next() else {
            return Ordering::Less;
        };
        if name == *wanted {
            continue;
        }
        return if names.peek().is_none() { Ordering::Less } else { compare_names(name, wanted) };
    }
    return if names.peek().is_some() { Ordering::Equal } else { Ordering::Less };
}

/// What:
///      `pub(crate) fn subtree_range(tracks: &[PathBuf], root: &Path, folder: &Path) -> Range<usize>`.
///  The indexes of every track under `folder`, however deep (empty when there is none).
/// Why:
///       A removed or renamed folder takes its whole run out of the queue, and a new folder is told apart from a known
///  one by whether it has a run.
pub(crate) fn subtree_range(tracks: &[PathBuf], root: &Path, folder: &Path) -> Range<usize> {
    let names: Vec<&OsStr> = names_below(root, folder).collect();
    let start: usize = tracks.partition_point(|track| return against_folder(root, track, &names) == Ordering::Less);
    let end: usize = tracks.partition_point(|track| return against_folder(root, track, &names) != Ordering::Greater);
    return start..end.max(start);
}

/// What:
///      `pub(crate) fn direct_files(tracks: &[PathBuf], folder: &Path, run: Range<usize>) -> Range<usize>`.
///  The files that sit directly in `folder` within its run: they come first.
/// Why:
///       A folder's own files precede its subfolders, so the direct files are a prefix of the run.
pub(crate) fn direct_files(tracks: &[PathBuf], folder: &Path, run: Range<usize>) -> Range<usize> {
    let inside: &[PathBuf] = &tracks[run.clone()];
    let count: usize = inside.partition_point(|track| return track.parent() == Some(folder));
    return run.start..run.start + count;
}

/// Unit tests in `walk_order_tests.rs`, pulled in at this point.
#[cfg(test)]
#[path = "walk_order_tests.rs"]
mod tests;
