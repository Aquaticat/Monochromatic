//! What:
//!  Which commands the linked-worktree policy guards,
//!  and every rejection text.
//! Why:
//!  A harmless form read as destructive blocks an inspection;
//!  a destructive form read
//!      as harmless lets `git reset --hard` run in the primary checkout.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(decideLinkedWorktree(['clean', '-n'])).toEqual({ kind: 'pass' });
//! ```

/// The decision,
///  its texts and the argument builder.
use super::{
    GuardedCommand, LINKED_WORKTREE_REQUIRED_CODE, LinkedWorktreeDecision, decide_linked_worktree,
    dirty_scope, dirty_worktree_message, main_worktree_message, outside_worktree_message,
    resolve_linked_worktree,
};
use crate::command_test_support::os_arguments;
use crate::effective_target::EffectiveTarget;
use crate::rule_worktree_dirty::DirtyScope;

/// Every guarded command.
const ALL_COMMANDS: [GuardedCommand; 11] = [
    GuardedCommand::Stash,
    GuardedCommand::Clean,
    GuardedCommand::Reset,
    GuardedCommand::Restore,
    GuardedCommand::Checkout,
    GuardedCommand::Switch,
    GuardedCommand::Remove,
    GuardedCommand::Move,
    GuardedCommand::CheckoutIndex,
    GuardedCommand::ReadTree,
    GuardedCommand::Abort,
];

/// Decide one invocation written as text.
fn decide(values: &[&str]) -> LinkedWorktreeDecision {
    return decide_linked_worktree(os_arguments(values).as_slice());
}

/// Every stash form,
///  a deleting clean and a file-rewriting reset need the worktree kind.
#[test]
fn destructive_forms_need_the_worktree_kind() {
    assert_eq!(LINKED_WORKTREE_REQUIRED_CODE, "linked-worktree-required");
    for (values, command) in [
        (vec!["stash"], GuardedCommand::Stash),
        (vec!["stash", "drop"], GuardedCommand::Stash),
        (vec!["stash", "pop"], GuardedCommand::Stash),
        (vec!["stash", "clear"], GuardedCommand::Stash),
        (vec!["stash", "push", "-m", "note"], GuardedCommand::Stash),
        (vec!["stash", "--no-such-option"], GuardedCommand::Stash),
        (vec!["clean"], GuardedCommand::Clean),
        (vec!["clean", "-fd"], GuardedCommand::Clean),
        (vec!["clean", "-n", "--no-dry-run"], GuardedCommand::Clean),
        (vec!["clean", "-i"], GuardedCommand::Clean),
        (vec!["reset"], GuardedCommand::Reset),
        (vec!["reset", "--mixed"], GuardedCommand::Reset),
        (vec!["reset", "file"], GuardedCommand::Reset),
        (vec!["reset", "--", "--hard"], GuardedCommand::Reset),
        (vec!["reset", "--hard"], GuardedCommand::Reset),
        (vec!["reset", "--merge", "HEAD~1"], GuardedCommand::Reset),
        (vec!["reset", "--keep"], GuardedCommand::Reset),
        (vec!["reset", "--soft", "--hard"], GuardedCommand::Reset),
        (
            vec!["-C", "dir", "--no-pager", "reset", "--hard"],
            GuardedCommand::Reset,
        ),
        (vec!["restore", "a.txt"], GuardedCommand::Restore),
        (vec!["restore", "--staged", "--", "."], GuardedCommand::Restore),
        (vec!["checkout", "--", "a.txt"], GuardedCommand::Checkout),
        (vec!["checkout", "-f"], GuardedCommand::Checkout),
        (vec!["switch", "--discard-changes", "topic"], GuardedCommand::Switch),
        (vec!["switch", "-f", "topic"], GuardedCommand::Switch),
        (vec!["rm", "-rf", "dir"], GuardedCommand::Remove),
        (vec!["mv", "--force", "a", "b"], GuardedCommand::Move),
        (vec!["checkout-index", "-f", "-a"], GuardedCommand::CheckoutIndex),
        (vec!["read-tree", "--reset", "HEAD"], GuardedCommand::ReadTree),
        (vec!["merge", "--abort"], GuardedCommand::Abort),
        (vec!["rebase", "--abort"], GuardedCommand::Abort),
        (vec!["cherry-pick", "--abort"], GuardedCommand::Abort),
        (vec!["revert", "--abort"], GuardedCommand::Abort),
        (vec!["am", "--abort"], GuardedCommand::Abort),
    ] {
        assert_eq!(
            decide(values.as_slice()),
            LinkedWorktreeDecision::NeedsEffectiveTarget(command),
            "{values:?}"
        );
    }
}

