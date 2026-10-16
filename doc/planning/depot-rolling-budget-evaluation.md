# Depot rolling-budget evaluation

## Recommendation and scope

Keep Scorecard scheduling in its existing GitHub workflow during the Depot trial.
No replacement has been validated that preserves its rolling limits while reducing admission overhead.
This is a recommendation to defer this migration,
not a claim that the current gate correctly enforces every execution limit.
The gate has measured overhead and correctness gaps described in this evaluation.
The [trial plan](depot-ci-trial.md) authorizes evaluation,
not production adoption.

Current provider documentation and public source were checked on October 15,
2026.
This evaluation compares mechanisms against the established requirement;
it does not select a new scheduler vendor or approve a custom controller.
There is no ranking of replacement implementations because none passed an equivalent-policy execution test.

## Required behavior

The [Scorecard workflow](../../.github/workflows/scorecard.yml) specifies
2 analyses per rolling minute,
4 per rolling hour,
and 8 per rolling day.
Excess events are skipped rather than retried after capacity returns.
The [accepted trial context](../handover/depot-trial-grilling.md) also permits cancelling superseded intermediate checks.
Neither permission removes the rolling limits or authorizes replacing them with a periodic schedule.

A replacement must evaluate all windows together,
preserve the selected commit and triggers,
and make concurrent admission decisions without spending the same capacity twice.
For example,
after two counted executions at 12:00:10 and 12:00:20,
12:00:30 must be rejected even if neither execution is still running.
At 12:01:10,
the first execution falls outside the minute window,
but the hour and day windows still apply.
This example follows the current strict `ageSeconds < seconds` comparison.

The future workload includes newly wired checks and event bursts from agent work,
not just today's successful Scorecard analyses.
Rejected events must therefore be part of any overhead measurement.
An implementation that scans every rejected event can become expensive even when analysis execution remains bounded.

## Existing implementation and measured overhead

The production gate runs on `ubuntu-latest` with `actions: read`.
Job concurrency serializes the gate under `scorecard-rate-limit` with `cancel-in-progress: false`.
The gate lists workflow runs using a `created` filter,
then awaits a separate jobs request for each visited run until a budget is exhausted.
It counts an analysis when its conclusion is neither `skipped` nor `cancelled`.
Analysis starts in a dependent job after the gate completes.
These observations come from [the workflow source](../../.github/workflows/scorecard.yml).

The completed [gate job 116669815274][gate-job] provides a measured example:

- The job ran from 21:03:07 to 21:08:41 UTC,
  or 334 seconds.
- `Count recent analysis runs` ran from 21:03:09 to 21:08:40 UTC,
  or 331 seconds.
- Its log reported 922 workflow runs and emitted 790 per-run job-query results before finding eight counted analyses.
- It then rejected the current analysis because the day budget was exhausted.

These timings come from the completed jobs API response,
and the counts come from the complete job log fetched with `gh api`.
They replace the handover's preliminary observation that the step was still running after three minutes.
The handover's separate 926-run history query used a different capture interval;
it is not this job's fetched-run count.
This is one completed observation,
not a latency distribution or proof that every second was network latency.
It does establish that the measured delay was predominantly inside the counting step,
after setup.

The disposable `replay-budget` task extracts the production script and injects fixed time and fake GitHub responses.
All 12 cases passed again during this evaluation.
The [retained replay results](../audit/depot-trial-2026-10-15.evidence.json) cover empty history,
each exhausted window,
exact minute expiry,
failed,
cancelled,
skipped,
running,
and absent analysis jobs.
A 926-run skipped fixture issued 926 sequential job-history calls.
The fixture proves request shape and decisions under its supplied responses;
it does not measure live API latency.

## Correctness boundaries

The fixture also exposes a missing admission reservation:
requests that see absent analysis jobs both pass.
GitHub serializes only the gate job,
while the counted analysis is a different dependent job.
There is no persisted reservation between the decision and the downstream job becoming visible.
This is a modeled gap,
not a demonstrated live budget violation.
Making the executor faster does not establish that this gap disappears.
[Source](../../.github/workflows/scorecard.yml)
and [fixture evidence](../audit/depot-trial-2026-10-15.evidence.json).

