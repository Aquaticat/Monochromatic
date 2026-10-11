//! Controls for post-landing completion: the step order, the failure semantics of each step,
//! and the maintenance exemption from failing the landed commit.

use super::*;
use crate::hook_dispatch_plan::ConfigParameters;
use crate::recovery_landing::tests::Scene;
use crate::test_support::{executable, git_context, git_text};
use std::ffi::OsString;

/// Writes a stand-in Git that logs each invocation, answers `config` with `config_exit`, and otherwise runs real Git.
fn logging_git(root: &std::path::Path, config_exit: u8) -> (PathBuf, PathBuf) {
    let log: PathBuf = root.join("calls.log");
    let path: PathBuf = root.join("git");
    let config_line: String = if config_exit == 0 {
        String::new()
    } else {
        format!("case \" $* \" in *\" config \"*) exit {config_exit};; esac\n")
    };
    let content: String = format!(
        "#!/bin/sh\nprintf '%s\\n' \"$*\" >> '{}'\n{config_line}exec {} \"$@\"\n",
        log.display(),
        crate::test_support::REAL_GIT,
    );
    executable(path.as_path(), content.as_bytes());
    return (path, log);
}

/// A plan whose hook lock sits at `lock`, with the given disabled events.
fn plan(lock: &std::path::Path, disabled: &[&str]) -> HookDispatchPlan {
    return HookDispatchPlan {
        git_path: String::from(crate::test_support::REAL_GIT),
        hooks_path: String::new(),
        disabled_events: disabled
            .iter()
            .map(|name| return String::from(*name))
            .collect(),
        config_parameters: ConfigParameters::Absent,
        worktree_root: String::new(),
        lease: String::new(),
        hook_lock_path: lock.display().to_string(),
        skip_hook_lock: false,
    };
}

/// A landed transaction over a scene, with `HEAD` as the landed commit.
fn landed(scene: &Scene, records: Vec<AddedPath>) -> LandedTransaction {
    return LandedTransaction {
        landed_oid: git_text(scene.repo.as_path(), &["rev-parse", "HEAD"]),
        branch: String::from("main"),
        cwd: scene.repo.clone(),
        repository_root: scene.repo.clone(),
        directory: scene.directory.clone(),
        shadow: scene.shadow.clone(),
        git_dir: scene.git_dir.clone(),
        registry_root: scene.registry.clone(),
        real_index: scene.git_dir.join("index"),
        added_paths: Vec::new(),
        worktree_records: records,
    };
}

/// The command names of the logged invocations, in order, so the test asserts the sequence.
fn sequence(log: &std::path::Path) -> Vec<String> {
    return std::fs::read_to_string(log)
        .unwrap_or_default()
        .lines()
        .map(String::from)
        .collect();
}

/// Position of the first logged invocation containing `needle`.
fn position(lines: &[String], needle: &str) -> Option<usize> {
    return lines.iter().position(|line| return line.contains(needle));
}

/// Every step runs in the incumbent's order: maintenance reads its config, runs, then `post-commit` reads the author and runs its hook.
#[test]
fn completion_runs_maintenance_then_the_hook_after_disposal() {
    let scene: Scene = Scene::new("post-landing-order", false);
    std::fs::create_dir_all(scene.shadow.join("objects")).expect("shadow");
    let (stand_in, log): (PathBuf, PathBuf) = logging_git(scene.root.as_path(), 0);
    let mut context = git_context();
    context.real_git = stand_in;
    context.global_prefix = vec![
        OsString::from("-c"),
        OsString::from("maintenance.autodetach=false"),
    ];
    let lock: PathBuf = scene.git_dir.join("cli-git").join("hook.lock");
    let hook_plan: HookDispatchPlan = plan(lock.as_path(), &[]);
    let transaction: LandedTransaction = landed(&scene, Vec::new());
    let outcome: PostLandingOutcome = complete_landed_transaction(PostLandingRequest {
        context: &context,
        plan: &hook_plan,
        landed: &transaction,
    })
    .expect("completed");
    assert!(!scene.shadow.exists());
    assert!(!scene.directory.exists());
    assert_eq!(outcome.landed_oid, transaction.landed_oid);
    assert_eq!(outcome.maintenance, Some(AutoMaintenanceOutcome::Exited(0)));
    assert_eq!(outcome.hook, PostCommitHookOutcome::Ran(0));
    let lines: Vec<String> = sequence(log.as_path());
    let maintenance: usize =
        position(lines.as_slice(), "maintenance run --auto").expect("maintenance started");
    let show: usize = position(lines.as_slice(), "show --no-patch").expect("author read");
    let hook: usize =
        position(lines.as_slice(), "hook run --ignore-missing post-commit").expect("hook started");
    assert!(maintenance < show && show < hook, "{lines:?}");
    scene.finish();
}

