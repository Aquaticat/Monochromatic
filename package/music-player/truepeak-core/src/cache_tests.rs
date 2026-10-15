//! Integration tests for the decision cache,
//!  against a throwaway in-memory database.

use super::*;
use crate::decision::{Decision, DecisionKind};
use crate::policy::{CacheIdentity, SCHEMA_VERSION};

// A fixed identity for the tests; every key column matters for a hit.
// It carries the current schema version, as every shipped identity does.
fn identity() -> CacheIdentity {
    return CacheIdentity { policy_id: 11, meter_id: 22, decoder_stack_id: 33, schema_version: SCHEMA_VERSION }
}

fn probe(gain: f32) -> Decision {
    return Decision { gain, kind: DecisionKind::ProbeEstimate, measured_peak: 0.9, duration_secs: 200.0 }
}

fn exact(gain: f32) -> Decision {
    return Decision { gain, kind: DecisionKind::FullScanExact, measured_peak: 1.5, duration_secs: 200.0 }
}

// A stored decision reads back unchanged for a matching key.
#[tokio::test]
async fn round_trips_a_decision() {
    let cache = DecisionCache::open(":memory:")
        .await
        .expect("in-memory cache should open");
    cache
        .put(42, identity(), &probe(0.8))
        .await
        .expect("probe decision should be cached");

    let hit = cache
        .get(42, identity())
        .await
        .expect("cached decision should be read")
        .expect("matching decision should exist");
    assert_eq!(hit, probe(0.8));
}

// A missing fingerprint, or a mismatched identity, is a miss.
#[tokio::test]
async fn misses_on_absent_or_mismatched_key() {
    let cache = DecisionCache::open(":memory:")
        .await
        .expect("in-memory cache should open");
    cache
        .put(42, identity(), &probe(0.8))
        .await
        .expect("probe decision should be cached");

    assert!(
        cache
            .get(99, identity())
            .await
            .expect("absent decision lookup should succeed")
            .is_none()
    );
    let other = CacheIdentity { policy_id: 999, ..identity() };
    assert!(
        cache
            .get(42, other)
            .await
            .expect("mismatched decision lookup should succeed")
            .is_none()
    );
}

// A probe estimate must not overwrite an exact decision for the same key.
#[tokio::test]
async fn exact_is_not_downgraded_by_a_probe() {
    let cache = DecisionCache::open(":memory:")
        .await
        .expect("in-memory cache should open");
    cache
        .put(42, identity(), &exact(0.5))
        .await
        .expect("exact decision should be cached");
    cache
        .put(42, identity(), &probe(0.8))
        .await
        .expect("lower-precedence write should be handled");

    let hit = cache
        .get(42, identity())
        .await
        .expect("cached decision should be read")
        .expect("exact decision should remain cached");
    assert_eq!(hit.kind, DecisionKind::FullScanExact);
    assert_eq!(hit.gain, 0.5);
}

// An exact decision does upgrade a prior probe estimate.
#[tokio::test]
async fn probe_is_upgraded_by_an_exact() {
    let cache = DecisionCache::open(":memory:")
        .await
        .expect("in-memory cache should open");
    cache
        .put(42, identity(), &probe(0.8))
        .await
        .expect("probe decision should be cached");
    cache
        .put(42, identity(), &exact(0.5))
        .await
        .expect("exact decision should replace probe");

    let hit = cache
        .get(42, identity())
        .await
        .expect("cached decision should be read")
        .expect("exact decision should remain cached");
    assert_eq!(hit.kind, DecisionKind::FullScanExact);
    assert_eq!(hit.gain, 0.5);
}

// The exact-fingerprint snapshot lists only exact rows for this identity, not probes.
#[tokio::test]
async fn exact_fingerprints_lists_only_exact_rows() {
    let cache = DecisionCache::open(":memory:")
        .await
        .expect("in-memory cache should open");
    cache
        .put(1, identity(), &exact(0.5))
        .await
        .expect("exact decision should be cached");
    cache
        .put(2, identity(), &probe(0.8))
        .await
        .expect("probe decision should be cached");
    let short = Decision { kind: DecisionKind::ShortFullScan, ..exact(0.6) };
    cache
        .put(3, identity(), &short)
        .await
        .expect("short full-scan decision should be cached");
    let other = CacheIdentity { policy_id: 999, ..identity() };
    cache
        .put(4, other, &exact(0.4))
        .await
        .expect("other-identity decision should be cached");

    let listed = cache
        .exact_fingerprints(identity())
        .await
        .expect("exact fingerprints should be listed");
    assert_eq!(listed, HashSet::from([1_u64, 3]));
}

