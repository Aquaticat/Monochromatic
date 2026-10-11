//! Diagnostics of the worktree-copy failure type.

use super::*;

/// A message without a cause is printed unchanged.
#[test]
fn message_without_cause_is_unchanged() {
    let failure: WorktreeCopyError = failure_with_cause("cli-git: could not inspect.", None);
    assert_eq!(
        failure,
        WorktreeCopyError(String::from("cli-git: could not inspect."))
    );
}

/// A cause follows the message after the incumbent's separator.
#[test]
fn cause_follows_message_with_separator() {
    let cause: std::io::Error = std::io::Error::other("disk gone");
    let failure: WorktreeCopyError =
        failure_with_cause("cli-git: could not inspect.", Some(&cause));
    assert_eq!(failure.0, "cli-git: could not inspect. Cause: disk gone");
}

/// Unknown failures are wrapped with the generic sentence and their cause.
#[test]
fn automatic_failure_uses_generic_sentence() {
    let cause: std::io::Error = std::io::Error::other("boom");
    let failure: WorktreeCopyError = automatic_failure(&cause);
    assert_eq!(
        failure.0,
        "cli-git: automatic ignored-state worktree copy failed. Cause: boom"
    );
}
