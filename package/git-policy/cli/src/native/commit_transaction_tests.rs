//! Controls for the commit transaction skeleton on a disposable repository:
//!  the transaction prepares a commit whose tree differs from `HEAD`,
//!  and a worktree-less identity stops before any directory is created.
//!  Every Git command runs with the fixture's `GIT_DIR`, so recovery never reads a real repository.

use super::*;
use crate::candidate_prediction::CandidateRequest;
use crate::capture_invocation::{capture_invocation_base, capture_invocation_layout};
use crate::command_test_support::os_arguments;
use crate::commit_index::IndexSelection;
use crate::config_schema::PolicyConfig;
use crate::policy_checks::shipped_checks;
use crate::policy_content::LifecycleContent;
use crate::policy_engine::StageRequest;
use crate::policy_trigger::Trigger;
use crate::repository_facts::git_facts;
use crate::test_support::{REAL_GIT, fixture, git, git_text, remove, repository};
use crate::transaction_journal::TransactionMode;
use crate::wrapper_controls::no_controls;
use crate::worktree_identity::resolve_worktree_identity;
use std::ffi::OsString;
use std::path::{Path, PathBuf};

/// The overlay every command of one fixture carries: its git directory and its work tree.
fn fixture_context(repo: &Path) -> GitContext {
    return GitContext {
        real_git: PathBuf::from(REAL_GIT),
        overlay: vec![
            (OsString::from("GIT_DIR"), repo.join(".git").into_os_string()),
            (OsString::from("GIT_WORK_TREE"), repo.as_os_str().to_os_string()),
        ],
        global_prefix: Vec::new(),
    };
}

/// A repository whose `a.txt` changed after its one commit, so the transaction has something to commit.
fn changed_repository(root: &Path) -> PathBuf {
    let repo: PathBuf = repository(root, "repo");
    std::fs::write(repo.join("a.txt"), b"a\n").expect("a");
    git(repo.as_path(), &["add", "--", "a.txt"]);
    git(repo.as_path(), &["commit", "--quiet", "--message=base"]);
    std::fs::write(repo.join("a.txt"), b"changed\n").expect("changed a");
    return repo;
}

/// The tree `HEAD` names.
fn head_tree(repo: &Path) -> String {
    return git_text(repo, &["rev-parse", "HEAD^{tree}"]);
}

