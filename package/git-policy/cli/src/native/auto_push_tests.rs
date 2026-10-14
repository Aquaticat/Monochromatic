//! Controls for post-commit auto-push against real repositories, bare remotes and hooks.
//! The TypeScript corpus is `src/auto-push.unit.test.ts`; each case below reproduces one of its cases.

use super::*;
use crate::test_support::{fixture, git, remove};
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// Marker the bare remote's post-receive hook prints, which Git relays as `remote: <marker>`.
const REMOTE_HOOK_MARKER: &str = "marker-from-receive-hook";

/// Environment of every Git child in these fixtures.
fn fixture_environment() -> Vec<(OsString, OsString)> {
    return [
        ("PATH", "/usr/bin:/bin"),
        ("GIT_CONFIG_NOSYSTEM", "1"),
        ("GIT_CONFIG_GLOBAL", "/nonexistent-global-config"),
        ("GIT_AUTHOR_NAME", "Fixture"),
        ("GIT_AUTHOR_EMAIL", "fixture@example.invalid"),
        ("GIT_COMMITTER_NAME", "Fixture"),
        ("GIT_COMMITTER_EMAIL", "fixture@example.invalid"),
    ]
    .iter()
    .map(|(name, value)| {
        return (OsString::from(name), OsString::from(value));
    })
    .collect();
}

/// Coordinator Git for a repository at `root`.
fn push_git(root: &Path) -> PushGit {
    return PushGit {
        real_git: PathBuf::from("/usr/bin/git"),
        cwd: root.to_path_buf(),
        environment: fixture_environment(),
    };
}

/// The OID `HEAD` names in a fixture.
fn head_oid(root: &Path) -> String {
    return String::from_utf8_lossy(&git(root, &["rev-parse", "HEAD"]).stdout)
        .trim()
        .to_owned();
}

/// Create a repository with one commit that changes `tracked.txt`.
fn init_repo_with_commit(path: &Path) {
    std::fs::create_dir_all(path).expect("repo directory");
    git(path, &["init", "--quiet"]);
    git(path, &["config", "user.email", "cli-git@example.invalid"]);
    git(path, &["config", "user.name", "cli-git auto-push test"]);
    std::fs::write(path.join("tracked.txt"), "initial\n").expect("tracked file");
    git(path, &["add", "tracked.txt"]);
    git(path, &["commit", "--quiet", "-m", "initial", "tracked.txt"]);
}

/// Change `tracked.txt` and commit the change.
fn commit_change(path: &Path, text: &str) {
    std::fs::write(path.join("tracked.txt"), text).expect("tracked file");
    git(
        path,
        &["commit", "--quiet", "-m", text.trim(), "tracked.txt"],
    );
}

/// Create a bare remote whose post-receive hook prints the marker.
fn bare_remote_with_hook(remote: &Path) {
    git(
        remote.parent().expect("parent"),
        &["init", "--bare", "--quiet", remote.to_str().expect("utf-8")],
    );
    let hook = remote.join("hooks").join("post-receive");
    std::fs::write(&hook, format!("#!/bin/sh\necho \"{REMOTE_HOOK_MARKER}\"\n")).expect("hook");
    std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).expect("mode");
}

/// Create a repository whose origin is a fresh bare remote and whose pre-push hook logs and exits with `code`.
fn repo_with_remote_and_pre_push(root: &Path, code: i32) -> (PathBuf, PathBuf) {
    let repo = root.join("repo");
    let remote = root.join("remote.git");
    let hooks = root.join("hooks");
    let log = root.join("pre-push.log");
    bare_remote_with_hook(&remote);
    init_repo_with_commit(&repo);
    git(
        &repo,
        &["remote", "add", "origin", remote.to_str().expect("utf-8")],
    );
    std::fs::create_dir_all(&hooks).expect("hooks");
    let hook = hooks.join("pre-push");
    std::fs::write(
        &hook,
        format!(
            "#!/bin/sh\necho pre-push >> '{}'\nexit {code}\n",
            log.display()
        ),
    )
    .expect("pre-push hook");
    std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).expect("mode");
    git(
        &repo,
        &["config", "core.hooksPath", hooks.to_str().expect("utf-8")],
    );
    return (repo, log);
}

