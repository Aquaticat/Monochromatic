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
    STALLED MocaKawai: its 2 cached slices are what it started with, so a further attempt in this invocation would repeat it
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

## `#201` landed: availability is recorded, readable, and samplable

Four commits on 2026-08-24, all pushed.

### What shipped

-   `provider-budget.ts` logs `METERS synthetic=<state> hyper=<state>` at `info`
    on every meter reading, once per sixty-second freshness window.
    Since 8f774f34f the line also carries the numbers each state was read from;
    see the `#202` section.
    It was already computing this and saying it at `debug`, which runs do not record.
-   The meter now has three states.
    `meterRecordOf` (named `meterStateOf` until 8f774f34f) reports
    `wet`, `dry` or `unreadable`,
    and `routesAsDry` maps that back to the routing bit.
    Both are exported `@internal` and pinned by six cases.
-   `meter-sample-read.ts` parses those lines back into samples.
    No regex.
-   `meter-dry-span.ts` computes duty cycle and outage spans as bounded ranges.
-   `meter-report` reads any number of logs and reports both providers.
    Spends nothing.
-   `budget-sample` takes one reading between runs.
    Spends no generation.

### The defect the round-trip found

Reading a real sampler log back reported `unread=1` on an intact log.
The sampler's own summary said "the METERS line above is the record",
and the parser counted that sentence as a record it could not read.

A record is now recognised by its first field parsing.
Prose does not do that; a record truncated part way through its second field still does.
Confirmed both ways:
the real log now reads `unread=0`,
and the fixture's planted undated record still reads `unread=1`,
so the gate did not simply switch the detection off.

### State

-   Lint 0 warnings 0 errors on 845 files, types clean, 619 suites pass, 0 fail.
-   One reading exists so far:
    2026-08-24T18:17:35.383Z, `synthetic=wet hyper=dry`.
    Charm Hyper has been dry all day; Synthetic is up.
-   The record only grows from here,
    so the numbers are worth reading again after the next few passes
    rather than now.

### What is left

-   `#200`, an editor-role calibration, is still open and still needs its shape decided.
-   `#94`, the slice rename, is still deliberately deferred.

## `#200`: the editor calibration is built, and its blocker was imaginary

### The finding that unblocked it

The task was held because a settled artifact exposes neither the envelopes nor
the issues an editor worked from, so the claims looked unreplayable, and the
choice looked like an artifact schema change or inventing claims as fixtures.

Neither is needed. `ChunkRepairOutcome.rounds` already carries, per round, the
slate judges saw with each candidate's producer attached, and every ballot cast
over it, and both sides name the same `CandidateProducer` and `SelectionBallot`
out of `candidate-select-model.ts`. That is `SelectionRound` one re-shape away.

So the calibration drives the lane live and reads what it records.

### What shipped

-   `repair-selection-rounds.ts` projects recorded rounds into the standing's
    shape, sorting by the position judges were shown and REFUSING a slate whose
    positions are not one to its length. A ballot names a candidate by number,
    so that is the assumption which cannot be checked afterwards.
-   `producer-standing-report.ts` holds the rendering both calibrations share.
-   `editor-calibrate` drives the whole repair lane, all ten editing and all ten
    judging every slice, and reports the EDITOR and REFINER standings off one
    spend.

### The one deliberate divergence from production

Checkers self-certify in this runner and nowhere else. Production forbids a
checker proving its own repair, and a full editor roster leaves nobody
independent when the roster is ten; rotating editors out would reintroduce the
survivorship the shape exists to avoid. Safe here because checking runs after
selection: the ballots a standing reads are cast before any checker is asked.

### What is still owed

The MEASUREMENT, which needs a full roster. Charm Hyper has been dry all day, so
a run now seats five of ten and produces exactly the survivorship the shape
prevents. `budget-sample` makes the recovery observable; run the calibration
once a sample shows `hyper=wet`.

A one-slice smoke run was made against the dry roster to prove the runner
executes. It ran 7m18s and exited 0: the checker assertions passed with the full
roster seated, the five Hyper-only models were refused as lost voices, and the
lane continued on the five that answered.

IT REPORTED ZERO ROUNDS, AND THAT IS THE LANE WORKING. Critics raised two claims
on that slice, the panel adjudicated two issues, and the lane then said
`chunk 5: nothing to edit, unchanged`, because neither issue was ACCEPTED. No
editor is asked to write on a slice like that, so no round exists to count.

