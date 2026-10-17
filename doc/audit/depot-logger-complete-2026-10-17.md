# Logger affected CI execution on 2026-10-17

## Purpose and source identity

Execute the complete reviewed logger change surface at
`ef01490f5e960f8ca0b424c12242caeb3c5a2b5e`,
including its affected consumers and external host boundaries.
The frozen `.depot/manifests/logger.json` has SHA-256
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

## Remaining evidence

Both Depot requests are running.
Terminal collection must retain every attempt,
download and hash the artifacts,
reconcile executed check identities against the frozen manifest,
and classify prerequisite suppression separately from source failures.
Provider execution intervals remain usage proxies until paired with the declared allocation.
No passing complete graph or whole passing latency is established by this interim record.

The next action is terminal collection and per-check reconciliation,
followed by narrowly scoped harness recovery for execution failures.
Historical source failures stay terminal diagnostics for this measurement.
