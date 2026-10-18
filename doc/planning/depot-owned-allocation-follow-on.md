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

## Independent Rust projection

The coverage researcher requested a read-only package-result projection from the sealed Rust receipts.
The [published projection](../audit/depot-rust-package-result-projection-2026-10-18.evidence.json)
joins package root,
owning task and arguments,
immutable run/attempt,
case identity or count basis,
source failures and skips,
and evidence pointers for frozen application source
`e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
Its `23` package roots contain `61` separately qualified execution contexts across `15` roots.
That context count includes repeated suites,
fuzz targets,
benchmarks,
and functional consumers;
it is not a unit-test total.
The derivation runs no workloads and does not turn Cargo source inventory into executed test credit.

## Native graph wrapper review

Root reported terminal native graph `gb01kjx2qk`
and committed the browser prerequisite correction at `72af18d5b1`.
Independent local controls inspected the actual generated Podman wrapper.
The deciding boundaries are native-only `sudo --non-interactive`,
the preserved original absolute Podman command,
unchanged direct invocation for other providers,
and retained `2` CPU,
`2` GiB,
and `256` PID runtime caps.
The [sealed local receipt](../audit/depot-expanded-graph-podman-preflight-2026-10-18.evidence.json)
passes `24` provider/command controls and a missing-sudo failure control.
It verifies routing and arguments with fake executables,
not actual native rootful execution.
This local inspection allocated no cloud resources.

The initial allocation normalization passes `21` source-body joins,
`17` timestamp/arithmetic joins,
and `4` original ZIP member CRC checks.
The frozen baseline remains unchanged.
The wrapper archive separately passes its `6` source-body joins.
The Podman troubleshooting note's `34` existing semantic-line-break findings reproduced on its baseline.
Only those reported spaces were replaced with newlines,
with identical non-whitespace content;
targeted lint then passed.

## Independent graph parity review

Root's corrected GitHub graph `39140975786` is terminal.
Its four exact completed samples and raw Rust command logs are retained in the root expansion controller.
The [independent parity review](../audit/depot-expanded-graph-parity-review-2026-10-18.evidence.json)
checks `840` original ZIP members by CRC,
rejoins the eight Rust command logs by bytes and SHA-256,
and retains `1,304` emitted status records across the four samples.
Every sample has the same `237` forbidden-strings PASS identities
and the same `89` Truepeak PASS identities.
Controls change an actual raw-log case name or PASS status and correctly reject equality.
Reordering cases or changing progress ordinals and timing prefixes preserves identity.
Default terminal logs do not establish skipped-case identities.
This review executes no source tests and allocates no cloud resources.

Independent phase arithmetic reproduces the source-bound two-repetition ratios:
shared producer `2.8682535459178453`
and Rust `2.2111151175725956`.
The retained means and spreads are per completed subgraph,
not a whole-pipeline multiplier or a general provider estimate.

Coverage's first public host handoff `39141147245` is terminal with five allocated jobs.
Its skipped unassigned scheduler row `117715669048` must not become a compute allocation.
Recovery `39144499822` remains owner-watched;
the separate Depot OS admission remains unallocated.
The documented host memory unit is GB,
with actual CPU and RAM measurements missing from that handoff.

## Prepared image cleanup queue

Root requested exact owned `tools-r1`,
`tools-r2`,
and `tools-r3-fuzz-codex` image cleanup after their sealed consumers.
The Rust lane will inspect retained identities,
confirm coverage has no remaining consumer,
read the current scoped deletion contract,
and retain timestamp and exact absence receipts.
No account-wide listing is authorized.
Local worktrees and source archives remain retained.