/// A named target moves `HEAD` and is rejected only while the worktree is dirty.
#[test]
fn head_moves_need_the_dirtiness() {
    for (values, command) in [
        (vec!["checkout", "topic"], GuardedCommand::Checkout),
        (vec!["checkout", "-"], GuardedCommand::Checkout),
        (vec!["switch", "topic"], GuardedCommand::Switch),
        (vec!["switch", "--detach", "HEAD~1"], GuardedCommand::Switch),
    ] {
        assert_eq!(
            decide(values.as_slice()),
            LinkedWorktreeDecision::WhenDirty(command),
            "{values:?}"
        );
    }
}

/// Only a deleting clean counts untracked files as uncommitted state.
#[test]
fn only_clean_counts_untracked_files() {
    assert_eq!(dirty_scope(GuardedCommand::Clean), DirtyScope::TrackedAndUntracked);
    for command in [
        GuardedCommand::Stash,
        GuardedCommand::Reset,
        GuardedCommand::Restore,
        GuardedCommand::Checkout,
        GuardedCommand::Switch,
        GuardedCommand::Remove,
        GuardedCommand::Move,
        GuardedCommand::CheckoutIndex,
        GuardedCommand::ReadTree,
        GuardedCommand::Abort,
    ] {
        assert_eq!(dirty_scope(command), DirtyScope::Tracked, "{command:?}");
    }
}

/// Other commands,
///  dry runs,
///  index-only resets and regions Git refuses pass without a measurement.
#[test]
fn harmless_forms_pass() {
    for values in [
        vec![],
        vec!["--version"],
        vec!["status"],
        vec!["add", "stash"],
        vec!["stash", "list"],
        vec!["stash", "list", "--stat"],
        vec!["stash", "show"],
        vec!["stash", "show", "-p", "stash@{1}"],
        vec!["stash", "create"],
        vec!["--no-pager", "stash", "list"],
        vec!["clean", "-n"],
        vec!["clean", "--dry-run", "-fd"],
        vec!["clean", "-i", "-n"],
        vec!["reset", "--soft", "HEAD~1"],
        vec!["reset", "--hard", "--soft"],
        vec!["restore", "-h"],
        vec!["checkout"],
        vec!["checkout", "-b", "topic"],
        vec!["switch", "-c", "topic"],
        vec!["rm", "a.txt"],
        vec!["rm", "--", "-f"],
        vec!["mv", "a", "b"],
        vec!["merge", "topic"],
        vec!["rebase", "main"],
        vec!["read-tree", "HEAD"],
        vec!["checkout", "--no-such-option"],
        vec!["switch", "--no-such-option"],
        vec!["clean", "--no-such-option"],
        vec!["reset", "--hard", "--no-such-option"],
        vec!["--no-such-global", "reset", "--hard"],
    ] {
        assert_eq!(
            decide(values.as_slice()),
            LinkedWorktreeDecision::Pass,
            "{values:?}"
        );
    }
}

