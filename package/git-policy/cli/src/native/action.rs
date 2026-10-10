//! What:
//!  The decision one wrapper invocation ends in.
//! Why:
//!  Forwarding replaces the process and cannot run inside a unit test;
//!  returning
//!      the decision as data lets every path be checked directly.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // type Action = { kind: 'forward'; ... } | { kind: 'exit'; code: number; stdout: string; stderr: string };
//! ```

/// What:
///  `OsString` is owned operating-system text of raw OS bytes (sibling `String`
///       must be UTF-8).
/// Why:
///   Environment additions are passed to Git without decoding.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // [string, string][] environment pairs, but byte-preserving.
/// ```
use std::ffi::OsString;
/// `PathBuf` is an owned filesystem path of raw OS bytes.
use std::path::PathBuf;

/// What:
///  Exit code for a usage,
///  configuration or wrapper failure that kept Git from running.
///       `i32` is a signed 32-bit integer,
///  the type of process exit codes.
/// Why:
///   The wrapper's contract reserves 2 for these,
///  distinct from 1 for policy findings.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const ENGINE_FAILURE_EXIT_CODE = 2;
/// ```
pub const ENGINE_FAILURE_EXIT_CODE: i32 = 2;

/// What:
///  What the executable must do for one invocation.
///       `Vec<OsString>` is an owned argument list;
///  `Vec<(OsString, OsString)>` is an
///       owned list of name/value pairs;
///  `String` is owned UTF-8 text.
/// Why:
///   The executable performs exactly one of these:
///  become Git,
///  or print and exit.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Action = { kind: 'forward'; realGit: string; args: string[]; overlay: [string, string][]; stderr: string }
///   | { kind: 'exit'; code: number; stdout: string; stderr: string };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Action {
    /// Become real Git.
    Forward {
        /// The selected real Git executable.
        real_git: PathBuf,
        /// The arguments Git receives:
        ///  no wrapper control,
        ///  fixed transforms applied.
        arguments: Vec<OsString>,
        /// Variables added to the inherited environment.
        overlay: Vec<(OsString, OsString)>,
        /// Complete warning event lines,
        ///  written to standard error before Git starts.
        stderr: String,
    },
    /// Stop without running the caller's command.
    Exit {
        /// Process exit code.
        code: i32,
        /// Complete text for standard output,
        ///  already line-terminated.
        stdout: String,
        /// Complete text for standard error,
        ///  already line-terminated.
        stderr: String,
    },
}

/// What:
///  Build the stop action for a wrapper failure described in prose.
///       `&str` borrows the message;
///  the action owns its formatted copy.
/// Why:
///   These failures (no real Git,
///  a forwarding loop,
///  an unreadable repository)
///       print one prefixed,
///  line-terminated diagnostic on standard error and exit 2.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function failure(message: string): Action;
/// ```
pub fn failure(message: &str) -> Action {
    return Action::Exit {
        code: ENGINE_FAILURE_EXIT_CODE,
        // `String::new()` is empty owned text: nothing goes to standard output.
        stdout: String::new(),
        // `format!` builds the owned, line-terminated text.
        stderr: format!("cli-git: {message}\n"),
    };
}
