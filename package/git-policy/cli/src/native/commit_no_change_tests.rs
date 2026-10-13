//! Controls for the no-change message.

use super::no_change_message;

/// Without conflicts the message says the copies were reconciled.
#[test]
fn a_clean_reconciliation_says_so() {
    assert_eq!(
        no_change_message(&[]),
        "No commit created: normalization removed every selected change; matching worktree and index copies were reconciled."
    );
}

/// Conflicted worktree copies are named as a JSON list, as the incumbent writes them.
#[test]
fn kept_worktree_copies_are_named() {
    assert_eq!(
        no_change_message(&[String::from("a.txt"), String::from("b \"c\".txt")]),
        "No commit created: normalization removed every selected change; index copies were reconciled, but worktree copies changed and were kept: [\"a.txt\",\"b \\\"c\\\".txt\"]. Compare them with HEAD before retrying."
    );
}
