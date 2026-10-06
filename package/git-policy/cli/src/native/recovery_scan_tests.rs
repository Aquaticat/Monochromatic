//! Controls for registry-wide recovery.

use super::*;
use crate::owner_lock::try_acquire_owner_lock;
use crate::owner_lock_record::{OwnerLockRecord, encode_owner_lock_record};
use crate::recovery_inspect::tests::owner_bytes;
use crate::recovery_landing::tests::Scene;
use crate::transaction_journal::LandingOperation;
use crate::transaction_registry::{RETIRED_SUFFIX, STAGING_SUFFIX};

/// Second and third transaction IDs.
const SECOND: &str = "1b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10";
/// A third transaction ID.
const THIRD: &str = "2b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10";

/// A directory in the registry with an owner record.
fn add_entry(registry: &Path, name: &str, owner: Option<Vec<u8>>) -> PathBuf {
    let directory: PathBuf = registry.join(name);
    std::fs::create_dir_all(&directory).expect("entry");
    if let Some(bytes) = owner {
        std::fs::write(directory.join("owner.json"), bytes).expect("owner");
    }
    return directory;
}

/// The action recorded for a directory.
fn action_for(outcomes: &[RecoveryOutcome], directory: &Path) -> Option<RecoveryAction> {
    for outcome in outcomes {
        if outcome.directory == directory {
            return Some(outcome.action);
        }
    }
    return None;
}

/// Every kind of entry gets its outcome, and dead landings are recovered under the landing lock.
#[test]
fn every_entry_gets_its_outcome() {
    let scene: Scene = Scene::new("recovery-scan-mixed", false);
    scene.capture();
    scene.land(LandingOperation::Commit, Vec::new());
    let live: PathBuf = add_entry(
        scene.registry.as_path(),
        SECOND,
        Some(owner_bytes(SECOND, "2026-10-06T00:00:01.000Z", true)),
    );
    let retained_name: String = format!("{THIRD}{STAGING_SUFFIX}");
    let retained: PathBuf = add_entry(
        scene.registry.as_path(),
        retained_name.as_str(),
        Some(owner_bytes(THIRD, "2026-10-06T00:00:02.000Z", false)),
    );
    let unattributed_name: String = format!("{SECOND}{STAGING_SUFFIX}");
    let unattributed: PathBuf =
        add_entry(scene.registry.as_path(), unattributed_name.as_str(), None);
    let retired_name: String = format!("{THIRD}{RETIRED_SUFFIX}");
    let retired: PathBuf = add_entry(scene.registry.as_path(), retired_name.as_str(), None);
    std::fs::write(retired.join("leftover"), b"x").expect("leftover");
    // A dead reservation holder's lock is retired.
    let reservation: PathBuf = scene.registry.join(RESERVATION_LOCK_NAME);
    std::fs::create_dir(&reservation).expect("reservation");
    std::fs::write(
        reservation.join("owner.json"),
        encode_owner_lock_record(&OwnerLockRecord {
            token: String::from("t"),
            owner_pid: i64::from(std::process::id()),
            owner_birth_identity: String::from("linux:1"),
            transaction_id: None,
        }),
    )
    .expect("dead reservation");
    let outcomes: Vec<RecoveryOutcome> =
        recover_registered_transactions(&scene.place(), scene.registry.as_path())
            .expect("recovered");
    assert_eq!(outcomes.len(), 5);
    assert_eq!(outcomes[0].directory, scene.directory);
    assert_eq!(outcomes[0].action, RecoveryAction::CommitNotCreated);
    assert_eq!(
        action_for(outcomes.as_slice(), live.as_path()),
        Some(RecoveryAction::OwnerActive)
    );
    assert_eq!(
        action_for(outcomes.as_slice(), retained.as_path()),
        Some(RecoveryAction::StagingRetained)
    );
    assert_eq!(
        action_for(outcomes.as_slice(), unattributed.as_path()),
        Some(RecoveryAction::StagingUnattributed)
    );
    assert_eq!(
        action_for(outcomes.as_slice(), retired.as_path()),
        Some(RecoveryAction::RetiredRemoved)
    );
    assert_eq!(outcomes[4].action, RecoveryAction::RetiredRemoved);
    assert!(!scene.directory.exists());
    assert!(live.exists());
    assert!(retained.exists());
    assert!(unattributed.exists());
    assert!(!retired.exists());
    assert!(!reservation.exists());
    // The landing lock was taken and released.
    assert!(!scene.registry.join(LANDING_LOCK_NAME).exists());
    scene.finish();
}

