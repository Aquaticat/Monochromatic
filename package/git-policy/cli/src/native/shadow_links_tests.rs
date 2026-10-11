//! Controls for the shadow links: shared entries link, private entries never do.

use super::*;
use crate::test_support::{fixture, git, remove, repository};

/// Shared entries of a plain repository become links to the real entries,
///  and private entries stay absent from the shadow.
#[test]
fn shared_entries_link_and_private_entries_stay_absent() {
    let root: PathBuf = fixture("shadow-links-plain");
    let repo: PathBuf = repository(root.as_path(), "repo");
    let common: PathBuf = repo.join(".git");
    std::fs::create_dir(root.join("shadow")).expect("shadow");
    let shadow: PathBuf = root.join("shadow");
    std::fs::write(common.join("index"), b"index").expect("index");
    std::fs::write(common.join("MERGE_HEAD"), b"x").expect("merge");
    std::fs::write(common.join("index.lock"), b"x").expect("lock");
    link_shadow_entries(shadow.as_path(), common.as_path(), common.as_path()).expect("link");
    assert_eq!(
        std::fs::read_link(shadow.join("hooks")).expect("hooks link"),
        common.join("hooks")
    );
    assert_eq!(
        std::fs::read_link(shadow.join("info")).expect("info link"),
        common.join("info")
    );
    assert!(std::fs::symlink_metadata(shadow.join("index")).is_err());
    assert!(std::fs::symlink_metadata(shadow.join("MERGE_HEAD")).is_err());
    assert!(std::fs::symlink_metadata(shadow.join("index.lock")).is_err());
    assert!(std::fs::symlink_metadata(shadow.join("refs")).is_err());
    remove(root.as_path());
}

/// A linked worktree keeps its `info` private, links the shared entries inside it,
///  and copies its own sparse checkout and `config.worktree`.
#[test]
fn linked_worktree_copies_its_per_worktree_entries() {
    let root: PathBuf = fixture("shadow-links-linked");
    let repo: PathBuf = repository(root.as_path(), "repo");
    let linked: PathBuf = root.join("linked");
    git(
        repo.as_path(),
        &["worktree", "add", "--quiet", "-b", "feature", linked.to_str().expect("fixture")],
    );
    let common: PathBuf = repo.join(".git");
    let git_dir: PathBuf = common.join("worktrees").join("linked");
    std::fs::create_dir_all(git_dir.join("info")).expect("worktree info");
    std::fs::write(git_dir.join("info").join("sparse-checkout"), "/*\n").expect("sparse");
    std::fs::write(git_dir.join("config.worktree"), "[core]\n\tbare = false\n").expect("config");
    let shadow: PathBuf = root.join("shadow");
    std::fs::create_dir(&shadow).expect("shadow");
    link_shadow_entries(shadow.as_path(), common.as_path(), git_dir.as_path()).expect("link");
    let shadow_info: PathBuf = shadow.join("info");
    assert!(std::fs::symlink_metadata(&shadow_info).expect("info").is_dir());
    assert_eq!(
        std::fs::read_link(shadow_info.join("exclude")).expect("exclude link"),
        common.join("info").join("exclude")
    );
    assert_eq!(
        std::fs::read_to_string(shadow_info.join("sparse-checkout")).expect("sparse copy"),
        "/*\n"
    );
    assert!(std::fs::symlink_metadata(shadow.join("info").join("sparse-checkout"))
        .expect("copy")
        .is_file());
    assert_eq!(
        std::fs::read_to_string(shadow.join("config.worktree")).expect("config copy"),
        "[core]\n\tbare = false\n"
    );
    remove(root.as_path());
}

/// The private-entry list names every conclusion entry, the sequencer, and lock files.
#[test]
fn private_names_cover_conclusion_state_and_locks() {
    for name in ["HEAD", "refs", "index", "MERGE_HEAD", "sequencer", "cli-git", "ORIG_HEAD.lock"] {
        assert!(is_private_shadow_entry(name), "{name}");
    }
    for name in ["hooks", "info", "rr-cache", "description", "logs-not"] {
        assert!(!is_private_shadow_entry(name), "{name}");
    }
}

/// The private `info` directory of a linked worktree is private to the account.
#[cfg(unix)]
#[test]
fn private_info_directory_is_private() {
    use std::os::unix::fs::PermissionsExt;
    let root: PathBuf = fixture("shadow-links-info-mode");
    let repo: PathBuf = repository(root.as_path(), "repo");
    let linked: PathBuf = root.join("linked");
    git(repo.as_path(), &["worktree", "add", "--quiet", "-b", "feature", linked.to_str().expect("fixture")]);
    let common: PathBuf = repo.join(".git");
    let git_dir: PathBuf = common.join("worktrees").join("linked");
    std::fs::create_dir_all(git_dir.join("info")).expect("worktree info");
    std::fs::write(git_dir.join("info").join("sparse-checkout"), "/*\n").expect("sparse");
    let shadow: PathBuf = root.join("shadow");
    std::fs::create_dir(&shadow).expect("shadow");
    link_shadow_entries(shadow.as_path(), common.as_path(), git_dir.as_path()).expect("link");
    let mode: u32 = std::fs::metadata(shadow.join("info")).expect("info").permissions().mode() & 0o777;
    assert_eq!(mode, 0o700);
    remove(root.as_path());
}

/// A linked worktree whose common directory has no shared `info` directory still links,
///  with its own sparse checkout copied in.
#[test]
fn linked_worktree_without_a_shared_info_directory_still_links() {
    let root: PathBuf = fixture("shadow-links-no-info");
    let repo: PathBuf = repository(root.as_path(), "repo");
    let linked: PathBuf = root.join("linked");
    git(repo.as_path(), &["worktree", "add", "--quiet", "-b", "feature", linked.to_str().expect("fixture")]);
    let common: PathBuf = repo.join(".git");
    let git_dir: PathBuf = common.join("worktrees").join("linked");
    std::fs::create_dir_all(git_dir.join("info")).expect("worktree info");
    std::fs::write(git_dir.join("info").join("sparse-checkout"), "/*\n").expect("sparse");
    std::fs::remove_dir_all(common.join("info")).expect("remove shared info");
    let shadow: PathBuf = root.join("shadow");
    std::fs::create_dir(&shadow).expect("shadow");
    link_shadow_entries(shadow.as_path(), common.as_path(), git_dir.as_path()).expect("link");
    assert_eq!(
        std::fs::read_to_string(shadow.join("info").join("sparse-checkout")).expect("sparse copy"),
        "/*\n"
    );
    remove(root.as_path());
}
