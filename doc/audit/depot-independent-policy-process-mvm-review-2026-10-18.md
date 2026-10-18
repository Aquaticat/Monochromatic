# Independent Depot policy, process and MVM evidence review

## Review boundary

This review independently decodes the original archive bundles for
[`job-policy-history`](depot-job-policy-history-2026-10-18.evidence.json),
[`process-timeouts`](depot-process-timeouts-2026-10-18.evidence.json)
and [`mvm-kvm`](depot-mvm-kvm-2026-10-18.evidence.json).
It also checks the combined-product pricing arithmetic and the coordinator's
[`expanded CI report`](../planning/depot-expanded-ci-evaluation.md).
The review excludes this reviewer's own Rust execution claims.
No new cloud allocation is admitted.

All 19 encoded original ZIPs decoded with strict base64 validation,
matched their recorded byte lengths and SHA-256,
and passed Python's independent ZIP CRC checks.
The ZIPs contain 566 file members totaling 802,946 uncompressed bytes;
the original ZIP bytes total 263,197.
Every member was decoded and individually hashed.
All member bodies were UTF-8 text;
there were no media or undecodable binary members.
The private independent catalog and input snapshots are retained under
`temp/agent/depot-independent-review-20261018` in the executing user's home.

## Findings

### Corrected: MVM file roundtrip does not independently exercise guest payload access

The initially reviewed coordinator report's MVM paragraph calls the transfer a 51-byte file roundtrip.
The stronger description of this as a guest payload roundtrip is not established.
All passing lifecycle receipts declare `consumer.meta.fileTransfer = "virtiofs"`.

At application source `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`,
`package/cli/mvm/src/file-transfer.ts:282` uses a host copy:

```ts
// package/cli/mvm/src/file-transfer.ts:282, abridged.
await copyFile(hostPath, sharedHostPath);
```

The matching shared-directory pull at `file-transfer.ts:409` reads that host file:

```ts
// package/cli/mvm/src/file-transfer.ts:409, abridged.
const content = await readFile(sharedHostPath);
return content;
```

Both paths select `basename(guestPath)`.
`package/cli/mvm/README.md:170` explicitly documents this shared-directory route
and distinguishes it from the guest-agent route.
This is not a newly inferred product defect.

The actual standard-GitHub consumer at harness
`64d6a666e63e4773ee56666148ae9c8ba371877a`,
`.depot/research/mvm/mise.toml:251` to `259`,
creates a guest directory,
then calls push and pull without a guest payload read or write:

```js
// .depot/research/mvm/mise.toml:256, abridged.
fs.writeFileSync(hostInput, payload);
requireSuccess(mvm('push', ['push', manifest.guest.name, hostInput, guestPath]));
requireSuccess(mvm('pull', ['pull', manifest.guest.name, guestPath, hostOutput]));
if (!payload.equals(fs.readFileSync(hostOutput))) {
  throw new LifecycleProbeFailure('Real guest file roundtrip bytes differ');
}
```

The retained commands and stdout agree with this source:
push reports `/mnt/shared/owned-<nonce>.bin`,
and pull reads the host `shared/` path.
The requested `/root/temp/agent/` directory does not strengthen the transfer assertion,
because the shared route uses only its basename.

Correct the report and transfer summary to:
“51-byte shared-directory CLI roundtrip;
guest payload visibility/write was not separately asserted.”
Keep the actual guest stdout,
exit status `2`,
QMP/KVM and private-domain/daemon cleanup credit.
A future separately admitted consumer can have the guest read and transform `/mnt/shared/` bytes
before pulling the changed result.
That consumer was not executed by this review.

The coordinator accepted this finding.
The current report explicitly calls the original result a shared-directory CLI roundtrip
and retracts separate guest payload visibility/write credit.
The original archive bytes remain authoritative;
the correction changes their qualification rather than their contents.

## Original archive and observation joins

The independent decoder used strict base64 decoding,
SHA-256 and byte-length comparison,
`zipfile.ZipFile.testzip()` and an explicit read of every non-directory member.
All 19 ZIP metadata joins and all 53 structured observation/member-hash joins pass.
The observations include the policy controls,
the process-timeout controls and every retained MVM diagnostic observation,
including prerequisite failures.

The original compressed bundles have these SHA-256 values:

- `depot-job-policy-history-2026-10-18.archives.json.gz`:
  `c96e692b6dacebaffac76c045c46286fbd49b92262b91b7395dd0bec1597ac6c`.
- `depot-process-timeouts-2026-10-18.archives.json.gz`:
  `ae7580dcf37185b3422befd024f4f1fd7fa342e79f3c4d92c3dffafceb899d4e`.
