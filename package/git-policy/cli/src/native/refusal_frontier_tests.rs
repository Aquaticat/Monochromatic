//! What: Which commands the frontier stops, at which kind of location, and which lease
//!       variables count.
//! Why: Every case that returns "nothing" here is a command this executable will forward;
//!      a commit, a worktree creation or an alias slipping through would run unguarded.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(commandFrontier(strip(['commit', '-m', 'x']), main)).toEqual({ kind: 'commit-transaction' });
//! ```

/// The frontier under test, its inputs and the argument builders.
use super::{LEASE_VARIABLES, command_frontier, inherited_lease};
use crate::command_test_support::{byte_argument, os_arguments};
use crate::unported::Unported;
use crate::worktree_identity::WorktreeIdentity;
use crate::wrapper_invocation::{StrippedInvocation, strip_wrapper_controls};
use std::ffi::OsString;
use std::path::PathBuf;

/// The four kinds of location, in the order: outside, bare, main, linked.
fn locations() -> [WorktreeIdentity; 4] {
    return [
        WorktreeIdentity::OutsideWorktree,
        WorktreeIdentity::BareRepository {
            common_dir: PathBuf::from("/b.git"),
            git_dir: PathBuf::from("/b.git"),
        },
        WorktreeIdentity::MainWorktree {
            common_dir: PathBuf::from("/r/.git"),
            git_dir: PathBuf::from("/r/.git"),
            worktree_root: PathBuf::from("/r"),
        },
        WorktreeIdentity::LinkedWorktree {
            common_dir: PathBuf::from("/r/.git"),
            git_dir: PathBuf::from("/r/.git/worktrees/w"),
            worktree_root: PathBuf::from("/w"),
        },
    ];
}

/// The frontier's answer for one invocation, written as text, at one location.
fn frontier(values: &[&str], identity: &WorktreeIdentity) -> Option<Unported> {
    let stripped: StrippedInvocation = strip_wrapper_controls(os_arguments(values).as_slice());
    return command_frontier(&stripped, identity);
}

/// A commit that is not provably a dry run is stopped at every location.
#[test]
fn every_commit_but_a_dry_run_needs_the_transaction() {
    for identity in locations() {
        for values in [
            vec!["commit"],
            vec!["commit", "-m", "x"],
            vec!["commit", "-m", "x", "--", "file"],
            vec!["commit", "--amend", "--no-edit"],
            vec!["commit", "-a", "-m", "x"],
            vec!["commit", "--allow-empty", "--message=x"],
            vec!["-C", "dir", "--no-pager", "commit", "-m", "x"],
            vec!["commit", "--dry-run", "--no-dry-run"],
            vec!["commit", "-m", "--dry-run"],
            vec!["commit", "--", "--dry-run"],
            vec!["commit", "--no-enforce-only", "-m", "x"],
            vec!["--cli-git-keep-going", "commit", "-m", "x"],
            // Git refuses these regions; a refusal this table got wrong must not forward a commit.
            vec!["commit", "--no-such-option"],
            vec!["commit", "--dry-run", "--no-such-option"],
        ] {
            assert_eq!(
                frontier(values.as_slice(), &identity),
                Some(Unported::CommitTransaction),
                "{values:?} {identity:?}"
            );
        }
        for values in [
            vec!["commit", "--dry-run"],
            vec!["commit", "--dry-run", "-m", "x"],
            vec!["commit", "-m", "x", "--dry-run", "--", "file"],
            vec!["commit", "--no-dry-run", "--dry-run"],
            vec!["commit", "--no-enforce-only", "--dry-run"],
            vec!["-C", "dir", "commit", "--dry-run"],
            // Git accepts an unambiguous abbreviation of a long option.
            vec!["commit", "--dry"],
        ] {
            assert_eq!(
                frontier(values.as_slice(), &identity),
                None,
                "{values:?} {identity:?}"
            );
        }
    }
}

