// What:     Unit tests for `cli.rs`, pulled in by
//           `#[cfg(test)] #[path = "cli_tests.rs"] mod tests;` at the bottom of
//           `cli.rs`. Compiles only under `cargo nextest run` / `cargo test`, and
//           reaches the module items via `use super::*` because this file is the
//           `tests` CHILD of `cli`.
// Why:      Cover every branch of the parser (flag absent, flag present, flag with
//           no paths, flag mixed among paths) so the "never auto-play unless
//           `--start-playing`" rule has executable proof, not just a comment.
// TS map:   `cli.unit.test.ts` beside `cli.ts`.

// What:     `use super::*;`. Bring every item of the parent `cli` module into this
//           test scope, chiefly the `Cli` struct.
// Why:      The tests parse arguments into `Cli` and compare against `Cli` literals.
// TS map:   `import * as parent from "./cli";`
use super::*;

// What:     `use clap::Parser;`. Re-import the `Parser` TRAIT here. `use super::*`
//           does NOT pull in the parent module's private `use clap::Parser;`, and
//           the `try_parse_from` call below is a method OF that trait, so the trait
//           must be in scope in this file too.
// Why:      Without the trait in scope, `Cli::try_parse_from(...)` would not resolve.
// TS map:   `import { parseArgs } from "some-cli-parser";`
use clap::Parser;

// What:     `fn parse(extra: &[&str]) -> Cli`. A test helper: clap expects the FIRST
//           argument to be the program name (real argv starts with `argv[0]`), so
//           this prepends a synthetic `"music-player"` to the caller's `extra`
//           arguments before parsing. `&[&str]` is a borrowed slice of string
//           slices; siblings: `Vec<&str>` (owned) and `[&str; N]` (fixed-size).
// Why:      Every test would otherwise repeat the program-name prefix and the
//           `try_parse_from(...).unwrap()` dance; one helper keeps each test to a
//           single readable call.
// TS map:   `function parse(extra: string[]): Cli`
fn parse(extra: &[&str]) -> Cli {
    // What:     `let mut argv: Vec<&str> = vec!["music-player"];`. A MUTABLE owned
    //           vector seeded with the synthetic program name. `mut` is required
    //           because the next line grows it; `vec![...]` is the array-literal
    //           macro.
    // Why:      Reconstruct a realistic argv whose first slot is the binary name.
    // TS map:   `const argv = ["music-player"];`
    let mut argv: Vec<&str> = vec!["music-player"];
    // What:     `argv.extend_from_slice(extra);`. Append every element of the
    //           borrowed slice `extra` onto `argv` (copying each `&str`, which is a
    //           cheap pointer-plus-length Copy).
    // Why:      Place the test's real arguments after the program name.
    // TS map:   `argv.push(...extra);`
    argv.extend_from_slice(extra);
    // What:     `Cli::try_parse_from(argv).unwrap()`. `try_parse_from` runs the
    //           clap-generated parser over the explicit `argv` (rather than the real
    //           process arguments) and returns `Result<Cli, clap::Error>`; `.unwrap()`
    //           extracts the `Ok(Cli)` and PANICS on a parse error, which fails the
    //           test (acceptable in tests). Tail expression -> return value.
    // Why:      Parsing from an explicit list is what makes the launch policy testable
    //           without touching the real command line.
    // TS map:   `return parseArgs(argv); // throws on a bad argument`
    Cli::try_parse_from(argv).unwrap()
}

// What:     `#[test] fn no_args_yields_no_paths_and_paused()`. The `#[test]` attribute
//           marks a zero-argument function the test runner calls; a panic (e.g. a
//           failed `assert_eq!`) fails the test.
// Why:      A bare launch (no CLI arguments beyond the program name) must produce an
//           empty queue and must NOT auto-play.
// TS map:   `test("no args yields no paths and paused", () => { ... })`
#[test]
fn no_args_yields_no_paths_and_paused() {
    // What:     `assert_eq!(parse(&[]), Cli { start_playing: false, paths: vec![] });`.
    //           `assert_eq!(a, b)` panics unless `a == b` (using `Cli`'s derived
    //           `PartialEq`) and prints both sides via its derived `Debug` on failure.
    //           The expected `Cli { ... }` is a whole-struct literal; `vec![]` is an
    //           empty `Vec<PathBuf>` (the field type fixes the element type).
    // Why:      No arguments means an empty queue (`paths`) and no auto-play
    //           (`start_playing` false); comparing the WHOLE struct catches any field.
    // TS map:   `expect(parse([])).toEqual({ start_playing: false, paths: [] });`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(parse([])).toEqual({ start_playing: false, paths: [] });
    // ```
    assert_eq!(
        parse(&[]),
        Cli {
            start_playing: false,
            paths: vec![],
        }
    );
}

