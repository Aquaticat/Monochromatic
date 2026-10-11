//! Controls for the call order around a landed commit and a guarded Git child.

use super::*;

/// Records the order the after-landing steps ran in.
struct Recorder {
    /// Step names in call order.
    order: Vec<&'static str>,
    /// Whether the maintenance step fails.
    maintenance_fails: bool,
    /// The exit code the post-commit step reports.
    code: i32,
}

impl AfterLanding for Recorder {
    fn maintenance(&mut self) -> Result<(), String> {
        self.order.push("maintenance");
        if self.maintenance_fails {
            return Err(String::from("maintenance refused"));
        }
        return Ok(());
    }

    fn post_commit(&mut self) -> Result<i32, String> {
        self.order.push("post-commit");
        return Ok(self.code);
    }
}

/// Counts how often the release step ran, and fails when asked to.
struct Releases {
    /// Number of release calls.
    count: usize,
    /// Whether release fails.
    fails: bool,
}

impl ReleaseSteps for Releases {
    fn release(&mut self) -> Result<(), String> {
        self.count += 1;
        if self.fails {
            return Err(String::from("lock refused"));
        }
        return Ok(());
    }
}

/// Maintenance runs before the post-commit lifecycle, and the post-commit exit code is the result.
#[test]
fn maintenance_runs_before_post_commit() {
    let mut recorder: Recorder = Recorder { order: Vec::new(), maintenance_fails: false, code: 0 };
    assert_eq!(run_after_landing(&mut recorder), Ok(0));
    assert_eq!(recorder.order, vec!["maintenance", "post-commit"]);
}

/// A maintenance failure stops the sequence before the post-commit gate reads the repository.
#[test]
fn a_maintenance_failure_stops_before_post_commit() {
    let mut recorder: Recorder = Recorder { order: Vec::new(), maintenance_fails: true, code: 0 };
    assert_eq!(run_after_landing(&mut recorder), Err(String::from("maintenance refused")));
    assert_eq!(recorder.order, vec!["maintenance"]);
}

/// A post-commit blocked exit code is returned unchanged.
#[test]
fn the_post_commit_exit_code_is_returned() {
    let mut recorder: Recorder = Recorder { order: Vec::new(), maintenance_fails: false, code: 2 };
    assert_eq!(run_after_landing(&mut recorder), Ok(2));
}

/// The guarded child's exit code is returned, and release runs exactly once after the child ended.
#[cfg(unix)]
#[test]
fn the_guarded_child_exit_code_is_returned_after_one_release() {
    let mut releases: Releases = Releases { count: 0, fails: false };
    let mut command: Command = Command::new("/bin/sh");
    command.args(["-c", "exit 3"]);
    assert_eq!(run_guarded_child(&mut command, &mut releases), Ok(3));
    assert_eq!(releases.count, 1);
}

/// A failed release is reported, not hidden behind the child's success.
#[cfg(unix)]
#[test]
fn a_failed_release_is_reported_after_the_child_ends() {
    let mut releases: Releases = Releases { count: 0, fails: true };
    let mut command: Command = Command::new("/bin/sh");
    command.args(["-c", "exit 0"]);
    let outcome: Result<i32, String> = run_guarded_child(&mut command, &mut releases);
    assert!(matches!(&outcome, Err(message) if message.contains("releasing after the child failed")), "{outcome:?}");
    assert_eq!(releases.count, 1);
}
