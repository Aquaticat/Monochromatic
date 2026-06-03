// What:     Unit tests for `relpath.rs`, pulled in by
//           `#[cfg(test)] #[path = "relpath_tests.rs"] mod tests;` at
//           the bottom of `relpath.rs`. Compiles only under
//           `cargo nextest run` / `cargo test`; reaches the module items
//           (including private ones) via `use super::*` because this file is
//           the `tests` CHILD of relpath.
// Why:      Keep the tests beside the code without inflating
//           `relpath.rs` or its max-lines budget (sibling
//           `*_tests.rs` files are exempt from the linter).
// TS map:   `relpath.unit.test.ts` beside `relpath.ts`.

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