// What:     `#[test] fn paths_without_flag_load_paused()`. A launch with file/folder
//           paths but no flag.
// Why:      Opening paths from the command line must NOT auto-play on its own; that
//           is the behavior change this whole feature is about.
// TS map:   `test("paths without flag load paused", () => { ... })`
#[test]
fn paths_without_flag_load_paused() {
    // What:     `assert_eq!(parse(&["/music/a.flac", "/music/folder"]), Cli { start_playing: false, paths: vec![PathBuf::from("/music/a.flac"), PathBuf::from("/music/folder")] });`.
    //           Parse two plain path arguments and compare the whole struct; `vec!`
    //           builds the expected `Vec<PathBuf>` and `PathBuf::from` wraps each
    //           literal.
    // Why:      Both paths survive parsing, in order, and `start_playing` stays false.
    // TS map:   `expect(parse(["/music/a.flac", "/music/folder"])).toEqual({ start_playing: false, paths: ["/music/a.flac", "/music/folder"] });`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(parse(["/music/a.flac", "/music/folder"])).toEqual({ start_playing: false, paths: ["/music/a.flac", "/music/folder"] });
    // ```
    assert_eq!(
        parse(&["/music/a.flac", "/music/folder"]),
        Cli {
            start_playing: false,
            paths: vec![PathBuf::from("/music/a.flac"), PathBuf::from("/music/folder")],
        }
    );
}

// What:     `#[test] fn flag_with_paths_enables_start_playing()`. Paths plus the flag.
// Why:      `--start-playing` is the ONE way to ask the CLI launch to auto-play.
// TS map:   `test("flag with paths enables start playing", () => { ... })`
#[test]
fn flag_with_paths_enables_start_playing() {
    // What:     `assert_eq!(parse(&["--start-playing", "/music/a.flac"]), Cli { start_playing: true, paths: vec![PathBuf::from("/music/a.flac")] });`.
    //           Parse the flag followed by one path; the flag must set `start_playing`
    //           and must NOT appear among `paths`.
    // Why:      `--start-playing` is consumed as a flag (not a file) and turns on
    //           auto-play.
    // TS map:   `expect(parse(["--start-playing", "/music/a.flac"])).toEqual({ start_playing: true, paths: ["/music/a.flac"] });`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(parse(["--start-playing", "/music/a.flac"])).toEqual({ start_playing: true, paths: ["/music/a.flac"] });
    // ```
    assert_eq!(
        parse(&["--start-playing", "/music/a.flac"]),
        Cli {
            start_playing: true,
            paths: vec![PathBuf::from("/music/a.flac")],
        }
    );
}

// What:     `#[test] fn flag_only_with_no_paths_is_noop()`. The flag alone, no paths.
// Why:      `--start-playing` with nothing to open should not invent a queue; the
//           launch falls through to the (paused) session restore / auto-load, so
//           there is still nothing to auto-play.
// TS map:   `test("flag only with no paths is noop", () => { ... })`
#[test]
fn flag_only_with_no_paths_is_noop() {
    // What:     `assert_eq!(parse(&["--start-playing"]), Cli { start_playing: true, paths: vec![] });`.
    //           The flag sets `start_playing` but collects no positional, so `paths`
    //           is empty.
    // Why:      A flag is not a path; `start_playing` is `true` but, with empty
    //           `paths`, the launch path's `!paths.is_empty()` guard never acts on it.
    // TS map:   `expect(parse(["--start-playing"])).toEqual({ start_playing: true, paths: [] });`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(parse(["--start-playing"])).toEqual({ start_playing: true, paths: [] });
    // ```
    assert_eq!(
        parse(&["--start-playing"]),
        Cli {
            start_playing: true,
            paths: vec![],
        }
    );
}

// What:     `#[test] fn flag_among_paths_is_filtered_out()`. The flag sitting between
//           two paths rather than first.
// Why:      Argument order is the user's choice; the flag must be recognized wherever
//           it appears and must never leak into the path list.
// TS map:   `test("flag among paths is filtered out", () => { ... })`
#[test]
fn flag_among_paths_is_filtered_out() {
    // What:     `assert_eq!(parse(&["/music/a.flac", "--start-playing", "/music/b.opus"]), Cli { start_playing: true, paths: vec![PathBuf::from("/music/a.flac"), PathBuf::from("/music/b.opus")] });`.
    //           The flag is the middle argument; both real paths must remain in order
    //           with the flag pulled out, and `start_playing` must be `true`.
    // Why:      Recognizing a mid-list flag must not disturb the surrounding paths.
    // TS map:   `expect(parse(["/music/a.flac", "--start-playing", "/music/b.opus"])).toEqual({ start_playing: true, paths: ["/music/a.flac", "/music/b.opus"] });`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(parse(["/music/a.flac", "--start-playing", "/music/b.opus"])).toEqual({ start_playing: true, paths: ["/music/a.flac", "/music/b.opus"] });
    // ```
    assert_eq!(
        parse(&["/music/a.flac", "--start-playing", "/music/b.opus"]),
        Cli {
            start_playing: true,
            paths: vec![PathBuf::from("/music/a.flac"), PathBuf::from("/music/b.opus")],
        }
    );
}
