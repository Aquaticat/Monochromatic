//! Controls for the starvation reservation on disposable registries:
//!  request bytes, the earned threshold, grant order, holders seen by others, release, and the grant
//!  after the configured number of lost races.

use super::*;
use crate::test_support::{fixture, remove};
use crate::transaction_owner::{current_transaction_owner, encode_transaction_owner};
use crate::transaction_registry::{OWNER_FILENAME, TRANSACTION_ROOT_NAME, ensure_transaction_root};

/// Transaction IDs of the fixtures, canonical UUIDs.
const FIRST: &str = "0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10";
/// The second transaction of the fixtures.
const SECOND: &str = "1c7d3d2f-7a6c-4e1f-8b66-4a6e9f3f7b21";

/// A transaction directory under `registry` owned by this live process,
///  or by a foreign identity when `live` is false.
fn transaction(registry: &Path, id: &str, created_at: &str, live: bool) -> PathBuf {
    let directory: PathBuf = registry.join(id);
    std::fs::create_dir_all(&directory).expect("transaction directory");
    let mut owner = current_transaction_owner(id, created_at).expect("current owner");
    if !live {
        owner.owner_identity = String::from("linux:1");
    }
    std::fs::write(directory.join(OWNER_FILENAME), encode_transaction_owner(&owner)).expect("owner record");
    return directory;
}

/// A fixture registry root with the transaction root created.
fn registry_of(name: &str) -> (PathBuf, PathBuf) {
    let root: PathBuf = fixture(name);
    let registry: PathBuf = root.join(TRANSACTION_ROOT_NAME);
    ensure_transaction_root(registry.as_path()).expect("registry root");
    return (root, registry);
}

/// The request file names the incumbent's object with its lost-race count and a trailing newline.
#[test]
fn request_bytes_match_the_incumbent_object() {
    assert_eq!(
        reservation_request_bytes(2),
        b"{\"schemaVersion\":2,\"state\":\"reservation-request\",\"lostRaces\":2}\n".to_vec()
    );
}

/// A lost race earns the reservation from the configured count on, never before.
#[test]
fn the_reservation_is_earned_at_the_configured_count() {
    assert!(!reservation_earned(0, 1));
    assert!(reservation_earned(1, 1));
    assert!(!reservation_earned(2, 3));
    assert!(reservation_earned(3, 3));
    assert!(reservation_earned(4, 3));
}

/// Without any registry, nobody requests; a request without a live owner does not count.
#[test]
fn requesters_are_live_transactions_with_a_request() {
    let (root, registry) = registry_of("replay-reservation-requesters");
    assert!(live_requesters(registry.as_path()).expect("empty").is_empty());
    let live: PathBuf = transaction(registry.as_path(), FIRST, "2026-10-10T00:00:00.000Z", true);
    assert!(live_requesters(registry.as_path()).expect("no request").is_empty());
    std::fs::write(live.join(RESERVATION_REQUEST_FILENAME), reservation_request_bytes(1)).expect("request");
    assert_eq!(live_requesters(registry.as_path()).expect("requester"), vec![String::from(FIRST)]);
    let dead: PathBuf = transaction(registry.as_path(), SECOND, "2026-10-09T00:00:00.000Z", false);
    std::fs::write(dead.join(RESERVATION_REQUEST_FILENAME), reservation_request_bytes(1)).expect("request");
    assert_eq!(live_requesters(registry.as_path()).expect("dead excluded"), vec![String::from(FIRST)]);
    remove(root.as_path());
}

/// The oldest live requester is first in grant order.
#[test]
fn the_oldest_requester_is_granted_first() {
    let (root, registry) = registry_of("replay-reservation-order");
    for (id, created) in [(FIRST, "2026-10-10T00:00:05.000Z"), (SECOND, "2026-10-10T00:00:01.000Z")] {
        let directory: PathBuf = transaction(registry.as_path(), id, created, true);
        std::fs::write(directory.join(RESERVATION_REQUEST_FILENAME), reservation_request_bytes(1)).expect("request");
    }
    assert_eq!(
        live_requesters(registry.as_path()).expect("order"),
        vec![String::from(SECOND), String::from(FIRST)]
    );
    remove(root.as_path());
}

/// A reservation held by one transaction is seen by the others until it is released;
///  release removes the request and the lock, and the grant also needs the oldest request.
#[test]
fn a_held_reservation_is_seen_by_others_until_released() {
    let (root, registry) = registry_of("replay-reservation-holder");
    let first_directory: PathBuf = transaction(registry.as_path(), FIRST, "2026-10-10T00:00:00.000Z", true);
    let second_directory: PathBuf = transaction(registry.as_path(), SECOND, "2026-10-10T00:00:01.000Z", true);
    let mut first: LandingReservation = LandingReservation::open(registry.as_path(), first_directory.as_path(), FIRST, false);
    let second: LandingReservation = LandingReservation::open(registry.as_path(), second_directory.as_path(), SECOND, false);
    assert!(first.reserve(1).expect("granted"));
    assert!(first_directory.join(RESERVATION_REQUEST_FILENAME).exists());
    assert!(!first.held_by_another().expect("own view"));
    assert!(second.held_by_another().expect("other view"));
    first.release().expect("released");
    assert!(!first_directory.join(RESERVATION_REQUEST_FILENAME).exists());
    assert!(!second.held_by_another().expect("free"));
    remove(root.as_path());
}

