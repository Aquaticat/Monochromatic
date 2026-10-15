# Depot trial results, October 15, 2026

## Status and decision being tested

Execution is in progress.
This report follows the [confirmed trial brief](../planning/depot-ci-trial.md).
The user prefers the USD $20 Developer plan if intentional GitHub routing keeps it useful and convenient.
USD $200 is the monthly ceiling,
not a target spend.
The current Startup trial remains available for evaluating options.
No subscription change or production migration has been made.

The current evidence favors testing Developer with selective routing before paying for Startup.
This is a provisional allocation recommendation,
not a complete technology-adoption verdict.
The container build,
Depot CI,
and standalone sandbox routes have executed real work.
The Depot GitHub runner build needs its retry result before a runner comparison can be concluded.

## Compilation and cache behavior

These are observed executions,
not vendor benchmark claims.
The disposable branch is `trial/depot-20261015`,
based on application revision `46effff65ab4193b4311d7675e301c97007176d1`.
Its trial files live under `package/music-player/desktop-app/depot-trial/`.
The same Alpine toolchain and runtime stages feed the GitHub and Depot builds.
Cargo uses four build jobs in each.
Depot's default builder has 16 CPUs and 32 GB RAM;
this is not a comparison of identical hardware.

- Depot container build `ws40v1c9xt` finished in 468 seconds,
  including export to the local machine.
  Cargo reported 7 minutes 13 seconds.
  Unchanged Cargo-input builds `t66qp9xk3l` and `5cfbvsmxz9` finished in 21 and 22 seconds.
  The first warm Cargo invocation itself took 0.31 seconds.
  [Depot build](https://depot.dev/orgs/l4zncjjbj5/projects/72lp3rlfvw/builds/ws40v1c9xt)
- GitHub's reference cold build took 869.508 seconds,
  with Cargo reporting 14 minutes 14 seconds.
  Same-job warm repeats took 1.975 and 1.716 seconds.
  Their artifacts stayed on the runner;
  these export times are not comparable to downloading the Depot artifact locally.
  [GitHub reference run](https://github.com/Aquaticats/Monochromatic/actions/runs/38813764705/attempts/1)
- Source-change build `jbld9m545r` took 226 seconds overall,
  with Cargo reporting 3 minutes 17 seconds.
  The exported executable displayed the deliberately changed CLI name.
  The marker was then restored in commit `d5ab91d795`.
  [Source-change build](https://depot.dev/orgs/l4zncjjbj5/projects/72lp3rlfvw/builds/jbld9m545r)
- Failure-control build `wk649mjc2s` returned nonzero when the post-verification stage required failure.
  This verifies propagation of a failed build step.
  It does not prove that every application defect is tested.
  [Failure control](https://depot.dev/orgs/l4zncjjbj5/projects/72lp3rlfvw/builds/wk649mjc2s)

Each successful export ran `music-player --version` inside the production Alpine runtime stage.
That proves basic executable loading,
not graphical interaction or audio correctness.
The warm repetitions establish observed spread of one second for the Depot local-export route
and 0.258 seconds for the GitHub same-job route.
There is only one cold sample per completed route;
the cold difference is promising but does not establish repeatability.

Dependency and linker invalidation probes are still being collected.
The linker probe changes the build toolchain;
it is not a controlled `lld` versus `mold` benchmark.

## Existing checks newly exercised through Depot CI

Run `wjr4cmpjvs` passed the logger's build,
type check,
and unit suite,
plus all 80 audio-core tests with every feature enabled.
The run took 152 seconds from creation to completion.
Audio's job interval was 136.452 seconds on four CPUs;
logger's was 45.918 seconds on two CPUs.
These include setup and compilation rather than test execution alone.
[Coverage run](https://depot.dev/orgs/l4zncjjbj5/workflows/wjr4cmpjvs)

Android run `3tvq2wvskh` passed JVM tests and Android lint in 218 seconds overall.
The follow-up inspected 127 XML suites containing 1,289 test cases.
Their timestamps identify the original execution;
the repeated Gradle task restored those results from cache.
The repeat's Android job took 100.149 seconds on four CPUs.
No instrumented device coverage is claimed.
[Original Android run](https://depot.dev/orgs/l4zncjjbj5/workflows/3tvq2wvskh),
[counted repeat](https://depot.dev/orgs/l4zncjjbj5/workflows/jp9w8gw62r)

The cloud prerequisite probe found KVM but no display session,
GPU device,
running systemd user manager,
PipeWire tools,
or Weston executable.
The desktop suite's documented prerequisites include a graphical session,
user services,
and isolated audio routing.
The Android emulator workflow also requires a headed host-GPU launch under the repository's emulator skill.
Neither graphical suite has run in this trial.
This is a gap in the tested environment,
not proof that Depot cannot host a suitable environment.
[Prerequisite run](https://depot.dev/orgs/l4zncjjbj5/workflows/jp9w8gw62r),
[desktop suite requirements](../../package/music-player/desktop-e2e/README.md)

## Prepared environments and non-CI work

A Node/dependency snapshot was created and reused successfully.
The first consumer spent 252.433 seconds in an extra mise cache lookup.
Disabling that redundant action cache preserved passing checks in the subsequent run.
The snapshot preparation job then reused its existing tag without another sandbox execution.
The [workaround record](../troubleshooting/depot-snapshot-mise-cache.md)
separates this observed wait from unverified service-side causes.
[Prepared-image validation](https://depot.dev/orgs/l4zncjjbj5/workflows/jp9w8gw62r)

The standalone SDK also created,
executed a command in,
and stopped a sandbox using the existing login.
The successful sequence took 4.396 seconds.
Two further standalone sandboxes ran commands with 9.882 seconds of overlap,
then both stopped.
This verifies a non-CI execution route and concurrency of two;
it does not measure saturation or validate unlimited capacity.
Bare command lookup failed in the first probe;
an absolute executable path worked.
See the [probe and workaround record](../troubleshooting/depot-sandbox-command-path.md)
and [official SDK reference](https://depot.dev/docs/api/sandbox-sdk-reference).

For future linker experiments,
use identical object files,
fixed CPU and memory allocations,
and repeated measurements before comparing linkers.
Measure individual latency separately from aggregate parallel throughput.
Container builds in the same project and architecture share a builder by default;
launching competing benchmarks there would introduce contention.
[Depot build parallelism](https://depot.dev/docs/container-builds/build-parallelism)

## Rolling analysis budgets

The current Scorecard policy is two analyses per minute,
four per hour,
and eight per day.
Fixture replay executed the existing workflow script with fixed time and disposable GitHub responses.
Allowed,
rejected,
expiry,
failed,
cancelled,
skipped,
and pending-analysis cases matched its current implementation.
A fixture of 926 skipped runs caused 926 sequential job-history queries.
The fixture demonstrates query amplification;
it does not measure GitHub API latency.
[Current gate](../../.github/workflows/scorecard.yml)

Two concurrent fixture evaluations both admitted when prior analysis jobs were not visible.
The gate creates no reservation in that modeled interval.
This is not evidence that a live budget violation occurred.
Moving the gate unchanged would preserve its history-query cost and make its GitHub accounting inappropriate for Depot runs.
A rolling-budget admission mechanism remains separate from unlimited execution concurrency.
No native Depot rolling-window configuration was verified,
and no production controller was deployed.

## Monthly plan scenarios

Prices are published provider rates checked on October 15,
not an account invoice.
Developer includes 500 container minutes,
2,000 CI minutes,
2,000 GitHub runner minutes,
and 25 GB combined cache and registry storage for USD $20.
Startup includes ten times those compute and storage allowances for USD $200.
Both include one million passing test results and unlimited concurrency.
[Depot pricing](https://depot.dev/pricing)

CI allowances use two-CPU minutes;
a four-CPU minute consumes two included minutes.
Overage is USD $0.006 per base CI minute.
The measured audio,
logger,
and cached Android job intervals total 8.652 base CI minutes per combined bundle.
That bundle combines separate observations,
not a measured recurring workload.
[CI billing rules](https://depot.dev/docs/ci/overview)

The following scenarios assume 30 days,
25 GB storage,
one 226-second source-change container build per bundle,
and the 8.652-minute CI bundle.
They exclude runner-product usage,
standalone experiments,
additional platforms,
test-result overage,
taxes,
and storage overage.

- Five bundles per day:
  Developer USD $22.60;
  Startup USD $200.
- Ten bundles per day:
  Developer USD $48.77;
  Startup USD $200.
- Twenty-one bundles per day:
  Developer USD $115.62;
  Startup USD $200.
- Thirty-three bundles per day:
  Developer USD $188.55;
  Startup USD $200.

The 21 and 33 cases have a concrete scale reference:
the October 15 Windows workflow history contained 21 push runs and 12 manual runs.
That single day is not a monthly forecast,
and those Windows runs are not the proposed Linux CI bundle.
Cold-cache behavior materially changes the model:
using the observed 468-second cold build at 21 bundles per day gives Developer USD $217.26,
which exceeds the user's ceiling,
versus Startup USD $200 before excluded costs.
[Workflow history](https://github.com/Aquaticats/Monochromatic/actions/workflows/music-player-windows.yml)

The Developer container allowance fits 132 builds at the observed 226-second duration.
Its CI allowance fits 231 of the modeled bundles.
Those are separate allowances;
unused runner minutes cannot be assumed transferable.
Staying near USD $20 therefore requires routing work to GitHub or requesting fewer cloud runs,
not merely selecting the cheaper subscription.

The Bank of Canada's October 15 rate is CAD $1.4196 per USD $1.
The user's CAD $8.975/hour time value becomes approximately USD $6.3222/hour.
An extra USD $180 would require about 28.47 hours of saved valued elapsed time per month
if time savings were its only benefit.
The calculation does not assume Startup has faster default hardware than Developer.
[Bank of Canada observation](https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?start_date=2026-10-15&end_date=2026-10-15),
[time-value requirement](../handover/depot-trial-grilling.md)

## Remaining evidence before a final allocation recommendation

- Finish dependency and toolchain invalidation verification.
- Inspect the Depot runner retry and preserve the initial failure in reliability evidence.
- Demonstrate a failing real test through the CI path.
- Distinguish graphical coverage gaps from runnable headless checks.
- Inspect storage occupancy and account spending controls where available;
  configured cache retention is not an aggregate billing cap.
- Include a reproducible evidence summary and finish scoped lint and rendered Markdown checks.

Production routing,
paid plan changes,
and new recurring automation remain outside this trial's adoption boundary.