/// A transaction that commits the selected change prepares a commit whose tree is not `HEAD`'s.
#[test]
fn a_selected_change_prepares_a_commit_outside_head() {
    let root: PathBuf = fixture("transaction-prepares");
    let repo: PathBuf = changed_repository(root.as_path());
    let context: GitContext = fixture_context(repo.as_path());
    let identity: WorktreeIdentity = resolve_worktree_identity(
        Path::new(REAL_GIT),
        &[OsString::from("-C"), repo.as_os_str().to_owned()],
        &[],
    )
    .expect("identity of the fixture");
    let capture = capture_invocation_layout(&context, repo.as_path(), false)
        .and_then(|layout| capture_invocation_base(&context, repo.as_path(), layout))
        .expect("capture of the fixture");
    let registry: PathBuf = root.join("registry");
    let transaction_id: &str = "0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a20";
    let paths: TransactionPaths = transaction_paths(registry.as_path(), &capture.layout.common_dir, transaction_id);
    let facts = git_facts(
        Path::new(REAL_GIT),
        &[],
        &[
            (OsString::from("GIT_DIR"), repo.join(".git").into_os_string()),
            (OsString::from("GIT_WORK_TREE"), repo.as_os_str().to_os_string()),
            (OsString::from("GIT_INDEX_FILE"), paths.commit_index.as_os_str().to_os_string()),
            (OsString::from("GIT_OBJECT_DIRECTORY"), paths.object_directory.as_os_str().to_os_string()),
        ],
    );
    let pathspecs: Vec<String> = vec![String::from("a.txt")];
    let base: String = head_tree(repo.as_path()).to_string();
    let base_commit: String = git_text(repo.as_path(), &["rev-parse", "HEAD"]);
    let mut checks = shipped_checks(
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
    let hooks_directory: PathBuf = root.join("hooks");
    std::fs::create_dir_all(&hooks_directory).expect("hooks directory");
    let hooks: PreparationHooks = PreparationHooks {
        directory: hooks_directory,
        silenced_events: vec![String::from("pre-commit"), String::from("commit-msg")],
    };
    let commit_args: Vec<String> = vec![String::from("-m"), String::from("selected")];
    let outcome = run_commit_transaction(CommitTransactionInput {
        context: &context,
        identity: &identity,
        capture: &capture,
        transaction_id,
        registry_root: registry.as_path(),
        selection: IndexSelection {
            mode: TransactionMode::ExplicitPath,
            pathspecs: pathspecs.as_slice(),
            pathspec_file: None,
            pathspec_file_nul: false,
            stage_into_index: false,
            stage_tracked_changes: false,
            base_revision: base_commit.as_str(),
        },
        request: &request,
        checks: &mut checks,
        hooks: &hooks,
        global_args: &[],
        commit_args: commit_args.as_slice(),
    });
    match outcome {
        Ok(CommitPreparationOutcome::Prepared { commit, .. }) => {
            assert_ne!(commit.tree_oid, base, "the prepared tree carries the selected change");
        }
        other => panic!("expected a prepared commit, got {}", describe(&other)),
    }
    assert_eq!(head_tree(repo.as_path()), base, "the real history is not moved");
    remove(root.as_path());
}

/// A worktree-less identity stops the transaction before it creates the transaction directory.
#[test]
fn a_commit_outside_a_worktree_stops_before_any_directory_is_created() {
    let root: PathBuf = fixture("transaction-outside");
    let repo: PathBuf = changed_repository(root.as_path());
    let context: GitContext = fixture_context(repo.as_path());
    let capture = capture_invocation_layout(&context, repo.as_path(), false)
        .and_then(|layout| capture_invocation_base(&context, repo.as_path(), layout))
        .expect("capture of the fixture");
    let registry: PathBuf = root.join("registry");
    let pathspecs: Vec<String> = vec![String::from("a.txt")];
    let base_commit: String = git_text(repo.as_path(), &["rev-parse", "HEAD"]);
    let request: StageRequest = StageRequest {
        trigger: Trigger::PreForward,
        config: PolicyConfig::defaults(),
        controls: no_controls(),
        selected: Vec::new(),
    };
    let facts = git_facts(Path::new(REAL_GIT), &[], &[]);
    let mut checks = shipped_checks(
        facts,
        os_arguments(&[]),
        LifecycleContent::None,
        Vec::<PathBuf>::new(),
    );
    let hooks: PreparationHooks = PreparationHooks {
        directory: root.join("hooks"),
        silenced_events: Vec::new(),
    };
    let outcome = run_commit_transaction(CommitTransactionInput {
        context: &context,
        identity: &WorktreeIdentity::OutsideWorktree,
        capture: &capture,
        transaction_id: "0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a21",
        registry_root: registry.as_path(),
        selection: IndexSelection {
            mode: TransactionMode::ExplicitPath,
            pathspecs: pathspecs.as_slice(),
            pathspec_file: None,
            pathspec_file_nul: false,
            stage_into_index: false,
            stage_tracked_changes: false,
            base_revision: base_commit.as_str(),
        },
        request: &request,
        checks: &mut checks,
        hooks: &hooks,
        global_args: &[],
        commit_args: &[],
    });
    assert!(matches!(outcome, Err(CommitTransactionError::Recovery(_)) | Err(CommitTransactionError::Setup(_))), "{}", describe(&outcome));
    assert!(!registry.join("transaction-0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a21").exists());
    remove(root.as_path());
}

/// A short description of a transaction outcome, for a failing assertion.
fn describe(outcome: &Result<CommitPreparationOutcome, CommitTransactionError>) -> String {
    return match outcome {
        Ok(_) => String::from("a result"),
        Err(error) => format!("{error:?}"),
    };
}
