# Complete applicable CI measurement

## Purpose and accepted scope

Measure the complete validation graph selected by an actual repository change.
The earlier Depot trials measured representative commands and platform execution,
not this complete graph.
Their timings remain component evidence and cannot establish complete CI cost or latency.

The user clarified that intended checks include Oxlint and other linters,
that checks must run only for affected files or packages,
and that file-scoped Oxlint is invalid for this repository's custom rules.
Account access remains explicitly outside this work.

The execution owner must retain the actual base and head commits,
the changed paths,
the selected packages and consumers,
every required check,
and every exclusion with its reason.
An unaffected package is an intentional exclusion.
A selected package whose check did not run is unfinished coverage.

This document is the canonical checklist for the measurement.
It defines the completion boundary;
it does not claim that the checks described here have passed.

## Inventory evidence and its limits

The initial discovery used `mise tasks --all --hidden --json` in the repository at
`bae6ef28a183039a6c4ba509179dc4baaedeac2e`.
It returned 2,415 tasks.
The separate worktree discovery returned 2,434 because it also inherited 19 unqualified scratch tasks
from its parent directory's `mise.toml`.
Comparing names found every original task and no added package task.
Discovery for execution must retain only tasks owned by the immutable checkout.

The initial inventory contains:

- 189 package `lint` aggregators,
  164 `lint:oxlint` tasks,
  and 172 `lint:types` tasks.
- 19 `lint:clippy`,
  2 `lint:detekt`,
  3 `lint:slint`,
  2 `lint:rustfmt`,
  and one `lint:tofu` task.
- 152 package `build` aggregators,
  129 `test:unit` tasks,
  and 26 package `test` aggregators.
- 14 `fuzz`,
  13 `fuzz:coverage`,
  12 `test:mutation`,
  and 2 `test:conformance` tasks,
  plus specialized host,
  integration,
  browser,
  device,
  and container tasks.

These counts describe the discovery universe,
not the number of checks to run for every change.
Each historical case needs its own task catalog from its own head commit.
Task presence also does not establish independent coverage:
an aggregator can repeat its children,
an example task can require a human interaction,
and a successful no-op is not a validation result.

## Existing ownership and selector audit

The existing root owner is `mise.no-env.toml`;
`mise.toml` is generated through file-enforcer.
Its `fanout_packages` enumerates task suffixes across active package task roots.
It does not compute an affected-package graph.
Its `fanout` enumerates immediate child tasks,
which is different from selecting consumers of changed source.

The existing logger and TOML workflows contain path selectors:
`.github/workflows/logger-fuzz.yml` and `.github/workflows/toml-edit-fuzz.yml`.
Their selectors describe their own suites,
not all repository consumers.
`package/dev-script/task-util/src/depends.ts` owns source/output freshness checks,
not Git-diff consumer selection.

The retained historical analysis in
[the change-stream audit](../audit/depot-change-stream-2026-10-15.md)
already computes reverse consumers from dependency,
development dependency,
peer dependency,
and optional dependency declarations.
Its explicitly documented limitations include using a current manifest snapshot
and missing undeclared imports and historical renames.
Reuse that algorithm's ownership model,
but read manifests at the actual measured head and retain the graph evidence.
The publishing order in `package/config/pnpr/src/publish-missing-versions.ts`
deliberately excludes development dependencies because its boundary is installation order.
That narrower publishing graph is not a CI impact graph.

## Change selection and dependency closure

- [ ] Resolve and retain immutable base and head commit IDs.
  Enumerate changed paths with a NUL-delimited Git diff that retains deletions.
  Treat a rename as both removed and added ownership when establishing affected packages.
- [ ] Read package owners,
  manifests,
  task definitions,
  and configuration from the case head.
  Use the base graph as well when an owner or dependency was removed.
- [ ] Select changed package owners and their transitive consumers.
  Include runtime,
  development,
  peer,
  optional,
  Cargo path,
  and explicit build/configuration dependencies.
  Preserve a dependency path explaining each indirectly selected package.
- [ ] Audit source imports and configuration ownership that manifests do not express.
  A root tool configuration consuming a changed package is a dependency edge,
  not an excuse to omit its consumers.
  Record a broader affected ecosystem only when that shared input actually affects it.
- [ ] Select package/project checks for semantic tools.
  Use changed-file lists only for checks whose behavior is valid at file scope.
  Do not pass changed-file arguments to Oxlint.
- [ ] Deduplicate equivalent checks and shared prerequisite builds,
  while retaining every platform,
  feature,
  browser,
  and consumer boundary that supplies distinct evidence.
- [ ] Record unaffected packages and account-dependent operations as explicit exclusions.
  Do not interpret missing prerequisites,
  a failed selector,
  or an empty discovery result as an unaffected package.