/// The pre-push log text, empty when no hook ran.
fn read_log(log: &Path) -> String {
    return std::fs::read_to_string(log).unwrap_or_default();
}

/// Run auto-push and capture the terminal text it prints to `err`.
fn run(repo: &Path, landed: &str) -> (Result<AutoPushResult, SingleFlightError>, String) {
    let mut err: Vec<u8> = Vec::new();
    let result = auto_push(&push_git(repo), landed, &mut err);
    return (result, String::from_utf8_lossy(&err).into_owned());
}

/// Filtering a clean push keeps only the `remote:` lines.
#[test]
fn keeps_only_remote_lines_on_a_clean_push() {
    assert_eq!(
        filter_push_output("remote: hello\nTo origin\nremote: world\nbranch set up", 0),
        "remote: hello\nremote: world"
    );
}

/// A clean push without `remote:` lines surfaces nothing.
#[test]
fn a_clean_push_without_remote_lines_surfaces_nothing() {
    assert_eq!(
        filter_push_output("To origin\nbranch main set up to track origin/main", 0),
        ""
    );
}

/// A failed push surfaces its complete output.
#[test]
fn a_failed_push_surfaces_the_full_output() {
    let output = "remote: rejected\nTo origin\n! [remote rejected] HEAD -> main";
    assert_eq!(filter_push_output(output, 1), output);
}

/// A repository with neither upstream nor origin is skipped silently.
#[test]
fn skips_when_no_origin_remote_exists() {
    let root = fixture("ap-no-origin");
    init_repo_with_commit(&root);
    let (attempted, err) = run(&root, &head_oid(&root));
    let result = attempted.expect("auto-push");
    assert_eq!(result.outcome, AutoPushOutcome::Skipped);
    assert_eq!(result.exit_code, 0);
    assert_eq!(result.shown, "");
    assert_eq!(err, "");
    remove(&root);
}

/// A first push creates the branch on origin, prints only the `remote:` lines and records the upstream.
#[test]
fn pushes_and_surfaces_only_remote_lines_on_success() {
    let root = fixture("ap-success");
    let remote = root.join("remote.git");
    let repo = root.join("repo");
    bare_remote_with_hook(&remote);
    init_repo_with_commit(&repo);
    git(
        &repo,
        &["remote", "add", "origin", remote.to_str().expect("utf-8")],
    );
    let landed = head_oid(&repo);
    let (attempted, err) = run(&repo, &landed);
    let result = attempted.expect("auto-push");
    assert_eq!(result.outcome, AutoPushOutcome::Pushed);
    assert_eq!(result.exit_code, 0);
    assert!(
        result.shown.contains(REMOTE_HOOK_MARKER),
        "{}",
        result.shown
    );
    assert!(
        result
            .shown
            .split('\n')
            .filter(|line| {
                return !line.is_empty();
            })
            .all(|line| {
                return line.starts_with("remote: ");
            }),
        "{}",
        result.shown
    );
    assert_eq!(err, format!("{}\n", result.shown));
    remove(&root);
}

/// A detached HEAD is skipped with the note on stderr and in the result.
#[test]
fn skips_with_a_note_when_head_is_detached() {
    let root = fixture("ap-detached");
    let remote = root.join("remote.git");
    let repo = root.join("repo");
    bare_remote_with_hook(&remote);
    init_repo_with_commit(&repo);
    git(
        &repo,
        &["remote", "add", "origin", remote.to_str().expect("utf-8")],
    );
    git(&repo, &["checkout", "--quiet", "--detach", "HEAD"]);
    let (attempted, err) = run(&repo, &head_oid(&repo));
    let result = attempted.expect("auto-push");
    assert_eq!(result.outcome, AutoPushOutcome::Skipped);
    assert_eq!(result.exit_code, 0);
    assert!(
        result.shown.contains("HEAD is detached"),
        "{}",
        result.shown
    );
    assert!(err.contains("HEAD is detached"), "{err}");
    remove(&root);
}