ADJUDICATED IS NOT ACCEPTED, and that governs how the real measurement must be
sized. A slice can buy ten critics and a ten-model panel and contribute nothing
to an editor standing. The default of six slices may well yield very few rounds;
draw generously and read the new "from N of M slices" line before trusting a
standing.

Because a null from a probe never shown able to produce a non-null says nothing,
there is now a positive control in the unit suite: real-shaped rounds driven
through the projection and the tally together, asserting a standing falls out
with its counts. That is what makes the live zero readable as "this slice had
nothing to repair" rather than "the instrument produces nothing".

## `#202`: the record carries the numbers, not only the verdict

One commit on 2026-08-24, 8f774f34f, pushed.

### How it was found

Checking whether Charm Hyper was really out during the `#200` calibration,
the record answered `METERS synthetic=wet hyper=dry` and nothing else.
That is exactly what a wrong threshold in `budget-routing.ts` would also print,
so the only way to tell was a live `GET /v1/credits`,
which answered:

```json
{
  "balance": 0
}
```

The meter was right.
The point is that the record could not say so,
and for any moment already past there is no second call to make.
That is the same failure `#201` was opened on,
one level down:
a reading was being computed, used, and then dropped.

### What shipped

-   `syntheticMeterLevel` and `hyperMeterLevel` in `budget-routing.ts`
    render `key=value` tokens from the same snapshot
    the dryness verdict is read from.
    One read, so a verdict and its numbers cannot describe different moments.
-   `meterStateOf` became `meterRecordOf` and returns `{ state, fields }`.
    A meter that did not answer reports no fields;
    `state` already carries that it did not.
-   The record now reads:

    ```text
    METERS synthetic=wet hyper=dry syntheticWeekly=97% syntheticFiveHour=48/50 syntheticThrottled=no hyperBalance=0
    ```

-   `meter-sample-read.ts` defines a level as any field whose value
    is not a meter state,
    so a field added later reaches a human instead of being dropped.
    The report's dedupe key covers levels,
    so two genuinely different readings at one instant no longer collapse.
-   `meter-report` prints the level at both ends of the record.
    Two ends, because the last says what the budget is now
    and the first says which way it moved to get there,
    which separates a budget this run drained
    from one that was empty before it started.

### Why throttling earned its own field

Synthetic reads dry for three reasons that route identically:
the weekly budget empties,
the rolling window empties,
or the account is actively throttled while both still have room.
`syntheticThrottled=yes` beside a full window is the third,
and nothing in the record could previously show it.

### State

-   Committed before verification, per `AGENTS.md` `GCE`.
-   Build, lint, type-check and suite are OWED.
    None can run while the `#200` calibration holds `dist`:
    every mise task declares `depends = ["build"]`
    and would rewrite the bundle underneath a live run.

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

## The editor calibration never ran the naturalness lane at all (`#200`)

2026-08-24, found by watching the partial run rather than by reading code.

### The signal

Nine slices, every one reporting `0 refiner rounds`,
and `grep -i refine` over the whole run log returning
nothing but my own progress lines.
A stage that declines still logs;
a stage that never runs does not.

### The cause

`repairChunk` does not reach refinement.
It accepts `refinerModelIds` only so `repair-contract.ts` can compute
the union of models the slice must seat,
sets `refined: false`, and returns.
`runRefineStage` is called from `refine-slice-settle.ts`,
which the DOCUMENT driver runs afterwards, per slice, in `refine-phase.ts`.

So the module note in `editor-calibrate.ts` claiming

> IT REPORTS THE REFINER STANDING TOO, off the same spend

was false from the day it was written.
The refiner standing it printed was always going to be empty,
and an empty standing there would have read as
"the rewriters answered nothing",
which is a different and much worse claim than
"no rewriter was ever asked".

### The fix, in `f49cde75b`

`settleRefinedSlice` now runs on each slice off the same client,
and its rounds land on the outcome beside the accuracy lane's.
That call was already shaped for this:
it takes the `ChunkRepairOutcome`, the source, the incumbent and the models,
and derives eligible paragraphs itself.
Definitions are passed empty,
which is honest rather than a sentinel:
a drawn slice carries no document glossary behind it.

It also reports how many slices reached a rewriter at all.
A paragraph under the eligibility floor is never offered to one,
so a slice can buy the whole accuracy lane and reach no refiner,
and without that denominator the standing cannot be read.

