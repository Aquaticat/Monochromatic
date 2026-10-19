//! Controls for publishing a landed commit that a moved remote branch rejected, against real repositories and bare
//! remotes. Issue 1769: both histories reach the remote and the active worktree stays byte-identical.

use super::*;
use crate::auto_push::{AutoPushOutcome, AutoPushResult, PUSH_FAILED_NOTE, auto_push};
use crate::auto_push_single_flight::PushGit;
use crate::test_support::{fixture, git, remove};
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

/// A bare remote, the repository under test, and a second clone that stands for another worktree's work.
struct Scenario {
    /// Fixture root, removed when the test ends.
    root: PathBuf,
    /// The bare remote named `origin`.
    remote: PathBuf,
    /// The repository whose commit is published.
    local: PathBuf,
    /// A clone that advances the remote.
    other: PathBuf,
}

/// Environment of every Git child of the coordinator in these fixtures.
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

/// The text Git printed for a read-only query, trimmed.
fn text_of(directory: &Path, arguments: &[&str]) -> String {
    return String::from_utf8_lossy(&git(directory, arguments).stdout)
        .trim()
        .to_owned();
}

/// Create the remote with `a.txt` and `b.txt`, the repository under test and the other clone.
fn scenario(name: &str) -> Scenario {
    let root = fixture(name);
    let remote = root.join("remote.git");
    let seed = root.join("seed");
    git(
        &root,
        &[
            "init",
            "--bare",
            "--quiet",
            "--initial-branch=main",
            "remote.git",
        ],
    );
    git(&root, &["init", "--quiet", "--initial-branch=main", "seed"]);
    std::fs::write(seed.join("a.txt"), "base\n").expect("a.txt");
    std::fs::write(seed.join("b.txt"), "base\n").expect("b.txt");
    git(&seed, &["add", "a.txt", "b.txt"]);
    git(&seed, &["commit", "--quiet", "-m", "seed"]);
    git(
        &seed,
        &["remote", "add", "origin", remote.to_str().expect("utf-8")],
    );
    git(
        &seed,
        &["push", "--quiet", "--set-upstream", "origin", "main"],
    );
    git(
        &root,
        &["clone", "--quiet", remote.to_str().expect("utf-8"), "local"],
    );
    git(
        &root,
        &["clone", "--quiet", remote.to_str().expect("utf-8"), "other"],
    );
    return Scenario {
        local: root.join("local"),
        other: root.join("other"),
        remote,
        root,
    };
}

/// Change one file in the other clone, commit it and publish it.
fn advance_remote(scenario: &Scenario, file: &str, text: &str) {
    git(&scenario.other, &["fetch", "--quiet", "origin"]);
    git(
        &scenario.other,
        &["merge", "--quiet", "--ff-only", "origin/main"],
    );
    std::fs::write(scenario.other.join(file), text).expect("remote change");
    git(&scenario.other, &["add", file]);
    git(
        &scenario.other,
        &["commit", "--quiet", "-m", &format!("remote {file}")],
    );
    git(&scenario.other, &["push", "--quiet", "origin", "main"]);
}

/// Change one file in the repository under test and commit only that file.
fn commit_local(scenario: &Scenario, file: &str, text: &str) -> String {
    std::fs::write(scenario.local.join(file), text).expect("local change");
    git(
        &scenario.local,
        &[
            "commit",
            "--quiet",
            "-m",
            &format!("local {file}"),
            "--",
            file,
        ],
    );
    return text_of(&scenario.local, &["rev-parse", "HEAD"]);
}

/// Run auto-push in the repository under test and capture the text it prints.
fn run(scenario: &Scenario, landed: &str) -> (AutoPushResult, String) {
    let mut err: Vec<u8> = Vec::new();
    let result = auto_push(&push_git(&scenario.local), landed, &mut err).expect("auto-push");
    return (result, String::from_utf8_lossy(&err).into_owned());
}

