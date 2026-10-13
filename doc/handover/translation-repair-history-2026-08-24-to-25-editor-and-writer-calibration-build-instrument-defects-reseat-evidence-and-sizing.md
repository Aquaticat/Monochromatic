# Translation repair history 2026-08-24 to 2026-08-25: the editor and writer calibrations, the editor build, the defects in both instruments, the evidence on the reseat and the sizing of a run

Two provenance notes,
moved unedited from the working handover,
that name the sections aged out of it,
the editor calibration built once its blocker proved imaginary,
the refiner lane it never ran and the silence report the writer calibration lacked,
what settled artifacts already say about the editor seat,
the cases where zero rounds does not mean nothing was repaired,
how many slices a calibration needs and the power inputs measured on the live run,
the finished fourteen-slice run that settles no seat,
and the second calibration launched to pay the owed measurements.

Part of [Translation repair history: 2026-08-24 to 2026-08-25](translation-repair-history-2026-08-24-to-25.md),
which lists every file of this record.

Historical evidence only:
no next-action list here is a current instruction,
and the stop condition in the index applies.

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

## The refiner column is thinner than the editor column, by about four times

Measured on the live calibration at 33 of 40 slices,
while checking why one slice reported
zero refiner rounds.

### The first version of this section was wrong by an order of magnitude

It claimed the two columns differ by "roughly fifty times in round count".
That compared
1023 LOG LINES against 20 ROUNDS,
which are not the same unit.
`selectBestCandidate` emits
three different line shapes,
and only one of them is a round:

```text
918 per-judge ballots      "<model> chose candidate N at weight N: <reason>"
 90 decided rounds         "candidate N from <model> won weight N across N ballots"
 14 tied rounds            "judges tied at weight N; keeping the fallback"
```

The error was counting all three as if each were a vote.
Recorded rather than quietly
corrected,
because the wrong number pointed at a real and expensive action.

### What the rounds actually are

`runRefineStage` judges through the SAME `selectBestCandidate` (`src/refine-stage.ts:328`)
with the whole roster as judges,
so refiner rounds are already inside those counts:

```text
104 rounds total   (90 decided + 14 tied) at 33 slices
 20 refiner rounds (15 with a winner, 5 tied or declined by every judge)
 84 editor rounds  by subtraction
```

That is about 4.2 editor rounds per refiner round,
not 50.

Every decided round carries a real panel:
865 ballots over 90 rounds,
mean 9.6,
min 7,
max 10.
Refiner rounds draw from the same roster,
so 20 of them is on the order of 190
ballots at 33 slices,
projecting to roughly 230 at 40.

The reason the refiner ballot count looked absent is that `runRefineStage` puts it in a
FINDING string rather than its log line (`src/refine-stage.ts:436` writes
`refine-selected (weight N of N ballots)`),
while the log line carries only the winning
weight.
Nothing was missing;
it was being read in the wrong place.

### What that changes

The alarm was overstated.
A column with roughly 230 ballots is not obviously short,
and
there is no longer a prior that a second batch is needed before the landing.

STILL READ THE ACTUAL STANDING AT EXIT rather than this projection.
Ballots are not
independent within a round,
`#200` already records a sqrt(2.9) within-slice deflation for
exactly that reason,
and 15 decided refiner rounds spread across six seats is a thin base
for a ten-seat Bonferroni comparison however many ballots sit under it.

So the exit order is unchanged from the rehearsed procedure,
with one added reading:
if the refiner standing's own denominator turns out short,
`#200` records that the remedy is
a second batch of 80 poolable slices,
and that pooling needs no drift opt-in only while the
build does not change.
The landing changes the build.
That constraint is real and worth
keeping in view;
what has changed is that it is now unlikely to bind.

## The run's power inputs, measured at 38 of 40 slices

`#200` projected from a 16-slice reading.
These are the figures the standing will actually
rest on,
measured rather than projected,
and two of them moved in opposite directions.

```text
slices seen                     38
contributing (>= 1 round)       31   82%
empty (0 rounds, nothing to edit) 7
total judged rounds            131
rounds per contributing slice  4.23
```

