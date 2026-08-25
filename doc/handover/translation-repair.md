# Translation repair session handover

Status:
the two-lane pipeline is built and publishing;
the full-roster editor calibration is the open measurement.
Read `doc/planning/translation-repair-open-decisions.md` for what is still undecided.

WHAT THIS FILE IS.
What a session starting today needs, and nothing else.
Capped at two thousand lines.
When it reaches that cap, its oldest sections move verbatim into
`doc/handover/translation-repair-history.md`, which has no cap.

WHY THE SPLIT.
This file reached twenty thousand lines, at which point it stopped being a handover
and became an archive nobody could read at the start of a session.
The history keeps every measurement; this keeps the working set.

THERE IS NO RELEASE DEADLINE.
The owner withdrew the one that used to sit here, on the grounds that being aware of it
made the work worse: it bought lower quality and, more than once, took longer anyway.
Do not reintroduce a date, do not infer schedule pressure from anything in the archive,
and do not let "time remaining" enter any decision. Quality is the only standing constraint.

WHAT BELONGS HERE.
Open tasks and their state, decisions still in force, defects not yet fixed,
and any measurement a reader would otherwise re-run.
What belongs in the history: closed work whose conclusion is already encoded in the code,
and superseded reasoning kept only for its evidence.

## The writers are seated, and the queue is being verified live

2026-08-24, after the 40-round producer calibration landed.

### The seating

`editorModelIds` and `refinerModelIds` are now
`hf:moonshotai/Kimi-K3`, `hf:Qwen/Qwen3.8-27B`, `gemma-4-26b-a4b-it`.
`hf:zai-org/GLM-5.2` left both seats and `qwen3.8-max` was not given one.
The whole standing, both raw and availability-adjusted,
the Mann-Whitney proof that `qwen3.8-max`'s top headline is survivorship,
and the reason the same table must NOT be used to move a checker seat,
are in `doc/decision/translation-repair-multi-provider.md`
under "The forty-round pass seats the writers, 2026-08-24".

Two reach checks ran before the swap, since `gemma-4-26b-a4b-it` is text-only
and Hyper-served:

-   Pictures never reach these stages.
    `document-lanes.ts` records that the repair lane edits in place against critic claims
    and none of its stages asks what a picture says,
    and reading is its own stage over `RUN_READER_MODELS`,
    which `run-config.ts` derives from the catalog rather than listing by hand.

-   The catalog's `maxOutputLength` of 25_600 is not a bound this model runs into.
    Nothing in production reads that field at all,
    and the model answered 40 rounds of production-sized slices with no cut.

Structured output was checked too, because these seats emit schema-guarded JSON:
across 937 completed streams in the calibration
there was exactly ONE schema mismatch, and it was `qwen3.8-max`'s.
`gemma-4-26b-a4b-it` had none.

### The live verification of `#196`

The queue was GFP-proven but had never run against a provider.
It does not need XingZ60's thirteen hours to be exercised:
the mechanism is size-independent,
so a mid-sized entry under a deliberately tight cap runs the same code path.

    TRANSLATION_REPAIR_RUNS_DIR=<throwaway> TRANSLATION_REPAIR_HARD_CAP_MINUTES=5 \
      mise run //package/module/translation-repair:corpus-pass -- --only MocaKawai

`--only` already existed; nothing had to be built to bound this.
What the run has to show is a `REATTEMPT MocaKawai queued` line,
an attempt count above one in the run's attempt map,
and a cache that grew between attempts.

A useful thing fell out of reading the cache layer for this:
`countCachedSlices` counts every `.json` under the entry's cache directory,
and `slice-cache-namespace.ts` gives pairing, contest, refine and translate records
that same suffix and that same directory.
So an attempt that spends its entire cap buying only a section pairing
still registers as progress and still earns its re-attempt.
Had setup cached somewhere else, the largest entries,
the ones this was built for, would have stalled on their first attempt every time.

### What the first live run proved, and the defect it exposed

Run 1, `--only MocaKawai` under a 5-minute ceiling, into a throwaway runs dir.
It exercised BOTH branches of the re-attempt policy in one invocation
and then exited cleanly, exit 0, in 601.84s:

    CAP OVERRIDDEN by TRANSLATION_REPAIR_HARD_CAP_MINUTES: entries run under 5 minutes rather than the built-in 420
    TALLY MocaKawai status=ERROR ms=300002 aborted=true error=Timeout: MocaKawai exceeded its 300000ms deadline
    REATTEMPT MocaKawai queued: cached 2 more slices, so the next attempt starts further along
    TALLY MocaKawai status=ERROR ms=300004 aborted=true error=Timeout: MocaKawai exceeded its 300000ms deadline
    STALLED MocaKawai: its 2 cached slices are what it started with,
    so a further attempt in this invocation would repeat it
    DONE processed=0 of pending=1; artifacts=0/92 elapsed=600008ms

`attempts.json` read `{"MocaKawai": 2}`,
so the second attempt happened inside the SAME invocation
against the same `sha256-tree-v1:38a0fcb...` digest.
That is the whole of what `#196` said was untested.

THE RE-ATTEMPT REALLY DID START FURTHER ALONG, and the timestamps show it.
Attempt 1 reached "both lanes over 13 slices" 45 seconds in, after buying two block pairings.
Attempt 2 reached the same line 0.16 seconds in, off those cached pairings.

The two records it banked were both `pairing.` files rather than repair slices,
which is the cache-layout fact working exactly as intended:
`countCachedSlices` counts every `.json` in the entry's directory,
so setup progress earns a re-attempt.

#### The ceiling has a floor, and nothing said so

Attempt 2 banked nothing and the entry stalled.
The cause is not the queue: `RUN_PER_CALL_TIMEOUT_MS` is 360_000
and the ceiling was 300_000,
so every attempt was cut BEFORE any single exchange was allowed to return.
No exchange returned, so no slice cached, so no progress could be read,
so the queue correctly dropped the entry.

Every component behaved as designed and the run explained none of it,
while five minutes looks like a perfectly reasonable ceiling to set.
`capOutlastsOneCall` and `capTooTightNote` now catch it and print
`CAP TOO TIGHT` naming both numbers.

WARNED RATHER THAN REFUSED, deliberately:
cutting mid-exchange is exactly what a test of the stall path wants,
and refusing would have blocked the run that found this.
GFP-proven at the equal-values boundary,
which is the case a `>=` would silently accept.

This also answers half of `#196`'s open question about raising the cap by slice count.
Any such rule has a hard floor at one exchange deadline,
and a practical floor well above it,
since a slice runs several exchange rounds in sequence:
the critic round alone took over 200 seconds on the measured attempt.

### The second run says the floor is much higher than one exchange

Run 2, `--only Weideriche_` under a 15-minute ceiling, exit 0 in 1801.90s.
It stalled too, and that is the finding:

    CAP OVERRIDDEN by TRANSLATION_REPAIR_HARD_CAP_MINUTES: entries run under 15 minutes rather than the built-in 420
    TALLY Weideriche_ status=ERROR ms=900061 aborted=true
    REATTEMPT Weideriche_ queued: cached 1 more slices, so the next attempt starts further along
    TALLY Weideriche_ status=ERROR ms=900002 aborted=true
    STALLED Weideriche_: its 1 cached slices are what it started with
    DONE processed=0 of pending=1; artifacts=0/92 elapsed=1800065ms

`Weideriche_` is the SECOND SMALLEST entry in the corpus,
828 bytes of source against a 41720-byte largest,
and it cuts into 3 slices.
The ceiling was 15 minutes, two and a half times the 6-minute exchange deadline,
so `CAP TOO TIGHT` correctly stayed quiet.

Attempt 1 bought the block pairing in seconds
and then spent the remaining fourteen and three quarter minutes on CHUNK 0 ALONE,
reaching critic, then panel, then editor, and never finishing.
The stage words in that attempt's log come to critic 18, panel 12, editor 2.
Attempt 2 did the same and banked nothing.

SO ONE REPAIR SLICE COSTS MORE THAN 885 SECONDS, on the second smallest entry.
That is not surprising once stated:
a slice runs critic, panel, editor and checker rounds IN SEQUENCE,
and each round is bounded by `RUN_PER_CALL_TIMEOUT_MS` at 360_000 on its own.

THE `CAP TOO TIGHT` FLOOR IS THEREFORE NECESSARY BUT NOT SUFFICIENT.
One exchange is a provable lower bound and it is the honest one to assert
without a measurement.
The practical floor is a whole round sequence, and 15 minutes is under it.
The production ceiling of 420 minutes is nowhere near either floor,
so nothing that ships is affected;
what was affected was two verification runs that looked reasonable and could not work.

The number to replace the estimate with is being measured now:
run 3 is `--only Weideriche_` at the DEFAULT ceiling,
which settles the entry end to end and reports what it actually cost.
Do not raise the warning threshold on the 885-second lower bound.
It is a bound, not a cost.

### Run 3 settles, publishes, and verifies, with half the roster dark

`--only Weideriche_` at the DEFAULT 420-minute ceiling, exit 0 in 7725.66s.

    TALLY Weideriche_ status=SETTLED slices=3 repairStatus=repaired repairIssues=20
      repairAccepted=14 repairResolved=14 repairFindings=135 repairChanged=2
      translateStatus=complete translateChanged=2
    DONE processed=1 of pending=1; artifacts=1/92 elapsed=7723880ms

It wrote one artifact of 412823 bytes and one page,
`fixed/people/Weideriche_/page.en.md`, of 897 bytes,
over 253 model streams.
`verify-published` then read the page back against the artifact that produced it:

    verify-published: matched=1 settledWithNoPage=0 pageWithNoArtifact=0
    Weideriche_: wordings=3 silent=0 chars=895=expected missing=0
    verify-published: 1 of 1 pages carry every wording their artifact promised, at the length it implies

`chars=895=expected` is the strong form:
the page is EXACTLY the archive plus every change the slices made,
so no text outside a slice was lost or added.

THIS RAN THROUGH A PROVIDER OUTAGE FROM START TO FINISH.
Charm Hyper was dry from the run's first second,
so five of the ten roster models never answered,
including `gemma-4-26b-a4b-it` in the editor and refiner seats it had just been given.
The entry still settled, still published, and still verified.

#### The cost, and why runs 1 and 2 could never have worked

128.7 minutes for a THREE-SLICE entry,
the sixth smallest of 92, 828 bytes of source.
That is roughly 43 minutes a slice, and it settles the earlier puzzle completely:
a 5-minute ceiling and a 15-minute ceiling were never near buying one.

TREAT 43 MINUTES AS AN UPPER BOUND RATHER THAN THE COST.
Five models were dark, so every stage ran retry rounds for lost voices
that could not be filled.
The lower bound from run 2 is 885 seconds, just under 15 minutes.
A healthy two-provider slice sits somewhere between the two,
and nothing has measured it.

THE `CAP TOO TIGHT` THRESHOLD STAYS AT ONE EXCHANGE for exactly that reason.
Two bounds that differ by a factor of three do not support a threshold,
and the one-exchange floor is the only value that is provable rather than fitted.

#### A tested edge case turned up live

The entry's cache directory holds ZERO records after settlement,
having held ten a few minutes earlier.
That is the first of the two counterintuitive cases `entry-reattempt.ts` carries a test for:
a settled entry discards its cache on the way out,
so settlement has to be an INPUT to the re-attempt verdict
rather than inferred from a count that just fell to zero.
Inferring it would have read this run as an entry that lost everything it had.

#### What is proved, and the one thing that is not

Proved live, each on its own run:

-   An entry the cap cuts is re-attempted inside one invocation against one frozen digest.
-   The re-attempt starts further along, off the cache the previous attempt bought.
-   An attempt that buys nothing stalls the entry rather than looping.
-   An entry settles, publishes, and its page verifies against its artifact.

NOT directly observed: a chain of EARNED re-attempts ending in settlement.
Run 3 settled in a single attempt because the production ceiling never cut it.
Showing the composition needs a ceiling between one slice and one entry,
which on these numbers means roughly 60 minutes:

    TRANSLATION_REPAIR_RUNS_DIR=<throwaway> TRANSLATION_REPAIR_HARD_CAP_MINUTES=60 \
      mise run //package/module/translation-repair:corpus-pass -- --only Weideriche_

Expect two or three attempts and about two and a half hours.
It was not run because Synthetic quota is restorable only sometimes,
and the composition is arithmetic over four facts each already observed.

## The settled artifacts already carry editor rounds, and they do not support the reseat

2026-08-24, found while checking whether an artifact records who was reachable.

### The premise that was wrong

`#200`'s section above says a settled artifact "exposes neither the envelopes nor
the issues an editor worked from".
That is true, and it is about the editor's INPUTS.
What it does not say, and what I had recorded elsewhere as a reason replay was impossible,
is that the OUTPUTS are absent too.
They are not.
Every repair chunk carries `rounds`,
each with the slate judges saw, each candidate's producer, and every ballot cast:

```text
stage envelope  slate [(1, Kimi-K3), (2, GLM-5.2)]
ballots [(GLM-5.2, 2), (Qwen3.8-27B, 2), (Kimi-K3, 2), (Nemotron, 2), (gpt-oss-120b, 1)]
```

That is exactly what `repair-selection-rounds.ts` projects and `producerStandings` counts.
So an editor standing can be computed over work already paid for, spending nothing.

