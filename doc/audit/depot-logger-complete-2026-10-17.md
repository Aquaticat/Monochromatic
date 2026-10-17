# Logger affected CI execution on 2026-10-17

## Purpose and source identity

Execute the complete reviewed logger change surface at
`ef01490f5e960f8ca0b424c12242caeb3c5a2b5e`,
including its affected consumers and external host boundaries.
The development `.depot/manifests/logger.json` has SHA-256
`f4cbd47f210f5b031d76c5fc1c28fa704b349621f91eefa3f4f3ad575acfedc3`.
It contains 719 package checks and 19 external check specifications.

The trial harness lives on branch `trial/depot-complete-ci-20261016`.
Its source checkout and dependency lockfiles remain historical inputs.
Harness changes add execution, resource bounds and evidence retention;
they do not repair historical source failures.

## Graph verification

A separate traversal verified unique package check identities,
existing prerequisite identities, absence of cycles,
and every declared partition's exact prerequisite closure.
The static wave activates 440 checks and the unit wave activates 230.
Their union contains 564 checks.
The remainder partitions select the other 155 checks without overlap.
Their complete union is exactly the frozen 719 checks.
Every package Oxlint specification retains its unchanged package task and empty argument list.

The retained graph verification is summarized in the companion evidence JSON.
The earlier import audit and source freeze remain in the branch's manifest history.

## Candidate manifest revisions

On 2026-10-17, harness commit `0095ae37c7` corrects the Vmsync external specification
to the authored `//package/cli/vmsync:test:e2e` task with empty arguments,
package scope and the declared `package.cli.vmsync.build` prerequisite.
The source task is retained in `package/cli/vmsync/mise.toml`.
That candidate manifest SHA-256 became
`4f9bcf0a94e09ecda8eae84c8e5ff9d89f15f0bd398df8136f0771011d3931f7`.
The development requests retain their original digest and alternate unit-file route provenance.
Runtime equivalence of that alternate route has not been verified.
A comparison of the parsed manifests proves all 719 package checks
and the other 18 external specifications are unchanged.
The serialized package-check array has SHA-256
`c7c7aca4f7a2d3865bcaf9abc32ae8a7f546d7170be20c90f782402ffa6200b8`.

Harness commit `09941541e8` adds the missing `package.module.dom.build` prerequisite to `root.e2e`
and `package.webapp-productivity.wc.build` to `root.browser`.
Their immutable consumers read the corresponding built artifacts.
The current candidate digest is
`d8cf02e46bafd03ab4f410ccf2a259a29c68c757af1cddf81735258372025af9`.
All 719 package specifications remain unchanged.
Relative to the original development manifest, only those external rows and the Vmsync row differ.

## Current execution requests

