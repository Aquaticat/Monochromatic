//! Staging checks against real Git repositories: what the private stage holds and how it is cleaned up.

use super::*;
use crate::test_support::{fixture, git, git_context, remove, repository};

/// A source with ignored files, a symbolic link, an executable and a nested private-looking name.
fn source_with_ignored_state(parent: &Path) -> PathBuf {
    let root: PathBuf = repository(parent, "source");
    std::fs::write(
        root.join(".gitignore"),
        b"cache/\nlinked\n.cli-git-worktree-copy-*\n",
    )
    .expect("gitignore");
    std::fs::create_dir_all(root.join("cache/deep")).expect("cache");
    std::fs::write(root.join("cache/deep/data"), b"payload").expect("data");
    std::fs::write(root.join("cache/run.sh"), b"#!/bin/sh\n").expect("script");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(
            root.join("cache/run.sh"),
            std::fs::Permissions::from_mode(0o750),
        )
        .expect("mode");
        std::os::unix::fs::symlink("deep/data", root.join("linked")).expect("link");
    }
    std::fs::create_dir_all(root.join(".cli-git-worktree-copy-leftover")).expect("private name");
    std::fs::write(
        root.join(".cli-git-worktree-copy-leftover/file"),
        b"private",
    )
    .expect("private file");
    return root;
}

/// The staged container is private, beside the destination, and holds the payload that mirrors the source.
#[cfg(unix)]
#[test]
fn stage_mirrors_selected_entries_with_modes_and_links() {
    use std::os::unix::fs::PermissionsExt;
    let root: PathBuf = fixture("stage-mirror");
    let source: PathBuf = source_with_ignored_state(root.as_path());
    let destination: PathBuf = root.join("worktrees").join("topic");
    std::fs::create_dir_all(destination.parent().expect("parent")).expect("worktrees");
    let staged: StagedSnapshot = stage_ignored_snapshot(
        &git_context(),
        source.as_path(),
        new_stage_container(destination.as_path()).expect("container").as_path(),
        &[std::fs::canonicalize(source.as_path()).expect("canonical")],
        &CopySelection::Ignored,
    )
    .expect("staged");
    assert_eq!(staged.stage_container.parent(), destination.parent());
    assert!(
        staged
            .stage_container
            .file_name()
            .expect("name")
            .to_string_lossy()
            .starts_with(STAGE_PREFIX)
    );
    assert_eq!(
        std::fs::metadata(staged.stage_container.as_path())
            .expect("container")
            .permissions()
            .mode()
            & 0o777,
        0o700
    );
    assert_eq!(
        std::fs::read(staged.stage_root.join("cache/deep/data")).expect("data"),
        b"payload"
    );
    assert_eq!(
        std::fs::metadata(staged.stage_root.join("cache/run.sh"))
            .expect("script")
            .permissions()
            .mode()
            & 0o777,
        0o750
    );
    assert_eq!(
        std::fs::read_link(staged.stage_root.join("linked")).expect("link"),
        PathBuf::from("deep/data")
    );
    assert!(
        !staged
            .stage_root
            .join(".cli-git-worktree-copy-leftover")
            .exists()
    );
    assert!(
        staged
            .selected_roots
            .iter()
            .all(|path| return !path.starts_with(".cli-git-worktree-copy-"))
    );
    assert!(
        staged
            .entries
            .iter()
            .any(|entry| return entry.relative_path == "linked")
    );
    remove(root.as_path());
}