// Removing an exact key drops only that row: a positive control proves the row was present first.
#[tokio::test]
async fn remove_drops_only_the_named_key() {
    let cache = DecisionCache::open(":memory:")
        .await
        .expect("in-memory cache should open");
    cache
        .put(1, identity(), &exact(0.5))
        .await
        .expect("exact decision should be cached");
    cache
        .put(2, identity(), &exact(0.6))
        .await
        .expect("second exact decision should be cached");
    assert!(
        cache
            .get(1, identity())
            .await
            .expect("cached decision should be read")
            .is_some(),
        "positive control: the row should exist before removal"
    );

    let removed = cache.remove(1, identity()).await.expect("remove should run");
    assert!(removed, "removing a stored key should report a removed row");
    assert!(
        cache
            .get(1, identity())
            .await
            .expect("removed decision lookup should succeed")
            .is_none()
    );
    assert!(
        cache
            .get(2, identity())
            .await
            .expect("neighbour lookup should succeed")
            .is_some(),
        "a different fingerprint must keep its decision"
    );
}

// Removing a key that was never stored reports nothing removed.
#[tokio::test]
async fn remove_of_absent_key_reports_false() {
    let cache = DecisionCache::open(":memory:")
        .await
        .expect("in-memory cache should open");

    let removed = cache.remove(99, identity()).await.expect("remove should run");
    assert!(!removed, "an absent key should report nothing removed");
}

// Removal is scoped to the identity: the same fingerprint under another identity survives.
#[tokio::test]
async fn remove_is_scoped_to_identity() {
    let cache = DecisionCache::open(":memory:")
        .await
        .expect("in-memory cache should open");
    cache
        .put(42, identity(), &exact(0.5))
        .await
        .expect("exact decision should be cached");
    let other = CacheIdentity { policy_id: 999, ..identity() };

    let removed = cache.remove(42, other).await.expect("remove should run");
    assert!(!removed, "a mismatched identity must remove nothing");
    assert!(
        cache
            .get(42, identity())
            .await
            .expect("original identity lookup should succeed")
            .is_some(),
        "the original identity keeps its row"
    );
}

// After removal the key is empty, so a fresh probe is accepted where an exact row would have blocked it.
#[tokio::test]
async fn probe_is_stored_after_an_exact_row_is_removed() {
    let cache = DecisionCache::open(":memory:")
        .await
        .expect("in-memory cache should open");
    cache
        .put(42, identity(), &exact(0.5))
        .await
        .expect("exact decision should be cached");
    cache.remove(42, identity()).await.expect("remove should run");
    cache
        .put(42, identity(), &probe(0.8))
        .await
        .expect("probe should be stored into the emptied key");

    let hit = cache
        .get(42, identity())
        .await
        .expect("cached decision should be read")
        .expect("probe should now be the stored decision");
    assert_eq!(hit.kind, DecisionKind::ProbeEstimate);
}

// The path of a throwaway database file unique to this process and test name.
fn scratch_db_path(name: &str) -> std::path::PathBuf {
    return std::env::temp_dir().join(format!("truepeak-core-cache-{}-{name}.db", std::process::id()))
}

// Delete the throwaway database and any sibling journal files Turso created.
fn remove_scratch_db(path: &std::path::Path) {
    for suffix in ["", "-wal", "-log", "-shm"] {
        let mut sibling = path.as_os_str().to_owned();
        sibling.push(suffix);
        let _ = std::fs::remove_file(std::path::PathBuf::from(sibling));
    }
}

// Insert a row with an explicit schema-version literal, bypassing `put`, as an older build wrote it.
async fn insert_row_at_version(cache: &DecisionCache, fingerprint: i64, schema_version: i64) {
    cache
        .conn
        .execute(
            "INSERT INTO decisions (fingerprint, policy_id, meter_id, decoder_stack_id, schema_version, kind, gain, \
             measured_peak, duration_secs) VALUES (?1, 11, 22, 33, ?2, 2, 0.5, 1.5, 200.0)",
            (fingerprint, schema_version),
        )
        .await
        .expect("row should be inserted");
}