/// What a consumer of the worktree can observe: the status, the bytes of two files and the index file.
fn worktree_snapshot(local: &Path) -> (String, Vec<u8>, Vec<u8>, Vec<u8>) {
    return (
        text_of(local, &["status", "--porcelain=v1"]),
        std::fs::read(local.join("a.txt")).expect("a.txt"),
        std::fs::read(local.join("scratch.txt")).expect("scratch.txt"),
        std::fs::read(local.join(".git").join("index")).expect("index"),
    );
}

/// Install a hook in the repository under test that advances the remote each time the reconcile creates its private
/// fetch ref, while the count is at most `limit`: the push that follows then finds a remote that moved again.
fn advancing_hook(scenario: &Scenario, limit: u32) -> PathBuf {
    let hooks = scenario.root.join("hooks");
    let counter = scenario.root.join("counter");
    std::fs::create_dir_all(&hooks).expect("hooks");
    let hook = hooks.join("reference-transaction");
    let script = format!(
        "#!/bin/sh\n[ \"$1\" = committed ] || exit 0\ngrep -E '^0{{40}} [0-9a-f]{{40}} refs/cli-git/auto-push/' | grep -Evq '^0{{40}} 0{{40}} ' || exit 0\ncount=$(cat '{counter}' 2>/dev/null || echo 0)\ncount=$((count + 1))\necho $count > '{counter}'\n\
         if [ $count -le {limit} ]; then\n\
         unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE\n\
         git -C '{other}' fetch --quiet origin\n\
         git -C '{other}' merge --quiet --ff-only origin/main\n\
         echo $count > \"{other}/advance-$count.txt\"\n\
         git -C '{other}' add .\n\
         git -C '{other}' commit --quiet -m advance-$count\n\
         git -C '{other}' push --quiet origin main\n\
         fi\nexit 0\n",
        counter = counter.display(),
        other = scenario.other.display(),
    );
    std::fs::write(&hook, script).expect("hook");
    std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).expect("mode");
    git(
        &scenario.local,
        &["config", "core.hooksPath", hooks.to_str().expect("utf-8")],
    );
    return counter;
}

/// How many times the pre-push hook ran.
fn hook_runs(counter: &Path) -> u32 {
    return std::fs::read_to_string(counter)
        .expect("counter")
        .trim()
        .parse()
        .expect("number");
}

/// Both histories reach the remote as one merge above the landed commit, and the worktree is not touched.
#[test]
fn a_divergent_branch_is_published_as_a_merge_and_the_worktree_is_not_touched() {
    let s = scenario("ar-merge");
    advance_remote(&s, "a.txt", "remote\n");
    let remote_before = text_of(&s.remote, &["rev-parse", "main"]);
    // The path the remote changed is dirty in this checkout, and an untracked file sits beside it.
    std::fs::write(s.local.join("a.txt"), "dirty-local\n").expect("dirty file");
    std::fs::write(s.local.join("scratch.txt"), "scratch\n").expect("untracked file");
    let landed = commit_local(&s, "b.txt", "local\n");
    let before = worktree_snapshot(&s.local);
    let (result, err) = run(&s, &landed);
    assert_eq!(
        (result.outcome, result.exit_code),
        (AutoPushOutcome::Pushed, 0),
        "{err}"
    );
    let published = text_of(&s.remote, &["rev-parse", "main"]);
    assert_eq!(
        text_of(
            &s.remote,
            &["rev-list", "--parents", "--max-count=1", "main"]
        ),
        format!("{published} {landed} {remote_before}")
    );
    assert_eq!(text_of(&s.remote, &["show", "main:a.txt"]), "remote");
    assert_eq!(text_of(&s.remote, &["show", "main:b.txt"]), "local");
    assert_eq!(
        text_of(&s.local, &["rev-parse", "HEAD"]),
        landed,
        "the local branch moved"
    );
    assert_eq!(
        worktree_snapshot(&s.local),
        before,
        "the worktree, the index or an untracked file changed"
    );
    assert_eq!(
        text_of(&s.local, &["for-each-ref", "refs/cli-git"]),
        "",
        "the private fetch ref remains"
    );
    assert!(err.contains(RECONCILE_LINE_PREFIX), "{err}");
    assert!(err.contains(&published), "{err}");
    assert!(!err.contains(PUSH_FAILED_NOTE), "{err}");
    remove(&s.root);
}

