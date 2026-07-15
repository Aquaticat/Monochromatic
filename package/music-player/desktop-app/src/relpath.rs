//! Pure relative-path display: strip the longest common directory prefix from
//! the queue's track paths so the UI can show each track's path relative to the
//! loaded root (e.g. `Artist/Album/01.flac` rather than the full absolute path,
//! or just `01.flac` when the whole queue lives in one folder). No Slint, audio,
//! or I/O, so it is fully unit-tested; `queue::Queue::display_paths` calls this
//! to build the list handed to the UI, and `pagination` then groups the result
//! (by folder for subfolder tracks, by first letter for root-level ones).

/// What:     `use std::path::{Component, Path, PathBuf};`. `PathBuf` is the OWNED,
///           growable path (sibling: the borrowed `&Path`); `Path` is the borrowed
///           view; `Component` is one piece of a split path (a root `/`, a `..`, a
///           normal name segment, etc.).
/// Why:      We borrow each track path (`&Path`), split it into `Component`s, and
///           keep only the named segments; the input list is owned `PathBuf`s.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // all three are just strings in TS; Component ~ one element of path.split("/")
/// ```
use std::path::{Component, Path, PathBuf};

/// What:     `const SEPARATOR: &str = "/";`. `&str` is a BORROWED string slice
///           (sibling: the owned `String`); the separator we re-join segments with.
/// Why:      The queue is Linux-only and the UI/pagination expect a single `/`
///           separator; naming it avoids a bare `"/"` literal scattered around.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const SEPARATOR = "/";
/// ```
const SEPARATOR: &str = "/";

/// What:     `fn normal_components(path: &Path) -> Vec<String>`. Split a path into its
///           NAMED segments only, each as an owned `String`. `&Path` is a read-only
///           borrow; `Vec<String>` is the owned, growable array of owned strings
///           (sibling: the borrowed slice `&[String]`). Private helper.
/// Why:      Dropping the root (`/`) and any `.`/`..` leaves just the folder and file
///           names, so prefix comparison and re-joining are clean and behave the same
///           for absolute and relative inputs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function normalComponents(path: string): string[] {
///   return path.split("/").filter(seg => seg !== "" && seg !== "." && seg !== "..");
/// }
/// ```
fn normal_components(path: &Path) -> Vec<String> {
    // What:     `let mut out: Vec<String> = Vec::new();`. `Vec::new()` builds a fresh
    //           empty owned array. `mut` marks it mutable (bindings are read-only by
    //           default); the explicit type is needed because it starts empty.
    // Why:      Accumulate the named segments.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const out: string[] = [];
    // ```
    let mut out: Vec<String> = Vec::new();
    // What:     `for component in path.components() { ... }`. `path.components()` is an
    //           iterator over the path's pieces as `Component` values; `for ... in`
    //           consumes it one piece at a time.
    // Why:      Inspect each piece and keep only the named ones.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const component of path.split("/")) { ... }
    // ```
    for component in path.components() {
        // What:     `if let Component::Normal(part) = component { ... }`. A one-arm
        //           pattern match: run the block only when the piece is the `Normal`
        //           variant (a real name segment, not `/`, `.`, or `..`), binding its
        //           inner `&OsStr` (an OS string slice) to `part`.
        // Why:      Skip the root and relative markers; keep only folder/file names.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (segment !== "" && segment !== "." && segment !== "..") { ... }
        // ```
        if let Component::Normal(part) = component {
            // What:     `out.push(part.to_string_lossy().into_owned());`.
            //           `part.to_string_lossy()` makes a `Cow<str>` (borrowed-or-owned,
            //           replacing invalid UTF-8 bytes); `.into_owned()` forces an owned
            //           `String`; `.push(...)` appends it (MOVING it into the vector).
            // Why:      Store an owned copy that outlives the borrowed path.
            // Gotcha:   `to_string_lossy` may REPLACE invalid bytes with U+FFFD rather
            //           than fail; an OS path is not guaranteed valid UTF-8.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // out.push(segment);
            // ```
            out.push(part.to_string_lossy().into_owned());
        }
    }
    // What:     `out`. Tail expression (no trailing `;`) -> the function's return.
    // Why:      Hand back the named segments.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return out;
    // ```
    out
}

