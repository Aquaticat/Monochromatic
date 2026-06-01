//! Pure relative-path display: strip the longest common directory prefix from
//! the queue's track paths so the UI can show each track's path relative to the
//! loaded root (e.g. `Artist/Album/01.flac` rather than the full absolute path,
//! or just `01.flac` when the whole queue lives in one folder). No Slint, audio,
//! or I/O, so it is fully unit-tested; `queue::Queue::display_paths` calls this
//! to build the list handed to the UI, and `pagination` then groups the result
//! (by folder for subfolder tracks, by first letter for root-level ones).

// What:     `use std::path::{Component, Path, PathBuf};`. `PathBuf` is the OWNED,
//           growable path (sibling: the borrowed `&Path`); `Path` is the borrowed
//           view; `Component` is one piece of a split path (a root `/`, a `..`, a
//           normal name segment, etc.).
// Why:      We borrow each track path (`&Path`), split it into `Component`s, and
//           keep only the named segments; the input list is owned `PathBuf`s.
// TS map:   all three are just `string` (a path) in TS; `Component` ~ one element
//           of `path.split("/")`.
use std::path::{Component, Path, PathBuf};

// What:     `const SEPARATOR: &str = "/";`. `&str` is a BORROWED string slice
//           (sibling: the owned `String`); the separator we re-join segments with.
// Why:      The queue is Linux-only and the UI/pagination expect a single `/`
//           separator; naming it avoids a bare `"/"` literal scattered around.
// TS map:   `const SEPARATOR = "/";`
const SEPARATOR: &str = "/";

// What:     `fn normal_components(path: &Path) -> Vec<String>`. Split a path into
//           its NAMED segments only, each as an owned `String`. `&Path` is a
//           read-only borrow; `Vec<String>` is the owned, growable array of owned
//           strings (sibling: the borrowed slice `&[String]`). Private helper.
// Why:      Dropping the root (`/`) and any `.`/`..` leaves just the folder and
//           file names, so prefix comparison and re-joining are clean and behave
//           the same for absolute and relative inputs.
// TS map:   `function normalComponents(path: string): string[]`
//
// In TS you'd write (pseudocode):
// ```ts
// function normalComponents(path: string): string[] {
//   return path.split("/").filter(seg => seg !== "" && seg !== "." && seg !== "..");
// }
// ```
fn normal_components(path: &Path) -> Vec<String> {
    // What:     `let mut out: Vec<String> = Vec::new();`. A fresh empty owned
    //           array. `mut` marks it mutable (bindings are read-only by default);
    //           the explicit type is needed because it starts empty.
    // Why:      Accumulate the named segments.
    // TS map:   `const out: string[] = [];`
    let mut out: Vec<String> = Vec::new();
    // What:     `for component in path.components() { ... }`. `path.components()`
    //           is an iterator over the path's pieces as `Component` values.
    // Why:      Inspect each piece and keep only the named ones.
    // TS map:   `for (const component of path.split("/")) { ... }`
    for component in path.components() {
        // What:     `if let Component::Normal(part) = component { ... }`. A one-arm
        //           pattern match: run the block only when the piece is the
        //           `Normal` variant (a real name segment, not `/`, `.`, or `..`),
        //           binding its inner `&OsStr` (an OS string slice) to `part`.
        // Why:      Skip the root and relative markers; keep only folder/file names.
        // TS map:   `if (segment !== "" && segment !== "." && segment !== "..") { ... }`
        if let Component::Normal(part) = component {
            // What:     `out.push(part.to_string_lossy().into_owned());`.
            //           `part.to_string_lossy()` makes a `Cow<str>` (borrowed-or-
            //           owned, replacing invalid UTF-8 bytes); `.into_owned()`
            //           forces an owned `String`; `.push(...)` appends it (MOVING
            //           it into the vector).
            // Why:      Store an owned copy that outlives the borrowed path.
            // TS map:   `out.push(segment);`
            out.push(part.to_string_lossy().into_owned());
        }
    }
    // What:     `out`. Tail expression (no trailing `;`) -> the function's return.
    // Why:      Hand back the named segments.
    // TS map:   `return out;`
    out
}

