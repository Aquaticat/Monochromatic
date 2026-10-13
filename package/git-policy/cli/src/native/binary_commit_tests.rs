//! Binary-level controls for `git commit` through the native wrapper:
//!  the transaction lands a commit, applies the policies, reports what blocked it, leaves nothing behind,
//!  and replays or fails a commit that lost a landing race.
//! Every control runs the built executable on a disposable repository with the host's Git.

use super::support::{
    Fixture, Observed, bounded_for, fixture, git, observe, porcelain, remove, repository, run_direct,
    stderr_of, wrapper_first_path,
};
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

/// The bound of one commit under host load, in seconds; the shared 5-second bound is for single Git commands.
const COMMIT_BOUND_SECONDS: &str = "120";

/// Remove the fixture once nothing writes into it any more.
///  A landed commit may leave a maintenance child finishing for a moment under load, and removing a directory that
///  still gains entries fails with "Directory not empty"; the removal is tried again for up to five seconds.
fn remove_settled(fixture: &Fixture) {
    for _ in 0..50 {
        if std::fs::remove_dir_all(&fixture.root).is_ok() || !fixture.root.exists() {
            return;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    remove(fixture);
}

/// A command for the fixture's `bin/git` with the wrapper first on PATH and the commit bound.
fn wrapped_commit(fixture: &Fixture, directory: &Path, arguments: &[&str]) -> Command {
    let mut command: Command = bounded_for(
        fixture,
        fixture.root.join("bin/git").as_path(),
        wrapper_first_path(fixture).as_os_str(),
        COMMIT_BOUND_SECONDS,
    );
    command.current_dir(directory).args(arguments);
    return command;
}

/// Run one wrapped commit command to its end.
fn run_commit(fixture: &Fixture, directory: &Path, arguments: &[&str]) -> Observed {
    return observe(&mut wrapped_commit(fixture, directory, arguments), b"");
}

/// The text of a Git query against the repository.
fn git_text(fixture: &Fixture, repo: &Path, arguments: &[&str]) -> String {
    let output = git(fixture, repo, arguments);
    return String::from_utf8_lossy(output.stdout.as_slice()).into_owned();
}

/// A repository with one tracked file whose worktree copy holds an uncommitted edit.
fn edited_repository(fixture: &Fixture, name: &str) -> PathBuf {
    let repo: PathBuf = repository(fixture, OsStr::new(name));
    std::fs::write(repo.join("a.txt"), b"one\n").expect("a");
    git(fixture, repo.as_path(), &["add", "--", "a.txt"]);
    git(fixture, repo.as_path(), &["commit", "--quiet", "--message=base"]);
    std::fs::write(repo.join("a.txt"), b"one\ntwo\n").expect("edit a");
    return repo;
}

/// What a finished transaction must leave: no transaction directory, no lock, no shadow repository, no `.keep`.
fn assert_nothing_left(fixture: &Fixture, repo: &Path) {
    let git_dir: PathBuf = repo.join(".git");
    let registry: Vec<String> = std::fs::read_dir(git_dir.join("cli-git-transactions"))
        .map(|entries| {
            return entries
                .flatten()
                .map(|entry| { return entry.file_name().to_string_lossy().into_owned(); })
                .collect();
        })
        .unwrap_or_default();
    assert_eq!(registry, Vec::<String>::new(), "no transaction or lock stays in the registry");
    assert!(!git_dir.join("index.lock").exists(), "the real index lock is released");
    let shadows: Vec<String> = std::fs::read_dir(git_dir.join("cli-git/shadow"))
        .map(|entries| {
            return entries
                .flatten()
                .map(|entry| { return entry.file_name().to_string_lossy().into_owned(); })
                .collect();
        })
        .unwrap_or_default();
    assert_eq!(shadows, Vec::<String>::new(), "no shadow repository stays");
    let keeps: String = git_text(fixture, repo, &["count-objects", "-v"]);
    assert!(keeps.contains("garbage: 0"), "{keeps}");
    let pack_directory: PathBuf = git_dir.join("objects/pack");
    let kept: Vec<String> = std::fs::read_dir(pack_directory)
        .map(|entries| {
            return entries
                .flatten()
                .map(|entry| { return entry.file_name().to_string_lossy().into_owned(); })
                .filter(|name| { return name.ends_with(".keep"); })
                .collect();
        })
        .unwrap_or_default();
    assert_eq!(kept, Vec::<String>::new(), "no pack keeps the commit's objects alive");
}

/// An explicit-path commit lands the worktree content of the named path once and leaves nothing behind.
#[test]
fn an_explicit_path_commit_lands_once_and_leaves_nothing() {
    let fixture: Fixture = fixture("commit-explicit");
    let repo: PathBuf = edited_repository(&fixture, "repo");
    let landed: Observed = run_commit(&fixture, repo.as_path(), &["commit", "--message=second", "a.txt"]);
    assert_eq!(landed.code, Some(0), "{}", stderr_of(&landed));
    assert_eq!(git_text(&fixture, repo.as_path(), &["rev-list", "--count", "HEAD"]).trim(), "3");
    assert_eq!(git_text(&fixture, repo.as_path(), &["show", "HEAD:a.txt"]), "one\ntwo\n");
    assert_eq!(git_text(&fixture, repo.as_path(), &["log", "-1", "--format=%s"]).trim(), "second");
    assert_eq!(porcelain(&fixture, repo.as_path()), "");
    assert_nothing_left(&fixture, repo.as_path());
    remove_settled(&fixture);
}

/// A final-newline correction lands in the commit and in the worktree copy, and the summary names the path.
#[test]
fn a_final_newline_correction_lands_in_the_commit_and_the_worktree() {
    let fixture: Fixture = fixture("commit-newline");
    let repo: PathBuf = edited_repository(&fixture, "repo");
    std::fs::write(repo.join("a.txt"), b"one\ntwo").expect("edit without the final newline");
    let landed: Observed = run_commit(&fixture, repo.as_path(), &["commit", "--message=second", "a.txt"]);
    assert_eq!(landed.code, Some(0), "{}", stderr_of(&landed));
    assert_eq!(git_text(&fixture, repo.as_path(), &["show", "HEAD:a.txt"]), "one\ntwo\n");
    assert_eq!(std::fs::read(repo.join("a.txt")).expect("worktree copy"), b"one\ntwo\n");
    assert!(
        stderr_of(&landed).contains("\"type\":\"fix-summary\",\"trigger\":\"pre-forward\",\"passes\":1,\"changedPaths\":[\"a.txt\"]"),
        "{}",
        stderr_of(&landed)
    );
    assert_eq!(porcelain(&fixture, repo.as_path()), "");
    assert_nothing_left(&fixture, repo.as_path());
    remove_settled(&fixture);
}

/// A dry run commits nothing and starts no transaction.
#[test]
fn a_dry_run_commits_nothing() {
    let fixture: Fixture = fixture("commit-dry-run");
    let repo: PathBuf = edited_repository(&fixture, "repo");
    let head: String = git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD"]);
    let dry: Observed = run_commit(&fixture, repo.as_path(), &["commit", "--dry-run", "--message=x", "a.txt"]);
    assert_eq!(dry.code, Some(0), "{}", stderr_of(&dry));
    assert_eq!(git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD"]), head);
    assert!(!repo.join(".git/cli-git").exists(), "a dry run creates no shadow area");
    remove_settled(&fixture);
}

/// `commit -a` commits every tracked change, including a deletion.
#[test]
fn a_commit_of_all_tracked_changes_lands_them() {
    let fixture: Fixture = fixture("commit-all");
    let repo: PathBuf = edited_repository(&fixture, "repo");
    std::fs::write(repo.join("b.txt"), b"b\n").expect("b");
    git(&fixture, repo.as_path(), &["add", "--", "b.txt"]);
    git(&fixture, repo.as_path(), &["commit", "--quiet", "--message=more"]);
    std::fs::remove_file(repo.join("b.txt")).expect("remove b");
    let landed: Observed = run_commit(&fixture, repo.as_path(), &["commit", "-a", "--no-only", "--message=all"]);
    assert_eq!(landed.code, Some(0), "{}", stderr_of(&landed));
    assert_eq!(git_text(&fixture, repo.as_path(), &["show", "HEAD:a.txt"]), "one\ntwo\n");
    assert_eq!(
        git_text(&fixture, repo.as_path(), &["ls-tree", "--name-only", "HEAD"]).trim(),
        "a.txt"
    );
    assert_eq!(porcelain(&fixture, repo.as_path()), "");
    assert_nothing_left(&fixture, repo.as_path());
    remove_settled(&fixture);
}

/// A commit that names no path while commit-only enforcement is active is rejected with exit status 1.
#[test]
fn a_blocking_finding_stops_the_commit_with_status_one() {
    let fixture: Fixture = fixture("commit-blocked");
    let repo: PathBuf = edited_repository(&fixture, "repo");
    git(&fixture, repo.as_path(), &["add", "--", "a.txt"]);
    let head: String = git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD"]);
    let blocked: Observed = run_commit(&fixture, repo.as_path(), &["commit", "--message=x"]);
    assert_eq!(blocked.code, Some(1), "{}", stderr_of(&blocked));
    assert!(stderr_of(&blocked).contains("commit-only/pathspec-required"), "{}", stderr_of(&blocked));
    assert_eq!(git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD"]), head);
    assert_eq!(porcelain(&fixture, repo.as_path()), "M  a.txt\n");
    remove_settled(&fixture);
}

/// A correction that makes the commit identical to its base creates no commit and reconciles the copies.
#[test]
fn a_correction_that_restores_the_base_is_a_no_change_normalization() {
    let fixture: Fixture = fixture("commit-no-change");
    let repo: PathBuf = edited_repository(&fixture, "repo");
    std::fs::write(repo.join("a.txt"), b"one").expect("remove the final newline");
    let head: String = git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD"]);
    let result: Observed = run_commit(&fixture, repo.as_path(), &["commit", "--message=x", "a.txt"]);
    assert_eq!(result.code, Some(1), "{}", stderr_of(&result));
    assert!(
        stderr_of(&result).contains("\"code\":\"commit-normalization/no-change\""),
        "{}",
        stderr_of(&result)
    );
    assert_eq!(git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD"]), head);
    assert_eq!(std::fs::read(repo.join("a.txt")).expect("worktree copy"), b"one\n");
    assert_eq!(porcelain(&fixture, repo.as_path()), "");
    assert_nothing_left(&fixture, repo.as_path());
    remove_settled(&fixture);
}

/// An amend replaces the head commit, and an empty commit lands only with `--allow-empty`.
#[test]
fn an_amend_replaces_the_head_and_an_empty_commit_needs_its_flag() {
    let fixture: Fixture = fixture("commit-amend");
    let repo: PathBuf = edited_repository(&fixture, "repo");
    let amended: Observed = run_commit(
        &fixture,
        repo.as_path(),
        &["commit", "--amend", "--message=amended", "a.txt"],
    );
    assert_eq!(amended.code, Some(0), "{}", stderr_of(&amended));
    assert_eq!(git_text(&fixture, repo.as_path(), &["rev-list", "--count", "HEAD"]).trim(), "2");
    assert_eq!(git_text(&fixture, repo.as_path(), &["log", "-1", "--format=%s"]).trim(), "amended");
    let empty: Observed = run_commit(
        &fixture,
        repo.as_path(),
        &["commit", "--allow-empty", "--no-only", "--message=empty"],
    );
    assert_eq!(empty.code, Some(0), "{}", stderr_of(&empty));
    assert_eq!(git_text(&fixture, repo.as_path(), &["rev-list", "--count", "HEAD"]).trim(), "3");
    assert_nothing_left(&fixture, repo.as_path());
    remove_settled(&fixture);
}

/// An unknown option reaches Git, which refuses it; nothing lands.
#[test]
fn an_unknown_option_is_refused_by_git_and_nothing_lands() {
    let fixture: Fixture = fixture("commit-unknown-option");
    let repo: PathBuf = edited_repository(&fixture, "repo");
    let head: String = git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD"]);
    let refused: Observed = run_commit(&fixture, repo.as_path(), &["commit", "--no-such-option", "a.txt"]);
    let direct: Observed = run_direct(&fixture, repo.as_path(), &["commit", "--no-such-option", "a.txt"]);
    assert_eq!(refused.code, direct.code, "{}", stderr_of(&refused));
    assert_eq!(git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD"]), head);
    remove_settled(&fixture);
}

/// A `pre-commit` hook that fails ends the commit with Git's status and leaves nothing behind.
#[test]
fn a_failing_pre_commit_hook_stops_the_commit_with_its_status() {
    let fixture: Fixture = fixture("commit-hook-fails");
    let repo: PathBuf = edited_repository(&fixture, "repo");
    super::support::executable(
        repo.join(".git/hooks/pre-commit").as_path(),
        b"#!/bin/sh\necho rejected by the hook >&2\nexit 1\n",
    );
    let head: String = git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD"]);
    let rejected: Observed = run_commit(&fixture, repo.as_path(), &["commit", "--message=x", "a.txt"]);
    assert_eq!(rejected.code, Some(1), "{}", stderr_of(&rejected));
    assert!(stderr_of(&rejected).contains("rejected by the hook"), "{}", stderr_of(&rejected));
    assert_eq!(git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD"]), head);
    assert_nothing_left(&fixture, repo.as_path());
    remove_settled(&fixture);
}

/// A `pre-commit` hook that re-stages the file through the wrapper has its change kept in the commit.
#[test]
fn a_pre_commit_hook_restaging_a_file_is_kept() {
    let fixture: Fixture = fixture("commit-hook-restages");
    let repo: PathBuf = edited_repository(&fixture, "repo");
    super::support::executable(
        repo.join(".git/hooks/pre-commit").as_path(),
        b"#!/bin/sh\nprintf 'hooked\\n' >> a.txt\ngit add -- a.txt\n",
    );
    let landed: Observed = run_commit(&fixture, repo.as_path(), &["commit", "--message=second", "a.txt"]);
    assert_eq!(landed.code, Some(0), "{}", stderr_of(&landed));
    assert_eq!(
        git_text(&fixture, repo.as_path(), &["show", "HEAD:a.txt"]),
        "one\ntwo\nhooked\n"
    );
    assert_nothing_left(&fixture, repo.as_path());
    remove_settled(&fixture);
}

/// Waits until a phase marker exists, or fails the control.
fn await_marker(path: &Path) {
    let started: Instant = Instant::now();
    while !path.exists() {
        assert!(started.elapsed() < Duration::from_secs(90), "the marker {} never appeared", path.display());
        std::thread::sleep(Duration::from_millis(20));
    }
}

/// A commit paused after preparation is overtaken by another commit; it replays onto the moved branch and lands.
///  `configuration` is the text of a repository configuration file, when the control needs one.
fn replayed_commit_stderr(name: &str, configuration: Option<&str>) -> String {
    let fixture: Fixture = fixture(name);
    let repo: PathBuf = edited_repository(&fixture, "repo");
    if let Some(text) = configuration {
        std::fs::write(repo.join("cli-git.config.jsonc"), text).expect("repository configuration");
    }
    std::fs::write(repo.join("b.txt"), b"b\n").expect("b");
    git(&fixture, repo.as_path(), &["add", "--", "b.txt"]);
    let markers: PathBuf = fixture.root.join("markers");
    std::fs::create_dir(&markers).expect("marker directory");
    let slow: Child = wrapped_commit(&fixture, repo.as_path(), &["commit", "--message=slow", "a.txt"])
        .env("CLI_GIT_TEST_ONLY_PHASE_SIGNAL", format!("preparation-done:pause:{}", markers.display()))
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .expect("the slow commit starts");
    await_marker(markers.join("preparation-done.reached").as_path());
    let fast: Observed = run_commit(&fixture, repo.as_path(), &["commit", "--message=fast", "b.txt"]);
    assert_eq!(fast.code, Some(0), "{}", stderr_of(&fast));
    std::fs::write(markers.join("preparation-done.release"), b"").expect("release the slow commit");
    let finished = slow.wait_with_output().expect("the slow commit ends");
    let stderr: String = String::from_utf8_lossy(finished.stderr.as_slice()).into_owned();
    assert_eq!(finished.status.code(), Some(0), "{stderr}");
    assert_eq!(git_text(&fixture, repo.as_path(), &["rev-list", "--count", "HEAD"]).trim(), "4");
    assert_eq!(git_text(&fixture, repo.as_path(), &["show", "HEAD:a.txt"]), "one\ntwo\n");
    assert_eq!(git_text(&fixture, repo.as_path(), &["show", "HEAD:b.txt"]), "b\n");
    remove_settled(&fixture);
    return stderr;
}

/// One lost race replays and lands, and under the default threshold also takes the starvation reservation.
#[test]
fn a_commit_that_loses_the_landing_race_replays_and_lands() {
    let stderr: String = replayed_commit_stderr("commit-replay", None);
    assert!(stderr.contains("\"type\":\"landing-race-lost\",\"attempt\":1"), "{stderr}");
    assert!(stderr.contains("\"type\":\"commit-replayed\""), "{stderr}");
    assert!(stderr.contains("\"type\":\"landing-reserved\",\"lostRaces\":1"), "{stderr}");
}

/// With `landing.reserveAfterLostRaces` at 2, one lost race replays without taking the reservation.
#[test]
fn fewer_lost_races_than_configured_take_no_reservation() {
    let stderr: String = replayed_commit_stderr("commit-no-reserve", Some("{ \"landing\": { \"reserveAfterLostRaces\": 2 } }\n"));
    assert!(stderr.contains("\"type\":\"commit-replayed\""), "{stderr}");
    assert!(!stderr.contains("\"type\":\"landing-reserved\""), "{stderr}");
}

/// A commit that overlaps the commit that won fails with `concurrent-commit/replay-conflict`, and nothing lands.
#[test]
fn a_commit_that_overlaps_the_winner_ends_in_a_replay_conflict() {
    let fixture: Fixture = fixture("commit-conflict");
    let repo: PathBuf = edited_repository(&fixture, "repo");
    let markers: PathBuf = fixture.root.join("markers");
    std::fs::create_dir(&markers).expect("marker directory");
    let slow: Child = wrapped_commit(&fixture, repo.as_path(), &["commit", "--message=slow", "a.txt"])
        .env("CLI_GIT_TEST_ONLY_PHASE_SIGNAL", format!("preparation-done:pause:{}", markers.display()))
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .expect("the slow commit starts");
    await_marker(markers.join("preparation-done.reached").as_path());
    // The winner rewrites the same line the slow commit changes, after the slow commit captured its bytes.
    std::fs::write(repo.join("a.txt"), b"other\n").expect("winner edit");
    git(&fixture, repo.as_path(), &["add", "--", "a.txt"]);
    git(&fixture, repo.as_path(), &["commit", "--quiet", "--message=winner"]);
    let winning: String = git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD"]);
    std::fs::write(markers.join("preparation-done.release"), b"").expect("release the slow commit");
    let finished = slow.wait_with_output().expect("the slow commit ends");
    let stderr: String = String::from_utf8_lossy(finished.stderr.as_slice()).into_owned();
    assert_eq!(finished.status.code(), Some(1), "{stderr}");
    assert!(stderr.contains("\"code\":\"concurrent-commit/replay-conflict\""), "{stderr}");
    assert_eq!(git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD"]).trim(), winning.trim());
    remove_settled(&fixture);
}

/// A termination signal sent to the wrapper while a `pre-commit` hook runs ends the hook's Git, leaves no
///  transaction behind, and exits with 128 plus the signal number.
#[test]
fn a_termination_signal_during_a_hook_ends_the_commit_and_leaves_nothing() {
    let fixture: Fixture = fixture("commit-signal");
    let repo: PathBuf = edited_repository(&fixture, "repo");
    let started: PathBuf = fixture.root.join("hook-started");
    super::support::executable(
        repo.join(".git/hooks/pre-commit").as_path(),
        format!("#!/bin/sh\ntouch '{}'\nsleep 60\n", started.display()).as_bytes(),
    );
    let head: String = git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD"]);
    let child: Child = wrapped_commit(&fixture, repo.as_path(), &["commit", "--message=x", "a.txt"])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .expect("the commit starts");
    await_marker(started.as_path());
    let signalled = Command::new("kill")
        .args(["-s", "TERM"])
        .arg(child.id().to_string())
        .status()
        .expect("kill starts");
    assert!(signalled.success());
    let finished = child.wait_with_output().expect("the commit ends");
    assert_eq!(finished.status.code(), Some(143), "{}", String::from_utf8_lossy(finished.stderr.as_slice()));
    assert_eq!(git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD"]), head);
    assert_nothing_left(&fixture, repo.as_path());
    remove_settled(&fixture);
}

/// `git commit --patch` stages the hunks chosen on standard input into the private index, and only those land.
#[test]
fn a_patch_selection_lands_the_chosen_hunk() {
    let fixture: Fixture = fixture("commit-patch");
    let repo: PathBuf = edited_repository(&fixture, "repo");
    let landed: Observed = observe(
        &mut wrapped_commit(&fixture, repo.as_path(), &["commit", "--patch", "--message=chosen"]),
        b"y\n",
    );
    assert_eq!(landed.code, Some(0), "{}", stderr_of(&landed));
    assert_eq!(git_text(&fixture, repo.as_path(), &["show", "HEAD:a.txt"]), "one\ntwo\n");
    assert_eq!(git_text(&fixture, repo.as_path(), &["log", "-1", "--format=%s"]).trim(), "chosen");
    assert_nothing_left(&fixture, repo.as_path());
    remove_settled(&fixture);
}

/// `git commit --interactive` runs the file menu against the private index the same way.
#[test]
fn an_interactive_selection_lands_the_chosen_file() {
    let fixture: Fixture = fixture("commit-interactive");
    let repo: PathBuf = edited_repository(&fixture, "repo");
    let landed: Observed = observe(
        &mut wrapped_commit(&fixture, repo.as_path(), &["commit", "--interactive", "--message=chosen"]),
        b"u\n1\n\nq\n",
    );
    assert_eq!(landed.code, Some(0), "{}{}", stderr_of(&landed), String::from_utf8_lossy(landed.stdout.as_slice()));
    assert_eq!(git_text(&fixture, repo.as_path(), &["show", "HEAD:a.txt"]), "one\ntwo\n");
    assert_nothing_left(&fixture, repo.as_path());
    remove_settled(&fixture);
}

/// With `--allow-empty`, a correction that restores the base still creates the commit the user asked for.
#[test]
fn an_allowed_empty_commit_is_not_a_no_change_normalization() {
    let fixture: Fixture = fixture("commit-allow-empty-normalized");
    let repo: PathBuf = edited_repository(&fixture, "repo");
    std::fs::write(repo.join("a.txt"), b"one").expect("remove the final newline");
    let before: String = git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD^{tree}"]);
    let landed: Observed = run_commit(
        &fixture,
        repo.as_path(),
        &["commit", "--allow-empty", "--message=empty on purpose", "a.txt"],
    );
    assert_eq!(landed.code, Some(0), "{}", stderr_of(&landed));
    assert_eq!(git_text(&fixture, repo.as_path(), &["rev-list", "--count", "HEAD"]).trim(), "3");
    assert_eq!(git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD^{tree}"]), before);
    assert_nothing_left(&fixture, repo.as_path());
    remove_settled(&fixture);
}

/// `--include` commits the named path's worktree content together with what is already staged.
#[test]
fn include_commits_the_named_path_together_with_the_staged_changes() {
    let fixture: Fixture = fixture("commit-include");
    let repo: PathBuf = edited_repository(&fixture, "repo");
    std::fs::write(repo.join("b.txt"), b"b\n").expect("b");
    git(&fixture, repo.as_path(), &["add", "--", "b.txt"]);
    let landed: Observed = run_commit(&fixture, repo.as_path(), &["commit", "--include", "--message=both", "a.txt"]);
    assert_eq!(landed.code, Some(0), "{}", stderr_of(&landed));
    assert_eq!(git_text(&fixture, repo.as_path(), &["show", "HEAD:a.txt"]), "one\ntwo\n");
    assert_eq!(git_text(&fixture, repo.as_path(), &["show", "HEAD:b.txt"]), "b\n");
    assert_nothing_left(&fixture, repo.as_path());
    remove_settled(&fixture);
}

/// `--pathspec-from-file` names the committed paths from a file, and `-` reads them from standard input.
#[test]
fn a_pathspec_file_selects_the_committed_paths() {
    let fixture: Fixture = fixture("commit-pathspec-file");
    let repo: PathBuf = edited_repository(&fixture, "repo");
    std::fs::write(repo.join("b.txt"), b"b\n").expect("b");
    std::fs::write(repo.join("list.txt"), b"a.txt\n").expect("list");
    let landed: Observed = run_commit(&fixture, repo.as_path(), &["commit", "--message=listed", "--pathspec-from-file=list.txt"]);
    assert_eq!(landed.code, Some(0), "{}", stderr_of(&landed));
    assert_eq!(git_text(&fixture, repo.as_path(), &["show", "HEAD:a.txt"]), "one\ntwo\n");
    assert!(!git_text(&fixture, repo.as_path(), &["ls-tree", "--name-only", "HEAD"]).contains("b.txt"));
    std::fs::write(repo.join("a.txt"), b"one\ntwo\nthree\n").expect("edit a again");
    let from_input: Observed = observe(
        &mut wrapped_commit(&fixture, repo.as_path(), &["commit", "--message=piped", "--pathspec-from-file=-"]),
        b"a.txt\n",
    );
    assert_eq!(from_input.code, Some(0), "{}", stderr_of(&from_input));
    assert_eq!(git_text(&fixture, repo.as_path(), &["show", "HEAD:a.txt"]), "one\ntwo\nthree\n");
    assert_eq!(git_text(&fixture, repo.as_path(), &["log", "-1", "--format=%s"]).trim(), "piped");
    assert_nothing_left(&fixture, repo.as_path());
    remove_settled(&fixture);
}