/// A conflicting merge publishes nothing, names the paths and does not recommend a push that cannot work.
#[test]
fn a_conflicting_merge_is_kept_unpublished_with_the_conflicting_paths() {
    let s = scenario("ar-conflict");
    advance_remote(&s, "a.txt", "remote\n");
    let remote_before = text_of(&s.remote, &["rev-parse", "main"]);
    let landed = commit_local(&s, "a.txt", "local\n");
    let (result, err) = run(&s, &landed);
    assert_eq!(result.outcome, AutoPushOutcome::Failed, "{err}");
    assert_ne!(result.exit_code, 0);
    assert_eq!(text_of(&s.remote, &["rev-parse", "main"]), remote_before);
    assert!(err.contains(RECONCILE_FAILED_PREFIX), "{err}");
    assert!(err.contains("conflicts in: a.txt"), "{err}");
    assert!(!err.contains(PUSH_FAILED_NOTE), "{err}");
    assert_eq!(text_of(&s.local, &["for-each-ref", "refs/cli-git"]), "");
    remove(&s.root);
}

/// An amended published commit is never merged: the replaced commit would come back, so the rejection stays.
#[test]
fn an_amended_published_commit_keeps_its_rejection() {
    let s = scenario("ar-amend");
    let first = commit_local(&s, "b.txt", "first\n");
    let (published, _) = run(&s, &first);
    assert_eq!(published.outcome, AutoPushOutcome::Pushed);
    advance_remote(&s, "a.txt", "remote\n");
    let remote_before = text_of(&s.remote, &["rev-parse", "main"]);
    git(
        &s.local,
        &["commit", "--quiet", "--amend", "-m", "amended", "b.txt"],
    );
    let amended = text_of(&s.local, &["rev-parse", "HEAD"]);
    let (result, err) = run(&s, &amended);
    assert_eq!(result.outcome, AutoPushOutcome::Failed, "{err}");
    assert_eq!(text_of(&s.remote, &["rev-parse", "main"]), remote_before);
    assert!(err.contains("[rejected]"), "{err}");
    assert!(err.contains(PUSH_FAILED_NOTE), "{err}");
    assert!(!err.contains(RECONCILE_LINE_PREFIX), "{err}");
    remove(&s.root);
}

/// A remote that moves again during the push is fetched and merged again, within the bound.
#[test]
fn a_remote_that_moves_again_is_merged_again() {
    let s = scenario("ar-retry");
    advance_remote(&s, "a.txt", "remote\n");
    let counter = advancing_hook(&s, 2);
    let landed = commit_local(&s, "b.txt", "local\n");
    let (result, err) = run(&s, &landed);
    assert_eq!(
        (result.outcome, result.exit_code),
        (AutoPushOutcome::Pushed, 0),
        "{err}"
    );
    // The remote moved after each of the first two fetches; the merge made after the third fetch was accepted.
    assert_eq!(hook_runs(&counter), 3);
    assert_eq!(text_of(&s.remote, &["show", "main:advance-1.txt"]), "1");
    assert_eq!(text_of(&s.remote, &["show", "main:advance-2.txt"]), "2");
    assert_eq!(text_of(&s.remote, &["show", "main:b.txt"]), "local");
    assert_eq!(
        text_of(&s.remote, &["merge-base", "--is-ancestor", &landed, "main"]).len(),
        0
    );
    remove(&s.root);
}