### What the existing record says

230 rounds across 18 artifacts, fragmented over nine pipeline digests.
Pooling across digests is what `artifact-pool.ts` exists to refuse,
so each is reported alone.
EDITOR standing, by digest, largest first:

-   `b998af64`, 4 entries, 61 rounds:
    Kimi-K3 40.9%, GLM-5.2 38.9%, GLM-4.7-Flash 13.1%.
-   `2384524b`, 6 entries, 36 rounds:
    Kimi-K3 39.5%, GLM-5.2 36.5%, GLM-4.7-Flash 19.6%.
-   `6b21df94`, 1 entry, 33 rounds:
    Kimi-K3 50.3%, GLM-5.2 41.0%, GLM-4.7-Flash 11.4%.
-   `3850dc98`, 2 entries, 31 rounds:
    GLM-5.2 47.0%, Kimi-K3 33.7%, GLM-4.7-Flash 16.6%.
-   `266fca75`, 1 entry, 11 rounds:
    GLM-5.2 39.3%, GLM-4.7-Flash 25.4%, Kimi-K3 24.6%.
-   `851f8020`, 1 entry, 5 rounds:
    Kimi-K3 60.9%, GLM-5.2 25.0%, GLM-4.7-Flash 8.0%.

### The reading

GLM-4.7-Flash is last on five of six digests and never above 25.4%.
That is consistent and it is the one thing here worth calling a result.

KIMI-K3 AND GLM-5.2 ARE NOT SEPARABLE BY THIS RECORD.
They alternate first place across digests,
which is what noise looks like,
and no digest carries enough independent entries to say otherwise.

THAT IS THE POINT, because on 2026-08-24 GLM-5.2 was removed from both writing seats
on the strength of the 40-round producer calibration,
which measures WRITING.
`#200` exists because editing is a different job.
The editing record already on disk does not show GLM-5.2 as a weaker editor than the model that kept the seat.
It does not show it as stronger either.
It shows the reseat was made on evidence that does not speak to this seat,
and that the seat is still unmeasured.

Its replacement, Qwen3.8-27B, appears in one digest only,
`f24b27e5`, one entry, 8 rounds, 60.0% of 35 disinterested ballots.
Too thin to read as anything.

### What this record cannot do

-   IT IS OBSERVATIONAL. Only seated models ever wrote a candidate,
    so it ranks the three that held the seat and is silent about the other seven.
    `gemma-4-26b-a4b-it`, seated on 08-24, has never written an editor candidate at all.
-   ROUNDS INSIDE ONE ENTRY ARE CORRELATED.
    Entry counts are 1 to 6, so the effective sample is far smaller than the round counts.
-   JUDGES VARIED between runs, and nothing here holds them fixed.

So it corroborates and it cross-checks; it does not replace the controlled calibration.
It raises the value of finishing `#200`, and it lowers the confidence in the current seating.

## Zero editor rounds does not mean nothing was repaired (`#200`)

2026-08-24, found by watching the partial calibration rather than by reading code.

### What the log showed

Slice 2 of the run, `coin` chunk 3:

```text
panel stage: 5/10 heard, 7 issues
[selectChunkPatch] every proposal was identical; shipping composite(...)
editor stage: 1 applied, 0 rejected across 1 distinct candidates
chunk 3: repaired, 1/1 served accepted issues resolved (1 accepted, 0 unenveloped)
  slice 2 of 14 (coin chunk 3): 0 editor rounds, 0 refiner rounds
```

The slice REPAIRED and the standing counted nothing.

### Why

`selectChunkPatch` ships outright when every editor proposes the same text.
There is nothing to choose between,
so no ballot is cast and no judged round is recorded.
A standing counts rounds,
so a slice decided by consensus is invisible to it.

THIS CORRECTS THE `#200` NOTE ABOVE.
That note said zero rounds meant no issue was ACCEPTED,
which was true of the one slice it was written from
and is not true in general.
Zero rounds has two causes and they are opposite:
nothing was accepted, or everything agreed.

### What it changes about the measurement

-   A model whose text the rest of the ensemble reproduces word for word
    wins nothing and appears nowhere.
    The old `WROTE NOTHING` line would have named it beside a model
    whose provider was out of budget, which are opposite facts.
-   The blind spot is not rare.
    It fired on slice 2 of 14,
    on a slice that had seven adjudicated issues to work from.
-   Convergence is plausibly MORE likely on the halved roster this run had,
    since five models leave fewer distinct proposals than ten,
    so the partial run understates rounds for a second reason.

### What landed, in `4fdb9391c`

Each slice now carries the authorship of what shipped,
and the report says how many slices shipped with no editor round judged.
Kept apart from the standing and labelled,
because nobody preferred that text to anything:
shipping by consensus is not winning a vote,
and the two must never be divided by each other.

The silent line now reads `NO JUDGED CANDIDATE`
and points at the shipped lines to separate the two causes.

### Consequence for the running measurement

The partial run in flight was launched before this landed,
so its report will carry the old wording and no shipped lines.
Read its zero-round slices against this section,
and treat the full-roster re-run as the one that reports both.

## How many slices an editor calibration needs, measured from production

2026-08-24. Read off the archive, spending nothing.

### The rate

Across every settled artifact carrying rounds,
109 repair chunks,
counting `envelope` and `chunk-patch` rounds only:

-   55 of 109 chunks, half of them, produced any editor round at all.
-   1.76 editor rounds per chunk overall.
-   3.49 per chunk that produced any.

Per digest, chunks / contributing / rounds:

-   `19244`: 32 / 2 (6%) / 4.
    The outlier, and it is `xiept2-anchorfix`:
    most of its chunks changed nothing.
-   `b998a`: 21 / 17 (81%) / 61.
-   `23845`: 18 / 11 (61%) / 36.
-   `3850d`: 16 / 11 (69%) / 31.
-   `6b21d`: 10 / 7 (70%) / 33.
-   The four smallest run 50% to 67%, 1.25 to 3.67 rounds per chunk.

### What it means for sizing a run

HALF OF EVERY SLICE BOUGHT CONTRIBUTES NOTHING TO AN EDITOR STANDING,
and that is normal rather than a fault:
a chunk carrying no accepted issue never asks an editor to write,
and a chunk where every editor agreed ships without a ballot.
Both are paid for in full.

At production's rate,
14 slices should yield around 25 editor rounds.
To reach the 61-round pool that is the largest thing on disk,
a run wants closer to 35 or 40.
That is the number to use for the full-roster re-run,
not the default of six.

### What it does NOT establish

The partial run in flight is at 4 slices,
1 of them contributing, 2 editor rounds.
That is a lower rate than production,
but 25% against 50% on four slices is inside the noise,
and production's own per-digest spread runs 6% to 81%,
which is wider than the gap.
NOTHING HERE SAYS THE HALVED ROSTER YIELDS LESS.
It is a plausible mechanism, since five models leave fewer distinct proposals
than ten and consensus ships without a round,
and it is not measured.
The full-roster run is what would measure it.

### The efficiency this does establish

A settled entry of ten chunks leaves about eighteen editor rounds on disk,
for nothing, as a side effect of work already bought.
`editor-standing-read` reads them.
It ranks only the three models that held the seat,
so it cannot replace a calibration that seats ten,
but any release pass now pays for an observational standing as a by-product.

## The 14-slice editor calibration finished, and it settles no seat (`#200`)

Ran 2026-08-24 into `~/temp/agent/editor-calibrate-synthetic-2026-08-24`,
finished in 9496 seconds, exit 0.

### What it measured

29 judged editor rounds, from 10 of 14 slices, across 492 disinterested ballots.

    hf:Qwen/Qwen3.8-27B                  34.7%  (34 of 98)
    hf:moonshotai/Kimi-K3                27.9%  (29 of 104)
    hf:zai-org/GLM-5.2                   25.0%  (23 of 92)
    hf:nvidia/NVIDIA-Nemotron-3-Super    15.5%  (15 of 97)
    hf:openai/gpt-oss-120b                7.9%  (8 of 101)

The refiner seat produced zero rounds,
because the binary that ran predates the fix that made the runner drive the naturalness lane at all.
That fix is in source and will take effect on the next run.

### Why it settles nothing

FIVE MODELS, NOT TEN. Charm Hyper held a zero balance for the whole run,
confirmed live against `GET /v1/credits` before, during and after,
so `qwen3.8-max`, `minimax-m3`, `gemma-4-26b-a4b-it`,
`deepseek-v4-pro-0813` and `deepseek-v4-flash-0731` wrote nothing.
`gemma-4-26b-a4b-it` currently HOLDS an editor seat,
so the run is silent about one of the three incumbents it was meant to test.

AND THE FIVE IT DID MEASURE DO NOT SEPARATE.
Against the pooled null of 22.15 percent,
`hf:Qwen/Qwen3.8-27B` reaches z 2.99 and `hf:openai/gpt-oss-120b` z -3.44,
both past the Bonferroni threshold of 2.58 for five comparisons.
But those 29 rounds come from 10 slices, 2.9 rounds per slice,
and rounds inside one slice are correlated.
Charging the worst case, that all rounds within a slice are one observation,
divides every z by sqrt(2.9) and NOTHING clears:
Qwen falls to 1.76 and gpt-oss to 2.02.

The truth is between those two readings and this run cannot say where.
No seat changes on it.

### What it is good for

It is directionally consistent with the writer calibration of the same day,
where `hf:Qwen/Qwen3.8-27B` also led and `hf:zai-org/GLM-5.2` sat below the null.
It also confirms the instrument works end to end on a real repair lane:
critics, panel, editors, judges and checkers all ran,
and 10 of 14 slices carried an accepted issue, which is the yield the sizing note predicted.

### What is still owed

A full-roster run, once Charm Hyper has credit.
The owner cannot reset that provider on demand,
so this waits on the provider's own schedule rather than on anything askable.
Sizing from production yield says 35 to 40 slices, not 14.

## Five sections aged out into the history (2026-08-25)

Moved verbatim into `doc/handover/translation-repair-history.md` when this file reached its cap,
because each is closed work whose conclusion is already encoded in the code:

-   The writer calibration's coverage report, verified live.
-   The settled artifact speaks one vocabulary, as generation 3 (`#94`).
-   The stamped index is `sliceIndex`, as generation 4 (`#204`).
-   The read-any-generation dispatch never learned generation 3 (`#206`).
-   The 53 indirectly-reached modules, branch by branch (`#209`).

## What the suite actually reaches, measured (2026-08-24)

Run after `#204` closed, to answer the package-completeness rule with a number instead of a feeling.

Over all 507 source modules of the package:

-   386 are DIRECTLY exercised: they have a sibling `.unit.test.ts`,
    or one of their exports is named somewhere in the suite.
-   53 are reached only through an exercised importer.
-   40 are reached by NOTHING.

Of those 40, 37 are `corpus-run/` operator CLIs and probes.
Each ends in a top-level entry call and is exercised by being run,
which is a different kind of evidence and not one the suite can give.

The other three were the finding:

-   `repair-blocked-exit.ts`, dead since `#110`, deleted as `#207`.
-   `producer-standing-report.ts`, live but reachable only through calibration CLIs no test drives.
    It renders the share of disinterested ballots each model won,
    which is what `#199` seated the writers on.
    Covered now, and the ordering rule is GFP-proven:
    treating an UNJUDGED model as a zero share fails the case,
    because a model with no evidence and a model measured at zero are different findings.
-   `coverage-candidates.ts`, same shape.
    Covered now at both scales, and GFP-proven:
    dropping the block scale from the list fails the case.

### Two other layers, while looking

ZERO real TODO, FIXME, HACK or deprecation markers in the package.
The two apparent hits are a `U+XXXX` doc example
and a case-insensitive match inside the identifier `toDocumentNode`.

66 lint suppressions, of which ZERO are bare:
every one carries a ` -- ` justification, which is what `LN5` asks for.

## Charm Hyper got credit, the full roster is running, and a run's cost is now measured (2026-08-25)

The owner bought 10,000 hypercredits.
`budget-sample` confirmed it live before anything was launched:

```text
METERS synthetic=wet hyper=wet syntheticWeekly=97.09290877272727%
syntheticFiveHour=2750/2750 syntheticThrottled=no hyperBalance=10000
```

Both providers wet at once,
which is the window `#200` had been waiting for since the 14-slice run of 2026-08-24 settled no seat.

### The run in flight

Launched 2026-08-25T01:30Z, detached, 40 slices, every seat filled by the whole ten-model roster.

```text
TRANSLATION_REPAIR_RUNS_DIR=~/temp/agent/editor-calibrate-fullroster-20260825 \
  mise run //package/module/translation-repair:editor-calibrate -- 40
```

Log at `~/temp/agent/editor-calibrate-fullroster-20260825.log`,
pid beside it in the `.pid` file.

ALL TEN SEATS ARE ANSWERING, which is the whole reason this run exists.
The five Hyper-only ones wrote nothing last time.
`gemma-4-26b-a4b-it` in particular HOLDS an editor seat and had never been tested.

DO NOT REBUILD `dist/` WHILE IT RUNS.
The run stamps its cache with the runner's own dependency closure,
so a source change plus any restart invalidates every cached slice and re-buys the whole run.
Documentation is outside that closure and safe to edit.

