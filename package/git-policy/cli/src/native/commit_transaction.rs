//! What:
//!  The commit transaction's skeleton: recovery on start, the shadow repository, the seeded private index,
//!       then the policy preparation.
//! Why:
//!  The incumbent takes the landing lock inside the landing attempt, not during preparation
//!  (`src/policy-engine/commit-landing.ts`, `landTransaction`, `await using _landingLock`).
//!  Holding it through preparation would serialize concurrent commits, so this skeleton never takes it.
//!  Recovery takes what it needs itself, as the incumbent's recovery scan does
//!  (`src/policy-engine/commit-transaction-recovery-scan.ts`).
//!  Nothing calls this yet: the command path keeps refusing `git commit` until landing is merged.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! await recoverOnStart(); const lock = await acquireLanding(); const shadow = await createShadow(); await prepare();
//! ```

use super::capture_invocation::InvocationCapture;
use super::capture_order::CaptureIndexes;
use super::commit_index::{IndexSelection, initialize_commit_index};
use super::commit_policy_preparation::{
    CommitPreparationError, CommitPreparationInput, CommitPreparationOutcome, NativeCommit, prepare_commit_policies,
};
use super::commit_preparation::PreparationHooks;
use super::policy_checks::ShippedChecks;
use super::policy_engine::StageRequest;
use super::repository_facts::RepositoryFacts;
use super::shadow_create::create_shadow_repository;
use super::shadow_git::shadow_repository_path;
use super::transaction_gate::{Gate, recover_for_command};
use super::transaction_git::GitContext;
use super::transaction_registry::ensure_transaction_root;
use super::worktree_identity::{WorktreeIdentity, worktree_root};
use std::path::{Path, PathBuf};

/// What:
///  Everything the commit transaction reads and writes, fixed before the first step.
/// Why:
///   The steps share one identity, capture and selection; passing them together prevents a step from using another invocation's state.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type CommitTransactionInput = { identity; capture; transactionId; registryRoot; selection; request; checks; hooks; ... };
/// ```
pub struct CommitTransactionInput<'a, F: RepositoryFacts> {
    /// Git executable and overlay.
    pub context: &'a GitContext,
    /// Worktree identity recovery is keyed by.
    pub identity: &'a WorktreeIdentity,
    /// Invocation capture the shadow is built from.
    pub capture: &'a InvocationCapture,
    /// Transaction identifier, which names the transaction directory.
    pub transaction_id: &'a str,
    /// Registry root holding every transaction directory.
    pub registry_root: &'a Path,
    /// Index selection the private index is seeded with.
    pub selection: IndexSelection<'a>,
    /// Pre-forward request the policy passes run under.
    pub request: &'a StageRequest,
    /// Shipped checks reading the private index.
    pub checks: &'a mut ShippedChecks<F>,
    /// Hook directory and silenced events for the shadow commit.
    pub hooks: &'a PreparationHooks,
    /// Global options of the invocation.
    pub global_args: &'a [String],
    /// Commit arguments after `commit`.
    pub commit_args: &'a [String],
}

/// What:
///  The names a commit transaction uses on disk, computed before it starts.
/// Why:
///   The policy checks read the private index and object store, so the caller builds them from these paths
///       before the skeleton creates anything.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type TransactionPaths = { directory: string; commitIndex: string; shadow: string; objectDirectory: string };
/// ```
pub struct TransactionPaths {
    /// The transaction directory under the registry root.
    pub directory: PathBuf,
    /// The private commit index inside the directory.
    pub commit_index: PathBuf,
    /// The shadow repository of this transaction.
    pub shadow: PathBuf,
    /// The shadow's object store, which receives the corrected blobs.
    pub object_directory: PathBuf,
}

/// What:
///  The transaction's paths, derived from the registry root, the common directory and the transaction identifier.
/// Why:
///   Both the caller and the skeleton call this, so the policy checks and the skeleton agree on the paths.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// transactionPaths({ registryRoot, commonDir, transactionId });
/// ```
pub fn transaction_paths(registry_root: &Path, common_dir: &Path, transaction_id: &str) -> TransactionPaths {
    let shadow: PathBuf = shadow_repository_path(common_dir, transaction_id);
    let directory: PathBuf = registry_root.join(format!("transaction-{transaction_id}"));
    return TransactionPaths {
        commit_index: directory.join("commit.index"),
        object_directory: shadow.join("objects"),
        shadow,
        directory,
    };
}