/// A remote that never settles ends after the bound with the reason, and nothing newer than the rejection is pushed.
#[test]
fn a_remote_that_never_settles_is_reported_after_the_bound() {
    let s = scenario("ar-exhausted");
    advance_remote(&s, "a.txt", "remote\n");
    let counter = advancing_hook(&s, 100);
    let landed = commit_local(&s, "b.txt", "local\n");
    let (result, err) = run(&s, &landed);
    assert_eq!(result.outcome, AutoPushOutcome::Failed, "{err}");
    assert_ne!(result.exit_code, 0);
    // One fetch per attempt, and the remote moved after each.
    assert_eq!(hook_runs(&counter), MAX_RECONCILE_ATTEMPTS);
    assert!(err.contains(RECONCILE_FAILED_PREFIX), "{err}");
    assert!(
        err.contains(&format!("during each of {MAX_RECONCILE_ATTEMPTS} attempts")),
        "{err}"
    );
    assert!(!err.contains(PUSH_FAILED_NOTE), "{err}");
    assert_eq!(text_of(&s.local, &["for-each-ref", "refs/cli-git"]), "");
    remove(&s.root);
}

/// A commit that the remote already contains is reported as delivered, without a push.
#[test]
fn a_commit_the_remote_already_contains_is_reported_as_delivered() {
    let s = scenario("ar-contained");
    let landed = commit_local(&s, "b.txt", "local\n");
    git(&s.local, &["push", "--quiet", "origin", "main"]);
    advance_remote(&s, "a.txt", "remote\n");
    let remote_before = text_of(&s.remote, &["rev-parse", "main"]);
    let (result, err) = run(&s, &landed);
    assert_eq!(
        (result.outcome, result.exit_code),
        (AutoPushOutcome::Pushed, 0),
        "{err}"
    );
    assert_eq!(text_of(&s.remote, &["rev-parse", "main"]), remote_before);
    assert!(err.contains("already contains"), "{err}");
    remove(&s.root);
}

/// A push destination other than the upstream is not reconciled: the tracked tip is the wrong thing to merge.
#[test]
fn a_push_remote_other_than_the_upstream_is_not_reconciled() {
    let s = scenario("ar-push-remote");
    git(
        &s.local,
        &["remote", "add", "mirror", s.remote.to_str().expect("utf-8")],
    );
    git(&s.local, &["config", "branch.main.pushRemote", "mirror"]);
    advance_remote(&s, "a.txt", "remote\n");
    let remote_before = text_of(&s.remote, &["rev-parse", "main"]);
    let landed = commit_local(&s, "b.txt", "local\n");
    let (result, err) = run(&s, &landed);
    assert_eq!(result.outcome, AutoPushOutcome::Failed, "{err}");
    assert_eq!(text_of(&s.remote, &["rev-parse", "main"]), remote_before);
    assert!(err.contains(PUSH_FAILED_NOTE), "{err}");
    assert!(!err.contains(RECONCILE_LINE_PREFIX), "{err}");
    remove(&s.root);
}

/// A remote that cannot be fetched leaves the rejection explained and nothing pushed.
#[test]
fn a_remote_that_cannot_be_fetched_is_reported_without_a_push() {
    let s = scenario("ar-fetch-fails");
    git(
        &s.local,
        &[
            "config",
            "remote.origin.pushurl",
            s.remote.to_str().expect("utf-8"),
        ],
    );
    git(
        &s.local,
        &[
            "config",
            "remote.origin.url",
            s.root.join("missing.git").to_str().expect("utf-8"),
        ],
    );
    advance_remote(&s, "a.txt", "remote\n");
    let remote_before = text_of(&s.remote, &["rev-parse", "main"]);
    let landed = commit_local(&s, "b.txt", "local\n");
    let (result, err) = run(&s, &landed);
    assert_eq!(result.outcome, AutoPushOutcome::Failed, "{err}");
    assert_ne!(result.exit_code, 0);
    assert_eq!(text_of(&s.remote, &["rev-parse", "main"]), remote_before);
    assert!(err.contains("fetching them failed"), "{err}");
    assert!(!err.contains(PUSH_FAILED_NOTE), "{err}");
    remove(&s.root);
}

