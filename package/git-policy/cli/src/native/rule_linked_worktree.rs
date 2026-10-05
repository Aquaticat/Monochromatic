//! What: Pure decision of the linked-worktree-only policy: commands that can discard
//!       worktree state run only in a linked worktree.
//! Why: `git stash`, a deleting `git clean` and a `git reset` that rewrites files can throw
//!      away work in the primary checkout. The policy confines them to linked worktrees.
//!      This file decides from the arguments alone whether the command is guarded, and
//!      from the worktree kind the caller measured whether to reject it. It starts no
//!      process.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // decideLinkedWorktree(['clean', '-fd']) => { kind: 'needs-effective-target', command: 'clean' }
//! ```

/// What: `use` brings names from sibling files into this file; `super::` means "the parent
///       module", where every sibling file of this crate is declared.
/// Why:  Whether a clean deletes and whether a reset rewrites files come from Git's own
///       option tables of those commands.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { cleanChangesWorktree, parseCleanRegion } from './command_clean.ts';
/// ```
use super::command_clean::{CleanRegion, clean_changes_worktree, parse_clean_region};
use super::command_options::OptionError;
use super::command_reset::{ResetRegion, parse_reset_region, reset_changes_worktree};
use super::effective_target::EffectiveTarget;
use super::global_arguments::{GlobalLayout, GlobalOutcome, global_layout};
/// What: `OsString` is owned operating-system text of raw bytes. Sibling the reader might
///       expect: `String`, which must be valid UTF-8.
/// Why:  Arguments are compared as bytes and never decoded.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // string, but byte-preserving.
/// ```
use std::ffi::OsString;

/// What: The finding code of a linked-worktree rejection. `&str` is borrowed text baked
///       into the program.
/// Why:  Callers identify the finding by this stable code.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const LINKED_WORKTREE_REQUIRED_CODE = 'linked-worktree-required';
/// ```
pub const LINKED_WORKTREE_REQUIRED_CODE: &str = "linked-worktree-required";

/// What: The commands the policy guards. An `enum` is a closed set of named alternatives.
///       `#[derive(...)]` asks the compiler to generate copying, debug printing and `==`.
/// Why:  Each has its own rejection text.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type GuardedCommand = 'stash' | 'clean' | 'reset';
/// ```
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GuardedCommand {
    /// Every `git stash` form.
    Stash,
    /// A `git clean` that is not a dry run.
    Clean,
    /// A `git reset` with `--hard`, `--merge` or `--keep`.
    Reset,
}

/// What: The outcome of looking at the argument list only.
/// Why:  Most commands are not guarded and need no repository query at all.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type LinkedWorktreeDecision = { kind: 'pass' } | { kind: 'needs-effective-target'; command: GuardedCommand };
/// ```
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LinkedWorktreeDecision {
    /// Not a guarded command, a harmless form, or a region Git refuses.
    Pass,
    /// The caller classifies the worktree the command targets, then calls
    /// `resolve_linked_worktree`.
    NeedsEffectiveTarget(GuardedCommand),
}

/// What: Whether a guarded region can change worktree files. `&[u8]` borrows the
///       subcommand word; `Option<T>` is "a value or nothing": nothing for another command.
///       `Result<A, B>` is "either success `A` or failure `B`".
/// Why:  `stash` is guarded in every form, as the incumbent guards it; `clean` and `reset`
///       only in the forms Git lets touch files.
/// Gotcha: A trailing `?` returns Git's refusal to our caller, or unwraps the facts.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function guardedCommand(word: string, region: string[]): GuardedCommand | undefined; // throws OptionError
/// ```
fn guarded_command(
    word: &[u8],
    region: &[OsString],
) -> Result<Option<GuardedCommand>, OptionError> {
    if word == b"stash" {
        // `Ok(Some(x))` is success carrying a present value.
        return Ok(Some(GuardedCommand::Stash));
    }
    if word == b"clean" {
        // `&[]` is an empty flag list: wrapper controls were removed before this point.
        let facts: CleanRegion = parse_clean_region(region, &[])?;
        // `&facts` lends the facts read-only.
        if clean_changes_worktree(&facts) {
            return Ok(Some(GuardedCommand::Clean));
        }
    }
    if word == b"reset" {
        let facts: ResetRegion = parse_reset_region(region, &[])?;
        if reset_changes_worktree(&facts) {
            return Ok(Some(GuardedCommand::Reset));
        }
    }
    // `Ok(None)` is success carrying "not guarded".
    return Ok(None);
}

