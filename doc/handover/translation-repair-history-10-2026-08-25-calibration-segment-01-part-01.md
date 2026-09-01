# Translation repair history: 2026-08-25 calibration

Part of the [translation repair history index](translation-repair-history.md).

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## Six sections aged out of the working handover on 2026-08-25 (second round)

Moved verbatim under the rule the working handover preamble sets:
history takes closed work whose conclusion is already encoded in the code,
and superseded reasoning kept only for its evidence.

KEPT IN THE WORKING FILE DELIBERATELY:
the sections a reader needs to INTERPRET the
standing when the calibration exits,
namely "Zero editor rounds does not mean nothing
was repaired",
"How many slices an editor calibration needs",
and "The 14-slice editor
calibration finished,
and it settles no seat".

## `#201` landed: availability is recorded, readable, and samplable

Four commits on 2026-08-24,
all pushed.

### What shipped

-   `provider-budget.ts` logs `METERS synthetic=<state> hyper=<state>` at `info`
    on every meter reading,
    once per sixty-second freshness window.
    Since 8f774f34f the line also carries the numbers each state was read from;
    see the `#202` section.
    It was already computing this and saying it at `debug`,
    which runs do not record.
-   The meter now has three states.
    `meterRecordOf` (named `meterStateOf` until 8f774f34f) reports
    `wet`,
    `dry` or `unreadable`,
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
Prose does not do that;
a record truncated part way through its second field still does.
Confirmed both ways:
the real log now reads `unread=0`,
and the fixture's planted undated record still reads `unread=1`,
so the gate did not simply switch the detection off.

### State

-   Lint 0 warnings 0 errors on 845 files,
    types clean,
    619 suites pass,
    0 fail.
-   One reading exists so far:
    2026-08-24T18:17:35.383Z,
    `synthetic=wet hyper=dry`.
    Charm Hyper has been dry all day;
    Synthetic is up.
-   The record only grows from here,
    so the numbers are worth reading again after the next few passes
    rather than now.

### What is left

-   `#200`,
    an editor-role calibration,
    is still open and still needs its shape decided.
-   `#94`,
    the slice rename,
    is still deliberately deferred.

## `#200`: the editor calibration is built, and its blocker was imaginary

### The finding that unblocked it

The task was held because a settled artifact exposes neither the envelopes nor
the issues an editor worked from,
so the claims looked unreplayable,
and the
choice looked like an artifact schema change or inventing claims as fixtures.

Neither is needed.
`ChunkRepairOutcome.rounds` already carries,
per round,
the
slate judges saw with each candidate's producer attached,
and every ballot cast
over it,
and both sides name the same `CandidateProducer` and `SelectionBallot`
out of `candidate-select-model.ts`.
That is `SelectionRound` one re-shape away.

So the calibration drives the lane live and reads what it records.

### What shipped

-   `repair-selection-rounds.ts` projects recorded rounds into the standing's
    shape,
    sorting by the position judges were shown and REFUSING a slate whose
    positions are not one to its length.
    A ballot names a candidate by number,
    so that is the assumption which cannot be checked afterwards.
-   `producer-standing-report.ts` holds the rendering both calibrations share.
-   `editor-calibrate` drives the whole repair lane,
    all ten editing and all ten
    judging every slice,
    and reports the EDITOR and REFINER standings off one
    spend.

### The one deliberate divergence from production

Checkers self-certify in this runner and nowhere else.
Production forbids a
checker proving its own repair,
and a full editor roster leaves nobody
independent when the roster is ten;
rotating editors out would reintroduce the
survivorship the shape exists to avoid.
Safe here because checking runs after
selection:
the ballots a standing reads are cast before any checker is asked.

### What is still owed

The MEASUREMENT,
which needs a full roster.
Charm Hyper has been dry all day,
so
a run now seats five of ten and produces exactly the survivorship the shape
prevents.
`budget-sample` makes the recovery observable;
run the calibration
once a sample shows `hyper=wet`.