/// Only a stale-update refusal is reconciled; any other failed push is returned as it came.
#[test]
fn a_failure_that_is_not_a_stale_update_is_returned_unchanged() {
    let s = scenario("ar-other-failure");
    let refused = PushAttempt {
        exit_code: 1,
        output: "remote: error: hook declined".to_owned(),
    };
    assert!(!was_rejected_as_stale(&refused.output));
    assert!(was_rejected_as_stale(
        " ! [rejected]        main -> main (non-fast-forward)"
    ));
    assert_eq!(
        reconcile_divergent_push(&push_git(&s.local), "refs/heads/main", refused.clone())
            .expect("reconcile"),
        refused
    );
    let stale = PushAttempt {
        exit_code: 1,
        output: " ! [rejected] v1 -> v1".to_owned(),
    };
    assert_eq!(
        reconcile_divergent_push(&push_git(&s.local), "refs/tags/v1", stale.clone())
            .expect("reconcile"),
        stale,
        "a ref that is not a branch has no upstream to merge"
    );
    remove(&s.root);
}

#[test]
fn an_unpublished_attempt_never_reports_success_and_keeps_a_real_exit_code() {
    let from_zero = unpublished("before", 0, "reason");
    assert_eq!(from_zero.exit_code, 1, "a failure must not carry exit code zero");
    assert_eq!(
        from_zero.output,
        format!("before\n{RECONCILE_FAILED_PREFIX}reason")
    );
    assert_eq!(unpublished("before", 128, "reason").exit_code, 128);
}

/// The destination the reconcile would fetch from, as `remote merge_ref`, or nothing.
fn destination_of(scenario: &Scenario, branch_ref: &str) -> Option<String> {
    return read_destination(&push_git(&scenario.local), branch_ref)
        .expect("destination")
        .map(|destination| {
            return format!("{} {}", destination.remote, destination.merge_ref);
        });
}

/// The branch that tracks its own remote branch is the one case that is reconciled.
#[test]
fn a_branch_that_pushes_to_its_upstream_has_that_destination() {
    let s = scenario("ar-dest-upstream");
    assert_eq!(
        destination_of(&s, "refs/heads/main").as_deref(),
        Some("origin refs/heads/main")
    );
    remove(&s.root);
}

/// A branch without an upstream, or named outside `refs/heads`, has no destination to fetch from.
#[test]
fn a_branch_without_an_upstream_or_outside_the_heads_has_no_destination() {
    let s = scenario("ar-dest-none");
    git(&s.local, &["branch", "--quiet", "loose"]);
    assert_eq!(destination_of(&s, "refs/heads/loose"), None);
    assert_eq!(destination_of(&s, "refs/tags/main"), None);
    remove(&s.root);
}

/// A push remote other than the upstream's remote would publish somewhere this module did not fetch.
#[test]
fn a_push_remote_that_differs_from_the_upstream_has_no_destination() {
    let s = scenario("ar-dest-pushremote");
    git(
        &s.local,
        &["remote", "add", "mirror", s.remote.to_str().expect("utf-8")],
    );
    git(&s.local, &["fetch", "--quiet", "mirror"]);
    git(&s.local, &["config", "branch.main.pushRemote", "mirror"]);
    assert_eq!(destination_of(&s, "refs/heads/main"), None);
    remove(&s.root);
}