/// What: Decide from the argument list. `&[OsString]` borrows the arguments, already free
///       of wrapper controls.
/// Why:  A command that is not guarded, or that Git itself refuses, needs no measurement.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function decideLinkedWorktree(args: string[]): LinkedWorktreeDecision;
/// ```
pub fn decide_linked_worktree(arguments: &[OsString]) -> LinkedWorktreeDecision {
    let layout: GlobalLayout = global_layout(arguments);
    if layout.outcome != GlobalOutcome::Command {
        return LinkedWorktreeDecision::Pass;
    }
    // `.as_encoded_bytes()` lends the raw bytes of the subcommand word.
    let word: &[u8] = arguments[layout.prefix_len].as_encoded_bytes();
    // `&arguments[n..]` borrows the tokens after the subcommand word.
    let guarded: Result<Option<GuardedCommand>, OptionError> =
        guarded_command(word, &arguments[layout.prefix_len + 1..]);
    // `if let Ok(Some(command)) = ...` runs only for an accepted, guarded region.
    if let Ok(Some(command)) = guarded {
        return LinkedWorktreeDecision::NeedsEffectiveTarget(command);
    }
    return LinkedWorktreeDecision::Pass;
}

/// What: The rejection text for a command run where there is no worktree. `&'static str`
///       is text baked into the program.
/// Why:  The text says what the command could destroy and how to run it safely.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function outsideWorktreeMessage({ command }): string;
/// ```
pub fn outside_worktree_message(command: GuardedCommand) -> &'static str {
    // `match` picks one arm per variant; the compiler refuses a forgotten variant.
    match command {
        GuardedCommand::Stash => {
            return "cli-git: git stash requires the effective working directory to be inside a linked git worktree. \
                    Refusing to run from outside a worktree because git stash can revert filesystem state outside what the caller expected. \
                    cd to a linked worktree root or pass -C <linked-worktree-root> before stash.";
        }
        GuardedCommand::Clean => {
            return "cli-git: state-changing git clean requires the effective working directory to be inside a linked git worktree. \
                    Refusing to run from outside a worktree because git clean can delete filesystem state outside what the caller expected. \
                    cd to a linked worktree root or pass -C <linked-worktree-root> before clean, or use --dry-run to inspect.";
        }
        GuardedCommand::Reset => {
            return "cli-git: destructive git reset modes require the effective working directory to be inside a linked git worktree. \
                    Refusing to run from outside a worktree because git reset --hard, --merge, and --keep can rewrite tracked files outside what the caller expected. \
                    cd to a linked worktree root or pass -C <linked-worktree-root> before reset.";
        }
    }
}

/// What: The rejection text for a command run in the main worktree.
/// Why:  The text says what the command could destroy and where to run it instead.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function mainWorktreeMessage({ command }): string;
/// ```
pub fn main_worktree_message(command: GuardedCommand) -> &'static str {
    match command {
        GuardedCommand::Stash => {
            return "cli-git: git stash is rejected in the main git worktree. \
                    Refusing to run because git stash can revert primary checkout filesystem state outside what the caller expected. \
                    Use a linked worktree for stash operations.";
        }
        GuardedCommand::Clean => {
            return "cli-git: state-changing git clean is rejected in the main git worktree. \
                    Refusing to run because git clean can delete primary checkout filesystem state outside what the caller expected. \
                    Use a linked worktree for state-changing clean operations, or use --dry-run to inspect.";
        }
        GuardedCommand::Reset => {
            return "cli-git: destructive git reset modes are rejected in the main git worktree. \
                    Refusing to run because git reset --hard, --merge, and --keep can rewrite primary checkout files outside what the caller expected. \
                    Use a linked worktree for destructive reset operations.";
        }
    }
}

/// What: Decide from the measured worktree kind: the rejection text, or nothing to let the
///       command through.
/// Why:  A linked worktree and an allowlisted tool cache are the two places where these
///       commands may run.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function resolveLinkedWorktree(command: GuardedCommand, target: EffectiveTarget): string | undefined;
/// ```
pub fn resolve_linked_worktree(
    command: GuardedCommand,
    target: EffectiveTarget,
) -> Option<&'static str> {
    match target {
        // `Some(x)` is the "present" case of `Option`; `None` is the "absent" case.
        EffectiveTarget::OutsideWorktree => return Some(outside_worktree_message(command)),
        EffectiveTarget::MainWorktree => return Some(main_worktree_message(command)),
        EffectiveTarget::LinkedWorktree | EffectiveTarget::Allowlisted => return None,
    }
}

/// Guarded forms, harmless forms and every rejection text.
#[cfg(test)]
#[path = "rule_linked_worktree_tests.rs"]
mod tests;
