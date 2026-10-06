//! Controls for added-path worktree completion on disposable worktrees.

use super::*;
use crate::test_support::{fixture, git_context, git_text, remove, repository};

/// A record for `path` moving from `original` to `intended` content.
fn record(repo: &Path, path: &str, original: &[u8], intended: &[u8], git_mode: &str) -> AddedPath {
    let original_oid: String = hash(repo, original);
    let intended_oid: String = hash(repo, intended);
    return AddedPath {
        path: String::from(path),
        git_mode: String::from(git_mode),
        original_oid,
        intended_oid,
    };
}

/// Write a blob and return its ID.
fn hash(repo: &Path, bytes: &[u8]) -> String {
    let file: PathBuf = repo.join(".git").join("blob-input");
    std::fs::write(&file, bytes).expect("blob input");
    let oid: String = git_text(repo, &["hash-object", "-w", file.to_str().expect("UTF-8")]);
    std::fs::remove_file(&file).expect("remove blob input");
    return oid;
}

/// Set Unix permission bits.
#[cfg(unix)]
fn chmod(path: &Path, mode: u32) {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode)).expect("chmod");
}

/// Conflict errors are the incumbent's four codes.
#[cfg(unix)]
#[test]
fn conflict_errors_are_the_incumbent_codes() {
    assert!(is_conflict_error(&std::io::Error::from(
        std::io::ErrorKind::NotFound
    )));
    assert!(is_conflict_error(&std::io::Error::from_raw_os_error(
        libc::ENOTDIR
    )));
    assert!(is_conflict_error(&std::io::Error::from_raw_os_error(
        libc::ELOOP
    )));
    assert!(is_conflict_error(&std::io::Error::from_raw_os_error(
        libc::EACCES
    )));
    assert!(!is_conflict_error(&std::io::Error::from_raw_os_error(
        libc::EIO
    )));
}

/// Inspection tells original, intended and every conflict apart.
#[cfg(unix)]
#[test]
fn inspection_classifies_worktree_copies() {
    let root: PathBuf = fixture("worktree-completion-inspect");
    let canonical: PathBuf = std::fs::canonicalize(&root).expect("canonical");
    let file: PathBuf = canonical.join("a.txt");
    std::fs::write(&file, b"old").expect("file");
    chmod(file.as_path(), 0o640);
    let state: WorktreeFileState =
        inspect_worktree_file(file.as_path(), "100644", b"old", b"new").expect("inspect");
    let WorktreeFileState::Original(identity) = state else {
        panic!("expected the original, found {state:?}");
    };
    assert_eq!(identity.mode, 0o640);
    assert_eq!(identity.size, 3);
    assert_eq!(
        inspect_worktree_file(file.as_path(), "100644", b"x", b"old").expect("inspect"),
        WorktreeFileState::Intended
    );
    assert_eq!(
        inspect_worktree_file(file.as_path(), "100644", b"x", b"y").expect("inspect"),
        WorktreeFileState::Conflict
    );
    // The executable bit must match the recorded mode.
    assert_eq!(
        inspect_worktree_file(file.as_path(), "100755", b"old", b"new").expect("inspect"),
        WorktreeFileState::Conflict
    );
    chmod(file.as_path(), 0o750);
    assert!(matches!(
        inspect_worktree_file(file.as_path(), "100755", b"old", b"new").expect("inspect"),
        WorktreeFileState::Original(_)
    ));
    // Missing, linked, hard-linked, directory and non-canonical parents are conflicts.
    assert_eq!(
        inspect_worktree_file(
            canonical.join("missing").as_path(),
            "100644",
            b"old",
            b"new"
        )
        .expect("missing"),
        WorktreeFileState::Conflict
    );
    let link: PathBuf = canonical.join("link");
    std::os::unix::fs::symlink(&file, &link).expect("symlink");
    assert_eq!(
        inspect_worktree_file(link.as_path(), "100755", b"old", b"new").expect("link"),
        WorktreeFileState::Conflict
    );
    let hard: PathBuf = canonical.join("hard");
    std::fs::hard_link(&file, &hard).expect("hard link");
    assert_eq!(
        inspect_worktree_file(file.as_path(), "100755", b"old", b"new").expect("shared"),
        WorktreeFileState::Conflict
    );
    std::fs::remove_file(&hard).expect("remove hard link");
    std::fs::create_dir(canonical.join("dir")).expect("directory");
    assert_eq!(
        inspect_worktree_file(canonical.join("dir").as_path(), "100644", b"old", b"new")
            .expect("directory"),
        WorktreeFileState::Conflict
    );
    let alias: PathBuf = canonical.join("alias");
    std::os::unix::fs::symlink(&canonical, &alias).expect("directory link");
    assert_eq!(
        inspect_worktree_file(alias.join("a.txt").as_path(), "100755", b"old", b"new")
            .expect("alias"),
        WorktreeFileState::Conflict
    );
    assert_eq!(
        inspect_worktree_file(file.join("under").as_path(), "100644", b"old", b"new")
            .expect("under a file"),
        WorktreeFileState::Conflict
    );
    assert_eq!(
        inspect_worktree_file(Path::new("/"), "100644", b"old", b"new").expect("root"),
        WorktreeFileState::Conflict
    );
    remove(root.as_path());
}