/// An existing upstream on another remote is pushed to, and origin is never created or used.
#[test]
fn pushes_to_an_existing_upstream_without_re_pointing_it_to_origin() {
    let root = fixture("ap-upstream");
    let repo = root.join("repo");
    let alt = root.join("alt.git");
    bare_remote_with_hook(&alt);
    init_repo_with_commit(&repo);
    git(
        &repo,
        &["remote", "add", "alt", alt.to_str().expect("utf-8")],
    );
    git(&repo, &["push", "--quiet", "--set-upstream", "alt", "HEAD"]);
    commit_change(&repo, "second\n");
    let landed = head_oid(&repo);
    let (attempted, _err) = run(&repo, &landed);
    assert_eq!(
        attempted.expect("auto-push").outcome,
        AutoPushOutcome::Pushed
    );
    let branch = String::from_utf8_lossy(&git(&repo, &["branch", "--show-current"]).stdout)
        .trim()
        .to_owned();
    let tracked = String::from_utf8_lossy(
        &git(&repo, &["config", &format!("branch.{branch}.remote")]).stdout,
    )
    .trim()
    .to_owned();
    assert_eq!(tracked, "alt");
    assert_eq!(
        String::from_utf8_lossy(&git(&alt, &["rev-parse", &branch]).stdout).trim(),
        landed
    );
    remove(&root);
}

/// A rejected push reports failure with its output, exits non-zero and keeps the commit.
#[test]
fn reports_failure_and_surfaces_full_output_when_the_push_is_rejected() {
    let root = fixture("ap-rejected");
    let repo = root.join("repo");
    init_repo_with_commit(&repo);
    git(
        &repo,
        &[
            "remote",
            "add",
            "origin",
            root.join("missing.git").to_str().expect("utf-8"),
        ],
    );
    let (attempted, err) = run(&repo, &head_oid(&repo));
    let result = attempted.expect("auto-push");
    assert_eq!(result.outcome, AutoPushOutcome::Failed);
    assert_ne!(result.exit_code, 0);
    assert!(!result.shown.is_empty());
    assert!(err.contains(PUSH_FAILED_NOTE), "{err}");
    remove(&root);
}

/// Backing up the same commit again joins the recorded push and does not run pre-push.
#[test]
fn joins_the_recorded_push_when_the_same_commit_is_backed_up_again() {
    let root = fixture("ap-join");
    let (repo, log) = repo_with_remote_and_pre_push(&root, 0);
    let landed = head_oid(&repo);
    let first = run(&repo, &landed).0.expect("first");
    let second = run(&repo, &landed).0.expect("second");
    assert_eq!(
        (first.outcome, first.joined),
        (AutoPushOutcome::Pushed, false)
    );
    assert_eq!(
        second,
        AutoPushResult {
            outcome: AutoPushOutcome::Pushed,
            exit_code: 0,
            shown: String::new(),
            joined: true,
        }
    );
    assert_eq!(read_log(&log), "pre-push\n");
    remove(&root);
}

/// A failed pre-push hook is a failed push whose full output is surfaced.
#[test]
fn surfaces_a_failed_pre_push_hook_as_a_failed_push_with_its_full_output() {
    let root = fixture("ap-prepush-fails");
    let (repo, log) = repo_with_remote_and_pre_push(&root, 1);
    let (attempted, _err) = run(&repo, &head_oid(&repo));
    let result = attempted.expect("auto-push");
    assert_eq!(
        (result.outcome, result.joined),
        (AutoPushOutcome::Failed, false)
    );
    assert_ne!(result.exit_code, 0);
    assert!(result.shown.contains("failed to push"), "{}", result.shown);
    assert_eq!(read_log(&log), "pre-push\n");
    remove(&root);
}

