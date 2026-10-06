//! Controls for owner locks between real processes: a helper process started from this test
//! binary holds a lock, and this process waits for it, retires it once it is dead, or finds
//! it changed.

use super::*;
use crate::owner_lock_record::{OwnerLockRecord, encode_owner_lock_record};
use crate::process_identity::{current_birth_identity, process_birth_identity};
use crate::test_support::{fixture, remove};
use std::process::{Child, Command};
use std::time::Instant;

/// Variable naming the lock the helper process holds.
const HELPER_LOCK: &str = "OWNER_LOCK_TEST_HELPER_LOCK";
/// Variable naming the file the helper writes once it holds the lock.
const HELPER_READY: &str = "OWNER_LOCK_TEST_HELPER_READY";
/// Variable holding how long, in milliseconds, the helper holds the lock before releasing.
const HELPER_HOLD_MS: &str = "OWNER_LOCK_TEST_HELPER_HOLD_MS";

/// Helper process body, started by other tests: hold the lock, announce it, release later.
#[test]
#[ignore = "started as a helper process by the owner-lock tests"]
fn helper_holds_a_lock() {
    let lock_directory: PathBuf = PathBuf::from(std::env::var_os(HELPER_LOCK).expect("lock"));
    let ready: PathBuf = PathBuf::from(std::env::var_os(HELPER_READY).expect("ready"));
    let hold: u64 = std::env::var(HELPER_HOLD_MS)
        .expect("hold")
        .parse()
        .expect("hold milliseconds");
    let lock: OwnerLock = try_acquire_owner_lock(lock_directory.as_path(), None)
        .expect("acquire")
        .expect("free");
    std::fs::write(&ready, std::process::id().to_string()).expect("announce");
    std::thread::sleep(Duration::from_millis(hold));
    lock.release().expect("release");
}

/// Start the helper on `lock_directory` and wait until it holds the lock.
fn start_holder(root: &Path, lock_directory: &Path, hold_ms: u64) -> Child {
    let ready: PathBuf = root.join(format!("ready-{hold_ms}"));
    let child: Child = Command::new(std::env::current_exe().expect("test binary"))
        .args([
            "--exact",
            "owner_lock::tests::helper_holds_a_lock",
            "--ignored",
            "--test-threads=1",
            "--quiet",
        ])
        .env(HELPER_LOCK, lock_directory)
        .env(HELPER_READY, &ready)
        .env(HELPER_HOLD_MS, hold_ms.to_string())
        .spawn()
        .expect("start the helper");
    let started: Instant = Instant::now();
    while !ready.exists() {
        assert!(
            started.elapsed() < Duration::from_secs(30),
            "the helper never took the lock"
        );
        std::thread::sleep(Duration::from_millis(5));
    }
    return child;
}

/// The entries of a directory, sorted, for leftover checks.
fn entries(directory: &Path) -> Vec<String> {
    let mut names: Vec<String> = Vec::new();
    for entry in std::fs::read_dir(directory).expect("list") {
        names.push(
            entry
                .expect("entry")
                .file_name()
                .to_string_lossy()
                .into_owned(),
        );
    }
    names.sort();
    return names;
}

/// Plant a published lock whose record names `pid` with `identity`.
fn plant(lock_directory: &Path, pid: i64, identity: &str, token: &str) {
    std::fs::create_dir(lock_directory).expect("planted lock");
    let record: OwnerLockRecord = OwnerLockRecord {
        token: String::from(token),
        owner_pid: pid,
        owner_birth_identity: String::from(identity),
        transaction_id: None,
    };
    std::fs::write(
        lock_directory.join(OWNER_LOCK_RECORD_FILENAME),
        encode_owner_lock_record(&record),
    )
    .expect("planted record");
}

/// The token a published lock names now.
fn token_of(lock_directory: &Path) -> String {
    match read_owner_lock_record(lock_directory).expect("readable") {
        PublishedOwner::Owner(record) => return record.token,
        PublishedOwner::Busy => panic!("no owner at {}", lock_directory.display()),
    }
}

/// Counts how often the wait notice ran.
#[derive(Default)]
struct WaitCounter {
    /// Number of notices.
    count: u32,
}

/// The wait notice counts.
impl WaitNotice for WaitCounter {
    /// Record one notice.
    fn waiting(&mut self) {
        self.count += 1;
    }
}