A one-slice smoke run was made against the dry roster to prove the runner
executes.
It ran 7m18s and exited 0:
the checker assertions passed with the full
roster seated,
the five Hyper-only models were refused as lost voices,
and the
lane continued on the five that answered.

IT REPORTED ZERO ROUNDS,
AND THAT IS THE LANE WORKING.
Critics raised two claims
on that slice,
the panel adjudicated two issues,
and the lane then said
`chunk 5: nothing to edit, unchanged`,
because neither issue was ACCEPTED.
No
editor is asked to write on a slice like that,
so no round exists to count.

ADJUDICATED IS NOT ACCEPTED,
and that governs how the real measurement must be
sized.
A slice can buy ten critics and a ten-model panel and contribute nothing
to an editor standing.
The default of six slices may well yield very few rounds;
draw generously and read the new "from N of M slices" line before trusting a
standing.

Because a null from a probe never shown able to produce a non-null says nothing,
there is now a positive control in the unit suite:
real-shaped rounds driven
through the projection and the tally together,
asserting a standing falls out
with its counts.
That is what makes the live zero readable as "this slice had
nothing to repair" rather than "the instrument produces nothing".

## `#202`: the record carries the numbers, not only the verdict

One commit on 2026-08-24,
8f774f34f,
pushed.

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
a reading was being computed,
used,
and then dropped.

### What shipped

-   `syntheticMeterLevel` and `hyperMeterLevel` in `budget-routing.ts`
    render `key=value` tokens from the same snapshot
    the dryness verdict is read from.
    One read,
    so a verdict and its numbers cannot describe different moments.
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
    Two ends,
    because the last says what the budget is now
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

-   Committed before verification,
    per `AGENTS.md` `GCE`.
-   Build,
    lint,
    type-check and suite are OWED.
    None can run while the `#200` calibration holds `dist`:
    every mise task declares `depends = ["build"]`
    and would rewrite the bundle underneath a live run.

## The editor calibration never ran the naturalness lane at all (`#200`)

2026-08-24,
found by watching the partial run rather than by reading code.

### The signal

Nine slices,
every one reporting `0 refiner rounds`,
and `grep -i refine` over the whole run log returning
nothing but my own progress lines.
A stage that declines still logs;
a stage that never runs does not.

### The cause

`repairChunk` does not reach refinement.
It accepts `refinerModelIds` only so `repair-contract.ts` can compute
the union of models the slice must seat,
sets `refined: false`,
and returns.
`runRefineStage` is called from `refine-slice-settle.ts`,
which the DOCUMENT driver runs afterwards,
per slice,
in `refine-phase.ts`.

So the module note in `editor-calibrate.ts` claiming

> IT REPORTS THE REFINER STANDING TOO,
> off the same spend

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
it takes the `ChunkRepairOutcome`,
the source,
the incumbent and the models,
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
judged,
wrote but was never voted on,
and wrote nothing at all.
The two silent groups are named separately because they call for opposite readings:
one is evidence already paid for,
the other is evidence nobody has bought yet.
The silent line carries both denominators,
as `covers N of M seats`.

A standing or a slate naming a model the run never seated raises `UnseatedStandingError`,
since coverage of one roster cannot be read off another.
Both inputs are checked,
because either one naming an unseated model
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

The editor column now comes from the accuracy lane's own outcome,
before refinement.
The refiner column comes from a new `refinedBy` on `RefinedSliceOutcome`,
which names the models whose rewrite is actually in the text that ships:
empty on a non-translation slice,
on a rewriter that changed nothing,
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
Corrected before the suite ran,
so the suite never recorded a green run over them.

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
`budget-sample` now prints:

```text
METERS synthetic=wet hyper=dry syntheticWeekly=95.98% syntheticFiveHour=2750/2750 syntheticThrottled=no hyperBalance=0
```