/// Creating or moving a worktree is stopped only where copies are synchronized and not opted out.
#[test]
fn worktree_creation_needs_the_copy_from_a_linked_worktree_or_a_bare_repository() {
    let [outside, bare, main, linked]: [WorktreeIdentity; 4] = locations();
    for values in [
        vec!["worktree", "add", "../topic"],
        vec!["worktree", "add", "-b", "topic", "../topic"],
        vec!["worktree", "move", "a", "b"],
        vec!["-C", "dir", "worktree", "add", "../topic"],
        vec!["--no-enforce-require-root", "worktree", "add", "../topic"],
        vec!["worktree", "add", "--", "--no-worktree-copy"],
        vec!["worktree", "add", "-b", "--no-worktree-copy", "../topic"],
    ] {
        for identity in [&bare, &linked] {
            assert_eq!(
                frontier(values.as_slice(), identity),
                Some(Unported::WorktreeCopy),
                "{values:?} {identity:?}"
            );
        }
        for identity in [&outside, &main] {
            assert_eq!(
                frontier(values.as_slice(), identity),
                None,
                "{values:?} {identity:?}"
            );
        }
    }
    for values in [
        vec!["worktree", "--no-worktree-copy", "add", "../topic"],
        vec!["worktree", "add", "--no-worktree-copy", "../topic"],
        vec!["worktree", "move", "--no-worktree-copy", "a", "b"],
        vec!["--no-worktree-copy", "worktree", "add", "../topic"],
        vec!["worktree", "list"],
        vec!["worktree", "remove", "add"],
        vec!["worktree", "prune"],
        vec!["worktree"],
    ] {
        for identity in locations() {
            assert_eq!(
                frontier(values.as_slice(), &identity),
                None,
                "{values:?} {identity:?}"
            );
        }
    }
}

/// A word Git does not build in may be an alias for anything, where copies are synchronized.
#[test]
fn a_possible_alias_needs_resolution_from_a_linked_worktree_or_a_bare_repository() {
    let [outside, bare, main, linked]: [WorktreeIdentity; 4] = locations();
    for values in [
        vec!["st"],
        vec!["wta", "../topic"],
        vec!["-c", "alias.wta=worktree add", "wta", "../topic"],
        vec!["cli-git-unknown"],
        vec!["Status"],
        vec!["worktrees", "add"],
        vec![""],
    ] {
        for identity in [&bare, &linked] {
            assert_eq!(
                frontier(values.as_slice(), identity),
                Some(Unported::AliasResolution),
                "{values:?} {identity:?}"
            );
        }
        for identity in [&outside, &main] {
            assert_eq!(
                frontier(values.as_slice(), identity),
                None,
                "{values:?} {identity:?}"
            );
        }
    }
    // The opt-out is a wrapper control, so the alias is never asked about worktrees.
    assert_eq!(
        frontier(&["wta", "--no-worktree-copy", "../topic"], &linked),
        None
    );
    // A word that is not UTF-8 is not a built-in.
    let stripped: StrippedInvocation = strip_wrapper_controls(&[byte_argument(b"st\xff")]);
    assert_eq!(
        command_frontier(&stripped, &linked),
        Some(Unported::AliasResolution)
    );
    // Built-in words are what they say, at every location.
    for values in [
        vec!["status"],
        vec!["add", "file"],
        vec!["reset", "--hard"],
        vec!["push"],
        vec!["stash"],
        vec!["switch", "-c", "topic"],
        vec!["update-ref", "refs/heads/x", "HEAD"],
    ] {
        for identity in locations() {
            assert_eq!(
                frontier(values.as_slice(), &identity),
                None,
                "{values:?} {identity:?}"
            );
        }
    }
}

/// Each lease variable alone is found, even when empty; the first in table order is named.
#[test]
fn an_inherited_lease_is_found_by_name() {
    assert_eq!(
        LEASE_VARIABLES,
        [
            "CLI_GIT_PREPARATION_LEASE",
            "CLI_GIT_LANDING_LEASE",
            "CLI_GIT_WORKTREE_COPY_LEASE"
        ]
    );
    let unrelated: Vec<(OsString, OsString)> = vec![
        (OsString::from("PATH"), OsString::from("/usr/bin")),
        (OsString::from("CLI_GIT_LEASE"), OsString::from("x")),
        (
            OsString::from("CLI_GIT_LANDING_LEASE_2"),
            OsString::from("x"),
        ),
        (OsString::from("cli_git_landing_lease"), OsString::from("x")),
    ];
    assert_eq!(inherited_lease(&[]), None);
    assert_eq!(inherited_lease(unrelated.as_slice()), None);
    for variable in LEASE_VARIABLES {
        for value in ["", "token"] {
            let mut environment: Vec<(OsString, OsString)> = unrelated.clone();
            environment.push((OsString::from(variable), OsString::from(value)));
            assert_eq!(
                inherited_lease(environment.as_slice()),
                Some(*variable),
                "{variable}={value}"
            );
        }
    }
    let both: Vec<(OsString, OsString)> = vec![
        (
            OsString::from("CLI_GIT_WORKTREE_COPY_LEASE"),
            OsString::from("a"),
        ),
        (OsString::from("CLI_GIT_LANDING_LEASE"), OsString::from("b")),
    ];
    assert_eq!(
        inherited_lease(both.as_slice()),
        Some("CLI_GIT_LANDING_LEASE")
    );
}