/// Replacement installs only over the exact original and keeps its mode.
#[cfg(unix)]
#[test]
fn replacement_needs_the_exact_original() {
    use std::os::unix::fs::PermissionsExt;
    let root: PathBuf = fixture("worktree-completion-replace");
    let canonical: PathBuf = std::fs::canonicalize(&root).expect("canonical");
    let file: PathBuf = canonical.join("a.txt");
    std::fs::write(&file, b"old").expect("file");
    chmod(file.as_path(), 0o751);
    let WorktreeFileState::Original(identity) =
        inspect_worktree_file(file.as_path(), "100755", b"old", b"new").expect("inspect")
    else {
        panic!("expected the original");
    };
    assert!(
        replace_worktree_file(file.as_path(), b"new", "100755", b"old", &identity)
            .expect("replace")
    );
    assert_eq!(std::fs::read(&file).expect("replaced"), b"new");
    assert_eq!(
        std::fs::metadata(&file)
            .expect("metadata")
            .permissions()
            .mode()
            & 0o777,
        0o751
    );
    // A copy that changed since the identity was taken is kept.
    let stale: WorktreeFileIdentity = WorktreeFileIdentity {
        size: 99,
        ..identity
    };
    std::fs::write(&file, b"old").expect("old again");
    chmod(file.as_path(), 0o751);
    assert!(
        !replace_worktree_file(file.as_path(), b"new", "100755", b"old", &stale).expect("stale")
    );
    assert_eq!(std::fs::read(&file).expect("kept"), b"old");
    std::fs::write(&file, b"edited").expect("edited");
    assert!(
        !replace_worktree_file(file.as_path(), b"new", "100755", b"old", &identity)
            .expect("edited")
    );
    assert_eq!(std::fs::read(&file).expect("kept"), b"edited");
    // No prepared file is left behind.
    for entry in std::fs::read_dir(&canonical).expect("list") {
        let name: String = entry
            .expect("entry")
            .file_name()
            .to_string_lossy()
            .into_owned();
        assert!(!name.starts_with(".cli-git-added-"), "{name}");
    }
    // A directory that cannot hold the prepared file is a failure.
    assert!(
        replace_worktree_file(
            canonical.join("missing").join("a").as_path(),
            b"new",
            "100644",
            b"old",
            &identity
        )
        .is_err()
    );
    remove(root.as_path());
}

/// Completion rewrites originals, keeps edits and skips completed copies.
#[cfg(unix)]
#[test]
fn completion_rewrites_only_originals() {
    let root: PathBuf = fixture("worktree-completion-install");
    let repo: PathBuf = repository(root.as_path(), "repo");
    let context: crate::transaction_git::GitContext = git_context();
    std::fs::write(repo.join("fix.txt"), b"no newline").expect("original copy");
    std::fs::write(repo.join("done.txt"), b"done\n").expect("completed copy");
    std::fs::write(repo.join("edited.txt"), b"user edit").expect("edited copy");
    let records: Vec<AddedPath> = vec![
        record(
            repo.as_path(),
            "fix.txt",
            b"no newline",
            b"no newline\n",
            "100644",
        ),
        record(repo.as_path(), "done.txt", b"done", b"done\n", "100644"),
        record(
            repo.as_path(),
            "edited.txt",
            b"before",
            b"after\n",
            "100644",
        ),
        record(repo.as_path(), "gone.txt", b"before", b"after\n", "100644"),
    ];
    let result: InstallResult = install_added_worktree_files(
        &context,
        repo.as_path(),
        repo.as_path(),
        records.as_slice(),
        None,
    )
    .expect("install");
    assert_eq!(result.rewritten, vec![String::from("fix.txt")]);
    assert_eq!(
        result.conflicted,
        vec![String::from("edited.txt"), String::from("gone.txt")]
    );
    assert_eq!(
        std::fs::read(repo.join("fix.txt")).expect("fixed"),
        b"no newline\n"
    );
    assert_eq!(
        std::fs::read(repo.join("edited.txt")).expect("kept"),
        b"user edit"
    );
    assert_eq!(
        install_added_worktree_files(&context, repo.as_path(), repo.as_path(), &[], None)
            .expect("nothing"),
        InstallResult::default()
    );
    // An object Git cannot supply fails the completion.
    let mut missing: AddedPath = records[0].clone();
    missing.intended_oid = String::from("0000000000000000000000000000000000000001");
    assert!(
        install_added_worktree_files(&context, repo.as_path(), repo.as_path(), &[missing], None)
            .is_err()
    );
    remove(root.as_path());
}
