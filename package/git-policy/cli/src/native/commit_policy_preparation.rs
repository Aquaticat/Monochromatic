//! What:
//!  The commit path's policy preparation: converge the private index, then either prepare the
//!       commit in the shadow, or, when the corrections leave the intended tree equal to `HEAD`,
//!       reconcile the copies and report a no-change normalization instead of a commit.
//! Why:
//!  A final-newline correction can be the whole change; committing an identical tree is not wanted.
//!  The incumbent reports that case as the `commit-normalization/no-change` core finding and exits 1
//!  (`src/policy-engine/commit-transaction-no-change.ts`).
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! const convergence = await convergeCommitPolicies({ ... });
//! if (intendedTree === headTree) return noChangeResult(...);
//! ```

use super::commit_convergence::{CommitConvergence, CommitConvergenceInput, converge_commit_policies};
use super::commit_index::write_private_tree;
use super::commit_preparation::{PreparationError, PreparationHooks, PreparationRequest, PreparedCommit, PreparedPaths, prepare_native_commit};
use super::capture_invocation::InvocationCapture;
use super::direct_fix_install::install_corrections;
use super::policy_checks::ShippedChecks;
use super::policy_convergence::Convergence;
use super::policy_engine::StageRequest;
use super::policy_events::PolicyEvent;
use super::policy_pass::PassResult;
use super::private_index_stage::{PrivateStage, git_mode};
use super::direct_fix_install::InstallChange;
use super::repository_facts::RepositoryFacts;
use super::transaction_git::{GitContext, GitRequest, run_git};
use std::path::Path;

/// What:
///  The core finding id and code of a normalization that left nothing to commit.
/// Why:
///   The incumbent reports this exact pair, so the differential compares the same text.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// createCoreFindingEvent({ coreId: 'commit-normalization', code: 'no-change' });
/// ```
pub const NO_CHANGE_CORE_ID: &str = "commit-normalization";
/// The code of the no-change core finding.
pub const NO_CHANGE_CODE: &str = "no-change";
/// The no-change explanation when every selected worktree copy was reconciled without conflict.
pub const NO_CHANGE_MESSAGE: &str = "No commit created: normalization removed every selected change; matching worktree and index copies were reconciled.";

/// What:
///  The native commit invocation the preparation runs in the shadow.
/// Why:
///   The capture, shadow, hooks and Git arguments are fixed before the policies run.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type NativeCommit = { capture; shadowPath; hooks; globalArgs; commitArgs };
/// ```
pub struct NativeCommit<'a> {
    /// The invocation capture the shadow was built from.
    pub capture: &'a InvocationCapture,
    /// The shadow repository the commit is prepared in.
    pub shadow: &'a Path,
    /// Hook directory and silenced events.
    pub hooks: &'a PreparationHooks,
    /// Global options of the invocation.
    pub global_args: &'a [String],
    /// Commit arguments after `commit`.
    pub commit_args: &'a [String],
}

/// What:
///  Everything the commit path's preparation reads and writes.
/// Why:
///   One value keeps the request, the checks, the private index and the native commit together.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PreparationInput = { request; checks; indexPath; objectDirectory; native; journalDirectory; committedPaths };
/// ```
pub struct CommitPreparationInput<'a, F: RepositoryFacts> {
    /// The pre-forward request the passes run under.
    pub request: &'a StageRequest,
    /// The shipped checks whose facts read the private index.
    pub checks: &'a mut ShippedChecks<F>,
    /// Git executable and overlay the writes run with.
    pub context: &'a GitContext,
    /// Repository directory the commands run from.
    pub cwd: &'a Path,
    /// The private commit index.
    pub index: &'a Path,
    /// The object store the private index's blobs live in.
    pub object_directory: &'a Path,
    /// The native commit invocation.
    pub native: NativeCommit<'a>,
    /// The journal directory the prepared record is written to.
    pub journal_directory: &'a Path,
    /// The paths the commit selects.
    pub committed_paths: Vec<String>,
}

