//! Controls for the post-index a landing installs, against the then-current real index.

use super::*;
use crate::test_support::{REAL_GIT, fixture, git_context, git_text, remove, repository};
use crate::transaction_journal::TransactionMode;
use std::path::PathBuf;
use std::process::Command;

/// The empty tree of SHA-1 repositories, the base of an unborn target.
const EMPTY_TREE: &str = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

/// Runs real Git against one index file and returns its trimmed standard output.
fn git_with_index(repo: &Path, index: &Path, arguments: &[&str]) -> String {
    let output = Command::new(REAL_GIT)
        .current_dir(repo)
        .env("GIT_INDEX_FILE", index)
        .args(arguments)
        .output()
        .expect("git runs");
    assert!(output.status.success(), "git {arguments:?}: {}", String::from_utf8_lossy(&output.stderr));
    return String::from_utf8(output.stdout).expect("UTF-8").trim_end().to_string();
}

/// Writes `content` into a blob of the repository and returns its object ID.
fn blob(repo: &Path, scratch: &Path, name: &str, content: &str) -> String {
    let file = scratch.join(name);
    std::fs::write(&file, content).expect("blob source");
    return git_text(repo, &["hash-object", "-w", file.to_str().expect("UTF-8 path")]);
}

/// Stages `path` at the blob in a copy of the real index, as a process working on a private index would.
fn stage(repo: &Path, index: &Path, path: &str, blob_oid: &str) {
    let spec: String = format!("100644,{blob_oid},{path}");
    git_with_index(repo, index, &["update-index", "--add", "--cacheinfo", spec.as_str()]);
}

/// Lists the index's stage records, so two indexes compare by content.
fn entries(repo: &Path, index: &Path) -> String {
    return git_with_index(repo, index, &["ls-files", "--stage"]);
}

/// Copies the real index, with `path` staged at `blob_oid` in the copy only.
fn private_index(repo: &Path, scratch: &Path, name: &str, staged: &[(&str, &str)]) -> PathBuf {
    let index = scratch.join(name);
    std::fs::copy(repo.join(".git/index"), &index).expect("index copy");
    for (path, blob_oid) in staged {
        stage(repo, index.as_path(), path, blob_oid);
    }
    return index;
}

/// Everything one post-index test needs, with the landed tree from the private index.
struct Scenario {
    root: PathBuf,
    repo: PathBuf,
    initial: String,
    landed_tree: String,
    landed_index: PathBuf,
    captured_index: PathBuf,
    pre_landing_index: PathBuf,
    post_index: PathBuf,
}

/// Builds a repository whose invocation-time index is captured, then another process stages `other.txt`,
/// while the landing commits `a.txt` with new content from its private index.
fn scenario(name: &str) -> Scenario {
    let root = fixture(name);
    let repo = repository(root.as_path(), "repo");
    let initial = git_text(repo.as_path(), &["rev-parse", "HEAD"]);
    let captured_index = root.join("captured.index");
    std::fs::copy(repo.join(".git/index"), &captured_index).expect("captured index");
    let two = blob(repo.as_path(), root.as_path(), "a-two.txt", "two\n");
    let landed_index = private_index(repo.as_path(), root.as_path(), "landed.index", &[("a.txt", two.as_str())]);
    let landed_tree = git_with_index(repo.as_path(), landed_index.as_path(), &["write-tree"]);
    let other = blob(repo.as_path(), root.as_path(), "other.txt", "other\n");
    let real_index = repo.join(".git/index");
    stage(repo.as_path(), real_index.as_path(), "other.txt", other.as_str());
    let pre_landing_index = root.join("pre-landing.index");
    std::fs::copy(real_index.as_path(), &pre_landing_index).expect("pre-landing copy");
    return Scenario {
        post_index: root.join("post.index"),
        root,
        repo,
        initial,
        landed_tree,
        landed_index,
        captured_index,
        pre_landing_index,
    };
}

/// Runs the post-index computation for one scenario with explicit inputs.
fn compute(scenario: &Scenario, mode: TransactionMode, committed: &[String], guarded: &[String], exact: bool, base: &str) {
    compute_landing_post_index(
        &git_context(),
        scenario.repo.as_path(),
        &PostIndexInput {
            mode,
            pre_landing_index: scenario.pre_landing_index.as_path(),
            captured_index: scenario.captured_index.as_path(),
            landed_index: scenario.landed_index.as_path(),
            post_index: scenario.post_index.as_path(),
            landed_tree: scenario.landed_tree.as_str(),
            base_revision: base,
            committed_paths: committed,
            guarded_paths: guarded,
            exact_private_index: exact,
        },
    )
    .expect("post-index");
}