/// A coordination failure is a failed push that returns instead of erroring, and no push runs.
#[test]
fn surfaces_a_push_coordination_failure_as_a_failed_push_instead_of_erroring() {
    let root = fixture("ap-coordination");
    let (repo, log) = repo_with_remote_and_pre_push(&root, 0);
    std::fs::create_dir_all(repo.join(".git").join("cli-git")).expect("cli-git");
    std::fs::write(repo.join(".git").join("cli-git").join("push"), "").expect("blocking file");
    let (attempted, err) = run(&repo, &head_oid(&repo));
    let result = attempted.expect("returns the failure");
    assert_eq!(result.outcome, AutoPushOutcome::Failed);
    assert_eq!(result.exit_code, 1);
    assert!(!result.shown.is_empty());
    assert!(err.contains("could not run"), "{err}");
    assert_eq!(read_log(&log), "");
    remove(&root);
}

/// A push that stalls past its deadline is stopped and reported as a failed push,
///  and the push lock is free for the next commit.
#[test]
fn a_stalled_push_is_stopped_and_reported_as_a_failed_push() {
    let root = fixture("ap-stalled");
    let (repo, log) = repo_with_remote_and_pre_push(&root, 0);
    let hooks = root.join("hooks");
    let hook = hooks.join("pre-push");
    std::fs::write(&hook, "#!/bin/sh\necho stalling\nexec sleep 60\n").expect("stalling hook");
    std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).expect("mode");
    let mut git = push_git(&repo);
    git.environment.push((
        OsString::from(crate::bounded_push::PUSH_DEADLINE_VARIABLE),
        OsString::from("1"),
    ));
    let mut err: Vec<u8> = Vec::new();
    let started = std::time::Instant::now();
    let result = auto_push(&git, &head_oid(&repo), &mut err).expect("auto-push");
    let elapsed = started.elapsed();
    let shown = String::from_utf8_lossy(&err).into_owned();
    assert!(elapsed >= Duration::from_secs(1), "{elapsed:?}");
    assert!(elapsed < Duration::from_secs(30), "{elapsed:?}");
    assert_eq!(result.outcome, AutoPushOutcome::Failed);
    assert_eq!(result.exit_code, crate::bounded_push::STOPPED_EXIT_CODE);
    assert!(
        result.shown.contains("did not finish within 1 seconds"),
        "{}",
        result.shown
    );
    assert!(shown.contains(PUSH_FAILED_NOTE), "{shown}");
    assert_eq!(read_log(&log), "", "the replaced hook logs nothing");
    // The failure is recorded and the lock released, so a later commit coordinates normally.
    let lock_directory = std::fs::read_dir(repo.join(".git").join("cli-git").join("push"))
        .expect("coordination directory")
        .map(|entry| return entry.expect("entry").file_name())
        .collect::<Vec<OsString>>();
    assert!(
        !lock_directory
            .iter()
            .any(|name| return name.to_string_lossy().ends_with(".lock")),
        "{lock_directory:?}"
    );
    remove(&root);
}

/// The default environment of an auto-push gives Git's low-speed abort to the push it runs.
#[test]
fn a_push_runs_with_git_s_low_speed_abort_unless_the_person_set_one() {
    let root = fixture("ap-low-speed");
    let (repo, _log) = repo_with_remote_and_pre_push(&root, 0);
    let hook = root.join("hooks").join("pre-push");
    let seen = root.join("seen.txt");
    std::fs::write(
        &hook,
        format!(
            "#!/bin/sh\necho \"$GIT_HTTP_LOW_SPEED_LIMIT $GIT_HTTP_LOW_SPEED_TIME\" > '{}'\n",
            seen.display()
        ),
    )
    .expect("hook");
    std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).expect("mode");
    let (attempted, _err) = run(&repo, &head_oid(&repo));
    assert_eq!(attempted.expect("auto-push").outcome, AutoPushOutcome::Pushed);
    assert_eq!(read_log(&seen), "1000 60\n");
    remove(&root);
}
