//! What: Owner inspection of one transaction registry entry, and the oldest-first recovery order.
//! Why: Live owners are skipped, dead owners recovered, and a published directory without a valid
//!      owner record fails closed; recovery runs oldest first because a later transaction was
//!      prepared against the state an earlier one left
//!      (`src/policy-engine/commit-transaction-recovery-inspect.ts`, `commit-landing-lock.ts`).
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! const inspected = oldestFirst(await Promise.all(entries.map(inspectRegistryEntry)));
//! ```

/// Debug diagnostics.
use super::diagnostic_log::debug;
/// Bounded no-follow reads.
use super::private_storage::{ReadRefusal, read_regular_file};
/// The fail-closed recovery failure.
use super::recovery_error::{RecoveryError, io_failure};
/// The recovery read limit and existence probes.
use super::recovery_files::{RECOVERY_FILE_LIMIT, recovery_path_exists};
/// Owner records and liveness.
use super::transaction_owner::{
    OwnerLiveness, OwnerLivenessError, TransactionOwner, classify_transaction_owner,
    parse_transaction_owner,
};
/// Registry entries.
use super::transaction_registry::{EntryKind, OWNER_FILENAME, RegistryEntry};
/// `PathBuf` is an owned filesystem path.
use std::path::PathBuf;

/// What: An entry's owner evidence: its record and liveness, or why none can be attributed.
/// Why:  `InspectedEntry['owner']`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Owner = { record; liveness } | 'vanished' | 'unattributed';
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OwnerEvidence {
    /// A complete owner record and whether its process still runs.
    Owned(TransactionOwner, OwnerLiveness),
    /// The directory disappeared while recovery listed it: its owner finished.
    Vanished,
    /// A staging candidate without a complete owner record.
    Unattributed,
}

/// What: One registry entry with its owner evidence.
/// Why:  `InspectedEntry`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type InspectedEntry = { entry: TransactionRegistryEntry; owner: Owner };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InspectedEntry {
    /// The classified entry.
    pub entry: RegistryEntry,
    /// Its owner evidence.
    pub owner: OwnerEvidence,
}

/// Methods over an inspected entry.
impl InspectedEntry {
    /// What: The owner record of a dead owner, or nothing.
    /// Why:  Only dead owners are recovered.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// typeof owner !== 'string' && owner.liveness === 'dead' ? owner.record : undefined
    /// ```
    pub fn dead_owner(&self) -> Option<&TransactionOwner> {
        match &self.owner {
            OwnerEvidence::Owned(record, OwnerLiveness::Dead) => return Some(record),
            _ => return None,
        }
    }
}

/// What: Classify an owner, reporting a failed probe as a recovery failure.
/// Why:  Recovery cannot decide liveness without the probe.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// await classifyTransactionOwner({ ownerPid, ownerIdentity })
/// ```
fn liveness(record: &TransactionOwner) -> Result<OwnerLiveness, RecoveryError> {
    match classify_transaction_owner(record.owner_pid, record.owner_identity.as_str()) {
        Ok(found) => return Ok(found),
        Err(OwnerLivenessError::Probe(error)) => {
            return Err(RecoveryError(format!(
                "probing transaction owner {} failed: {error}",
                record.owner_pid
            )));
        }
        Err(OwnerLivenessError::Identity(error)) => {
            return Err(RecoveryError(format!(
                "reading the identity of transaction owner {} failed: {error}",
                record.owner_pid
            )));
        }
    }
}

