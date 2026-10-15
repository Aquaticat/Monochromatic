//! Settlement-lock checks: owner records, liveness, dead-owner retirement, unproven owners and inherited leases.

use super::*;
use crate::test_support::{fixture, remove};
use crate::worktree_copy_journal::ensure_journal_root;
use std::time::Duration;

/// The published lock directory of a common directory.
fn lock_of(common: &Path) -> PathBuf {
    return ensure_journal_root(common)
        .expect("root")
        .join(SETTLEMENT_LOCK_NAME);
}

/// Writes an owner record into a lock directory, as a published holder would.
fn publish(lock: &Path, text: &str) {
    std::fs::create_dir_all(lock).expect("lock directory");
    crate::private_storage::write_private_file(
        lock.join(OWNER_RECORD_NAME).as_path(),
        text.as_bytes(),
    )
    .expect("owner record");
}

/// A process identity that no live process has.
const DEAD_OWNER: &str = "{\"leaseToken\":\"dead-token\",\"ownerBirthIdentity\":\"no-such-birth\",\"ownerPid\":2147483646,\"schemaVersion\":1}\n";

/// The owner record encodes with the incumbent's key order and parses back.
#[test]
fn owner_record_round_trips_with_incumbent_spelling() {
    let owner: LockOwner = LockOwner {
        lease_token: String::from("token"),
        owner_pid: 5,
        owner_birth_identity: String::from("linux:9"),
    };
    let text: String = encode_owner(&owner);
    assert_eq!(
        text,
        "{\"leaseToken\":\"token\",\"ownerBirthIdentity\":\"linux:9\",\"ownerPid\":5,\"schemaVersion\":1}\n"
    );
    assert_eq!(parse_owner(text.as_str()), Ok(owner));
}

/// A record with missing or mistyped fields proves nothing, and the evidence says why.
#[test]
fn invalid_owner_records_are_unproven() {
    assert_eq!(
        parse_owner("{\"schemaVersion\":2}"),
        Err(String::from("missing or mistyped owner fields"))
    );
    assert_eq!(
        parse_owner(
            "{\"schemaVersion\":1,\"leaseToken\":\"\",\"ownerPid\":1,\"ownerBirthIdentity\":\"x\"}"
        ),
        Err(String::from("missing or mistyped owner fields"))
    );
    assert_eq!(
        parse_owner(
            "{\"schemaVersion\":1,\"leaseToken\":\"t\",\"ownerPid\":0,\"ownerBirthIdentity\":\"x\"}"
        ),
        Err(String::from("missing or mistyped owner fields"))
    );
    assert!(
        parse_owner("not json")
            .expect_err("not json")
            .starts_with("not JSON (")
    );
}

/// Each way the record read can fail has its own outcome:
///  a vanished or replaced lock asks for another attempt,
///  an unreadable record is unproven and names why,
///  and any other failure is an error.
#[cfg(unix)]
#[test]
fn each_failed_record_read_has_its_own_outcome() {
    use std::os::unix::fs::PermissionsExt;
    let common: PathBuf = fixture("lock-record-read-failures");
    let lock: PathBuf = lock_of(common.as_path());
    assert_eq!(read_published(lock.as_path()).expect("vanished"), Published::Retry, "the lock vanished");
    std::fs::write(&lock, b"x").expect("a file in place of the lock");
    assert_eq!(
        read_published(lock.as_path()).expect("replaced"),
        Published::Retry,
        "the lock was replaced by a file"
    );
    std::fs::remove_file(&lock).expect("remove the file");
    let record: PathBuf = lock.join(OWNER_RECORD_NAME);
    std::fs::create_dir_all(&record).expect("a directory in place of the record");
    match read_published(lock.as_path()).expect("a directory is evidence") {
        Published::Unproven(evidence) => assert!(evidence.ends_with("is unreadable (EISDIR)"), "{evidence}"),
        other => panic!("expected unproven evidence, got {other:?}"),
    }
    std::fs::remove_dir(&record).expect("remove the directory");
    std::os::unix::fs::symlink(OWNER_RECORD_NAME, &record).expect("a record that links to itself");
    assert!(read_published(lock.as_path()).is_err(), "a link loop is not evidence");
    std::fs::remove_file(&record).expect("remove the link");
    std::fs::write(&record, b"x").expect("a record");
    std::fs::set_permissions(&record, std::fs::Permissions::from_mode(0o000)).expect("close the record");
    // A superuser reads the record anyway, so only an ordinary user shows the refusal.
    if std::fs::read(&record).is_err() {
        match read_published(lock.as_path()).expect("an unreadable record is evidence") {
            Published::Unproven(evidence) => assert!(evidence.ends_with("is unreadable (EACCES)"), "{evidence}"),
            other => panic!("expected unproven evidence, got {other:?}"),
        }
    }
    std::fs::set_permissions(&record, std::fs::Permissions::from_mode(0o600)).expect("open the record");
    remove(common.as_path());
}

