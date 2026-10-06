//! Controls for the transaction registry: names, publication, listing and removal.

use super::*;
use crate::test_support::{fixture, remove};

/// The canonical transaction ID used by these tests.
const ID: &str = "0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10";

/// Only the canonical lowercase layout is a transaction ID.
#[test]
fn transaction_ids_are_canonical_uuids() {
    assert!(is_transaction_id(ID));
    assert!(is_transaction_id("00000000-0000-0000-0000-000000000000"));
    assert!(is_transaction_id("ffffffff-ffff-ffff-ffff-ffffffffffff"));
    for refused in [
        "",
        "0B6C2C1E-6F5B-4D0E-9A55-3F5D8E2F6A10",
        "0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a1",
        "0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a100",
        "0b6c2c1e_6f5b-4d0e-9a55-3f5d8e2f6a10",
        "0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a1g",
        "0b6c2c1e-6f5b-4d0e-9a5-53f5d8e2f6a10",
        "0b6c2c1e6f5b-4d0e-9a55--3f5d8e2f6a10",
        "-b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10",
    ] {
        assert!(!is_transaction_id(refused), "{refused}");
    }
}

/// The registry's locks and their candidates are not transactions.
#[test]
fn lock_names_are_recognized() {
    for name in [
        "landing.lock",
        "reservation.lock",
        "landing.lock.x.pending",
        "reservation.lock.y.stale",
    ] {
        assert!(is_registry_lock_name(name), "{name}");
    }
    for name in [
        "landing.locks",
        "landing",
        "hook.lock",
        ID,
        "reservation.lockx",
    ] {
        assert!(!is_registry_lock_name(name), "{name}");
    }
}

/// Names classify into the three kinds, and anything else is unexpected.
#[test]
fn names_classify_by_suffix() {
    let root: &Path = Path::new("/repo/.git/cli-git-transactions");
    let published: RegistryEntry = classify_entry_name(root, ID).expect("published");
    assert_eq!(published.kind, EntryKind::Transaction);
    assert_eq!(published.transaction_id, ID);
    assert_eq!(published.path, root.join(ID));
    let staging: RegistryEntry =
        classify_entry_name(root, format!("{ID}.pending").as_str()).expect("staging");
    assert_eq!(
        (staging.kind, staging.transaction_id.as_str()),
        (EntryKind::Staging, ID)
    );
    let retired: RegistryEntry =
        classify_entry_name(root, format!("{ID}.retired").as_str()).expect("retired");
    assert_eq!(
        (retired.kind, retired.transaction_id.as_str()),
        (EntryKind::Retired, ID)
    );
    for name in [
        "junk",
        "x.pending",
        "x.retired",
        format!("{ID}.other").as_str(),
    ] {
        assert_eq!(
            classify_entry_name(root, name).expect_err("unexpected").0,
            format!(
                "Unexpected transaction registry entry: /repo/.git/cli-git-transactions/{name}"
            )
        );
    }
}

/// Publication renames a complete candidate; listing sees it and nothing half-built.
#[test]
fn publication_and_listing() {
    let git_dir: PathBuf = fixture("registry-publish");
    let root: PathBuf = git_dir.join(TRANSACTION_ROOT_NAME);
    assert!(
        list_transaction_entries(root.as_path())
            .expect("absent")
            .is_empty()
    );
    ensure_transaction_root(root.as_path()).expect("create");
    ensure_transaction_root(root.as_path()).expect("exists already");
    let directory: PathBuf =
        publish_transaction_directory(root.as_path(), ID, b"{\"owner\":1}\n").expect("publish");
    assert_eq!(directory, root.join(ID));
    assert_eq!(
        std::fs::read(directory.join(OWNER_FILENAME)).expect("owner"),
        b"{\"owner\":1}\n"
    );
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode: u32 = std::fs::metadata(&directory)
            .expect("meta")
            .permissions()
            .mode()
            & 0o777;
        assert_eq!(mode, 0o700);
        let root_mode: u32 = std::fs::metadata(&root).expect("meta").permissions().mode() & 0o777;
        assert_eq!(root_mode, 0o700);
    }
    std::fs::create_dir(root.join("landing.lock")).expect("lock");
    std::fs::create_dir(root.join(format!("{ID}.retired").replace("0b6c", "1b6c")))
        .expect("retired");
    let entries: Vec<RegistryEntry> = list_transaction_entries(root.as_path()).expect("listing");
    assert_eq!(entries.len(), 2, "locks are left out: {entries:?}");
    assert_eq!(entries[0].kind, EntryKind::Transaction);
    assert_eq!(entries[1].kind, EntryKind::Retired);
    assert!(
        publish_transaction_directory(root.as_path(), "not-an-id", b"").is_err(),
        "a malformed ID is refused"
    );
    let second: Result<PathBuf, RecoveryError> =
        publish_transaction_directory(root.as_path(), ID, b"{}");
    assert!(second.is_err(), "an existing transaction is never replaced");
    assert!(
        !root.join(format!("{ID}.pending")).exists(),
        "the failed candidate was removed"
    );
    remove(git_dir.as_path());
}