/// A dead transaction with only an index-lock record is recovered once, by the landing pass,
/// when another dead landing takes the landing lock.
#[test]
fn landing_pass_entries_are_recovered_once() {
    let scene: Scene = Scene::new("recovery-scan-once", false);
    scene.capture();
    scene.land(LandingOperation::Commit, Vec::new());
    // A second dead transaction that only recorded a lock attempt.
    let second: PathBuf = add_entry(
        scene.registry.as_path(),
        SECOND,
        Some(owner_bytes(SECOND, "2026-10-06T00:00:01.000Z", false)),
    );
    std::fs::write(
        second.join("index-lock-1.json"),
        std::fs::read(scene.directory.join("index-lock-1.json")).expect("record"),
    )
    .expect("second lock record");
    let outcomes: Vec<RecoveryOutcome> =
        recover_registered_transactions(&scene.place(), scene.registry.as_path())
            .expect("recovered");
    assert_eq!(outcomes.len(), 2);
    assert_eq!(
        action_for(outcomes.as_slice(), second.as_path()),
        Some(RecoveryAction::CommitNotCreated)
    );
    assert!(!second.exists());
    assert!(recovered_already(outcomes.as_slice(), second.as_path()));
    assert!(!recovered_already(
        outcomes.as_slice(),
        scene.root.as_path()
    ));
    scene.finish();
}

/// Without landing records nothing takes the landing lock, so a held one does not block.
#[test]
fn transactions_without_landings_need_no_landing_lock() {
    let scene: Scene = Scene::new("recovery-scan-no-landing", false);
    scene.capture();
    let held: crate::owner_lock::OwnerLock =
        try_acquire_owner_lock(scene.registry.join(LANDING_LOCK_NAME).as_path(), None)
            .expect("acquire")
            .expect("free");
    let outcomes: Vec<RecoveryOutcome> =
        recover_registered_transactions(&scene.place(), scene.registry.as_path())
            .expect("recovered");
    assert_eq!(outcomes.len(), 1);
    assert_eq!(outcomes[0].action, RecoveryAction::CommitNotCreated);
    held.release().expect("release");
    scene.finish();
}

/// A failure stops recovery at that transaction and keeps its directory.
#[test]
fn failures_keep_their_directory() {
    let scene: Scene = Scene::new("recovery-scan-failure", false);
    std::fs::write(scene.directory.join("journal.json"), b"{}").expect("unreleased");
    assert!(recover_registered_transactions(&scene.place(), scene.registry.as_path()).is_err());
    assert!(scene.directory.exists());
    // A landing pass failure releases the landing lock.
    std::fs::remove_file(scene.directory.join("journal.json")).expect("remove");
    std::fs::write(scene.directory.join("landing-1.json"), b"{}").expect("malformed landing");
    std::fs::write(scene.directory.join("preparing.json"), b"{}").expect("malformed preparing");
    assert!(recover_registered_transactions(&scene.place(), scene.registry.as_path()).is_err());
    assert!(!scene.registry.join(LANDING_LOCK_NAME).exists());
    assert!(scene.directory.exists());
    // An unsafe registry entry fails before anything is recovered.
    std::fs::write(scene.registry.join("stray"), b"").expect("stray");
    assert!(recover_registered_transactions(&scene.place(), scene.registry.as_path()).is_err());
    // A live reservation holder keeps its lock.
    std::fs::remove_file(scene.registry.join("stray")).expect("remove stray");
    std::fs::remove_dir_all(&scene.directory).expect("remove transaction");
    let reservation: crate::owner_lock::OwnerLock =
        try_acquire_owner_lock(scene.registry.join(RESERVATION_LOCK_NAME).as_path(), None)
            .expect("acquire")
            .expect("free");
    assert_eq!(
        recover_registered_transactions(&scene.place(), scene.registry.as_path()).expect("empty"),
        Vec::new()
    );
    assert!(scene.registry.join(RESERVATION_LOCK_NAME).exists());
    reservation.release().expect("release");
    scene.finish();
}

/// Registry locks wait for their owner and report failures.
#[test]
fn registry_locks_are_owner_locks() {
    let scene: Scene = Scene::new("recovery-scan-lock", true);
    let lock: crate::owner_lock::OwnerLock =
        acquire_registry_lock(scene.registry.as_path(), LANDING_LOCK_NAME).expect("acquire");
    assert!(
        scene
            .registry
            .join(LANDING_LOCK_NAME)
            .join("owner.json")
            .exists()
    );
    lock.release().expect("release");
    std::fs::write(scene.registry.join("file.lock"), b"").expect("file in the way");
    assert!(acquire_registry_lock(scene.registry.join("file.lock").as_path(), "x").is_err());
    scene.finish();
}
