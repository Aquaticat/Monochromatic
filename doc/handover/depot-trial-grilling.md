# Depot trial interview

## Purpose and current state

The user is trialing Depot and requested a grilling interview on 2026-10-15.
The user has delegated the technical recommendation after establishing priorities and budget.
The interview remains open:
the user explicitly requested further questions even when their answer might be uncertain.
The [trial proposal](../planning/depot-ci-trial.md) records the next evidence-gathering scope.
No migration or vendor adoption has been accepted.
The user explicitly requested this handover.

The user is inexperienced with CI/CD and wants concrete explanations and probing questions.
Abstract questions about acceptance thresholds and failure criteria have produced uncertainty.
The user explicitly said looking at Claude transcripts is unnecessary;
transcript investigation was stopped.

## Answers to preserve

- Motivation:
  GitHub Actions is slow.
- Provider-spending ceiling:
  USD $200 per month.
  The time-value objective now guides latency tradeoffs;
  no absolute wait threshold has been chosen.
- The user confirmed that the music-player release taking about 24 minutes is a relevant example.
- The user clarified that it was blocking Claude from working on the music player.
  Waiting to download a personal build was an interviewer hypothesis,
  not a confirmed requirement.
- The current CI setup is insufficient;
  the missing checks are not yet specified.
- The user is interested in avoiding repeated tool installation through Depot container builds.
  The claim that every run reinstalls every tool has not been verified across workflows.
- The user reports being logged in to the Depot CLI and points out that Depot skills are available.
- Asked which mistakes automatic checks should catch,
  the user answered that they are not sure yet.
- The user emphasized twice that current CI is far from sufficient or comprehensive.
  The target includes missing checks,
  not merely faster execution of the existing workflows.
- The user wants sliding-window rate limits,
  or an inexpensive way to express them without GitHub's overhead.
  They rejected hypothetical burst/debounce questions and requested inspection of actual GitHub CI history.
- The user highlighted GitHub's 10 GB cache space as another concern.
- The user accepts agent-requested cloud checks,
  while preserving early commits even when broken.
  Checking uncommitted changes is an optional capability,
  not a requirement to delay commits.
- The user knows GitHub cache capacity can be increased for a charge and considers that prohibitively expensive.
  Paid GitHub cache expansion is not an accepted fallback.
- Whether app/device checks should run on every push or at agent-requested checkpoints remains undecided.
  The user answered that they are not sure;
  no scheduling preference was accepted.
- The user identifies Depot's $200 Startup plan as the most they are willing to spend.
  Current published pricing includes usage allowances and charges overages;
  it is not unlimited usage for $200.
- The interviewer checked current GitHub cache pricing and gave a 50 GB total-cache example costing $2.80 extra monthly.
  The user explicitly said this does not change their view of GitHub's total costs and described GitHub as wasteful.
  The preference concerns total cost and repeated work,
  not just cache storage unit pricing.
- The user values each second while relevant CI remains unfinished at half Ontario's general minimum wage.
  They accepted counting elapsed time even while other useful work continues,
  with overlapping jobs counted once.
- Ontario's current general minimum is CAD $17.95 per hour.
  The resulting time value is CAD $8.975 per hour or approximately CAD $0.002493056 per second.
  The observed 1,448-second release interval represents CAD $3.609944 under this model.
- When asked to choose a comprehensive technical coverage target,
  the user delegated the recommendation to the agent.
  Further questions should seek user preferences or constraints,
  not ask the user to design CI machinery.
- Q13 asked about Claude's working habits while checks run.
  The user rejected it as irrelevant to Depot.
  The interviewer withdrew it;
  keep subsequent questions tied to Depot evaluation and adoption constraints.
- Q14 established an intentional hybrid:
  intelligently route some CI to GitHub and some to Depot.
  Routing should use measured benefit and the provider-spending ceiling from the outset;
  GitHub is not merely a fallback after budget exhaustion.
- Q15 remains unresolved:
  the user does not yet know whether a future organization transfer is acceptable.
  Evaluate currently available routes without assuming transfer permission.
- Q16 accepts prioritizing the newest version and stopping superseded intermediate checks.
  Explicit release builds remain separate from this intermediate-check policy.