/// What: Read and classify an entry's owner, tolerating a live owner removing its own directory.
/// Why:  `inspectRegistryEntry`: a published directory needs a valid matching owner record; a
///       staging candidate may hold a torn one.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function inspectRegistryEntry(entry: TransactionRegistryEntry): Promise<InspectedEntry>;
/// ```
pub fn inspect_registry_entry(entry: &RegistryEntry) -> Result<InspectedEntry, RecoveryError> {
    let owner_path: PathBuf = entry.path.join(OWNER_FILENAME);
    let staging: bool = entry.kind == EntryKind::Staging;
    let bytes: Vec<u8> = match read_regular_file(owner_path.as_path(), RECOVERY_FILE_LIMIT) {
        Ok(found) => found,
        Err(ReadRefusal::Missing) => {
            debug(
                "inspectRegistryEntry",
                format!("owner record absent at {}", owner_path.display()).as_str(),
            );
            if staging {
                return Ok(unattributed(entry));
            }
            if !recovery_path_exists(entry.path.as_path())? {
                return Ok(InspectedEntry {
                    entry: entry.clone(),
                    owner: OwnerEvidence::Vanished,
                });
            }
            return Err(RecoveryError(format!(
                "Transaction owner record is missing: {}",
                entry.path.display()
            )));
        }
        Err(ReadRefusal::NotRegular | ReadRefusal::TooLarge) => {
            return Err(RecoveryError(format!(
                "Unsafe transaction recovery file: {}",
                owner_path.display()
            )));
        }
        Err(ReadRefusal::Io(error)) => {
            return Err(io_failure("reading", owner_path.as_path(), &error));
        }
    };
    let Some(record) = parse_transaction_owner(bytes.as_slice()) else {
        if staging {
            debug(
                "inspectRegistryEntry",
                format!("staging owner record incomplete: {}", entry.path.display()).as_str(),
            );
            return Ok(unattributed(entry));
        }
        return Err(RecoveryError(format!(
            "Transaction owner record is malformed: {}",
            entry.path.display()
        )));
    };
    if record.transaction_id != entry.transaction_id {
        return Err(RecoveryError(format!(
            "Transaction owner record names another transaction: {}",
            entry.path.display()
        )));
    }
    let state: OwnerLiveness = liveness(&record)?;
    return Ok(InspectedEntry {
        entry: entry.clone(),
        owner: OwnerEvidence::Owned(record, state),
    });
}

/// What: An entry whose owner cannot be attributed.
/// Why:  Shared by the missing and torn staging cases.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// ({ entry, owner: 'unattributed' })
/// ```
fn unattributed(entry: &RegistryEntry) -> InspectedEntry {
    return InspectedEntry {
        entry: entry.clone(),
        owner: OwnerEvidence::Unattributed,
    };
}

/// What: An entry's recovery-order key: `<createdAt> <path>` when attributed, otherwise
///       `~<path>`, after every ISO time.
/// Why:  `creationKey`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// typeof owner === 'string' ? `~${entry.path}` : `${owner.record.createdAt} ${entry.path}`
/// ```
pub fn creation_key(inspected: &InspectedEntry) -> String {
    let path: String = inspected.entry.path.to_string_lossy().into_owned();
    match &inspected.owner {
        OwnerEvidence::Owned(record, _) => return format!("{} {path}", record.created_at),
        OwnerEvidence::Vanished | OwnerEvidence::Unattributed => return format!("~{path}"),
    }
}

/// What: Order inspected entries oldest first, stably.
/// Why:  `oldestFirst`: JavaScript compares the keys by UTF-16 code units; for the ASCII
///       timestamps and registry paths the wrappers write, byte order is the same order.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// entries.toSorted((left, right) => compare(creationKey(left), creationKey(right)))
/// ```
pub fn oldest_first(entries: Vec<InspectedEntry>) -> Vec<InspectedEntry> {
    // `mut` allows sorting the keyed entries in place.
    let mut keyed: Vec<(String, InspectedEntry)> = Vec::with_capacity(entries.len());
    for entry in entries {
        keyed.push((creation_key(&entry), entry));
    }
    keyed.sort_by(compare_keys);
    let mut ordered: Vec<InspectedEntry> = Vec::with_capacity(keyed.len());
    for (_, entry) in keyed {
        ordered.push(entry);
    }
    return ordered;
}

/// What: Compare two keyed entries by key.
/// Why:  A named comparator keeps the sort free of closures.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// (left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0
/// ```
fn compare_keys(
    left: &(String, InspectedEntry),
    right: &(String, InspectedEntry),
) -> std::cmp::Ordering {
    return left.0.cmp(&right.0);
}

/// Inspection controls stay out of the release executable.
#[cfg(test)]
#[path = "recovery_inspect_tests.rs"]
pub(crate) mod tests;