/// What:
///  The result of the commit path's preparation.
/// Why:
///   A commit, a no-change normalization and a blocked convergence need different handling by the caller.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PreparationOutcome = { kind: 'prepared' | 'no-change' | 'blocked'; ... };
/// ```
pub enum CommitPreparationOutcome {
    /// A commit was prepared in the shadow.
    Prepared {
        /// The prepared commit.
        commit: PreparedCommit,
        /// Paths the convergence corrected.
        changed_paths: Vec<String>,
    },
    /// The corrections left nothing to commit; the copies were reconciled.
    NoChange {
        /// The events the invocation reports.
        events: Vec<PolicyEvent>,
        /// Paths whose copies were reconciled.
        reconciled: Vec<String>,
    },
    /// The convergence stopped before a commit could be prepared.
    Blocked {
        /// The pass whose events explain the stop.
        pass: PassResult,
    },
}

/// What:
///  Why the commit path's preparation failed outright.
/// Why:
///   Each failure keeps its cause text for the person who ran the command.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class CommitPreparationError extends Error {}
/// ```
#[derive(Debug)]
pub enum CommitPreparationError {
    /// The corrected tree could not be written from the private index.
    Tree(String),
    /// The reconciliation of the copies failed.
    Reconcile(String),
    /// The native commit or its record failed.
    Preparation(PreparationError),
}

/// What:
///  Run the commit path's convergence and decide between a prepared commit and a no-change result.
/// Why:
///   The decision compares the corrected tree with `HEAD`; only a corrected tree equal to `HEAD`
///       with at least one correction is a no-change.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// return intendedTree === headTree && changed.length > 0 ? noChange() : prepare();
/// ```
pub fn prepare_commit_policies<F: RepositoryFacts>(
    input: CommitPreparationInput<'_, F>,
) -> Result<CommitPreparationOutcome, CommitPreparationError> {
    let CommitPreparationInput {
        request,
        checks,
        context,
        cwd,
        index,
        object_directory,
        native,
        journal_directory,
        committed_paths,
    } = input;
    let stage: PrivateStage<'_> = PrivateStage {
        context,
        cwd,
        index,
        object_directory: Some(object_directory),
    };
    let outcome: CommitConvergence = converge_commit_policies(CommitConvergenceInput {
        request,
        checks: &mut *checks,
        stage,
    });
    if !matches!(outcome.convergence, Convergence::Settled { .. }) {
        return Ok(CommitPreparationOutcome::Blocked { pass: outcome.pass });
    }
    let intended_tree: String = match write_private_tree(context, cwd, index, object_directory) {
        Ok(tree) => tree,
        Err(error) => return Err(CommitPreparationError::Tree(error.0)),
    };
    let head_tree: String = head_tree(context, cwd)?;
    if !outcome.changed_paths.is_empty() && intended_tree == head_tree {
        let changes = checks.content.install_changes();
        if let Err(message) = install_corrections(cwd, native.capture.layout.real_index_path.as_path(), changes.as_slice()) {
            return Err(CommitPreparationError::Reconcile(message));
        }
        if let Err(message) = reconcile_index(context, cwd, native.capture.layout.real_index_path.as_path(), changes.as_slice()) {
            return Err(CommitPreparationError::Reconcile(message));
        }
        return Ok(CommitPreparationOutcome::NoChange {
            events: vec![PolicyEvent::CoreFinding {
                core_id: NO_CHANGE_CORE_ID,
                code: NO_CHANGE_CODE,
                message: String::from(NO_CHANGE_MESSAGE),
            }],
            reconciled: outcome.changed_paths,
        });
    }
    let paths: PreparedPaths = PreparedPaths {
        committed_paths,
        ..PreparedPaths::default()
    };
    let commit_arguments: Vec<String> = native.commit_args.to_vec();
    let request_for_shadow: PreparationRequest<'_> = PreparationRequest {
        capture: native.capture,
        shadow: native.shadow,
        hooks: native.hooks,
        commit_index: index,
        global_args: native.global_args,
        commit_args: commit_arguments.as_slice(),
    };
    let commit: PreparedCommit = match prepare_native_commit(
        context,
        cwd,
        &request_for_shadow,
        journal_directory,
        intended_tree.as_str(),
        &paths,
    ) {
        Ok(prepared) => prepared,
        Err(error) => return Err(CommitPreparationError::Preparation(error)),
    };
    return Ok(CommitPreparationOutcome::Prepared {
        commit,
        changed_paths: outcome.changed_paths,
    });
}