/// A nested registered worktree under the source is excluded from the copy.
#[test]
fn nested_registered_worktree_is_not_copied() {
    let root: PathBuf = fixture("stage-nested");
    let source: PathBuf = repository(root.as_path(), "source");
    std::fs::write(source.join(".gitignore"), b"nested/\n").expect("gitignore");
    std::fs::create_dir_all(source.join("nested")).expect("nested");
    git(
        source.as_path(),
        &[
            "worktree",
            "add",
            "--quiet",
            "-b",
            "inner",
            source.join("nested/wt").to_str().expect("utf8"),
        ],
    );
    std::fs::write(source.join("nested/plain"), b"x").expect("plain");
    let nested_root: PathBuf =
        std::fs::canonicalize(source.join("nested/wt")).expect("canonical nested");
    let destination: PathBuf = root.join("topic");
    let staged: StagedSnapshot = stage_ignored_snapshot(
        &git_context(),
        std::fs::canonicalize(source.as_path())
            .expect("canonical source")
            .as_path(),
        new_stage_container(destination.as_path()).expect("container").as_path(),
        &[nested_root],
        &CopySelection::Ignored,
    )
    .expect("staged");
    assert!(
        staged
            .entries
            .iter()
            .all(|entry| return !entry.relative_path.starts_with("nested/wt"))
    );
    assert!(
        staged
            .entries
            .iter()
            .any(|entry| return entry.relative_path == "nested/plain")
    );
    remove(root.as_path());
}

/// A source with an ignored FIFO fails the copy, and the private stage is removed so nothing is left beside the destination.
#[cfg(unix)]
#[test]
fn failed_copy_removes_its_stage() {
    let root: PathBuf = fixture("stage-failure");
    let source: PathBuf = repository(root.as_path(), "source");
    std::fs::write(source.join(".gitignore"), b"pipe\n").expect("gitignore");
    let status = std::process::Command::new("mkfifo")
        .arg(source.join("pipe"))
        .status()
        .expect("mkfifo");
    assert!(status.success());
    let destination: PathBuf = root.join("topic");
    let failure: WorktreeCopyError = stage_ignored_snapshot(
        &git_context(),
        std::fs::canonicalize(source.as_path())
            .expect("canonical source")
            .as_path(),
        new_stage_container(destination.as_path()).expect("container").as_path(),
        &[],
        &CopySelection::Ignored,
    )
    .expect_err("fifo");
    assert!(
        failure.0.ends_with(" has unsupported filesystem type."),
        "{}",
        failure.0
    );
    let leftovers: Vec<String> = std::fs::read_dir(root.as_path())
        .expect("list")
        .map(|entry| {
            return entry
                .expect("entry")
                .file_name()
                .to_string_lossy()
                .into_owned();
        })
        .filter(|name| return name.starts_with(STAGE_PREFIX))
        .collect();
    assert!(leftovers.is_empty(), "{leftovers:?}");
    remove(root.as_path());
}

/// Copying bytes yields identical content whether or not the filesystem clones.
#[test]
fn copied_file_has_identical_bytes() {
    let root: PathBuf = fixture("stage-bytes");
    std::fs::write(root.join("source"), vec![3_u8; 200_000]).expect("source");
    copy_file_exclusive(root.join("source").as_path(), root.join("copy").as_path()).expect("copy");
    assert_eq!(
        std::fs::read(root.join("copy")).expect("copy bytes"),
        vec![3_u8; 200_000]
    );
    assert!(
        copy_file_exclusive(root.join("source").as_path(), root.join("copy").as_path()).is_err()
    );
    remove(root.as_path());
}

/// A private container under a missing parent is never created, and the failure names the cause.
#[test]
fn staging_under_a_missing_parent_fails_with_cause() {
    let root: PathBuf = fixture("stage-missing-parent");
    let source: PathBuf = repository(root.as_path(), "source");
    let destination: PathBuf = root.join("absent").join("topic");
    let failure: WorktreeCopyError = stage_ignored_snapshot(
        &git_context(),
        std::fs::canonicalize(source.as_path())
            .expect("canonical source")
            .as_path(),
        new_stage_container(destination.as_path()).expect("container").as_path(),
        &[],
        &CopySelection::Ignored,
    )
    .expect_err("missing parent");
    assert!(failure.0.contains("No such file or directory"));
    remove(root.as_path());
}
