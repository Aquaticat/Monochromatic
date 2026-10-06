//! What:
//!  Decide,
//!  from one command and where it runs,
//!  whether it needs work of the
//!       installed cli-git that this executable does not do:
//!  a commit transaction,
//!  a
//!       worktree copy,
//!  alias resolution,
//!  or a lease check.
//! Why:
//!  These are the commands that must never be forwarded by this executable.
//!  A commit
//!      that reached Git directly would skip every commit policy,
//!  and nothing would show it.
//!      The decision reads the command word,
//!  not the command's options,
//!  wherever it can,
//!      so a mistake in an option table cannot open the frontier.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // const unported = commandFrontier(stripped, identity); if (unported) refuse(unported);
//! ```

/// What:
///  `use` brings names from sibling files into this file;
///  `super::` means "the parent
///       module",
///  where every sibling file of this crate is declared.
/// Why:
///   The frontier combines the command word,
///  two command facts,
///  the built-in table
///       and the kind of repository location.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { parseCommitRegion } from './command_commit.ts';
/// ```
use super::child_environment::environment_value;
use super::command_commit::{CommitRegion, parse_commit_region};
use super::command_options::OptionError;
use super::command_worktree::changes_worktree_registrations;
use super::git_builtins::is_git_builtin;
use super::unported::Unported;
use super::worktree_identity::WorktreeIdentity;
use super::wrapper_invocation::{StrippedInvocation, command_region, command_word};
/// What:
///  `OsString` is owned operating-system text of raw bytes.
///  Sibling the reader might
///       expect:
///  `String`,
///  which must be valid UTF-8.
/// Why:
///   Arguments and environment values are compared as bytes and never decoded.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // string, but byte-preserving.
/// ```
use std::ffi::OsString;

/// What:
///  The environment variables through which a running cli-git tells the commands it
///       starts that they are inside one of its locks.
///  `&[&str]` is a borrowed list of
///       texts baked into the program.
/// Why:
///   The installed wrapper checks such a lease against the lock it names before it
///       trusts it.
///  That check is not ported,
///  so a command that inherits one is refused.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const LEASE_VARIABLES = ['CLI_GIT_PREPARATION_LEASE', 'CLI_GIT_LANDING_LEASE', 'CLI_GIT_WORKTREE_COPY_LEASE'];
/// ```
pub const LEASE_VARIABLES: &[&str] = &[
    "CLI_GIT_PREPARATION_LEASE",
    "CLI_GIT_LANDING_LEASE",
    "CLI_GIT_WORKTREE_COPY_LEASE",
];

/// What:
///  The first lease variable present in the environment,
///  if any.
///       `&[(OsString, OsString)]` borrows the environment as name/value pairs;
///       `Option<&'static str>` is "a compiled-in name or nothing".
/// Why:
///   Presence is enough to refuse:
///  even an empty value was put there by a wrapper
///       that expects the lease to be checked.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function inheritedLease(environment: [string, string][]): string | undefined;
/// ```
pub fn inherited_lease(environment: &[(OsString, OsString)]) -> Option<&'static str> {
    // `for variable in LEASE_VARIABLES` borrows each name; `*variable` copies it out.
    for variable in LEASE_VARIABLES {
        if environment_value(environment, variable).is_some() {
            // `Some(x)` is the "present" case of `Option`.
            return Some(*variable);
        }
    }
    // `None` is the "absent" case.
    return None;
}

/// What:
///  Whether Git's own option table reads the tokens after `commit` as a dry run.
///       `&[OsString]` borrows those tokens,
///  already free of wrapper controls.
/// Why:
///   Only a dry run stays outside the commit transaction.
///  A region the table refuses
///       is not known to be a dry run,
///  so it is treated as a real commit.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function commitIsDryRun(region: string[]): boolean { try { return parseCommitRegion(region).isDryRun; } catch { return false; } }
/// ```
fn commit_is_dry_run(region: &[OsString]) -> bool {
    // `&[]` is an empty list of wrapper flags: they were removed before this point.
    let parsed: Result<CommitRegion, OptionError> = parse_commit_region(region, &[]);
    // `match` unpacks the `Result`: `Ok` carries the facts, `Err(_)` ignores the refusal.
    match parsed {
        Ok(found) => return found.dry_run,
        Err(_) => return false,
    }
}

/// What:
///  Whether the installed wrapper synchronizes ignored files for commands run at
///       this location.
///  `&WorktreeIdentity` borrows Git's answer about the location.
/// Why:
///   It does so from a linked worktree and from a bare repository;
///  the main worktree
///       and a place without a repository are forwarded untouched.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const synchronizes = identity.kind === 'linked-worktree' || identity.kind === 'bare-repository';
/// ```
fn synchronizes_worktree_copies(identity: &WorktreeIdentity) -> bool {
    // `match` on the borrowed identity; `{ .. }` ignores the fields a variant carries.
    match identity {
        WorktreeIdentity::LinkedWorktree { .. } | WorktreeIdentity::BareRepository { .. } => {
            return true;
        }
        WorktreeIdentity::OutsideWorktree | WorktreeIdentity::MainWorktree { .. } => {
            return false;
        }
    }
}

/// What:
///  The unported work this command needs,
///  if any.
///  `&StrippedInvocation` borrows the
///       invocation without its wrapper controls;
///  it must name a command.
/// Why:
///   `commit` is decided by its word alone,
///  then narrowed to "not a dry run" by Git's
///       table.
///  Worktree creation and aliases matter only where copies are synchronized,
///       and never when the caller opted out with `--no-worktree-copy`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function commandFrontier(stripped: StrippedInvocation, identity: WorktreeIdentity): Unported | undefined;
/// ```
pub fn command_frontier(
    stripped: &StrippedInvocation,
    identity: &WorktreeIdentity,
) -> Option<Unported> {
    let word: &[u8] = command_word(stripped);
    let region: &[OsString] = command_region(stripped);
    if word == b"commit" {
        if commit_is_dry_run(region) {
            return None;
        }
        return Some(Unported::CommitTransaction);
    }
    if !synchronizes_worktree_copies(identity) || stripped.controls.skip_worktree_copy {
        return None;
    }
    if word == b"worktree" && changes_worktree_registrations(region) {
        return Some(Unported::WorktreeCopy);
    }
    if !is_git_builtin(word) {
        return Some(Unported::AliasResolution);
    }
    return None;
}

/// Frontier controls for every command and location stay out of the release executable.
#[cfg(test)]
#[path = "refusal_frontier_tests.rs"]
mod tests;
