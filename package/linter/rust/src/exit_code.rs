//! Exit-status policy for completed lint runs.

/// What:     `use crate::cli::Cli;` makes this crate's parsed command-line
///           record available in this module. `crate::` starts at this package's
///           root, like an absolute import from a TypeScript package entry.
/// Why:      Exit status depends on warning-related command-line options.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import type { Cli } from './cli.ts';
/// ```
use crate::cli::Cli;

/// What:     `pub(crate) fn exit_code_for(..) -> i32` defines a function visible
///           within this crate. It combines Boolean warning policy with `usize`
///           warning and error counts, then returns an `i32` process status.
///           `usize` is platform-sized and matches collection counts; siblings
///           include `u32`, `u64`, and signed `i32`. The returned `i32` is signed;
///           siblings include `u32`, `i64`, and platform-sized `isize`.
/// Why:      Keep every condition that can fail a completed lint run in one
///           place. Counts stay `usize` to avoid casts from collection lengths;
///           status uses `i32` because the public run loop already exposes it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function exitCodeFor(
///   cli: Cli,
///   configDenyWarnings: boolean,
///   warnings: number,
///   errors: number,
/// ): number {
///   // Return process status from finding totals and warning policy.
/// }
/// ```
/// Decide process exit status from warning and error counts.
pub(crate) fn exit_code_for(
    cli: &Cli,
    config_deny_warnings: bool,
    warnings: usize,
    errors: usize,
) -> i32 {
    // Any error fails, whatever the warning settings say.
    if errors > 0 {
        return 1;
    }

    // The flag and the configured option are both honoured, and the flag cannot
    // turn the option off, matching how `deny-warnings` merges between files.
    if (cli.deny_warnings || config_deny_warnings) && warnings > 0 {
        return 1;
    }

    // `if let Some(threshold) = ..` runs only when a threshold was set. Zero is
    // meaningful and distinct from absent, which is why this is an `Option`
    // rather than a number defaulting to zero.
    // What:     `if let Some(threshold) = .. && warnings > threshold`. A let
    //           binding and a boolean test joined by `&&` in one condition; the
    //           binding is in scope for the test to its right.
    // Why:      Written as two nested `if`s clippy objects, and it reads as one
    //           condition anyway: there is a threshold AND it was exceeded.
    if let Some(threshold) = cli.max_warnings
        && warnings > threshold
    {
        return 1;
    }

    return 0;
}