/// An inherited landing lease neither requests nor waits: `reserve` returns false and writes nothing.
#[test]
fn a_nested_landing_neither_requests_nor_waits() {
    let (root, registry) = registry_of("replay-reservation-nested");
    let directory: PathBuf = transaction(registry.as_path(), FIRST, "2026-10-10T00:00:00.000Z", true);
    let mut nested: LandingReservation = LandingReservation::open(registry.as_path(), directory.as_path(), FIRST, true);
    assert!(!nested.reserve(1).expect("not applicable"));
    assert!(!directory.join(RESERVATION_REQUEST_FILENAME).exists());
    assert!(!nested.held_by_another().expect("nested never waits"));
    nested.await_slot().expect("returns at once");
    remove(root.as_path());
}

/// The reservation is taken on the lost race the configuration names:
///  earlier races only count, the granted request carries the count, and the grant happens once.
#[test]
fn the_grant_follows_the_configured_lost_races() {
    let (root, registry) = registry_of("replay-reservation-threshold");
    let directory: PathBuf = transaction(registry.as_path(), FIRST, "2026-10-10T00:00:00.000Z", true);
    let configured: u64 = 3;
    let mut reservation: LandingReservation = LandingReservation::open(registry.as_path(), directory.as_path(), FIRST, false);
    let mut granted_at: Option<u64> = None;
    for lost in 1..=configured {
        if reservation_earned(lost, configured) && reservation.reserve(lost).expect("reserve") {
            granted_at = Some(lost);
            break;
        }
    }
    assert_eq!(granted_at, Some(configured));
    let request: Vec<u8> = std::fs::read(directory.join(RESERVATION_REQUEST_FILENAME)).expect("request");
    assert_eq!(request, reservation_request_bytes(configured));
    reservation.release().expect("released");
    remove(root.as_path());
}

/// A landing waits for a released reservation and then takes the landing lock.
#[test]
fn a_landing_takes_the_landing_lock_once_the_reservation_is_free() {
    let (root, registry) = registry_of("replay-reservation-yield");
    let holder_directory: PathBuf = transaction(registry.as_path(), FIRST, "2026-10-10T00:00:00.000Z", true);
    let mut holder: LandingReservation = LandingReservation::open(registry.as_path(), holder_directory.as_path(), FIRST, false);
    assert!(holder.reserve(1).expect("granted"));
    holder.release().expect("released");
    let waiter_directory: PathBuf = transaction(registry.as_path(), SECOND, "2026-10-10T00:00:01.000Z", true);
    let waiter: LandingReservation = LandingReservation::open(registry.as_path(), waiter_directory.as_path(), SECOND, false);
    let landing_lock: PathBuf = registry.join("landing.lock");
    let lock: OwnerLock = acquire_reserved_landing_lock(&waiter, || {
        let acquired = try_acquire_owner_lock(landing_lock.as_path(), Some(SECOND))
            .map_err(ReservationError::Lock)?;
        return acquired.ok_or_else(|| { return ReservationError::Registry(RecoveryError(String::from("landing lock busy"))); });
    })
    .expect("landing lock after the reservation is free");
    lock.release().expect("released landing lock");
    remove(root.as_path());
}

/// Releasing a reservation whose request file is already gone is not an error.
#[test]
fn releasing_without_a_request_file_is_quiet() {
    let (root, registry) = registry_of("replay-reservation-release-absent");
    let directory: PathBuf = transaction(&registry, FIRST, "2026-10-10T00:00:00.000Z", true);
    LandingReservation::open(&registry, &directory, FIRST, false)
        .release()
        .expect("an absent request is not an error");
    remove(root.as_path());
}

/// A free reservation is not granted to a transaction that is not the oldest live requester.
#[test]
fn a_free_reservation_is_not_granted_to_a_younger_requester() {
    let (root, registry) = registry_of("replay-reservation-younger");
    let older: PathBuf = transaction(&registry, FIRST, "2026-10-10T00:00:00.000Z", true);
    std::fs::write(older.join(RESERVATION_REQUEST_FILENAME), reservation_request_bytes(1)).expect("older request");
    let younger: PathBuf = transaction(&registry, SECOND, "2026-10-10T00:00:01.000Z", true);
    let registry_for_thread: PathBuf = registry.clone();
    let younger_for_thread: PathBuf = younger.clone();
    std::thread::spawn(move || {
        let mut reservation: LandingReservation =
            LandingReservation::open(&registry_for_thread, &younger_for_thread, SECOND, false);
        // The younger request waits for the older one; the result is not checked, the thread only records a grant on disk.
        let _ignored = reservation.reserve(1);
    });
    std::thread::sleep(std::time::Duration::from_millis(300));
    assert!(!registry.join(RESERVATION_LOCK_NAME).exists());
    remove(root.as_path());
}