- `depot-mvm-kvm-2026-10-18.archives.json.gz`:
  `9ec38d2f8c3605e9400b0960a24d29196ad012c19f89fb9ce042c4b8e8d2a38f`.

Every decoded text member was included in credential-pattern inspection.
Manual inspection of every resulting candidate found QEMU help placeholders
(`password=password` and `password=<file>`)
and captured source code invoking `getent passwd`.
The broader context sweep also retained only system passwd identifiers,
key-file help paths and udev rule placeholders.
The dense QEMU logs name ephemeral master-key file paths;
they do not include those key files or their contents.
No credential material was found in this decoded-member review.
This is a bounded review of the retained members,
not a guarantee about unretained provider state.

## Job and step continuation

The raw receipts preserve a distinction between job continuation and step continuation:

- Native `kjf78stmkb`,
  source `f446852c42d4a382ba7931e6730a17cb3d8308e0`,
  has aggregate status `failed`.
  Its `allowed_failure` job is `failed`,
  while `consumer` and `history` are `finished`.
  The consumer's actual `needs.allowed_failure.result` is `success`.
- The paired GitHub run `39122132487` has workflow conclusion `success`,
  `allowed_failure` job conclusion `failure`,
  and consumer job conclusion `success`.
  This does not mean the failed GitHub job itself became successful.
- Native default-needs control `pfzfjrqdpq`,
  source `714a3cad36c20da75969454fe33f28dab7770e9b`,
  again has aggregate `failed`,
  failed allowed-failure job and finished consumer.
  The exact `.depot/workflows/ordinary-job-default-consumer.yml` source
  has `continue-on-error: true` on the failing job,
  an ordinary dependent consumer and no consumer `if` override.
- Native isolated step control `lrhfzwrwl2`,
  at the same `714a3cad36` source,
  has finished job and workflow.
  Its raw step observation reports outcome `failure` and conclusion `success`.
  `.depot/workflows/advisory-step-result.yml` puts continuation on the step.
  This verifies that bounded step workaround;
  it does not separately prove every GitHub App aggregate or required-check configuration.

The read-only history probe performed no uploads and executed no application tests.
Its original 34-candidate queries had no retained per-test timings.
The actual-class positive control found a timing;
the absent-class control did not.
These are API identity/timing controls,
not additional application case credit.

## Process deadline and advancement

All observations use harness `44b3303eca52a58806e28a6e8b681be07d43c278`.
The source task waits 70000 ms without a signal handler,
and the CI step limit is 60000 ms.
Every retained writer completed after 70009 ms.
Every timeout step has outcome `failure` and conclusion `success`.
These measurements establish deadline overrun on all three providers.

The boundary timestamps establish different advancement behavior:

- Standard GitHub writer completion is `2026-10-18T07:17:26.662Z`;
  observer-step start is `2026-10-18T07:17:26.6831188Z`.
  Completion precedes observer start.
- Depot-managed GitHub writer completion is `2026-10-18T07:17:24.042Z`;
  observer-step start is `2026-10-18T07:17:24.0592659Z`.
  Completion precedes observer start.
- Native writer completion is `2026-10-18T07:24:57.299Z`;
  observer-step start is `2026-10-18T07:24:46.969Z`.
  Completion follows advancement by 10.330 seconds.

The native same-VM observation also corroborates advancement:
the observer waits twelve seconds and records elapsed time 72027 ms from writer start,
while writer completion is at 70009 ms.
The observer necessarily began its wait before that completion.
The narrowed conclusion in
[`depot-step-timeout-process-boundary.md`](../troubleshooting/depot-step-timeout-process-boundary.md)
is supported.
These observations do not establish every descendant's kill path,
physical VM release,
billable lifetime or indefinite orphaning.

## Original MVM lifecycle checks

The passing native,
Depot-managed GitHub and standard-GitHub observations retain distinct harness sources
`6b3c75517e798161e79ddb7e496b78cf1ffc4240`,
`1438ecde4b643a606e0a75f85067e3d0153e9bb5`
and `64d6a666e63e4773ee56666148ae9c8ba371877a`.
They bind the frozen application source separately from those harness revisions.

For every passing consumer,
this review reconstructs the exact 51-byte payload from its guest-emitted nonce
using the harness's `depot-current-mvm-<nonce>\n` encoding.
Its independently computed SHA-256 matches the retained payload digest.
The raw receipts also retain actual guest stdout,
the deliberate missing-path stderr and exit status `2`,
QMP's enabled KVM result,
empty remaining private-domain inventory,
both owned daemons exited and no recorded cleanup-operation errors.
The daemon logs retain startup/guest-agent diagnostics;
empty cleanup-operation errors do not assert globally empty stderr.
The standard-GitHub replay's disposable child changes device-group membership
while preserving UID/GID.
None of these facts repairs the separate payload-access gap in the original consumer.