### What a slice actually costs in wall time, and a revision that should not have happened

Measured over the first six slices:

```text
slice 1  lintong chunk 0        214 s   0 editor  0 refiner
slice 2  windward0032 chunk 14 1362 s   5 editor  0 refiner
slice 3  Huasheng chunk 16       503 s   2 editor  0 refiner
slice 4  Mio chunk 10           1083 s   2 editor  1 refiner
slice 5  lintong chunk 4         967 s   2 editor  1 refiner
slice 6  zheermao101 chunk 2      16 s   0 editor  0 refiner

real slices   4, mean  979 s
cheap slices  2, mean  115 s
real share   67 percent
```

Projected total 7.7 hours, which is the figure first estimated from roster-round arithmetic.

A REVISION WAS MADE ON ONE SAMPLE AND WAS WRONG.
After slice 2 alone, at 1362 s, the projection was moved from 8 hours to 12
and the earlier number was declared superseded.
Slice 2 turned out to be the slowest of the four real slices measured,
which span 503 to 1362 s, a 2.7-fold spread.
The mean is 979 s and the original estimate was right.

THIS IS EXACTLY WHAT `QNB` FORBIDS:
measure the run-to-run band before crediting a difference smaller than it.
The rule was quoted in the same session it was broken in.
One slice could not distinguish a real slowdown from the top of an ordinary spread,
and no projection should have moved until it could.

### The refiner lane fires, and the two empty slices were not a signal

Slices 1 through 3 each reported `0 refiner rounds (nothing eligible to rewrite)`,
which looked like the refiner standing was going to come back empty for the second run running.

MEASURED INSTEAD OF WAITED.
Across 74 real shipped slices from four archived runs,
mirroring the bounds in `refine-eligibility.ts`:

```text
paragraphs                 156
  markup or non-prose       41
  hard break                 2
  under 120 chars           78
  over 1200 chars            1
  ELIGIBLE                  34

slices carrying at least one eligible paragraph: 32 of 74 (43%)
```

Three empty slices in a row has probability near 19 percent.
Unremarkable.
Slice 4 then produced a refiner round, which is the first this workstream has ever seen:
the earlier run's binary predated the fix that drives the lane at all.

### What the run costs in credits, and the correction that came with measuring it

The first estimate, computed from assumed tokens per call, was 500 to 1,500 credits for a 40-slice run.
THAT WAS HIGH BY ROUGHLY A FACTOR OF FOUR.

Measured from the run's own `reportStreamProgress` lines,
which carry content and reasoning characters per call:

```text
model                     calls   content   thinking  out-tokens  credits
qwen3.8-max                   9         0    125,612      31,403     3.77
minimax-m3                   10     6,409     98,961      26,343     0.69
deepseek-v4-pro-0813         10     4,512          0       1,128     0.10
deepseek-v4-flash-0731       10     4,214      4,066       2,070     0.05
gemma-4-26b-a4b-it           10     3,986          0         997     0.01
```

Scaled to 40 slices the output side is about 120 credits,
and adding an input side priced two to three times lower puts the whole run near 250.
So 10,000 credits buys on the order of 35 runs of this size, not 6 to 20.

THINKING DOMINATES THE BILL.
`qwen3.8-max` and `hf:zai-org/GLM-5.2` each emitted over 118,000 characters of reasoning
against a few thousand of answer,
and `completion_tokens` counts thinking.
Any cost model built on answer length underreads by most of the bill.

### Nothing we have ever run recorded its token spend (`#210`)

The estimate above had to be computed rather than read,
because token counts are not in any log this project holds.

`formatUsageNote` in `model-content.ts` reads `prompt_tokens` and `completion_tokens`
off the provider's own usage block
and appends them to an `rl.debug` line in both clients.
Every archived run logged at info,
so a grep for `[0-9]+\+[0-9]+ tokens` across every log in `~/temp/agent` returns ZERO matches.

It did not matter while Synthetic was the only provider:
a flat subscription either fits the weekly allowance or it does not,
and the `METERS` line already carries that percentage.
Charm Hyper is metered per token at rates differing by two orders of magnitude across one roster,
so cost depends on which seats answered and by how much.

`spend-line.ts` and `corpus-run/spend-read.ts` close it.
One `SPEND provider=<name> model=<id> prompt=<n> completion=<n>` line per exchange at info,
shaped like the `METERS` line so a reader splits rather than matches,
and a reader that totals a log per provider-and-model seat.

A provider that reports no usage still gets a line carrying `unreported` in both counts.
A run whose provider stayed quiet and a run that spent nothing total the same,
and only the named absence tells them apart.

### Two defects that only writing the consumer could find

Both were in code already reported as verified,
and neither was reachable from the writer's own tests.

THE MARKER CARRIED A LEADING SPACE, copied from `METERS_MARKER`.
That one only ever meets lines carrying a logger prefix, so it can demand the space.
This one also meets the bare line the writer RETURNS,
so `readSpendLine(reportSpend(...))` read as prose and answered `not-a-record`.
The marker is now `'SPEND '`
and the reader accepts it at start-of-line or after a space.

THE FIELD TABLE WAS A PLAIN OBJECT,
so a log line writing `__proto__=` would have reached the prototype.
Keys come off a log line; it is a `Map` now.

This is the same lesson as the `#209` method note from one day earlier,
arriving from the other direction:
there, mutating a module found arms nothing defended;
here, writing the consumer found what the producer's tests could not reach.

### `qwen3.8-max` books all of its output as thinking (`#211`)

Measured on the live run:
`qwen3.8-max` reports 0 content characters on every single call,
13 of 13, against 204,258 reasoning characters.
Other seats do this occasionally,
`hf:zai-org/GLM-5.2` on 3 of 10 and two others on 1 of 10.
Thirteen of thirteen is categorical.

THE VOICE STILL LANDS.
The same model casts ballots with full reasons,
so the answer arrives and is used.
What is wrong is the accounting.

THE OBVIOUS EXPLANATION IS ALREADY REFUTED, recorded so it is not re-walked.
Charm Hyper speaks the Anthropic protocol,
and forced tool use would deliver an answer as `input_json_delta` fragments.
`anthropic-delta-scan.ts` maps that delta to `content` and its own comment names this exact failure mode:

```text
`input_json_delta` IS THE ANSWER CHANNEL ... Routing them to `reasoning`
would leave every schema'd call looking like a model that thought at length
and answered nothing.
```

So the mapping is right and something else produces the symptom.
Settling it needs a captured frame from a live call,
which waits until the run releases the provider.

Not urgent: nothing is broken and no quota is wasted.
But a reader of any run log would conclude the most expensive seat on the roster produced nothing,
and the `SPEND` line sidesteps it entirely,
since `completion_tokens` comes from the provider and is channel-agnostic.

### A run's cost is now attributable per seat, and the run in flight will never be (2026-08-25)

`#210` grew its second half while the calibration held the main worktree.
The writer and reader were already built;
what was missing was the thing that turns token counts into money.

#### The price table is an observation with a date on it

`package/module/translation-repair/src/corpus-run/hyper-price.ts` carries all
twenty-six models Charm Hyper lists,
with input, output, cache-create and cache-hit rates in credits per million tokens.
The operator read them off the provider's model page on 2026-08-25,
and `HYPER_PRICE_READ_ON` ships beside the rates so every report prints how old its figures are.

The numbers were not transcribed by hand.
A parser read the pasted page with strict structural checks,
refusing any row whose label order or rate format did not match,
and emitted the table.
Transcribing a hundred and four figures by eye is exactly where a silent error would live.

#### The two cache columns are unreachable, which makes the input half exact

Nothing in `package/module/translation-repair/src` sends `cache_control`,
which is one grep to confirm.
On the Anthropic protocol Hyper speaks,
that means there are no cache-creation and no cache-read tokens,
and every prompt token bills at the plain input rate.
So the input half is exact rather than an upper bound.
The rates are carried anyway,
so whoever turns caching on finds them recorded and can see what the saving is worth.

#### Synthetic is never priced, and that is a correctness rule

`priceTally` splits seats into three buckets:
metered and priced, metered with no row in the table, and flat-subscription.
Only the first gets a credit figure.
Folding the second into the total at zero would report a cheaper run rather than an incomplete one,
and converting the third would invent a currency that provider does not bill in.
The report names all three separately.

#### What the report says, and the two controls it was checked with

```sh
mise run //package/module/translation-repair:spend-report -- <log> [<log> ...]
```

Positive control, on a throwaway fixture carrying every case at once:
priced seats sorted by cost with their share of the bill,
one unpriced metered seat named rather than zeroed,
one subscription seat carried with tokens and no credits,
one call that reported no usage counted as a floor,
one prose line mentioning the marker correctly not counted,
and one truncated record counted as unreadable.
The arithmetic checks by hand:
`qwen3.8-max` at 84000 prompt and 51065 completion tokens comes to 3.36 plus 6.13, or 9.49 credits.

Negative control, on the live calibration log:
`NOTHING RECORDED`,
which is the honest answer and not a zero total.

#### The run in flight will never have a cost breakdown

The calibration started before `spend-line.ts` existed,
and the running build is the one it started with.
Its log carries no `SPEND` line and never will.
Rebuilding `dist/` mid-run would invalidate every cached slice and re-buy the whole run,
so this is not a thing to fix.
It is the last run this project will make that cannot say what it cost.

What the meter does give is the total.
The balance opened at exactly 10000 and read 9909 after nine slices:
about ten credits per slice,
so a forty-slice run lands near four hundred credits and a ten-thousand balance buys roughly
twenty-five of them.
That corrects the earlier per-slice figure of 8.33,
which came from a smaller sample.
The total is all the meter can say.
Which seat spent it is what the `SPEND` lines add.

#### Proven by removal

Three mutations, each caught by the file that owns the guard and by no other:

- Dropping the `glm-5.2` row from the price table:
   caught by the catalog-join case,
  which asserts every model `hyper-catalog.ts` can seat has a row.
- Making `priceTally` inherit the tally's token order instead of sorting by cost:
   caught by an ordering case built so the two disagree,
  where the seat with ten times the tokens is a quarter of the bill.
- Looking rates up on the object literal instead of the `Map`:
   caught by the `__proto__` case.

Full suite after: 659 suites, zero failures, zero lint warnings.

#### Still parked, not landed

Everything lives in `~/temp/agent/spend-telemetry-210.tar.gz`,
fourteen files with repo-relative paths, untarred over the repo root to apply.
It cannot be committed from the isolated worktree,
which lacks the forbidden-strings scanner and is refused by the `branch-worktree-only` policy.
It must land after the calibration finishes,
and after any second calibration batch,
because pooling needs no drift opt-in only while the build is unchanged.

### `#211` diagnosed from logs and source, without spending a call (2026-08-25)

The earlier note recorded this as needing a captured frame from a live call,
and put the count at 13.
Both were wrong.
The count is about seventy calls,
and most of the diagnosis was reachable by reading.

#### The premise, remeasured

Across the calibration's first nine slices,
`qwen3.8-max` opened seventy-one streams and reported zero content characters on seventy of them,
while casting seventy-one ballots with full prose reasons.

#### There are two independent parsers, and only one of them is blind

`anthropic-completion.ts` imports `json-guard.ts` and `completion-shape.ts` and nothing else.
It never touches `anthropic-delta-scan.ts`.
So the thing that extracts the answer and the thing that counts characters for the progress line
read the same bytes through different code.
The vote landing while the count reads zero is the two disagreeing,
not the model failing.

#### The mechanism, from `channelFor` in `anthropic-delta-scan.ts`

Block type outranks delta type:

```ts
if (blockType === THINKING_BLOCK)
  return 'reasoning';
return DELTA_CHANNELS[deltaType] ?? UNREAD;
```

Its own comment says why that precedence exists:
providers have been seen sending plain text deltas inside a thinking block,
and reading only the delta type would file that as the answer.
The rule is right for the model it was written for.
If `qwen3.8-max` declares a thinking block and sends its answer deltas inside it,
the same rule files its entire reply as reasoning,
while the extractor, which reads only `delta.type` and ignores blocks, still recovers the answer.

`qwen3.8-max` is also the only model on the roster configured `toolChoice: 'auto'`;
every other Hyper seat is `forced`.
`hyper-catalog.ts` records that it answers HTTP 400 to every forced-tool variant tried.

#### What separates this from the ordinary case

For every other model, the zero-content count equals the cut count exactly:
`hf:zai-org/GLM-5.2` five and five,
`hf:Qwen/Qwen3.8-27B` two and two.
Those are streams that ended before any content arrived, which is expected.

`qwen3.8-max` reports seventy zero-content streams against twelve cuts.
Fifty-eight of them completed cleanly and still counted nothing.
Cutting cannot explain that, and no other model shows the pattern.

`deepseek-v4-pro-0813` shows a smaller separate anomaly,
eight zero-content streams with no cuts at all,
recorded here so it is not folded into this one.

#### This is not cosmetic: the runaway guard is blind to this model

`stream-runaway-watch.ts` applies `CONTENT_OVERRUN_CAP` to the content channel only,
and its comment states the reasoning channel is deliberately untouched.
If this model's output is filed as reasoning, the volume bound never sees it,
so nothing stops it early and it runs to the straggler deadline instead.