### Why this mattered enough to fix mid-run

The refiner seat was reseated on 2026-08-24
on the same 40-round WRITING calibration the editor seat was.
It is exactly as unmeasured.
Measuring one seat while leaving the other
would have answered half the question `#200` exists for,
and would have done it while printing an empty table
that looked like an answer.

### What the partial run in flight will report

Its editor standing stands.
Its refiner standing will be empty,
and that emptiness means the lane was never run,
not that the rewriters were silent.
The full-roster re-run is the one that measures the refiner seat.

## The writer calibration had no silent-model list at all (`#200`)

Found 2026-08-24 by auditing `producer-calibrate.ts` against its own module note,
the same method that had just falsified `editor-calibrate.ts`'s note twice.

### What the audit confirmed and what it refuted

Three claims in the note hold:
`translatorModelIds: RUN_ROSTER` and `judgeModelIds: RUN_ROSTER`
really do seat every model as writer and judge,
self-votes really are discounted,
and every rate really does carry its count.

The suspected consensus blind spot is NOT there.
`editor-ensemble.ts:387` ships any sole candidate unjudged;
`translate-judge.ts:314` short-circuits only when the sole survivor IS the incumbent,
and its own comment gives the reason a sole FRESH candidate is still judged:
the repair pipeline's later safeguards,
the resolution checkers and the unchanged-versus-patched selection,
do not exist on the translate path.
On the editor path they do,
which is why the editor's short-circuit is a measurement gap and not a correctness one.

### The gap that was real

`producerStandings` carries a row only for a model somebody voted on.
A model its provider refused for budget writes nothing,
so it vanishes from the table,
and an absent row reads exactly like a model that wrote and lost.

`editor-calibrate.ts` named those models.
`producer-calibrate.ts` did not,
and that is the instrument that seated the current three writers,
on a day Charm Hyper was empty.

### What landed, in `eb60eac09`

`producer-silence.ts` splits a seated roster three ways:
judged, wrote but was never voted on, and wrote nothing at all.
The two silent groups are named separately because they call for opposite readings:
one is evidence already paid for,
the other is evidence nobody has bought yet.
The silent line carries both denominators, as `covers N of M seats`.

A standing or a slate naming a model the run never seated raises `UnseatedStandingError`,
since coverage of one roster cannot be read off another.
Both inputs are checked, because either one naming an unseated model
means the table and the roster came from different runs.

It is read AFTER the standings are printed in both callers,
so a run whose evidence disagrees with its own roster
still leaves every standing it paid for on stdout before the refusal.

`editor-calibrate.ts` drops its inline version and uses the shared one.

### A defect this found in the same file, introduced earlier the same day

`SliceRounds.shipped` was read off the REFINED outcome.
`issue-authors.ts:354` unions the editors with any refiner whose rewrite won,
so that field named both seats in one list,
printed under a heading a reader takes as editor credit.
With both rosters at all ten the mixing is invisible in the ids and wrong in the attribution.

The editor column now comes from the accuracy lane's own outcome, before refinement.
The refiner column comes from a new `refinedBy` on `RefinedSliceOutcome`,
which names the models whose rewrite is actually in the text that ships:
empty on a non-translation slice, on a rewriter that changed nothing,
and on a rewrite the recheck rolled back.
It is kept off the cached `RefinedSliceSettlement` for the reason `asked` is:
a slice resumed from disk bought no rewrite.

### Two tests were importing a path that does not exist

`artifact-rounds-read.unit.test.ts` and `digest-group.unit.test.ts`,
both written earlier the same day,
imported `../dist/final/node/index.mjs` from `src/corpus-run/`,
which resolves to `src/dist`.
The 72 sibling tests in that directory use `../../dist/`.
Both would have thrown at import.
Corrected before the suite ran, so the suite never recorded a green run over them.

### State

Code and tests landed in `eb60eac09` and `8ed5da052`.
`producer-silence.ts` was exercised directly against source ahead of the build,
which is what caught the silent line reading `compares 1 models and not 4`.

All four checks are green as of `fc5dca624`:
build exit 0,
unit suite 628 suites passing and 0 failing at exit 0,
oxlint 0 warnings and 0 errors,
and `tsc --build` clean.
The lint pass went from 164 warnings to 0,
and it caught an auto-fix that had changed behaviour:
rewriting `error instanceof Error` inside a template literal
moved the ternary outside the template,
leaving a non-empty string as the condition
so the branch was always taken on a value typed `unknown`.

