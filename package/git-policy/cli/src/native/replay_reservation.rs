//! What:
//!  The starvation reservation of the next landing slot:
//!       a transaction that lost `landing.reserveAfterLostRaces` races writes `reservation-request`,
//!       takes the reservation lock `reservation.lock` in the registry when it is granted,
//!       and every other transaction waits before it takes the landing lock.
//! Why:
//!  Without it a commit that keeps losing the race can starve behind a stream of landings.
//!       Grant order is the oldest live requester, so the transaction that waited longest goes first.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! await using reservation = await openLandingReservation({ registryRoot, transactionDirectory, transactionId });
//! await reservation.reserve(lostRaces);
//! ```

/// Owner-lock records and their liveness.
use super::owner_lock::{OwnerLock, OwnerLockError, try_acquire_owner_lock};
use super::owner_lock_record::{
    OwnerLockRecord, OwnerRecordError, PublishedOwner, owner_lock_holder_is_alive, read_owner_lock_record,
};
/// Registry layout and grant order.
use super::recovery_inspect::{InspectedEntry, OwnerEvidence, oldest_first};
use super::transaction_owner::OwnerLiveness;
use super::transaction_registry::{EntryKind, RESERVATION_LOCK_NAME, list_transaction_entries};
/// Private file writes that survive a crash.
use super::private_storage::{sync_directory, write_private_file};
use super::recovery_error::RecoveryError;
/// `Path`/`PathBuf` are borrowed/owned filesystem paths.
use std::path::{Path, PathBuf};
/// Delay between reservation checks.
use std::time::Duration;

/// Name of the request file inside a transaction directory.
pub const RESERVATION_REQUEST_FILENAME: &str = "reservation-request";

/// Delay between reservation and holder checks, as the incumbent's `RESERVATION_POLL_MS`.
pub const RESERVATION_POLL: Duration = Duration::from_millis(20);

/// What:
///  A reservation failure:
///       the registry, a lock record, or a request file could not be read or written.
/// Why:
///   Replay fails the transaction with the underlying reason instead of landing without the reservation.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// throw new CommitTransactionGitError(...);
/// ```
#[derive(Debug)]
pub enum ReservationError {
    /// The transaction registry could not be listed or inspected.
    Registry(RecoveryError),
    /// The reservation lock's record could not be read.
    Record(OwnerRecordError),
    /// The reservation lock could not be taken or released.
    Lock(OwnerLockError),
    /// The holder's process identity could not be probed.
    Identity(String),
    /// A request file or its directory could not be written.
    Write(std::io::Error),
}

/// What:
///  The request file bytes:
///       `{"schemaVersion":2,"state":"reservation-request","lostRaces":<n>}` and a newline.
/// Why:
///   The TypeScript writes this object, not the empty marker SPEC names;
///       both wrappers read the same file, so the bytes match the incumbent.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// `${JSON.stringify({ schemaVersion: 2, state: 'reservation-request', lostRaces })}\n`
/// ```
pub fn reservation_request_bytes(lost_races: u64) -> Vec<u8> {
    return format!(
        "{{\"schemaVersion\":2,\"state\":\"reservation-request\",\"lostRaces\":{lost_races}}}\n"
    )
    .into_bytes();
}

/// What:
///  Whether a lost race earns the reservation:
///       the `reserve_after`-th lost race and every later one.
/// Why:
///   `landing.reserveAfterLostRaces` counts races lost so far, from 1; the check runs after each loss.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// lostRaces >= input.reserveAfterLostRaces
/// ```
pub fn reservation_earned(lost_races: u64, reserve_after: u64) -> bool {
    return lost_races >= reserve_after;
}

/// What:
///  The transactions with a live request, oldest first; the first one is the next grant.
/// Why:
///   Grant order is the oldest live requester, with the registry's creation key breaking ties.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// await liveRequesters(registryRoot); // transaction IDs, oldest invocation first
/// ```
pub fn live_requesters(registry_root: &Path) -> Result<Vec<String>, ReservationError> {
    let entries = list_transaction_entries(registry_root).map_err(ReservationError::Registry)?;
    // `mut` lets the requesting entries be gathered from the registry listing.
    let mut requesting: Vec<InspectedEntry> = Vec::new();
    for entry in entries {
        if !matches!(entry.kind, EntryKind::Transaction) || !entry.path.join(RESERVATION_REQUEST_FILENAME).exists() {
            continue;
        }
        requesting.push(super::recovery_inspect::inspect_registry_entry(&entry).map_err(ReservationError::Registry)?);
    }
    return Ok(oldest_first(requesting)
        .into_iter()
        .filter(|inspected| { return matches!(inspected.owner, OwnerEvidence::Owned(_, OwnerLiveness::Alive)); })
        .map(|inspected| { return inspected.entry.transaction_id; })
        .collect());
}

/// What:
///  The live holder of the reservation lock:
///       its record when the lock is published and its owner is alive, otherwise nothing.
/// Why:
///   A dead holder's reservation no longer blocks anyone; its lock is retired by the next acquisition.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// liveHolder(lockDirectory); // OwnerLockRecord | NO_HOLDER
/// ```
pub fn live_holder(lock_directory: &Path) -> Result<Option<OwnerLockRecord>, ReservationError> {
    let published: PublishedOwner = read_owner_lock_record(lock_directory).map_err(ReservationError::Record)?;
    let record = match published {
        PublishedOwner::Owner(found) => found,
        PublishedOwner::Busy => return Ok(None),
    };
    let alive: bool = owner_lock_holder_is_alive(&record)
        .map_err(|error| { return ReservationError::Identity(format!("{error:?}")); })?;
    return Ok(if alive { Some(record) } else { None });
}