The cut rates match that prediction.
`qwen3.8-max` is cut on twelve of seventy-one streams, near seventeen percent,
the highest on the roster by a factor of two and a half.
`hf:zai-org/GLM-5.2` is next at five of seventy-two.
Six of the eleven seats are cut zero times.
Each cut is a lost voice on a panel that was paid for.

#### What is still owed

One thing, and it is now a single cheap check rather than an investigation:
capture one `qwen3.8-max` stream and confirm it declares a thinking block
whose deltas carry the answer.
If it does, the fix is at `channelFor`, not at the model,
and the candidate shape is to keep the block-type override only for delta types
that are not themselves answer channels.
Do not change it before the frame is seen:
the override exists because a real provider needed it,
and removing it blind would restore the defect it was added for.

### Authorization to drop weak models, and why the worst-looking seat is not one (2026-08-25)

The owner granted authorization to drop models that are exceptionally bad.
Recorded here with the guard that has to travel with it.

#### The instrument now names drop candidates, and warns about one confound

`~/temp/agent/standing-stats.mjs` previously reported a seat as `SETTLED` on the
absolute value of its z score, which puts a seat far above the pooled null and
one far below it under the same word.
It now splits by direction:
`CARRIES ITS SEAT` above, `DROP CANDIDATE` below,
each still requiring both the per-round and the per-slice reading to clear the
Bonferroni threshold for the actual number of comparisons.

It also prints a standing warning to check a seat's cut rate before dropping it.
A seat whose voice is lost scores low for a reason that is not its judgement.

#### Its control is now a real log rather than pasted figures

The analyser learned the second header shape that `producer-calibrate` prints,
so the prior forty-round producer run reads directly.
That run is now the positive control:
pooled null 13.48% over 336 of 2492 ballots,
ten comparisons, Bonferroni threshold 2.807.

#### The evidence says drop nothing today, and says it twice

`hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4` sits at 3.0%, z of -4.99,
which clears the threshold by a wide margin in the negative direction.
Its cut rate in the run now in flight is zero of seventy-eight,
so the score is not voice loss.
That is genuine weakness, and it is already acted on:
the writer seats were settled at three from this same run,
and a model at 3.0% was never among them.
Nothing to drop.

`qwen3.8-max` is the opposite case and the important one.
It is the BEST producer on the roster at 27.0%, z of +5.22,
and it carries the worst cut rate on the roster, twelve of seventy-eight.
It earns the top score while losing twelve voices to the defect in `#211`.

So the seat that looks worst by cut rate is the strongest seat by judgement,
and dropping on the cut rate alone would have removed it.
That is exactly the confound the warning exists for.

#### What this changes about `#211`

It stops being an accounting curiosity.
The scanner mis-files this model's output, the volume bound therefore cannot see it,
it runs to the straggler deadline, and the pipeline loses a sixth of the voices
of its highest-scoring producer.
Fixing it does not tidy a log line, it recovers the best seat's lost ballots.

#### What the authorization is waiting on

The editor standing, which the run in flight is measuring and which is not the
producer standing.
`#136` already recorded a model that is worst at one stage and better than two
peers at another, so a producer table cannot seat or unseat an editor.
When the run lands, the analyser names candidates and the cut rates say which of
them are real.

## The pipeline now keeps what each model wrote (`#212`, 2026-08-25)

### The gap, found by hitting it

Asked to confirm or reject that one seat was weak for this job,
the honest answer available from the archive was that nothing could answer it.
No run this project has ever made kept a single line any model produced.

The producer standing says a seat was preferred on 3.0% of disinterested ballots.
It cannot say whether that seat wrote something WRONG
or merely something nobody picked as the single best of ten.
Those are different findings with different remedies.
Every archived artifact predates model attribution,
neither calibration writes candidates to its run directory,
and the log names only the WINNING candidate's author,
so a losing candidate cannot be joined to the model that wrote it.

Re-deriving the evidence meant buying fresh calls for something a finished run had already paid for.

### What now records it

`candidate-ledger.ts` writes one JSON file per judged contest into
`${TRANSLATION_REPAIR_RUNS_DIR}/ledger/`,
holding every candidate's exact rendered text, every model behind it with composites expanded,
every ballot with its reason verbatim, and the winning position or that the round declined.

ONE HOOK COVERS EVERY CONTEST.
The translate lane, both editor paths, the refiner and the fidelity judge all route through
`selectBestCandidate`, so nothing has to be remembered per caller.

### Two shapes this had to take, and why

A WRAPPER, NOT A HOOK IN THE CASCADE.
The deciding function leaves by six returns, five of them declines.
Threading a write through each would be five chances to miss the sixth.
`candidate-select.ts` now exports `decideBestCandidate` with its logic untouched,
and `candidate-select-record.ts` wraps it.
The wrapper lives in its own module because `candidate-select.ts` sits at 269 of its 300 permitted
code lines and restating the request type there would breach the cap;
`Parameters<typeof ...>` borrows the signature instead of copying it.

IT NEVER RAISES INTO THE SELECTION PATH.
A pipeline that failed a slice because its telemetry could not write would be worse than one with
no telemetry, so every failure is caught, named and swallowed.
The test for that matters more than the success cases:
it points the run directory at a path where a FILE sits where the directory belongs,
and asserts the caller is undisturbed.

WITH NO RUN DIRECTORY NAMED, NOTHING IS WRITTEN.
That is the ordinary path for every unit run and every probe, not an edge case.

### What it holds, and where it must not go

Candidate text is a rendering of a corpus passage,
so the ledger holds unlicensed corpus wording exactly as the settled artifacts already do.
It lands under the run directory, outside this repository, and must never be committed.

### The current run gets none of this

The calibration in flight started on a build that predates the ledger,
and rebuilding `dist/` mid-run would invalidate every cached slice and re-buy the whole run.
So the roster question that prompted this stays unanswerable from the archive,
and the next run answers it without a single extra call.

## The ledger has a reader, and writing it found a real gap (`#212`, 2026-08-25)

Written for the same reason the spend reader was:
`#210`'s writer looked finished until its reader was built,
and building the reader found two real defects in the writer.
A writer with no reader has never been checked against anything.

### The join is the whole point

A ballot names a POSITION, not a model.
Nothing before this could say which model a judge was talking about
when it explained why it did not pick something,
which is exactly the evidence a roster question needs.
`candidates[best - 1].producers` in `src/corpus-run/ledger-read.ts` is that join,
one-based because the slate the judges saw was.

`summariseLedger` returns per-seat counts:
candidates written (composites credit both authors),
contests won,
votes from judges with no stake,
the denominator of ballots those judges could cast,
and self-votes counted apart.
`workOfModel` returns one seat's candidate text beside every disinterested judge's verbatim reason.

Two ballot faults are counted separately and neither is dropped:
an abstention names nothing,
and a ballot naming a position the slate does not hold is a fault in the judge.
Folding them together would report one count of two where a contest had one of each.

### The parser refuses rather than filling in

`src/corpus-run/ledger-parse.ts` turns a file into a shape the reader can trust,
raising `LedgerShapeError` on anything else.
A truncated file quietly read as a contest with no ballots
would report a seat as unjudged when the record was simply lost.

Model ids are read as plain strings, deliberately, not as the catalog union the writer held.
A ledger is read to ask questions ABOUT the roster,
including about a seat since dropped,
so narrowing a recorded id back into today's catalog would be a claim the reader cannot support.

`weight` and `selfVote` are not read at all.
The reader works out who had a stake from the producer lists,
because it needs that for EVERY candidate and `selfVote` speaks only about the one its ballot named.
Reading it as a cross-check would prove nothing either:
`candidate-select.ts` and `candidate-ledger.ts` both derive their answer
from `producerModelIds` on the same producer in one process,
so the two can never disagree.
That was checked before being skipped.

### GFP found a gap the first twenty cases missed

Five mutations, and the first one survived:
changing the join to `candidates[best]` left every test green.
Every ballot naming a middle position resolves under either indexing,
and so does a ballot past the end;
only a ballot naming the LAST candidate on a slate tells the two apart,
and no case named one.

The added case reads the declined contest,
which holds exactly one candidate whose only judge names it.
All five mutations are red now:
the join off-by-one,
ignoring stake in the denominator,
folding the two ballot faults together,
keeping an author's remark about its own work,
and tolerating an absent array in the parser.

### Verified at the boundary, in three states

The production writer wrote a real ledger into a throwaway run directory,
and the CLI read it back:

-   A real ledger prints the per-seat summary,
    and `--model <id>` prints that seat's text with the judges' verbatim reasons.
    Every number was checked by hand against the fixture.
-   An absent ledger (`ENOENT`) prints `NOTHING RECORDED` and exits non-zero.
-   An unreadable ledger (`EACCES`) now RAISES instead of reporting an empty run.

That last one was a real defect found by running the control.
Any `readdir` failure previously read as "this run recorded nothing",
so a permissions problem would have been reported as an answered roster question.
The refusal names the filesystem code rather than the message,
because a code carries no path and a run directory path can name a person.

The task is `mise run //package/module/translation-repair:ledger-report`,
with the run directory taken from `TRANSLATION_REPAIR_RUNS_DIR`
through the same `resolveRunsDir` every other reader in this family uses.

### State

Built, lint clean, types clean, 663 suites passing, zero failures.
Parked in `~/temp/agent/spend-telemetry-210.tar.gz` with the `#210` spend work,
thirty-one files, repo-relative paths, untarred over the repo root to apply.

## `#211` is proved at the wire, and the fix is in (2026-08-25)

One call to `qwen3.8-max` on Charm Hyper, shaped exactly like a production ballot request,
with the untouched SSE bytes kept at `~/temp/agent/capture-211.sse`.
HTTP 200, 17612 raw characters, 128 frames.

### What the provider actually sends

The diagnosis guessed the model declares a thinking block carrying its answer deltas.
The wire is narrower and stranger than that:

```text
content_block_start  index 0  {"type":"thinking"}
  ... 106 thinking_delta frames ...
content_block_stop   index 0
content_block_start  index 1  {"type":"tool_use","name":"candidate_ballot"}
content_block_start  index 1  {"type":"thinking"}          <- SAME INDEX, no stop between
  ... thinking_delta and input_json_delta interleaved, 17 of the latter ...
```

The provider opens index 1 as a tool call and then opens THE SAME INDEX again as thinking.
`openBlock` in `anthropic-delta-scan.ts` sets the block map unconditionally,
so the later declaration wins,
and `channelFor` then files every index 1 delta as reasoning,
including the `input_json_delta` frames carrying `{"best": 2 ...`, which is the ballot.

That is the whole of the 70-zero-content-against-71-ballots signature.
The extractor in `anthropic-completion.ts` ignores blocks,
so it recovers the answer and the vote lands;
only the scanner that feeds the progress line and the runaway guard is fooled.

### The fix, and why this shape rather than the other one

`ANSWER_DELTAS` in `anthropic-delta-scan.ts` now exempts `input_json_delta`
from the thinking-block override.
A tool-call argument fragment cannot be deliberation:
it is the structured answer by construction, filling a schema this pipeline sent.
`text_delta` is deliberately NOT exempt,
so the case the override was added for, plain text deltas inside a thinking block,
still routes to reasoning.

The alternative was to keep the FIRST declaration in the block map.
That also routes this capture correctly,
but only because `tool_use` happened to arrive first.
The chosen shape holds whichever order the two declarations come in.

GFP-proven: removing the carve-out turns the new case red, restoring it turns it green.
The test fixture is the captured frame order, duplicate `content_block_start` included.

### Measured on the captured bytes, before against after

The same 17612 characters replayed through the same scanner, the carve-out being the only difference:

-   Without it: `content 0 chars, reasoning 1488 chars, unreadable 0`.
-   With it: `content 218 chars, reasoning 1270 chars, unreadable 0`.

The before state reproduces the production symptom exactly,
which is the zero content chars the log reports for 98 of this seat's 100 calls.
The 218 characters that move are the ballot,
and 218 plus 1270 equals 1488, so nothing was invented or dropped: it was only filed under the wrong heading.

### What it should buy on the next run

`stream-runaway-watch.ts` bounds the content channel and leaves reasoning alone,
so an answer filed as reasoning escaped the volume cap and ran to the straggler deadline.
`qwen3.8-max` was cut 12 times in 71, the highest on the roster by two and a half times.
The prediction is that its cut rate falls toward the roster's.
NOT YET MEASURED: the run in flight predates the fix.

### State

Parked with `#210` and `#212` in `~/temp/agent/spend-telemetry-210.tar.gz`, now thirty-three files.
Lint clean, types clean, 663 suites passing, zero failures.

## No volume guard can see `qwen3.8-max`, and stragglers may cost more than serialization (2026-08-25)

Measured on the live full-roster calibration at 15 of 40 slices, from the run log alone.
Full working in `doc/audit/every-volume-guard-is-blind-to-one-model.md`, committed as `d16a616e3`.
This run predates the parked `#211` fix, so every number here is a clean pre-fix baseline.

### The measurement

Every seat was asked exactly 120 times, so the denominators need no adjustment.
Seven of the ten lose no voice at all.
The 34 losses are `qwen3.8-max` 21, `hf:zai-org/GLM-5.2` 11, `hf:Qwen/Qwen3.8-27B` 2.