Type-check found two source defects nothing else had:
`requireJudgedRound` declared `RepairJudgedRound` and returned six of its fields,
and `editor-standing-read.ts` referenced a `DirectoryReading` type it never declared.

Both new CLIs are verified at the user boundary.
`budget-sample` now prints
`METERS synthetic=wet hyper=dry syntheticWeekly=95.98% syntheticFiveHour=2750/2750 syntheticThrottled=no hyperBalance=0`,
and `meter-report` reads those levels back and prints them beside the verdict,
which closes `#202`.
`editor-standing-read` accounts for all 41 archived artifacts, none of them malformed,
which closes `#203`.

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

## The writer calibration's coverage report, verified live (2026-08-24)

Both calibrations gained a silence report earlier the same day
and neither new reporting path had ever run.
The finished 40-round writer run and the 29-round editor run
were both settled by the binary that preceded it.

A 3-slice writer calibration into `~/temp/agent/producer-coverage-vub-2026-08-24` closed that gap.
It printed:

```text
  WROTE NOTHING AT ALL: qwen3.8-max, minimax-m3, gemma-4-26b-a4b-it, deepseek-v4-pro-0813,
  deepseek-v4-flash-0731. No candidate of theirs reached any slate, so the table covers 5 of 10 seats.
```

All five Hyper-only seats named, the denominator right,
and no spurious "wrote and was never voted on" group,
since all five Synthetic writers drew ballots.
Charm Hyper was dry throughout, so the run also exercised the retry path:
`select: retry round 1 for 6 lost voices`, three times, before settling the slice.

The standing itself settles nothing at 3 rounds and says so in its own last line.
That was not what the run was for.

## The settled artifact speaks one vocabulary, as generation 3 (`#94`, 2026-08-24)

`withdrawnChunkIndices` sat beside `withdrawnSliceCount` in the same record,
about the same things.
`#99` is what that class of confusion costs.

Renamed, at 351 sites:

-   `shippedChunkIndices` becomes `changedSliceIndices`.
    Not `shippedSliceIndices`:
    the incumbent ships whenever the archive wording stands,
    so "shipped" reads ambiguously,
    while both arrays name slices whose returned text DIFFERS from the archive.
-   `withdrawnChunkIndices` becomes `withdrawnSliceIndices`.
-   `chunkCritics` becomes `sliceCritics`,
    with `ChunkCriticRecord`, `ChunkCriticView`, `buildChunkCriticRecords` and `decodeChunkCritics`.

`chunkIndex` is NOT in this change.
It gets its own change and its own verification, which landed as `#204` below.
The claim recorded here that it reaches cache keys was WRONG,
and is corrected in that section:
it reaches none of the six cache-key builders.

### Why the version moved, and why the symbols did not

A key rename is a shape change,
and `artifact-schema-version.ts` states that a version which does not move on one
is the failure that field exists to end.
So the pass writes generation 3.

`artifact-v2-build.ts` passes `lanes.repair` and `lanes.translate` through whole as `result`,
so the internal field names ARE the wire keys.
There was no internal-only step to land first:
holding the bytes still would have meant a mapping layer built only to be deleted by the next change.

The 63 `V2` symbols at 808 sites across 63 files did NOT follow the integer.
`V2` there names the TWO-LANE shape, not the number,
and the contract file now says so.
Renaming that family to something version-free is worth doing and is tracked separately.

### How both generations are read

`artifact-key-vocabulary.ts` holds three key names per generation and nothing else.
`parseSettledArtifactV2` reads the recorded version, selects one table,
and threads it two hops to `parseLanesV2` and the two evidence parsers.
`attribution-read.ts` does the same for `sliceCritics`, treating an unversioned artifact as generation 1.

No artifact is ever tried under two spellings.
A generation 3 stamp over generation 2 keys is refused, which is correct:
it is not a generation 3 file.

Generation 1 keeps its own spelling on disk, read and written.
Nothing writes that generation any more,
and re-spelling it would strand the files it left behind in exchange for nothing.

`assertResumableSchemaGeneration` moved with the writer,
so a run directory of generation 2 artifacts is now foreign to a resuming pass.
That is what the guard is for.

### Verified

Suite exit 0, lint 0 warnings and 0 errors, types clean, build clean.

