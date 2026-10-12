//! Controls for the `pre-commit` re-run of a replayed tree.

use super::*;
use crate::test_support::{REAL_GIT, executable, fixture, remove, repository};

/// A context that runs the host's Git.
fn context() -> GitContext {
    return GitContext {
        real_git: PathBuf::from(REAL_GIT),
        overlay: vec![
            (OsString::from("GIT_CONFIG_GLOBAL"), OsString::from("/nonexistent-global-config")),
            (OsString::from("GIT_AUTHOR_NAME"), OsString::from("Fixture")),
            (OsString::from("GIT_AUTHOR_EMAIL"), OsString::from("fixture@example.invalid")),
        ],
        global_prefix: Vec::new(),
    };
}

/// A repository with a hooks directory holding a `pre-commit` hook with this script.
fn with_hook(name: &str, script: &str) -> (PathBuf, PathBuf, PathBuf) {
    let root: PathBuf = fixture(name);
    let repo: PathBuf = repository(root.as_path(), "repo");
    let hooks: PathBuf = root.join("hooks");
    std::fs::create_dir(&hooks).expect("hooks");
    executable(hooks.join("pre-commit").as_path(), script.as_bytes());
    return (root, repo, hooks);
}

/// A hook that succeeds lets the replay go on, and sees the replayed index, no editor and the work tree.
#[test]
fn a_passing_hook_sees_the_replayed_index_and_no_editor() {
    let (root, repo, hooks) = with_hook(
        "revalidation-pass",
        "#!/bin/sh\nprintf '%s|%s|%s' \"$GIT_INDEX_FILE\" \"$GIT_EDITOR\" \"$(pwd -P)\" > hook-saw\n",
    );
    let index: PathBuf = repo.join(".git/replayed.index");
    rerun_pre_commit(&context(), repo.as_path(), &[], repo.join(".git").as_path(), hooks.as_path(), index.as_path())
        .expect("the hook passes");
    let saw: String = std::fs::read_to_string(repo.join("hook-saw")).expect("hook ran");
    assert_eq!(saw, format!("{}|:|{}", index.display(), repo.display()));
    remove(root.as_path());
}

/// A hook that fails rejects the replayed tree with Git's own status.
#[test]
fn a_failing_hook_rejects_the_replay_with_status_one() {
    let (root, repo, hooks) = with_hook("revalidation-fail", "#!/bin/sh\nexit 3\n");
    let outcome = rerun_pre_commit(
        &context(),
        repo.as_path(),
        &[],
        repo.join(".git").as_path(),
        hooks.as_path(),
        repo.join(".git/index").as_path(),
    );
    assert!(matches!(outcome, Err(TransactionStop::NativeExit(1))), "{outcome:?}");
    remove(root.as_path());
}

/// A missing hook is ignored, as `--ignore-missing` says.
#[test]
fn a_missing_hook_passes() {
    let root: PathBuf = fixture("revalidation-missing");
    let repo: PathBuf = repository(root.as_path(), "repo");
    let hooks: PathBuf = root.join("empty-hooks");
    std::fs::create_dir(&hooks).expect("hooks");
    rerun_pre_commit(
        &context(),
        repo.as_path(),
        &[],
        repo.join(".git").as_path(),
        hooks.as_path(),
        repo.join(".git/index").as_path(),
    )
    .expect("no hook, no rejection");
    remove(root.as_path());
}

/// The caller's global options reach Git ahead of the hook command.
#[test]
fn the_callers_global_options_reach_the_hook() {
    let (root, repo, hooks) = with_hook(
        "revalidation-config",
        "#!/bin/sh\ngit config --get fixture.marker > hook-config\n",
    );
    rerun_pre_commit(
        &context(),
        repo.as_path(),
        &[String::from("-c"), String::from("fixture.marker=present")],
        repo.join(".git").as_path(),
        hooks.as_path(),
        repo.join(".git/index").as_path(),
    )
    .expect("the hook passes");
    assert_eq!(std::fs::read_to_string(repo.join("hook-config")).expect("hook ran").trim(), "present");
    remove(root.as_path());
}