## Independent pricing recomputation

The reviewed
[`combined model`](depot-combined-product-pricing-2026-10-18.evidence.json)
has SHA-256 `933fa5192300d380bd01ba456709de4406ce2af7733579a937f4ff6e59d29b1d`.
Fresh unauthenticated requests at `2026-10-18T13:03:23Z` to `13:03:24Z` fetched
[pricing](https://depot.dev/pricing),
[native CI overview](https://depot.dev/docs/ci/overview.md)
and [GitHub runner types](https://depot.dev/docs/github-actions/runner-types.md).
Both documentation bodies exactly match the retained allowance-source snapshots.
Fresh pricing HTML differs in bytes,
but its normalized visible text exactly matches the retained pricing HTML.
The independent visible-text SHA-256 is
`f7fdd24fa61ba9b865bbe546e4f79614cab1171798562e2c5d442bfee8738284`.

The independent calculation uses decimal arithmetic and separately derives these inputs:

- Developer fee USD 20,
  500 build base minutes,
  2000 native two-CPU base minutes,
  2000 GitHub Linux two-CPU base minutes,
  25 GB combined average storage and 1000000 passing results.
- Startup fee USD 200,
  5000 build base minutes,
  20000 native two-CPU base minutes,
  20000 GitHub Linux two-CPU base minutes,
  250 GB combined average storage and 1000000 passing results.
- Overage rates:
  USD 0.04 per default 16-CPU/32-GB build base minute,
  USD 0.006 per native two-CPU base minute,
  USD 0.006 per GitHub Linux two-CPU base minute,
  USD 0.20 per combined GB-month and USD 0.000001 per additional passing result.

All line items and all 12 plan/scenario totals match.
The six scenarios produce Developer/Startup totals respectively:

- No overage:
  USD 20 / USD 200.
- Native allowance boundary:
  USD 128 / USD 200.
- Both separate Linux compute boundaries:
  USD 236 / USD 200.
- Build boundary:
  USD 200 / USD 200.
- Combined product boundary:
  USD 461 / USD 200.
- Explicit mixed illustration:
  USD 142 / USD 201.

These inputs are hypothetical monthly scenarios,
not a repository workload forecast,
invoice or spending cap.
Native and GitHub compute entitlements remain separate;
storage and passing results remain combined.
The model grants no unresolved generic-SDK or Mac allowance normalization credits.

## Report review and queued verification

The initially reviewed expanded report has SHA-256
`32ff533fe204730eac804b6f59b55dc385f52eff655a9901b38c2eb8f13d2430`.
Outside this reviewer's Rust claims,
its distinctions between current and historical source cohorts,
build production and real consumers,
APK production and device instrumentation,
passing browser cases and retained WebKit failure/skip,
API identity probes and application tests,
and hypothetical pricing versus a complete workload forecast are explicit.
No other material overstatement was established in this document-level review.
This is not a second independent execution of every linked application suite.

The MVM qualification finding was accepted and its current report wording rechecked.
The coordinator is separately executing a finite three-pool consumer that reads pushed bytes in the guest,
creates a distinct initially absent output and pulls the guest-transformed result.
Independent decoding,
CRC/hash/outcome joins and credential inspection of those three new ZIPs are queued
after publication.
They must remain a separate cohort from the original eight MVM ZIPs.

The original-cohort review checkpoint `7d743ae989` passed the targeted
`mise run lint:monochromatic-lint -- doc/audit/depot-independent-policy-process-mvm-review-2026-10-18.md` task.
Its complete `marked` renderer output was inspected.
The original compressed archive hashes were rechecked unchanged after the coordinator's correction.

## Additional review queue

The coordinator assigned independent review of these additional published cohorts:

- `depot-service-containers-2026-10-18.evidence.json` and its ten original ZIPs:
  original bytes,
  CRC/member hashes,
  consumer/source identity,
  actual Node/Git versus base-image runtime and credential privacy.
- `depot-runtime-pr-2026-10-18.evidence.json` and its eleven original ZIPs:
  original bytes,
  CRC/member hashes,
  PR App/source/merge identities,
  disposable-resource cleanup and credential privacy.
- `depot-container-prerequisites-2026-10-18.evidence.json` and its source bundle:
  prerequisite evidence and the pinned checkout-source reasoning.
  No generic REST-stall cause is presumed.

This work uses published/local evidence and read-only source inspection.
It admits no cloud allocation or repository/billing settings change.
The separate three-ZIP guest-transformation review remains queued after publication.