Additional source and API boundaries require explicit acceptance tests before claiming exact execution accounting:

- Window age uses workflow `created_at`,
  not analysis start time.
  Long queueing can therefore make an analysis appear older than its execution.
- A cancelled analysis is excluded even if it performed work before cancellation.
  Permission to cancel superseded checks does not establish that consumed work should be refunded.
- `filter: latest` observes the most recent job execution rather than all rerun attempts.
  [GitHub jobs API](https://docs.github.com/en/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run).
- GitHub documents a 1,000-result search limit when filtering workflow runs by `created`.
  Pagination alone therefore does not establish a complete day of history once that limit is exceeded.
  No over-limit live sample was tested here.
  [GitHub runs API](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow).

The first two observations follow directly from [the gate source](../../.github/workflows/scorecard.yml).
The replay did not exercise GitHub visibility timing,
reruns,
history truncation,
or restart recovery.
Those gaps prevent treating its passing cases as a complete admission proof.

## Native controls evaluated

### GitHub concurrency and Depot GitHub runners

GitHub concurrency controls active and pending jobs or workflows.
The default retains one pending item and replaces it when another arrives.
Current documentation also offers `queue: max` for up to 100 pending items.
Neither control counts starts in the preceding minute,
hour,
and day.
The two-completed-executions example in Required behavior is outside concurrency's active-work accounting.
[GitHub concurrency documentation][github-concurrency].

Depot GitHub runners replace the execution machine after GitHub emits a `workflow_job` event.
They do not replace this workflow's admission script or its GitHub history queries.
The documented integration is a runner-label change;
this evaluation contains no measurement showing that moving the gate to a Depot runner reduces its counting time.
[Depot runner architecture](https://depot.dev/docs/github-actions/overview).

### Depot CI

Depot documents workflow and job concurrency,
cron,
push,
and dispatch triggers.
It explicitly lists `on.branch_protection_rule` as unsupported,
although the current Scorecard workflow uses that trigger.
A complete migration must account for that event as well as the budgets.
[Depot compatibility reference][depot-compatibility].

Depot's orchestration article explains that a concurrency-group completion wakes waiting workflows.
It documents suspended orchestration between callbacks,
not a user-configurable rolling admission counter.
[Depot orchestration](https://depot.dev/blog/building-ci-with-durable-lambda).

The public `CIService` source exposes run,
dispatch,
retry,
cancel,
and inspection operations.
Its `RunRequest` and `DispatchWorkflowRequest` contain no rolling-window budget or reservation field.
This was checked at `depot/cli` revision `1f96d6d488f938de97ea640b115e9567ebfd6fbf`.
[CI API source][depot-ci-api].
Together with the compatibility reference,
this establishes no validated public configuration for this requirement;
it does not prove that Depot has no internal capability or future extension.

Copying the existing gate into Depot CI would retain queries against GitHub workflow history.
Those queries do not account for Depot CI executions.
Replacing them with Depot list calls would still require a separately validated admission design.
The API source describes `ListRuns` as recent discovery,
not historical search;
`ListWorkflows` has a bounded result size without a pagination token.
[CI API source][depot-ci-api].

### Depot sandboxes and periodic execution

The Sandbox SDK documents creation,
commands,
listing,
termination,
and lifetime controls.
Its creation options do not include rolling admission rules.
A process kept alive to maintain counters would be application scheduling code,
not a native policy established by these APIs.
The documented maximum sandbox lifetime is 24 hours,
so persistent accounting would also need a state and restart design.
[Sandbox SDK](https://depot.dev/docs/api/sandbox-sdk-reference).

A cron-only replacement would change when checks respond to pushes and branch-protection changes.
It would not by itself account for manual runs,
retries,
or actual start times after scheduling delays.
Depot documents independent UTC cron scheduling without a start-time SLA.
Periodic execution is therefore not an equivalent implementation of the accepted event-driven policy.
[Depot schedule behavior][depot-compatibility].

## Comparable existing mechanisms

The repository already uses concurrency in other workflows,
including [Alpine checks](../../.github/workflows/music-player-alpine.yml).
Its [debounce utility](../../package/module/conf-fork/src/debounce.ts) waits for a quiet period;
its [p-limit fork](../../package/module/p-limit-fork/src/index.ts) bounds simultaneous calls.
Neither source defines shared rolling execution accounting.
They are related incumbents,
not replacement schedulers demonstrated by this trial.

The primary-source comparison was widened beyond Depot to avoid mistaking an empty native-feature search for
the absence of an established mechanism:

- Inngest documents skipping excess events before function starts,
  matching the desired rejection behavior.
  Its rate limiter uses the generic cell rate algorithm and exposes a limit and period.
  That documentation does not establish an atomic combination of the required exact historical windows.
  No equivalent-policy execution was tested.
  [Inngest rate limiting](https://www.inngest.com/docs/durable-execution/flow-control/rate-limiting).
- Upstash's TypeScript `slidingWindow` is explicitly a weighted approximation that assumes uniform arrivals
  in the preceding fixed window.
  Its name alone is insufficient evidence for exact rolling counts during bursts.
  [Upstash algorithms](https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms).
- Upstash also documents a timeout that can allow a request regardless of the current limit.
  Any future evaluation would need to account for that failure behavior explicitly.
  [Upstash timeout behavior](https://upstash.com/docs/redis/sdks/ratelimit-ts/features#timeout).

These examples establish useful precedent for admission before compute starts,
but neither is an approved dependency or a validated replacement.
No service was provisioned and no custom scheduler was built.
Vendor selection would require the repository's full technology evaluation process and execution evidence.

## Evidence scope and adoption conditions

Local inspection covered `.github/`,
root `mise.toml`,
the trial plan and handover,
retained trial evidence,
and related utilities under `package/module/`.
The workflow search included `rate.limit`,
`rolling`,
`debounce`,
`concurrency`,
`TODO`,
`FIXME`,
`workaround`,
and `suppress`.
It found the Scorecard history workaround and other concurrency controls;
it did not establish another CI budget owner.
An initial search included a nonexistent main-worktree `.depot/` path;
the existing paths were searched again successfully without that path.
This is a scoped inventory,
not a repository-wide claim that no scheduling utility exists.

External queries covered Depot's compatibility reference,
CI API,
Sandbox SDK,
runner architecture,
and orchestration article;
GitHub concurrency and run/job APIs;
and Inngest and Upstash admission documentation.
The generated Depot CI API web page exceeded the browsing fetch limit,
so the public CLI's owning protocol definitions were fetched through `gh api` instead.
No conclusion relies on that failed page fetch.

Adoption remains gated on an implementation that demonstrates the requested windows together,
including overlapping arrivals and exact boundary expiry;
documents what counts when work is cancelled or retried;
preserves required triggers;
and survives state loss or incomplete provider history without silently admitting excess work.
Measure admission separately from execution using unchanged-input repetitions,
including a rejected-event history comparable to the observed workload.
Record request count,
elapsed spread,
and actual billed usage before describing the replacement as inexpensive.

Until that evidence exists,
the scheduling portion of the trial concludes **no validated replacement**.
The measured 331-second counting step justifies continued optimization work,
but it does not justify deploying an untested scheduler or relaxing the accepted budgets.

## Verification

`mise run replay-budget` passed all 12 fixtures.
The scoped `lint:monochromatic-lint` task passed,
and the Pandoc-rendered HTML was inspected for headings,
lists,
links,
code spans,
and the emphasized conclusion.
`git diff --check` passed.
The research was first committed as `22c3f3d65e` before document verification.

[gate-job]: https://github.com/Aquaticats/Monochromatic/actions/runs/38806855827/job/116669815274
[github-concurrency]: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
[depot-compatibility]: https://depot.dev/docs/ci/compatibility
[depot-ci-api]: https://github.com/depot/cli/blob/main/proto/depot/ci/v1/ci.proto
