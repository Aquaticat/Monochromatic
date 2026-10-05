//! What: Argument-boundary controls for escape-hatch stripping.
//! Why: Only flag-position tokens after the subcommand are wrapper flags; option
//!      values, pathspecs and global options are forwarded untouched.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(stripEscapeHatch({ args: ['stash', '--no-enforce-worktree', 'list'], ... })).toEqual(['stash', 'list']);
//! ```

/// Import the stripping under test.
use super::{
    PATHSPEC_SEPARATOR, WORKTREE_COPY_ESCAPE_HATCH, WORKTREE_ENFORCEMENT_ESCAPE_HATCH,
    strip_escape_hatch,
};
use std::ffi::OsString;

/// Build an owned argument list from text.
fn arguments(values: &[&str]) -> Vec<OsString> {
    let mut result: Vec<OsString> = Vec::<OsString>::new();
    for value in values {
        result.push(OsString::from(value));
    }
    return result;
}

/// Strip the worktree-enforcement token with `-m` and `--message` taking separate values.
fn strip(values: &[&str], subcommand_index: usize) -> Vec<OsString> {
    return strip_escape_hatch(
        arguments(values).as_slice(),
        subcommand_index,
        &["-m", "--message"],
        WORKTREE_ENFORCEMENT_ESCAPE_HATCH,
    );
}

/// The wrapper-only spellings are fixed.
#[test]
fn escape_hatch_spellings_are_stable() {
    assert_eq!(WORKTREE_ENFORCEMENT_ESCAPE_HATCH, "--no-enforce-worktree");
    assert_eq!(WORKTREE_COPY_ESCAPE_HATCH, "--no-worktree-copy");
    assert_eq!(PATHSPEC_SEPARATOR, "--");
}

/// Flag-position tokens after the subcommand are removed, however many there are.
#[test]
fn flag_position_tokens_are_removed() {
    for (input, subcommand_index, expected) in [
        (
            vec!["stash", "--no-enforce-worktree", "list"],
            0,
            vec!["stash", "list"],
        ),
        (
            vec!["stash", "--no-enforce-worktree", "--no-enforce-worktree"],
            0,
            vec!["stash"],
        ),
        (
            vec!["-C", "/r", "reset", "--hard", "--no-enforce-worktree"],
            2,
            vec!["-C", "/r", "reset", "--hard"],
        ),
        (vec!["reset"], 0, vec!["reset"]),
        (vec![], 0, vec![]),
    ] {
        assert_eq!(
            strip(input.as_slice(), subcommand_index),
            arguments(expected.as_slice()),
            "{input:?}"
        );
    }
}

/// A token that is an option's separate value, a pathspec, or before the subcommand is kept.
#[test]
fn value_pathspec_and_global_positions_are_kept() {
    for (input, subcommand_index, expected) in [
        // Value of a separate-value option, then a real flag occurrence.
        (
            vec![
                "commit",
                "-m",
                "--no-enforce-worktree",
                "--no-enforce-worktree",
            ],
            0,
            vec!["commit", "-m", "--no-enforce-worktree"],
        ),
        (
            vec!["commit", "--message", "--no-enforce-worktree"],
            0,
            vec!["commit", "--message", "--no-enforce-worktree"],
        ),
        // A value-taking option at the very end keeps itself.
        (vec!["commit", "-m"], 0, vec!["commit", "-m"]),
        // Everything from the separator on is path text.
        (
            vec![
                "checkout",
                "--no-enforce-worktree",
                "--",
                "--no-enforce-worktree",
            ],
            0,
            vec!["checkout", "--", "--no-enforce-worktree"],
        ),
        (
            vec![
                "checkout",
                "--",
                "--no-enforce-worktree",
                "--",
                "--no-enforce-worktree",
            ],
            0,
            vec![
                "checkout",
                "--",
                "--no-enforce-worktree",
                "--",
                "--no-enforce-worktree",
            ],
        ),
        // Global region and the subcommand token itself are never stripped.
        (
            vec![
                "--no-enforce-worktree",
                "-c",
                "--no-enforce-worktree",
                "reset",
            ],
            3,
            vec![
                "--no-enforce-worktree",
                "-c",
                "--no-enforce-worktree",
                "reset",
            ],
        ),
        (
            vec!["--no-enforce-worktree"],
            0,
            vec!["--no-enforce-worktree"],
        ),
        // The first separator ends the wrapper region even in a value position, as in the TypeScript wrapper.
        (
            vec!["commit", "-m", "--", "--no-enforce-worktree"],
            0,
            vec!["commit", "-m", "--", "--no-enforce-worktree"],
        ),
        // Joined and near-miss spellings are other tokens.
        (
            vec![
                "reset",
                "--no-enforce-worktree=1",
                "--no-enforce-worktre",
                "--no-enforce-worktrees",
            ],
            0,
            vec![
                "reset",
                "--no-enforce-worktree=1",
                "--no-enforce-worktre",
                "--no-enforce-worktrees",
            ],
        ),
    ] {
        assert_eq!(
            strip(input.as_slice(), subcommand_index),
            arguments(expected.as_slice()),
            "{input:?}"
        );
    }
}

/// A subcommand index at or past the end strips nothing.
#[test]
fn out_of_range_subcommand_index_strips_nothing() {
    let input: Vec<&str> = vec!["--no-enforce-worktree", "--no-enforce-worktree"];
    for subcommand_index in [1, 2, 3, usize::MAX] {
        assert_eq!(
            strip(input.as_slice(), subcommand_index),
            arguments(input.as_slice()),
            "{subcommand_index}"
        );
    }
}

/// Another token and an empty option list work the same way; non-UTF-8 arguments pass through as bytes.
#[cfg(unix)]
#[test]
fn other_tokens_and_native_bytes_are_supported() {
    use std::os::unix::ffi::OsStringExt;
    let raw: OsString = OsString::from_vec(b"path-\xff".to_vec());
    let input: Vec<OsString> = vec![
        OsString::from("worktree"),
        OsString::from("add"),
        OsString::from("--no-worktree-copy"),
        raw.clone(),
        OsString::from("--no-enforce-worktree"),
    ];
    assert_eq!(
        strip_escape_hatch(input.as_slice(), 0, &[], WORKTREE_COPY_ESCAPE_HATCH),
        vec![
            OsString::from("worktree"),
            OsString::from("add"),
            raw,
            OsString::from("--no-enforce-worktree"),
        ]
    );
}

/// The separator itself is outside the wrapper region: it survives even a token spelled like it.
#[test]
fn separator_is_never_removed() {
    for values in [
        vec!["commit", "--", "path"],
        vec!["commit", "--message", "--", "--", "path"],
        vec!["commit", "--"],
        vec!["commit", "--", "--", "--"],
    ] {
        let input: Vec<OsString> = arguments(values.as_slice());
        assert_eq!(
            strip_escape_hatch(input.as_slice(), 0, &["--message"], PATHSPEC_SEPARATOR),
            input,
            "{values:?}"
        );
    }
}
