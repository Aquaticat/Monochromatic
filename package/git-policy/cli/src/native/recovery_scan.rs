//! What: Startup recovery across every per-transaction directory of one worktree.
//! Why: Live owners are skipped; dead owners are recovered oldest first; dead transactions that
//!      entered the landing critical section are recovered only while holding the landing lock,
//!      so recovery never races a live lander (`src/policy-engine/commit-transaction-recovery-scan.ts`,
//!      `commit-landing-lock.ts`).
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! const outcomes = await recoverRegisteredTransactions({ root, gitPath, effectiveCwd });
//! ```

/// Debug diagnostics.
use super::diagnostic_log::debug;
/// Owner locks.
use super::owner_lock::{
    DEFAULT_POLL_DELAY, OwnerLock, SilentWait, acquire_owner_lock, retire_lock_of_dead_owner,
};
/// The fail-closed recovery failure.
use super::recovery_error::{RecoveryError, io_failure};
/// Landing evidence.
use super::recovery_evidence::{entered_landing, has_landing_record};
/// Owner inspection and order.
use super::recovery_inspect::{
    InspectedEntry, OwnerEvidence, inspect_registry_entry, oldest_first,
};
/// Dead-transaction recovery.
use super::recovery_landing::{RecoveryAction, RecoveryPlace, recover_dead_transaction};
/// Owner liveness.
use super::transaction_owner::OwnerLiveness;
/// Registry listing and names.
use super::transaction_registry::{
    EntryKind, LANDING_LOCK_NAME, RESERVATION_LOCK_NAME, RegistryEntry, list_transaction_entries,
};
/// `Path`/`PathBuf` are borrowed/owned filesystem paths.
use std::path::{Path, PathBuf};

/// What: What recovery did for one directory.
/// Why:  `CommitTransactionRecoveryOutcome`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type CommitTransactionRecoveryOutcome = { directory: string; action: CommitTransactionRecoveryAction };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecoveryOutcome {
    /// The directory examined.
    pub directory: PathBuf,
    /// What recovery did, or why it left the directory.
    pub action: RecoveryAction,
}

/// What: Recover or skip one inspected entry without a landing record, or one whose landing the
///       caller serializes.
/// Why:  `recoverInspectedEntry`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function recoverInspectedEntry({ inspected, gitPath, effectiveCwd }): Promise<CommitTransactionRecoveryAction>;
/// ```
pub fn recover_inspected_entry(
    place: &RecoveryPlace,
    inspected: &InspectedEntry,
) -> Result<RecoveryAction, RecoveryError> {
    let path: &Path = inspected.entry.path.as_path();
    match &inspected.owner {
        OwnerEvidence::Vanished => {
            debug(
                "recoverInspectedEntry",
                format!(
                    "transaction finished while recovery listed it: {}",
                    path.display()
                )
                .as_str(),
            );
            return Ok(RecoveryAction::Vanished);
        }
        OwnerEvidence::Unattributed => {
            debug(
                "recoverInspectedEntry",
                format!(
                    "staging candidate without a complete owner record left in place: {}",
                    path.display()
                )
                .as_str(),
            );
            return Ok(RecoveryAction::StagingUnattributed);
        }
        OwnerEvidence::Owned(record, OwnerLiveness::Alive) => {
            debug(
                "recoverInspectedEntry",
                format!(
                    "transaction owner {} is active; skipping {}",
                    record.owner_pid,
                    path.display()
                )
                .as_str(),
            );
            return Ok(RecoveryAction::OwnerActive);
        }
        OwnerEvidence::Owned(record, OwnerLiveness::Dead) => {
            if inspected.entry.kind == EntryKind::Staging {
                // An unpublished candidate never started capture, so it touched nothing outside
                // itself and remains for diagnosis.
                debug(
                    "recoverInspectedEntry",
                    format!(
                        "dead owner stopped before publishing; staging candidate kept: {}",
                        path.display()
                    )
                    .as_str(),
                );
                return Ok(RecoveryAction::StagingRetained);
            }
            return recover_dead_transaction(
                place,
                path,
                inspected.entry.transaction_id.as_str(),
                record.owner_pid,
            );
        }
    }
}

/// What: Whether an inspected entry is a dead published transaction holding a landing record.
/// Why:  `needsLandingLock`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function needsLandingLock(inspected: InspectedEntry): Promise<boolean>;
/// ```
fn needs_landing_lock(inspected: &InspectedEntry) -> Result<bool, RecoveryError> {
    if inspected.entry.kind != EntryKind::Transaction || inspected.dead_owner().is_none() {
        return Ok(false);
    }
    return has_landing_record(inspected.entry.path.as_path());
}

