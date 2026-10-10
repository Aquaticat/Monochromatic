//! Controls for the real index lock against real files:
//!  exclusive creation,
//!  identity and PID
//! recording,
//!  refusal to release a replaced lock,
//!  and the budget for a dead foreign owner.

use super::*;
use crate::test_support::{fixture, remove};

/// The index path inside a fresh fixture directory.
fn index_in(name: &str) -> (PathBuf, PathBuf) {
    let root: PathBuf = fixture(name);
    let index: PathBuf = root.join("index");
    return (root, index);
}

/// A free index is locked:
///  the lock exists with the recorded identity,
///  the PID file names this process,
/// and release removes both.
#[test]
#[cfg(unix)]
fn a_free_index_is_locked_and_released() {
    use std::os::unix::fs::MetadataExt;
    let (root, index): (PathBuf, PathBuf) = index_in("real-lock-free");
    let lock: RealIndexLock = match acquire_real_index_lock(index.as_path(), 100, "did nothing") {
        Ok(found) => found,
        Err(failure) => panic!("a free index is lockable: {failure:?}"),
    };
    let metadata: std::fs::Metadata = std::fs::symlink_metadata(real_lock_path(index.as_path())).expect("the lock exists");
    assert_eq!(lock.identity().file.device, metadata.dev().to_string());
    assert_eq!(lock.identity().file.inode, metadata.ino().to_string());
    assert!(!lock.identity().fs_id.is_empty());
    let pid: String = std::fs::read_to_string(real_pid_path(index.as_path())).expect("PID file");
    assert_eq!(pid, format!("pid {}\n", std::process::id()));
    lock.release().expect("release");
    assert!(!real_lock_path(index.as_path()).exists());
    assert!(!real_pid_path(index.as_path()).exists());
    remove(root.as_path());
}

/// A lock replaced by another file is refused on release:
///  the replacement stays where it is.
#[test]
#[cfg(unix)]
fn a_replaced_lock_is_never_released() {
    let (root, index): (PathBuf, PathBuf) = index_in("real-lock-replaced");
    let lock: RealIndexLock = match acquire_real_index_lock(index.as_path(), 100, "did nothing") {
        Ok(found) => found,
        Err(failure) => panic!("a free index is lockable: {failure:?}"),
    };
    let path: PathBuf = real_lock_path(index.as_path());
    std::fs::remove_file(&path).expect("remove the created lock");
    std::fs::write(&path, b"another process's lock").expect("replacement");
    let refusal: String = lock.release().expect_err("a replaced lock must not be released");
    assert!(refusal.contains("identity changed"), "{refusal}");
    assert_eq!(std::fs::read(&path).expect("replacement kept"), b"another process's lock");
    remove(root.as_path());
}

/// A dead foreign owner exhausts the budget and the lock is left in place.
#[test]
#[cfg(unix)]
fn a_dead_foreign_owner_exhausts_the_budget() {
    let (root, index): (PathBuf, PathBuf) = index_in("real-lock-dead");
    std::fs::write(real_lock_path(index.as_path()), b"").expect("foreign lock");
    std::fs::write(real_pid_path(index.as_path()), "pid 2147483646\n").expect("dead PID file");
    let failure: CoordinationFailure = match acquire_real_index_lock(index.as_path(), 50, "landed nothing") {
        Ok(_) => panic!("a dead owner must not be overtaken"),
        Err(found) => found,
    };
    assert!(matches!(failure, CoordinationFailure::UnprovenOwner(_)));
    assert!(real_lock_path(index.as_path()).exists());
    remove(root.as_path());
}
