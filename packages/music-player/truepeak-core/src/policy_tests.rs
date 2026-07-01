//! Unit tests for policy identity derivation.

use super::*;

// The shipped default carries the decided proportional-coverage constants.
#[test]
fn default_policy_has_decided_constants() {
    let policy = default_policy();
    assert_eq!(policy.short_scan_max_secs, 90.0);
    assert!((policy.coverage_fraction - 0.2).abs() < 1e-12);
    assert!((policy.probe_window_secs - 0.3).abs() < 1e-12);
    assert!((policy.probe_margin_db - 0.8).abs() < 1e-12);
    assert_eq!(policy.ceiling_dbtp, -1.0);
    assert_eq!(policy.max_too_loud_db, 0.5);
    assert_eq!(policy.max_too_quiet_db, -2.0);
}

// The policy id is stable for an unchanged policy.
#[test]
fn policy_id_is_stable() {
    assert_eq!(default_policy().policy_id(), default_policy().policy_id());
}

// Changing ANY parameter changes the policy id, so a stale cache row cannot be reused.
#[test]
fn policy_id_changes_with_every_parameter() {
    let base = default_policy();
    let base_id = base.policy_id();

    let mut short_scan = base;
    short_scan.short_scan_max_secs += 1.0;
    assert_ne!(short_scan.policy_id(), base_id);

    let mut coverage = base;
    coverage.coverage_fraction += 0.01;
    assert_ne!(coverage.policy_id(), base_id);

    let mut window = base;
    window.probe_window_secs += 0.05;
    assert_ne!(window.policy_id(), base_id);

    let mut margin = base;
    margin.probe_margin_db += 0.01;
    assert_ne!(margin.policy_id(), base_id);

    let mut ceiling = base;
    ceiling.ceiling_dbtp = -1.5;
    assert_ne!(ceiling.policy_id(), base_id);

    let mut loud = base;
    loud.max_too_loud_db = 0.4;
    assert_ne!(loud.policy_id(), base_id);

    let mut quiet = base;
    quiet.max_too_quiet_db = -1.5;
    assert_ne!(quiet.policy_id(), base_id);
}

// The meter id is stable and non-trivial.
#[test]
fn meter_id_is_stable_and_nonzero() {
    assert_eq!(meter_id(), meter_id());
    assert_ne!(meter_id(), 0);
}

// The cache identity bundles all four parts; the decoder id varies independently of
// the policy id, which is the point of keeping them separate columns.
#[test]
fn cache_identity_keeps_decoder_independent() {
    let policy = default_policy();
    let one = policy.cache_identity(111);
    let two = policy.cache_identity(222);

    assert_eq!(one.policy_id, policy.policy_id());
    assert_eq!(one.meter_id, meter_id());
    assert_eq!(one.schema_version, SCHEMA_VERSION);
    assert_eq!(one.policy_id, two.policy_id); // same policy
    assert_ne!(one.decoder_stack_id, two.decoder_stack_id); // different decoder stack
    assert_ne!(one, two);
}
