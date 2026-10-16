# Expanded Depot workload costs and account limits

## Decision supported by the evidence

The measured part of the proposed expanded workload costs approximately **USD 77.35 per month on Developer**
if every affected revision runs on Depot,
or **USD 73.06** if a newer affected revision cancels its unfinished predecessor.
Startup costs **USD 200** for either measured scenario before excluded charges.
These are subtotals for five workloads,
not a forecast of the complete system.
Full desktop interaction,
browser suites,
other packages,
platform releases,
and recurring agent experiments are not priced.
[Replay calculations](depot-expanded-cost-2026-10-15.evidence.json)

The objective is broader coverage and useful cloud execution,
not just faster copies of today's GitHub jobs.
Developer with deliberate GitHub allocation is the first arrangement to evaluate,
conditional on completing the missing measurements and verifying spending controls.
The current evidence does not justify a paid plan change or production adoption.
The user accepts deeper Depot dependence when measured benefits justify it,
prefers the USD 20 plan when convenient,
and sets USD 200 as a ceiling rather than a spending target.
[Confirmed trial brief](../planning/depot-ci-trial.md),
[expanded coverage proposal](../planning/depot-expanded-coverage.md)

## What the replay measures

The input is the seven complete UTC days from October 8 through October 14,
2026:
1,143 observed main-push workflow arrivals representing 1,133 distinct heads.
The repository's unfiltered `forbidden-strings` push workflow supplies the event stream.
Daily pagination and an unchanged-head control establish completeness relative to the runs GitHub returned.
Deleted or never-created runs remain outside that evidence.
This is historical change demand applied to proposed coverage,
not a record of those proposed checks actually executing that week.
[Change-stream method and evidence](depot-change-stream-2026-10-15.md)

The selector includes shared-input and consumer effects.
For example,
logger has no direct edits in the sample,
but shared inputs select its representative suite 50 times.
Other-package changes select 523 events;
they are not charged as 523 identical logger jobs.
Browser selection produces 50 candidate events whose runtime remains unmeasured.
[Selection rules and event reasons](depot-change-stream-2026-10-15.evidence.json)

The priced workloads are:

- Audio core:
  68 selected arrivals,
  using the observed 136.452-second four-CPU CI job.
- Representative logger build,
  type check,
  and unit tests:
  50 arrivals at 45.918 seconds on two CPUs.
- Android host checks:
  54 arrivals at the 100.149-second four-CPU cached repeat.
  That repeat restored existing Gradle results;
  it is not an unchanged-input timing distribution for fresh executions.
- Android application and instrumented-test APK build:
  54 arrivals at the **231-second full job interval** on a sixteen-CPU Depot GitHub runner.
  The replay does not substitute an inner build-step duration for the billed job interval.
  Building the APKs does not include device execution.
- Desktop container compilation:
  59 arrivals at the 266.987-second mean of two cold observations on the default builder,
  using sixteen Cargo jobs.
  Client elapsed time includes artifact download and is a billing proxy,
  not a provider-reported billed duration.