/// With nothing restaged since invocation, the exact private index becomes the post-index.
#[test]
fn index_mode_exact_private_index_replaces_an_unchanged_real_index() {
    let root = fixture("landing-index-exact");
    let repo = repository(root.as_path(), "repo");
    let captured = root.join("captured.index");
    std::fs::copy(repo.join(".git/index"), &captured).expect("captured index");
    let two = blob(repo.as_path(), root.as_path(), "a-two.txt", "two\n");
    let landed_index = private_index(repo.as_path(), root.as_path(), "landed.index", &[("a.txt", two.as_str())]);
    let landed_tree = git_with_index(repo.as_path(), landed_index.as_path(), &["write-tree"]);
    let scenario = Scenario {
        post_index: root.join("post.index"),
        initial: git_text(repo.as_path(), &["rev-parse", "HEAD"]),
        pre_landing_index: captured.clone(),
        root: root.clone(),
        repo: repo.clone(),
        landed_tree,
        landed_index: landed_index.clone(),
        captured_index: captured,
    };
    compute(&scenario, TransactionMode::Index, &[], &[], true, scenario.initial.clone().as_str());
    assert_eq!(entries(repo.as_path(), scenario.post_index.as_path()), entries(repo.as_path(), landed_index.as_path()));
    remove(&root);
}

/// A path another process staged after invocation survives the landing, next to the landed entry.
#[test]
fn index_mode_keeps_a_path_staged_by_another_process() {
    let scenario = scenario("landing-index-concurrent");
    let base = scenario.initial.clone();
    compute(&scenario, TransactionMode::Index, &[], &[], false, base.as_str());
    let post = entries(scenario.repo.as_path(), scenario.post_index.as_path());
    assert!(post.contains("\ta.txt"), "{post}");
    assert!(post.contains("\tother.txt"), "{post}");
    let landed = entries(scenario.repo.as_path(), scenario.landed_index.as_path());
    let landed_a: Vec<&str> = landed.lines().filter(|line| line.ends_with("\ta.txt")).collect();
    assert!(post.lines().any(|line| line == landed_a[0]));
    remove(&scenario.root);
}

/// An unborn base diffs from the empty tree, so every landed path counts as changed.
#[test]
fn index_mode_with_unborn_base_uses_the_empty_tree() {
    let scenario = scenario("landing-index-unborn");
    compute(&scenario, TransactionMode::Index, &[], &[], false, EMPTY_TREE);
    let post = entries(scenario.repo.as_path(), scenario.post_index.as_path());
    assert!(post.contains("\ta.txt"), "{post}");
    remove(&scenario.root);
}

/// An explicit-path landing resets exactly its committed paths to the landed tree, keeping other staged paths.
#[test]
fn explicit_path_mode_resets_committed_paths_only() {
    let scenario = scenario("landing-index-explicit");
    let base = scenario.initial.clone();
    compute(&scenario, TransactionMode::ExplicitPath, &["a.txt".to_string()], &[], false, base.as_str());
    let post = entries(scenario.repo.as_path(), scenario.post_index.as_path());
    let landed = entries(scenario.repo.as_path(), scenario.landed_index.as_path());
    assert!(landed.lines().any(|line| line.ends_with("\ta.txt")));
    assert!(post.lines().any(|line| line.ends_with("\ta.txt") && landed.lines().any(|l| l == line)), "{post}");
    assert!(post.contains("\tother.txt"), "{post}");
    remove(&scenario.root);
}

/// A guarded path restaged since invocation keeps its staged entry instead of taking the landed one.
#[test]
fn explicit_path_mode_keeps_a_guarded_path_restaged_since_invocation() {
    let scenario = scenario("landing-index-guarded");
    let base = scenario.initial.clone();
    let restaged = blob(scenario.repo.as_path(), scenario.root.as_path(), "restaged.txt", "restaged\n");
    stage(scenario.repo.as_path(), scenario.pre_landing_index.as_path(), "guard.txt", restaged.as_str());
    compute(&scenario, TransactionMode::ExplicitPath, &[], &["guard.txt".to_string()], false, base.as_str());
    let post = entries(scenario.repo.as_path(), scenario.post_index.as_path());
    assert!(post.contains(&format!("{restaged}")), "{post}");
    remove(&scenario.root);
}
