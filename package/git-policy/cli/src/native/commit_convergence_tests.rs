//! Controls for the commit path's convergence over a private index:
//!  a final-newline correction lands in the private index,
//!  a second convergence over the settled index changes nothing,
//!  and a correction the index cannot take stops the path as a patch conflict.

use super::*;
use crate::candidate_prediction::CandidateRequest;
use crate::command_test_support::os_arguments;
use crate::config_schema::PolicyConfig;
use crate::policy_checks::shipped_checks;
use crate::policy_content::LifecycleContent;
use crate::policy_engine::StageRequest;
use crate::repository_facts::git_facts;
use crate::test_support::{REAL_GIT, fixture, git, git_context, git_text, remove, repository};
use crate::transaction_git::{GitRequest, run_git};
use crate::wrapper_controls::no_controls;
use std::path::{Path, PathBuf};

/// The private index variable name, as the overlay of every private Git command carries it.
const INDEX_VARIABLE: &str = "GIT_INDEX_FILE";

/// The overlay that points every Git command of the facts at the repository and its private index.
fn overlay(repo: &Path, index: &Path) -> Vec<(OsString, OsString)> {
    return vec![
        (OsString::from("GIT_DIR"), repo.join(".git").into_os_string()),
        (OsString::from("GIT_WORK_TREE"), repo.as_os_str().to_os_string()),
        (OsString::from(INDEX_VARIABLE), index.as_os_str().to_os_string()),
    ];
}

/// A repository whose `HEAD` holds `a.txt` with `base\n`, and whose private index holds `staged` for it.
fn scene(name: &str, staged: &[u8]) -> (PathBuf, PathBuf, PathBuf) {
    let root: PathBuf = fixture(name);
    let repo: PathBuf = repository(root.as_path(), "repo");
    std::fs::write(repo.join("a.txt"), b"base\n").expect("a");
    git(repo.as_path(), &["add", "--", "a.txt"]);
    git(repo.as_path(), &["commit", "--quiet", "--message=base"]);
    let index: PathBuf = root.join("private-index");
    let mut read: GitRequest = GitRequest::new(repo.as_path(), &["read-tree", "HEAD"]);
    read.without_prefix = true;
    read.index = Some(index.clone());
    let output = run_git(&git_context(), &read).expect("read-tree starts");
    assert!(output.succeeded(), "{}", output.error_text());
    let stage: PrivateStage<'_> = PrivateStage {
        context: &git_context(),
        cwd: repo.as_path(),
        index: index.as_path(),
        object_directory: None,
    };
    let entry: Correction = Correction {
        path: b"a.txt".to_vec(),
        mode: crate::candidate_object::CandidateMode::Regular,
        before: std::rc::Rc::from(b"base\n".as_slice()),
        after: std::rc::Rc::from(staged),
    };
    assert_eq!(stage_correction(&stage, &entry), Ok(()), "the staged text is written");
    return (root, repo, index);
}

/// The blob the private index holds for `a.txt`, read through the private index.
fn private_text(repo: &Path, index: &Path) -> String {
    let mut show: GitRequest = GitRequest::new(repo, &["show", ":a.txt"]);
    show.without_prefix = true;
    show.index = Some(index.to_path_buf());
    let output = run_git(&git_context(), &show).expect("show starts");
    assert!(output.succeeded(), "{}", output.error_text());
    return String::from_utf8_lossy(output.stdout.as_slice()).into_owned();
}

/// Runs the commit-path convergence over the index with the shipped policies.
fn converge_index(repo: &Path, index: &Path, object_directory: Option<&Path>) -> CommitConvergence {
    let facts = git_facts(Path::new(REAL_GIT), &[], overlay(repo, index).as_slice());
    let mut checks: ShippedChecks<_> = shipped_checks(
        facts,
        os_arguments(&[]),
        LifecycleContent::Requested(CandidateRequest::Staged(vec![OsString::from("a.txt")])),
        Vec::<PathBuf>::new(),
    );
    let request: StageRequest = StageRequest {
        trigger: Trigger::PreForward,
        config: PolicyConfig::defaults(),
        controls: no_controls(),
        selected: Vec::new(),
    };
    return converge_commit_policies(CommitConvergenceInput {
        request: &request,
        checks: &mut checks,
        stage: PrivateStage {
            context: &git_context(),
            cwd: repo,
            index,
            object_directory,
        },
    });
}

/// The final-newline correction is written into the private index, and the path is reported once.
#[test]
fn the_final_newline_correction_lands_in_the_private_index() {
    let (root, repo, index): (PathBuf, PathBuf, PathBuf) = scene("commit-convergence-newline", b"changed");
    let outcome: CommitConvergence = converge_index(repo.as_path(), index.as_path(), None);
    assert_eq!(outcome.convergence, Convergence::Settled { changed_passes: 1 }, "{:?}", outcome.pass.events);
    assert_eq!(outcome.changed_paths, vec![String::from("a.txt")]);
    assert_eq!(private_text(repo.as_path(), index.as_path()), "changed\n");
    remove(root.as_path());
}

/// Converging a settled private index changes nothing and reports no paths.
#[test]
fn a_settled_private_index_is_left_unchanged() {
    let (root, repo, index): (PathBuf, PathBuf, PathBuf) = scene("commit-convergence-settled", b"already\n");
    let outcome: CommitConvergence = converge_index(repo.as_path(), index.as_path(), None);
    assert_eq!(outcome.convergence, Convergence::Settled { changed_passes: 0 }, "{:?}", outcome.pass.events);
    assert!(outcome.changed_paths.is_empty());
    assert_eq!(private_text(repo.as_path(), index.as_path()), "already\n");
    remove(root.as_path());
}

/// Whether an engine failure event names a patch conflict on the path.
fn names_conflict(events: &[PolicyEvent], path_name: &str) -> bool {
    for event in events {
        if let PolicyEvent::EngineFailure { code: EngineFailureCode::PatchConflict, path: Some(path), .. } = event && path == path_name {
            return true;
        }
    }
    return false;
}

/// A correction whose blob cannot be written stops the path as `patch-conflict`, naming the path.
#[test]
fn a_correction_the_index_cannot_take_is_a_patch_conflict() {
    let (root, repo, index): (PathBuf, PathBuf, PathBuf) = scene("commit-convergence-conflict", b"changed");
    let blocked: PathBuf = root.join("not-a-directory");
    std::fs::write(&blocked, b"a file").expect("blocker");
    let outcome: CommitConvergence = converge_index(repo.as_path(), index.as_path(), Some(blocked.as_path()));
    assert_eq!(outcome.convergence, Convergence::Blocked);
    let coded: bool = names_conflict(outcome.pass.events.as_slice(), "a.txt");
    assert!(coded, "{:?}", outcome.pass.events);
    remove(root.as_path());
}