and `meter-report` reads those levels back and prints them beside the verdict,
which closes `#202`.
`editor-standing-read` accounts for all 41 archived artifacts,
none of them malformed,
which closes `#203`.

## SUPERSEDED: the deepseek zero-content anomaly, first reading (2026-08-25)

RESOLVED LATER THE SAME DAY.
The heading this section used to carry said the anomaly was not
resolvable from the log.
That is no longer true,
and the resolution is in
`doc/audit/every-volume-guard-is-blind-to-one-model.md` and in the section named
"Two more findings from the same run".
The counts here were right;
what was wrong was the conclusion drawn from them.

WHAT THIS SECTION STILL GETS RIGHT,
and why it is kept rather than deleted:

-   The method lesson.
    The instrument used for CAUSE here was a 40-line scan
    window,
    and a positive control on `hf:openai/gpt-oss-120b` showed it fired on
    39 percent of healthy calls.
    Nine samples against that baseline separate
    nothing.
    That reasoning was correct and is worth keeping.
-   The `hf:zai-org/GLM-5.2` distinction,
    which the later measurement depends on:
    its zero-content count EQUALS its cut count,
    so those zeros are unfinished
    calls rather than the `#211` signature.
    The later count reads only COMPLETED
    streams,
    which is why GLM shows zero there and why
    `deepseek-v4-pro-0813`,
    with 12 zero-content against 0 cuts,
    is the real
    anomaly.

Re-measured over the calibration's first 13 slices,
1176 stream lines parsed and none skipped.

### What the counts say

-   `qwen3.8-max`:
    100 calls,
    98 zero-content,
    17 cut.
    So 81 COMPLETED calls counted nothing.
-   `deepseek-v4-pro-0813`:
    101 calls,
    9 zero-content,
    0 cut.
-   `hf:zai-org/GLM-5.2`:
    100 calls,
    10 zero-content,
    10 cut.
    Zero-content EQUALS cut count.
-   `hf:Qwen/Qwen3.8-27B`:
    2 and 2.
    Every other seat:
    zero and zero.

GLM-5.2 and Qwen3.8-27B are the ordinary case,
streams that ended before content arrived.
GLM-5.2's ten carry a median of 2.3 million raw characters,
which is runaway reasoning meeting the straggler deadline,
not a parsing fault.
Every zero-content call on every seat carries reasoning above zero,
so none of them is a genuinely empty reply.

### Why the log cannot settle deepseek's nine

The only correlate available is whether a voice from that seat appears near the stream line.
That instrument has a measured baseline of 39 percent on HEALTHY calls:
`hf:openai/gpt-oss-120b` has 102 completed calls with content
and only 40 of them are followed by a voice within ten seconds,
because most streams are editor or refiner production calls that produce no ballot line at all.

Against that baseline:

-   `qwen3.8-max`'s zero-content calls score 35 percent,
    indistinguishable from healthy.
    That is independent confirmation of `#211`:
    its answers arrived,
    only the counter was fooled.
-   `deepseek-v4-pro-0813`'s nine score 11 percent,
    where the baseline predicts about three and a half.
    On nine samples that separates nothing.

An earlier reading of this scanned forty lines after each occurrence and reported the seat present in six of nine.
That was wrong:
the window spanned neighbouring calls and was catching another round's voice.

### What answers it, for free

The candidate ledger from `#212` records which model produced each candidate
and which cast each ballot,
with no timing correlation involved.
The first run carrying a ledger answers this without a single extra call.
Until then the honest state is:
measured,
unexplained,
nine events,
and not folded into `#211`.

## Aged out of the current handover on 2026-08-26 (register item A-5)

The sections below moved here verbatim from `doc/handover/translation-repair.md` on 2026-08-26,
when that file stood 1586 lines over its cap.
Nothing in them was edited;
each is closed work whose
conclusion is encoded in the code or in a decision record,
kept here for its evidence.