/// Only the main worktree and a place without a worktree are rejected,
///  each with its own text.
#[test]
fn only_main_and_absent_worktrees_are_rejected() {
    for command in ALL_COMMANDS {
        assert_eq!(
            resolve_linked_worktree(command, EffectiveTarget::MainWorktree),
            Some(main_worktree_message(command))
        );
        assert_eq!(
            resolve_linked_worktree(command, EffectiveTarget::OutsideWorktree),
            Some(outside_worktree_message(command))
        );
        assert_eq!(
            resolve_linked_worktree(command, EffectiveTarget::LinkedWorktree),
            None
        );
        assert_eq!(
            resolve_linked_worktree(command, EffectiveTarget::Allowlisted),
            None
        );
        assert_ne!(
            main_worktree_message(command),
            outside_worktree_message(command)
        );
    }
}

/// The stash and clean texts are the incumbent's word for word; the reset texts name the wider guard.
#[test]
fn rejection_texts_are_the_incumbent_messages() {
    assert_eq!(
        outside_worktree_message(GuardedCommand::Stash),
        "cli-git: git stash requires the effective working directory to be inside a linked git worktree. Refusing to run from outside a worktree because git stash can revert filesystem state outside what the caller expected. cd to a linked worktree root or pass -C <linked-worktree-root> before stash."
    );
    assert_eq!(
        outside_worktree_message(GuardedCommand::Clean),
        "cli-git: state-changing git clean requires the effective working directory to be inside a linked git worktree. Refusing to run from outside a worktree because git clean can delete filesystem state outside what the caller expected. cd to a linked worktree root or pass -C <linked-worktree-root> before clean, or use --dry-run to inspect."
    );
    assert_eq!(
        outside_worktree_message(GuardedCommand::Reset),
        "cli-git: git reset in any mode but --soft requires the effective working directory to be inside a linked git worktree. Refusing to run from outside a worktree because git reset can discard staged entries or rewrite tracked files outside what the caller expected. cd to a linked worktree root or pass -C <linked-worktree-root> before reset, or use --soft."
    );
    assert_eq!(
        main_worktree_message(GuardedCommand::Stash),
        "cli-git: git stash is rejected in the main git worktree. Refusing to run because git stash can revert primary checkout filesystem state outside what the caller expected. Use a linked worktree for stash operations."
    );
    assert_eq!(
        main_worktree_message(GuardedCommand::Clean),
        "cli-git: state-changing git clean is rejected in the main git worktree. Refusing to run because git clean can delete primary checkout filesystem state outside what the caller expected. Use a linked worktree for state-changing clean operations, or use --dry-run to inspect."
    );
    assert_eq!(
        main_worktree_message(GuardedCommand::Reset),
        "cli-git: git reset in any mode but --soft is rejected in the main git worktree. Refusing to run because git reset can discard staged entries or rewrite primary checkout files outside what the caller expected. Use a linked worktree for it, or use --soft to move HEAD alone."
    );
}

/// The texts of the commands added to the policy name the command, the loss, and each way forward.
#[test]
fn new_texts_name_the_command_and_every_way_forward() {
    for command in ALL_COMMANDS {
        let main = main_worktree_message(command);
        let dirty = dirty_worktree_message(command);
        let outside = outside_worktree_message(command);
        assert!(main.starts_with("cli-git: "), "{command:?}");
        assert!(dirty.contains("uncommitted"), "{command:?}: {dirty}");
        assert!(dirty.contains("--no-enforce-worktree"), "{command:?}: {dirty}");
        assert!(dirty.contains("explicit paths"), "{command:?}: {dirty}");
        assert!(dirty.contains("clean linked worktree"), "{command:?}: {dirty}");
        assert_ne!(main, dirty);
        assert_ne!(main, outside);
    }
    assert!(dirty_worktree_message(GuardedCommand::Clean).contains("untracked files"));
    assert!(!dirty_worktree_message(GuardedCommand::Restore).contains("untracked"));
    assert!(main_worktree_message(GuardedCommand::Restore).contains("git restore"));
    assert!(main_worktree_message(GuardedCommand::Restore).contains("--no-enforce-worktree"));
}