/// A live holder blocks a try, and a waiting acquirer gets the lock once it is released,
/// after exactly one wait notice.
#[test]
fn a_live_holder_blocks_until_it_releases() {
    let root: PathBuf = fixture("owner-lock-live");
    let lock_directory: PathBuf = root.join("landing.lock");
    let mut holder: Child = start_holder(root.as_path(), lock_directory.as_path(), 400);
    let held_token: String = token_of(lock_directory.as_path());
    assert!(
        try_acquire_owner_lock(lock_directory.as_path(), None)
            .expect("try")
            .is_none()
    );
    assert_eq!(
        token_of(lock_directory.as_path()),
        held_token,
        "the live lock is untouched"
    );
    let mut counter: WaitCounter = WaitCounter::default();
    let started: Instant = Instant::now();
    let lock: OwnerLock =
        acquire_owner_lock(lock_directory.as_path(), DEFAULT_POLL_DELAY, &mut counter)
            .expect("acquire after release");
    assert!(
        started.elapsed() >= Duration::from_millis(100),
        "the acquirer waited"
    );
    assert_eq!(counter.count, 1);
    assert_ne!(lock.token(), held_token);
    assert_eq!(lock.directory(), lock_directory.as_path());
    assert!(holder.wait().expect("helper exit").success());
    lock.release().expect("release");
    assert_eq!(
        entries(root.as_path()),
        ["ready-400"],
        "no candidate or stale lock remains"
    );
    remove(root.as_path());
}

/// A killed and reaped holder is dead: the next acquirer retires its lock and takes it.
#[test]
fn a_killed_holders_lock_is_retired() {
    let root: PathBuf = fixture("owner-lock-killed");
    let lock_directory: PathBuf = root.join("hook.lock");
    let mut holder: Child = start_holder(root.as_path(), lock_directory.as_path(), 60_000);
    holder.kill().expect("kill the holder");
    holder.wait().expect("reap the holder");
    let lock: OwnerLock = acquire_owner_lock(
        lock_directory.as_path(),
        DEFAULT_POLL_DELAY,
        &mut SilentWait,
    )
    .expect("acquire over a dead owner");
    assert_eq!(token_of(lock_directory.as_path()), lock.token());
    drop(lock);
    assert!(!lock_directory.exists(), "dropping the lock released it");
    assert_eq!(entries(root.as_path()), ["ready-60000"]);
    remove(root.as_path());
}

/// A killed holder that nobody reaped is a zombie, and a zombie is dead.
#[cfg(target_os = "linux")]
#[test]
fn a_zombie_holders_lock_is_retired() {
    let root: PathBuf = fixture("owner-lock-zombie");
    let lock_directory: PathBuf = root.join("capture.lock");
    let mut holder: Child = start_holder(root.as_path(), lock_directory.as_path(), 60_000);
    let pid: i64 = i64::from(holder.id());
    holder.kill().expect("kill the holder");
    // The killed child stays a zombie until `wait`; wait for the kernel to mark it.
    let started: Instant = Instant::now();
    while process_birth_identity(pid).expect("probe").is_some() {
        assert!(
            started.elapsed() < Duration::from_secs(10),
            "the holder never exited"
        );
        std::thread::sleep(Duration::from_millis(5));
    }
    assert!(
        std::path::Path::new(&format!("/proc/{pid}")).exists(),
        "still a zombie"
    );
    let mut first: Option<OwnerLock> =
        try_acquire_owner_lock(lock_directory.as_path(), None).expect("first try");
    if first.is_none() {
        // The first attempt retired the zombie's lock; the second publishes.
        first = try_acquire_owner_lock(lock_directory.as_path(), None).expect("second try");
    }
    let lock: OwnerLock = first.expect("the zombie's lock was retired");
    holder.wait().expect("reap the holder");
    lock.release().expect("release");
    remove(root.as_path());
}