/// A branch that tracks a local branch has the remote `.`, which is never fetched from.
#[test]
fn a_branch_that_tracks_a_local_branch_has_no_destination() {
    let s = scenario("ar-dest-dot");
    git(&s.local, &["branch", "--quiet", "--track", "topic", "main"]);
    git(&s.local, &["config", "push.default", "upstream"]);
    assert_eq!(
        text_of(&s.local, &["rev-parse", "--symbolic-full-name", "topic@{push}"]),
        "refs/heads/main",
        "the push query must agree with the upstream, or the remote check is not what decides"
    );
    assert_eq!(destination_of(&s, "refs/heads/topic"), None);
    remove(&s.root);
}

/// An upstream outside `refs/heads` cannot be fetched into a private ref by branch name.
#[test]
fn an_upstream_outside_the_heads_has_no_destination() {
    let s = scenario("ar-dest-namespace");
    git(
        &s.local,
        &[
            "config",
            "--add",
            "remote.origin.fetch",
            "+refs/notes/*:refs/remotes/origin/notes/*",
        ],
    );
    git(&s.local, &["update-ref", "refs/remotes/origin/notes/x", "HEAD"]);
    git(&s.local, &["config", "branch.main.merge", "refs/notes/x"]);
    assert_eq!(destination_of(&s, "refs/heads/main"), None);
    remove(&s.root);
}

/// The base a branch must descend from is the last recorded push, not the tracking ref, when a push was recorded.
#[test]
fn the_recorded_push_is_the_base_even_when_the_tracking_ref_differs() {
    let s = scenario("ar-base-record");
    let seed = text_of(&s.local, &["rev-parse", "HEAD"]);
    let first = commit_local(&s, "b.txt", "first\n");
    let (published, err) = run(&s, &first);
    assert_eq!(published.outcome, AutoPushOutcome::Pushed, "{err}");
    git(
        &s.local,
        &["update-ref", "refs/remotes/origin/main", seed.as_str()],
    );
    assert_eq!(
        published_base(&push_git(&s.local), "refs/heads/main").expect("base"),
        first
    );
    remove(&s.root);
}

/// Without a recorded push, the base is the tracking ref.
#[test]
fn the_tracking_ref_is_the_base_when_no_push_was_recorded() {
    let s = scenario("ar-base-upstream");
    let seed = text_of(&s.local, &["rev-parse", "HEAD"]);
    commit_local(&s, "b.txt", "unpublished\n");
    assert_eq!(
        published_base(&push_git(&s.local), "refs/heads/main").expect("base"),
        seed
    );
    remove(&s.root);
}

/// A rejection while the remote is behind the branch was not a divergence, so it is returned as it came.
#[test]
fn a_rejection_while_the_remote_is_behind_is_returned_unchanged() {
    let s = scenario("ar-behind");
    let remote_before = text_of(&s.remote, &["rev-parse", "main"]);
    commit_local(&s, "b.txt", "local\n");
    let rejected = PushAttempt {
        exit_code: 1,
        output: " ! [rejected]        main -> main (fetch first)".to_owned(),
    };
    let returned = reconcile_divergent_push(&push_git(&s.local), "refs/heads/main", rejected.clone())
        .expect("reconcile");
    assert_eq!(returned, rejected);
    assert_eq!(text_of(&s.remote, &["rev-parse", "main"]), remote_before);
    assert_eq!(text_of(&s.local, &["for-each-ref", "refs/cli-git"]), "");
    remove(&s.root);
}

/// Histories that share no commit cannot be merged by `merge-tree`, and that is a Git failure, not a conflict.
#[test]
fn unrelated_histories_are_a_git_failure_not_a_conflict() {
    let s = scenario("ar-unrelated");
    git(&s.local, &["checkout", "--quiet", "--orphan", "island"]);
    git(&s.local, &["commit", "--quiet", "--allow-empty", "-m", "island"]);
    let island = text_of(&s.local, &["rev-parse", "HEAD"]);
    let main = text_of(&s.local, &["rev-parse", "main"]);
    let outcome = commit_merge(&push_git(&s.local), &island, &main, "message");
    assert!(
        matches!(outcome, Err(SingleFlightError::Git { .. })),
        "{outcome:?}"
    );
    remove(&s.root);
}

