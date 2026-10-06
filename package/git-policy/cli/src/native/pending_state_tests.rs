//! What: Which directory contents count as an interrupted worktree copy, for each kind of
//!       location.
//! Why: Missing a journal would run a command beside an unfinished copy; seeing one that
//!      does not exist would refuse every command in a quiet repository.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // await writeFile(join(commonDir, 'cli-git-worktree-copy', 'v1', 'id.json'), '{}');
//! // expect(await pendingState(linked, false)).toEqual({ kind: 'worktree-copy-recovery', directory });
//! ```
#![cfg(unix)]

/// The check under test, the refusal it returns and the disposable-directory helpers.
use super::pending_state;
use crate::test_support::{fixture, remove};
use crate::unported::Unported;
use crate::worktree_identity::WorktreeIdentity;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

/// The main worktree of a repository whose Git directory is `git_dir`.
fn main_worktree(git_dir: &Path) -> WorktreeIdentity {
    return WorktreeIdentity::MainWorktree {
        common_dir: git_dir.to_path_buf(),
        git_dir: git_dir.to_path_buf(),
        worktree_root: git_dir.join(".."),
    };
}

/// A linked worktree with its own Git directory below the common one.
fn linked_worktree(common_dir: &Path, git_dir: &Path) -> WorktreeIdentity {
    return WorktreeIdentity::LinkedWorktree {
        common_dir: common_dir.to_path_buf(),
        git_dir: git_dir.to_path_buf(),
        worktree_root: common_dir.join("../linked"),
    };
}

/// A bare repository at `git_dir`.
fn bare_repository(git_dir: &Path) -> WorktreeIdentity {
    return WorktreeIdentity::BareRepository {
        common_dir: git_dir.to_path_buf(),
        git_dir: git_dir.to_path_buf(),
    };
}

/// A fresh Git directory stand-in with a linked worktree's directory inside it.
fn directories(name: &str) -> (PathBuf, PathBuf, PathBuf) {
    let root: PathBuf = fixture(name);
    let common: PathBuf = root.join("common");
    let linked: PathBuf = common.join("worktrees/linked");
    std::fs::create_dir_all(&linked).expect("Git directories");
    return (root, common, linked);
}

/// Nothing recorded, an empty registry and an empty journal directory are all quiet.
#[test]
fn quiet_directories_hold_no_state() {
    let (root, common, linked): (PathBuf, PathBuf, PathBuf) = directories("pending-quiet");
    assert_eq!(
        pending_state(&WorktreeIdentity::OutsideWorktree, false),
        None
    );
    for identity in [
        main_worktree(common.as_path()),
        linked_worktree(common.as_path(), linked.as_path()),
        bare_repository(common.as_path()),
    ] {
        assert_eq!(pending_state(&identity, false), None, "{identity:?}");
    }
    std::fs::create_dir(common.join("cli-git-transactions")).expect("empty registry");
    std::fs::create_dir(linked.join("cli-git-transactions")).expect("empty registry");
    std::fs::create_dir_all(common.join("cli-git-worktree-copy/v1/settlement.lock"))
        .expect("settlement lock");
    for identity in [
        main_worktree(common.as_path()),
        linked_worktree(common.as_path(), linked.as_path()),
        bare_repository(common.as_path()),
    ] {
        assert_eq!(pending_state(&identity, false), None, "{identity:?}");
    }
    remove(root.as_path());
}

/// Commit transactions are recovered elsewhere, so registry entries and the legacy directory
/// are not state here.
#[test]
fn transaction_entries_are_not_state_here() {
    let (root, common, linked): (PathBuf, PathBuf, PathBuf) = directories("pending-transactions");
    std::fs::create_dir_all(common.join("cli-git-transactions/0123-id")).expect("registry entry");
    std::fs::create_dir_all(linked.join("cli-git-transactions/0123-id")).expect("registry entry");
    std::fs::create_dir(common.join("cli-git-transaction")).expect("legacy");
    for identity in [
        main_worktree(common.as_path()),
        linked_worktree(common.as_path(), linked.as_path()),
        bare_repository(common.as_path()),
    ] {
        assert_eq!(pending_state(&identity, false), None, "{identity:?}");
    }
    remove(root.as_path());
}

/// A journal stops a linked worktree and a bare repository, but not the main worktree or an opted-out caller.
#[test]
fn worktree_copy_journals_are_state_where_copies_are_synchronized() {
    let (root, common, linked): (PathBuf, PathBuf, PathBuf) = directories("pending-copies");
    let journals: PathBuf = common.join("cli-git-worktree-copy/v1");
    std::fs::create_dir_all(journals.join("settlement.lock")).expect("settlement lock");
    std::fs::write(journals.join("id.json"), b"{}").expect("journal");
    for identity in [
        linked_worktree(common.as_path(), linked.as_path()),
        bare_repository(common.as_path()),
    ] {
        assert_eq!(
            pending_state(&identity, false),
            Some(Unported::WorktreeCopyRecovery(journals.clone())),
            "{identity:?}"
        );
        assert_eq!(pending_state(&identity, true), None, "{identity:?}");
    }
    assert_eq!(pending_state(&main_worktree(common.as_path()), false), None);
    remove(root.as_path());
}

/// A journal directory that cannot be listed counts as holding state.
#[test]
fn unreadable_journal_directories_count_as_state() {
    let (root, common, linked): (PathBuf, PathBuf, PathBuf) = directories("pending-unreadable");
    // A file where the journal directory should be cannot be listed.
    let journals: PathBuf = common.join("cli-git-worktree-copy/v1");
    std::fs::create_dir_all(common.join("cli-git-worktree-copy")).expect("journal parent");
    std::fs::write(&journals, b"").expect("file in place of the journals");
    assert_eq!(
        pending_state(&linked_worktree(common.as_path(), linked.as_path()), false),
        Some(Unported::WorktreeCopyRecovery(journals.clone()))
    );
    std::fs::remove_file(&journals).expect("remove file");
    // A journal directory that cannot be searched hides whether journals exist.
    std::fs::create_dir(&journals).expect("journals");
    std::fs::set_permissions(&journals, std::fs::Permissions::from_mode(0o000))
        .expect("remove every permission");
    // Positive control for the fixture: the directory really is unreadable to this process,
    // which holds only when the tests do not run as the superuser.
    let unreadable: bool = std::fs::read_dir(&journals).is_err();
    let found: Option<Unported> =
        pending_state(&linked_worktree(common.as_path(), linked.as_path()), false);
    std::fs::set_permissions(&journals, std::fs::Permissions::from_mode(0o700))
        .expect("restore permissions");
    assert!(unreadable);
    assert_eq!(
        found,
        Some(Unported::WorktreeCopyRecovery(journals.clone()))
    );
    remove(root.as_path());
}
