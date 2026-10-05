//! What: Remove wrapper-only escape-hatch flags before arguments reach real Git.
//! Why: Git rejects flags it does not know; a flag-looking token that is really an
//!      option's value or a pathspec must be forwarded untouched.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // stripEscapeHatch({ args: ['stash', '--no-enforce-worktree', 'list'], ... }) => ['stash', 'list']
//! ```

/// What: `OsString` is owned operating-system text of raw OS bytes (sibling `String`
///       must be UTF-8).
/// Why:  Arguments are compared as bytes and forwarded unchanged.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // string[] argv, but byte-preserving.
/// ```
use std::ffi::OsString;

/// Wrapper-only flag suppressing linked-worktree enforcement for one invocation.
pub const WORKTREE_ENFORCEMENT_ESCAPE_HATCH: &str = "--no-enforce-worktree";

/// Wrapper-only flag skipping ignored-state synchronization into new worktrees.
pub const WORKTREE_COPY_ESCAPE_HATCH: &str = "--no-worktree-copy";

/// Token after which Git treats every remaining argument as a path.
pub const PATHSPEC_SEPARATOR: &str = "--";

/// What: Copy the arguments without flag-position occurrences of one escape-hatch token.
///       `&[OsString]` borrows the argument list; `usize` is the list index type;
///       `&[&str]` borrows a list of option spellings; `Vec<OsString>` is the owned result.
/// Why:  Everything up to and including the subcommand is kept, so global options
///       survive. After the subcommand, a token following an option that takes a
///       separate value is that option's value and is kept even when it spells the
///       escape hatch; everything from `--` on is path text and is kept verbatim.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function stripEscapeHatch({ args, subcommandIndex, separateValueOptions, escapeHatchToken }): string[];
/// ```
pub fn strip_escape_hatch(
    arguments: &[OsString],
    subcommand_index: usize,
    separate_value_options: &[&str],
    escape_hatch_token: &str,
) -> Vec<OsString> {
    // What: `Vec::<OsString>::with_capacity(n)` is an empty owned list with room for
    //       `n` items; `mut` allows pushing.
    // Why:  The result is never longer than the input.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const result: string[] = [];
    // ```
    let mut result: Vec<OsString> = Vec::<OsString>::with_capacity(arguments.len());
    // The first `--` after the subcommand ends the region where wrapper flags are
    // recognised, exactly as the TypeScript wrapper located it.
    let mut separator_index: usize = arguments.len();
    // `saturating_add` cannot overflow even for an out-of-range subcommand index.
    let mut scan: usize = subcommand_index.saturating_add(1);
    while scan < arguments.len() {
        if arguments[scan] == PATHSPEC_SEPARATOR {
            separator_index = scan;
            break;
        }
        scan += 1;
    }
    let mut index: usize = 0;
    // Whether the previous kept token takes the current token as its value.
    let mut value_expected: bool = false;
    while index < arguments.len() {
        // `&arguments[index]` borrows one argument without copying it.
        let argument: &OsString = &arguments[index];
        let wrapper_region: bool = index > subcommand_index && index < separator_index;
        index += 1;
        if !wrapper_region || value_expected {
            value_expected = false;
            // `.clone()` copies the argument bytes into the owned result.
            result.push(argument.clone());
            continue;
        }
        if is_listed(argument, separate_value_options) {
            value_expected = true;
            result.push(argument.clone());
            continue;
        }
        if argument == escape_hatch_token {
            continue;
        }
        result.push(argument.clone());
    }
    return result;
}

/// What: Report whether an argument equals one of the listed spellings exactly.
/// Why:  OS text is compared with UTF-8 spellings without converting the argument.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function isListed(argument: string, options: string[]): boolean { return options.includes(argument); }
/// ```
fn is_listed(argument: &OsString, options: &[&str]) -> bool {
    // `for option in options` borrows each spelling; `*option` reads the `&str` it points at.
    for option in options {
        if argument == *option {
            return true;
        }
    }
    return false;
}

/// Argument-boundary controls stay out of the release executable.
#[cfg(test)]
#[path = "escape_hatch_tests.rs"]
mod tests;
