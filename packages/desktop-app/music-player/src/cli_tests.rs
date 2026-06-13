// What:     Unit tests for `cli.rs`, pulled in by
//           `#[cfg(test)] #[path = "cli_tests.rs"] mod tests;` at the bottom of
//           `cli.rs`. Compiles only under `cargo nextest run` / `cargo test`, and
//           reaches the module items via `use super::*` because this file is the
//           `tests` CHILD of `cli`.
// Why:      Cover every branch of the parser (no path, one folder, one file, the flag,
//           and the rejection of a second path) so the single-Source-Root and
//           "never auto-play unless `--start-playing`" rules have executable proof.

// What:     `use super::*;`. Bring every item of the parent `cli` module into this test
//           scope, chiefly the `Cli` struct.
// Why:      The tests parse arguments into `Cli` and compare against `Cli` literals.
use super::*;

// What:     `use clap::Parser;`. Re-import the `Parser` TRAIT here; `use super::*` does
//           not pull in the parent module's private import, and `try_parse_from` is a
//           method OF that trait.
// Why:      Without the trait in scope, `Cli::try_parse_from(...)` would not resolve.
use clap::Parser;

// What:     `fn parse(extra: &[&str]) -> Cli`. A test helper: clap expects the first
//           argument to be the program name, so this prepends a synthetic
//           `"music-player"` before parsing and unwraps the result.
// Why:      Keep each success-case test to a single readable call.
fn parse(extra: &[&str]) -> Cli {
    // What:     seed a mutable argv with the synthetic program name.
    // Why:      Reconstruct a realistic argv whose first slot is the binary name.
    let mut argv: Vec<&str> = vec!["music-player"];
    // What:     append the test's real arguments after the program name.
    // Why:      Place them where clap expects positionals/flags.
    argv.extend_from_slice(extra);
    // What:     `Cli::try_parse_from(argv).unwrap()`. Parse the explicit argv; `.unwrap()`
    //           panics on a parse error (failing the test).
    // Why:      Parsing from an explicit list makes the launch policy testable.
    Cli::try_parse_from(argv).unwrap()
}

// What:     `#[test] fn no_args_yields_no_path_and_paused()`. A bare launch.
// Why:      No CLI argument must produce no path and must NOT auto-play.
#[test]
fn no_args_yields_no_path_and_paused() {
    // What:     parse no extra args and compare the whole struct.
    // Why:      `path` is `None` and `start_playing` is `false`.
    assert_eq!(
        parse(&[]),
        Cli {
            start_playing: false,
            path: None,
        }
    );
}

// What:     `#[test] fn single_folder_loads_paused()`. One folder argument, no flag.
// Why:      A folder is accepted as the single path and must NOT auto-play on its own.
#[test]
fn single_folder_loads_paused() {
    // What:     parse one folder path.
    // Why:      It is captured in `path` and `start_playing` stays false.
    assert_eq!(
        parse(&["/music/folder"]),
        Cli {
            start_playing: false,
            path: Some(PathBuf::from("/music/folder")),
        }
    );
}

// What:     `#[test] fn single_file_is_accepted()`. One file argument.
// Why:      A single file is allowed (its parent becomes the root, the file is
//           preselected); only the multi-path form was removed.
#[test]
fn single_file_is_accepted() {
    // What:     parse one file path.
    // Why:      It is captured in `path`.
    assert_eq!(
        parse(&["/music/a.flac"]),
        Cli {
            start_playing: false,
            path: Some(PathBuf::from("/music/a.flac")),
        }
    );
}

// What:     `#[test] fn flag_with_path_enables_start_playing()`. The flag plus one path.
// Why:      `--start-playing` is the ONE way to ask the CLI launch to auto-play, and it
//           must not be captured as the path.
#[test]
fn flag_with_path_enables_start_playing() {
    // What:     parse the flag followed by one path.
    // Why:      `start_playing` is true and `path` holds only the real path.
    assert_eq!(
        parse(&["--start-playing", "/music/a.flac"]),
        Cli {
            start_playing: true,
            path: Some(PathBuf::from("/music/a.flac")),
        }
    );
}

// What:     `#[test] fn flag_only_with_no_path_is_noop()`. The flag alone.
// Why:      `--start-playing` with nothing to open invents no path; the launch falls
//           through to the (paused) session restore.
#[test]
fn flag_only_with_no_path_is_noop() {
    // What:     parse the flag with no positional.
    // Why:      `start_playing` is true but `path` is `None`.
    assert_eq!(
        parse(&["--start-playing"]),
        Cli {
            start_playing: true,
            path: None,
        }
    );
}

// What:     `#[test] fn second_path_is_rejected()`. Two positional paths.
// Why:      The multi-path form is deliberately removed, so a second positional must be a
//           parse ERROR (enforcing the single Source Root at the CLI boundary).
#[test]
fn second_path_is_rejected() {
    // What:     `Cli::try_parse_from([...]).is_err()`. Parse two paths and assert the
    //           result is the `Err` variant (an unexpected-extra-argument error).
    // Why:      Confirm clap rejects a second positional rather than silently dropping it.
    let result = Cli::try_parse_from(["music-player", "/music/a.flac", "/music/b.opus"]);
    assert!(result.is_err());
}