## The settled artifacts already carry editor rounds, and they do not support the reseat

2026-08-24,
found while checking whether an artifact records who was reachable.

### The premise that was wrong

`#200`'s section above says a settled artifact "exposes neither the envelopes nor
the issues an editor worked from".
That is true,
and it is about the editor's INPUTS.
What it does not say,
and what I had recorded elsewhere as a reason replay was impossible,
is that the OUTPUTS are absent too.
They are not.
Every repair chunk carries `rounds`,
each with the slate judges saw,
each candidate's producer,
and every ballot cast:

```text
stage envelope  slate [(1, Kimi-K3), (2, GLM-5.2)]
ballots [(GLM-5.2, 2), (Qwen3.8-27B, 2), (Kimi-K3, 2), (Nemotron, 2), (gpt-oss-120b, 1)]
```

That is exactly what `repair-selection-rounds.ts` projects and `producerStandings` counts.
So an editor standing can be computed over work already paid for,
spending nothing.

### What the existing record says

230 rounds across 18 artifacts,
fragmented over nine pipeline digests.
Pooling across digests is what `artifact-pool.ts` exists to refuse,
so each is reported alone.
EDITOR standing,
by digest,
largest first:

-   `b998af64`,
    4 entries,
    61 rounds:
    Kimi-K3 40.9%,
    GLM-5.2 38.9%,
    GLM-4.7-Flash 13.1%.
-   `2384524b`,
    6 entries,
    36 rounds:
    Kimi-K3 39.5%,
    GLM-5.2 36.5%,
    GLM-4.7-Flash 19.6%.
-   `6b21df94`,
    1 entry,
    33 rounds:
    Kimi-K3 50.3%,
    GLM-5.2 41.0%,
    GLM-4.7-Flash 11.4%.
-   `3850dc98`,
    2 entries,
    31 rounds:
    GLM-5.2 47.0%,
    Kimi-K3 33.7%,
    GLM-4.7-Flash 16.6%.
-   `266fca75`,
    1 entry,
    11 rounds:
    GLM-5.2 39.3%,
    GLM-4.7-Flash 25.4%,
    Kimi-K3 24.6%.
-   `851f8020`,
    1 entry,
    5 rounds:
    Kimi-K3 60.9%,
    GLM-5.2 25.0%,
    GLM-4.7-Flash 8.0%.

### The reading

GLM-4.7-Flash is last on five of six digests and never above 25.4%.
That is consistent and it is the one thing here worth calling a result.

KIMI-K3 AND GLM-5.2 ARE NOT SEPARABLE BY THIS RECORD.
They alternate first place across digests,
which is what noise looks like,
and no digest carries enough independent entries to say otherwise.

THAT IS THE POINT,
because on 2026-08-24 GLM-5.2 was removed from both writing seats
on the strength of the 40-round producer calibration,
which measures WRITING.
`#200` exists because editing is a different job.
The editing record already on disk does not show GLM-5.2 as a weaker editor than the model that kept the seat.
It does not show it as stronger either.
It shows the reseat was made on evidence that does not speak to this seat,
and that the seat is still unmeasured.

Its replacement,
Qwen3.8-27B,
appears in one digest only,
`f24b27e5`,
one entry,
8 rounds,
60.0% of 35 disinterested ballots.
Too thin to read as anything.

### What this record cannot do

-   IT IS OBSERVATIONAL.
    Only seated models ever wrote a candidate,
    so it ranks the three that held the seat and is silent about the other seven.
    `gemma-4-26b-a4b-it`,
    seated on 08-24,
    has never written an editor candidate at all.
-   ROUNDS INSIDE ONE ENTRY ARE CORRELATED.
    Entry counts are 1 to 6,
    so the effective sample is far smaller than the round counts.
-   JUDGES VARIED between runs,
    and nothing here holds them fixed.