`qwen3.8-max` reports content characters of 0 at the median AND at the 95th percentile,
across all 100 of its completed streams.
Not one byte it sent reached the content channel.
Every other seat medians between 303 and 619.
That is `#211` confirmed at production scale, where it had been proved on one captured frame run.

### Why that is worse than a telemetry error

`src/stream-runaway-watch.ts` applies its volume cap to the content channel only,
and its module note says the reasoning channel is untouched.
`#156` set that bound at 32000 and declined a reasoning bound deliberately.
So for this one seat the chain closes: answer filed as reasoning,
cap reads content, content is always zero, no volume guard can ever fire.
The only thing that stops it is `STRAGGLER_GRACE_MS`, and that is what its 21 cuts are.

### The correction to `#211`'s recorded prediction

`#211` predicted the cut rate would fall toward the roster's.
That is not supported and has been replaced on the task.
The cuts are volume runaways, not stalls: `qwen3.8-max` is cut mid-reply after 106,405 characters
once and then 19 of 21 times between 293,163 and 350,293,
a tight cluster because the cut is time-bound while the stream rate is steady.
Post-fix those bytes meet `contentCap`, so the call is cut at roughly 32000 rather than 300,000,
in seconds rather than 180.
What changes is when and how expensively the voice is lost, not obviously whether.
Two mechanisms pull opposite ways: an early overrun rides the retry predicate `#156` built,
giving the model an attempt it never used to get,
against which a model emitting 300,000 characters may simply overrun again.
Record the outcome, not the prediction.

### What it redirects

The straggler cuts group into 29 distinct events.
At 180 seconds each that is an upper bound of 1.45 hours inside a 3.73 hour run.
It is an upper bound and must be read as one:
`runStageRound` assembles from its `arrived` map rather than awaiting abandoned calls,
so the true per-event cost is at most the grace window and may be less.

That is potentially a larger lever than the serialization question `#213` was opened on,
and 21 of the 34 cuts are the seat `#211` already fixes.
So the order is now: land `#211` and re-measure, then re-derive the window, then prototype fan-out.
Measuring fan-out first would be measuring a system about to change underneath it.

### Two tasks this opened

`#214` re-derives the straggler window.
`doc/decision/translation-repair-straggler-grace.md` rests on the claim that no hung call had ever
been recorded and every cut voice was slow-but-working.
A voice cut mid-reply after 3,020,068 characters refutes that.
The decision should be superseded rather than edited, since its reasoning was correct for the
population it had, and it should not be reverted:
60 seconds really did cut `hf:zai-org/GLM-5.2` inside its ordinary range, and still would.

`#215` adds elapsed milliseconds to the stream completion line.
A production run currently cannot answer where its own wall-clock went,
because dispatch is logged at `debug` and production emits only `info` and `warn`,
while the completion line carries `firstByte` and `maxGap` but no duration.
That is why the 1.45 hour figure is a bound rather than a measurement,
and why `#213` cannot yet measure the baseline it needs.

### Corrected count for `#213`

The first pass said seven serialization sites and grepped four wrong paths.
The full sweep finds eleven resting on the refuted premise, seven of them on the production path,
and `src/editor-ensemble.ts:248` is the one with a clean argument:
envelopes within a slice are independent, nothing reads back an earlier envelope's outcome,
and `Promise.all` preserves order, so gathering concurrently and folding in index order is
byte-identical output for pure latency.
The task carries the full list, including the sites that are correctly sequential and must not be
touched.

### Two more findings from the same run (2026-08-25)

The deepseek zero-content anomaly is RESOLVED, and it is the same defect as `#211` intermittently.
It had been held open because the instrument used then was a 40-line scan window over 9 samples
with a measured 39 percent hit rate on healthy calls.
The completion line's own content count answers it on roughly 1,200 streams:
`deepseek-v4-pro-0813` is zero-content on 12 of 127, every one with reasoning above zero,
against a baseline of exactly zero across eight other seats.
What remains a prediction rather than a conclusion is whether `#211`'s fix removes those 12,
since the fix exempts `input_json_delta` and not `text_delta`.
Count them on the first post-fix run.

`#216` implements an owner instruction that turns out never to have been implemented:
"Please make sure to put even the full tool schema into system prompts."
Seventeen modules build a system message and NOT ONE carries its response schema;
the seven that name a schema at all name it only as the API-level `responseFormat`.
The supporting evidence is that all 6 schema failures in this run are on Charm Hyper seats,
`gemma-4-26b-a4b-it` 4 and `qwen3.8-max` 2, with zero on Synthetic,
and one of them reads `{"checks": "\n[{\"region\":` ,
a JSON-stringified array where the schema declares an array of objects.
That is the wrong-tool-call-format failure the owner named.
The provider split is confounded, since those seats are also different models,
so the task says so and does not claim the protocol causes it.

### The `#200` power projection flips, on measured accrual (2026-08-25)

`#200` recorded that 40 slices "lands a hair under the line", worst-case z 2.776 against a
Bonferroni threshold of 2.807 at ten seats.
That rested on a projected 63 percent yield.
Measured at 16 of 40 slices, the yield is 75 percent: 12 of 16 slices contributed a judged round.

Judged-round accrual, counted from `selectBestCandidate` votes rather than projected:

-   407 votes over 16 slices, which at roughly one ballot per judge is about 41 rounds.
-   2.54 rounds per slice, and 2.30 with the single richest slice dropped,
    so no one slice carries the rate.
-   The 14-slice run that settled nothing managed 2.07 per slice from 10 contributing slices.

Holding the prior effect size, 40 slices reaches about 30 contributing slices,
so z scales by the square root of 3 and the deflated best z goes from 1.76 to roughly 3.05,
clearing 2.807 by 0.24.

DO NOT ACT ON THIS EITHER, for the same reason the original projection carried.
The effect size it holds was measured on FIVE models, and the pooled preference rate roughly halves
at ten seats, so the z it implies could move in either direction.
The margin is thin in both directions and the run measures the effect size directly.
Read the standing when it exits; the projection is superseded either way.

## Landing sequence for the parked work, verified ready (2026-08-25)

Everything below is blocked on the calibration exiting and nothing else.
The archive was verified on 2026-08-25 and applies cleanly:
`gzip --test` passes, it holds 33 repo-relative paths,
HEAD descends from its base `f800f1352`,
every commit between that base and HEAD is documentation only,
and NONE of the 33 files changed in that range.
So untarring over the repo root reverts nothing and clobbers no concurrent work.

### Order, and why this order

CORRECTED 2026-08-25: step 1 used to read the pid file, which holds the wrong process.
`doc/runbook/translation-repair-corpus-pass.md` carries the reasoning and the controls.

```sh
# 1. Confirm the run is actually gone, rather than merely quiet.
#    NOT the pid file: it holds the launching bash wrapper, and the work runs
#    two levels below it. Measured live: bash 3038649 at 2792 KB, mise 3038654,
#    node 3038820 at 126340 KB doing the work. Ask what is running instead.
running() {
  for d in /proc/[0-9]*; do
    [ -r "$d/cmdline" ] || continue
    mapfile -d '' -t argv < "$d/cmdline" 2>/dev/null || continue
    [ "${#argv[@]}" -gt 0 ] || continue
    [ "$(basename -- "${argv[0]}")" = node ] || continue
    for a in "${argv[@]:1}"; do
      [ "$(basename -- "$a")" = "$1" ] && echo "alive pid=${d#/proc/}"
    done
  done
}
running editor-calibrate.mjs   # silence means gone

# 2. Read the standing FIRST, while the tree still matches the build that
#    produced it. This answers `#200`, and nothing else here can change it.
node ~/temp/agent/standing-from-log.mjs \
  ~/temp/agent/editor-calibrate-fullroster-20260825.log

# 3. Land the parked work. 16 new files, 17 modified, 0 identical.
tar --extract --file ~/temp/agent/spend-telemetry-210.tar.gz \
  --directory /var/home/user/worktrees/translation-repair

# 4. Build BEFORE any test: the suite imports from `dist/`, so a test run
#    against a stale bundle measures the old code and passes.
mise run //package/module/translation-repair:build

# 5. Then lint, types, tests.
mise run //package/module/translation-repair:lint
mise run //package/module/translation-repair:lint:types
mise run //package/module/translation-repair:test:unit
```

### The commit, and the trap in it

`CPN`: a pathspec commit omits any file it does not name, and this lands SIXTEEN
new files. Naming only the modified ones would commit a tree whose imports do not
resolve at that commit while the working tree still builds, which is invisible
until somebody checks out that commit.

Verify with `git status --short` afterwards that nothing is left untracked.

New files, all of which must appear in the pathspec:

    package/module/translation-repair/src/candidate-ledger.ts
    package/module/translation-repair/src/candidate-ledger.unit.test.ts
    package/module/translation-repair/src/candidate-select-record.ts
    package/module/translation-repair/src/corpus-run/hyper-price.ts
    package/module/translation-repair/src/corpus-run/hyper-price.unit.test.ts
    package/module/translation-repair/src/corpus-run/ledger-parse.ts
    package/module/translation-repair/src/corpus-run/ledger-read.ts
    package/module/translation-repair/src/corpus-run/ledger-read.unit.test.ts
    package/module/translation-repair/src/corpus-run/ledger-report.ts
    package/module/translation-repair/src/corpus-run/spend-cost.ts
    package/module/translation-repair/src/corpus-run/spend-cost.unit.test.ts
    package/module/translation-repair/src/corpus-run/spend-read.ts
    package/module/translation-repair/src/corpus-run/spend-read.unit.test.ts
    package/module/translation-repair/src/corpus-run/spend-report.ts
    package/module/translation-repair/src/spend-line.ts
    package/module/translation-repair/src/spend-line.unit.test.ts

Modified files:

    package/module/translation-repair/mise.toml
    package/module/translation-repair/rolldown.node.config.ts
    package/module/translation-repair/src/anthropic-delta-scan.ts
    package/module/translation-repair/src/anthropic-delta-scan.unit.test.ts
    package/module/translation-repair/src/ballot-barrel.ts
    package/module/translation-repair/src/candidate-select.ts
    package/module/translation-repair/src/corpus-run/sentinel-probe.ts
    package/module/translation-repair/src/editor-ensemble.ts
    package/module/translation-repair/src/hyper-client.ts
    package/module/translation-repair/src/judge-fidelity.ts
    package/module/translation-repair/src/pipeline-barrel.ts
    package/module/translation-repair/src/provider-barrel.ts
    package/module/translation-repair/src/refine-stage.ts
    package/module/translation-repair/src/stream-idle-guard.ts
    package/module/translation-repair/src/stream-idle-guard.unit.test.ts
    package/module/translation-repair/src/synthetic-client.ts
    package/module/translation-repair/src/translate-judge.ts

### The three measurements owed immediately after, before anything else is built

Each one is a prediction already on record, and each is falsifiable. Take them on
the first post-fix run rather than reasoning about them.

-   `qwen3.8-max` cut rate. Pre-fix baseline 21 of 119, 17.6 percent, stable
    against an earlier 12 of 71. `#211` predicts NOT that this falls but that
    each cut costs a fraction of the time and bytes, because `contentCap` can
    finally see the model. Record whichever happens.
-   `deepseek-v4-pro-0813` zero-content count. Pre-fix 12 of 127. Twelve to zero
    means it is the same mechanism as `qwen3.8-max`; twelve holding means
    `text_delta` inside a thinking block, which `#211` deliberately does not
    exempt, and that opens its own task.
-   `qwen3.8-max` content characters at p50 and p95. Pre-fix both are 0. Any
    nonzero value confirms the routing fix at the user boundary rather than in a
    unit test.

## The run will finish, and budget is not what would stop it (2026-08-25)

Measured at 4h21m into the full-roster calibration,
off its own 115 `METERS` readings,
read with `node dist/final/node/meter-report.mjs` directly
rather than through the task, which would have rebuilt `dist` underneath it.

Both providers answered every reading:
`synthetic wet=115 dry=0 unreadable=0`, `hyper wet=115 dry=0 unreadable=0`,
so this run has had no outage at all and its numbers carry no availability caveat.

Runway against work left, which is the only question that mattered:

-   Hyper drained 205 of 10000 in 4.39h, so 46.7 per hour, leaving 210 hours of runway.
-   Synthetic drained 5.183pp gross in the same window, so 1.18pp per hour, leaving 79 hours.
-   Seventeen of forty slices are done, and the remaining twenty three come to
    6.0 hours at the whole-run mean gap of 943s,
    7.3 hours at the slower last-half mean of 1150s,
    and 12.9 hours if every remaining slice were as slow as the slowest one yet seen at 2017s.

Even the pessimistic arm finishes with an order of magnitude of budget to spare.
Nothing here needs the account owner to top up or reset anything.

### The weekly allowance refilled mid-run, and endpoint arithmetic is 62% wrong

`syntheticWeekly` ROSE once in 115 steps,
from 95.594% to 97.577% at 2026-08-25T03:03:24.086Z, a jump of 1.982pp.
The subscription window rolls, so an allowance is not a monotone drain.

That breaks the obvious way to price a run.
Net endpoint change reads 3.200pp,
gross drain summed over the downward steps alone reads 5.183pp,
so subtracting the endpoints understates what was actually spent by 62%.