/// A free lock is acquired, published with a private owner record that names this process, and released by removing it.
#[cfg(unix)]
#[test]
fn free_lock_is_acquired_and_released() {
    let root: PathBuf = fixture("lock-free");
    let common: PathBuf = root.join("common");
    std::fs::create_dir(common.as_path()).expect("common");
    let lease: WorktreeCopyLease = try_acquire_worktree_copy_lock(common.as_path())
        .expect("attempt")
        .expect("free");
    let lock: PathBuf = lock_of(common.as_path());
    let published: String = std::fs::read_to_string(lock.join(OWNER_RECORD_NAME)).expect("record");
    let owner: LockOwner = parse_owner(published.as_str()).expect("valid owner");
    assert_eq!(owner.owner_pid, i64::from(std::process::id()));
    assert_eq!(owner.lease_token, lease.lease_token());
    lease.release().expect("released");
    assert!(!lock.exists());
    remove(root.as_path());
}

/// A lock held by a live owner is reported as held, and the holder keeps it.
#[cfg(unix)]
#[test]
fn live_holder_keeps_the_lock() {
    let root: PathBuf = fixture("lock-live");
    let common: PathBuf = root.join("common");
    std::fs::create_dir(common.as_path()).expect("common");
    let first: WorktreeCopyLease = try_acquire_worktree_copy_lock(common.as_path())
        .expect("attempt")
        .expect("free");
    assert!(
        try_acquire_worktree_copy_lock(common.as_path())
            .expect("attempt")
            .is_none()
    );
    first.release().expect("released");
    remove(root.as_path());
}

/// A lock whose owner is dead is retired and taken, without waiting.
#[cfg(unix)]
#[test]
fn dead_owner_lock_is_retired_and_taken() {
    let root: PathBuf = fixture("lock-dead");
    let common: PathBuf = root.join("common");
    std::fs::create_dir(common.as_path()).expect("common");
    publish(lock_of(common.as_path()).as_path(), DEAD_OWNER);
    let lease: WorktreeCopyLease = try_acquire_worktree_copy_lock(common.as_path())
        .expect("attempt")
        .expect("taken from the dead owner");
    assert_ne!(lease.lease_token(), "dead-token");
    lease.release().expect("released");
    remove(root.as_path());
}

/// An owner record that proves nothing keeps the lock held for `try`, and the lock stays in place.
#[cfg(unix)]
#[test]
fn unproven_owner_keeps_the_lock_in_place() {
    let root: PathBuf = fixture("lock-unproven");
    let common: PathBuf = root.join("common");
    std::fs::create_dir(common.as_path()).expect("common");
    let lock: PathBuf = lock_of(common.as_path());
    publish(lock.as_path(), "garbage");
    assert!(
        try_acquire_worktree_copy_lock(common.as_path())
            .expect("attempt")
            .is_none()
    );
    assert!(lock.join(OWNER_RECORD_NAME).exists());
    remove(root.as_path());
}

/// A blocking acquisition gives up on an unproven owner after the bounded wait, names the evidence, and leaves the lock.
#[cfg(unix)]
#[test]
fn unproven_owner_fails_the_blocking_wait_and_keeps_lock() {
    let root: PathBuf = fixture("lock-unproven-wait");
    let common: PathBuf = root.join("common");
    std::fs::create_dir(common.as_path()).expect("common");
    let lock: PathBuf = lock_of(common.as_path());
    publish(lock.as_path(), "garbage");
    let mut stderr: Vec<u8> = Vec::new();
    let failure: WorktreeCopyError =
        acquire_worktree_copy_lock(common.as_path(), &mut stderr).expect_err("timeout");
    assert!(
        failure.0.contains("stayed in place for 1000 ms"),
        "{}",
        failure.0
    );
    assert!(
        failure.0.contains("holds an invalid owner record"),
        "{}",
        failure.0
    );
    assert!(lock.join(OWNER_RECORD_NAME).exists());
    assert!(stderr.is_empty());
    remove(root.as_path());
}

/// A release after another owner replaced the lock fails with the ownership-changed wording and keeps the replacement.
#[cfg(unix)]
#[test]
fn replaced_lock_release_fails_and_keeps_replacement() {
    let root: PathBuf = fixture("lock-replaced");
    let common: PathBuf = root.join("common");
    std::fs::create_dir(common.as_path()).expect("common");
    let lease: WorktreeCopyLease = try_acquire_worktree_copy_lock(common.as_path())
        .expect("attempt")
        .expect("free");
    let lock: PathBuf = lock_of(common.as_path());
    std::fs::remove_dir_all(lock.as_path()).expect("drop ours");
    publish(lock.as_path(), DEAD_OWNER);
    let failure: WorktreeCopyError = lease.release().expect_err("changed");
    assert_eq!(
        failure.0,
        format!(
            "cli-git: worktree-copy lock ownership changed: {}.",
            quote(lock.to_string_lossy().as_ref())
        )
    );
    assert!(lock.join(OWNER_RECORD_NAME).exists());
    remove(root.as_path());
}

