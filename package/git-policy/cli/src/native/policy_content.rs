//! What: What one lifecycle offers the content policies, and the candidates it prepared
//!       for them, read once and shared by every content policy of the invocation.
//! Why: A forwarded command other than `git add` has no candidates, so its content
//!      policies find nothing. `git add` and the direct commands have candidates, which
//!      are prepared the first time a content policy reads them: an invocation whose
//!      content policies are all off or escaped starts no Git process for them. A failure
//!      to prepare is remembered, so it is reported once and never retried.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // const version = await content.version(lifecycle, facts); for (const c of version.candidates) await content.bytes(c);
//! ```

/// Import the layer's failure type and its causes.
use super::candidate_error::{CandidateError, CandidateFailure};
/// Import what a lifecycle asks for and what preparing it yields.
use super::candidate_prediction::{CandidateRequest, PreparedCandidates};
/// Import the candidate and the immutable version type.
use super::candidate_version::{Candidate, CandidateVersion};
/// Import the outcome a check returns.
use super::policy_engine::PolicyOutcome;
/// Import the facts interface that prepares candidates.
use super::repository_facts::RepositoryFacts;
/// Import the scanner adapter.
use super::scanner_adapter::CandidateScanner;
/// Import the code of each candidate failure.
use super::scanner_failure_code::candidate_failure_code;
/// Import the scan pass and its failure.
use super::scanner_run::{ScanRunError, scan_version};
/// The scanner library's per-candidate result.
use forbidden_strings::CandidateScan;
/// `Rc<T>` is a shared, read-only handle; versions and bytes are shared, not copied.
use std::rc::Rc;

/// What: What the current lifecycle offers a content policy. An `enum` is a closed set
///       of named alternatives; `Requested` carries what to prepare. `#[derive(...)]`
///       generates cloning, debug printing and `==`.
/// Why:  "There are no files to check" and "there are files, prepared on demand" must
///       never be confused: the first is clean, the second must be read.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type LifecycleContent = { kind: 'none' } | { kind: 'requested'; request: CandidateRequest };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum LifecycleContent {
    /// The lifecycle has no candidate content, as for a forwarded command other than `git add`.
    None,
    /// The lifecycle has candidates; they are prepared when a content policy first reads them.
    Requested(
        /// What to prepare.
        CandidateRequest,
    ),
}

/// What: The candidates of one invocation once prepared, or the remembered failure.
///       `Option<Result<..>>` is "not yet asked", "prepared" or "failed".
/// Why:  Every content policy of the invocation reads the same version through one store.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class ContentState { #prepared?: PreparedCandidates | CandidateError }
/// ```
pub struct ContentState {
    /// The prepared candidates, or the failure of the one attempt to prepare them.
    prepared: Option<Result<PreparedCandidates, CandidateError>>,
}

/// What: The outcome of a content policy whose candidates could not be prepared or read.
///       `&CandidateError` borrows the failure; its code follows its cause.
/// Why:  Every cause but a sequencing defect is unreadable content; the message is the
///       layer's own, which never contains a candidate's pathname.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const candidateFailure = (error: CandidateError): PolicyOutcome => ({ kind: 'failed', code: candidateFailureCode(error.failure), message: error.message });
/// ```
pub fn candidate_failure(error: &CandidateError) -> PolicyOutcome {
    return PolicyOutcome::Failed {
        code: candidate_failure_code(error.failure),
        // `.clone()` copies the message the remembered failure keeps.
        message: error.message.clone(),
    };
}

/// What: `impl ContentState { ... }` attaches the constructor and the two reads.
/// Why:  Preparation and reading stay behind one owner, so no policy can read bytes of a
///       version it did not get from here.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class ContentState { version(lifecycle, facts) {} bytes(candidate) {} }
/// ```
impl ContentState {
    /// What: A state that has prepared nothing.
    /// Why:  Preparation waits until a content policy reads.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// constructor() {}
    /// ```
    pub fn new() -> ContentState {
        // `None` is the "absent" variant: nothing has been asked.
        return ContentState { prepared: None };
    }

