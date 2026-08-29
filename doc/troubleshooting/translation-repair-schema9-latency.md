# Translation-repair schema 9 at 88049530a spent 80 minutes in grace before naturalness refusal

## Symptom

Fresh `Weideriche_` schema-9 validation started from commit `88049530a` on 2026-08-29.
First corpus entry ended after 6,433,300 milliseconds with a retryable absolute-naturalness refusal.
It wrote no page or artifact.
Operator stopped second entry after first failure,
so second entry is not timing evidence.

Matched first entries from preceding schema-9 runs ended after 3,014,684 and 3,774,160 milliseconds.
Prior totals therefore supported initial 61 to 84-minute whole-process estimate,
but did not predict this entry's extra rounds and repeated grace exhaustion.

## Root cause

This was not idle process or deadlock.
Log modification continued within seconds of observation,
and model streams and round completions continued until refusal.

Measured first-entry phase wall times were:

- preparation before document lanes: 10 seconds
- repair lane: 2,151 seconds
- translate lane: 1,301 seconds
- lane contest: 613 seconds
- consolidation and final naturalness work: 2,358 seconds

Round logs attributed 4,797,358 milliseconds,
79.96 minutes,
to post-quorum grace.
That is 74.6 percent of first-entry wall time.
Matched prior entries spent 1,987,611 and 2,628,052 milliseconds in grace.
Grace growth therefore explains 82.2 percent of difference from 3,014,684-millisecond run and
81.6 percent of difference from 3,774,160-millisecond run.

`package/module/translation-repair/src/stage-round.ts:269` starts round clock.
`package/module/translation-repair/src/stage-round.ts:366` waits for remaining seats after quorum.
`package/module/translation-repair/src/stage-round.ts:419` emits total,
time-to-quorum,
and grace wall time.

```ts
await settleWithin({
  promise: Promise.allSettled(asks,),
  ms: graceMs,
},);
```

GLM-5.3-Flash reached 180,000-millisecond post-quorum abandonment eleven times in first entry.
Comparable entries recorded two and four such abandonments.
Current entry also recorded three Synthetic HTTP 503 responses and five structured-reply mismatches.
Those conditions triggered lost voices or recovery calls,
but repeated grace waits were larger measured cost.

Completed-call latency does not support general provider slowdown:
GLM-5.3-Flash completed-call p90 was 137,318 milliseconds,
compared with 150,636 and 143,240 milliseconds in matched entries.
This excludes abandoned calls,
so it establishes only that completed calls did not all shift slower.

Nondeterministic quality work multiplied exposure to stragglers:

- current repair ran sixteen selection rounds, compared with twelve and ten
- current consolidation ran twenty-seven rounds, compared with ten and fourteen
- current consolidation ran six absolute reviews, compared with one and two
- current consolidation ran six refinement rounds, compared with two and three

The exact final candidate then failed correctly.
Independent replay heard all eight seats:
seven accepted and GPT-OSS rejected with one idiomatic-naturalness finding in paragraph three.
Finding's affected phrase existed before second correction and survived all three second-correction proposals.
Correction selection was unanimous,
including GPT-OSS ballot,
but selection chooses best available faithful correction and does not certify absolute publishability.
Independent replay of previous correction candidate was also unacceptable,
with GPT-OSS and DeepSeek Flash each returning one finding.
Replayed GPT findings differed across adjacent candidates;
this supports iterative defect discovery rather than proof latest required finding was ignored.
Final absolute review remains independent and correctly refused publication after second correction cap.

## Missing observability

Existing logs were sufficient to prove aggregate cause only after correlating:

- round timestamps
- ledger sequence
- slice-cache modification times
- terminal tally

They were not sufficient to identify currently active consolidation slice during run,
assign correction rounds to slices directly,
or name which absolute-review seats rejected without replay.
That made healthy but expensive quality work look like unbounded wait.

Logging now closes consolidation and absolute-review gaps:

- `package/module/translation-repair/src/slice-cost-log.ts:136` defines `SLICE-START`
- `package/module/translation-repair/src/consolidate-driver.ts:299` brackets every consolidation slice
- consolidation exits distinguish `computed`, `resumed`, `reused`, `unsettled`, `failed`, and `aborted`
- `package/module/translation-repair/src/absolute-naturalness-review-stage.ts:292` summarizes each seat's status,
  finding count,
  paragraph numbers,
  and finding digests
