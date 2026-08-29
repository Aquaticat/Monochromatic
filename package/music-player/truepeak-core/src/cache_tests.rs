//! Integration tests for the decision cache, against a throwaway in-memory database.

use super::*;
use crate::decision::{Decision, DecisionKind};
use crate::policy::CacheIdentity;

// A fixed identity for the tests; every key column matters for a hit.
fn identity() -> CacheIdentity {
    return CacheIdentity { policy_id: 11, meter_id: 22, decoder_stack_id: 33, schema_version: 1 }
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