THE SAME DETECTOR FOUND ZERO RISES IN `hyperBalance`, 0 of 115 steps,
which is what a prepaid balance should do and is what makes the synthetic
result meaningful rather than an untested instrument.

`meter-report` prints `level first` and `level last`,
which are exactly the two numbers a reader will subtract.
It does not claim they are spend, and its own job is duty cycle and outages,
but nothing warns that the difference is not the cost.
`#210`'s token-priced spend line is the right instrument for cost
and this is one more reason it is: meter deltas cannot answer the question at all.

### Slice lines carry no timestamp, which is more of `#215`

Sixteen of the seventeen slice gaps here were recovered by carrying the most
recent `METERS` timestamp forward through the log,
because `slice N of 40` lines have no timestamp of their own.
`#215` is recorded as a run being unable to say where its wall-clock went
for want of a duration on the completion line.
It is worse than that: the per-slice progress lines cannot be placed on a clock
at all except by leaning on an unrelated line that happens to be timestamped.
Whatever `#215` adds should cover the progress lines too.

## Corpus text in commits: what the owner decided, and the rule (2026-08-25)

Raised because a sweep found corpus text committed to a PUBLIC repository,
and the working rule carried across sessions said it should never be there.
`doc/audit/corpus-text-reached-a-public-repository.md` has the measurements.
The short version: fifteen documents under `doc/` carry 185 lines of Chinese
source text, plus English memorial sentences that a script-keyed scan cannot see,
on `origin/translation-repair-rebased`, none of it on `origin/main`,
publicly readable since 2026-08-20.

THE OWNER DECIDED NOTHING IS REMOVED.
Exposing corpus text is sometimes fine, because the owner is friends with the
people who run the site the corpus comes from.
So no file changes, no history is rewritten, nothing is force-pushed,
and the repository stays public.
A session that rediscovers this must not reopen it, must not offer to scrub it,
and must not treat it as an incident.
The relationship that makes it fine is not visible from inside the repository,
which is why it is written here.

### The rule going forward

The instruction attached to that decision was to take extra care not to expose
more in commits later.
Permission is not indifference, and it is not retroactive cover for adding more
without thinking.

-   Corpus text enters a commit only when it carries evidence nothing else can carry,
    and only as much of it as the evidence needs.
    Where a rendering changed a tense, or an aligner paired the wrong headings,
    the wording IS the finding and quoting it is right.
    Where the point is a count, a rate, a slice index or a model's behaviour,
    it is not, and the id and index say it better.

-   Never quote because quoting was easier than naming.
    That is the failure mode that produced 185 lines:
    each one was individually defensible and nobody was counting.

-   A document ABOUT the exposure quotes nothing.
    Naming files and counts is the whole discipline,
    so an audit that reprints the evidence repeats the fault it records.

-   Everything else about handling the corpus is unchanged.
    It is read at runtime from the pinned clone by `git show <sha>:<path>`,
    corpus files are never committed,
    and artifacts and grading sheets stay under run directories outside the repository.

### Why this is not an `AGENTS.md` rule

Proposed there and declined by the owner as too narrow to be worth a repo-wide
shortcode: it is a rule about one corpus, in one package, under one relationship.
It belongs where the people working on that package will read it.

## Corpus exposure is not a blocker, and sanitization is the last step (2026-08-25)

Supersedes the caution in the corpus-exposure sections of this handover.
The owner set the plan after `#456` was measured:

-   COMMIT THE CORPUS HOWEVER IS CONVENIENT.
    Do not spend effort avoiding corpus text in commits,
    do not shrink a quote to dodge exposure,
    and do not treat a corpus-bearing diff as something to route around.
    Nothing about corpus text blocks any commit on this branch.

-   SANITIZATION HAPPENS ONCE, AT THE END.
    When the pipeline is production ready,
    tell the owner with the `AskUserQuestion` tool rather than in ordinary prose,
    because that is the signal they are waiting for.
    They will disable branch protection temporarily,
    and the corpus content committed along the way gets sanitized then.

-   THE DENY-LIST IS BUILT AND NOT INSTALLED.
    `doc/decision/corpus-deny-list-for-forbidden-strings.md` has the design and the evidence.
    Installing 10206 literal rules today would cost about two minutes of rule compilation
    on every single commit, because the scanner recompiles the runtime rules file per scan.
    `#456` is the fix. The deny-list waits for it rather than taxing every commit,
    and it waits without cost, since sanitization at the end covers the same ground.

WHAT THIS DOES NOT CHANGE.
The corpus is still read at runtime from the pinned clone,
corpus files are still never committed as corpus files,
and artifacts and grading sheets still live under run directories outside the repository.
The change is that quoting inside our own documents is now unremarkable.

## Two source fixes found while the run was live, both owed (2026-08-25)

Both were found by testing documentation against reality rather than by reading code,
and both edit `src/`, which restamps the pipeline digest and invalidates
the slice cache the calibration has been buying since 01:29Z.
So both wait for the run, and both belong in the landing sequence
after the standing is read and the parked work is extracted.

-   `#217`: `verify-published` cannot tell a clean run from an empty one.
    NOW BUILT AND PARKED, in the section `#217` is built, GFP-proven and parked.
    `doc/runbook/translation-repair-corpus-pass.md` carries the workaround until it lands.

-   `#218`: a real Bilibili account UID sat in the TSDoc `@example` for `readingAnchors`
    in `image-reading-sense.ts`.
    NOW FIXED AND PARKED beside `#217`.
    An invented UID was rejected, because any ten-digit number could be somebody's real account.
    The example now reads `'posted by Mittens on 2019-04-07'`,
    which demonstrates more of what the docstring claims than the original did:
    it lists a date and a username first, and the old example carried only a digit run.

`#219` is not a code fix and is the easiest thing here to lose:
when the pipeline is production ready, say so with the `AskUserQuestion` tool,
not in prose, because that is the signal the owner is waiting for
before disabling branch protection to sanitize the committed corpus text.

## `#217` is built, GFP-proven and parked (2026-08-25)

Built in the fork worktree `/var/home/user/worktrees/verify-empty`, checked out at `e8430d094`,
because the change edits `src/` and the calibration's slice cache is keyed on the pipeline digest.
It cannot be committed from there:
that worktree has no `node_modules/.bin/git`, so the policy wrapper is absent.
It is parked as `~/temp/agent/verify-empty-217-218.tar.gz`, which carries `#218` as well,
and is applied over the main worktree in the landing sequence.
The tarball was checked against the main worktree before parking:
all six modified files are byte-identical to the fork's base commit,
and all three new files are absent there, so it applies without clobbering anything.

### What was wrong

`namesUnder` answered an absent directory with an empty array and printed the absence with `console.error`.
Stdout therefore read `verify-published: matched=0 settledWithNoPage=0 pageWithNoArtifact=0`,
then `verify-published: 0 of 0 pages carry every wording their artifact promised`,
and `process.exitCode` stayed 0.
An empty runs directory and a run whose every page agreed produced the same report and the same exit code,
so a mistyped `TRANSLATION_REPAIR_RUNS_DIR` read as a green run.

`errorName` compounded it.
It answers `error.name`, which is `Error` for every filesystem failure,
so a directory that was never created and one at mode 000 printed the same `(Error)`.

### What landed

Absence became a kind rather than an empty list, in two new modules.

-   `src/corpus-run/directory-listing.ts` holds `DirectoryReading`, `namesIn` and `filesystemReason`.
    `filesystemReason` reads `error.code`, so the report says `ENOENT` or `ENOTDIR` instead of `Error`.
-   `src/corpus-run/published-tree-listing.ts` holds `settledEntryIds`, `publishedEntryIds`
    and the verdict `whatThereIsToVerify`.

`verify-published.ts` gained a second exit code, `NOTHING_WAS_VERIFIED = 2`,
kept separate from `PUBLISHED_TREE_DISAGREES = 1`:
a disagreement says the run shipped something wrong,
while the new code says the run was never examined,
and a gate that treats those alike either ships an unchecked run or refuses a good one.

An absent published tree is deliberately NOT one of the nothing-verified cases.
Beside real artifacts it means every settled entry is unpublished,
which is the most serious finding this check can make,
so it stays a finding with a count rather than collapsing into silence.

### The lister already had a second copy

`editor-standing-read.ts` carried its own `DirectoryReading` union and its own `namesIn`,
with the same `errorName` weakness and the same `console.error` plus empty-list shape.
Both now call the shared module, following the rule `error-name.ts` records for itself:
lift at the point a further caller would be written.
Its one refusal message now names `ENOENT` rather than `Error`.

### Evidence

Boundary cases, run against the built CLI on `mktemp` fixtures:

```text
absent runs directory        exit 2   NOTHING VERIFIED, no artifacts directory under the run (ENOENT)
run dir with no artifacts/   exit 2   NOTHING VERIFIED, no artifacts directory under the run (ENOENT)
artifacts/ present, empty    exit 2   NOTHING VERIFIED, the artifacts directory holds no settled artifact
artifacts, no published tree exit 1   NO PUBLISHED TREE (ENOENT). All 2 entries the run settled are unpublished
six agreeing pages           exit 0   matched=6, 6 of 6 pages carry every wording
```

The last row is the positive control, and it is not invented:
it uses the six real artifacts from `~/translation-repair-runs-20260817`,
with each page synthesised from that artifact's own `shippableReplacements`
and checked with `pageCarriesEveryWording` before being written.
Without it, every non-zero exit above would prove only that the check can refuse.

GFP: with the verdict reverted to reading an unreadable listing as an empty one,
the two guard cases fail and the CLI reproduces `#217` exactly,
printing `0 of 0 pages carry every wording` and exiting 0 on an empty run.
Restored from copies kept in `~/temp/agent/217-gfp/`, rebuilt, and both pass again.

`published-tree-listing.unit.test.ts` covers 14 cases across five suites:
`namesIn` on a present directory, an absent one and a file;
`filesystemReason` on a coded error, an uncoded error and a thrown string;
both id listers on present and absent directories;
and all four verdict branches.

### One unrelated fix came with it

`probe-telemetry-report.unit.test.ts` imported `@monochromatic-dev/module-test`
rather than the `/ts` subpath every other test file uses, which is what `ST3` requires.
It was the only such file in the package.
The fork exposed it because only this package's `dist/` is built there,
so the non-`/ts` path had nothing to resolve to:
one `TS2307` that cascaded into 12 `no-unsafe-call` and `no-unsafe-member-access` warnings.
Adding `/ts` cleared all 13.

## The parked work is now build-and-test verified together, not just apply-clean (2026-08-25)

`#210`, `#211`, `#212`, `#217` and `#218` were each parked separately,
and each was checked only for whether its files applied cleanly over the main worktree.
Applying cleanly is not the same as compiling, and none of them had ever been built together.

All five are now extracted into `/var/home/user/worktrees/verify-empty` on top of `e8430d094`,
and the combined tree was taken through the whole gate:

```text
build      exit 0
lint       exit 0   0 warnings, 0 errors  (oxlint type-aware plus tsc)
test:unit  exit 0   668 PASS, 0 FAIL
```

Six hundred and sixty-eight suites is nine more than the `#217` tree alone,
which is the `#210` and `#212` suites arriving.

The combined tarball is `~/temp/agent/parked-combined-20260825.tar.gz`, 42 files,
and it SUPERSEDES both `~/temp/agent/spend-telemetry-210.tar.gz`
and `~/temp/agent/verify-empty-217-218.tar.gz`.
Extract only the combined one; extracting an older tarball afterwards would
overwrite files with their pre-combination contents.

### Why they were combined rather than kept apart

`#210` touches `provider-barrel.ts`, `pipeline-barrel.ts`, `ballot-barrel.ts`,
`candidate-select.ts`, `editor-ensemble.ts`, `judge-fidelity.ts`, `refine-stage.ts`
and `translate-judge.ts`, all of which further work is likely to touch.
Building each item against the same untouched base and landing them in sequence
would have let a later tarball silently overwrite an earlier one's edits to a shared file,
because a tarball carries whole files rather than a diff.
Building each item on top of the previous removes that hazard entirely.

No source file changed on the branch between the `#210` tarball's base and `e8430d094`:
the last commit touching `package/module/translation-repair/src/` is `91fe0d0e6`,
and everything after it is documentation.
So extracting the older tarballs onto this base discarded nothing.

### The landing sequence is correspondingly shorter

Read the standing, extract `parked-combined-20260825.tar.gz`, build, lint, types, test,
then commit in item order so each item keeps its own message.
The build, lint and test steps have now been run once already and passed,
so a failure there after landing would mean the main worktree differs from this fork,
which is itself the thing worth knowing.

## `#216` was half wrong, and reading the source before building found it (2026-08-25)

`#216` was opened on the finding that seventeen modules build a `role: 'system'` message
and not one of them puts its response schema into that message.
That is true of the PROMPT BUILDERS and false of what a model actually receives on Charm Hyper.

`anthropic-request.ts` routes every schema-bearing call through `renderToolSystemPrompt`,
which prints the whole schema into the Anthropic `system` field under
"THE EXACT SCHEMA OF THAT OBJECT", followed by seven format rules.
One of those rules reads
"Pass the object itself. Do not pass a string that contains JSON, and do not escape its braces",
which is exactly the failure `#216` cited as evidence that the schema was missing.

So the correlation runs the opposite way to the mechanism the task assumed:

