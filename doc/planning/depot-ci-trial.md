# Depot CI trial proposal

## Purpose and status

Proposed on 2026-10-15 after the [trial interview](../handover/depot-trial-grilling.md).
The user wants more comprehensive CI with less repeated setup,
rebuilding,
and scheduling overhead.
They delegated the technical recommendation and set a USD $200 monthly provider-spending ceiling.
The interview remains open.
The user wants intentional routing between GitHub and Depot based on measured benefit and budget,
not a complete migration or a fallback used only after exhausting Depot allowances.
They accept deeper Depot dependence when evidence justifies it;
portability is not a hard requirement.
This document defines evidence to collect;
it does not recommend vendor adoption or authorize migration.

## What success means

Compare provider charges plus the user's value of elapsed time while relevant CI is unfinished.
The user chose half [Ontario's general minimum wage][ontario-wage]:
CAD $8.975 per hour at the October 1,
2026 rate.
Overlapping jobs count once,
even when other useful work continues.
One dated exchange rate will put provider charges and time value in the same currency.

Comparisons use equivalent checks and the same stream of changes.
Missing tests,
failed setup,
and skipped required checks cannot count as performance improvements.
Early commits,
including broken intermediate states,
remain part of the development workflow.
Agent-requested cloud checks are part of the desired workflow.
The user accepts stopping superseded intermediate checks to prioritize the newest version.
Existing explicit-release handling stays unchanged during the proposed trial.

## Technical coverage target

The proposed coverage target follows changed components and their consumers across supported platforms.
It distinguishes whether code builds,
whether behavior works,
and whether packaged releases actually run.
The coverage inventory also records important behavior for which tests do not exist yet.

Existing checks provide concrete starting points:

- [Android tasks](../../package/music-player/android-app/mise.toml):
  unit tests,
  device tests,
  Android lint,
  Kotlin checks,
  and native Rust checks.
- [Desktop interaction tests](../../package/music-player/desktop-e2e/README.md):
  real keyboard input and observable application behavior.
- [Shared audio-core tasks](../../package/music-player/truepeak-core/mise.toml):
  the core's own tests,
  in addition to tests of applications consuming it.
- [Repository task families](../../mise.toml):
  build,
  code-quality checks,
  unit tests,
  browser tests,
  and end-to-end tests.

The initial evaluation includes music-player components and representative repository checks.
The coverage target spans the repository;
the first workloads are not a limit on that target.
Check frequency remains an engineering recommendation to make from runtime,
failure-detection,
and cost evidence.

## Independently verifiable trial areas

### Reduce repeated setup and compilation

Compare the Alpine x64 release compilation on the same source revision and with equivalent output checks.
The observed GitHub run spent 18 minutes 46 seconds compiling and 28 seconds creating container images.
This makes compilation and dependency reuse a separate measurement from tool installation reuse.

Measure unchanged repetitions before comparing providers,
so ordinary runtime variation is visible.
Then exercise cold state,
warm state,
a source change,
a dependency change,
and a toolchain change.
Record setup,
downloads,
cache restoration,
compilation,
validation,
upload,
and cache-save time separately.
Successful output must pass the existing consumer checks after every relevant change.

### Reduce scheduling overhead

Use the existing [Scorecard budgets](../../.github/workflows/scorecard.yml):
2 analyses per minute,
4 per hour,
and 8 per day.
The present policy skips rejected runs rather than scheduling them for later.
Its counting step was still running more than three minutes after setup in an observed run.

Measure the decision separately from the analysis.
Replay allowed,
rejected,
and overlapping requests against disposable history before any live integration.
Check the selected behavior when a time window expires and when a run is cancelled or fails.
Depot's documented concurrency waiting does not establish support for these rolling budgets.
A native capability or an existing compatible mechanism needs evidence before proposing custom scheduling code.

### Add currently unwired checks

Run existing Android,
desktop-interaction,
and audio-core checks through an isolated CI path.
The resulting inventory links each task to triggers,
required platforms,
outputs,
and a completion result.
A deliberately failing fixture must produce a visible failure,
so a successful empty run cannot masquerade as coverage.
Prefer reusing task definitions locally and through agent-requested cloud execution;
provider-specific checks remain acceptable when measured benefits justify them.

### Preserve release and platform behavior

The trial produces disposable validation artifacts without publishing releases or importing release credentials.
Existing Windows and macOS paths remain the reference while Linux execution is evaluated.
[Depot CI][depot-ci] does not offer Windows or macOS sandboxes.
The separate [Depot GitHub runner product][depot-runners] requires an organization-owned repository;
this repository is personally owned.
Cross-platform migration therefore needs its own design and validation before replacing existing jobs.

### Measure the complete monthly cost

Replay a representative change history and record elapsed CI intervals,
machine sizes,
storage,
and billable usage.
The broader coverage target also needs measured costs for checks currently absent from GitHub workflows.
Historical provider minutes alone cannot estimate that future workload.
Compare hybrid allocations of workloads between GitHub and Depot,
including the effect of stopping superseded intermediate checks.
Account for each product's separate allowances and the costs of broader coverage.

[Depot Startup pricing][depot-pricing] has a USD $200 base plus additional usage charges.
Included usage is 250 GB combined cache/registry storage,
20,000 CI minutes,
20,000 GitHub runner minutes,
5,000 container build minutes,
and 1,000,000 passing test results.
Larger CI machines consume the allowance faster.

Before resource-consuming execution,
account plan,
trial allowance,
current usage,
and applicable cap semantics
must be inspectable so the proposed run budget can fit the user's ceiling.
Published per-product limits do not yet prove an aggregate billing cap.
The current browser connection could not inspect account settings;
CLI authentication itself is verified.
The documented usage endpoint rejected the available user token because it requires an organization token.
No token was created;
the user subsequently reported the USD $200/month plan,
a seven-day trial,
and no usage so far.
Exact trial expiry and configured spending controls remain unverified.

## Result and adoption boundary

The trial report will distinguish measured savings,
newly exercised checks,
remaining gaps,
and unverified claims.
It will recommend check frequency and an execution arrangement using the user's combined cost objective.
Unchanged-input variation and coverage parity must support any claimed improvement.
Adoption,
repository ownership changes,
purchases,
and production workflow changes require a separate action request.

[ontario-wage]: https://www.ontario.ca/document/your-guide-employment-standards-act-0/minimum-wage
[depot-ci]: https://depot.dev/docs/ci/overview
[depot-runners]: https://depot.dev/docs/github-actions/overview
[depot-pricing]: https://depot.dev/pricing
