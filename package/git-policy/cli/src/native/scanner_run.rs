//! What: Scan every eligible candidate of one version through the loaded scanner.
//! Why: This is the whole forbidden-strings check of one policy pass: candidate bytes
//!      come from the candidate store (staged or committed, never the worktree), go to
//!      the scanner in memory, and the scanner's own results come back. No temporary
//!      file is written and no process is started per file.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // const scans = await scanVersion(scanner, store, version, rulesPath);
//! ```

/// Import the candidate layer's failure, store and version.
use super::candidate_error::CandidateError;
use super::candidate_store::CandidateStore;
use super::candidate_version::CandidateVersion;
/// Import the loaded scanner and its failure.
use super::scanner_adapter::{CandidateScanner, ScannerError};
/// Import the eligibility decision.
use super::scanner_selection::is_scannable;
/// The scanner library's per-candidate result, returned unchanged.
use forbidden_strings::CandidateScan;
/// `Rc<T>` is a shared, read-only handle to one heap value (siblings `Box<T>`, `Arc<T>`).
use std::rc::Rc;

/// What: Why a scan pass stopped: the candidate layer failed, or the scanner did.
///       Each variant carries the original typed failure.
/// Why:  Either way some file was not checked, so the pass has no result. Keeping the
///       original failure lets the caller report its own cause.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type ScanRunError = { kind: 'candidate'; error: CandidateError } | { kind: 'scanner'; error: ScannerError };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ScanRunError {
    /// Candidate bytes could not be read.
    Candidate(CandidateError),
    /// The scanner could not be given a candidate.
    Scanner(ScannerError),
}

/// What: `impl std::fmt::Display for ScanRunError` supplies Rust's "print me" interface.
/// Why:  The message is the wrapped failure's own, unchanged.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// toString(): string { return this.error.message; }
/// ```
impl std::fmt::Display for ScanRunError {
    /// `&self` borrows this error read-only; `&mut` lends the formatter for writing.
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // `match self` reads the variant; each arm prints the message of the failure it carries.
        match self {
            ScanRunError::Candidate(error) => return formatter.write_str(error.message.as_str()),
            ScanRunError::Scanner(error) => return formatter.write_str(error.message.as_str()),
        }
    }
}

/// An empty `impl` marks the type as a standard error value.
impl std::error::Error for ScanRunError {}

/// What: Scan each eligible candidate and return the scanner's result for every one scanned.
///       `&mut CandidateStore` lends the store for changing (it may read objects);
///       `Option<&[u8]>` is "the rules file's candidate pathname or nothing";
///       `Result<T, E>` is "a value or a failure".
/// Why:  Results are returned for clean candidates too, so the caller can tell
///       "scanned and clean" from "not scanned". The first failure ends the pass with
///       no partial result, because a partial result would look like a clean pass.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function scanVersion(scanner, store, version, rulesPath?): Promise<CandidateScan[]>;
/// ```
pub fn scan_version(
    scanner: &CandidateScanner,
    store: &mut CandidateStore,
    version: &CandidateVersion,
    rules_path: Option<&[u8]>,
) -> Result<Vec<CandidateScan>, ScanRunError> {
    // `Vec::new()` is an empty growable list; `mut` lets the loop append to it.
    let mut scans: Vec<CandidateScan> = Vec::new();
    for candidate in version.candidates() {
        if !is_scannable(candidate, rules_path) {
            continue;
        }
        // `match` on the read's `Result`: `Ok(read)` unwraps the bytes, `Err(error)` ends the pass.
        let bytes: Rc<[u8]> = match store.bytes(candidate) {
            Ok(read) => read,
            // `Err(...)` is the failure variant.
            Err(error) => return Err(ScanRunError::Candidate(error)),
        };
        // `&bytes` lends the shared bytes as a plain byte slice.
        match scanner.scan(candidate, &bytes) {
            Ok(scan) => scans.push(scan),
            Err(error) => return Err(ScanRunError::Scanner(error)),
        }
    }
    // `Ok(...)` is the success variant.
    return Ok(scans);
}

/// Isolation controls stay out of the release executable.
#[cfg(test)]
#[path = "scanner_run_tests.rs"]
mod tests;

/// Which candidates a pass skips, and how a pass ends on failure.
#[cfg(test)]
#[path = "scanner_run_selection_tests.rs"]
mod selection_tests;
