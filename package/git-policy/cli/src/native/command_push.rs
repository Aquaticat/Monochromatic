//! What:
//!  The complete `git push` option table of Git 2.56.0 and the facts read from it.
//! Why:
//!  The atomic-push transform must know whether the caller already chose atomicity,
//!      and the manual-push gate whether the push is a dry run;
//!  both in every spelling Git
//!      accepts (`--at`,
//!  `--no-at`,
//!  `-nf`),
//!  which a list of exact tokens misses.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // parsePushRegion(postSubcommandArgs): PushRegion  (throws OptionError)
//! ```

/// What:
///  Bring the tokenizer,
///  its table builder and its questions into this file.
/// Why:
///   This module only declares Git's table and interprets what the tokenizer found.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { parseOptions, row } from './command_options.ts';
/// ```
use super::command_options::{
    Arity, DEFAULT_MODE, OptionError, OptionSpec, ParsedOptions, UNREAD, WrapperOccurrence,
    parse_options, row,
};
use super::command_options_query::{is_enabled, is_stated};
/// `OsString` is owned operating-system text of raw bytes (sibling `String` must be UTF-8).
use std::ffi::OsString;

/// `--atomic`:
///  request an atomic transaction on the remote side.
pub const ATOMIC: u16 = 1;
/// `-n`,
///  `--dry-run`:
///  do everything except send the updates.
pub const DRY_RUN: u16 = 2;

/// What:
///  Rows of `options[]` in `cmd_push` (builtin/push.c:707-743),
///  in source order.
///       `&[OptionSpec]` is a borrowed table baked into the program.
/// Why:
///   `--branches` is an `OPT_ALIAS` of `--all`;
///  the two names share no prefix,
///  so the
///       alias needs no special ambiguity handling and is a row of its own.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const PUSH_TABLE = [row(UNREAD, 'v', 'verbose', 'none', true), /* ... */] as const;
/// ```
pub const PUSH_TABLE: &[OptionSpec] = &[
    row(UNREAD, Some(b'v'), Some("verbose"), Arity::None, true),
    row(UNREAD, Some(b'q'), Some("quiet"), Arity::None, true),
    row(UNREAD, None, Some("repo"), Arity::Required, true),
    row(UNREAD, None, Some("all"), Arity::None, true),
    row(UNREAD, None, Some("branches"), Arity::None, true),
    row(UNREAD, None, Some("mirror"), Arity::None, true),
    row(UNREAD, Some(b'd'), Some("delete"), Arity::None, true),
    row(UNREAD, None, Some("tags"), Arity::None, true),
    row(DRY_RUN, Some(b'n'), Some("dry-run"), Arity::None, true),
    row(UNREAD, None, Some("porcelain"), Arity::None, true),
    row(UNREAD, Some(b'f'), Some("force"), Arity::None, true),
    // `PARSE_OPT_OPTARG`: only `--force-with-lease=<refname>:<expect>` carries a value.
    row(
        UNREAD,
        None,
        Some("force-with-lease"),
        Arity::Optional,
        true,
    ),
    row(UNREAD, None, Some("force-if-includes"), Arity::None, true),
    row(
        UNREAD,
        None,
        Some("recurse-submodules"),
        Arity::Required,
        true,
    ),
    row(UNREAD, None, Some("thin"), Arity::None, true),
    row(UNREAD, None, Some("receive-pack"), Arity::Required, true),
    row(UNREAD, None, Some("exec"), Arity::Required, true),
    row(UNREAD, Some(b'u'), Some("set-upstream"), Arity::None, true),
    row(UNREAD, None, Some("progress"), Arity::None, true),
    row(UNREAD, None, Some("prune"), Arity::None, true),
    row(UNREAD, None, Some("no-verify"), Arity::None, true),
    row(UNREAD, None, Some("follow-tags"), Arity::None, true),
    // `PARSE_OPT_OPTARG`: only `--signed=<mode>` carries a value.
    row(UNREAD, None, Some("signed"), Arity::Optional, true),
    row(ATOMIC, None, Some("atomic"), Arity::None, true),
    row(
        UNREAD,
        Some(b'o'),
        Some("push-option"),
        Arity::Required,
        true,
    ),
    // `OPT_IPVERSION` rows are `PARSE_OPT_NONEG` (parse-options.h:636-640).
    row(UNREAD, Some(b'4'), Some("ipv4"), Arity::None, false),
    row(UNREAD, Some(b'6'), Some("ipv6"), Arity::None, false),
];

/// What:
///  Final-state facts of one `git push` region.
///  `bool` is true or false;
///       `Vec<WrapperOccurrence>` is an owned list of wrapper-flag positions.
/// Why:
///   `atomic_stated` is "the caller chose",
///  in either direction;
///  `dry_run` is the state
///       after the last `-n`,
///  `--dry-run` or `--no-dry-run`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PushRegion = { hasAtomicChoice: boolean; isDryRun: boolean };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PushRegion {
    /// `--atomic` or `--no-atomic` was written,
    ///  in any accepted abbreviation.
    pub atomic_stated: bool,
    /// The push sends no updates.
    pub dry_run: bool,
    /// Wrapper-only flags in option position;
    ///  `flag` indexes the caller's list.
    pub wrapper: Vec<WrapperOccurrence>,
}

/// What:
///  Parse the region after `push`.
///  `Result<A, B>` is "either success `A` or failure `B`".
/// Why:
///   A region Git itself would refuse yields the refusal,
///  never a guessed fact set.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function parsePushRegion(region: string[], wrapperFlags: string[]): PushRegion; // throws
/// ```
pub fn parse_push_region(
    region: &[OsString],
    wrapper_flags: &[&[u8]],
) -> Result<PushRegion, OptionError> {
    // `?` returns Git's refusal to our caller, or unwraps the tokenized region.
    let parsed: ParsedOptions = parse_options(region, PUSH_TABLE, DEFAULT_MODE, wrapper_flags)?;
    // `Ok(x)` is the success case of `Result`.
    return Ok(PushRegion {
        atomic_stated: is_stated(&parsed, ATOMIC),
        dry_run: is_enabled(&parsed, DRY_RUN),
        wrapper: parsed.wrapper,
    });
}

/// Facts in every accepted spelling,
///  and real-Git controls of the table and its abbreviations.
#[cfg(test)]
#[path = "command_push_tests.rs"]
mod tests;