```text
Charm Hyper   schema IS in the system prompt    6 of 6 measured schema failures
Synthetic     schema is NOT in the prompt       0 measured schema failures
```

The owner's instruction was already implemented on the provider where the failures are.
This is worth stating plainly because the task's own evidence section reads as though
it were about to conclude the opposite, and a later session would have believed it.

### What was genuinely missing

The Synthetic path had nothing of the kind.
`synthetic-client.ts` builds an OpenAI-compatible body carrying only the API-level
`response_format` field, which a model that does not honour it never sees.
That is a real gap against the instruction, and it is the half that was built.

`src/schema-prompt.ts` renders a block from the same `JsonSchemaResponseFormat`
the request puts on the wire, so the prompt and the wire cannot drift.
It is idempotent, it adds a system message where a call has none
rather than dropping the schema on the calls that state least,
and it handles a system message carrying parts
so a call that also sends a picture is not the one that loses its schema.
Its rules list is carried over from the Anthropic renderer,
which is the wording this codebase has already run in production.

`hyper-client.ts` is deliberately unchanged, with a comment at the seam saying why.
An edit there was written and then reverted:
it would have stated the schema twice on every Hyper call.

### Why the client seam rather than the seventeen prompts

The task proposed editing each prompt builder to append a rendered block.
The seam is strictly better.
It derives the text from the exact value going on the wire,
it covers every caller that exists and every caller written later,
and there is no eighteenth prompt to remember.

### What is owed, stated as an open question rather than a prediction

The after-measurement.
Adding schema text lengthens every Synthetic system prompt, which costs tokens
and could hurt as well as help.
Synthetic's schema-failure count is already zero,
so this change CANNOT be validated by that number falling.
What it can be measured on is a first Synthetic schema failure never appearing under load,
and the token cost, which the `#210` spend ledger now makes readable.
Record the outcome; do not claim an improvement.

## `#215`: a run now says where its wall-clock went, and a CLI reads it back

The task's own text quoted the owner's standing instruction:
"If you found out we're not logging enough, you should change the pipeline to log enough."
Following that instruction found a second gap the task had not named.

### What the log could not say, measured before changing anything

The live full-roster calibration log was surveyed for every line shape it carries.
Three tags appear in it and no others:
`reportStreamProgress` on 2405 lines, `takeReading` on 161, `exchangeWithRetry` on 4.
`takeReading` is the availability meter, polled every minute or two.
There is no dispatch line, and there is no round boundary line.

So the log records when each call ENDED and nothing else about time.
A call's start is not recoverable, a round's extent is not recoverable,
and the question the audit `doc/audit/every-volume-guard-is-blind-to-one-model.md`
opened on has no answer in the data.

A lower bound was computable and was computed, before the fix, as a control.
Each completion line carries `firstByte` and `maxGap`, and the largest gap falls
strictly after the first byte, so their sum bounds the call's duration from below.
Intervals built from that sum are subsets of the true ones, so overlaps counted on them
can only undercount:

```text
calls                        2405 (2349 completed, 56 cut)
log span                     6.15 h
summed duration FLOOR        2.37 h
mean concurrency FLOOR       0.39
peak concurrency FLOOR       9
```

Read that as a floor and nothing more.
It says at least nine calls were once in flight together,
and it cannot say what the figure actually is.

A method note worth keeping:
the first version of this sweep matched 1043 of 2405 lines and reported a peak of 5.
The label pattern required a colon, so it silently dropped every non-`hf:` model.
An uncapped `grep --count` on the raw marker is what caught it,
which is the `QRY` rule paying for itself.

### The two lines that landed

`StreamProgress` gained `elapsedMs`, computed as `Date.now() - state.armedAt` in
`armIdleGuard`'s `progress()`, and `reportStreamProgress` prints it directly after
the outcome.
With the line's own timestamp that gives every call an interval, which is what an
overlap count needs and what no completion line carried before.

`runGatherRound` now writes a round line, which nothing did:

```text
editor round: 6/7 heard, 91402ms total, 61401ms to quorum, 30001ms in grace
```

The split is the point.
Time before quorum is the round doing its work; time after it is the round waiting on
voices it may never hear.
Only the second is straggler cost, and one round duration cannot tell them apart.
The audit could bound that cost only from above, at the grace window times the number of
cut events, and recorded that confirming it "needs the dispatch timestamps the run does
not currently record".

Both lines carry ids, counts and durations only.
No corpus wording enters either.

### The reader, because a log nothing reads is not a measurement

`run-timing-parse.ts`, `run-timing-read.ts` and `run-timing-report.ts`, with the
`run-timing-report` mise task, mirror the `spend-` and `ledger-` families.

Every read names what it found rather than returning an absence.
A completion line with no duration and a line that is not a completion at all are
different facts about a log: the first says the run predates `#215`.
Folding them together would let a mixed archive's readable half be reported as the whole,
which is the shape of error this project has hit before.
The house `no-nullish-union` rule is what forced the discriminated union, and it made the
reader better: `readRunTiming` used to check `undefined` and then re-inspect the text to
count untimed lines, and now one read decides all three outcomes.

Boundary verification, all three states:

```text
new-format fixture   2 rounds, 29.0% of round time in grace, 1 voice lost,
                     mean 1.05 in flight, peak 2, 21.00s of calls across 20.00s of run
live pre-215 log     NO ROUND LINE, 2533 completion lines carry no elapsed field,
                     NO TIMED CALL
no argument          throws, naming the usage
```

Every figure in the fixture row is hand-computed from three intervals at
`[0,10]`, `[2,8]` and `[15,20]` seconds, not recorded from a run,
so a change in the sweep fails the case instead of moving the target.

### GFP

Both new guards were shown to fail with the guard removed and to pass with it restored.

```text
elapsedMs set to 0            stream-cut and stream-idle-guard both exit 1
                              "expected +0 to be at least 20"
round line deleted            stage-round exits 1, both cases
                              "expected exactly one round line, got 0"
```

The idle-guard failure is non-vacuous: `firstByteMs` read 20 from a real wait,
so the assertion compared a measurement against a constant rather than zero against zero.

### What is owed

The measurement itself.
Achieved concurrency and the real straggler cost cannot be computed until a run emits the
new lines, and the calibration now running was launched from the old build.
The audit's 1.45 hour figure stays an upper bound until then.
This is recorded as owed, not predicted:
the point of the two lines is that the answer was unknown, and it still is.

### Suite

676 PASS, 0 FAIL, exit 0. Lint 0 warnings 0 errors. Build clean.

## `#205`: the two-lane artifact family is named for its shape, not a version

The owner delegated the naming ("you decide, this isn't a design decision")
and chose to leave the version-1 family where it is.
Measuring first changed the answer twice, so both measurements are recorded.

### The task's own candidate was refuted

`#205` proposed `artifact-lanes-*` and `SettledArtifactLanes`,
noting neither had been checked.
Checking them killed both:
`ArtifactLaneRelationV2` and `ArtifactLaneSelectionV2` already use `Lane`
for PER-LANE concepts, so a family-wide `Lanes` would name the whole thing
with the word its own parts already use for one part.

### The plain names belong to the older shape

Dropping the suffix outright collides on exactly six names,
and all six live in `artifact-v1-read.ts`:
`parseSettledArtifact`, `ParsedArtifact`, `buildSettledArtifact`,
`judgeSlice`, `compareDecisions`, `collectShippedRegions`.

That is worse than `#205` recorded.
The plainest names point at the OLDEST shape,
and the shape the pipeline actually writes wears a version number
that has been wrong since generation 3.
The v1 arm is still reachable, so this is a naming problem rather than dead code:
`artifact-read.ts` routes unversioned and version-1 artifacts to it.
The owner chose to leave it, and it is filed rather than fixed here.

### The rule, which the measurement chose rather than taste

A marker belongs exactly where two shapes are distinguished.

-   Six symbols have a version-1 counterpart, so those six say `TwoLane`:
    `parseSettledTwoLaneArtifact`, `ParsedTwoLaneArtifact`,
    `buildSettledTwoLaneArtifact`, `judgeTwoLaneSlice`,
    `compareTwoLaneDecisions`, `collectTwoLaneShippedRegions`.
-   Fifty-six have no counterpart at all,
    so their suffix asserted a version they do not carry and they simply lose it.
-   `ARTIFACT_SCHEMA_VERSION_V2` is untouched.
    It denotes the integer 2, and a version constant should carry a version number.
-   Forty files move from `artifact-v2-*` to `artifact-two-lane-*`.

### The sweep missed three names, and only the built artifact showed it

The first pass matched `[A-Za-z0-9_]*V2\b`,
which requires a word boundary after the digit.
`DamageRegionV2Error`, `ArtifactComparisonV2Error` and
`verifyArtifactV2AgainstPreparation` carry `V2` in the MIDDLE,
so the scan never saw them, the rewrite never touched them,
and a residue check built on the same assumption reported the work complete.

Reading `dist/final/node/index.d.mts` is what found them.
That is the rule this pays for:
a rename is checked at the artifact, never only in the source it was applied to.

A method note on the check itself.
The first probe of the built types returned zero for every name including ones
that certainly exist, because it read `dist/final/types/index.d.mts`,
which is not where the declarations land.
A positive control on a name known to be present is what caught it,
before the zero could be read as "the rename dropped everything".

The two error classes carry their own name as a string as well,
and both halves moved together
so a `name` assertion cannot pass against a class that no longer answers to it.

### Two test labels were lying

`artifact-change-sets.unit.test.ts` wrapped two assertions in
`caught(function parseTwoLaneArtifact() {...})` and
`caught(function readTwoLaneArtifact() {...})`,
and both bodies call the SINGLE-lane side.
The labels were chosen to dodge self-shadowing,
since a named function expression binds its own name inside its body,
and the dodge picked a name that says the opposite of what the code does.
They now name the assertion:
`singleLaneParseOfVersionTwo` and `changeSetReadOfVersionTwo`.

### Verification

```text
build          clean
lint           0 warnings, 0 errors
suite          676 PASS, 0 FAIL, exit 0
```

676 is the same count as before the rename, which is what a pure rename must produce.
The shipped `index.d.mts` carries every renamed export
and `ARTIFACT_SCHEMA_VERSION_V2` as the only surviving `V2`,
and the six version-1 names are still present and untouched.

### Landing note

The 40 file renames mean the parked tarball is no longer sufficient on its own:
extracting new paths would leave the old ones in place.
`~/temp/agent/parked-deletions-20260825.txt` lists the 40 paths to delete,
and `~/temp/agent/parked-status-20260825.txt` holds the full status this park was cut from.

## The landing was rehearsed on a throwaway, and it works

The parked work had never been tested as a LANDING, only as a working tree.
That gap mattered more after `#205`, because 40 file renames mean the tarball
alone is no longer sufficient: extracting new paths leaves the old ones in place.

A worktree was cut from the current main HEAD, `9569f9d79`,
dependencies installed off the shared store,
and the park applied exactly the way a real landing would apply it:

```text
tar --extract   124 files
delete          40 superseded paths from parked-deletions-20260825.txt
status          67 new, 40 deleted, 57 modified
artifact-v2-*   0 files remain
```

The counts reconcile with the fork's own status,
where the same change reads as 27 new plus 40 renames plus 57 modified:
a rename lands as one new file and one deletion.

Then the whole gate, on that fresh tree:

```text
build       clean
lint        0 warnings, 0 errors
suite       676 PASS, 0 FAIL, exit 0
```

And the new CLI through its own task, which is the user boundary rather than a
node invocation of a bundle:

```text
mise run //package/module/translation-repair:run-timing-report -- <log>
  rounds                 2, 1.72min in total
    waiting after quorum 30.01s, 29.0% of round time
    voices never heard   1
  calls in flight        mean 1.05, peak 2
    busy against span    21.00s of calls across 20.00s of run
```

The worktree was removed afterwards.
What this buys is that the landing, when the calibration exits, is a rehearsed
procedure rather than a first attempt on the main worktree.

### The landing procedure, in the order it must happen

1.  Confirm the calibration has exited, and collect its standing first.
2.  In the main worktree, extract `~/temp/agent/parked-combined-20260825.tar.gz`.
3.  Delete every path in `~/temp/agent/parked-deletions-20260825.txt`.
4.  Build, lint, and run the suite. Expect 676 PASS and 0 FAIL.
5.  Commit with scoped pathspecs, naming every new file (CPN),
    and remember the 40 deletions are part of the same change.

## The three report CLIs are documented, and the landing was re-checked for collisions

Opened by asking what `#219` actually requires before production readiness can be
signalled, and answering it by measurement rather than by assumption.

### What the measurement found

Of 47 mise tasks the package will carry after the landing, the README named 6.
It did not name `corpus-pass`, the primary entry point, and it did not link
`doc/runbook/translation-repair-corpus-pass.md`, which exists and carries the whole
operating procedure. A reader of the design document had no route to running anything.

None of the three CLIs the landing adds, `ledger-report`, `run-timing-report` and
`spend-report`, appeared in the README or the runbook. Three user-facing tools were about
to land undocumented, which is exactly what PKG exists to catch.

### How the documented output was obtained

Not from memory. A throwaway worktree was cut at `852e84f3a`, the parked tarball extracted,
the 40 recorded deletions applied, and the package built clean. Every block now quoted in
the runbook is output captured from that build.