// What:     `fn common_prefix_len(lists: &[Vec<String>]) -> usize`. How many
//           LEADING segments every track shares, capped so at least one segment
//           (the filename) always remains. `&[Vec<String>]` is a borrowed slice of
//           segment lists; `usize` is the pointer-sized unsigned integer used for
//           lengths/indices (siblings: `u32`, `u64`, `i32`). Private helper.
// Why:      That shared prefix is the "loaded root"; stripping it turns absolute
//           paths into the relative paths the UI shows.
// TS map:   `function commonPrefixLen(lists: string[][]): number`
fn common_prefix_len(lists: &[Vec<String>]) -> usize {
    // What:     `let shortest = lists.iter().map(|list| list.len()).min().unwrap_or(0);`.
    //           `.iter()` borrows each list; `.map(|list| list.len())` turns each
    //           into its length; `.min()` returns `Option<usize>` (the smallest, or
    //           `None` for no lists); `.unwrap_or(0)` extracts it or substitutes 0.
    //           `|list| ...` is a closure (anonymous function) taking a borrowed list.
    // Why:      The common prefix cannot be longer than the shortest path.
    // TS map:   `const shortest = Math.min(...lists.map(l => l.length), Infinity) || 0;`
    let shortest = lists.iter().map(|list| list.len()).min().unwrap_or(0);
    // What:     `if shortest == 0 { return 0; }`. Early return when some path has
    //           no named segments (nothing to strip).
    // Why:      Avoid the `shortest - 1` underflow below (`usize` is unsigned, so
    //           `0 - 1` would panic in debug builds).
    // TS map:   `if (shortest === 0) return 0;`
    if shortest == 0 {
        return 0;
    }
    // What:     `let cap = shortest - 1;`. The most segments we may strip, leaving
    //           at least the final one (the filename) on every track.
    // Why:      A row must never collapse to an empty label.
    // TS map:   `const cap = shortest - 1;`
    let cap = shortest - 1;
    // What:     `let mut run: usize = 0;`. A counter for how many leading segments
    //           match so far. `mut` because the loop increments it.
    // Why:      Count the shared run.
    // TS map:   `let run = 0;`
    let mut run: usize = 0;
    // What:     `while run < cap && lists.iter().all(|list| list[run] == lists[0][run]) { run += 1; }`.
    //           Keep going while we are under the cap AND every list agrees on the
    //           segment at position `run`. `.all(|list| ...)` is true only when the
    //           closure holds for every element; `list[run]` indexes a list (safe:
    //           `run < cap < shortest <= every length`). `lists[0]` is the first
    //           list, used as the reference.
    // Why:      One linear scan finds the longest shared leading run, no recursion.
    // TS map:   `while (run < cap && lists.every(l => l[run] === lists[0][run])) run++;`
    while run < cap && lists.iter().all(|list| list[run] == lists[0][run]) {
        // What:     `run += 1;`. Advance past a matching segment.
        // Why:      Move to the next position.
        // TS map:   `run++;`
        run += 1;
    }
    // What:     `run`. Tail expression -> the shared-prefix length.
    // Why:      Hand back how many leading segments to strip.
    // TS map:   `return run;`
    run
}