So it corroborates and it cross-checks;
it does not replace the controlled calibration.
It raises the value of finishing `#200`,
and it lowers the confidence in the current seating.

## Zero editor rounds does not mean nothing was repaired (`#200`)

2026-08-24,
found by watching the partial calibration rather than by reading code.

### What the log showed

Slice 2 of the run,
`coin` chunk 3:

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
nothing was accepted,
or everything agreed.

### What it changes about the measurement

-   A model whose text the rest of the ensemble reproduces word for word
    wins nothing and appears nowhere.
    The old `WROTE NOTHING` line would have named it beside a model
    whose provider was out of budget,
    which are opposite facts.
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

2026-08-24.
Read off the archive,
spending nothing.

### The rate

Across every settled artifact carrying rounds,
109 repair chunks,
counting `envelope` and `chunk-patch` rounds only:

-   55 of 109 chunks,
    half of them,
    produced any editor round at all.
-   1.76 editor rounds per chunk overall.
-   3.49 per chunk that produced any.

Per digest,
chunks / contributing / rounds:

-   `19244`:
    32 / 2 (6%) / 4.
    The outlier,
    and it is `xiept2-anchorfix`:
    most of its chunks changed nothing.
-   `b998a`:
    21 / 17 (81%) / 61.
-   `23845`:
    18 / 11 (61%) / 36.
-   `3850d`:
    16 / 11 (69%) / 31.
-   `6b21d`:
    10 / 7 (70%) / 33.
-   The four smallest run 50% to 67%,
    1.25 to 3.67 rounds per chunk.

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
1 of them contributing,
2 editor rounds.
That is a lower rate than production,
but 25% against 50% on four slices is inside the noise,
and production's own per-digest spread runs 6% to 81%,
which is wider than the gap.
NOTHING HERE SAYS THE HALVED ROSTER YIELDS LESS.
It is a plausible mechanism,
since five models leave fewer distinct proposals
than ten and consensus ships without a round,
and it is not measured.
The full-roster run is what would measure it.

### The efficiency this does establish

A settled entry of ten chunks leaves about eighteen editor rounds on disk,
for nothing,
as a side effect of work already bought.
`editor-standing-read` reads them.
It ranks only the three models that held the seat,
so it cannot replace a calibration that seats ten,
but any release pass now pays for an observational standing as a by-product.

## The 14-slice editor calibration finished, and it settles no seat (`#200`)

Ran 2026-08-24 into `~/temp/agent/editor-calibrate-synthetic-2026-08-24`,
finished in 9496 seconds,
exit 0.

### What it measured

29 judged editor rounds,
from 10 of 14 slices,
across 492 disinterested ballots.

    hf:Qwen/Qwen3.8-27B                  34.7%  (34 of 98)
    hf:moonshotai/Kimi-K3                27.9%  (29 of 104)
    hf:zai-org/GLM-5.2                   25.0%  (23 of 92)
    hf:nvidia/NVIDIA-Nemotron-3-Super    15.5%  (15 of 97)
    hf:openai/gpt-oss-120b                7.9%  (8 of 101)

The refiner seat produced zero rounds,
because the binary that ran predates the fix that made the runner drive the naturalness lane at all.
That fix is in source and will take effect on the next run.

### Why it settles nothing

FIVE MODELS,
NOT TEN.
Charm Hyper held a zero balance for the whole run,
confirmed live against `GET /v1/credits` before,
during and after,
so `qwen3.8-max`,
`minimax-m3`,
`gemma-4-26b-a4b-it`,
`deepseek-v4-pro-0813` and `deepseek-v4-flash-0731` wrote nothing.
`gemma-4-26b-a4b-it` currently HOLDS an editor seat,
so the run is silent about one of the three incumbents it was meant to test.

