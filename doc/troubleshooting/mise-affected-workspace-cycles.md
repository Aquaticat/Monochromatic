# Mise 2026.10.0 rejects cyclic workspace dependencies before selecting affected tasks

## Symptom

Installed Mise 2026.10.0 advertises `--affected` and `--affected-json`,
but both of these repository probes exit with status 1:

```sh
# Repository root, metadata only
mise tasks graph --json
mise run --affected --affected-json --affected-base HEAD --affected-head HEAD \
  '//package/module/toml-edit:lint:types'
```

The emitting tool reports:

```text
mise ERROR workspace project dependency cycle detected: node:@monochromatic-dev/config-rolldown -> node:@monochromatic-dev/module-test -> node:@monochromatic-dev/config-rolldown; adjust [monorepo.projects."node:@monochromatic-dev/config-rolldown"] depends, depends_add, or depends_remove to break the cycle
mise ERROR Version: 2026.10.0 linux-x64 (2026-10-02)
```

The task is not running and failing.
Workspace graph validation fails before an affected selection can be returned.
The error can therefore occur even when the requested task belongs to a different package
or the explicit base and head are equal.

## Root cause

The source clone is `jdx/mise`,
tag `v2026.10.0`,
commit `bc11f90c74eba23bf0d7350efb540e62fb7d9ffd`.
It was read without modifying or executing upstream project code.

`get_affected_task_list` builds the workspace graph before resolving and diffing the requested revisions:

```rust
//! jdx/mise/src/cli/run.rs:375
let graph = config.workspace_project_graph()?;
let revisions = crate::task::workspace::git::WorkspaceGitRevisions::resolve(base, head);
let changed_paths = revisions.changed_paths(&workspace_root)?;
```

The workspace graph validator rejects a cycle in `src/task/workspace.rs:1054`:

```rust
//! jdx/mise/src/task/workspace.rs:1054
if let Some(path) = self.find_cycle() {
    return Err(WorkspaceProjectCycleError { path }.into());
}
```

`WorkspaceProjectCycleError::fmt` at `src/task/workspace.rs:490` formats the diagnostic
and proposes graph overrides.
The project graph supports development edges;
the repository actually declares both sides of this cycle in
`package/config/rolldown/package.json:17` and `package/module/test/package.json:39`.
This is not evidence of an unresolved package name or missing task.

The current [workspace graph documentation][mise-graph] explicitly requires a final graph without cycles.
Its override mechanism can change the graph,
but that changes what affected means if the removed dependency is real.
Publication ordering is a separate use:
`package/config/pnpr/src/publish-missing-versions.ts:36` already documents why its publisher excludes development edges.
CI reverse impact must not inherit that exclusion without checking the consumers it loses.

## Verification

The retained [routing proof](../planning/depot-developer-pool-routing-proof.json)
contains the successful Node fixture and the actual repository error.
The fixture has a changed producer,
a consumer declaring a development dependency on that producer,
and an unrelated package.
The working catalog is:

- `mise tasks graph --json` reports the acyclic fixture graph.
- `--affected-json` selects producer and development consumer,
  excludes the unrelated package,
  and executes no task.
- The corresponding actual affected run executes producer and consumer tasks only.
- Incumbent pnpm 12.14.0 lists the complete logger reverse closure in this repository:
  157 package names plus repository root,
  exactly matching an independently collected declared-edge reachability set.

The failing catalog is:

- The real repository cycle rejects both graph listing and affected JSON selection.
- Adding a producer development dependency back to its consumer in the disposable fixture
  reproduces the cycle rejection with status 1.
- A missing Git base revision in the acyclic fixture fails with
  `git diff for missing-revision-that-must-fail...<head> failed`;
  it does not return an empty successful selection.
- Removing the synthetic producer-to-consumer edge through an override allows graph validation,
  but a subsequent consumer change selects only the consumer even though the producer's manifest
  still declares that dependency.
  The override hides actual declared impact in that direction.

The override control uses baseline `b0812458fea24edc4b493022ceab46a2a939f1a6`
and changed-consumer head `3c47ba1c9ba7a035c796787c0023a6515062c869` in the disposable fixture.
Its selected project list is exactly `["node:@selector-fixture/consumer"]`.
It does not claim that the synthetic cycle is an application build-order requirement.

## Verified workarounds

For Node workspace metadata,
query the incumbent package manager's reverse dependency filter:

```sh
# Repository root, metadata only
pnpm --recursive --filter '...@monochromatic-dev/module-logger' \
  --include-workspace-root list --depth -1 --json
```

This returns the measured 158-name set through the current cyclic workspace.
It is a metadata workaround,
not a complete CI selector:
it does not supply Cargo and Gradle edges,
global configuration ownership,
old-revision membership for deleted packages,
or task and artifact-consumer coverage.

A bounded explicit validation profile can also avoid depending on affected-only selection.
That is the proposed first CI increment,
not an implemented production routing change.
Do not silently treat graph failure as successful validation with no jobs.

## What does not work

Removing a real development edge merely to make the graph acyclic loses declared reverse impact,
as the override control demonstrates.
Applying the publisher's production-dependency ordering to CI has the same ownership mismatch.
Adding a repository-root Cargo workspace is not a general remedy:
it does not repair the Node cycle,
and the repository's [Cargo workspace policy](../../.out-of-scope/cargo-workspace.md)
preserves package-local build profiles.

An external clone's untrusted `mise.toml` must not be trusted merely to search source.
Read source from the already trusted repository directory with explicit absolute paths.
That bridge was used after shell activation refused the untrusted upstream configuration.

## Upstream filing decision

Nothing to add as an upstream defect report.
The observed validation is consistent with the documented acyclic graph contract.
Supporting cyclic impact queries could be a distinct feature proposal;
this investigation makes no claim that upstream cannot implement it.

- Upstream fault:
  the observed behavior is an explicit current graph restriction,
  not a demonstrated violation of documented behavior.
- Fixability:
  no algebraic impossibility is established.
  A cycle-tolerant impact API could be separated from dependency scheduling;
  that is a design proposal,
  not a verified upstream patch.
- Supported use:
  ordinary workspace affected selection is supported;
  cyclic final graphs are explicitly excluded by the current documentation.
- Contribution policy:
  the pinned `CONTRIBUTING.md` points to `docs/contributing.md`.
  Its community-participation section welcomes reviewed and verified AI-assisted responses from connected contributors
  and prohibits drive-by discussion spam.
  Non-obvious code changes require discussion before a PR.
  The issue template also routes ideas to Discussions.
  Those conditions are not an AI-assistance ban or a maintenance prohibition.
  No external message is being proposed.
- Likely movement:
  the documented restriction is evidence of current behavior,
  not proof that a future feature request would be declined.
  No matching maintainer refusal was found in the scoped searches.
- Minimal fix:
  no upstream patch is proposed or prototyped because the defect and supported-input conditions fail.
  The consumer metadata workaround and the unsafe edge-removal alternative were actually exercised.

The `.out-of-scope/` inventory contains no Mise affected-query exemption.
It does contain the distinct Cargo workspace ownership policy cited in `What does not work`.
On 2026-10-18,
GitHub issue and PR searches in `jdx/mise` for `workspace cycle` returned no results.
That result is not evidence that no related discussion exists.
No issue,
comment,
or upstream source change was published.

[mise-graph]: https://mise.jdx.dev/tasks/workspace-graph.html