// Count every row in the table, whatever its version.
async fn count_rows(cache: &DecisionCache) -> i64 {
    let mut rows = cache
        .conn
        .query("SELECT COUNT(*) FROM decisions", ())
        .await
        .expect("count should run");
    let row = rows
        .next()
        .await
        .expect("count row should be read")
        .expect("count always returns one row");
    return *row
        .get_value(0)
        .expect("count column should exist")
        .as_integer()
        .expect("count should be an integer")
}

// The shipped schema version is above the first one, so rows written under the retired gxhash
// fingerprint (version 1) can never match a current read.
#[test]
fn the_schema_version_moved_past_the_gxhash_rows() {
    const { assert!(SCHEMA_VERSION >= 2, "version 1 rows hold gxhash fingerprints and must not match") };
}

// A row left by the gxhash build (schema version written as the literal 1) is a miss for the
// current identity, and reopening the database deletes it. A current-version row survives the
// reopen as the positive control, and a newer-version row survives too, so a downgrade is harmless.
#[tokio::test]
async fn reopen_removes_gxhash_era_rows_and_keeps_current_and_newer_rows() {
    let path = scratch_db_path("legacy-cleanup");
    remove_scratch_db(&path);
    let path_text = path.to_str().expect("temp path should be UTF-8");
    let cache = DecisionCache::open(path_text)
        .await
        .expect("fresh database should open");
    insert_row_at_version(&cache, 0x1234_5678, 1).await;
    cache
        .put(0x1234_5678, identity(), &exact(0.7))
        .await
        .expect("current-version decision should be cached");
    insert_row_at_version(&cache, 0x9999, i64::from(SCHEMA_VERSION) + 1).await;
    assert_eq!(count_rows(&cache).await, 3, "positive control: three rows before the reopen");
    let legacy_identity = CacheIdentity { schema_version: 1, ..identity() };
    assert!(
        cache
            .get(0x1234_5678, legacy_identity)
            .await
            .expect("legacy lookup should succeed")
            .is_some(),
        "positive control: the legacy row is readable only under its own version"
    );
    let current = cache
        .get(0x1234_5678, identity())
        .await
        .expect("current lookup should succeed")
        .expect("the current-version row should be found");
    assert_eq!(current.gain, 0.7, "the current identity must see the current row, never the legacy one");
    drop(cache);

    let reopened = DecisionCache::open(path_text)
        .await
        .expect("database should reopen");
    assert_eq!(count_rows(&reopened).await, 2, "the version 1 row should be deleted on open");
    assert!(
        reopened
            .get(0x1234_5678, legacy_identity)
            .await
            .expect("legacy lookup after reopen should succeed")
            .is_none(),
        "the legacy row must be gone"
    );
    assert!(
        reopened
            .get(0x1234_5678, identity())
            .await
            .expect("current lookup after reopen should succeed")
            .is_some(),
        "the current-version row must survive"
    );
    let newer = CacheIdentity { schema_version: SCHEMA_VERSION + 1, ..identity() };
    assert!(
        reopened
            .get(0x9999, newer)
            .await
            .expect("newer lookup after reopen should succeed")
            .is_some(),
        "a newer-version row must survive"
    );
    drop(reopened);
    remove_scratch_db(&path);
}

// A cache written and reopened under the current version hits: the cleanup does not eat live rows.
#[tokio::test]
async fn a_current_row_hits_after_reopen() {
    let path = scratch_db_path("reopen-hit");
    remove_scratch_db(&path);
    let path_text = path.to_str().expect("temp path should be UTF-8");
    let cache = DecisionCache::open(path_text)
        .await
        .expect("fresh database should open");
    cache
        .put(77, identity(), &exact(0.5))
        .await
        .expect("decision should be cached");
    drop(cache);

    let reopened = DecisionCache::open(path_text)
        .await
        .expect("database should reopen");
    let hit = reopened
        .get(77, identity())
        .await
        .expect("lookup should succeed")
        .expect("the decision written before the reopen should hit");
    assert_eq!(hit, exact(0.5));
    drop(reopened);
    remove_scratch_db(&path);
}
