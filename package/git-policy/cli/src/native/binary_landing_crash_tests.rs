//! What:
//!  A landing in a child process that a phase marker kills or pauses,
//!  and the repository the native wrapper leaves after it.
//! Why:
//!  A landing that dies anywhere inside its critical section must leave a repository that the next
//!  wrapped command recovers to a sane state:
//!  the branch, the real index, the reflogs, the locks and the kept packs all agree
//!  (`src/policy-engine/commit-transaction-test-phase.ts`, `commit-landing.ts`).
//!  A paused child lets a control change the repository between two steps of a landing.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! env.CLI_GIT_TEST_ONLY_PHASE_SIGNAL = 'ref-updated:kill:' + markers;
//! await spawnLandingChild(env); await run(wrappedGit, ['status']);
//! ```

/// The world the child lands in, and the shared fixtures.
use super::landing_support::{Opened, WORLD_VARIABLE, World, git_text, land};
use super::support::{Fixture, TRANSACTION_ID, fixture, git, remove, run_wrapped};
use git_policy_cli::transaction_phase::PHASE_SIGNAL_VARIABLE;
use std::os::unix::process::ExitStatusExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::time::{Duration, Instant};

/// How long a control waits for a child or a marker before it gives up.
const PATIENCE: Duration = Duration::from_secs(120);

/// The child process of the controls below:
///  it opens the world's transaction as its own and lands the prepared commit.
/// The marker variable, set by the parent, kills or pauses it at one phase.
#[test]
#[ignore = "child process of the landing crash controls"]
fn child_lands() {
    let root: PathBuf = PathBuf::from(std::env::var_os(WORLD_VARIABLE).expect("the world to land in"));
    let world: World = World::attach(root.as_path());
    let mut opened: Opened = world.open();
    let result = land(&world, &mut opened, &world.commit_payload());
    let line: String = match &result {
        Ok(outcome) => format!("ok {outcome:?}"),
        Err(error) => format!("error {error}"),
    };
    std::fs::write(root.join("child-result.txt"), format!("{line}\npreserved={}\n", opened.workspace.preserved))
        .expect("the child's result");
}

/// Start the child with a marker armed.
fn spawn_child(world: &World, signal: &str) -> Child {
    let log = std::fs::File::create(world.root.join("child.log")).expect("child log");
    return Command::new(std::env::current_exe().expect("test binary"))
        .args(["--exact", "landing_crash::child_lands", "--ignored", "--nocapture"])
        .env(WORLD_VARIABLE, &world.root)
        .env(PHASE_SIGNAL_VARIABLE, signal)
        .stdin(Stdio::null())
        .stdout(log.try_clone().expect("log handle"))
        .stderr(log)
        .spawn()
        .expect("the child starts");
}

/// Wait for the child to end, killing it when it outlasts the patience.
fn finish(mut child: Child) -> ExitStatus {
    let deadline: Instant = Instant::now() + PATIENCE;
    loop {
        if let Some(status) = child.try_wait().expect("the child can be polled") {
            return status;
        }
        if Instant::now() > deadline {
            child.kill().expect("the stuck child is killed");
            panic!("the landing child outlasted {PATIENCE:?}");
        }
        std::thread::sleep(Duration::from_millis(20));
    }
}

/// Wait for a marker file the child writes when it reaches a phase.
fn await_marker(path: &Path) {
    let deadline: Instant = Instant::now() + PATIENCE;
    while !path.exists() {
        assert!(Instant::now() < deadline, "{} never appeared", path.display());
        std::thread::sleep(Duration::from_millis(20));
    }
}

/// The marker directory of a world.
fn markers(world: &World) -> PathBuf {
    let directory: PathBuf = world.root.join("markers");
    std::fs::create_dir(&directory).expect("marker directory");
    return directory;
}

/// How many reflog subjects of a ref carry this transaction's nonce.
fn nonce_count(fixture: &Fixture, world: &World, reference: &str) -> usize {
    let reflog: String = git_text(fixture, world.repo.as_path(), &["reflog", "show", "--format=%gs", reference]);
    return reflog.matches(format!("commit (cli-git {TRANSACTION_ID}):").as_str()).count();
}