/// What:
///  One transaction's view of the reservation:
///       whether another transaction holds it, waiting for it, requesting it, and releasing it.
/// Why:
///   The landing loop takes the reservation after its lost races and must give it back when the loop ends,
///       landed or failed.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type LandingReservation = AsyncDisposable & { awaitSlot; heldByAnother; reserve };
/// ```
pub struct LandingReservation {
    /// Transaction registry.
    registry_root: PathBuf,
    /// This transaction's directory, which holds the request file.
    transaction_directory: PathBuf,
    /// This transaction's ID.
    transaction_id: String,
    /// Whether this invocation lands under an ancestor's landing lock, which neither waits nor takes the reservation.
    nested: bool,
    /// The reservation, once granted to this transaction.
    held: Option<OwnerLock>,
}

impl LandingReservation {
    /// What:
    ///  Opens the reservation view for one landing loop.
    /// Why:
    ///   The caller decides `nested` from its inherited landing lease, which this module does not read.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// await openLandingReservation({ registryRoot, transactionDirectory, transactionId });
    /// ```
    pub fn open(registry_root: &Path, transaction_directory: &Path, transaction_id: &str, nested: bool) -> Self {
        return Self {
            registry_root: registry_root.to_path_buf(),
            transaction_directory: transaction_directory.to_path_buf(),
            transaction_id: String::from(transaction_id),
            nested,
            held: None,
        };
    }

    /// The reservation lock's directory.
    fn lock_directory(&self) -> PathBuf {
        return self.registry_root.join(RESERVATION_LOCK_NAME);
    }

    /// What:
    ///  Whether another transaction holds a live reservation right now.
    /// Why:
    ///   The holder's own token never counts against itself.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// await reservation.heldByAnother();
    /// ```
    pub fn held_by_another(&self) -> Result<bool, ReservationError> {
        if self.nested {
            return Ok(false);
        }
        let holder = live_holder(self.lock_directory().as_path())?;
        return Ok(match (holder, self.held.as_ref()) {
            (None, _) => false,
            (Some(record), Some(lock)) => record.token != lock.token(),
            (Some(_), None) => true,
        });
    }

    /// What:
    ///  Waits while a live reservation owned by another transaction exists.
    /// Why:
    ///   A landing may take the landing lock only after the holder has finished its landing loop.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// await reservation.awaitSlot();
    /// ```
    pub fn await_slot(&self) -> Result<(), ReservationError> {
        while self.held_by_another()? {
            std::thread::sleep(RESERVATION_POLL);
        }
        return Ok(());
    }

    /// What:
    ///  Writes the request, then waits until this transaction is the oldest live requester and the lock is free,
    ///       and takes the reservation.
    /// Why:
    ///   The first requester in grant order gets the next slot, so a starving commit cannot be overtaken again.
    ///       An inherited landing lease neither asks nor waits.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// await reservation.reserve(lostRaces); // false when already held or not applicable
    /// ```
    pub fn reserve(&mut self, lost_races: u64) -> Result<bool, ReservationError> {
        if self.nested || self.held.is_some() {
            return Ok(false);
        }
        write_private_file(
            self.transaction_directory.join(RESERVATION_REQUEST_FILENAME).as_path(),
            &reservation_request_bytes(lost_races),
        )
        .map_err(ReservationError::Write)?;
        sync_directory(self.transaction_directory.as_path()).map_err(ReservationError::Write)?;
        loop {
            let lock_directory: PathBuf = self.lock_directory();
            let free: bool = live_holder(lock_directory.as_path())?.is_none();
            let first: bool = live_requesters(self.registry_root.as_path())?.first() == Some(&self.transaction_id);
            let granted: Option<OwnerLock> = if free && first {
                try_acquire_owner_lock(lock_directory.as_path(), Some(self.transaction_id.as_str()))
                    .map_err(ReservationError::Lock)?
            } else {
                None
            };
            if let Some(lock) = granted {
                self.held = Some(lock);
                return Ok(true);
            }
            std::thread::sleep(RESERVATION_POLL);
        }
    }

    /// What:
    ///  Releases the reservation if held and removes the request file.
    /// Why:
    ///   The request goes even when the reservation was never granted, so no stale request blocks the next grant.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// await reservation[Symbol.asyncDispose]();
    /// ```
    pub fn release(mut self) -> Result<(), ReservationError> {
        let request: PathBuf = self.transaction_directory.join(RESERVATION_REQUEST_FILENAME);
        match std::fs::remove_file(&request) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(ReservationError::Write(error)),
        }
        if let Some(lock) = self.held.take() {
            lock.release().map_err(ReservationError::Lock)?;
        }
        return Ok(());
    }
}

/// What:
///  Takes the landing lock once no other transaction's reservation stands in the way,
///       checking again under the lock, so a reservation granted while this landing waited is honoured.
/// Why:
///   The landing lock is acquired by the caller's closure because its module belongs to the landing lane.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// await acquireReservedLandingLock({ gitPath, cwd, registryRoot, reservation });
/// ```
pub fn acquire_reserved_landing_lock<F>(
    reservation: &LandingReservation,
    mut acquire_landing: F,
) -> Result<OwnerLock, ReservationError>
where
    F: FnMut() -> Result<OwnerLock, ReservationError>,
{
    loop {
        reservation.await_slot()?;
        let lock: OwnerLock = acquire_landing()?;
        if !reservation.held_by_another()? {
            return Ok(lock);
        }
        lock.release().map_err(ReservationError::Lock)?;
    }
}

#[cfg(test)]
#[path = "replay_reservation_tests.rs"]
mod tests;
