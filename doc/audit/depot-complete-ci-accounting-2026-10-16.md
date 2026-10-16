# Complete CI accounting and completion audit

## Correction and purpose

The earlier Depot trial completion claim was unsupported.
The [trial brief](../planning/depot-ci-trial.md) requires broader repository coverage,
code-quality checks,
consumer validation,
cache-boundary experiments,
and combined provider cost plus elapsed unfinished-CI time.
The representative jobs and their cost replay establish only their named subsets.
Account inspection was deliberately excluded by the user;
that exclusion does not remove execution or quality gates.

This audit defines the accounting contract for the complete execution manifest.
The [complete measurement checklist](../planning/depot-complete-ci-measurement.md)
owns the task inventory and routing.
This document does not choose a smaller representative set,
change production workflows,
or launch new cloud work.

The user clarified that checks run only for affected files or packages.
Complete CI therefore means every applicable check for the actual change,
not an unconditional repository-wide sweep on every push.
For Oxlint,
the user explicitly rejected file-scoped execution because custom rules require project context.
The diff selects affected packages and consumers;
Oxlint checks each selected package/project with its complete configured inputs.

## Evidence missing from the earlier completion claim

- No immutable revision has a reconciled result for every required build,
  code-quality,
  unit,
  browser,
  native,
  platform,
  and consumer check in the intended manifest.
  Results across independently modified trial revisions cannot be combined into one passing revision.
- The root [`lint` task](../../mise.no-env.toml) reaches package lint families,
  including Oxlint,
  TypeScript,
  Clippy,
  detekt,
  and OpenTofu where declared,
  then repository-wide dprint and monochromatic-lint.
  The earlier logger timing included build,
  types,
  and unit tests;
  it does not measure this quality-gate boundary.
- Root `buildAndTest` runs build and test phases but does not run `lint`.
  Root `test` dispatches TypeScript unit,
  browser,
  and end-to-end suites;
  it does not discover every native or Android package test.
  Unit discovery excludes expensive tests unless explicitly requested.
  Root `validate` changes files through `format` and is not an immutable-input verification substitute.
- Existing browser selection is bounded by its configured packages and engines.
  The prior storage run had a failure and a skip;
  Android's original device suite had failures.
  Neither successful setup nor a corrected subset removes those original results.
  The [coverage inventory](../planning/depot-expanded-coverage.md)
  records further native applications,
  infrastructure inspections,
  bounded fuzz/conformance,
  packaged-consumer checks,
  and platform routes without new execution evidence.
- There is no observed end-to-end timeline for the complete required-check graph,
  including queueing,
  preparation,
  artifact transfer,
  downstream consumers,
  and result delivery.
  Summing durations from unrelated jobs gives compute usage under assumptions,
  not the full pipeline's latency or critical dependency path.
- Prior cold/warm/source/dependency/toolchain experiments apply to the selected Alpine build.
  Its initial dependency and linker-change exports verified executable loading,
  not every intended consumer check.
  The sizing matrix's cold state emptied Cargo caches while permitting base-image and page-cache reuse.
  Fresh complete-pipeline cache-boundary evidence remains required.

The detailed source evidence is retained in the
[trial report](depot-trial-2026-10-15.md),
[sizing report](depot-runner-sizing-2026-10-15.md),
and [partial cost replay](depot-resumed-cost-2026-10-16.md).

## Minimum completion predicate

Freeze one source revision and the intended manifest before each execution cell.
Freeze the comparison base as well,
retain the actual changed-file list,
and record affected packages,
reverse consumers,
shared configuration/toolchain effects,
selected checks,
and explicit exclusions for unrelated packages.
The manifest contains the complete applicable graph for that change.
Positive controls must select necessary owning-package and consumer checks;
negative controls must exclude unrelated packages.
An Oxlint control must also reject narrowed changed-file arguments,
even when the changed package was selected correctly.
Every required manifest entry names its existing task,
platform and architecture,
feature configuration,
dependency checks,
consumer artifact,
selection reason,
and acceptance evidence.
Inventory omissions remain open work;
an unsupported platform is routed to its supported executor rather than silently removed.
Publication itself stays outside the disposable trial.