/// A copy that cannot be completed stops the sequence: the shadow and the directory stay for recovery,
/// and neither maintenance nor the hook runs.
#[test]
fn an_install_failure_keeps_the_shadow_and_the_directory() {
    let scene: Scene = Scene::new("post-landing-install-fails", false);
    std::fs::create_dir_all(scene.shadow.join("objects")).expect("shadow");
    let (stand_in, log): (PathBuf, PathBuf) = logging_git(scene.root.as_path(), 0);
    let mut context = git_context();
    context.real_git = stand_in;
    let lock: PathBuf = scene.git_dir.join("cli-git").join("hook.lock");
    let hook_plan: HookDispatchPlan = plan(lock.as_path(), &[]);
    let missing: String = String::from("1111111111111111111111111111111111111111");
    let records: Vec<AddedPath> = vec![AddedPath {
        path: String::from("added.txt"),
        git_mode: String::from("100644"),
        original_oid: missing.clone(),
        intended_oid: missing,
    }];
    let transaction: LandedTransaction = landed(&scene, records);
    let failure: PostLandingError = complete_landed_transaction(PostLandingRequest {
        context: &context,
        plan: &hook_plan,
        landed: &transaction,
    })
    .expect_err("install failure");
    assert!(
        matches!(failure, PostLandingError::Install(_)),
        "{failure:?}"
    );
    assert!(scene.shadow.exists());
    assert!(scene.directory.exists());
    let lines: Vec<String> = sequence(log.as_path());
    assert!(
        position(lines.as_slice(), "maintenance run").is_none(),
        "{lines:?}"
    );
    assert!(
        position(lines.as_slice(), "hook run").is_none(),
        "{lines:?}"
    );
    scene.finish();
}

/// A maintenance config read that fails is logged and never fails the landed commit; the hook still runs.
#[test]
fn a_maintenance_failure_never_fails_the_landed_commit() {
    let scene: Scene = Scene::new("post-landing-maintenance-fails", false);
    std::fs::create_dir_all(scene.shadow.join("objects")).expect("shadow");
    let (stand_in, log): (PathBuf, PathBuf) = logging_git(scene.root.as_path(), 2);
    let mut context = git_context();
    context.real_git = stand_in;
    let lock: PathBuf = scene.git_dir.join("cli-git").join("hook.lock");
    let hook_plan: HookDispatchPlan = plan(lock.as_path(), &[]);
    let transaction: LandedTransaction = landed(&scene, Vec::new());
    let outcome: PostLandingOutcome = complete_landed_transaction(PostLandingRequest {
        context: &context,
        plan: &hook_plan,
        landed: &transaction,
    })
    .expect("completed despite maintenance");
    assert_eq!(outcome.maintenance, Some(AutoMaintenanceOutcome::Exited(2)));
    assert_eq!(outcome.hook, PostCommitHookOutcome::Ran(0));
    let lines: Vec<String> = sequence(log.as_path());
    assert!(
        position(lines.as_slice(), "hook run").is_some(),
        "{lines:?}"
    );
    scene.finish();
}

/// A hook lock that cannot be taken fails after disposal, as the incumbent's thrown error does after its cleanup.
#[test]
fn a_hook_lock_failure_is_reported_after_the_transaction_is_disposed() {
    let scene: Scene = Scene::new("post-landing-lock-fails", false);
    std::fs::create_dir_all(scene.shadow.join("objects")).expect("shadow");
    let (stand_in, _log): (PathBuf, PathBuf) = logging_git(scene.root.as_path(), 0);
    let mut context = git_context();
    context.real_git = stand_in;
    let blocker: PathBuf = scene.git_dir.join("blocker");
    std::fs::write(blocker.as_path(), b"not a directory").expect("blocker");
    let hook_plan: HookDispatchPlan = plan(blocker.join("hook.lock").as_path(), &[]);
    let transaction: LandedTransaction = landed(&scene, Vec::new());
    let failure: PostLandingError = complete_landed_transaction(PostLandingRequest {
        context: &context,
        plan: &hook_plan,
        landed: &transaction,
    })
    .expect_err("lock failure");
    assert!(matches!(failure, PostLandingError::Hook(_)), "{failure:?}");
    assert!(!scene.shadow.exists());
    assert!(!scene.directory.exists());
    scene.finish();
}

/// A disabled `post-commit` leaves the rest of the completion in place and reports the event as disabled.
#[test]
fn a_disabled_post_commit_still_completes_the_rest() {
    let scene: Scene = Scene::new("post-landing-disabled-hook", false);
    std::fs::create_dir_all(scene.shadow.join("objects")).expect("shadow");
    let (stand_in, log): (PathBuf, PathBuf) = logging_git(scene.root.as_path(), 0);
    let mut context = git_context();
    context.real_git = stand_in;
    let lock: PathBuf = scene.git_dir.join("cli-git").join("hook.lock");
    let hook_plan: HookDispatchPlan = plan(lock.as_path(), &["post-commit"]);
    let transaction: LandedTransaction = landed(&scene, Vec::new());
    let outcome: PostLandingOutcome = complete_landed_transaction(PostLandingRequest {
        context: &context,
        plan: &hook_plan,
        landed: &transaction,
    })
    .expect("completed");
    assert_eq!(outcome.hook, PostCommitHookOutcome::Disabled);
    assert!(!scene.directory.exists());
    let lines: Vec<String> = sequence(log.as_path());
    assert!(
        position(lines.as_slice(), "hook run").is_none(),
        "{lines:?}"
    );
    scene.finish();
}