- summaries carry ids,
  counts,
  locations,
  digests,
  and timings only,
  never candidate or reviewer wording

Future consolidation logs will identify slice at dispatch and emit corresponding `SLICE-COST` on every scoped exit.
`slice-cost-report` now includes consolidation beside repair and translate.
Lane contest retains existing round-level timing rather than per-slice cost bracket.

## Verification

Build before tests because tests import `dist/`:

```sh
mise run //package/module/translation-repair:build
node package/module/translation-repair/src/slice-cost-read.unit.test.ts
node package/module/translation-repair/src/consolidate-driver.unit.test.ts
node package/module/translation-repair/src/absolute-naturalness-review-stage.unit.test.ts
```

Tests prove:

- start marker precedes terminal cost record
- consolidation cache resume reports `exit=resumed`
- unsettled consolidation remains distinct from completed work
- caller abort overrides provisional failure while terminal cache exits remain named
- absolute-review summary names each seat status,
  finding count,
  paragraph,
  and digest without wording

Operator-boundary report verification:

```sh
mise run //package/module/translation-repair:slice-cost-report -- \
  "$HOME/temp/agent/validation-Weideriche-schema9-eight-roster-20260829.log"
```

Existing run prints repair and translate without inventing absent consolidation rows.
A temporary one-row consolidation fixture separately printed consolidation at 0.2 minutes;
that fixture is verification evidence,
not repository input.

Re-run latency extraction against private pass log:

```sh
grep ' round:' "$HOME/temp/agent/validation-Weideriche-schema9-eight-roster-20260829.log"
grep 'abandoned 180000ms after quorum' \
  "$HOME/temp/agent/validation-Weideriche-schema9-eight-roster-20260829.log"
```

`runGatherRound` lines are direct phase evidence because production overlap was one and stages ran serially.

## Verified workarounds

Keep fail-closed naturalness floor and two-correction cap.
The run spent additional time but prevented known unnatural wording from publication.

Use `SLICE-START`,
`SLICE-COST`,
and per-seat status summaries for future ETA and diagnosis.
This changes observability only,
not quorum,
grace,
model eligibility,
or publication decision.

Do not lower 180-second production grace from this run alone.
Delayed rejection is release-critical,
and current evidence combines more quality rounds with one model's repeated nontermination.
A grace change requires matched output-quality evidence,
not latency preference.

## What does not work

- Extrapolating whole-run ETA from two prior totals does not work when generated output changes number of repair and correction rounds.
- Treating recent log modification as remaining-time evidence does not work.
  It proves liveness only.
- Counting completed streams alone does not price abandoned calls.
  Completed-call percentiles exclude exact calls consuming full grace.
- Multiplying roster count by average call time does not work.
  Seats run concurrently inside each round,
  while rounds and overlap-one slices serialize.
- Process exit code does not prove publication.
  Terminal tally,
  artifact count,
  page count,
  and `verify-published` remain required.
- Removing or weakening final rejection to save time does not work.
  Independent replay reproduced unacceptable verdict on exact candidate.

## Upstream filing decision

Synthetic is hosted service.
No provider source repository or matching issue tracker was found through
[Synthetic API documentation][api-overview] or public repository search.

1. **Is it upstream's fault?** Partly.
   Synthetic returned queue/full-target 503 responses,
   and GLM-5.3-Flash repeatedly streamed until local grace cut it.
   Pipeline's accumulated wait is also deliberate local quality policy.
2. **Can upstream fix it?** Provider can improve target availability and terminate pathological streams.
3. **Are they supporting this use case?** Yes for chat completion and structured output.
4. **Would repository welcome contribution?** Unknown because no provider source repository was found.
5. **Will they likely fix it?** Unknown without public tracker or service incident record.
6. **Have we prototyped compatible fix?** No upstream patch is possible from available source.
   Local patch improves diagnosis without changing request contract.

Constraints four through six do not pass,
so no upstream issue or additive comment should be filed.
If provider exposes public tracker later,
a privacy-safe report can include timestamp,
model id,
HTTP statuses,
and abandonment counts without corpus text.

[api-overview]: https://dev.synthetic.new/docs/api/overview
