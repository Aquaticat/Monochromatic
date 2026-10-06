//! Controls for owner inspection and the recovery order.

use super::*;
use crate::test_support::{fixture, remove};
use crate::transaction_owner::{current_transaction_owner, encode_transaction_owner};
use crate::transaction_registry::{STAGING_SUFFIX, classify_entry_name};
use std::path::Path;

/// The transaction ID the fixtures use.
const ID: &str = "0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10";

/// Owner bytes of the current process, live or with a foreign identity.
pub(crate) fn owner_bytes(id: &str, created_at: &str, live: bool) -> Vec<u8> {
    let mut owner: TransactionOwner = current_transaction_owner(id, created_at).expect("owner");
    if !live {
        owner.owner_identity = String::from("linux:1");
    }
    return encode_transaction_owner(&owner).into_bytes();
}

/// A registry entry for a directory name under `root`, created with `owner`.
fn entry(root: &Path, name: &str, owner: Option<&[u8]>) -> RegistryEntry {
    std::fs::create_dir_all(root.join(name)).expect("entry directory");
    if let Some(bytes) = owner {
        std::fs::write(root.join(name).join(OWNER_FILENAME), bytes).expect("owner");
    }
    return classify_entry_name(root, name).expect("classified");
}

/// Live and dead owners are told apart; staging candidates may be unattributed.
#[test]
fn owners_are_classified() {
    let root: PathBuf = fixture("recovery-inspect-owners");
    let live: RegistryEntry = entry(
        root.as_path(),
        ID,
        Some(owner_bytes(ID, "t", true).as_slice()),
    );
    let inspected: InspectedEntry = inspect_registry_entry(&live).expect("live");
    assert!(matches!(
        inspected.owner,
        OwnerEvidence::Owned(_, OwnerLiveness::Alive)
    ));
    assert_eq!(inspected.dead_owner(), None);
    std::fs::write(live.path.join(OWNER_FILENAME), owner_bytes(ID, "t", false))
        .expect("dead owner");
    let dead: InspectedEntry = inspect_registry_entry(&live).expect("dead");
    assert_eq!(
        dead.dead_owner().map(owner_pid),
        Some(i64::from(std::process::id()))
    );
    let staging_name: String = format!("{ID}{STAGING_SUFFIX}");
    let staging: RegistryEntry = entry(root.as_path(), staging_name.as_str(), None);
    assert_eq!(
        inspect_registry_entry(&staging).expect("no owner").owner,
        OwnerEvidence::Unattributed
    );
    std::fs::write(staging.path.join(OWNER_FILENAME), b"{\"schemaVersion\":2").expect("torn owner");
    assert_eq!(
        inspect_registry_entry(&staging).expect("torn").owner,
        OwnerEvidence::Unattributed
    );
    std::fs::write(
        staging.path.join(OWNER_FILENAME),
        owner_bytes(ID, "t", true),
    )
    .expect("staging owner");
    assert!(matches!(
        inspect_registry_entry(&staging)
            .expect("staging owner")
            .owner,
        OwnerEvidence::Owned(_, OwnerLiveness::Alive)
    ));
    remove(root.as_path());
}

/// The PID of an owner record.
fn owner_pid(record: &TransactionOwner) -> i64 {
    return record.owner_pid;
}

/// Published directories without a valid matching owner fail closed, naming the directory.
#[cfg(unix)]
#[test]
fn published_owners_must_be_valid() {
    let root: PathBuf = fixture("recovery-inspect-invalid");
    let published: RegistryEntry = entry(root.as_path(), ID, None);
    assert_eq!(
        inspect_registry_entry(&published).expect_err("missing").0,
        format!(
            "Transaction owner record is missing: {}",
            published.path.display()
        )
    );
    std::fs::write(published.path.join(OWNER_FILENAME), b"{}").expect("malformed");
    assert_eq!(
        inspect_registry_entry(&published).expect_err("malformed").0,
        format!(
            "Transaction owner record is malformed: {}",
            published.path.display()
        )
    );
    std::fs::write(
        published.path.join(OWNER_FILENAME),
        owner_bytes("1b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10", "t", true),
    )
    .expect("other transaction");
    assert_eq!(
        inspect_registry_entry(&published).expect_err("other").0,
        format!(
            "Transaction owner record names another transaction: {}",
            published.path.display()
        )
    );
    std::fs::remove_file(published.path.join(OWNER_FILENAME)).expect("remove owner");
    std::os::unix::fs::symlink(root.join("elsewhere"), published.path.join(OWNER_FILENAME))
        .expect("link");
    std::fs::write(root.join("elsewhere"), owner_bytes(ID, "t", true)).expect("target");
    assert_eq!(
        inspect_registry_entry(&published).expect_err("link").0,
        format!(
            "Unsafe transaction recovery file: {}",
            published.path.join(OWNER_FILENAME).display()
        )
    );
    // A directory that disappeared after listing is a finished transaction.
    std::fs::remove_dir_all(&published.path).expect("vanish");
    assert_eq!(
        inspect_registry_entry(&published).expect("vanished").owner,
        OwnerEvidence::Vanished
    );
    remove(root.as_path());
}

/// Entries are ordered by creation time, unattributed ones last, ties by path.
#[test]
fn recovery_runs_oldest_first() {
    let root: PathBuf = fixture("recovery-inspect-order");
    let ids: [&str; 4] = [
        "0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10",
        "1b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10",
        "2b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10",
        "3b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10",
    ];
    let newest: InspectedEntry = inspect_registry_entry(&entry(
        root.as_path(),
        ids[0],
        Some(owner_bytes(ids[0], "2026-10-06T00:00:02.000Z", true).as_slice()),
    ))
    .expect("newest");
    let oldest: InspectedEntry = inspect_registry_entry(&entry(
        root.as_path(),
        ids[1],
        Some(owner_bytes(ids[1], "2026-10-06T00:00:01.000Z", true).as_slice()),
    ))
    .expect("oldest");
    let staging_name: String = format!("{}{STAGING_SUFFIX}", ids[2]);
    let unattributed: InspectedEntry =
        inspect_registry_entry(&entry(root.as_path(), staging_name.as_str(), None))
            .expect("unattributed");
    let same_time: InspectedEntry = inspect_registry_entry(&entry(
        root.as_path(),
        ids[3],
        Some(owner_bytes(ids[3], "2026-10-06T00:00:01.000Z", true).as_slice()),
    ))
    .expect("same time");
    assert_eq!(
        creation_key(&oldest),
        format!("2026-10-06T00:00:01.000Z {}", oldest.entry.path.display())
    );
    assert_eq!(
        creation_key(&unattributed),
        format!("~{}", unattributed.entry.path.display())
    );
    let ordered: Vec<InspectedEntry> = oldest_first(vec![
        unattributed.clone(),
        newest.clone(),
        same_time.clone(),
        oldest.clone(),
    ]);
    assert_eq!(ordered, vec![oldest, same_time, newest, unattributed]);
    remove(root.as_path());
}