// What:     `pub fn relative_display_paths(tracks: &[PathBuf]) -> Vec<String>`.
//           Turn each track's full path into its path relative to the queue's
//           common root. `&[PathBuf]` is a borrowed slice of owned paths (read-
//           only); the result is one owned relative string per track, in order.
// Why:      The UI shows folders, not just filenames, but the absolute prefix
//           (e.g. `/home/user/Music`) is noise; this strips it once per queue.
// TS map:   `function relativeDisplayPaths(tracks: string[]): string[]`
//
// In TS you'd write (pseudocode):
// ```ts
// function relativeDisplayPaths(tracks: string[]): string[] {
//   if (tracks.length === 0) return [];
//   const lists = tracks.map(normalComponents);
//   const prefix = commonPrefixLen(lists);
//   return lists.map((list, i) => {
//     const rel = list.slice(prefix).join("/");
//     return rel === "" ? tracks[i] : rel;
//   });
// }
// ```
pub fn relative_display_paths(tracks: &[PathBuf]) -> Vec<String> {
    // What:     `if tracks.is_empty() { return Vec::new(); }`. Early return for an
    //           empty queue. `Vec::new()` builds an empty owned array.
    // Why:      Nothing to relativize; `common_prefix_len` of nothing is undefined.
    // TS map:   `if (tracks.length === 0) return [];`
    if tracks.is_empty() {
        return Vec::new();
    }
    // What:     `let component_lists: Vec<Vec<String>> = tracks.iter().map(|p| normal_components(p)).collect();`.
    //           Borrow each track (`p: &PathBuf`, which derefs to the `&Path`
    //           `normal_components` takes), split it into named segments, and
    //           `.collect()` the per-track lists into one vector of lists.
    // Why:      Compute every path's segments once, reused for the prefix and the
    //           per-track remainder.
    // TS map:   `const componentLists = tracks.map(normalComponents);`
    let component_lists: Vec<Vec<String>> = tracks.iter().map(|p| normal_components(p)).collect();
    // What:     `let prefix_len = common_prefix_len(&component_lists);`. `&...`
    //           lends the lists read-only.
    // Why:      Decide how many leading segments are the shared root.
    // TS map:   `const prefixLen = commonPrefixLen(componentLists);`
    let prefix_len = common_prefix_len(&component_lists);
    // What:     `component_lists.iter().zip(tracks.iter()).map(|(list, path)| { ... }).collect()`.
    //           `.zip(tracks.iter())` pairs each segment list with its original
    //           path so the fallback can reach the full path; `.map(|(list, path)| ...)`
    //           builds each relative string; `.collect()` gathers them into the
    //           returned `Vec<String>`. Tail expression -> return.
    // Why:      Produce one relative path per track, preserving load order.
    // TS map:   `return componentLists.map((list, i) => ...);`
    component_lists
        .iter()
        .zip(tracks.iter())
        .map(|(list, path)| {
            // What:     `let relative = list[prefix_len..].join(SEPARATOR);`.
            //           `list[prefix_len..]` is a slice of the segments AFTER the
            //           shared prefix (a "range" index; `..` means "to the end");
            //           `.join(SEPARATOR)` glues them with `/` into an owned `String`.
            // Why:      The segments past the common root ARE the relative path.
            // TS map:   `const relative = list.slice(prefixLen).join("/");`
            let relative = list[prefix_len..].join(SEPARATOR);
            // What:     `if relative.is_empty() { path.to_string_lossy().into_owned() } else { relative }`.
            //           An expression (no `;`) evaluating to one branch's `String`.
            //           `path.to_string_lossy().into_owned()` is the full-path
            //           fallback (lossy UTF-8, then owned).
            // Why:      Defensive: a pathological path with no named segments would
            //           join to "", so show its full text instead of nothing.
            // TS map:   `return relative === "" ? path : relative;`
            if relative.is_empty() {
                path.to_string_lossy().into_owned()
            } else {
                relative
            }
        })
        .collect()
}

// What:     `#[cfg(test)] mod tests { ... }` declares a submodule compiled ONLY
//           during `cargo test`. `#[cfg(test)]` is a conditional-compilation
//           attribute.
// Why:      Cover every branch (empty, single, multi-album, single-folder, mixed
//           depth, duplicate paths) without shipping tests in the binary.
// TS map:   like a `*.test.ts` file, but inlined and compiled out of prod.
#[cfg(test)]
mod tests {
    // What:     `use super::*;` imports everything from the parent module (this
    //           file) into the test scope. `super` means "one level up".
    // Why:      Tests need `relative_display_paths`, `PathBuf`, etc.
    // TS map:   `import * as parent from "./relpath";`
    use super::*;

    // What:     `fn paths(list: &[&str]) -> Vec<PathBuf>` test helper: turn string
    //           literals into the owned `Vec<PathBuf>` the function takes.
    // Why:      Tests read more clearly written with `&str` path literals.
    // TS map:   `function paths(list: string[]): string[] { return [...list]; }`
    fn paths(list: &[&str]) -> Vec<PathBuf> {
        // What:     `list.iter().map(PathBuf::from).collect()`. Borrow each `&&str`;
        //           `PathBuf::from` wraps it as an owned path (passing the function
        //           by name is the closure shorthand); `.collect()` gathers them.
        //           Tail expression -> return.
        // Why:      Build the owned input vector.
        // TS map:   `return list.map(s => s);`
        list.iter().map(PathBuf::from).collect()
    }

    // What:     `#[test]` marks the next function as a test case.
    // Why:      `cargo test` discovers and runs it.
    // TS map:   `test("empty input ...", () => { ... })`.
    #[test]
    fn empty_input_yields_empty() {
        // What:     `assert!(relative_display_paths(&[]).is_empty());`. `&[]` is an
        //           empty slice; `assert!(cond)` panics (fails the test) when false.
        // Why:      No tracks means no rows.
        // TS map:   `expect(relativeDisplayPaths([]).length).toBe(0);`
        assert!(relative_display_paths(&[]).is_empty());
    }