/// A lock whose PID now names a younger process (here this one, with another birth) is dead.
#[test]
fn a_reused_pid_is_a_dead_owner() {
    let root: PathBuf = fixture("owner-lock-reused");
    let lock_directory: PathBuf = root.join("reservation.lock");
    plant(
        lock_directory.as_path(),
        i64::from(std::process::id()),
        "linux:1",
        "old",
    );
    assert!(
        try_acquire_owner_lock(lock_directory.as_path(), None)
            .expect("retiring try")
            .is_none(),
        "the first try retires and reports busy"
    );
    assert!(!lock_directory.exists(), "the dead lock was retired");
    let lock: OwnerLock = try_acquire_owner_lock(lock_directory.as_path(), Some("tx-1"))
        .expect("second try")
        .expect("free now");
    let PublishedOwner::Owner(record) =
        read_owner_lock_record(lock_directory.as_path()).expect("record")
    else {
        panic!("the new lock has an owner");
    };
    assert_eq!(record.transaction_id.as_deref(), Some("tx-1"));
    assert_eq!(record.owner_pid, i64::from(std::process::id()));
    assert_eq!(
        record.owner_birth_identity,
        current_birth_identity().expect("own")
    );
    lock.release().expect("release");
    remove(root.as_path());
}

/// A lock named by another live process with its true birth identity is never retired.
#[cfg(target_os = "linux")]
#[test]
fn a_live_foreign_owner_is_kept() {
    let root: PathBuf = fixture("owner-lock-foreign");
    let lock_directory: PathBuf = root.join("push.lock");
    let mut sleeper: Child = Command::new("sleep").arg("60").spawn().expect("sleeper");
    let pid: i64 = i64::from(sleeper.id());
    let identity: String = process_birth_identity(pid).expect("probe").expect("alive");
    plant(lock_directory.as_path(), pid, identity.as_str(), "foreign");
    for _ in 0..3 {
        assert!(
            try_acquire_owner_lock(lock_directory.as_path(), None)
                .expect("try")
                .is_none()
        );
        assert_eq!(token_of(lock_directory.as_path()), "foreign");
    }
    retire_lock_of_dead_owner(lock_directory.as_path()).expect("retire a live owner");
    assert_eq!(
        token_of(lock_directory.as_path()),
        "foreign",
        "a live owner is kept"
    );
    sleeper.kill().expect("kill");
    sleeper.wait().expect("reap");
    retire_lock_of_dead_owner(lock_directory.as_path()).expect("retire the dead owner");
    assert!(!lock_directory.exists());
    retire_lock_of_dead_owner(lock_directory.as_path()).expect("absent lock");
    assert!(entries(root.as_path()).is_empty(), "no stale copy remains");
    remove(root.as_path());
}

/// Releasing a lock that names another owner fails and leaves that owner's lock in place.
#[test]
fn a_changed_owner_is_reported_on_release() {
    let root: PathBuf = fixture("owner-lock-changed");
    let lock_directory: PathBuf = root.join("landing.lock");
    let lock: OwnerLock = try_acquire_owner_lock(lock_directory.as_path(), None)
        .expect("try")
        .expect("free");
    let record: PathBuf = lock_directory.join(OWNER_LOCK_RECORD_FILENAME);
    std::fs::remove_file(&record).expect("remove record");
    plant_record(record.as_path(), "intruder");
    let error: OwnerLockError = lock.release().expect_err("ownership changed");
    assert!(matches!(error, OwnerLockError::OwnershipChanged(_)));
    assert_eq!(token_of(lock_directory.as_path()), "intruder");
    remove(root.as_path());
}

/// Write a record naming this process with `token` at `path`.
fn plant_record(path: &Path, token: &str) {
    let record: OwnerLockRecord = OwnerLockRecord {
        token: String::from(token),
        owner_pid: i64::from(std::process::id()),
        owner_birth_identity: current_birth_identity().expect("own"),
        transaction_id: None,
    };
    std::fs::write(path, encode_owner_lock_record(&record)).expect("record");
}

/// After the rename, a moved lock that is someone else's goes back and the release fails;
/// this holder's moved lock is deleted.
#[test]
fn a_release_settles_the_moved_copy() {
    let root: PathBuf = fixture("owner-lock-settle-release");
    let lock_directory: PathBuf = root.join("hook.lock");
    let moved: PathBuf = root.join("hook.lock.x.stale");
    std::fs::create_dir(&moved).expect("moved");
    plant_record(moved.join(OWNER_LOCK_RECORD_FILENAME).as_path(), "other");
    assert!(matches!(
        settle_moved_release(moved.as_path(), lock_directory.as_path(), "mine"),
        Err(OwnerLockError::OwnershipChanged(_))
    ));
    assert_eq!(
        token_of(lock_directory.as_path()),
        "other",
        "the other lock is restored"
    );
    std::fs::rename(&lock_directory, &moved).expect("move again");
    settle_moved_release(moved.as_path(), lock_directory.as_path(), "other").expect("mine");
    assert!(entries(root.as_path()).is_empty());
    remove(root.as_path());
}

