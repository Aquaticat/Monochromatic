//! What:
//!  Running a forwarded index writer under its landing lock:
//!  coordinate,
//!  run real Git as a child
//!       that inherits the landing lease,
//!  release the lock once Git returns.
//! Why:
//!  Replacing the process would drop the lock with the process image,
//!  so a coordinated writer
//!      waits for Git instead.
//!  The nested wrappers Git starts see the lease and do not wait on it
//!      (`src/forward-real-git.ts`).
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! await using coordination = await coordinateIndexWriter({ command, gitPath, timeoutMs });
//! await runGitWithWorktreeCopy({ args, gitPath, environment: coordination.environment });
//! ```

/// Coordination with landings.
use super::index_writer_coordination::{CoordinationFailure, CoordinationInput, coordinate_index_writer};
/// Running real Git as a child and reading its exit status.
use super::forwarding::{ChildOutcome, exit_code, run_real_git};
/// The resolved forwarded command.
use super::forwarded_command::ResolvedCommand;
/// The repository shape the invocation selects.
use super::worktree_identity::WorktreeIdentity;
/// `OsString` is owned operating-system text of raw bytes.
use std::ffi::OsString;
/// `Path` and `PathBuf` are borrowed and owned filesystem paths.
use std::path::{Path, PathBuf};

/// What:
///  Everything a coordinated forward needs,
///  owned,
///  so the planned action can carry it.
/// Why:
///   The plan decides that coordination is needed;
///  the run performs it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type ForwardToRealGit = { realGit: string; args: string[]; overlay: [string, string][]; identity; command; environment; timeoutMs };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CoordinatedForward {
    /// Real Git executable.
    pub real_git: PathBuf,
    /// Arguments Git receives,
    ///  as the caller gave them.
    pub arguments: Vec<OsString>,
    /// Environment variables added to Git's inherited environment.
    pub overlay: Vec<(OsString, OsString)>,
    /// Repository shape of the invocation.
    pub identity: WorktreeIdentity,
    /// The command after alias expansion,
    ///  which decides the coordination.
    pub command: ResolvedCommand,
    /// The environment the invocation inherited,
    ///  which may carry an ancestor's lease.
    pub environment: Vec<(OsString, OsString)>,
    /// `indexLock.unprovenOwnerTimeoutMs`.
    pub timeout_ms: u64,
}

/// What:
///  How a coordinated forward ended.
/// Why:
///   Only a run that was not coordinated may replace the process.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type ForwardOutcome = 'not-coordinated' | { exitCode: number } | { stderr: string; exitCode: number };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CoordinatedRun {
    /// No coordination applies;
    ///  the caller replaces its process with Git.
    NotCoordinated,
    /// Git ran under the landing lock and exited with this status.
    Ran(i32),
    /// The command did not run;
    ///  its standard error and exit status.
    Failed {
        /// Text for standard error.
        stderr: String,
        /// Exit status.
        code: i32,
    },
}

/// What:
///  Coordinate,
///  run Git as a child with the lease,
///  release the lock,
///  and report the status.
/// Why:
///   `forwardToRealGit`:
///  the lock is held until real Git returns.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function forwardToRealGit({ args, gitPath, identity, unprovenOwnerTimeoutMs }): Promise<void>;
/// ```
pub fn run_coordinated_forward(forward: &CoordinatedForward) -> CoordinatedRun {
    // The context runs the coordination's own Git queries with the same overlay as the command.
    let context: crate::transaction_git::GitContext = crate::transaction_git::GitContext {
        real_git: forward.real_git.clone(),
        overlay: forward.overlay.clone(),
        global_prefix: Vec::new(),
    };
    let input: CoordinationInput<'_> = CoordinationInput {
        context: &context,
        identity: &forward.identity,
        command: &forward.command,
        environment: forward.environment.as_slice(),
        timeout_ms: forward.timeout_ms,
    };
    let coordination = match coordinate_index_writer(&input) {
        Ok(Some(held)) => held,
        Ok(None) => return CoordinatedRun::NotCoordinated,
        Err(failure) => return failed_with(&failure),
    };
    let mut child_overlay: Vec<(OsString, OsString)> = forward.overlay.clone();
    child_overlay.push(coordination.lease.clone());
    let outcome: std::io::Result<ChildOutcome> =
        run_real_git(forward.real_git.as_path(), forward.arguments.as_slice(), child_overlay.as_slice());
    let released: Result<(), String> = coordination.release();
    return finish(outcome, released, forward.real_git.as_path());
}

/// What:
///  The run's result once Git returned and the lock was released.
/// Why:
///   Git's status is the answer unless the lock could not be released,
///  which is reported.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// try { return { exitCode } } finally { await coordination[Symbol.asyncDispose](); }
/// ```
fn finish(outcome: std::io::Result<ChildOutcome>, released: Result<(), String>, real_git: &Path) -> CoordinatedRun {
    let child: ChildOutcome = match outcome {
        Ok(found) => found,
        Err(error) => {
            return CoordinatedRun::Failed {
                stderr: format!("cli-git: cannot start {}: {error}\n", real_git.display()),
                code: super::action::ENGINE_FAILURE_EXIT_CODE,
            };
        }
    };
    if let Err(reason) = released {
        return CoordinatedRun::Failed {
            stderr: format!("cli-git: the landing lock could not be released: {reason}\n"),
            code: super::action::ENGINE_FAILURE_EXIT_CODE,
        };
    }
    return CoordinatedRun::Ran(exit_code(child));
}

/// What:
///  The engine failure a refused coordination reports.
/// Why:
///   The unproven owner and read failures each keep their own event.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// renderPolicyEvents([createEngineFailureEvent({ code, message })])
/// ```
fn failed_with(failure: &CoordinationFailure) -> CoordinatedRun {
    return CoordinatedRun::Failed {
        stderr: failure.stderr(),
        code: super::action::ENGINE_FAILURE_EXIT_CODE,
    };
}

/// Coordinated forwarding controls stay out of the release executable.
#[cfg(test)]
#[path = "index_writer_forward_tests.rs"]
mod tests;