Reconcile manifest identities against discovered tasks and actual emitted results.
Each required check must execute against the frozen inputs and retain its exit status,
diagnostics,
discovered case identities,
unexpected skips,
and consumer evidence.
Zero cases,
cached reports from another execution,
and provider-level success with missing child results do not establish coverage.
Existing intentional ignored cases retain their explicit identity and rationale.

Report both terminal execution and accepted validation.
A real failed check can finish execution without validating the revision.
A skipped,
cancelled,
or absent required check leaves validation incomplete.
Do not allow fail-fast cancellation or ignored child errors to turn missing coverage into a shorter successful pipeline.
Negative controls must demonstrate propagation through the same task,
workflow,
and result-collection path used for the complete run.

## Collect one coherent timeline

Record the request timestamp,
immutable revision,
workflow hash,
manifest hash,
resolved tool versions,
lockfile hashes,
environment-image digest,
cache namespace and provenance,
and resource allocation.
Record artifact hashes at both producer and consumer boundaries.
Source-specific preparation belongs to that revision's dependency graph;
reusable tool/dependency preparation has its own identity and refresh accounting.

For every provider run,
retain the run record and every workflow,
job,
and attempt identity.
Retries and cancelled attempts remain in usage totals.
Fetch logs by attempt identity;
a job-level latest-attempt lookup can hide earlier failed work.
Retain provider timestamps and in-task start/end events for preparation,
download,
cache restoration,
compilation,
quality checks,
behavioral validation,
artifact upload,
and cache saving.
Use monotonic durations within one process and UTC timestamps for the cross-job timeline.
Record clock uncertainty rather than treating cross-host millisecond differences as exact causality.

The [Depot CLI reference][depot-cli]
documents status,
attempt metrics,
log export,
and artifact metadata.
The read-only collector was exercised against completed run `wf9xzbwfph`
at revision `b1d360002d08b38eeddedaec1bd8b235dc296c83`.
It retained both attempts,
their metrics,
and parseable JSONL logs,
and checked the expected revision.
This verifies collection transport;
the old run is not a complete-pipeline measurement.

## Keep usage and elapsed time separate

Compute usage is the sum of distinct provider attempt intervals,
weighted by their actual resource sizes and product rates.
A shared job containing build and test is charged once,
even when both checks reference that attempt.
Parallel jobs are charged separately.
Include failed setup,
retries,
post-task cleanup,
uploads,
and cache-save work in their observed provider intervals.
Record startup and teardown discrepancies between sandbox and job boundaries when available.
These are measured execution proxies unless reconciled with a billing ledger;
account inspection is excluded from this trial.

End-to-end time starts when the immutable revision's required validation is requested,
not when its slowest job begins.
It ends only when the final required result is available.
Queueing,
dependency waits,
artifact handoff,
and delayed dispatch remain visible.
Also report the longest dependency path through measured check execution durations.
That graph calculation explains serialization,
but excludes queueing and cannot replace the observed end-to-end interval.

For the user's elapsed-time valuation,
merge all intervals during which at least one relevant required check remains unfinished.
Overlapping jobs and revisions contribute once to that union.
The provider-attempt union is a separate diagnostic:
it omits queued work and is not the user's complete waiting interval.
A required check that never executes is censored at the observation boundary,
not assigned zero duration.
A failed executed check has a terminal failure time and cannot supply a successful completion baseline.
If a failure prevents downstream checks,
report the missing checks and the censored complete-pipeline result.

## Repeated inputs and cache boundaries

Establish unchanged-input spread for the complete manifest,
not just the dominant compiler command.
Use independent fresh consumers with the same revision,
tools,
resource size,
environment digest,
and declared cache state.
Retain each observation and its minimum,
maximum,
median,
and range before comparing a proposed alternative.
A pair of repetitions exposes observed spread but does not establish a population distribution.
Interleave alternatives where practical and retain allocation order.