    // What:     `#[test]` marks the next function as a test case.
    // Why:      A single track has its whole directory chain stripped.
    // TS map:   `test("single track ...", () => { ... })`.
    #[test]
    fn single_track_keeps_only_filename() {
        // What:     `let got = relative_display_paths(&paths(&["/music/Artist/Album/01.flac"]));`.
        //           Relativize a one-element queue. `&paths(...)` lends the vector.
        // Why:      With one track every segment is "common", so the cap leaves only
        //           the filename.
        // TS map:   `const got = relativeDisplayPaths(["/music/Artist/Album/01.flac"]);`
        let got = relative_display_paths(&paths(&["/music/Artist/Album/01.flac"]));
        // What:     `assert_eq!(got, vec!["01.flac"]);`. `assert_eq!(a, b)` fails
        //           unless `a == b`; `vec![...]` builds the expected vector.
        // Why:      Only the filename remains.
        // TS map:   `expect(got).toEqual(["01.flac"]);`
        assert_eq!(got, vec!["01.flac"]);
    }

    // What:     `#[test]` marks the next function as a test case.
    // Why:      Two albums under one root keep their artist/album folders.
    // TS map:   `test("multi album ...", () => { ... })`.
    #[test]
    fn distinct_albums_keep_relative_folders() {
        // What:     relativize two tracks in different artist folders.
        // Why:      Their common root is `/music`; the rest is the relative path.
        // TS map:   `relativeDisplayPaths(["/music/A/Alb/01.flac", "/music/B/Alb/01.flac"]);`
        let got = relative_display_paths(&paths(&[
            "/music/A/Alb/01.flac",
            "/music/B/Alb/01.flac",
        ]));
        // What:     `assert_eq!(got, vec!["A/Alb/01.flac", "B/Alb/01.flac"]);`.
        // Why:      Only `/music` is stripped; folders survive, order preserved.
        // TS map:   `expect(got).toEqual(["A/Alb/01.flac", "B/Alb/01.flac"]);`
        assert_eq!(got, vec!["A/Alb/01.flac", "B/Alb/01.flac"]);
    }

    // What:     `#[test]` marks the next function as a test case.
    // Why:      One opened album (single folder) reduces to bare filenames.
    // TS map:   `test("single folder ...", () => { ... })`.
    #[test]
    fn single_folder_yields_bare_filenames() {
        // What:     relativize two tracks sharing the same album folder.
        // Why:      The cap stops stripping one short of the filename, leaving names.
        // TS map:   `relativeDisplayPaths(["/m/A/Alb/01.flac", "/m/A/Alb/02.flac"]);`
        let got = relative_display_paths(&paths(&[
            "/m/A/Alb/01.flac",
            "/m/A/Alb/02.flac",
        ]));
        // What:     `assert_eq!(got, vec!["01.flac", "02.flac"]);`.
        // Why:      The whole `/m/A/Alb` chain is the common prefix.
        // TS map:   `expect(got).toEqual(["01.flac", "02.flac"]);`
        assert_eq!(got, vec!["01.flac", "02.flac"]);
    }

    // What:     `#[test]` marks the next function as a test case.
    // Why:      A loose root file and a foldered file share only the top folder.
    // TS map:   `test("mixed depth ...", () => { ... })`.
    #[test]
    fn mixed_depth_strips_only_shared_top() {
        // What:     relativize a root-level file beside a nested one.
        // Why:      Common prefix is just `/m`; one stays a bare name, one keeps its
        //           folders, so pagination can route them to a letter vs a folder page.
        // TS map:   `relativeDisplayPaths(["/m/loose.flac", "/m/A/Alb/01.flac"]);`
        let got = relative_display_paths(&paths(&["/m/loose.flac", "/m/A/Alb/01.flac"]));
        // What:     `assert_eq!(got, vec!["loose.flac", "A/Alb/01.flac"]);`.
        // Why:      `loose.flac` has no folder; `A/Alb/01.flac` does.
        // TS map:   `expect(got).toEqual(["loose.flac", "A/Alb/01.flac"]);`
        assert_eq!(got, vec!["loose.flac", "A/Alb/01.flac"]);
    }

    // What:     `#[test]` marks the next function as a test case.
    // Why:      Identical paths must not strip away the filename.
    // TS map:   `test("duplicate paths ...", () => { ... })`.
    #[test]
    fn duplicate_paths_keep_filename() {
        // What:     relativize the same path twice.
        // Why:      Every segment is "common", so the cap must leave the filename.
        // TS map:   `relativeDisplayPaths(["/m/A/x.flac", "/m/A/x.flac"]);`
        let got = relative_display_paths(&paths(&["/m/A/x.flac", "/m/A/x.flac"]));
        // What:     `assert_eq!(got, vec!["x.flac", "x.flac"]);`.
        // Why:      Filename survives even for duplicates.
        // TS map:   `expect(got).toEqual(["x.flac", "x.flac"]);`
        assert_eq!(got, vec!["x.flac", "x.flac"]);
    }
}
