//! What:
//!  One policy-proposed patch applied to the private commit index with `git apply --cached --3way`.
//! Why:
//!  Corrections land in the private index, never the real one.
//!  A patch that no longer applies is a `patch-conflict` for the transaction, not a silent skip.
//!  The incumbent applies the same command in `applyPrivatePatch`
//!  (`src/policy-engine/commit-transaction-git.ts`).
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! await applyPrivatePatch({ workspace, gitPath, cwd, patch, candidateRevision, ordinal });
//! ```

use super::policy_patch_validate::{PatchCheck, validate_policy_patch};
use super::private_storage::write_exclusive_synced;
use super::transaction_git::{GitContext, GitOutput, GitRequest, run_git};
use std::path::{Path, PathBuf};

/// What:
///  A policy patch proposal for one ordinary text path.
/// Why:
///   The path and bytes are exactly what the policy proposed, and are validated before Git runs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PolicyPatch = { kind: 'git-unified'; targetId: string; path: string; bytes: Uint8Array };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PolicyPatch {
    /// Exact candidate target ID the patch corrects.
    pub target_id: String,
    /// Repository path the patch names.
    pub path: String,
    /// Unified patch bytes.
    pub bytes: Vec<u8>,
}

/// What:
///  Why a policy patch was not applied.
/// Why:
///   The convergence loop maps `Rejected` to a grammar failure and `Conflict` to `patch-conflict`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class PatchApplicationError extends Error {}
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PatchError {
    /// The patch broke the supported grammar; Git never saw it.
    Rejected(String),
    /// Git refused the patch against the private index.
    Conflict(String),
    /// The patch file or the Git process failed.
    Failed(String),
}

/// What:
///  The text of a patch failure.
/// Why:
///   Diagnostics print the reason unchanged.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// error.message;
/// ```
impl std::fmt::Display for PatchError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let message: &String = match self {
            Self::Rejected(message) | Self::Conflict(message) | Self::Failed(message) => message,
        };
        return write!(formatter, "{message}");
    }
}

/// What:
///  Inputs of one private patch application.
/// Why:
///   One object keeps the Git context, the private index and the patch separate at the call site.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PrivatePatchInput = { context; cwd; index; objectDirectory; directory; patch; expectedRevision; ordinal };
/// ```
pub struct PrivatePatchInput<'a> {
    /// Real Git executable and the invocation's overlay.
    pub context: &'a GitContext,
    /// Effective repository directory the patch is applied from.
    pub cwd: &'a Path,
    /// Private commit index receiving the correction.
    pub index: &'a Path,
    /// Object store receiving written blobs; the real store when absent.
    pub object_directory: Option<&'a Path>,
    /// Private transaction directory holding the patch file.
    pub directory: &'a Path,
    /// Patch to apply.
    pub patch: &'a PolicyPatch,
    /// Exact candidate blob revision the patch's index line names as its base.
    pub expected_revision: &'a str,
    /// Position of this patch in the pass, which names its patch file.
    pub ordinal: u32,
}

/// What:
///  Validate a policy patch, write it privately, and apply it to the private index.
/// Why:
///   The patch file is created exclusively with private permissions, so a re-run never overwrites an earlier one.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// validatePolicyPatch({ patch, expectedRevision });
/// await runTransactionGit({ args: ['apply', '--cached', '--3way', patchPath], indexPath });
/// ```
pub fn apply_private_patch(input: PrivatePatchInput<'_>) -> Result<(), PatchError> {
    validate_policy_patch(PatchCheck {
        patch: input.patch,
        expected_revision: input.expected_revision,
    })?;
    let patch_path: PathBuf = input.directory.join(format!("patch-{}.diff", input.ordinal));
    if let Err(error) = write_exclusive_synced(patch_path.as_path(), input.patch.bytes.as_slice()) {
        return Err(PatchError::Failed(format!("writing {}: {error}", patch_path.display())));
    }
    let mut request: GitRequest = GitRequest::new(input.cwd, &["apply", "--cached", "--3way"]);
    request.arguments.push(patch_path.as_os_str().to_owned());
    request.without_prefix = true;
    request.index = Some(input.index.to_path_buf());
    request.object_directory = input.object_directory.map(Path::to_path_buf);
    let output: GitOutput = match run_git(input.context, &request) {
        Ok(found) => found,
        Err(error) => return Err(PatchError::Failed(format!("starting git apply: {error}"))),
    };
    if output.succeeded() {
        return Ok(());
    }
    return Err(PatchError::Conflict(output.error_text()));
}

#[cfg(test)]
#[path = "policy_patch_tests.rs"]
mod tests;
