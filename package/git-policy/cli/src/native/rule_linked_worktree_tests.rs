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
    main_worktree_message, outside_worktree_message, resolve_linked_worktree,
};
use crate::command_test_support::os_arguments;
use crate::effective_target::EffectiveTarget;

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
        (vec!["stash", "list"], GuardedCommand::Stash),
        (vec!["stash", "push", "-m", "note"], GuardedCommand::Stash),
        (vec!["stash", "--no-such-option"], GuardedCommand::Stash),
        (vec!["clean"], GuardedCommand::Clean),
        (vec!["clean", "-fd"], GuardedCommand::Clean),
        (vec!["clean", "-n", "--no-dry-run"], GuardedCommand::Clean),
        (vec!["clean", "-i"], GuardedCommand::Clean),
        (vec!["reset", "--hard"], GuardedCommand::Reset),
        (vec!["reset", "--merge", "HEAD~1"], GuardedCommand::Reset),
        (vec!["reset", "--keep"], GuardedCommand::Reset),
        (vec!["reset", "--soft", "--hard"], GuardedCommand::Reset),
        (
            vec!["-C", "dir", "--no-pager", "reset", "--hard"],
            GuardedCommand::Reset,
        ),
    ] {
        assert_eq!(
            decide(values.as_slice()),
            LinkedWorktreeDecision::NeedsEffectiveTarget(command),
            "{values:?}"
        );
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
        vec!["clean", "-n"],
        vec!["clean", "--dry-run", "-fd"],
        vec!["clean", "-i", "-n"],
        vec!["reset"],
        vec!["reset", "--soft", "HEAD~1"],
        vec!["reset", "--mixed"],
        vec!["reset", "--hard", "--soft"],
        vec!["reset", "--", "--hard"],
        vec!["reset", "file"],
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
    for command in [
        GuardedCommand::Stash,
        GuardedCommand::Clean,
        GuardedCommand::Reset,
    ] {
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

/// The six rejection texts are the incumbent's,
///  word for word.
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
        "cli-git: destructive git reset modes require the effective working directory to be inside a linked git worktree. Refusing to run from outside a worktree because git reset --hard, --merge, and --keep can rewrite tracked files outside what the caller expected. cd to a linked worktree root or pass -C <linked-worktree-root> before reset."
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
        "cli-git: destructive git reset modes are rejected in the main git worktree. Refusing to run because git reset --hard, --merge, and --keep can rewrite primary checkout files outside what the caller expected. Use a linked worktree for destructive reset operations."
    );
}