The cache experiments distinguish these boundaries:

- Repository-cache cold:
  empty source build outputs,
  incremental artifacts,
  dependency download caches,
  and package stores for the declared experiment.
  Identify any retained OS image,
  installed tools,
  provider image layers,
  or host cache;
  do not describe that state as physically cold hardware.
- Warm unchanged input:
  fresh execution using declared reusable caches and the identical manifest.
  Runtime services still start in each consumer.
- Source change:
  a new immutable revision with a consumer-visible change,
  source/cache-key evidence,
  and a control proving the old artifact cannot satisfy the new assertion.
- Dependency change:
  a new lockfile revision,
  resolved dependency/version evidence,
  and complete affected-consumer results.
- Toolchain change:
  a changed resolved tool or compiler/linker configuration,
  a new environment/cache identity,
  and complete affected-consumer results.

Each changed-input cell has its own immutable revision or input fingerprint.
Its unchanged repetitions share that fingerprint.
Do not average cold and warm states,
source and dependency changes,
or failed and passing coverage into one runtime baseline.
Amortize reusable environment preparation only at an explicitly modeled refresh frequency.

## Cancellation and historical replay

Replay the complete required-check graph,
with observed offsets and dependencies,
against the selected change history.
Do not run every stage from time zero or charge consumers whose prerequisites never finished.
Preserve shared preparation and repeated attempts exactly once in the provider usage model.
State whether overlapping revisions share caches,
preparation,
or concurrency limits;
independent-workload cancellation is not a measured full-pipeline schedule.

A newer relevant revision can supersede an intermediate revision under the agreed policy.
Record when supersession occurs,
when cancellation is requested,
and when each provider attempt actually stops.
Time after the cancellation request is still consumed compute.
The newer revision remains relevant until its required checks finish;
superseding an older revision cannot erase that unresolved interval.
Daily selection also includes the delay from a relevant request to its scheduled validation.
It cannot claim lower waiting cost by starting the accounting clock at the daily run.

Measure cancellation delivery and cleanup on a disposable full graph before using them as observed parameters.
Until then,
zero-lag cancellation is a labeled optimistic scenario,
not a result.
Report selected,
completed,
failed,
cancelled,
and unstarted checks separately.
The monthly forecast must replay the actual affected-package selector,
not charge a full repository sweep for every revision.
It must include every intended trigger family and its explicit routing,
plus scheduled,
release-validation,
retry,
and agent-requested work.

## Resource and collector verification

Root package fanout uses `availableParallelism()` workers.
Each package's task fanout can launch child tasks concurrently;
root `lint` limits Oxlint and TypeScript threads to one per child.
These mechanisms are visible in [`mise.no-env.toml`](../../mise.no-env.toml).
Do not infer a process or memory bound from CPU count alone.
Record effective CPU quota/affinity,
memory limits,
peak memory,
child concurrency,
and OOM events in the complete run.

The earlier sixteen-CPU native-build result supports that allocation for its measured compilation workload.
It does not establish an optimum for full repository lint or mixed nested task fanout.
Use explicit per-job resource bounds,
retain existing task-level thread controls,
and measure the complete graph before recommending a cheaper or larger runner.

The scratch accounting harness separates raw collection from normalized manifest reconciliation.
Its positive control distinguishes 52 summed provider seconds,
30 request-to-result seconds,
29 seconds of active-provider union,
25 seconds on the execution dependency path,
and 150 vCPU-seconds.
Fixtures also verify missing and cancelled checks,
terminal failures,
retry charges,
shared-job deduplication,
and rejection of duplicate attempts,
mixed revisions,
unknown checks,
and dependency cycles.
The [retained verification evidence](depot-complete-ci-accounting-2026-10-16.evidence.json)
records these checks and the exercised collector.

[depot-cli]: https://depot.dev/docs/cli/reference/depot-ci