/// After the rename, a retirement deletes the dead owner's moved lock but restores a live
/// replacement moved by a race; an occupied published name is left to its new owner.
#[test]
fn a_retirement_settles_the_moved_copy() {
    let root: PathBuf = fixture("owner-lock-settle-retire");
    let lock_directory: PathBuf = root.join("landing.lock");
    let moved: PathBuf = root.join("landing.lock.x.stale");
    std::fs::create_dir(&moved).expect("moved");
    plant_record(
        moved.join(OWNER_LOCK_RECORD_FILENAME).as_path(),
        "replacement",
    );
    settle_moved_retirement(moved.as_path(), lock_directory.as_path(), "dead").expect("restore");
    assert_eq!(token_of(lock_directory.as_path()), "replacement");
    std::fs::rename(&lock_directory, &moved).expect("move again");
    plant(lock_directory.as_path(), 1, "linux:1", "newest");
    settle_moved_retirement(moved.as_path(), lock_directory.as_path(), "dead")
        .expect("occupied name");
    assert_eq!(
        token_of(lock_directory.as_path()),
        "newest",
        "the newer owner is kept"
    );
    assert!(
        moved.exists(),
        "the moved replacement could not go back and is kept"
    );
    std::fs::remove_dir_all(&moved).expect("clean");
    std::fs::create_dir(&moved).expect("moved dead lock");
    plant_record(moved.join(OWNER_LOCK_RECORD_FILENAME).as_path(), "dead");
    settle_moved_retirement(moved.as_path(), lock_directory.as_path(), "dead").expect("delete");
    assert!(!moved.exists(), "the dead owner's lock is deleted");
    remove(root.as_path());
}

/// A lock that changed owner, or vanished, before the retirement's rename is left alone.
#[test]
fn a_retirement_rechecks_the_owner_first() {
    let root: PathBuf = fixture("owner-lock-recheck");
    let lock_directory: PathBuf = root.join("reservation.lock");
    plant(lock_directory.as_path(), 1, "linux:1", "successor");
    retire_dead_lock(lock_directory.as_path(), "dead").expect("changed owner");
    assert_eq!(token_of(lock_directory.as_path()), "successor");
    std::fs::remove_dir_all(&lock_directory).expect("vanish");
    retire_dead_lock(lock_directory.as_path(), "successor").expect("vanished lock");
    assert!(entries(root.as_path()).is_empty());
    remove(root.as_path());
}

/// A malformed blocking record stops the acquirer and stays in place.
#[test]
fn a_malformed_blocking_record_stops_the_acquirer() {
    let root: PathBuf = fixture("owner-lock-malformed");
    let lock_directory: PathBuf = root.join("hook.lock");
    std::fs::create_dir(&lock_directory).expect("lock");
    std::fs::write(lock_directory.join(OWNER_LOCK_RECORD_FILENAME), b"{").expect("record");
    let error: OwnerLockError = acquire_owner_lock(
        lock_directory.as_path(),
        DEFAULT_POLL_DELAY,
        &mut SilentWait,
    )
    .expect_err("malformed");
    assert!(matches!(error, OwnerLockError::Record(_)));
    assert!(
        error
            .to_string()
            .ends_with("hook.lock/owner.json is malformed")
    );
    assert_eq!(
        std::fs::read(lock_directory.join(OWNER_LOCK_RECORD_FILENAME)).expect("kept"),
        b"{"
    );
    assert_eq!(
        entries(root.as_path()),
        ["hook.lock"],
        "the candidate was removed"
    );
    remove(root.as_path());
}

