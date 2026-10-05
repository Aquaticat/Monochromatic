//! What: Lint or fix one planned file from its bytes to its findings.
//! Why: Reading, the bounded fix loop, the refusal rules and the atomic write are one unit of
//! work per file; nothing here knows about other files, so workers can run it concurrently.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // processFile(plan) -> { findings, notes, written }
//! ```

/// Import the finding model, the fix loop and the per-snapshot checker.
use crate::diagnostic::Diagnostic;
use crate::fix_loop::{FixedSource, fix_source};
use crate::run_check::HostChecker;
use crate::run_failure::{file_start, fix_refused, processing_failure};
use crate::run_lfs::LfsRepos;
use crate::run_plan::FilePlan;
use crate::run_write::write_atomically;
use crate::rust_file_engine::RustFileEngine;
/// Import ordering for the stable per-file sort of findings.
use std::cmp::Ordering;

/// What: The result of checking or fixing one in-memory source.
/// Why: Standard-input mode and file mode share this step; only what happens to `fixed` differs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type SourceOutcome = { findings: Diagnostic[]; fixed?: string; notes: string[] };
/// ```
#[derive(Debug)]
pub struct SourceOutcome {
    /// Findings for the final source, sorted by position.
    pub findings: Vec<Diagnostic>,
    /// The accepted fixed source in fix mode; `None` when not fixing or when the fix was refused.
    pub fixed: Option<String>,
    /// Debug explanations for this source.
    pub notes: Vec<String>,
}

/// What: The result of processing one file on disk.
/// Why: The run needs findings for output and exit status, and notes for `--debug`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type FileOutcome = { findings: Diagnostic[]; notes: string[]; written: boolean };
/// ```
#[derive(Debug)]
pub struct FileOutcome {
    /// Findings reported for this file.
    pub findings: Vec<Diagnostic>,
    /// Debug explanations for this file.
    pub notes: Vec<String>,
    /// Whether fix mode replaced the file's contents.
    pub written: bool,
}

/// What: Order findings by host position, then by rule code.
/// Why: Rules run in registry order, but a report reads top to bottom; the code breaks ties so
/// the output is deterministic.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function byPosition(left: Diagnostic, right: Diagnostic): number;
/// ```
fn by_position(left: &Diagnostic, right: &Diagnostic) -> Ordering {
    return first_offset(left)
        .cmp(&first_offset(right))
        .then(left.code.cmp(&right.code));
}

/// What: The byte offset of a finding's first label, or zero for a finding without labels.
/// Why: Every finding this crate builds has one label; zero keeps the comparison total anyway.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function firstOffset(finding: Diagnostic): number { return finding.labels[0]?.span.offset ?? 0; }
/// ```
fn first_offset(finding: &Diagnostic) -> usize {
    if let Some(label) = finding.labels.first() {
        return label.span.offset;
    }
    return 0;
}

/// What: Check, or fix and re-check, one source under a plan.
/// Why: In fix mode a refused fix leaves the source unchanged: the findings are those of the
/// original source plus one `core/fix-refused` finding carrying the reason.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function processSource(plan, source, fix, lfs, engine): SourceOutcome;
/// ```
pub fn process_source(
    plan: &FilePlan,
    source: &str,
    fix: bool,
    lfs: &LfsRepos,
    engine: Option<&mut RustFileEngine>,
) -> SourceOutcome {
    let mut checker: HostChecker<'_> = HostChecker::new(plan, lfs, engine);
    let mut fixed: Option<String> = None;
    let mut findings: Vec<Diagnostic>;
    if fix {
        let attempt: Result<FixedSource, crate::edits::FixError> = fix_source(source, &mut checker);
        match attempt {
            Ok(result) => {
                checker.notes.push(format!(
                    "{}: fix loop changed the source in {} pass(es) and stopped as {:?}",
                    plan.display, result.changed_passes, result.stop
                ));
                findings = result.diagnostics;
                fixed = Some(result.source);
            }
            Err(error) => {
                findings = checker.check_snapshot(source);
                findings.push(fix_refused(plan.display.as_str(), error.message));
            }
        }
    } else {
        findings = checker.check_snapshot(source);
    }
    findings.sort_by(by_position);
    return SourceOutcome {
        findings,
        fixed,
        notes: checker.notes,
    };
}

/// What: Build the outcome for a file that could not be read at all.
/// Why: An unreadable or non-UTF-8 file is one processing finding at the start of the file.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function unreadable(plan: FilePlan, message: string): FileOutcome;
/// ```
fn unreadable(plan: &FilePlan, message: String) -> FileOutcome {
    return FileOutcome {
        findings: vec![processing_failure(
            plan.display.as_str(),
            file_start(),
            message,
        )],
        notes: Vec::<String>::new(),
        written: false,
    };
}

/// What: Read, check or fix, and in fix mode atomically rewrite one file.
/// Why: The file is rewritten only when the accepted fixed source differs from what was read. A
/// failed write leaves the original bytes in place, so the findings reported are then those of
/// the original source plus one processing finding for the write.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function processFile(plan, fix, lfs, engine): FileOutcome;
/// ```
pub fn process_file(
    plan: &FilePlan,
    fix: bool,
    lfs: &LfsRepos,
    mut engine: Option<&mut RustFileEngine>,
) -> FileOutcome {
    let bytes: Vec<u8> = match std::fs::read(&plan.absolute) {
        Ok(contents) => contents,
        Err(error) => {
            return unreadable(
                plan,
                format!("Cannot read {}: {error}.", plan.absolute.display()),
            );
        }
    };
    let source: String = match String::from_utf8(bytes) {
        Ok(text) => text,
        Err(error) => {
            return unreadable(
                plan,
                format!(
                    "{} is not valid UTF-8 (first invalid byte at offset {}); it was not linted.",
                    plan.absolute.display(),
                    error.utf8_error().valid_up_to()
                ),
            );
        }
    };
    // as_deref_mut lends the engine for this call only, so it can be lent again for a recheck.
    let outcome: SourceOutcome =
        process_source(plan, source.as_str(), fix, lfs, engine.as_deref_mut());
    let mut findings: Vec<Diagnostic> = outcome.findings;
    let mut notes: Vec<String> = outcome.notes;
    let mut written: bool = false;
    if let Some(fixed) = outcome.fixed
        && fixed != source
    {
        match write_atomically(&plan.absolute, fixed.as_bytes()) {
            Ok(()) => written = true,
            Err(error) => {
                let original: SourceOutcome =
                    process_source(plan, source.as_str(), false, lfs, engine);
                findings = original.findings;
                notes.extend(original.notes);
                findings.push(processing_failure(
                    plan.display.as_str(),
                    file_start(),
                    format!("{error} The original file bytes have not been changed."),
                ));
            }
        }
    }
    return FileOutcome {
        findings,
        notes,
        written,
    };
}

/// Per-file pipeline controls stay outside release artifacts.
#[cfg(test)]
#[path = "run_file_tests.rs"]
mod tests;