/// What:     `fn common_prefix_len(lists: &[Vec<String>]) -> usize`. How many LEADING
///           segments every track shares, capped so at least one segment (the
///           filename) always remains. `&[Vec<String>]` is a borrowed slice of
///           segment lists; `usize` is the pointer-sized unsigned integer used for
///           lengths/indices (siblings: `u32`, `u64`, `i32`). Private helper.
/// Why:      That shared prefix is the "loaded root"; stripping it turns absolute
///           paths into the relative paths the UI shows.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function commonPrefixLen(lists: string[][]): number { ... }
/// ```
fn common_prefix_len(lists: &[Vec<String>]) -> usize {
    // What:     `let shortest = lists.iter().map(|list| list.len()).min().unwrap_or(0);`.
    //           `.iter()` borrows each list; `.map(|list| list.len())` turns each into
    //           its length; `.min()` returns `Option<usize>` (the smallest, or `None`
    //           for no lists); `.unwrap_or(0)` extracts it or substitutes 0. `|list|
    //           ...` is a closure taking a borrowed list.
    // Why:      The common prefix cannot be longer than the shortest path.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const shortest = lists.length ? Math.min(...lists.map((l) => l.length)) : 0;
    // ```
    let shortest = lists.iter().map(|list| list.len()).min().unwrap_or(0);
    // What:     `if shortest == 0 { return 0; }`. Early return when some path has no
    //           named segments (nothing to strip).
    // Why:      Avoid the `shortest - 1` underflow below (`usize` is unsigned, so
    //           `0 - 1` would panic in debug builds).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (shortest === 0) return 0;
    // ```
    if shortest == 0 {
        return 0;
    }
    // What:     `let cap = shortest - 1;`. The most segments we may strip, leaving at
    //           least the final one (the filename) on every track.
    // Why:      A row must never collapse to an empty label.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const cap = shortest - 1;
    // ```
    let cap = shortest - 1;
    // What:     `let mut run: usize = 0;`. A counter for how many leading segments
    //           match so far. `mut` because the loop increments it.
    // Why:      Count the shared run.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let run = 0;
    // ```
    let mut run: usize = 0;
    // What:     `while run < cap && lists.iter().all(|list| list[run] == lists[0][run]) { ... }`.
    //           Keep going while we are under the cap AND every list agrees on the
    //           segment at position `run`. `.all(|list| ...)` is true only when the
    //           closure holds for every element; `list[run]` indexes a list (safe:
    //           `run < cap < shortest <= every length`). `lists[0]` is the reference
    //           list. `&&` short-circuits, so `.all` runs only while under the cap.
    // Why:      One linear scan finds the longest shared leading run, no recursion.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // while (run < cap && lists.every((l) => l[run] === lists[0][run])) run++;
    // ```
    while run < cap && lists.iter().all(|list| list[run] == lists[0][run]) {
        // What:     `run += 1;`. Advance past a matching segment.
        // Why:      Move to the next position.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // run++;
        // ```
        run += 1;
    }
    // What:     `run`. Tail expression -> the shared-prefix length.
    // Why:      Hand back how many leading segments to strip.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return run;
    // ```
    run
}