/// A lock whose parent is missing cannot be published, and the failure names the step.
#[test]
fn a_missing_parent_is_an_io_failure() {
    let root: PathBuf = fixture("owner-lock-parent");
    let lock_directory: PathBuf = root.join("missing/landing.lock");
    let error: OwnerLockError =
        try_acquire_owner_lock(lock_directory.as_path(), None).expect_err("no parent");
    assert!(matches!(
        error,
        OwnerLockError::Io {
            operation: "creating the lock candidate",
            ..
        }
    ));
    assert!(
        error
            .to_string()
            .starts_with("creating the lock candidate ")
    );
    remove(root.as_path());
}

/// Occupied-name errors are exactly the incumbent's three codes.
#[test]
fn occupied_names_are_recognized() {
    for kind in [
        std::io::ErrorKind::AlreadyExists,
        std::io::ErrorKind::DirectoryNotEmpty,
        std::io::ErrorKind::PermissionDenied,
    ] {
        assert!(is_occupied_error(&std::io::Error::from(kind)), "{kind:?}");
    }
    for kind in [std::io::ErrorKind::NotFound, std::io::ErrorKind::Other] {
        assert!(!is_occupied_error(&std::io::Error::from(kind)), "{kind:?}");
    }
}

/// Every failure is described with the lock it concerns.
#[test]
fn failures_are_described() {
    let path: PathBuf = PathBuf::from("/repo/.git/cli-git/hook.lock");
    assert_eq!(
        OwnerLockError::OwnershipChanged(path.clone()).to_string(),
        "the owner lock /repo/.git/cli-git/hook.lock changed owner while it was held"
    );
    assert_eq!(
        OwnerLockError::Record(OwnerRecordError::Unreadable(
            path.join("owner.json"),
            std::io::Error::from(std::io::ErrorKind::PermissionDenied)
        ))
        .to_string(),
        "the owner lock record /repo/.git/cli-git/hook.lock/owner.json could not be read: \
         permission denied"
    );
    assert_eq!(
        OwnerLockError::Identity(crate::process_identity::ProcessIdentityError::CurrentUnavailable)
            .to_string(),
        "the birth identity of the current process is unavailable"
    );
    assert_eq!(
        OwnerLockError::Random(crate::random_id::RandomSourceError(String::from(
            "no source"
        )))
        .to_string(),
        "no source"
    );
}

/// Interoperability probe, run by `native-interop/owner-locks.mjs` in the interoperability
/// image: one native lock or identity operation chosen by `INTEROP_ACTION`, its answer on
/// standard output for the driver to compare with the incumbent.
#[test]
#[ignore = "run by the interoperability drivers, which set INTEROP_ACTION"]
fn interop_probe() {
    let action: String = std::env::var("INTEROP_ACTION").expect("INTEROP_ACTION");
    if action == "identity" {
        let pid: i64 = std::env::var("INTEROP_PID")
            .expect("INTEROP_PID")
            .parse()
            .expect("PID");
        match process_birth_identity(pid).expect("identity probe") {
            Some(identity) => println!("identity={identity}"),
            None => println!("identity-absent"),
        }
        return;
    }
    let lock_directory: PathBuf = PathBuf::from(std::env::var_os("INTEROP_LOCK").expect("lock"));
    if action == "try" {
        match try_acquire_owner_lock(lock_directory.as_path(), None).expect("try") {
            Some(lock) => {
                println!("acquired");
                lock.release().expect("release");
            }
            None => println!("busy"),
        }
        return;
    }
    if action == "acquire" {
        let lock: OwnerLock = acquire_owner_lock(
            lock_directory.as_path(),
            DEFAULT_POLL_DELAY,
            &mut SilentWait,
        )
        .expect("acquire");
        println!("acquired");
        lock.release().expect("release");
        return;
    }
    assert_eq!(action, "hold", "unknown INTEROP_ACTION");
    let ready: PathBuf = PathBuf::from(std::env::var_os("INTEROP_READY").expect("ready"));
    let release: PathBuf = PathBuf::from(std::env::var_os("INTEROP_RELEASE").expect("release"));
    let lock: OwnerLock = try_acquire_owner_lock(lock_directory.as_path(), None)
        .expect("try")
        .expect("the lock is free");
    std::fs::write(&ready, std::process::id().to_string()).expect("announce");
    while !release.exists() {
        std::thread::sleep(Duration::from_millis(20));
    }
    lock.release().expect("release");
    println!("released");
}