/// What:
///  Point each real-index entry at its corrected blob, when the entry still names the uncorrected one.
/// Why:
///   The no-change result promises that the index copies match the corrected worktree copies;
///       an entry that moved since the convergence read it is left alone and reported.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// await git(['update-index', '--cacheinfo', mode, correctedOid, path], { indexPath: realIndex });
/// ```
fn reconcile_index(
    context: &GitContext,
    cwd: &Path,
    real_index: &Path,
    changes: &[InstallChange],
) -> Result<(), String> {
    for change in changes {
        let path: String = String::from_utf8_lossy(change.path.as_slice()).into_owned();
        let before: String = write_real_blob(context, cwd, change.original.as_ref())?;
        let current: String = indexed_blob(context, cwd, real_index, path.as_str())?;
        if current != before {
            return Err(format!("the index entry for {path} changed while the commit was prepared"));
        }
        let after: String = write_real_blob(context, cwd, change.replacement.as_ref())?;
        let mode: &str = git_mode(change.mode);
        let mut request: GitRequest = GitRequest::new(cwd, &["update-index", "--cacheinfo", mode, after.as_str(), path.as_str()]);
        request.without_prefix = true;
        request.index = Some(real_index.to_path_buf());
        let output = match run_git(context, &request) {
            Ok(found) => found,
            Err(error) => return Err(format!("starting git update-index: {error}")),
        };
        if !output.succeeded() {
            return Err(format!("git update-index failed: {}", output.error_text()));
        }
    }
    return Ok(());
}

/// What:
///  Store bytes as a blob in the real object store and return the object ID.
/// Why:
///   The real index must name blobs the real repository holds.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// await git(['hash-object', '-w', '--stdin'], { input: bytes });
/// ```
fn write_real_blob(context: &GitContext, cwd: &Path, bytes: &[u8]) -> Result<String, String> {
    let mut request: GitRequest = GitRequest::new(cwd, &["hash-object", "-w", "--stdin"]);
    request.without_prefix = true;
    request.input = Some(bytes.to_vec());
    let output = match run_git(context, &request) {
        Ok(found) => found,
        Err(error) => return Err(format!("starting git hash-object: {error}")),
    };
    if !output.succeeded() {
        return Err(format!("git hash-object failed: {}", output.error_text()));
    }
    return Ok(String::from_utf8_lossy(output.stdout.as_slice()).trim().to_string());
}

/// What:
///  The blob the real index holds for one path.
/// Why:
///   The reconciliation compares it with the uncorrected blob before it moves the entry.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const [entry] = await git(['ls-files', '-s', '--', path], { indexPath: realIndex });
/// ```
fn indexed_blob(context: &GitContext, cwd: &Path, real_index: &Path, path: &str) -> Result<String, String> {
    let mut request: GitRequest = GitRequest::new(cwd, &["ls-files", "-s", "--", path]);
    request.without_prefix = true;
    request.index = Some(real_index.to_path_buf());
    let output = match run_git(context, &request) {
        Ok(found) => found,
        Err(error) => return Err(format!("starting git ls-files: {error}")),
    };
    if !output.succeeded() {
        return Err(format!("git ls-files failed: {}", output.error_text()));
    }
    let text: String = String::from_utf8_lossy(output.stdout.as_slice()).into_owned();
    let mut fields = text.split_whitespace();
    let _mode = fields.next();
    return Ok(fields.next().unwrap_or_default().to_string());
}

/// What:
///  The tree `HEAD` names, read from the real repository.
/// Why:
///   The no-change decision compares the corrected tree with the tree the commit would replace.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const headTree = await git(['rev-parse', 'HEAD^{tree}']);
/// ```
fn head_tree(context: &GitContext, cwd: &Path) -> Result<String, CommitPreparationError> {
    let mut request: GitRequest = GitRequest::new(cwd, &["rev-parse", "HEAD^{tree}"]);
    request.without_prefix = true;
    let output = match run_git(context, &request) {
        Ok(found) => found,
        Err(error) => return Err(CommitPreparationError::Tree(format!("starting git rev-parse: {error}"))),
    };
    if !output.succeeded() {
        return Err(CommitPreparationError::Tree(output.error_text()));
    }
    return Ok(String::from_utf8_lossy(output.stdout.as_slice()).trim().to_string());
}
