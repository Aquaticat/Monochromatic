//! What:
//!  The rejection texts of the linked-worktree policy: outside any worktree, in the main worktree, and in a
//!  worktree that holds uncommitted state.
//! Why:
//!  Each text names the command, says what it could destroy, and gives every valid way forward, so the person or
//!  agent that reads it can decide without looking anything up.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // mainWorktreeMessage('restore') === 'cli-git: git restore is rejected in the main git worktree. ...'
//! ```

use super::rule_linked_worktree::GuardedCommand;

/// The sentence every text ends with: the one deliberate way to discard work anyway.
const HATCH_ADVICE: &str = "to discard the work on purpose, pass --no-enforce-worktree directly after the subcommand";

/// What:
///  How a text names the guarded command.
/// Why:
///   The forms of one subcommand that discard are named by the subcommand itself.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function commandName(command: GuardedCommand): string;
/// ```
fn command_name(command: GuardedCommand) -> &'static str {
    match command {
        GuardedCommand::Stash => return "git stash",
        GuardedCommand::Clean => return "git clean",
        GuardedCommand::Reset => return "git reset",
        GuardedCommand::Restore => return "git restore",
        GuardedCommand::Checkout => return "git checkout",
        GuardedCommand::Switch => return "git switch",
        GuardedCommand::Remove => return "git rm --force",
        GuardedCommand::Move => return "git mv --force",
        GuardedCommand::CheckoutIndex => return "git checkout-index --force",
        GuardedCommand::ReadTree => return "git read-tree --reset",
        GuardedCommand::Abort => return "git merge, rebase, cherry-pick, revert or am with --abort",
    }
}

/// What:
///  The rejection text for a command run where there is no worktree.
/// Why:
///   The text says what the command could destroy and how to run it safely.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function outsideWorktreeMessage({ command }): string;
/// ```
pub fn outside_worktree_message(command: GuardedCommand) -> String {
    match command {
        GuardedCommand::Stash => {
            return String::from(
                "cli-git: git stash requires the effective working directory to be inside a linked git worktree. \
                 Refusing to run from outside a worktree because git stash can revert filesystem state outside what the caller expected. \
                 cd to a linked worktree root or pass -C <linked-worktree-root> before stash.",
            );
        }
        GuardedCommand::Clean => {
            return String::from(
                "cli-git: state-changing git clean requires the effective working directory to be inside a linked git worktree. \
                 Refusing to run from outside a worktree because git clean can delete filesystem state outside what the caller expected. \
                 cd to a linked worktree root or pass -C <linked-worktree-root> before clean, or use --dry-run to inspect.",
            );
        }
        GuardedCommand::Reset => {
            return String::from(
                "cli-git: git reset in any mode but --soft requires the effective working directory to be inside a linked git worktree. \
                 Refusing to run from outside a worktree because git reset can discard staged entries or rewrite tracked files outside what the caller expected. \
                 cd to a linked worktree root or pass -C <linked-worktree-root> before reset, or use --soft.",
            );
        }
        other => {
            return format!(
                "cli-git: {} requires the effective working directory to be inside a linked git worktree. \
                 Refusing to run from outside a worktree because it can overwrite or delete uncommitted work outside what the caller expected. \
                 cd to a linked worktree root or pass -C <linked-worktree-root> before the subcommand.",
                command_name(other)
            );
        }
    }
}

/// What:
///  The rejection text for a command run in the main worktree.
/// Why:
///   The text says what the command could destroy and where to run it instead.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function mainWorktreeMessage({ command }): string;
/// ```
pub fn main_worktree_message(command: GuardedCommand) -> String {
    match command {
        GuardedCommand::Stash => {
            return String::from(
                "cli-git: git stash is rejected in the main git worktree. \
                 Refusing to run because git stash can revert primary checkout filesystem state outside what the caller expected. \
                 Use a linked worktree for stash operations.",
            );
        }
        GuardedCommand::Clean => {
            return String::from(
                "cli-git: state-changing git clean is rejected in the main git worktree. \
                 Refusing to run because git clean can delete primary checkout filesystem state outside what the caller expected. \
                 Use a linked worktree for state-changing clean operations, or use --dry-run to inspect.",
            );
        }
        GuardedCommand::Reset => {
            return String::from(
                "cli-git: git reset in any mode but --soft is rejected in the main git worktree. \
                 Refusing to run because git reset can discard staged entries or rewrite primary checkout files outside what the caller expected. \
                 Use a linked worktree for it, or use --soft to move HEAD alone.",
            );
        }
        other => {
            return format!(
                "cli-git: {} is rejected in the main git worktree. \
                 Refusing to run because it can overwrite or delete uncommitted work in the primary checkout, and nothing would record which command did. \
                 Use a linked worktree for it; {HATCH_ADVICE}.",
                command_name(other)
            );
        }
    }
}

/// What:
///  The rejection text for a command run in a worktree that holds uncommitted state.
/// Why:
///   The state is what the command could destroy; committing it with explicit paths or moving to a clean linked
///  worktree are the ways forward that lose nothing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function dirtyWorktreeMessage({ command }): string;
/// ```
pub fn dirty_worktree_message(command: GuardedCommand) -> String {
    let what: &str = if command == GuardedCommand::Clean {
        "changes to tracked files or untracked files"
    } else {
        "changes to tracked files"
    };
    return format!(
        "cli-git: {} is rejected because this worktree has uncommitted {what}. \
         Refusing to run because it can overwrite or delete them. \
         Commit them with explicit paths first, or run the command in a clean linked worktree; {HATCH_ADVICE}.",
        command_name(command)
    );
}
