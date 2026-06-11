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
// Why:      The tests parse arguments into `Cli` and read its fields.
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
//           failed `assert!`) fails the test.
// Why:      A bare launch (no CLI arguments beyond the program name) must produce an
//           empty queue and must NOT auto-play.
// TS map:   `test("no args yields no paths and paused", () => { ... })`
#[test]
fn no_args_yields_no_paths_and_paused() {
    // What:     `let cli = parse(&[]);`. Parse with no extra arguments. `&[]` is a
    //           borrowed empty slice.
    // Why:      Reproduce the no-argument launch.
    // TS map:   `const cli = parse([]);`
    let cli = parse(&[]);
    // What:     `assert!(cli.paths.is_empty());`. `assert!(cond)` panics unless `cond`
    //           is `true`; `.is_empty()` is `true` for a zero-length `Vec`.
    // Why:      No arguments means no paths to enqueue.
    // TS map:   `expect(cli.paths).toHaveLength(0);`
    assert!(cli.paths.is_empty());
    // What:     `assert!(!cli.start_playing);`. The leading `!` negates the boolean,
    //           so this passes only when the flag was absent.
    // Why:      Nothing should auto-play without `--start-playing`.
    // TS map:   `expect(cli.start_playing).toBe(false);`
    assert!(!cli.start_playing);
}

// What:     `#[test] fn paths_without_flag_load_paused()`. A launch with file/folder
//           paths but no flag.
// Why:      Opening paths from the command line must NOT auto-play on its own; that
//           is the behavior change this whole feature is about.
// TS map:   `test("paths without flag load paused", () => { ... })`
#[test]
fn paths_without_flag_load_paused() {
    // What:     `parse(&["/music/a.flac", "/music/folder"])`. Two plain path
    //           arguments, no flag.
    // Why:      The common case: `music-player <paths>`.
    // TS map:   `const cli = parse(["/music/a.flac", "/music/folder"]);`
    let cli = parse(&["/music/a.flac", "/music/folder"]);
    // What:     `assert_eq!(cli.paths, vec![PathBuf::from("/music/a.flac"), PathBuf::from("/music/folder")]);`.
    //           `assert_eq!(a, b)` panics unless `a == b`; the `vec!` macro builds the
    //           expected `Vec<PathBuf>` and `PathBuf::from` wraps each literal.
    // Why:      Both paths survive parsing, in order.
    // TS map:   `expect(cli.paths).toEqual(["/music/a.flac", "/music/folder"]);`
    assert_eq!(
        cli.paths,
        vec![PathBuf::from("/music/a.flac"), PathBuf::from("/music/folder")]
    );
    // What:     `assert!(!cli.start_playing);`. Flag absent -> paused.
    // Why:      Paths alone never trigger auto-play.
    // TS map:   `expect(cli.start_playing).toBe(false);`
    assert!(!cli.start_playing);
}

// What:     `#[test] fn flag_with_paths_enables_start_playing()`. Paths plus the flag.
// Why:      `--start-playing` is the ONE way to ask the CLI launch to auto-play.
// TS map:   `test("flag with paths enables start playing", () => { ... })`
#[test]
fn flag_with_paths_enables_start_playing() {
    // What:     `parse(&["--start-playing", "/music/a.flac"])`. The flag followed by
    //           one path.
    // Why:      The opt-in auto-play case.
    // TS map:   `const cli = parse(["--start-playing", "/music/a.flac"]);`
    let cli = parse(&["--start-playing", "/music/a.flac"]);
    // What:     `assert_eq!(cli.paths, vec![PathBuf::from("/music/a.flac")]);`. The
    //           flag must NOT appear among the paths; only the real path remains.
    // Why:      `--start-playing` is consumed as a flag, not treated as a file.
    // TS map:   `expect(cli.paths).toEqual(["/music/a.flac"]);`
    assert_eq!(cli.paths, vec![PathBuf::from("/music/a.flac")]);
    // What:     `assert!(cli.start_playing);`. Passes only when the flag set the
    //           boolean to `true`.
    // Why:      The flag was present, so auto-play is requested.
    // TS map:   `expect(cli.start_playing).toBe(true);`
    assert!(cli.start_playing);
}

// What:     `#[test] fn flag_only_with_no_paths_is_noop()`. The flag alone, no paths.
// Why:      `--start-playing` with nothing to open should not invent a queue; the
//           launch falls through to the (paused) session restore / auto-load, so
//           there is still nothing to auto-play.
// TS map:   `test("flag only with no paths is noop", () => { ... })`
#[test]
fn flag_only_with_no_paths_is_noop() {
    // What:     `parse(&["--start-playing"])`. Only the flag.
    // Why:      Exercise the degenerate input.
    // TS map:   `const cli = parse(["--start-playing"]);`
    let cli = parse(&["--start-playing"]);
    // What:     `assert!(cli.paths.is_empty());`. The flag is not a positional, so no
    //           paths are collected.
    // Why:      A flag is not a path, so the queue stays empty.
    // TS map:   `expect(cli.paths).toHaveLength(0);`
    assert!(cli.paths.is_empty());
    // What:     `assert!(cli.start_playing);`. The boolean is still set even with no
    //           paths.
    // Why:      The launch path guards on `!paths.is_empty()` before opening, so an
    //           empty path list means this `true` is simply never acted on.
    // TS map:   `expect(cli.start_playing).toBe(true);`
    assert!(cli.start_playing);
}

// What:     `#[test] fn flag_among_paths_is_filtered_out()`. The flag sitting between
//           two paths rather than first.
// Why:      Argument order is the user's choice; the flag must be recognized wherever
//           it appears and must never leak into the path list.
// TS map:   `test("flag among paths is filtered out", () => { ... })`
#[test]
fn flag_among_paths_is_filtered_out() {
    // What:     `parse(&["/music/a.flac", "--start-playing", "/music/b.opus"])`. The
    //           flag is the middle argument.
    // Why:      Prove position-independence.
    // TS map:   `const cli = parse(["/music/a.flac", "--start-playing", "/music/b.opus"]);`
    let cli = parse(&["/music/a.flac", "--start-playing", "/music/b.opus"]);
    // What:     `assert_eq!(cli.paths, vec![PathBuf::from("/music/a.flac"), PathBuf::from("/music/b.opus")]);`.
    //           Both real paths remain, in order, with the flag pulled out from between
    //           them.
    // Why:      Recognizing the flag must not disturb the surrounding paths.
    // TS map:   `expect(cli.paths).toEqual(["/music/a.flac", "/music/b.opus"]);`
    assert_eq!(
        cli.paths,
        vec![PathBuf::from("/music/a.flac"), PathBuf::from("/music/b.opus")]
    );
    // What:     `assert!(cli.start_playing);`. Flag present anywhere -> `true`.
    // Why:      A mid-list flag still requests auto-play.
    // TS map:   `expect(cli.start_playing).toBe(true);`
    assert!(cli.start_playing);
}
