// What:     Unit tests for `relpath.rs`, pulled in by
//           `#[cfg(test)] #[path = "relpath_tests.rs"] mod tests;` at
//           the bottom of `relpath.rs`. Compiles only under
//           `cargo nextest run` / `cargo test`; reaches the module items
//           (including private ones) via `use super::*` because this file is
//           the `tests` CHILD of relpath.
// Why:      Keep the tests beside the code without inflating
//           `relpath.rs` or its max-lines budget (sibling
//           `*_tests.rs` files are exempt from the linter).

// What:     `use super::*;` imports everything from the parent module (this
//           file) into the test scope. `super` means "one level up".
// Why:      Tests need `relative_display_paths`, `PathBuf`, etc.
use super::*;

// What:     `fn paths(list: &[&str]) -> Vec<PathBuf>` test helper: turn string
//           literals into the owned `Vec<PathBuf>` the function takes.
// Why:      Tests read more clearly written with `&str` path literals.
fn paths(list: &[&str]) -> Vec<PathBuf> {
    // What:     `list.iter().map(PathBuf::from).collect()`. Borrow each `&&str`;
    //           `PathBuf::from` wraps it as an owned path (passing the function
    //           by name is the closure shorthand); `.collect()` gathers them.
    //           Tail expression -> return.
    // Why:      Build the owned input vector.
    list.iter().map(PathBuf::from).collect()
}

// What:     `#[test]` marks the next function as a test case.
// Why:      `cargo test` discovers and runs it.
#[test]
fn empty_input_yields_empty() {
    // What:     `assert!(relative_display_paths(&[]).is_empty());`. `&[]` is an
    //           empty slice; `assert!(cond)` panics (fails the test) when false.
    // Why:      No tracks means no rows.
    assert!(relative_display_paths(&[]).is_empty());
}

// What:     `#[test]` marks the next function as a test case.
// Why:      A single track has its whole directory chain stripped.
#[test]
fn single_track_keeps_only_filename() {
    // What:     `let got = relative_display_paths(&paths(&["/music/Artist/Album/01.flac"]));`.
    //           Relativize a one-element queue. `&paths(...)` lends the vector.
    // Why:      With one track every segment is "common", so the cap leaves only
    //           the filename.
    let got = relative_display_paths(&paths(&["/music/Artist/Album/01.flac"]));
    // What:     `assert_eq!(got, vec!["01.flac"]);`. `assert_eq!(a, b)` fails
    //           unless `a == b`; `vec![...]` builds the expected vector.
    // Why:      Only the filename remains.
    assert_eq!(got, vec!["01.flac"]);
}

// What:     `#[test]` marks the next function as a test case.
// Why:      Two albums under one root keep their artist/album folders.
#[test]
fn distinct_albums_keep_relative_folders() {
    // What:     relativize two tracks in different artist folders.
    // Why:      Their common root is `/music`; the rest is the relative path.
    let got = relative_display_paths(&paths(&[
        "/music/A/Alb/01.flac",
        "/music/B/Alb/01.flac",
    ]));
    // What:     `assert_eq!(got, vec!["A/Alb/01.flac", "B/Alb/01.flac"]);`.
    // Why:      Only `/music` is stripped; folders survive, order preserved.
    assert_eq!(got, vec!["A/Alb/01.flac", "B/Alb/01.flac"]);
}

// What:     `#[test]` marks the next function as a test case.
// Why:      One opened album (single folder) reduces to bare filenames.
#[test]
fn single_folder_yields_bare_filenames() {
    // What:     relativize two tracks sharing the same album folder.
    // Why:      The cap stops stripping one short of the filename, leaving names.
    let got = relative_display_paths(&paths(&[
        "/m/A/Alb/01.flac",
        "/m/A/Alb/02.flac",
    ]));
    // What:     `assert_eq!(got, vec!["01.flac", "02.flac"]);`.
    // Why:      The whole `/m/A/Alb` chain is the common prefix.
    assert_eq!(got, vec!["01.flac", "02.flac"]);
}

// What:     `#[test]` marks the next function as a test case.
// Why:      A loose root file and a foldered file share only the top folder.
#[test]
fn mixed_depth_strips_only_shared_top() {
    // What:     relativize a root-level file beside a nested one.
    // Why:      Common prefix is just `/m`; one stays a bare name, one keeps its
    //           folders, so pagination can route them to a letter vs a folder page.
    let got = relative_display_paths(&paths(&["/m/loose.flac", "/m/A/Alb/01.flac"]));
    // What:     `assert_eq!(got, vec!["loose.flac", "A/Alb/01.flac"]);`.
    // Why:      `loose.flac` has no folder; `A/Alb/01.flac` does.
    assert_eq!(got, vec!["loose.flac", "A/Alb/01.flac"]);
}

// What:     `#[test]` marks the next function as a test case.
// Why:      Identical paths must not strip away the filename.
#[test]
fn duplicate_paths_keep_filename() {
    // What:     relativize the same path twice.
    // Why:      Every segment is "common", so the cap must leave the filename.
    let got = relative_display_paths(&paths(&["/m/A/x.flac", "/m/A/x.flac"]));
    // What:     `assert_eq!(got, vec!["x.flac", "x.flac"]);`.
    // Why:      Filename survives even for duplicates.
    assert_eq!(got, vec!["x.flac", "x.flac"]);
}
