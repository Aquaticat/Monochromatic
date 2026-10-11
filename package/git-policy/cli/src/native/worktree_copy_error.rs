//! What:
//!  The one failure type of the linked-worktree ignored-state copy,
//!  with the complete user-facing diagnostic in its message.
//! Why:
//!  Every copy step fails with a message that names the path it could not handle
//!  and, when there is one, the operating system's cause.
//!  The incumbent renders the cause after the message with a fixed separator,
//!  so both wrappers print the same words.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! class WorktreeCopyError extends Error {
//!   constructor(message: string, cause?: unknown) { super(`${message}${causeSuffix(cause)}`); }
//! }
//! ```

/// What:
///  The generic message the lifecycle reports for a failure that is not already a copy failure.
/// Why:
///   The incumbent's `asWorktreeCopyError` wraps unknown failures with this exact sentence.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// 'cli-git: automatic ignored-state worktree copy failed.'
/// ```
pub const AUTOMATIC_FAILURE_MESSAGE: &str =
    "cli-git: automatic ignored-state worktree copy failed.";

/// What:
///  One copy failure and its complete diagnostic.
/// Why:
///   Callers print the message unchanged; the lifecycle decides the exit status.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class WorktreeCopyError extends Error {}
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorktreeCopyError(pub String);

/// What:
///  The diagnostic of one failed step: its message, then the cause when one exists.
/// Why:
///   A cause is appended exactly once, after the separator the incumbent uses.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// `${message}${cause === undefined ? '' : ` Cause: ${caughtValueText(cause)}`}`
/// ```
pub fn failure_with_cause(
    message: &str,
    cause: Option<&dyn std::fmt::Display>,
) -> WorktreeCopyError {
    // `match` on the optional cause keeps the no-cause message free of any suffix.
    match cause {
        None => {
            return WorktreeCopyError(String::from(message));
        }
        Some(text) => {
            return WorktreeCopyError(format!("{message} Cause: {text}"));
        }
    }
}

/// What:
///  The lifecycle's wrapper for a failure that is not a copy failure yet.
/// Why:
///   Unknown failures surface as the generic sentence with their cause,
///  so no raw operating-system text reaches the user without the sentence in front of it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// new WorktreeCopyError('cli-git: automatic ignored-state worktree copy failed.', error)
/// ```
pub fn automatic_failure(cause: &dyn std::fmt::Display) -> WorktreeCopyError {
    return failure_with_cause(AUTOMATIC_FAILURE_MESSAGE, Some(cause));
}

/// Error message controls stay out of the release executable.
#[cfg(test)]
#[path = "worktree_copy_error_tests.rs"]
mod tests;
