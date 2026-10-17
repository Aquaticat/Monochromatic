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

## Corrected final manifest

On 2026-10-17, harness commit `0095ae37c7` corrects the Vmsync external specification
to the authored `//package/cli/vmsync:test:e2e` task with empty arguments,
package scope and the declared `package.cli.vmsync.build` prerequisite.
The source task is retained in `package/cli/vmsync/mise.toml`.
The final manifest SHA-256 becomes
`4f9bcf0a94e09ecda8eae84c8e5ff9d89f15f0bd398df8136f0771011d3931f7`.
The development requests retain their original digest and alternate unit-file route provenance.
Runtime equivalence of that alternate route has not been verified.
A comparison of the parsed manifests proves all 719 package checks
and the other 18 external specifications are unchanged.
The serialized package-check array has SHA-256
`c7c7aca4f7a2d3865bcaf9abc32ae8a7f546d7170be20c90f782402ffa6200b8`.

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
The missing records belong to the fuzz, mutation and container partitions;
workflow completion does not establish their completion.

Selective prerequisite recovery request `dhxhzzvmc3` uses pushed harness revision
`2676cb365a206434b525bf032a5875cafde827e9`.
It selects 12 package checks plus their declared prerequisite closure,
browser and DOM execution,
and only the sidecar generator check.
The root generator's observed tracked output difference remains a source diagnostic.

An invalid dispatch attempt, `tf9ddwgbw3`, used revision
`ac6b8f5cde945b4a3ce9ea9974744369547bbdba` instead of the intended trial revision.
Its four failed jobs receive no historical source-check credit.
The non-login command environment selected the repository Git shim;
Depot could not detect the repository or ref.
The corrected login-shell dispatch resolved `/usr/bin/git` and printed the intended pushed HEAD.

The remaining continuation queue selects the 34 unresolved checks
and three checks with retained `rsync` ownership infrastructure failures.
Each continuation receives an unchanged leaf task and its prerequisite closure in a separate job.
The ownership adapter has passed a bounded local positive and negative control;
the actual mutation consumer still requires verification.
Terminal collection must retain every attempt,
download and hash the artifacts,
reconcile executed check identities against the frozen manifest,
and classify prerequisite suppression separately from source failures.
Provider execution intervals remain usage proxies until paired with the declared allocation.
No passing complete graph or whole passing latency is established by this interim record.

The next actions are package terminal collection and per-check reconciliation,
bounded selective prerequisite recovery,
then a combined workflow with root-owned host, scanner, policy and VM routes.
The final coherent replay is held until the root agent aligns those routes.
The prepared combined workflow remains incomplete until that integration is verified.
Historical source failures stay terminal diagnostics for this measurement.