- Q17 accepts deeper Depot dependence when measured benefits justify it.
  Portable checks are not a hard requirement;
  the intentional GitHub/Depot split remains a requirement.
- In Q18 the user reported the USD $200/month plan,
  a seven-day trial,
  and no usage so far.
  These are user-reported account facts.
  Exact expiry and configured spending controls remain unverified.

## Measured release example

[Run 38785821860][release-run] was inspected with `gh run list` and `gh run view --json jobs`.
Timestamp differences from this October 15 execution:

- Workflow creation to last update:
  24 minutes 8 seconds.
- Alpine x64 release compilation:
  18 minutes 46 seconds.
- Alpine x64 container image creation:
  28 seconds.
- Windows GNU compilation:
  14 minutes 12 seconds.
- Windows MSVC compilation:
  5 minutes 27 seconds.
- Linux x64 compilation:
  2 minutes 14 seconds.
- First job start minus workflow creation:
  1 minute 36 seconds.
  This is observed delay,
  not proof of runner queue time;
  workflow concurrency also serializes runs.

These measurements describe one execution,
not repeatability or a controlled Depot comparison.
The relationship between this run and Claude's inability to continue remains unverified.

## Evidence affecting the trial

The release workflow is in [music-player-release.yml](../../.github/workflows/music-player-release.yml).
Its Alpine compilation happens in a separate `podman run` after container image creation.
Replacing only the image builder does not move that separate compilation command to Depot.

[CI caching policy](../decision/ci-caching.md) records deliberate uncached Alpine and Windows GNU release builds.
The recorded reason includes GitHub cache capacity pressure.
Those cache sizes are historical readings,
not current measurements.

GitHub's repository API reported `Aquaticat/Monochromatic` as public and personally owned.
Current [Depot runner documentation][runner-docs] requires organization-owned GitHub repositories.
[Depot CI documentation][ci-docs] supports personal repositories but excludes Windows and macOS sandboxes.
These are distinct products;
a complete unchanged release migration is not established.

[Depot container builds][build-docs] retain image layers for subsequent builds.
Tool installation reuse and reuse of compiled dependencies are separate opportunities to measure.
No speedup for this repository has been measured on Depot.

## Rate-limit and cache probes

The existing [Scorecard workflow](../../.github/workflows/scorecard.yml) has rolling budgets of
2 analysis executions per minute,
4 per hour,
and 8 per day.
Its separate gate job reads GitHub run and job history before allowing analysis.
Rejected runs are skipped,
not scheduled for later.
This concrete policy supersedes the interviewer's hypothetical burst scenarios.

In [run 38806855827][gate-run],
the gate's setup step finished at 21:03:09 UTC on October 15.
The history-counting step remained in progress when queried at approximately 21:06:35 UTC.
This sample does not support attributing the delay solely to machine startup.
A query for Scorecard runs created since October 14 at 21:00 UTC returned 926 runs.
No completed gate duration or causal diagnosis has been established.

Depot documents [concurrency waiting inside its orchestration system][depot-orchestration],
but that is not equivalent to the Scorecard rolling execution budgets.
Searches of current compatibility docs,
documentation indexes,
API docs,
and public CLI request definitions
did not establish a native configurable rolling-window admission feature.
A custom controller before dispatch is an untested design possibility,
not a verified capability or accepted proposal.
Copying the current gate to Depot would still count GitHub runs instead of Depot runs.

The GitHub cache usage API returned 10,696,470,622 bytes and 15 entries on October 15.
A subsequent cache listing returned 16 entries,
so these endpoints are not a simultaneous snapshot.
The configured cache cap was not independently queried.
[GitHub documents paid cache expansion][github-cache],
so 10 GB is not a universal hard ceiling.
The user's objection to expansion is cost.

`depot org list --output json` succeeded and returned the user's Depot organization.
CLI access is verified without printing credentials or modifying authentication.

## Cost constraint and published allowances

[Depot pricing][depot-pricing],
checked October 15,
lists Startup at $200 per month with:

- 250 GB shared cache and registry storage.
- 20,000 Depot CI minutes,
  with larger machines consuming allowances faster.
- 20,000 GitHub Actions runner minutes.
- 5,000 container build minutes.
- 1,000,000 passing test results.