/// An inherited lease is valid only while the published owner carries that token and is alive.
#[cfg(unix)]
#[test]
fn inherited_lease_requires_the_published_live_token() {
    let root: PathBuf = fixture("lock-inherited");
    let common: PathBuf = root.join("common");
    std::fs::create_dir(common.as_path()).expect("common");
    let lease: WorktreeCopyLease = try_acquire_worktree_copy_lock(common.as_path())
        .expect("attempt")
        .expect("free");
    assert!(validate_inherited_lease(common.as_path(), lease.lease_token()).expect("valid"));
    assert!(!validate_inherited_lease(common.as_path(), "other").expect("other token"));
    assert!(!validate_inherited_lease(common.as_path(), "").expect("empty token"));
    lease.release().expect("released");
    remove(root.as_path());
}

/// A blocking acquisition announces a live holder once on stderr, waits until it releases, then takes the lock.
#[cfg(unix)]
#[test]
fn waiter_names_a_live_holder_and_takes_the_lock_after_release() {
    let root: PathBuf = fixture("lock-waiter");
    let common: PathBuf = root.join("common");
    std::fs::create_dir(common.as_path()).expect("common");
    let held: WorktreeCopyLease = try_acquire_worktree_copy_lock(common.as_path())
        .expect("attempt")
        .expect("free");
    let holder_pid: i64 = i64::from(std::process::id());
    let releaser = std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(150));
        return held.release();
    });
    let mut stderr: Vec<u8> = Vec::new();
    let lease: WorktreeCopyLease =
        acquire_worktree_copy_lock(common.as_path(), &mut stderr).expect("taken after release");
    releaser.join().expect("releaser").expect("released");
    let line: String = String::from_utf8(stderr).expect("utf8");
    assert_eq!(
        line.matches("cli-git: waiting for PID ").count(),
        1,
        "{line}"
    );
    assert!(
        line.contains(&format!("waiting for PID {holder_pid},")),
        "{line}"
    );
    assert!(
        line.contains("proven by its live process identity"),
        "{line}"
    );
    lease.release().expect("released");
    remove(root.as_path());
}

/// A live holder that never releases ends a blocking acquisition at its limit,
///  with a refusal naming the holder, and leaves the holder's lock in place.
#[cfg(unix)]
#[test]
fn a_live_holder_past_the_limit_ends_the_wait_and_keeps_its_lock() {
    let root: PathBuf = fixture("lock-waiter-limit");
    let common: PathBuf = root.join("common");
    std::fs::create_dir(common.as_path()).expect("common");
    let held: WorktreeCopyLease = try_acquire_worktree_copy_lock(common.as_path())
        .expect("attempt")
        .expect("free");
    let holder_pid: i64 = i64::from(std::process::id());
    let common_for_thread: PathBuf = common.clone();
    let (sender, receiver) = std::sync::mpsc::channel::<Result<WorktreeCopyLease, WorktreeCopyError>>();
    std::thread::spawn(move || {
        let mut stderr: Vec<u8> = Vec::new();
        let _sent = sender.send(acquire_worktree_copy_lock_for(
            common_for_thread.as_path(),
            &mut stderr,
            Duration::from_millis(200),
        ));
    });
    let outcome: Result<WorktreeCopyLease, WorktreeCopyError> = match receiver.recv_timeout(Duration::from_secs(10)) {
        Ok(finished) => finished,
        Err(_) => {
            // Releasing the lock lets a wait without a limit finish so the failure is raised with the thread done.
            held.release().expect("released");
            panic!("the wait did not end at its limit");
        }
    };
    let refusal: WorktreeCopyError = outcome.expect_err("refused");
    let text: String = refusal.0;
    assert!(text.starts_with("cli-git: gave up after waiting "), "{text}");
    assert!(
        text.contains(&format!("for PID {holder_pid}, which still holds worktree-copy settlement")),
        "{text}"
    );
    assert!(text.contains("CLI_GIT_LOCK_WAIT_SECONDS sets how long cli-git waits"), "{text}");
    assert!(text.ends_with("cli-git left the lock in place."), "{text}");
    assert!(lock_of(common.as_path()).exists(), "the holder's lock stays");
    held.release().expect("released");
    remove(root.as_path());
}