### Oxlint project boundary

Run each selected package's `lint:oxlint` task unchanged,
with no file arguments.
Include relevant consumer packages when a dependency's semantic behavior changes.

`package/oxlint-plugin/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types/semantic-bridge-cache.ts`
requires the nearest configured project and explains why substituting the root project can omit callers.
`effect-summary-index.ts` describes backwards caller traversal,
and `effect-fixed-point-propagation.ts` propagates callee and callback effects.
These sources substantiate the user's project-context constraint.
A root sweep is not evidence that every selected package used its own complete project.

`package/config/oxlint/src/index.ts` loads the shared custom plugins.
Changes to those plugins or their shared configuration select the projects using them.
Root-level TypeScript/configuration inputs also require their own applicable validation.
There is no root `lint:types` task in the initial task catalog;
an implementation must retain this gap rather than invent an invocation that does not exist.

## Required validation families

For each selected package,
expand the task graph into concrete required leaves and compare it with the package's source and tests.
Keep specialized tasks whose behavior is not reached by the ordinary aggregator.
Keep family-specific selection reasons so build-only changes do not automatically run unrelated device interaction.

### Static checks

- [ ] Run full package `lint:oxlint` and `lint:types` tasks where declared.
  Include additional configuration type checks such as file-enforcer's `lint:config:types`
  when their configuration inputs are affected.
- [ ] Run declared Rust `lint:clippy`,
  formatting checks,
  Slint checks,
  Kotlin detekt,
  Android lint,
  and OpenTofu validation on the selected owners.
  An ordinary Rust `lint` task often runs only `cargo check`.
  Kotlin's ordinary `lint` compiles Kotlin and tests;
  its detekt task is separate.
- [ ] Run root `lint:dprint` and `lint:monochromatic-lint` on affected eligible files
  through a verified file-selection adapter.
  Configuration changes select the files governed by that configuration.
  Respect each tool's configured exclusions and retain those exclusions in the evidence.
- [ ] Run the forbidden-strings gate against the actual change,
  using the effective deny-list and retained workflow semantics.
  A changed deny-list requires checking the files governed by that list.

Root `lint` is not the execution manifest:
it first dispatches package aggregators and then repository-wide checks.
Dispatch independent gates independently so an earlier failure cannot hide their results.
Direct package Oxlint/type invocations must retain the root concurrency controls where applicable:
`OXLINT_THREADS=1` and `TSC_SINGLE_THREADED=1`.
Their implementation is in the task-util wrappers.

`dprint.json` extends `package/config/dprint/index.json`.
That configuration disables its TypeScript and Markdown plugins;
Oxlint and monochromatic-lint supply those separate responsibilities.
`monochromatic-lint.config.jsonc` excludes paused and deprecated package trees
and contains documented warning/exemption policy.
Preserve that policy;
do not silently strengthen or weaken it for measurement.

### Builds and artifact consumers

- [ ] Build every required artifact for the selected source and consumer checks.
  Record the task,
  platform,
  feature set,
  input hash,
  and artifact hash.
- [ ] Include native and Android ABI builds when the changed dependency reaches those applications.
  Android's `build:native` produces both `arm64-v8a` and `x86_64` libraries;
  its Gradle build depends on that task.
- [ ] Run tests against the artifact the consumer uses,
  including external-consumer or extension-host tasks where those boundaries are affected.
  An existing bundle from another revision cannot satisfy this requirement.
- [ ] Record root/shared prerequisite builds separately from consumer execution.
  Reuse them only when their complete inputs match.

### Unit, property, conformance, and mutation checks

- [ ] Enumerate the selected packages' real unit-test files,
  including separately declared native and integration suites.
  Compare expected files/cases with executed files/cases.
- [ ] Classify expensive tests individually.
  Root `test:unit --all` includes account provisioning in the mvm package,
  so it is not an authorized blanket invocation here.
  Retain non-account expensive checks when their source is affected.
- [ ] Run bounded fuzz and coverage gates already attached to the selected families.
  The logger and TOML workflows use `fuzz --budget 3000`
  and `fuzz:coverage` without `--write`.
  Preserve the required scope and conformance checks of the selected sidecar.
- [ ] Classify each declared mutation task in the workload manifest.
  If it is part of the intended gate,
  include its bounded policy and report;
  if it is a separate maintenance campaign,
  record that exclusion rather than pretending its task does not exist.
- [ ] Retain Rust feature matrices and native test execution.
  Do not substitute compilation for nextest results.
  Existing tasks that use a different Rust test command remain visible as task-policy gaps.

The root `test` task dispatches unit,
browser,
and end-to-end families.
It does not dispatch every native package `test` task.
The shared unit runner returns successfully for an empty file list,
so exit zero alone is not proof of coverage.

