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
        no_change_message(&[b"a.txt".to_vec(), b"b \"c\".txt".to_vec()]),
        "No commit created: normalization removed every selected change; index copies were reconciled, but worktree copies changed and were kept: [\"a.txt\",\"b \\\"c\\\".txt\"]. Compare them with HEAD before retrying."
    );
}

/// A name that is not UTF-8 shows its readable text in the message.
#[test]
fn a_kept_copy_that_is_not_utf8_shows_replacement_characters() {
    assert_eq!(
        no_change_message(&[b"caf\xe9.txt".to_vec()]),
        "No commit created: normalization removed every selected change; index copies were reconciled, but worktree copies changed and were kept: [\"caf\u{fffd}.txt\"]. Compare them with HEAD before retrying."
    );
}