Seven empty slices is not a fault.
`editor-calibrate.ts` names this case explicitly:
a slice
can buy the whole accuracy lane and have nothing to edit.
`#200` recorded one live slice
doing it;
there are now seven,
and they simply contribute nothing to either column.

### Both inputs moved, and they largely cancel

The 16-slice reading had 75 percent yield and 2.54 rounds per slice;
the 14-slice selftest
had 2.90 rounds per contributing slice,
giving a sqrt(2.90) = 1.70x deflation.

Now yield is BETTER at 82 percent,
and rounds per contributing slice is WORSE for power at
4.23,
because within-slice correlation deflates by sqrt of that:
2.06x rather than 1.70x.

These are not independent problems.
Raw z grows as sqrt(total rounds),
and the deflation
divides by sqrt(rounds per contributing slice),
so the deflated z grows as

    sqrt(total rounds / rounds per slice) = sqrt(contributing slices)

THE EFFECTIVE SAMPLE IS THE NUMBER OF INDEPENDENT SLICES,
NOT ROUNDS.
Extra rounds bought
inside one slice buy precision about that slice,
not about the roster.
So the figure that
decides the standing is 31 contributing slices,
on track for roughly 33 at 40,
against the
10 that produced a deflated best z of 1.76 in the selftest.

### Do not turn that into a prediction

`#200` already refused this,
and its reason still holds:
the effect size being scaled was
measured on FIVE models,
and the pooled preference rate roughly halves at ten seats,
so the
implied z can move either way.
`standing-from-log.mjs` derives the Bonferroni critical value
from the row count,
so it will use the ten-seat threshold rather than the selftest's 2.58,
and it applies the deflation itself.

Read the printed standing.
The value of these numbers is that they make it INTERPRETABLE:
when a seat clears or fails,
the reason is 31 independent slices deflated by 2.06x,
and both
halves are now measured rather than assumed.

## A second calibration is in flight, to pay four measurements the landing left owed

Launched 2026-08-25T14:14Z,
detached,
40 slices,
the same command the first calibration used:

```sh
TRANSLATION_REPAIR_RUNS_DIR=~/temp/agent/editor-calibrate-postguard-20260825 \
  mise run //package/module/translation-repair:editor-calibrate -- 40
```

Log at `~/temp/agent/editor-calibrate-postguard-20260825.log`.

THE SHAPE IS COPIED DELIBERATELY.
Two of the four things this run owes are RE-derivations
rather than first measurements,
and a re-derivation against a differently shaped population
answers a different question than the one asked.
Matching slice count,
roster and command is what makes the comparison legible.

Meters before launch,
from `budget-sample`:

```text
METERS synthetic=wet hyper=wet syntheticWeekly=91.03581431818182% syntheticFiveHour=2750/2750 syntheticThrottled=no hyperBalance=9683
```

### What to read off it

-   `#215`'s achieved concurrency,
    from `run-timing-report`.
    The first calibration could not answer this:
    the round lines it reads did not exist
    until `#215` landed in `b6ea1cc51`,
    so `NO ROUND LINE` on that log was a true absence
    rather than a quiet zero.
    This replaces the audit's 1.45 hour straggler upper bound with a measurement.
-   `#214`'s straggler window,
    re-derived against a population that now contains runaways.
-   `#221`'s zero-content recount per seat.
    The number to beat is `deepseek-v4-pro-0813` at 36 of 356 completed streams.
    Falling to zero confirms one reading of that row;
    staying near 36 confirms the other.
    `qwen3.8-max` is expected to stay high and to be an accounting artifact either way,
    since it is the sole `toolChoice: 'auto'` seat and its answer arrives as tool-call
    arguments that `generatedChars.content` does not count.
-   `#213`'s serialization question,
    which was blocked on `#211` and `#215` and is now free.

### While it runs

Nothing goes through `mise`,
per the corpus-pass runbook's step 4:
every pass and probe task
declares `depends = ["build"]`,
so invoking one rewrites `dist/final/node` underneath the
running pass.
Read the log with built entry points directly instead.

The pass was launched from `a93c0892d`,
with the working tree clean and the field confirmed
clear beforehand by argument-vector inspection rather than by a recorded pid.