[Replay inputs](depot-expanded-cost-2026-10-15.evidence.json),
[host-suite observations](depot-trial-2026-10-15.md#existing-checks-newly-exercised-through-depot-ci),
[APK run](https://github.com/Aquaticats/Monochromatic/actions/runs/38826684750),
[container repetitions](depot-container-concurrency-2026-10-15.evidence.json)

The simulator repeats that week's event mix over 30 days.
It assumes immediate starts and cancellation,
with no cancellation delay,
retry overhead,
or environment-refresh cost.
Only the container input has repeated cold samples.
The calculation therefore provides scenarios,
not a statistical forecast or a full cold/warm/dependency/toolchain mix.
Its positive control consumes 120 seconds without cancellation and 70 with cancellation;
the exact-completion-boundary control preserves both completed jobs.
[Assumptions and controls](depot-expanded-cost-2026-10-15.evidence.json)

## Monthly compute subtotals

Developer's USD 20 subscription includes 500 container minutes,
2,000 base CI minutes,
2,000 base GitHub runner minutes,
and 25 GB combined storage.
Startup costs USD 200 with ten times those allowances.
Both include one million passing test results.
[Published plans](https://depot.dev/pricing)

CI and Linux runner minutes are normalized for machine size.
Four CPUs consume twice the two-CPU allowance;
the sixteen-CPU APK runner consumes eight times the base allowance.
Extra CI or base Linux runner usage costs USD 0.006 per normalized minute.
The default sixteen-CPU container builder costs USD 0.04 per additional container minute.
Unused minutes in one product are not treated as credit for another.
[CI billing](https://depot.dev/docs/ci/overview#pricing),
[runner sizes](https://depot.dev/docs/github-actions/runner-types),
[container billing](https://depot.dev/docs/container-builds/overview#pricing)

- Every affected revision on Depot:
  2,262.105 base CI minutes,
  7,128 base runner minutes,
  and 1,125.160 container minutes per modeled month.
  Developer is USD 77.347;
  Startup is USD 200.
- Cancel unfinished superseded work within its own workload group:
  2,215.218 base CI minutes,
  6,877.143 base runner minutes,
  and 1,062.666 container minutes.
  Developer is USD 73.061;
  Startup is USD 200.
  This models newest-intermediate priority,
  not cancellation of an explicitly requested release.
- Allocate only the newest affected revision of each UTC day to Depot:
  256.280 base CI minutes,
  924 base runner minutes,
  and 133.494 container minutes.
  Developer is USD 20;
  Startup is USD 200.
  Affected-push validation still needs GitHub placement;
  release and agent-requested runs are additional demand.

[Complete scenario rows](depot-expanded-cost-2026-10-15.evidence.json)

For the first scenario,
the Developer calculation is USD 20 base,
USD 1.573 CI overage,
USD 30.768 runner overage,
and USD 25.006 container overage.
Cancelling superseded jobs saves USD 4.286 in this replay.
That saving does not establish cancellation as the dominant budget control;
allocation frequency changes the measured subtotal more.
[Calculation inputs](depot-expanded-cost-2026-10-15.evidence.json)

## Account snapshot and stopping behavior

The user supplied the current Startup account view during the October 15 local trial.
It reports USD 200 and trial expiry in seven days,
without an exact expiry timestamp.
The reported product usage and selected limits are:

- Container builds:
  36 minutes used against 5,000.
- Depot GitHub runners:
  3,804 minutes used against 20,000.
- Depot CI:
  29 minutes used against 20,000.
- Billed cache view:
  2 GB against a 250 GB allowance.

These are user-supplied account observations,
not an independently queried invoice or current remaining balance.
Further trial work can change them.
The account's projected next-bill usage includes the runner-sizing experiment
and is not the proposed steady workload.
[Account record](depot-trial-2026-10-15.md#account-evidence-supplied-by-the-user)

The selected hard-limit behavior says new builds or workflows fail to start at the limit.
This establishes three separate product-minute admission controls in the supplied account view.
It does not establish that running work stops immediately,
that the settings follow a plan change,
or that storage,
registry transfer,
test results,
and every sandbox product share an aggregate USD 200 cap.
Those boundaries still need verification before production allocation relies on them.
[Account record](depot-trial-2026-10-15.md#account-evidence-supplied-by-the-user)

The direct usage API probe remains a separate limitation:
the stored user token could list organizations,
but `UsageService/GetUsage` explicitly required an organization token.
No new credential or billing setting was created to bypass that boundary.
[Verified authentication response](../troubleshooting/depot-usage-api-authentication.md)

## Why the storage numbers differ

Depot measures billable cache storage using hourly snapshots averaged over the month.
The shared allowance includes Docker build cache,
Depot Cache,
and registry storage.
Consequently,
the reported 25.1 GB instantaneous Intel-project view,
1 GB build-history average,
and 2 GB billing view need not be equal.
Their different scopes and averaging can explain a difference,
but no hourly export was obtained to reconcile these exact observations.
[Cache accounting](https://depot.dev/docs/cache/overview#pricing),
[shared registry allowance](https://depot.dev/docs/registry/overview#pricing),
[account observations](depot-trial-2026-10-15.md#account-evidence-supplied-by-the-user)

Organization cache retention does not apply to Docker layer entries.
Docker retention is configured per project;
the detailed container documentation states a 50 GB default and a policy setting up to 1,000 GB,
with least-recently-used removal when a build encounters a full cache.
The same page's feature summary instead says expandable to 500 GB.
That documented maximum is inconsistent and was not resolved by changing this account.
The page also says retained parent layers can make usage exceed the configured size.
A retention setting is therefore not evidence of a hard spending ceiling.
[Organization retention](https://depot.dev/docs/cache/overview#cache-retention-policy),
[project policy and retained layers](https://depot.dev/docs/container-builds/overview#configurable-cache-policies-per-project)

At USD 0.20 per average GB above the allowance,
the replay's storage sensitivities are:

- 25 GB average:
  no storage overage on either plan.
- 50 GB average:
  Developer adds USD 5;
  Startup adds nothing.
- 100 GB average:
  Developer adds USD 15;
  Startup adds nothing.
- 250 GB average:
  Developer adds USD 45;
  Startup adds nothing.

These are hypothetical monthly averages,
not conversions of the instantaneous 25.1 GB observation into a monthly bill.
They also exclude optional paid registry transfer.
[Sensitivity calculation](depot-expanded-cost-2026-10-15.evidence.json),
[storage and transfer pricing](https://depot.dev/docs/registry/overview#pricing)

## Agent work and the unmeasured budget

The expanded target includes prepared development environments,
requested experiments,
and repeated checks while investigating failures.
The trial verified a standalone SDK create/execute/stop sequence in 4.396 seconds
and two simultaneous command executions with 9.882 seconds of overlap.
Those probes establish a usable execution route and observed concurrency of two.
They do not measure the monthly demand of linker experiments,
fuzz campaigns,
debugging,
or environment refreshes.
[Standalone execution evidence](depot-trial-2026-10-15.md#prepared-environments-and-non-ci-work)

The Sandbox SDK documentation prices that route at CI compute rates by CPU and elapsed time.
The general pricing page separately lists an Agent sandboxes rate of USD 0.01 per minute.
These descriptions must not be silently combined into one meter:
the SDK rate is the relevant documented rate for the tested route,
while its account allowance attribution and hard-limit enforcement were not independently verified.
[SDK billing](https://depot.dev/docs/api/overview#sandbox-api),
[general product pricing](https://depot.dev/pricing)

Using the every-affected subtotal and no storage overage,
Developer has **USD 122.653** remaining before the USD 200 ceiling.
That remainder must cover all excluded work and charges.
At 100 GB average storage it becomes USD 107.653;
at 250 GB it becomes USD 77.653.
These are budget breakpoints,
not claims that the missing work fits.
[Subtotal and storage inputs](depot-expanded-cost-2026-10-15.evidence.json)

For scale,
if every remaining dollar went only to extra CI-rate SDK execution after included minutes were exhausted,
USD 122.653 buys about 170.35 hours on four CPUs or 42.59 hours on sixteen CPUs.
If it went only to default container builds,
it buys about 3,066.32 additional minutes.
The complete-workload model needs the measured counts,
durations,
machine sizes,
retained storage,
and refresh/retry frequency before dividing that remainder among them.
[CI rates](https://depot.dev/docs/ci/overview#depot-ci-sandboxes),
[container rates](https://depot.dev/docs/container-builds/overview#pricing),
[replay base](depot-expanded-cost-2026-10-15.evidence.json)

Startup has no dollar headroom below USD 200,
but its unused included capacity is not zero.
Against the every-affected scenario it retains approximately 17,737.90 base CI minutes,
12,872 base runner minutes,
and 3,874.84 container minutes.
This is modeled allowance headroom,
not the current trial balance.
Storage,
other metered products,
and taxes can still exceed the ceiling.
[Replay and plan inputs](depot-expanded-cost-2026-10-15.evidence.json)

A single-workload crossover illustrates why product mix matters.
Holding the modeled CI and runner work fixed,
Developer reaches USD 200 at about 4,191.48 total default-container minutes;
Startup would still be within its 5,000-minute allowance.
Adding only CI work instead does not produce that same crossover:
Developer is about USD 183.77 when Startup exhausts its 20,000 CI minutes,
after which both pay the same marginal CI rate.
No universal run-count threshold can choose a plan for the unmeasured workload.
[Base quantities](depot-expanded-cost-2026-10-15.evidence.json),
[CI billing](https://depot.dev/docs/ci/overview#pricing),
[container billing](https://depot.dev/docs/container-builds/overview#pricing)

## Coverage and allocation still to measure

The unpriced work is part of the intended result,
not optional work removed to make the subtotal attractive:

- Full desktop interaction and the remaining Alpine/platform matrix.
  The complete interaction result and reusable-environment runtime are still outside this replay.
- Browser engines and end-to-end suites,
  other affected packages and their consumers,
  native linters,
  conformance,
  fuzzing,
  and scheduled selection audits.
- Local Android device execution after cloud APK creation,
  plus release signing,
  packaging,
  and platform verification.
- Agent-requested experiments,
  retries,
  prepared-image refreshes,
  storage retention,
  GitHub artifacts,
  optional test-result uploads,
  and taxes.

[Expanded target](../planning/depot-expanded-coverage.md),
[explicit replay exclusions](depot-expanded-cost-2026-10-15.evidence.json)

The repository is public at this check.
Standard GitHub-hosted runner compute is free for public repositories;
larger runners are charged even there.
GitHub is therefore a credible compute-cost fallback,
but its latency for the expanded workload has not been measured.
Retained artifacts and caches also need separate accounting.
[Repository](https://github.com/Aquaticats/Monochromatic),
[GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

The sampled pretrial week has no music-player Windows,
Alpine,
or release runs because those workflows were introduced on October 15 UTC.
The replay cannot calculate historical platform time saved for that week.
The user's elapsed-time valuation requires the union of relevant unfinished work;
adding workload unions or multiplying isolated speedups by commit count would double-count overlap.
Additional coverage and successful experiments remain benefits to assess separately.
[Validated empty platform interval](depot-change-stream-2026-10-15.md#why-the-platform-baseline-is-empty),
[trial valuation boundary](depot-trial-2026-10-15.md#monthly-plan-scenarios)

## Conditional ranking and adoption boundary

1.  Developer with intentional GitHub allocation:
    preserves the lower subscription and permits the measured Depot routes.
    Its cost is allocation and usage management,
    and the fallback's latency and convenience remain unmeasured.
    Daily-latest Depot coverage is one priced example,
    not a proposal to skip affected-push validation.
2.  Developer with more affected and requested work on Depot:
    the five-workload subtotal leaves room for additional measured capabilities.
    Variable charges and unverified aggregate controls are the principal risks.
    Prefer the newest unfinished intermediate revision where cancellation is appropriate.
3.  Startup:
    its larger included pools may support measured workload expansion with less routing.
    The USD 200 base consumes the entire ceiling,
    and current coverage and experiment evidence does not establish that its added capacity is needed.

Ranking:
Developer with intentional allocation > Developer with broader Depot execution > Startup,
conditional on the unmeasured workload and convenience checks.
Intentional allocation ranks first because the user accepts a hybrid and values the subscription saving.
Broader Developer execution ranks ahead of Startup because the measured subtotal remains lower
while preserving the same tested execution routes.
Startup can move ahead if the completed target workload crosses a relevant cost breakpoint
or demonstrates enough additional value within verified spending controls.
[User constraints and proposal status](../planning/depot-ci-trial.md),
[replay evidence](depot-expanded-cost-2026-10-15.evidence.json)

No plan change,
production routing rule,
recurring job,
or spending-limit change is adopted by this report.