/// Kill the child at a phase, run the native wrapper's `git status`, and check the repository it leaves.
fn crash_at(phase: &str, landed: bool) {
    let fixture: Fixture = fixture(format!("landing-crash-{phase}").as_str());
    let world: World = World::build(&fixture);
    let marker_directory: PathBuf = markers(&world);
    let signal: String = format!("{phase}:kill:{}", marker_directory.display());
    let status: ExitStatus = finish(spawn_child(&world, signal.as_str()));
    assert_eq!(status.signal(), Some(9), "the child died of the kill marker, not of a failure; see child.log");
    assert!(marker_directory.join(format!("{phase}.reached")).exists());
    assert!(world.directory.exists(), "the dead landing left its transaction directory");
    let observed = run_wrapped(&fixture, world.repo.as_path(), &["status", "--porcelain=v1"]);
    assert_eq!(observed.code, Some(0), "{}", String::from_utf8_lossy(&observed.stderr));
    let expected_branch: &str = if landed { world.prepared.as_str() } else { world.base.as_str() };
    assert_eq!(git_text(&fixture, world.repo.as_path(), &["rev-parse", "refs/heads/main"]), expected_branch);
    let expected_tree: &str = if landed { world.prepared_tree.as_str() } else { world.base_tree.as_str() };
    assert_eq!(git_text(&fixture, world.repo.as_path(), &["write-tree"]), expected_tree);
    let expected_status: &str = if landed { "" } else { " M a.txt\n" };
    assert_eq!(String::from_utf8_lossy(&observed.stdout), expected_status);
    let expected_nonces: usize = usize::from(landed);
    assert_eq!(nonce_count(&fixture, &world, "refs/heads/main"), expected_nonces);
    assert_eq!(nonce_count(&fixture, &world, "HEAD"), expected_nonces);
    assert!(!world.index_lock().exists(), "recovery released or consumed the lock");
    assert!(!world.pid_file().exists(), "recovery removed the dead owner's PID file");
    assert!(world.keeps().is_empty(), "recovery removed the transaction's keep: {:?}", world.keeps());
    assert!(!world.directory.exists(), "recovery removed the transaction directory");
    assert!(!world.shadow.exists(), "recovery removed the shadow repository");
    git(&fixture, world.repo.as_path(), &["fsck", "--strict", "--no-dangling"]);
    remove(&fixture);
}

/// A kill with the locks held and nothing journaled beyond the lock record:
///  recovery discards the attempt and releases the lock.
#[test]
fn a_kill_at_landing_locked_is_discarded() {
    crash_at("landing-locked", false);
}

/// A kill after the objects migrated into the kept pack:
///  recovery discards the attempt, removes the keep, and the repository still passes `git fsck`.
#[test]
fn a_kill_at_objects_migrated_is_discarded() {
    crash_at("objects-migrated", false);
}

/// A kill after the branch advanced:
///  recovery completes the landing, installing the recorded index through the dead owner's lock.
#[test]
fn a_kill_at_ref_updated_is_completed() {
    crash_at("ref-updated", true);
}

/// A kill after the index was installed:
///  recovery recognizes the installed index and finishes the cleanup.
#[test]
fn a_kill_at_index_installed_is_completed() {
    crash_at("index-installed", true);
}