GFP on the new spelling guard:
making the writer emit `shippedChunkIndices` under a generation 3 stamp
built cleanly and failed the suite at the `hasOwn` check,
which is the failure a fixture-only suite could never produce.

At the boundary, through the shipped bundle,
over the six real generation 2 artifacts in `~/temp/agent/vub-run1-20260821`:
all six read, all six generation 3 twins read,
and the two parses are identical on every interpreted field.
They differ only inside `lanes.*.raw`,
which is the file's own record passed through unread
and so carries the file's own spelling by design.
All six mislabelled files, generation 3 stamp over generation 2 keys, were refused.

### And live, end to end

One entry through the real pipeline,
`gaoyanger` into `~/temp/agent/gen3-vub-2026-08-24`, exit 0 in 975 seconds:

```text
TALLY gaoyanger status=SETTLED slices=2 repairStatus=repaired repairIssues=4 repairAccepted=3
repairResolved=3 repairChanged=1 translateChanged=1 documentsDiffer=1 selection=contested
```

Read back off disk:
stamped generation 3,
all three current keys present,
zero older keys,
and its own reader accepts it.
`verify-published` then agreed:
`1 of 1 pages carry every wording their artifact promised, at the length it implies`.

Charm Hyper was dry for this too,
so five of the ten seats lost their voice at every stage
and the entry settled anyway on the five that answered.
That is the resilience the owner asked for,
observed rather than asserted.

## The stamped index is `sliceIndex`, as generation 4 (`#204`, 2026-08-24)

Pass two of the vocabulary rename, and it was not the mechanical sed the plan described.
Two recorded premises were wrong, and each was corrected by measuring before acting.

### It reaches no cache key

`chunkIndex` appears in zero of the six cache-key builders.
The keys hash positional arrays, and `repair-slice-key.ts` records
that the slice index was removed from the key at version 26.
The earlier note in the `#94` section is corrected above.

### The name was already taken, by a different concept

`sliceIndex` already existed:
122 occurrences in 19 files, meaning POSITION in `prepared.slices`,
with `neighbouringSource`, `neighbouringIncumbent` and `slicePictures` throwing on a non-position.

A blanket rename collapses two concepts into one name
and recreates exactly the defect `#99` was opened on.
The attempt surfaced as two `TS2451` redeclarations in `translate-document.ts`
and would have been SILENT everywhere else.
It was reverted whole with `git checkout -- package/module/translation-repair/src` and split in two:

1.  `sliceIndex` to `slicePosition`, 122 sites in 19 files, freeing the name.
    Commit `6a3b24533`.
2.  `chunkIndex` to `sliceIndex`, 1734 sites in 194 files.
    Commit `49e5a41cd`.

Reading what broke, rather than trusting the count, is what caught this.

### The wire moved too, and generation 3 is a mixture

`artifact-v2-project.ts` maps the index explicitly, so holding the wire still was available here
in a way it was not for the arrays.
It was rejected:
a file spelling one half the new way and the other half the old way
is the defect this work exists to end.

So `artifact-key-vocabulary.ts` gains a fourth field and a fourth row,
and generation 3 becomes what it always was on disk: a MIXTURE.
Confirmed against the one real generation 3 artifact:
its `result` spells `sliceCritics` and `changedSliceIndices`,
and every one of its twenty-odd index keys spells `chunkIndex`.

`parseSettledArtifactV2` now names the generations it reads in a list
rather than a chain of comparisons, and five parsers plus one lane envelope
take the vocabulary rather than naming a key.

### Verified

Suite exit 0, lint 0 warnings and 0 errors, types clean, build clean.

Three guards GFP-proven, each shown to fail with the guard removed and then restored:

-   Collapsing the generation 3 mixture into the current table
    fails the vocabulary dispatch cases and the cross-generation equality,
    and makes the one real generation 3 artifact unreadable.
-   Making the writer spell the ledger index the old way while stamping generation 4
    fails the end-to-end settle in `pass-entry.unit.test.ts`.
-   Letting a ledger row tolerate both spellings
    fails the case pinning that a relabelled body is refused.

At the boundary, through the shipped bundle,
all 42 real two-lane artifacts under the agent scratch root read with no refusals
and no blank indices:
41 of generation 2 over 492 ledger rows, and 1 of generation 3 over 4.