/// Make the repository under test sign commits with a stand-in `gpg` that exits `status`: it reads the payload,
/// answers the status line Git waits for and prints a placeholder signature, so no key or keyring is involved.
fn sign_commits_with_stand_in(scenario: &Scenario, status: u32) {
    let program = scenario.root.join("stand-in-gpg");
    let script = format!(
        "#!/bin/sh\ncat > /dev/null\n[ {status} -eq 0 ] || exit {status}\necho '[GNUPG:] SIG_CREATED ' >&2\nprintf -- '-----BEGIN PGP SIGNATURE-----\\n\\nplaceholder\\n-----END PGP SIGNATURE-----\\n'\n"
    );
    std::fs::write(&program, script).expect("stand-in gpg");
    std::fs::set_permissions(&program, std::fs::Permissions::from_mode(0o755)).expect("mode");
    git(
        &scenario.local,
        &["config", "gpg.program", program.to_str().expect("utf-8")],
    );
    git(&scenario.local, &["config", "commit.gpgsign", "true"]);
}

/// Whether the commit `oid` of the remote carries a signature header.
fn is_signed(scenario: &Scenario, oid: &str) -> bool {
    return text_of(&scenario.remote, &["cat-file", "commit", oid]).contains("\ngpgsig ");
}

/// A repository that signs its commits publishes a signed merge, so a remote that requires verified signatures
/// accepts it; `git commit-tree` does not read `commit.gpgsign` by itself.
#[test]
fn the_merge_is_signed_when_the_repository_signs_commits() {
    let s = scenario("ar-signed");
    advance_remote(&s, "a.txt", "remote\n");
    let landed = commit_local(&s, "b.txt", "local\n");
    sign_commits_with_stand_in(&s, 0);
    let (result, err) = run(&s, &landed);
    assert_eq!(
        (result.outcome, result.exit_code),
        (AutoPushOutcome::Pushed, 0),
        "{err}"
    );
    let published = text_of(&s.remote, &["rev-parse", "main"]);
    assert!(is_signed(&s, &published), "the merge is unsigned");
    remove(&s.root);
}

/// A repository that does not sign its commits gets an unsigned merge, and no signer is run.
#[test]
fn the_merge_is_unsigned_when_the_repository_does_not_sign_commits() {
    let s = scenario("ar-unsigned");
    advance_remote(&s, "a.txt", "remote\n");
    let landed = commit_local(&s, "b.txt", "local\n");
    sign_commits_with_stand_in(&s, 1);
    git(&s.local, &["config", "commit.gpgsign", "false"]);
    let (result, err) = run(&s, &landed);
    assert_eq!(
        (result.outcome, result.exit_code),
        (AutoPushOutcome::Pushed, 0),
        "{err}"
    );
    let published = text_of(&s.remote, &["rev-parse", "main"]);
    assert!(!is_signed(&s, &published), "the merge is signed");
    remove(&s.root);
}

/// A signer that fails leaves the merge uncreated and the failure visible, never an unsigned merge in its place.
#[test]
fn a_failing_signer_publishes_nothing() {
    let s = scenario("ar-signer-fails");
    advance_remote(&s, "a.txt", "remote\n");
    let landed = commit_local(&s, "b.txt", "local\n");
    sign_commits_with_stand_in(&s, 1);
    let remote_before = text_of(&s.remote, &["rev-parse", "main"]);
    let (result, err) = run(&s, &landed);
    assert_ne!(result.outcome, AutoPushOutcome::Pushed, "{err}");
    assert_ne!(result.exit_code, 0, "{err}");
    assert_eq!(text_of(&s.remote, &["rev-parse", "main"]), remote_before);
    assert_eq!(text_of(&s.local, &["for-each-ref", "refs/cli-git"]), "");
    remove(&s.root);
}
