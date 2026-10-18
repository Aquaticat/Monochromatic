# Depot test identity adapter research

## Status and admitted scope

This research is preparing a serial native CI profile from frozen application source
`e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
No adapter profile has been dispatched.
The purpose is to test historical weighting for individual runnable Nextest test names
without changing production test reports or routing.

The parent admitted the existing source-bound 98,192,385-byte Nextest/Git/tools producer,
34 unchanged selected cases,
three seed repetitions,
two distinct physical shard jobs,
and a downstream consumer.
The profile may consume at most one concurrent VM.
Its full configured-window compute reservation is USD 0.174.
Prior physical-profile reservations total USD 0.348,
and a separately admitted read-only history follow-up reserves USD 0.012.
The resulting conservative campaign reservation is USD 0.534 under the shared USD 1 ceiling.
These are scoped reservation proxies,
not an invoice or account-wide cap.

The transport admission permits one new exact repository secret variant containing only a
five-minute signed GET for the owned producer object.
The controller must verify exact variant absence,
bind through standard input,
retain no signed query in public evidence,
and delete that variant with an absence check after terminal evidence retention.
No broad credential is sent to a job.

## Deciding source and existing evidence

The [Depot split contract][split] permits filename or classname candidate identities.
Individual-case timing granularity does not change candidate identity.
The [raw physical cohort](../audit/depot-physical-test-shards-2026-10-18.evidence.json)
has distinct test names but one binary classname.
The parent's later actual-classname positive control establishes history reach;
it does not establish per-test balancing with arbitrary unmatched classnames.

Nextest `cargo-nextest-0.9.148`,
commit `cd1d6d5467322dbc0d39a80cb671d000ac302798`,
unconditionally sets ordinary testcase classnames from `test_instance.binary_id` in
`nextest-runner/src/reporter/aggregator/junit.rs:219`.
Its skipped-case path does the same at line 262,
and its source test explicitly expects the binary ID at line 921.
`nextest-runner/src/config/elements/junit.rs:155` exposes report path/name,
output storage,
skipped-case,
and flaky-status controls,
without a classname-format field.
The versioned [JUnit documentation][nextest-junit] describes each binary as a suite
and recommends post-processing for tools with different expectations.

The next step is a narrow derived-upload adapter after validating the exact producer binary version.
It will preserve every raw XML file,
original suite/test identities,
per-case durations,
and raw-to-derived hashes.
Each derived classname must equal a validated exact runnable test name.
Positive,
duplicate,
unknown-name,
markup-boundary,
and other rejected-input controls must pass before cloud dispatch.
No generic arbitrary-JUnit compatibility is presumed.

## Work still required

Prepare the isolated controller and source manifest,
qualify the mapper locally against original XML and adversarial controls,
then run the admitted serial seed/shard/consumer profile.
Preserve ingestion separately from actual history coverage.
If same-run history visibility is insufficient,
use only the separately admitted bounded read-only follow-up.
Do not infer a speed benefit or complete 1,956-case suite qualification from this selected cohort.

[split]: https://depot.dev/docs/ci/how-to-guides/split-tests
[nextest-junit]: https://github.com/nextest-rs/nextest/tree/cargo-nextest-0.9.148/site/src/docs/machine-readable