/// A target that moves while the landing is paused after its migration loses the compare-and-swap:
///  nothing lands, the keep is removed, the lock is released, the directory is no longer preserved,
///  and the nonce is in no reflog.
#[test]
fn a_target_moved_during_the_landing_loses_the_compare_and_swap() {
    let fixture: Fixture = fixture("landing-swap-lost");
    let world: World = World::build(&fixture);
    let marker_directory: PathBuf = markers(&world);
    let signal: String = format!("objects-migrated:pause:{}", marker_directory.display());
    let child: Child = spawn_child(&world, signal.as_str());
    await_marker(marker_directory.join("objects-migrated.reached").as_path());
    let winner: String = git_text(
        &fixture,
        world.repo.as_path(),
        &["commit-tree", world.base_tree.as_str(), "-p", world.base.as_str(), "-m", "winner"],
    );
    git(&fixture, world.repo.as_path(), &["update-ref", "refs/heads/main", winner.as_str(), world.base.as_str()]);
    std::fs::write(marker_directory.join("objects-migrated.release"), b"").expect("release");
    let status: ExitStatus = finish(child);
    assert!(status.success(), "the child failed; see child.log");
    let result: String = std::fs::read_to_string(world.root.join("child-result.txt")).expect("the child's result");
    assert_eq!(
        result,
        format!("ok HeadMoved {{ current: Commit(\"{winner}\"), replayable: true }}\npreserved=false\n")
    );
    assert_eq!(git_text(&fixture, world.repo.as_path(), &["rev-parse", "refs/heads/main"]), winner);
    assert_eq!(nonce_count(&fixture, &world, "refs/heads/main"), 0);
    assert_eq!(nonce_count(&fixture, &world, "HEAD"), 0);
    assert!(world.keeps().is_empty(), "the lost swap removed the keep: {:?}", world.keeps());
    assert!(!world.index_lock().exists());
    assert!(!world.pid_file().exists());
    assert!(!world.directory.join("ref-updated.json").exists());
    assert!(world.directory.join("landing-1.json").exists(), "the record stays until the caller removes the directory");
    remove(&fixture);
}

/// An install that fails after the branch advanced leaves the real index lock in place for recovery,
///  and the directory preserved.
#[test]
fn an_install_failing_after_the_branch_advanced_leaves_the_lock_for_recovery() {
    let fixture: Fixture = fixture("landing-install-fails");
    let world: World = World::build(&fixture);
    let marker_directory: PathBuf = markers(&world);
    let signal: String = format!("ref-updated:pause:{}", marker_directory.display());
    let child: Child = spawn_child(&world, signal.as_str());
    await_marker(marker_directory.join("ref-updated.reached").as_path());
    std::fs::remove_file(world.directory.join("post-1.index")).expect("remove the recorded post-index");
    std::fs::write(marker_directory.join("ref-updated.release"), b"").expect("release");
    let status: ExitStatus = finish(child);
    assert!(status.success(), "the child failed; see child.log");
    let result: String = std::fs::read_to_string(world.root.join("child-result.txt")).expect("the child's result");
    assert!(result.starts_with("error "), "{result}");
    assert!(result.ends_with("\npreserved=true\n"), "{result}");
    assert!(world.index_lock().exists(), "recovery installs through this lock");
    assert_eq!(git_text(&fixture, world.repo.as_path(), &["rev-parse", "refs/heads/main"]), world.prepared);
    assert_eq!(nonce_count(&fixture, &world, "refs/heads/main"), 1);
    assert!(world.directory.join("ref-updated.json").exists());
    assert!(world.keeps().is_empty(), "the keep was removed once the branch advanced");
    remove(&fixture);
}

/// A malformed marker variable fails the landing at the first phase it reaches,
///  and the lock the landing already took is released.
#[test]
fn a_malformed_marker_fails_the_landing_and_releases_the_lock() {
    let fixture: Fixture = fixture("landing-bad-marker");
    let world: World = World::build(&fixture);
    let status: ExitStatus = finish(spawn_child(&world, "not-a-marker"));
    assert!(status.success(), "the child failed; see child.log");
    let result: String = std::fs::read_to_string(world.root.join("child-result.txt")).expect("the child's result");
    assert!(result.starts_with("error "), "{result}");
    assert!(result.contains(PHASE_SIGNAL_VARIABLE), "{result}");
    assert!(result.ends_with("\npreserved=false\n"), "{result}");
    assert!(!world.index_lock().exists());
    assert!(!world.pid_file().exists());
    assert_eq!(git_text(&fixture, world.repo.as_path(), &["rev-parse", "refs/heads/main"]), world.base);
    remove(&fixture);
}