/// What: Recover every dead published transaction that entered the landing critical section; the
///       caller holds the landing lock.
/// Why:  `recoverDeadLandings`: an owner killed while holding the landing lock and `index.lock`
///       has no landing record yet, and its `index.lock` would block the next landing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function recoverDeadLandings({ root, gitPath, effectiveCwd }): Promise<readonly CommitTransactionRecoveryOutcome[]>;
/// ```
pub fn recover_dead_landings(
    place: &RecoveryPlace,
    root: &Path,
) -> Result<Vec<RecoveryOutcome>, RecoveryError> {
    let mut inspected: Vec<InspectedEntry> = Vec::new();
    for entry in list_transaction_entries(root)? {
        if entry.kind == EntryKind::Transaction {
            inspected.push(inspect_registry_entry(&entry)?);
        }
    }
    // `mut` allows collecting outcomes in recovery order.
    let mut outcomes: Vec<RecoveryOutcome> = Vec::new();
    for item in oldest_first(inspected) {
        let Some(record) = item.dead_owner() else {
            continue;
        };
        if !entered_landing(item.entry.path.as_path())? {
            continue;
        }
        debug(
            "recoverDeadLandings",
            format!("recovering dead landing {}", item.entry.path.display()).as_str(),
        );
        let action: RecoveryAction = recover_dead_transaction(
            place,
            item.entry.path.as_path(),
            item.entry.transaction_id.as_str(),
            record.owner_pid,
        )?;
        outcomes.push(RecoveryOutcome {
            directory: item.entry.path.clone(),
            action,
        });
    }
    return Ok(outcomes);
}

/// What: Take the landing lock, waiting while a live owner holds it.
/// Why:  Recovery of a landing must never race a live lander.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// await acquireOwnerLock({ lockDirectory: join(root, LANDING_LOCK_NAME) })
/// ```
pub fn acquire_registry_lock(root: &Path, name: &str) -> Result<OwnerLock, RecoveryError> {
    let directory: PathBuf = root.join(name);
    // `mut` is required by the notice interface; this wait is silent, as the incumbent's.
    let mut silent: SilentWait = SilentWait;
    match acquire_owner_lock(directory.as_path(), DEFAULT_POLL_DELAY, &mut silent) {
        Ok(lock) => return Ok(lock),
        Err(error) => return Err(RecoveryError(error.to_string())),
    }
}

/// What: Whether an outcome already names a directory.
/// Why:  The landing pass may have recovered an entry the main pass would visit again.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// outcomes.some((outcome) => outcome.directory === path)
/// ```
fn recovered_already(outcomes: &[RecoveryOutcome], path: &Path) -> bool {
    for outcome in outcomes {
        if outcome.directory == path {
            return true;
        }
    }
    return false;
}

/// What: Recover every dead-owner transaction of one worktree registry and remove retired
///       leftovers; a dead reservation holder's lock is retired too.
/// Why:  `recoverRegisteredTransactions`. Unlike the incumbent, an entry the landing pass already
///       recovered is not recovered a second time (the incumbent would fail reading its removed
///       directory; recorded in `doc/handover/cli-git-native-transactions.md`).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function recoverRegisteredTransactions({ root, gitPath, effectiveCwd }): Promise<readonly CommitTransactionRecoveryOutcome[]>;
/// ```
pub fn recover_registered_transactions(
    place: &RecoveryPlace,
    root: &Path,
) -> Result<Vec<RecoveryOutcome>, RecoveryError> {
    let entries: Vec<RegistryEntry> = list_transaction_entries(root)?;
    let mut inspected: Vec<InspectedEntry> = Vec::new();
    let mut retired: Vec<PathBuf> = Vec::new();
    for entry in &entries {
        if entry.kind == EntryKind::Retired {
            retired.push(entry.path.clone());
        } else {
            inspected.push(inspect_registry_entry(entry)?);
        }
    }
    let ordered: Vec<InspectedEntry> = oldest_first(inspected);
    let mut needs: Vec<bool> = Vec::with_capacity(ordered.len());
    for item in &ordered {
        needs.push(needs_landing_lock(item)?);
    }
    let mut outcomes: Vec<RecoveryOutcome> = Vec::new();
    if needs.contains(&true) {
        let lock: OwnerLock = acquire_registry_lock(root, LANDING_LOCK_NAME)?;
        let recovered: Result<Vec<RecoveryOutcome>, RecoveryError> =
            recover_dead_landings(place, root);
        let released: Result<(), super::owner_lock::OwnerLockError> = lock.release();
        outcomes.extend(recovered?);
        if let Err(error) = released {
            return Err(RecoveryError(error.to_string()));
        }
    }
    for (index, item) in ordered.iter().enumerate() {
        if needs[index] || recovered_already(outcomes.as_slice(), item.entry.path.as_path()) {
            continue;
        }
        let action: RecoveryAction = recover_inspected_entry(place, item)?;
        outcomes.push(RecoveryOutcome {
            directory: item.entry.path.clone(),
            action,
        });
    }
    for path in &retired {
        if let Err(error) = super::private_storage::remove_tree(path.as_path()) {
            return Err(io_failure(
                "removing the retired transaction",
                path.as_path(),
                &error,
            ));
        }
    }
    // A crashed reservation holder's lock is retired here as well as by the next requester.
    if let Err(error) = retire_lock_of_dead_owner(root.join(RESERVATION_LOCK_NAME).as_path()) {
        return Err(RecoveryError(error.to_string()));
    }
    for path in retired {
        outcomes.push(RecoveryOutcome {
            directory: path,
            action: RecoveryAction::RetiredRemoved,
        });
    }
    return Ok(outcomes);
}

/// Registry recovery controls stay out of the release executable.
#[cfg(test)]
#[path = "recovery_scan_tests.rs"]
mod tests;