/// What:
///  Why the commit transaction stopped before a result.
/// Why:
///   Each failed step keeps its message so the caller names the step that failed.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class CommitTransactionError extends Error {}
/// ```
#[derive(Debug)]
pub enum CommitTransactionError {
    /// Recovery found a live or unrecoverable transaction, or could not run.
    Recovery(String),
    /// The shadow repository, its directory or the seeded index could not be created.
    Setup(String),
    /// The policy preparation failed.
    Preparation(CommitPreparationError),
}

/// What:
///  Run the commit transaction up to the prepared commit.
/// Why:
///   Recovery runs first so a stale transaction never blocks the new one, and the
///       shadow is created after recovery.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// return await runCommitTransaction(input);
/// ```
pub fn run_commit_transaction<F: RepositoryFacts>(
    input: CommitTransactionInput<'_, F>,
) -> Result<CommitPreparationOutcome, CommitTransactionError> {
    recover_first(input.context, input.identity)?;
    return prepare_without_landing_lock(input);
}

/// What:
///  Stop the transaction when recovery leaves a live or stopped transaction behind.
/// Why:
///   A live transaction belongs to another invocation; a stop carries the recovery's own message.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const gate = await recoverOnStart(identity);
/// ```
fn recover_first(context: &GitContext, identity: &WorktreeIdentity) -> Result<(), CommitTransactionError> {
    return match recover_for_command(context, identity) {
        Gate::Clear => Ok(()),
        Gate::Live(path) => Err(CommitTransactionError::Recovery(format!(
            "a live commit transaction is at {}",
            path.display()
        ))),
        Gate::Stop(stderr) => Err(CommitTransactionError::Recovery(stderr)),
    };
}

/// What:
///  Create the shadow, seed the private index and prepare the commit, without the landing lock.
/// Why:
///   The shadow and the index live in the transaction directory, so a failure removes nothing outside it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const shadow = await createShadow(capture, transactionId); await seedIndex(selection); return prepare();
/// ```
fn prepare_without_landing_lock<F: RepositoryFacts>(
    input: CommitTransactionInput<'_, F>,
) -> Result<CommitPreparationOutcome, CommitTransactionError> {
    let Some(top_level) = worktree_root(input.identity) else {
        return Err(CommitTransactionError::Setup(String::from("the commit runs outside a worktree")));
    };
    let paths: TransactionPaths = transaction_paths(input.registry_root, &input.capture.layout.common_dir, input.transaction_id);
    let transaction: PathBuf = paths.directory.clone();
    if let Err(error) = ensure_transaction_root(input.registry_root) {
        return Err(CommitTransactionError::Setup(error.0));
    }
    if let Err(error) = std::fs::create_dir_all(transaction.as_path()) {
        return Err(CommitTransactionError::Setup(format!("creating {} failed: {error}", transaction.display())));
    }
    let shadow: PathBuf = match create_shadow_repository(
        input.context,
        top_level,
        input.capture,
        input.transaction_id,
        transaction.as_path(),
    ) {
        Ok(path) => path,
        Err(failure) => return Err(CommitTransactionError::Setup(failure.0)),
    };
    let indexes: CaptureIndexes = CaptureIndexes {
        captured_index: transaction.join("captured.index"),
        commit_index: paths.commit_index.clone(),
        object_directory: paths.object_directory.clone(),
    };
    if let Err(failure) = initialize_commit_index(
        input.context,
        top_level,
        input.capture.layout.real_index_path.as_path(),
        &indexes,
        &input.selection,
    ) {
        return Err(CommitTransactionError::Setup(failure.0));
    }
    let committed_paths: Vec<String> = input.selection.pathspecs.to_vec();
    let prepared = prepare_commit_policies(CommitPreparationInput {
        request: input.request,
        checks: input.checks,
        context: input.context,
        cwd: top_level,
        index: indexes.commit_index.as_path(),
        object_directory: indexes.object_directory.as_path(),
        native: NativeCommit {
            capture: input.capture,
            shadow: shadow.as_path(),
            hooks: input.hooks,
            global_args: input.global_args,
            commit_args: input.commit_args,
        },
        journal_directory: transaction.as_path(),
        committed_paths,
    });
    return match prepared {
        Ok(outcome) => Ok(outcome),
        Err(error) => Err(CommitTransactionError::Preparation(error)),
    };
}

#[cfg(test)]
#[path = "commit_transaction_tests.rs"]
mod tests;