- [Package, Pi and WireGuard request `4x77lb56cs`](https://depot.dev/orgs/l4zncjjbj5/workflows/4x77lb56cs)
  uses pushed harness revision `b0c730f8bfb9081345cda89da1f79ff3239e7fb6`.
  It includes static and unit waves,
  the seven remainder partitions,
  configured offline Pi host checks,
  and private WireGuard integration checks.
- [External request `j4m7gw8mwg`](https://depot.dev/orgs/l4zncjjbj5/workflows/j4m7gw8mwg)
  uses pushed harness revision `1c189c7068e50401b0288f8ddbd3d0946999a913`.
  It includes browser, DOM E2E, Electron Wayland,
  generator consistency, full root Oxlint,
  and music desktop artifact/runtime groups.

Both requests were launched from clean worktrees after verifying the remote branch revision.
They therefore avoid Depot's automatic local patch injection.
These are separate request intervals;
their durations must not be described as one measured complete pipeline latency.

## External coverage ownership

The external request selects eight specification identities:
`root.browser`,
`root.e2e`,
both Electron Wayland checks,
`root.generated-consistency`,
`sidecar.generated-type-consistency`,
`root.config-oxlint`,
and `artifact.music-desktop-e2e`.

The browser specification retains its eight declared files and three configured engines.
The DOM E2E specification retains four declared files and two configured engines.
Each generator check receives its own disposable historical worktree.
The desktop group builds the historical desktop artifact and compositor
before invoking the existing private runtime adapter.

The package request's Pi group owns notification delivery,
terminal verification,
configured extensions,
and the expensive offline tmux test.
Its WireGuard group owns route and bypass integration.
The root agent owns the fs-id and semantic-bridge host workflow,
changed-file forbidden-string scanner,
and current-policy Scorecard gate.
The separate VM experiment owns the historical vmsync lifecycle boundary.

The current [host request `39003180992`](https://github.com/Aquaticats/Monochromatic/actions/runs/39003180992)
passed all six jobs across Linux, macOS and Windows.
Independent log verification matched the immutable source revision and both dependency lockfile hashes
before and after each job.
Filesystem checks verified preferred stable identities without colons.
Each semantic job passed its three lifecycle, offset and external-consumer groups.
The authored external-consumer test does not retain its fresh dependency lockfile,
so the versions selected by its allowed dependency ranges remain unverified.
The provider job intervals total 417 seconds and 1530 vCPU-seconds.
Standard public GitHub runner compute is free under the cited allocation policy;
this does not verify storage charges or the account ledger.

## Remaining evidence

Both Depot development requests are terminal with failed status.
The external collection retains every attempt and hashes every downloaded artifact.
The package collection retains its 11 attempts and 11 hashed artifacts.
Independent reconciliation verifies every executed package log hash and byte count.
It finds terminal records for 685 package identities.
The other 34 identities contain three started checks without terminal records and 31 unstarted checks.
That snapshot covers request `4x77lb56cs` only and remains preserved.
The global development union also verifies 46 executor observations from external requests
`j4m7gw8mwg` and `dhxhzzvmc3`, including every task argument, output hash and output byte count.
The browser-properties bundle adds one terminal identity:
the global union contains 686 terminal identities and 33 unresolved identities.
This union is development evidence, not a coherent complete replay or proof of source eligibility.
The missing records belong to the fuzz, mutation and container partitions;
workflow completion does not establish their completion.

Selective prerequisite recovery request `dhxhzzvmc3` uses pushed harness revision
`2676cb365a206434b525bf032a5875cafde827e9`.
It selects 12 package checks plus their declared prerequisite closure,
browser and DOM execution,
and only the sidecar generator check.
The root generator's observed tracked output difference remains a source diagnostic.
The recovery is terminal with failed status and all four artifacts collected and hashed.
Its 12 requested package checks and their 24-check prerequisite closure passed.
Both sidecar generator commands passed without tracked or untracked output changes.
Independent reconciliation verifies every executed check log hash and byte count.

The browser task reached the engines but exceeded the adapter's exact 1,200,000 ms budget.
Its source configuration selected 84 cases with eight workers;
the interrupted group does not prove that every file or engine completed.
The DOM group selected 34 cases and failed during browser or fixture setup,
including `pthread_create` resource errors and a missing built DOM artifact.
These outcomes are distinct from source assertion failures.
The current candidate adds the missing build dependencies and uses one browser worker.
The prepared browser routes partition the frozen files and configured engines into 32 disjoint cells.
Their auxiliary manifest retains the immutable configuration hashes and unchanged primary manifest digest.
Two `2x8` pilot cells precede the remaining 30 cells; the full 32-cell route remains held.
Native Playwright `1.64.0` controls verify that adding JSON preserves the configured dot and HTML reporters.
Actual generated-program controls verify full inventories,
exact partition inventories,
normal source failure exit preservation,
and rejection of an incomplete full inventory before source execution.
Cloud pilot `x0rb16tjzb` started at `2026-10-17T06:47:04Z` from clean pushed harness
`c0eefbea382ef41c4667e90242010757eb5f759f`.
The provider confirms that exact source and head revision.
Its terminal collection must establish actual worker, image and resource behavior before fan-out.

Provider request IDs and workflow IDs name different objects.
Request `dhxhzzvmc3` contains workflow `fjdhk1bj7r`.
Every recovered artifact's `providerJobUrl` exactly matches its current attempt's `view_url`.
The separate provider identity verification retains that equality control;
the different workflow ID is not a stale environment defect.

An invalid dispatch attempt, `tf9ddwgbw3`, used revision
`ac6b8f5cde945b4a3ce9ea9974744369547bbdba` instead of the intended trial revision.
Its four failed jobs receive no historical source-check credit.
The non-login command environment selected the repository Git shim;
Depot could not detect the repository or ref.
The corrected login-shell dispatch resolved `/usr/bin/git` and printed the intended pushed HEAD.

Continuation request `1wzr86fssk` selects the 34 unresolved checks
and three checks with retained `rsync` ownership infrastructure failures.
Each continuation receives an unchanged leaf task and its prerequisite closure in a separate job.
It started at `2026-10-17T05:41:08Z` from clean pushed revision
`09941541e8ba43d59b03969248f8484a2d2c4269`.
The provider independently reports that revision in its `ref`, `sha` and `head_sha` fields.
All 37 attempts failed before source execution with Podman's diagnostic
`cannot unmount /sys/kernel/debug: device or resource busy`.
All 37 logs independently confirm the same failure and no generic case or remainder execution.
All 37 artifacts are downloaded and hashed; the request adds no source-check credit.
The locally passing user-namespace mapping is rejected at the actual cloud boundary.

Owned-tmpfs-volume pilot `85fv28fjkl` used clean pushed revision
`bc6889aaaa8da7974824380bd18f0447ab6945d5` and is terminal with failed status.
Its cloud preflight passed the private-manifest denial and source-owner positive control,
with verified volume cleanup and no added capabilities or user-namespace mapping.
The unchanged mutation CLI integration then reached 49 shards.
Its `rsync` sender could not read `/baked/node_modules/.pnpm-workspace-state-v1.json`
under the adapter's nonroot UID.
The log proves `Permission denied (13)` but does not record the file's UID, GID or mode;
the next control must measure them before attributing the permission cause.
All 49 shard volumes were removed and verified absent.
This newly exposed adapter prerequisite is separate from mutant assertion failures.
Subsequent request `360d91ht6w` used clean pushed harness
`d098532a5b6946231daf3c4f43e38444359a307e` and passed the unchanged CLI integration and both builds.
Independent collection verifies all three executed logs and unchanged source inputs.
The actual source-image metadata measured UID `0`, GID `0`, mode `0600`, and 33,427 bytes.
Its SHA-256 is `1b0f6d958e4a1269a2c420b3bf55adb9c1030ba8183bd94629a2c7c7cc14084d`.
Six original TAR archives and owned readonly copies preserve identical bytes and unchanged image identity.
All six shard volumes and six metadata-inspection containers were verified removed.
The authored integration assertions passed with 11 killed mutants,
six survivors,
two compile errors and no runtime errors.
This new measurement does not retroactively establish the unrecorded mode in `85fv28fjkl`.
Distinct incidents [#1116][mapping-incident] and [#1117][metadata-incident]
were duplicate-searched,
filed,
and closed with the actual source-consumer proof on the trial branch.
The troubleshooting record preserves every rejected boundary and the measured repair.
Provider execution intervals remain usage proxies until paired with the declared allocation.
No passing complete graph or whole passing latency is established by this interim record.

The executor now separates manifest inventory, requested leaves, prerequisite closure,
live running checks and completed records.
It writes `case-progress` while execution continues,
`case-finished` only after the selected checks and source-input verification finish,
and `case-aborted` when execution is incomplete.
Its `completeGraph` field reflects the manifest.
Five disposable controls passed, including a live consumer of its own running record
and rejection of the previous executor by that same consumer.

The Git host task's immutable description explicitly requires the gate's Git `2.56.0`
for tests that start Git.
The observed host `2.55.0` mismatch is therefore a missing test prerequisite.
The next host recovery must supply the audited Git executable and required libraries
before rerunning the unchanged host tasks.
Any resulting source failures must remain separate from that mismatch
and from the existing native container baseline failures.

Continuation `1pgpb8qhn6` started at `2026-10-17T06:53:35Z` from clean pushed harness
`51d5a2fd69507d9346d7fe6eb6345a4ee9929383`, independently confirmed by the provider.
Its 35 disjoint selectors contain the 33 globally unresolved identities
and the two remaining ownership-prerequisite repairs.
Their frozen prerequisite closures are verified.
The passed browser-properties bundle and CLI integration are excluded from this development recovery.
This request retains `16x64` provider allocation and original container bounds;
compute must count the allocated 16 CPUs.
The next actions are terminal leaf reconciliation,
file/engine browser recovery after its supported `2x8` pilot,
controlled Git host prerequisite recovery,
and a combined workflow with root-owned host, scanner, policy and VM routes.
The final coherent replay is held until the root agent aligns those routes.
The common cohort manifest will be a separate authenticated, byte-verified file on `main`.
Its outer SHA-256 differs from the single-case logger manifest digest.
The combined workflow must bind the same cohort ID,
outer digest and request timestamp before and after execution,
and validate the common manifest's logger source, base, case digest and route harness revision.
That receipt implementation and final freeze remain pending.
The prepared combined workflow remains incomplete until that integration is verified.
Historical source failures stay terminal diagnostics for this measurement.

[mapping-incident]: https://github.com/Aquaticats/Monochromatic/issues/1116
[metadata-incident]: https://github.com/Aquaticats/Monochromatic/issues/1117