For the populated cases the inputs were fixtures, because the two run directories on disk
both predate the writers. The timing fixture was hand-computed first: rounds of 60000 and
30000 milliseconds with 40000 in grace, and call intervals of `[0,10]`, `[2,8]` and
`[15,20]` seconds. The tool returned `1.50min`, `40.00s` at `44.4%`, `mean 1.05` and
`peak 2`, matching the hand computation exactly.

THAT DOUBLES AS THE POSITIVE CONTROL. It proves the reader can report non-zero, so
`NO ROUND LINE` on the live calibration log is a true absence rather than a broken parser.
Without it the zero would have been an unvalidated null.

### Two things worth knowing before operating them

The three tools disagree on the exit code for "nothing recorded", and the difference is
deliberate rather than an oversight. `ledger-report` exits 1, while `run-timing-report` and
`spend-report` exit 0. An empty ledger usually means `TRANSLATION_REPAIR_RUNS_DIR` was never
set, which is operator error worth failing on. A log with no `SPEND` or round lines is
simply an older log and says nothing about the operator. The runbook explains this rather
than smoothing it over.

`ledger-report --model <id>` prints candidate text verbatim, which on a real run is corpus
wording from an unlicensed archive, together with judges' reasons quoting it. The runbook
now says plainly that its output must not be pasted anywhere. The summary view carries only
model identifiers and counts and is safe to share.

### A rough edge found while capturing the output, filed as `#220`

A ledger file whose top level is an array rather than a single round object, which is the
shape a reader would guess, aborts the entire report with an uncaught `LedgerShapeError`,
a page of minified JavaScript, and exit 1. The message itself is good and names both the
file and the field. Nothing catches it, and `reportLedger` reads every file through one
`Promise.all`, so a single truncated write destroys a report over every good file beside it.
A truncated write is the expected failure, because the ledger is written during a run that
can be killed at any moment.

Not fixed now, deliberately: editing `ledger-report.ts` would invalidate the rehearsed
landing for a rough edge that costs nothing while the ledger is machine-written.

### The landing is still safe, and this was verified rather than assumed

The parked tarball was cut before the last doc commits, which raised the question of whether
extracting it would clobber them. It does not. The tarball holds 124 entries under exactly
three prefixes, all inside `package/module/translation-repair`, and contains no `doc/` path
at all. The only file changed on the branch since the rehearsal base `9569f9d79` is
`doc/handover/translation-repair.md`. The intersection is empty, so step 2 of the landing
procedure cannot overwrite a doc commit.

The landing procedure itself is unchanged.

### The runbook was audited against the source, and nothing in it is stale

Every environment variable it names exists in source: both API keys,
`TRANSLATION_REPAIR_RUNS_DIR`, and `TRANSLATION_REPAIR_HARD_CAP_MINUTES`.
Both flags it uses exist: `--plan` at `src/corpus-run/corpus-pass.ts:513`,
and `--only` at `src/corpus-run/entry-filter.ts:24`, read at `src/corpus-run/corpus-pass.ts:318`.
Every mise task it names exists, apart from the three arriving with the parked work.

Every string it tells the operator to watch for is emitted by non-test source:

-   `PLAN ok tip=` at `src/corpus-run/corpus-pass.ts:515`,
    carrying exactly the `pipeline=`, `client=constructed`, `pending=` and `first=`
    fields the runbook claims it does.
-   `ONLY` at `src/corpus-run/corpus-pass.ts:328`.
-   `CAP OVERRIDDEN` at `src/corpus-run/corpus-pass.ts:491`.
-   `CAP TOO TIGHT` at `src/corpus-run/cap-override.ts:156`.
-   `REATTEMPT` and `STALLED` at `src/corpus-run/entry-attempt-queue.ts:109` and `:116`.
-   `METERS` at `src/provider-budget.ts:14`.

`RUNDIR` is set in Steps, before What to check uses it, so the additions are reachable
by a reader working through the document in order.

TWO SEARCHES LIED BEFORE THIS SETTLED, both toward a false absence.
`rg --fixed-strings "--plan"` returned zero hits because `rg` read the pattern as its own
flag rather than as text. An `ONLY` search capped with `head` at five lines hid the one
real emission behind four unrelated prompt strings.

Either would have read as "the runbook names something that does not exist", and acting on
either would have meant editing a correct instruction into a wrong one. Both are the QRY
failure mode exactly as it is written down, and the uncapped, flag-safe re-runs found
everything. Worth remembering that the dangerous direction here is the empty result, not
the noisy one.

## The refiner column is thinner than the editor column, by about four times

Measured on the live calibration at 33 of 40 slices, while checking why one slice reported
zero refiner rounds.

### The first version of this section was wrong by an order of magnitude

It claimed the two columns differ by "roughly fifty times in round count". That compared
1023 LOG LINES against 20 ROUNDS, which are not the same unit. `selectBestCandidate` emits
three different line shapes, and only one of them is a round:

```text
918 per-judge ballots      "<model> chose candidate N at weight N: <reason>"
 90 decided rounds         "candidate N from <model> won weight N across N ballots"
 14 tied rounds            "judges tied at weight N; keeping the fallback"
```

The error was counting all three as if each were a vote. Recorded rather than quietly
corrected, because the wrong number pointed at a real and expensive action.

### What the rounds actually are

`runRefineStage` judges through the SAME `selectBestCandidate` (`src/refine-stage.ts:328`)
with the whole roster as judges, so refiner rounds are already inside those counts:

```text
104 rounds total   (90 decided + 14 tied) at 33 slices
 20 refiner rounds (15 with a winner, 5 tied or declined by every judge)
 84 editor rounds  by subtraction
```

That is about 4.2 editor rounds per refiner round, not 50.

Every decided round carries a real panel: 865 ballots over 90 rounds, mean 9.6, min 7,
max 10. Refiner rounds draw from the same roster, so 20 of them is on the order of 190
ballots at 33 slices, projecting to roughly 230 at 40.

The reason the refiner ballot count looked absent is that `runRefineStage` puts it in a
FINDING string rather than its log line (`src/refine-stage.ts:436` writes
`refine-selected (weight N of N ballots)`), while the log line carries only the winning
weight. Nothing was missing; it was being read in the wrong place.

### What that changes

The alarm was overstated. A column with roughly 230 ballots is not obviously short, and
there is no longer a prior that a second batch is needed before the landing.

STILL READ THE ACTUAL STANDING AT EXIT rather than this projection. Ballots are not
independent within a round, `#200` already records a sqrt(2.9) within-slice deflation for
exactly that reason, and 15 decided refiner rounds spread across six seats is a thin base
for a ten-seat Bonferroni comparison however many ballots sit under it.

So the exit order is unchanged from the rehearsed procedure, with one added reading:
if the refiner standing's own denominator turns out short, `#200` records that the remedy is
a second batch of 80 poolable slices, and that pooling needs no drift opt-in only while the
build does not change. The landing changes the build. That constraint is real and worth
keeping in view; what has changed is that it is now unlikely to bind.

## The run's power inputs, measured at 38 of 40 slices

`#200` projected from a 16-slice reading. These are the figures the standing will actually
rest on, measured rather than projected, and two of them moved in opposite directions.

```text
slices seen                     38
contributing (>= 1 round)       31   82%
empty (0 rounds, nothing to edit) 7
total judged rounds            131
rounds per contributing slice  4.23
```

Seven empty slices is not a fault. `editor-calibrate.ts` names this case explicitly: a slice
can buy the whole accuracy lane and have nothing to edit. `#200` recorded one live slice
doing it; there are now seven, and they simply contribute nothing to either column.

### Both inputs moved, and they largely cancel

The 16-slice reading had 75 percent yield and 2.54 rounds per slice; the 14-slice selftest
had 2.90 rounds per contributing slice, giving a sqrt(2.90) = 1.70x deflation.

Now yield is BETTER at 82 percent, and rounds per contributing slice is WORSE for power at
4.23, because within-slice correlation deflates by sqrt of that: 2.06x rather than 1.70x.

These are not independent problems. Raw z grows as sqrt(total rounds), and the deflation
divides by sqrt(rounds per contributing slice), so the deflated z grows as

    sqrt(total rounds / rounds per slice) = sqrt(contributing slices)

THE EFFECTIVE SAMPLE IS THE NUMBER OF INDEPENDENT SLICES, NOT ROUNDS. Extra rounds bought
inside one slice buy precision about that slice, not about the roster. So the figure that
decides the standing is 31 contributing slices, on track for roughly 33 at 40, against the
10 that produced a deflated best z of 1.76 in the selftest.

### Do not turn that into a prediction

`#200` already refused this, and its reason still holds: the effect size being scaled was
measured on FIVE models, and the pooled preference rate roughly halves at ten seats, so the
implied z can move either way. `standing-from-log.mjs` derives the Bonferroni critical value
from the row count, so it will use the ten-seat threshold rather than the selftest's 2.58,
and it applies the deflation itself.

Read the printed standing. The value of these numbers is that they make it INTERPRETABLE:
when a seat clears or fails, the reason is 31 independent slices deflated by 2.06x, and both
halves are now measured rather than assumed.

## An unreadable run file printed itself, and the fix was a whole class rather than one CLI

Filed as `#220` during the calibration, deferred until the landing cleared, then reproduced
on 2026-08-25.
It was filed as a crash with a minified stack.
Reproducing it showed something worse.

V8 gives a `JSON.parse` refusal a synthetic script whose source IS the text it was handed,
so Node's uncaught-exception report prints that line.
Against a throwaway ledger, `ledger-report` printed a whole contest ahead of the stack trace:

```text
<anonymous_script>:1
{ "task": "whiskerfield-1", "at": "2026-08-25T00:01:00.000Z", "candidates": [ { "index": 0, "producers": ["tab

SyntaxError: Bad control character in string literal in JSON at position 110 (line 1 column 111)
```

A real ledger file holds candidate renderings and a person's entry id.
A garbled one published both to a terminal.

The package already stated the rule this broke.
`error-name.ts` records that a message is uncontrolled and that a run directory path can name
a person; `LedgerShapeError` says outright that it NAMES, NEVER QUOTES.
Nothing had applied either to the parse step.

### The class was twelve times larger than the report

Counting `JSON.parse` sites that no `try` encloses found 25 matches, which is not the answer:
11 are TSDoc `@example` text and one parses a string on the write path.
The real class was 12 file-reading sites across 11 files, every one under a run directory.

Fixing only the one that happened to be tripped would have left eleven instances of the same
contract violation, which is the layer-1-only mistake `ELR` warns about.

`readRunJson` in `run-json-read.ts` is now the only way a run file is read.
It refuses with `RunJsonUnreadableError`, naming the file's basename and the failure and
carrying no text from it.
A parse offset survives as a number, because a truncation point is what tells an operator what
happened and it is content-free.
`parseRunJson` splits out for the two callers that hold text rather than a path.

`slice-cache-namespace.ts` is deliberately left alone.
Its `serialized` argument arrives from `persistSlice` on the WRITE path as a lane's own
in-memory serialization, so it never reads a file.
That was traced to the call site rather than assumed.

### Two lint rules disagreed, and the answer was to delete the code

Reading the digit run by hand needed either a mutable cursor or a character array.
`no-function-root-let` forbids the first, and `prefer-spread` and `no-misused-spread` forbid
each other on the second.
Per `LN1` the remedy is structural, not picking a surface to silence:
`Number.parseInt` already reads a leading digit run and stops, so the hand-written scan is gone.

### The test that could not have failed

Writing the absence assertion exposed a trap worth remembering.
V8 quotes only the FIRST TEN CHARACTERS of a file back inside its refusal message, so a fixture
word of `Marmaladeslept` appears as `Marmalades`, and a test asserting the full word absent
passes even against a reader that forwards the message whole.

The fixtures now lead with `Bixbyfluff`, exactly ten characters, confirmed against `JSON.parse`
directly to appear in the message it produces.
The same measurement corrected a truncation offset guessed at 30 to the real 27.

GFP-proven: breaking both guards, so `readRunJson` forwards V8's message and `refusalOf`
forwards every class's, fails `readRunJson` on two children and `refusalOf` on exactly the
foreign-message case, exit 1.
Restoring returns 680 PASS, 0 FAIL.

### What the boundary check found that the unit tests could not

Driving `rendering-audit-settled-report --run` against a malformed file confirmed the leak is
closed there too: zero hits for the fixture's distinctive word, with the file's name appearing
twice as a positive control that the parse was genuinely reached.

It also showed the OTHER half of `#220` is still open, now filed as `#223`.
The refusal is safe but still uncaught in these CLIs, so Node prints the minified bundle line,
around three thousand characters of it, around a correct one-line message.
`ledger-report` is the only one that catches and reports.

Landed as `768d26b18`, `ba83d021c` and `7a4f27db0`.

### One observation recorded rather than acted on

The suite output shows the pipeline's own warn logs forwarding a model's raw non-JSON answer,
`raw="not json at all"`, alongside the `SyntaxError` message that quotes it.
That is the same shape as the unguarded-parse defect, but the exposure is different:
those lines go to a run log inside a run directory that already holds corpus wording, and the
owner's instruction is to log more rather than less.
Naming it here so the difference is a decision rather than an oversight.
