# Depot owned allocation follow-on ledger

## Purpose and queue

The frozen baseline remains
`doc/audit/depot-owned-allocation-ledger-2026-10-18.evidence.json`,
with `223` allocation rows.
The parent's independent baseline review passed its timestamp/cost and source-body joins on 2026-10-18.
This follow-on will preserve separate source receipts and deduplicate every new identity against that baseline.
It will not rewrite baseline arithmetic or interpret admissions as measured allocations.

The requested queue is recorded before normalization:

- Original failed graph `39135886118`,
  if absent from the baseline.
- Coverage native desktop `0jpk5bwpvs`.
- Native BuildKit-auth runs `dzsf27t0xx`,
  `pxx75mxnw2`,
  and `38z4wlq9d3`,
  plus separate BuildKit IDs `j9r23brwtx`,
  `xwq746tv4z`,
  and `20l2bllb5n`.
- The six terminal cache-scope runs recorded in
  [the cache receipt](../audit/depot-cache-trust-scope-2026-10-18.evidence.json).
- Coverage standard public GitHub `39141147245`
  and later owned Depot OS controls when terminal and published.
- Corrected root graph GitHub `39140975786`
  and native `gb01kjx2qk`
  when terminal and published.

The machine follow-on will live at
`doc/audit/depot-owned-allocation-follow-on-2026-10-18.evidence.json`,
with its own retained source archive.
Known requested resources,
actual run/job/attempt identities,
observed intervals,
nominal list-compute arithmetic,
public GitHub zero compute,
conservative reservations,
and unknown VM or builder billing intervals will remain distinct.

This task is read-only with respect to cloud resources and account settings.
It allocates no jobs,
VMs,
or builders.
Root and coverage owners retain their active watcher ownership.

## Terminal cohort snapshot

The initial follow-on has `17` terminal allocation identities:
`5` Depot GitHub runner jobs,
`5` standard public GitHub jobs,
`4` native CI jobs,
and `3` separate BuildKit requests.
The normalization excludes `42` coverage identities already present in the frozen baseline.
These counts and source pointers are retained in
[the follow-on receipt](../audit/depot-owned-allocation-follow-on-2026-10-18.evidence.json).

Assigned Depot GitHub job intervals contribute a nominal list proxy of `USD 0.0167`.
Native job-attempt intervals contribute `USD 0.0094`.
The desktop native receipt only establishes its provider run envelope,
`279` seconds,
giving a separately qualified `USD 0.1116` run-envelope proxy.
Standard public GitHub nominal compute is `USD 0`.
These amounts are arithmetic over retained provider timestamps,
not observed invoices or measured VM billing lifetimes.

The BuildKit requests have `23.846` seconds of combined provider request lifecycle.
At the configured single-builder `USD 0.04/minute` reference,
their separate request-window proxy is `USD 0.015897333333`.
This does not establish allocated architecture-builder duration.
The first request failed before the hardware probe,
so its configured builder shape has no corresponding observed hardware measurement.

Rates come from the captured primary
[Depot CI sandbox table](https://depot.dev/docs/ci/overview#depot-ci-sandboxes),
[runner types](https://depot.dev/docs/github-actions/runner-types),
and [pricing](https://depot.dev/pricing).
The source archive retains original bodies and immutable workflow sources.
Full-window maxima remain historical reservations,
separate from observed provider interval proxies.

## Independent Rust projection queue

The coverage researcher requested a read-only package-result projection from the sealed Rust receipts.
The projection will join package root,
owning task and arguments,
immutable run/attempt,
case identity or count basis,
source failures and skips,
and evidence pointers for frozen application source
`e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
It will not run additional workloads or turn Cargo source inventory into executed test credit.