Overage charges apply beyond included usage.
The $200 ceiling is a requirement,
not authorization to purchase a subscription or consume additional paid resources.
Public documentation establishes some per-product minute caps,
but not a guaranteed aggregate USD $200 bill.
Already-running jobs,
storage,
and CI-specific cap behavior require account-level verification.
Current account plan,
trial credits,
and cap settings have not been inspected directly.
The user subsequently reported the USD $200/month plan,
a seven-day trial,
and no usage.
The browser skill's account inspection returned `No browser is available`;
browser discovery returned an empty list.
No Depot page opened and no authentication or billing setting changed.

A subsequent read-only probe used Depot CLI 2.102.22 and the documented `UsageService.GetUsage` endpoint.
The request covered October 1 through October 15 at 21:00 UTC.
Depot rejected the existing user token with code `unauthenticated`:
"This endpoint requires an organization token,
but a user token was provided.
Create an organization token in Organization Settings > API Tokens".
No organization token was available in `DEPOT_TOKEN`,
and none was created.
The inspected organization response exposes identity rather than billing configuration.
Current usage and an enforceable aggregate cap remain unknown.
The Q18 answer supplies plan,
trial duration,
and reported usage;
it does not establish an expiry timestamp or spending-limit behavior.

[GitHub billing][github-billing] lists cache overage at $0.07 per GB-month,
where its GB unit is a GiB.
The illustrative calculation was `(50 - 10) * 0.07 = 2.80` for constant full-month occupancy.
This storage-only calculation does not estimate the cost of the desired comprehensive CI.
The user rejected it as a reason to change their preference.

## Recent overlap and branch-rule evidence

A read-only workflow-history probe covered October 15 from 00:00:00 through 19:00:00 UTC.
The API returned 75 runs and matching total counts:
29 release runs,
33 Windows runs,
and 13 Alpine runs.
Ten older runs had executing jobs after a newer descendant commit triggered the same workflow on the same branch.
Commit ancestry and actual job completion timestamps were checked.
Seven finished without cancellation;
three release runs were cancelled.
One successful overlapping release run only performed detection and skipped builds.
The probe does not establish that older results were unnecessary or why cancellations happened.

For example,
newer Windows and Alpine runs were created at 15:59:37 UTC.
The [older Windows run][overlap-windows] completed its last job at 16:09:01;
the [older Alpine run][overlap-alpine] completed its last job at 16:05:42.
These are elapsed overlaps,
not billed runner minutes.
Q16 initially called the newer-run creation time a start time;
the interviewer corrected that distinction explicitly.

At 21:27:05 UTC,
the branch-protection API returned empty required-status-check lists for `main`.
The effective rules API returned only a Copilot review rule.
These responses do not establish any required music-player CI checks.
This is background evidence,
not a proposal to redesign branch governance.

## Evaluation objective

Compare provider charges plus valued elapsed CI time for equivalent coverage and the same stream of changes.
The provider bill alone must remain within USD $200 per month.
Convert provider charges and the Ontario-based time value into the same currency with a dated exchange rate.
An exact CAD/USD rate has not been established in this session.