That null result has a positive control.
Each file read under a generation it does not carry is REFUSED,
and each refusal names exactly the key the wrong table asked for:
generation 3 read as 4 refuses at `lanes.repair.delivery[0].chunkIndex`,
read as 2 refuses at `lanes.repair.result.shippedChunkIndices`,
generation 2 read as 4 refuses at the same delivery key,
and read as 3 refuses at `lanes.repair.result.changedSliceIndices`.

### And live, end to end

One entry through the real pipeline,
`gaoyanger` into `~/temp/agent/gen4-vub-2026-08-24`, exit 0:

```text
TALLY gaoyanger status=SETTLED slices=2 repairStatus=repaired repairIssues=9 repairAccepted=7
repairResolved=7 repairFindings=55 repairChanged=1 translateStatus=complete translateChanged=2
documentsDiffer=2 pageChanged=1 pageSilent=0
```

Read back off disk: stamped generation 4,
`sliceIndex` the only index spelling anywhere in the file,
zero of the three older array keys,
and its own reader accepts it with all four ledger rows carrying a numeric index.
`verify-published` then agreed:
`1 of 1 pages carry every wording their artifact promised, at the length it implies`.

Charm Hyper was dry for this too, so five of the ten seats had no voice at any stage
and the entry settled anyway on the five that answered.

## The read-any-generation dispatch never learned generation 3 (`#206`, 2026-08-24)

Found sweeping for stragglers of the rename above, and it is the more interesting find.

`readSettledArtifact` in `artifact-read.ts` is the barrel's entry point for reading an artifact
of any generation.
It compared the recorded version against version 1 and version 2 and nothing else,
so a generation 3 or 4 body fell through to the final throw
and was reported as a generation nothing reads.

THE COMMENT ABOVE THAT THROW CALLED ITSELF UNREACHABLE and named this exact drift:
"the day a generation is added to that list and forgotten here".
`#94` added generation 3 to `KNOWN_ARTIFACT_SCHEMA_VERSIONS` and did not add it here,
so every generation 3 artifact has been refused by this path for as long as the generation existed.

### What it did not cost

Nothing inside the package calls it.
The pass reads through `parseSettledArtifactV2` directly,
and `verify-published`, `assertResumableSchemaGeneration` and the attribution reader all bypass it.
So no run was affected and no artifact was misread.
A consumer of the barrel would have been.

### The fix, and why the list moved

`TWO_LANE_GENERATIONS` now lives in `artifact-v2-contract.ts` and is exported,
because TWO places decide something about the family:
the reader that accepts a body, and the dispatch that chooses that reader for a file.
Those two lists drifting apart is not a refusal but a WRONG ANSWER.
The final throw is re-commented as reachable rather than as unreachable.

GFP-proven: restoring the drifted form, naming the first generation alone,
fails the new case, which reads the same list and requires the two-lane reader to have ANSWERED
for every generation in it.

### The straggler class

Four names the bare-word rename could not reach, because each carries a prefix or suffix:
`_chunkIndex`, `earlierChunkIndex`, `laterChunkIndex` and `byChunkIndex`.
None reaches the wire, and no artifact on disk carries any of them.
A rename measured by counting a bare word will always leave this class behind;
the sweep that finds it is a case-insensitive search for the token as a SUBSTRING.

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

## The 53 indirectly-reached modules, branch by branch (`#209`, 2026-08-24)

`#208` closed the tier no test reached at all.
This is the next one:
the 53 modules the suite reaches only through a caller.
`TC2`'s question there is not whether the module is reached
but whether each implementation branch has a test,
or only the happy path does.

The shape of the gap is the same every time.
`parseSettledArtifactV2` calls `assertIndexSetsMatchLedger` on every valid artifact fixture in the suite,
thousands of times,
always down the arm where nothing was wrong.
That is coverage of the caller.
The refusal branches are what the module exists for,
and no valid fixture can reach one.

Ranked by branch density, measured with a brace-and-keyword count over each module.
The measurement lives in the session scratchpad;
the ranking is reproduced here because it is what the remaining work is ordered by:

```text
branches  code lines  exports  module
      31         239        1  align-headings-optimal.ts              DONE
      20         164        3  corpus-run/artifact-v2-read-set-relations.ts  DONE
      16         138        2  preservation-tokens.ts                 DONE
      14         131        1  lane-slice-sets.ts                     DONE
      12         127        2  translate-skeleton.ts                  DONE
      12         121        2  corpus-run/artifact-placement.ts       DONE
      12         118        5  corpus-run/artifact-v2-project.ts      DONE
      11         237        3  corpus-run/artifact-v2-read-consolidate-parts.ts  DONE
       9          66        1  stream-recurrence-watch.ts             DONE
       9         250        1  refine-slice-settle.ts                 DONE
       8          91        1  translate-retry.ts                     PROBED, already defended
       8         122        1  fidelity-splice.ts                     DONE
```