    /// What: The candidate version, prepared on first use; `Ok(None)` when the lifecycle
    ///       has no candidates. `<F: RepositoryFacts>` accepts any facts provider;
    ///       `Err(error)` is the candidate layer's failure, remembered for later calls.
    /// Why:  A direct command prepares its scope before any policy runs, as the installed
    ///       wrapper does, and reports a failure as a lifecycle failure of its own.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// async prepare(lifecycle: LifecycleContent, facts: RepositoryFacts): Promise<CandidateVersion | undefined>; // throws CandidateError
    /// ```
    pub fn prepare<F: RepositoryFacts>(
        &mut self,
        lifecycle: &LifecycleContent,
        facts: &mut F,
    ) -> Result<Option<Rc<CandidateVersion>>, CandidateError> {
        let LifecycleContent::Requested(request) = lifecycle else {
            return Ok(None);
        };
        if self.prepared.is_none() {
            // `Some(...)` stores the one attempt's result, success or failure.
            self.prepared = Some(facts.candidates(request));
        }
        // `match` on the remembered attempt; `&self.prepared` borrows it read-only.
        match &self.prepared {
            Some(Ok(prepared)) => return Ok(Some(Rc::clone(&prepared.version))),
            // `.clone()` copies the remembered failure for this caller.
            Some(Err(error)) => return Err(error.clone()),
            None => return Err(not_prepared_error()),
        }
    }

    /// What: The candidate version for a content policy: as `prepare`, with a failure
    ///       turned into the outcome the policy returns as it is.
    /// Why:  The first content policy that reads pays for the preparation; later ones
    ///       share it, and a failure is reported the same way to each.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// async version(lifecycle: LifecycleContent, facts: RepositoryFacts): Promise<CandidateVersion | undefined>; // throws PolicyOutcome
    /// ```
    pub fn version<F: RepositoryFacts>(
        &mut self,
        lifecycle: &LifecycleContent,
        facts: &mut F,
    ) -> Result<Option<Rc<CandidateVersion>>, PolicyOutcome> {
        match self.prepare(lifecycle, facts) {
            Ok(found) => return Ok(found),
            Err(error) => return Err(candidate_failure(&error)),
        }
    }

    /// What: The bytes of a candidate of the prepared version.
    /// Why:  Bytes come from the store bound to the private index, never the live worktree.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// async bytes(candidate: Candidate): Promise<Uint8Array>;
    /// ```
    pub fn bytes(&mut self, candidate: &Candidate) -> Result<Rc<[u8]>, PolicyOutcome> {
        // `&mut self.prepared` lends the remembered attempt for reading through its store.
        match &mut self.prepared {
            Some(Ok(prepared)) => match prepared.store.bytes(candidate) {
                Ok(read) => return Ok(read),
                Err(error) => return Err(candidate_failure(&error)),
            },
            Some(Err(_)) | None => return Err(candidate_failure(&not_prepared_error())),
        }
    }
}

/// What: `impl ContentState { ... }` continued: the scan of every scannable candidate.
/// Why:  The scan pass reads bytes through the store the candidates were prepared in.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class ContentState { scan(scanner, rulesPath) {} }
/// ```
impl ContentState {
    /// What: Scan the prepared version through `scanner`. `Option<&[u8]>` is the rules
    ///       file's own pathname, which is not scanned, or nothing.
    /// Why:  `scan_version` is the candidate layer's one scan pass; this lends it the store
    ///       and the version together.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// async scan(scanner: CandidateScanner, rulesPath?: Buffer): Promise<CandidateScan[]>;
    /// ```
    pub fn scan(
        &mut self,
        scanner: &CandidateScanner,
        rules_path: Option<&[u8]>,
    ) -> Result<Vec<CandidateScan>, ScanRunError> {
        match &mut self.prepared {
            // The store is lent for writing and the version for reading: two separate fields.
            Some(Ok(prepared)) => {
                return scan_version(scanner, &mut prepared.store, &prepared.version, rules_path);
            }
            Some(Err(_)) | None => return Err(ScanRunError::Candidate(not_prepared_error())),
        }
    }
}

/// What: The failure of a read made before any version was prepared.
/// Why:  Only a defect in a calling policy can cause it. It is reported as a stale
///       candidate, whose code is `policy-incomplete`: the policy's own sequencing
///       failed, and the read must still not look clean.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const notPreparedError = () => new CandidateError('stale-candidate', '...');
/// ```
fn not_prepared_error() -> CandidateError {
    return CandidateError::new(
        CandidateFailure::StaleCandidate,
        "cli-git read candidate content before the candidates were prepared; this is a defect in cli-git.",
    );
}

/// What: `impl Default for ContentState` lets `ContentState::default()` build the empty state.
/// Why:  Clippy asks a type with a `new()` without arguments to provide `Default` too.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// static default(): ContentState { return new ContentState(); }
/// ```
impl Default for ContentState {
    /// What: The state that has prepared nothing. Why: same as `new`.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// static default(): ContentState
    /// ```
    fn default() -> ContentState {
        return ContentState::new();
    }
}

/// Preparation, sharing and failure controls stay out of the release executable.
#[cfg(test)]
#[path = "policy_content_tests.rs"]
mod tests;