### Browsers, desktop, mobile, and platform hosts

- [ ] Select browser test files belonging to affected packages and consumers,
  preserving complete suites within those selected owners.
  `playwright.browser.config.ts` defines Chromium,
  Firefox,
  and WebKit projects with explicit package patterns.
  `playwright.e2e.config.ts` defines Chromium and Firefox.
  Compare tracked browser/e2e files with those configuration patterns.
- [ ] Run affected desktop integration through its declared compositor/container/host boundary.
  Preserve relevant Alpine architectures and Windows targets from the existing workflows.
- [ ] Run affected Android lint,
  JVM unit tests,
  native ABI checks,
  APK builds,
  and instrumented/device consumers when selected by the change.
  Device prerequisites remain requirements until exercised;
  missing hardware is not a passing check.
- [ ] Preserve host-specific filesystem identity and semantic bridge checks when affected.
  `.github/workflows/fs-id.yml` and `.github/workflows/readonly-semantic-bridge.yml`
  establish distinct host boundaries not replaced by a Linux unit suite.
- [ ] Retain all retries,
  skipped cases,
  expected failures,
  and their reasons.
  Configured Playwright retries are part of execution and cost.

### Repository consistency and security

- [ ] Validate affected generated files against their owners using a disposable checkout.
  `package/dev-script/file-enforcer/src/cli.ts` imports and executes its config;
  it has a watch option but no implemented read-only check option.
  Regenerate in the disposable fixture and compare its resulting tracked changes.
- [ ] Include affected CodeQL language/workflow scans and their existing selection policy.
  Distinguish source analysis from publication of its report.
- [ ] Preserve Scorecard's existing schedule/rate policy as a separate repository-security workload.
  Do not multiply it into every package change or erase its cost from a complete provider accounting period.
- [ ] Exclude publishing,
  deployment,
  account login,
  secret editing,
  production provisioning,
  watch servers,
  automatic upgrades,
  and source-formatting mutations from validation gates.

Root `validate` formats,
builds,
and tests;
it omits lint and mutates source.
It therefore cannot stand in for this checklist.

## Actual change cases

Execute the complete applicable graph for each selected positive case.
The smaller case establishes pipeline plumbing;
it does not replace broader consumer or native cases.

- TOML source change:
  base `cf9fcb48047d86e0af01ac9c73c1c7bf26fb277f`,
  head `525d2e09f8168a3bdd7e513e26d4c80b363123e5`.
  The actual diff changes `package/module/toml-edit/src/value-encoders.ts`.
- Logger source and tests:
  base `20dbaca6c2bb39d5d7e51fac447d76393c21a32e`,
  head `ef01490f5e960f8ca0b424c12242caeb3c5a2b5e`.
  This case exercises the logger's real consumer closure.
- Shared native audio core:
  base `45795584ff2dcf830dc505e121f0cc92c77860e5`,
  head `cb95cf6d785c3073c192b95f0632cdae7b910894`.
  Its Cargo path consumers include desktop,
  Android,
  and the benchmark sidecar.
- Documentation selection control:
  head `bae6ef28a183039a6c4ba509179dc4baaedeac2e` versus its first parent.
  Assert that its documentation-only diff does not select Oxlint or unrelated application checks.

Also verify selection for a real shared-configuration change.
That selection control does not require running unrelated global work merely to manufacture a whole-repository scenario.

## Evidence and completion predicate

Every case manifest records `baseRevision`,
`headRevision`,
`sourceRevision`,
`changedFiles`,
`selectedPackages`,
`selectionReasons`,
`excludedChecks`,
and ordered `checks`.
Each check records its ID,
task,
arguments,
family,
scope,
package owners,
and prerequisite check IDs.
Oxlint checks require package or project scope and empty file arguments.

- [ ] Prove the selector with a positive affected-package case,
  an affected consumer,
  and an unrelated negative package.
  Preserve the actual outputs and the expected membership.
- [ ] Collect each required check's command,
  exit status,
  platform,
  expected and observed test counts,
  skip/retry details,
  artifacts,
  logs,
  and provider run/job/attempt identity.
- [ ] Include environment preparation,
  cache restore/save,
  cancelled attempts,
  failures,
  retries,
  and final verification in cost accounting.
  Separate additive resource consumption from elapsed wall-clock unions.
- [ ] Require every selected gate to reach its accepted terminal result on the immutable source.
  A started,
  skipped,
  failed,
  cancelled,
  or unobserved required gate does not establish completed CI.
- [ ] Report unexercised validation families and unresolved selector edges explicitly.
  No weighted monthly projection can turn missing execution into measured coverage.

The next action is to finish the per-case dependency/task manifests,
verify their positive and negative selection evidence,
then execute all selected checks and reconcile their provider intervals.
