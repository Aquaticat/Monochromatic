//! What:
//!  The call order around a landed commit and around a guarded Git child:
//!       automatic maintenance, then the post-commit lifecycle;
//!       install the signal guard, run the child, release the locks and the transaction, drop the guard, exit with the child's code.
//! Why:
//!  The incumbent runs maintenance after the landing and before post-commit, and releases the transaction
//!       before the signal guard goes away, so a signal during release is still relayed to the child.
//!  The steps are behind traits so the order is a tested fact, not a convention of the call site.
//!  Nothing calls these yet: the command path keeps refusing `git commit` until landing is merged.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! await maintenance(); const result = await postCommit(); // after the landing
//! ```

use super::forwarding::exit_code;
use super::maintenance_run::run_auto_maintenance;
use super::signal_relay::SignalGuard;
use super::transaction_git::GitContext;
use std::path::Path;
use std::process::Command;

/// What:
///  The two steps that run after a landed commit, in the order they run.
/// Why:
///   Maintenance changes the repository the post-commit gate reads, so it runs first.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// interface AfterLanding { maintenance(): Promise<void>; postCommit(): Promise<number>; }
/// ```
pub trait AfterLanding {
    /// Runs automatic maintenance for the landed repository.
    fn maintenance(&mut self) -> Result<(), String>;
    /// Runs the post-commit lifecycle and returns its exit code.
    fn post_commit(&mut self) -> Result<i32, String>;
}

/// What:
///  Run the steps after a landed commit, maintenance first, and return the post-commit exit code.
/// Why:
///   A maintenance failure stops the sequence, because the post-commit gate would read the unmaintained repository.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// await steps.maintenance(); return steps.postCommit();
/// ```
pub fn run_after_landing(steps: &mut dyn AfterLanding) -> Result<i32, String> {
    steps.maintenance()?;
    return steps.post_commit();
}

/// What:
///  The steps that release what a guarded child held, run after the child ends and before the guard drops.
/// Why:
///   Release runs while the guard still relays signals, so a signal sent during release reaches the child.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// interface ReleaseSteps { release(): Promise<void>; }
/// ```
pub trait ReleaseSteps {
    /// Releases the landing lock and removes the transaction.
    fn release(&mut self) -> Result<(), String>;
}

/// What:
///  Run a Git child under the signal guard, release what it held, and report its exit code.
/// Why:
///   The child's outcome is reported even when release fails, but release failures are never silent.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const guard = installSignalGuard(); const outcome = await run(child); await release(); guard.drop(); exit(exitCode(outcome));
/// ```
pub fn run_guarded_child(command: &mut Command, release: &mut dyn ReleaseSteps) -> Result<i32, String> {
    let guard: SignalGuard = match SignalGuard::install() {
        Ok(installed) => installed,
        Err(error) => return Err(format!("installing the signal guard failed: {error}")),
    };
    let outcome = guard.run_child(command);
    let released: Result<(), String> = release.release();
    drop(guard);
    let child = match outcome {
        Ok(found) => found,
        Err(error) => return Err(format!("running the child failed: {error}")),
    };
    if let Err(error) = released {
        return Err(format!("releasing after the child failed: {error}"));
    }
    return Ok(exit_code(child));
}

/// What:
///  The real steps after a landed commit: the maintenance decision and run, then the post-commit lifecycle.
/// Why:
///   The order is enforced by `run_after_landing`; this type only supplies the two calls.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const realSteps: AfterLanding = { maintenance: () => runAutoMaintenance(cwd), postCommit: () => runPostCommit(request) };
/// ```
pub struct LandedRepository<'a> {
    /// Git executable and overlay.
    pub context: &'a GitContext,
    /// Repository directory the maintenance runs in.
    pub cwd: &'a Path,
    /// The post-commit lifecycle, run after the maintenance.
    pub post_commit: &'a mut dyn PostCommitStep,
}

/// What:
///  The post-commit lifecycle as one step, returning its exit code.
/// Why:
///   A named step keeps the real post-commit call out of a closure and lets the order be tested.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// interface PostCommitStep { run(): Promise<number>; }
/// ```
pub trait PostCommitStep {
    /// Runs the post-commit lifecycle and returns its exit code.
    fn run(&mut self) -> Result<i32, String>;
}

impl AfterLanding for LandedRepository<'_> {
    fn maintenance(&mut self) -> Result<(), String> {
        return match run_auto_maintenance(self.context, self.cwd) {
            Ok(_) => Ok(()),
            Err(error) => Err(format!("automatic maintenance failed: {error:?}")),
        };
    }

    fn post_commit(&mut self) -> Result<i32, String> {
        return self.post_commit.run();
    }
}

#[cfg(test)]
#[path = "commit_lifecycle_tests.rs"]
mod tests;