/// What:     `pub fn relative_display_paths(tracks: &[PathBuf]) -> Vec<String>`. Turn
///           each track's full path into its path relative to the queue's common
///           root. `&[PathBuf]` is a borrowed slice of owned paths (read-only); the
///           result is one owned relative string per track, in order.
/// Why:      The UI shows folders, not just filenames, but the absolute prefix (e.g.
///           `/home/user/Music`) is noise; this strips it once per queue.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function relativeDisplayPaths(tracks: string[]): string[] {
///   if (tracks.length === 0) return [];
///   const lists = tracks.map(normalComponents);
///   const prefix = commonPrefixLen(lists);
///   return lists.map((list, i) => {
///     const rel = list.slice(prefix).join("/");
///     return rel === "" ? tracks[i] : rel;
///   });
/// }
/// ```
pub fn relative_display_paths(tracks: &[PathBuf]) -> Vec<String> {
    // What:     `if tracks.is_empty() { return Vec::new(); }`. Early return for an
    //           empty queue. `Vec::new()` builds an empty owned array.
    // Why:      Nothing to relativize; `common_prefix_len` of nothing is undefined.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (tracks.length === 0) return [];
    // ```
    if tracks.is_empty() {
        return Vec::new();
    }
    // What:     `let component_lists: Vec<Vec<String>> = tracks.iter().map(|p| normal_components(p)).collect();`.
    //           Borrow each track (`p: &PathBuf`, which derefs to the `&Path`
    //           `normal_components` takes), split it into named segments, and
    //           `.collect()` the per-track lists into one vector of lists.
    // Why:      Compute every path's segments once, reused for the prefix and the
    //           per-track remainder.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const componentLists = tracks.map(normalComponents);
    // ```
    let component_lists: Vec<Vec<String>> = tracks.iter().map(|p| normal_components(p)).collect();
    // What:     `let prefix_len = common_prefix_len(&component_lists);`. `&...` lends
    //           the lists read-only to the helper.
    // Why:      Decide how many leading segments are the shared root.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const prefixLen = commonPrefixLen(componentLists);
    // ```
    let prefix_len = common_prefix_len(&component_lists);
    // What:     `component_lists.iter().zip(tracks.iter()).map(|(list, path)| { ... }).collect()`.
    //           `.zip(tracks.iter())` pairs each segment list with its original path
    //           so the fallback can reach the full path; `.map(|(list, path)| ...)`
    //           takes a DESTRUCTURED tuple of the two and builds each relative string;
    //           `.collect()` gathers them into the returned `Vec<String>`. Tail
    //           expression -> return.
    // Why:      Produce one relative path per track, preserving load order.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return componentLists.map((list, i) => { ... });
    // ```
    component_lists
        .iter()
        .zip(tracks.iter())
        .map(|(list, path)| {
            // What:     `let relative = list[prefix_len..].join(SEPARATOR);`.
            //           `list[prefix_len..]` is a slice of the segments AFTER the
            //           shared prefix (a RANGE index; `..` means "to the end");
            //           `.join(SEPARATOR)` glues them with `/` into an owned `String`.
            // Why:      The segments past the common root ARE the relative path.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const relative = list.slice(prefixLen).join("/");
            // ```
            let relative = list[prefix_len..].join(SEPARATOR);
            // What:     `if relative.is_empty() { path.to_string_lossy().into_owned() } else { relative }`.
            //           An `if/else` EXPRESSION (no `;`) evaluating to one branch's
            //           `String`. `path.to_string_lossy().into_owned()` is the
            //           full-path fallback (lossy UTF-8, then owned).
            // Why:      Defensive: a pathological path with no named segments would
            //           join to "", so show its full text instead of nothing.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return relative === "" ? path : relative;
            // ```
            if relative.is_empty() {
                path.to_string_lossy().into_owned()
            } else {
                relative
            }
        })
        .collect()
}

/// What:     `#[cfg(test)] #[path = "relpath_tests.rs"] mod tests;` declares a
///           test-only submodule whose code lives in the sibling file
///           `relpath_tests.rs`. `#[cfg(test)]` gates it to test builds only;
///           `#[path = "..."]` aims the module at a flat sibling file instead of the
///           default `relpath/tests.rs` subdirectory lookup. The file stays the
///           `tests` CHILD of relpath, so its `use super::*` reaches the module items
///           (including private ones) unchanged.
/// Why:      Keep `relpath.rs` to production code; the tests live beside it without
///           inflating this file or its max-lines budget (sibling `*_tests.rs` files
///           are exempt from the linter).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // relpath.unit.test.ts, run only by the test runner
/// ```
#[cfg(test)]
#[path = "relpath_tests.rs"]
mod tests;