AND THE FIVE IT DID MEASURE DO NOT SEPARATE.
Against the pooled null of 22.15 percent,
`hf:Qwen/Qwen3.8-27B` reaches z 2.99 and `hf:openai/gpt-oss-120b` z -3.44,
both past the Bonferroni threshold of 2.58 for five comparisons.
But those 29 rounds come from 10 slices,
2.9 rounds per slice,
and rounds inside one slice are correlated.
Charging the worst case,
that all rounds within a slice are one observation,
divides every z by sqrt(2.9) and NOTHING clears:
Qwen falls to 1.76 and gpt-oss to 2.02.

The truth is between those two readings and this run cannot say where.
No seat changes on it.

### What it is good for

It is directionally consistent with the writer calibration of the same day,
where `hf:Qwen/Qwen3.8-27B` also led and `hf:zai-org/GLM-5.2` sat below the null.
It also confirms the instrument works end to end on a real repair lane:
critics,
panel,
editors,
judges and checkers all ran,
and 10 of 14 slices carried an accepted issue,
which is the yield the sizing note predicted.

### What is still owed

A full-roster run,
once Charm Hyper has credit.
The owner cannot reset that provider on demand,
so this waits on the provider's own schedule rather than on anything askable.
Sizing from production yield says 35 to 40 slices,
not 14.

## What the suite actually reaches, measured (2026-08-24)

Run after `#204` closed,
to answer the package-completeness rule with a number instead of a feeling.

Over all 507 source modules of the package:

-   386 are DIRECTLY exercised:
    they have a sibling `.unit.test.ts`,
    or one of their exports is named somewhere in the suite.
-   53 are reached only through an exercised importer.
-   40 are reached by NOTHING.

Of those 40,
37 are `corpus-run/` operator CLIs and probes.
Each ends in a top-level entry call and is exercised by being run,
which is a different kind of evidence and not one the suite can give.

The other three were the finding:

-   `repair-blocked-exit.ts`,
    dead since `#110`,
    deleted as `#207`.
-   `producer-standing-report.ts`,
    live but reachable only through calibration CLIs no test drives.
    It renders the share of disinterested ballots each model won,
    which is what `#199` seated the writers on.
    Covered now,
    and the ordering rule is GFP-proven:
    treating an UNJUDGED model as a zero share fails the case,
    because a model with no evidence and a model measured at zero are different findings.
-   `coverage-candidates.ts`,
    same shape.
    Covered now at both scales,
    and GFP-proven:
    dropping the block scale from the list fails the case.

### Two other layers, while looking

ZERO real TODO,
FIXME,
HACK or deprecation markers in the package.
The two apparent hits are a `U+XXXX` doc example
and a case-insensitive match inside the identifier `toDocumentNode`.

66 lint suppressions,
of which ZERO are bare:
every one carries a ` -- ` justification,
which is what `LN5` asks for.

## `#217` is built, GFP-proven and parked (2026-08-25)

Built in the fork worktree `/var/home/user/worktrees/verify-empty`,
checked out at `e8430d094`,
because the change edits `src/` and the calibration's slice cache is keyed on the pipeline digest.
It cannot be committed from there:
that worktree has no `node_modules/.bin/git`,
so the policy wrapper is absent.
It is parked as `~/temp/agent/verify-empty-217-218.tar.gz`,
which carries `#218` as well,
and is applied over the main worktree in the landing sequence.
The tarball was checked against the main worktree before parking:
all six modified files are byte-identical to the fork's base commit,
and all three new files are absent there,
so it applies without clobbering anything.

### What was wrong

`namesUnder` answered an absent directory with an empty array and printed the absence with `console.error`.
Stdout therefore read `verify-published: matched=0 settledWithNoPage=0 pageWithNoArtifact=0`,
then `verify-published: 0 of 0 pages carry every wording their artifact promised`,
and `process.exitCode` stayed 0.
An empty runs directory and a run whose every page agreed produced the same report and the same exit code,
so a mistyped `TRANSLATION_REPAIR_RUNS_DIR` read as a green run.