### What each landing proved, by mutation

Every module gets a mutation applied to the SOURCE, rebuilt, run, and restored.
What matters is not that the suite went red;
it is whether the new cases were the ONLY thing that noticed.

`align-headings-optimal.ts`, commit `5774615b8`.
Mutation G judged a pairing by its prefix alone,
replacing the backward-table term in `scanOptimalPaths` with a zero score.
16 failures, including every new aligner case.

`corpus-run/artifact-v2-read-set-relations.ts`, commit `299e2e6f3`.
Mutation A removed the position-by-position comparison from `assertListMatches`,
leaving a length check.
TWO failures, both new,
and NOTHING ELSE in the suite noticed:
before this, a lane recording the right indices in the wrong order was accepted,
and the ordering both contracts state was untested.
Mutation B made the whole-document refusal count as a guard withdrawal,
which two new cases and two existing `parseSettledArtifactV2` cases caught.

`preservation-tokens.ts`, commit `c367d77a0`.
Mutation C added a colon to `SENTENCE_ENDS`,
the exact regression the module's comment says made a deleted contributor name invisible.
Caught by the new colon case and by one existing `applyPatchOperations` case.
Mutation D stopped dropping one-character Latin words.
ONE failure, the new case, and nothing else.

`lane-slice-sets.ts`, commit `0c078ad36`.
Mutation E ran the archive rules BEFORE the disjointness pass.
Caught by the new ordering case and by one existing `buildLaneSliceTexts` case.
The ordering is contract:
a slice named by two lists disagrees with itself first,
so reporting which archive rule it breaks answers a question neither list has earned the right to ask.
Mutation F dropped the decided-at-once refusal, caught by two new cases and two existing ones.

`validateNamedSets` and `NamedSliceSet` reach the barrel as `@internal` so the test can exercise the shipped bundle,
which is the standing ruling on internals rather than a new exception.

`translate-skeleton.ts`, commit `e6d57da2c`.
Mutation G stopped a list saying whether it is ordered, caught by three new cases.
Mutation H stopped a footnote DEFINITION contributing an atom,
so only the marker survived.
ONE failure, the new case, and nothing else:
a translation dropping the definition and keeping the marker passed every structural guard in the suite.
`blockDetail` reaches the barrel as `@internal` so a case can ask what an absent `ordered` field means,
which no Markdown input produces.

`corpus-run/artifact-placement.ts`, commit `9244e8120`.
Mutation I made an unreadable digest unplaceable rather than legacy,
and mutation J let an artifact carrying no id skip the identity check;
the census already covered both, which is the honest result and the reason the third was run.
Mutation K accepted uppercase hex as an object id.
ONE failure, the new case, and nothing else:
git writes lowercase, so two spellings of one commit would have counted as two generations.

`corpus-run/artifact-v2-project.ts`, commit `6aebccf27`.
Mutation L spread the live ledger record instead of rebuilding it through a literal,
caught by the new key-list case and by one existing `buildSettledArtifactV2` case.
Mutation M aliased `undecidedLanes` instead of copying it.
ONE failure, the new case, and nothing else:
the artifact outlives the run, and a reader mutating what it read would have reached back into the builder's own comparison.

`corpus-run/artifact-v2-read-consolidate-parts.ts`, commit `caf4ca0f2`.
Mutation N let text ship from a slice that settled on no change,
and mutation O read the ballot evidence lists as prose rather than as rendering names;
`parseConsolidationV2` already covered both, which is the honest result.
Mutation P let an unchanged slice carry text it does not ship.
ONE failure, the new case, and nothing else.

`stream-recurrence-watch.ts`, commit `670a552d6`.
THE STRONGEST RESULT IN THIS TIER, and the one that came from measuring rather than reading.
The runaway watch's own tests already prove this detector's headline claims,
so a duplicate file would have restated them.
Before writing anything, two diagnostic mutations asked what the suite actually defends:
setting the consecutive-hit threshold to 1 was caught,
and REMOVING THE TRAILING-BUFFER TRIM LEFT THE WHOLE SUITE GREEN.