The time rate comes from [Ontario's general minimum wage][ontario-wage],
effective October 1, 2026.
Intervals with overlapping relevant CI jobs contribute elapsed time once.
Failed setup or skipped required checks are not successful performance results.

## Concrete coverage gaps

The read-only inventory compared workflow declarations,
root tasks,
and selected music-player tasks.
It did not execute tests,
inspect every package or third-party action,
or audit branch protection.

- [Android tasks](../../package/music-player/android-app/mise.toml) include host unit tests,
  device tests,
  Android lint,
  Kotlin checks,
  and native Rust Clippy.
  The inspected workflows do not invoke those tasks or their direct test commands.
  Android release packaging invokes `build:release`;
  ordinary Kotlin edits are outside that release workflow's selected `Cargo.toml` push paths.
- [Desktop tasks](../../package/music-player/desktop-app/mise.toml) include
  [real-keyboard end-to-end tests](../../package/music-player/desktop-e2e/README.md).
  The inspected workflows do not invoke that suite.
  Windows and Alpine workflows do run desktop unit and smoke tests.
- [Shared audio core tasks](../../package/music-player/truepeak-core/mise.toml) include their own all-features test.
  No dedicated invocation appeared in workflows;
  building the core as a dependency is not running its tests.
- [Root tasks](../../mise.toml) expose package builds,
  lint,
  unit tests,
  browser tests,
  and end-to-end tests.
  The inspected workflows run selected package checks rather than a general changed-package check pipeline.

These are missing connections to existing checks,
not proof that the underlying tests cover all desired behavior.
The broader CI plan must also identify behaviors for which tests do not yet exist.

## Open questions and next work

- The ownership question remains unresolved;
  no repository transfer is authorized.
- Await Q19 confirmation of the trial brief:
  intentional hybrid routing,
  broader coverage,
  reuse across relevant input changes,
  rolling budgets without current counting overhead,
  correct outputs and failure detection,
  and the combined cost objective within USD $200/month.
- Verify account spending controls before resource-consuming execution;
  the supported usage endpoint rejected the available user-token credential.
- Preserve existing explicit-release handling during the proposed trial.
  The current release workflow serializes runs with `cancel-in-progress: false`;
  Q16 changes only the proposed policy for intermediate checks.
- Use the [trial proposal](../planning/depot-ci-trial.md) to collect comparable runtime,
  coverage,
  and cost evidence.
- Establish device-test runtime and cost before recommending its frequency.
- Compare Depot's effect on relevant completion times without reopening Claude's working habits.
- Make the technical coverage recommendation,
  preserving supported platforms and recording missing behavior tests.
- Compare the desired broader CI against the $200 ceiling and repeated work,
  rather than reopening cache unit pricing.
- Keep proposals separate from accepted decisions;
  confirm shared understanding before implementation.

No workflow,
Depot resource,
credential,
or billing setting has been changed in this interview.
The worktree initially contained an unrelated `mise.lock` modification.
Commit `86961fee56` created this handover;
its first version passed a CommonMark-to-HTML render check with Pandoc.
Commit `1c9599732d` added the rate-limit evidence and expanded coverage scope;
that version also passed rendering.

## Interview process correction

Q13 expanded the interview into agent working habits.
The user rejected that topic as irrelevant to Depot,
and the interviewer withdrew the question.
Proposed clarification to existing `AGENTS.md` rule `AUT`,
pending acceptance:
keep interview questions within the requested decision;
observed symptoms do not authorize adjacent workflow redesign.

The interviewer stopped after drafting the trial proposal despite unresolved decisions.
The user asked for further questions even if they might answer that they do not know.
Delegating technical judgment does not confirm that the interview is complete.
The grilling skill requires an empty decision frontier and confirmation of shared understanding before implementation.
Proposed clarification to existing `AGENTS.md` rule `ASK`,
pending acceptance:
"Non-measurable facts:
ask.
An uncertain answer or delegated technical judgment does not close unresolved preferences;
offer concrete recommendations and confirm shared understanding."

The interviewer asked for hypothetical rate-limit preferences before inspecting the existing policy and run history.
The user corrected this;
subsequent questions should start from measured repository examples.
Proposed clarification to existing `AGENTS.md` rule `QF1`,
pending acceptance:
require relevant configuration and recent execution history to be inspected before asking behavior questions
that those artifacts can answer.

[release-run]: https://github.com/Aquaticat/Monochromatic/actions/runs/38785821860
[runner-docs]: https://depot.dev/docs/github-actions/overview
[ci-docs]: https://depot.dev/docs/ci/overview
[build-docs]: https://depot.dev/docs/container-builds/overview
[gate-run]: https://github.com/Aquaticat/Monochromatic/actions/runs/38806855827/job/116669815274
[depot-orchestration]: https://depot.dev/blog/building-ci-with-durable-lambda
[github-cache]: https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching
[github-billing]: https://docs.github.com/en/billing/concepts/product-billing/github-actions
[depot-pricing]: https://depot.dev/pricing
[ontario-wage]: https://www.ontario.ca/document/your-guide-employment-standards-act-0/minimum-wage
[overlap-windows]: https://github.com/Aquaticat/Monochromatic/actions/runs/38765128213
[overlap-alpine]: https://github.com/Aquaticat/Monochromatic/actions/runs/38765128314