/// Unsafe registries and entries fail closed with the path named.
#[cfg(unix)]
#[test]
fn unsafe_state_fails_closed() {
    let git_dir: PathBuf = fixture("registry-unsafe");
    let root: PathBuf = git_dir.join(TRANSACTION_ROOT_NAME);
    std::fs::write(&root, b"x").expect("file registry");
    assert_eq!(
        list_transaction_entries(root.as_path())
            .expect_err("file")
            .0,
        format!("Unsafe transaction registry: {}", root.display())
    );
    assert!(ensure_transaction_root(root.as_path()).is_err());
    std::fs::remove_file(&root).expect("remove");
    let elsewhere: PathBuf = git_dir.join("elsewhere");
    std::fs::create_dir(&elsewhere).expect("elsewhere");
    std::os::unix::fs::symlink(&elsewhere, &root).expect("linked registry");
    assert!(list_transaction_entries(root.as_path()).is_err());
    assert!(ensure_transaction_root(root.as_path()).is_err());
    std::fs::remove_file(&root).expect("unlink");
    std::fs::create_dir(&root).expect("registry");
    std::os::unix::fs::symlink(&elsewhere, root.join(ID)).expect("linked entry");
    assert_eq!(
        list_transaction_entries(root.as_path())
            .expect_err("link")
            .0,
        format!(
            "Unsafe transaction recovery directory: {}",
            root.join(ID).display()
        )
    );
    std::fs::remove_file(root.join(ID)).expect("unlink entry");
    std::fs::create_dir(root.join("junk")).expect("junk");
    assert!(list_transaction_entries(root.as_path()).is_err());
    std::fs::remove_dir(root.join("junk")).expect("rmdir");
    // A link on the way to the registry makes its parent noncanonical.
    let linked_parent: PathBuf = git_dir.join("linked-git");
    std::os::unix::fs::symlink(&git_dir, &linked_parent).expect("linked parent");
    assert!(
        ensure_transaction_root(linked_parent.join(TRANSACTION_ROOT_NAME).as_path())
            .expect_err("noncanonical")
            .0
            .ends_with("has a noncanonical administrative parent.")
    );
    remove(git_dir.as_path());
}

/// A non-UTF-8 entry name is unexpected state.
#[cfg(target_os = "linux")]
#[test]
fn a_non_utf8_entry_is_unexpected() {
    use std::os::unix::ffi::OsStrExt;
    let git_dir: PathBuf = fixture("registry-bytes");
    let root: PathBuf = git_dir.join(TRANSACTION_ROOT_NAME);
    std::fs::create_dir(&root).expect("registry");
    std::fs::create_dir(root.join(std::ffi::OsStr::from_bytes(b"\xff"))).expect("odd entry");
    assert!(
        list_transaction_entries(root.as_path())
            .expect_err("odd")
            .0
            .starts_with("Unexpected transaction registry entry: ")
    );
    remove(git_dir.as_path());
}

/// Removal retires a registry directory first; other directories are removed in place.
#[test]
fn removal_retires_registry_directories() {
    let git_dir: PathBuf = fixture("registry-remove");
    let root: PathBuf = git_dir.join(TRANSACTION_ROOT_NAME);
    ensure_transaction_root(root.as_path()).expect("create");
    let directory: PathBuf =
        publish_transaction_directory(root.as_path(), ID, b"{}\n").expect("publish");
    std::fs::write(directory.join("preparing.json"), b"{}").expect("state");
    remove_transaction_directory(directory.as_path()).expect("remove");
    assert!(!directory.exists());
    assert!(!root.join(format!("{ID}.retired")).exists());
    assert!(
        list_transaction_entries(root.as_path())
            .expect("listing")
            .is_empty()
    );
    let legacy: PathBuf = git_dir.join(LEGACY_TRANSACTION_DIRECTORY_NAME);
    std::fs::create_dir(&legacy).expect("legacy");
    std::fs::write(legacy.join("journal.json"), b"{}").expect("journal");
    remove_transaction_directory(legacy.as_path()).expect("legacy removal");
    assert!(!legacy.exists());
    assert!(
        remove_transaction_directory(root.join(ID).as_path()).is_err(),
        "a missing registry directory cannot be retired"
    );
    remove(git_dir.as_path());
}