That trim is a correctness rule, not an optimisation.
It decides how far apart two copies of a passage may be before the earlier one stops counting.
A reasoning trace in this pipeline restates whole candidates verbatim,
so one quoted near the start and again near the end is ordinary work,
and without the trim the early copy stays findable forever
and the second quotation reads as a loop that kills a healthy voice.
The new case is exactly that pair of distant quotations,
and re-running the same mutation after it landed produced one failure:
the new case, and nothing else.

### A runner behaviour worth knowing before reading any of this

A failing `await describe(...)` REJECTS, and a rejected top-level await ends the module.
Later `describe` blocks in the same file never run.
So a mutation report naming two failures out of five suites is not evidence the other three passed:
they may not have executed.
Read a GFP result as "these cases fired", never as "only these cases were affected",
unless the failing suite is the last one in its file.

### Two barrels split on the way

Adding `@internal` exports so the tests could reach the shipped bundle
pushed two files past the 300-line budget, and both were split by audience rather than shortened.
`corpus-barrel.ts` gave up the version 2 READER family to `artifact-read-barrel.ts`,
leaving 252 lines against 52.
`index.ts` gave up the stream-watching family to `stream-barrel.ts`,
leaving 265 against 41.
`index.ts` composes both, so no importer sees either seam.

### The eleventh landing: the join rule that hides a seeded deletion

`fidelity-splice.ts` holds one export, `spliceOutSentence`,
and one importer, `fidelity-damage.ts`,
whose own cases ask whether a seeded sentence disappeared.
Every join rule answers that identically, including no join rule at all,
so the whitespace decision the module exists for was invisible to the suite.

PROBE W1 confirmed it before a line of test was written.
Removing the line-break precedence from the private `survivingRun`,

```ts
  if (lineBreaksIn({ run: before, },) !== lineBreaksIn({ run: after, },)) {
    return (lineBreaksIn({ run: before, },) > lineBreaksIn({ run: after, },))
      ? before
      : after;
  }
```

left only the two boundary rules and the length tiebreak,
and the whole suite stayed green at 653 verdicts, exit 0.

WHAT THAT BRANCH DECIDES. A paragraph cut from the middle of a page
sits between a paragraph break and whatever follows.
Without the rule the longer run wins, so a two-character `\n\n`
loses to a three-space gap and two paragraphs collapse onto one line
with a triple space at the join.
That is precisely the typographic edit-mark the module note says it exists to prevent,
and it would let a damaged candidate lose a fidelity trial on tidiness
rather than on the coverage the trial means to test.

Sixteen cases landed in `src/fidelity-splice.unit.test.ts`, one rule each:
both arms of the line-break comparison,
both boundary rules and the order they are asked in
(the only observable case is a cut that reaches both ends at once),
the length tiebreak and its equal-weight fallback,
the ideographic and no-break spaces the Chinese half of the corpus separates with,
first-occurrence-only removal,
and the two runs of length zero.

GFP: re-applying probe W1 fails exactly the two line-break cases
and the suite aborts at 654 PASS / 3 FAIL, exit 1.
Restored, rebuilt, back to 654 / 0.

### `translate-retry.ts`: probed, already defended, no file written

Probes V1 and V2 were both caught by existing `runTranslateStage` cases.
Recorded here rather than left as a gap:
the module is reached indirectly, and its branches are covered through its caller.

### Suite size across the eleven landings

636 suite verdicts before `#209`,
654 after the eleventh,
with exit code 0 each time and the FAIL count read off the runner's own `] FAIL ` prefix.

Eight mutations were caught by the NEW CASES ALONE,
which is the part that says a gap existed rather than a rule being restated:
the index ordering comparison,
the one-character-token rule,
the footnote definition atom,
the lowercase-only object id,
the undecided-lanes copy,
the unchanged slice carrying text,
the trailing-buffer trim,
and the line-break precedence in the splice join.

## Charm Hyper got credit, the full roster is running, and a run's cost is now measured (2026-08-25)

The owner bought 10,000 hypercredits.
`budget-sample` confirmed it live before anything was launched:

```text
METERS synthetic=wet hyper=wet syntheticWeekly=97.09290877272727%
syntheticFiveHour=2750/2750 syntheticThrottled=no hyperBalance=10000
```

Both providers wet at once, which is the window `#200` had been waiting for since the 14-slice run of 2026-08-24 settled no seat.

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
