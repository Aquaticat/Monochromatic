# The window trial: what it measures, what it cost to make it measure that, and what it still cannot say

Tracks `#108`, which exists because of `#107`:
per-slice judging cannot tell a relocation from a fabrication,
and condemns the archive for both.

## The question

Some slices are flagged by a size screen as relocation candidates:
the translation of one passage appears to have been moved into another passage's slot by the human translator.
Judged in isolation, the receiving slice carries English the original does not account for,
which reads as fabrication,
and the judges replace it.

The hypothesis is that showing the judges the neighbouring Chinese section lets them recognise a move,
and keep the archive's wording.

## The design that survived

Per slice:
produce ONE slate of candidates,
then put that same slate to the judges three times.
Two arms see no window;
one sees the neighbouring original.

The two narrow arms exist because judges are stochastic.
A narrow-to-wide difference means nothing until it beats the difference between two narrow runs over the same slate.

One slate is what `#109` split `runTranslateStage` to allow.
Before the split, asking a slice twice resampled the candidates,
so two answers differed in the slate as well as in the evidence
and no reading could say which moved the verdict.

Rows are appended to a JSONL ledger as each arm completes,
keyed on a protocol digest built from the roster,
the corpus pin,
the head sha and the trial's own version,
so a rerun after any of them moved cannot pool two experiments.

## The measured draw

Measured against the pinned corpus,
not estimated:

-   93 entries, of which 29 contribute a flagged slice.
-   109 slices: 19 `relocation-high`, 21 `relocation-low`, 24 `other-imbalance`, 12 `target-only`, 4 `untranslated`, 29 `control-unflagged`.
-   327 judgings and 2616 model exchanges at roster width 6.
-   Zero slices have a blank neighbouring window.

## Six defects found before spending anything

Every one of these would have produced a report that read clean.
Listed with what each would have done to the number.

### Resumption never matched an arm it had bought

`trialKey` joined its fields on a NUL byte;
the runner joined the same fields on a space.
Both render identically in every reader checked,
including the Read tool used to verify it,
so `completedArms` returned keys the runner could never find.
Every resumed run would have re-bought every arm already on disk,
and had it also completed a partly bought slice it would have judged the remaining arms over a fresh slate.

Found by pasting the raw files to a reviewer that reads bytes.
Both callers now go through `trialKey`,
which encodes rather than joins.
The regression test runs the arms twice against a real ledger file;
it was shown to fail with the mismatch re-introduced.

### Resumption re-introduced the confound `#109` removed

A kill between arms left a partial triple,
and the next run finished it over a freshly produced slate.
Nothing recorded slate identity,
so the ledger held a triple whose arms disagreed about the candidates as well as the evidence,
undetectably.
A partly bought slice is now skipped rather than finished.

### A lost judge looked like a kept archive

`gatherStageVoices` retries only to a quorum of half the roster and then proceeds,
so an arm that lost three of six judges was written as an ordinary decision.
The wide arm sends the longest sheets under the same per-call deadline,
so degradation lands asymmetrically on the arm under test,
and a degraded round declines, which keeps the archive:
the bias runs in exactly the direction the trial predicts.

Rows now carry the panel each arm decided on,
and the report drops any triple where an arm was short,
counting those separately from missing arms.
This also excludes the two short-circuit paths in `judgeTranslateSlate`,
`no-candidate` and `sole-candidate`,
which return `EMPTY_TALLY` and would otherwise have entered the tally as judge-decided keeps.

### The wide arm was always the last call

Arms were bought narrow, narrow, wide, every time.
Anything drifting across a slice's three back-to-back calls landed entirely on the wide arm,
and the two narrow arms could not detect it,
because they occupied two positions while the wide arm sat at a third neither ever took.
Each slice now takes an order derived from its own identity,
deterministically,
so the wide arm sits first, second and last in roughly equal numbers across the draw.

### Every control was an opening

At one control per entry the stride was the whole document,
so only position zero survived:
the control class would have been made entirely of the first unflagged slice of each entry,
which the draw's own comment says judges read differently.
The stride is now centred.

### The protocol digest guarded buying but not reading

The ledger is append-only and outlives any one experiment.
Resumption already skipped foreign rows;
the report read every one of them.
`reportWindowTrial` now takes the protocol and excludes the rest.

## Two smaller ones

A window of blank lines passed the emptiness check,
so a slice whose neighbour carried only whitespace would have run a wide arm differing from its narrow arm by nothing.
Now trimmed.

A slice that could not be tried raised out of the walk,
and since a refusal writes no ledger row,
every resumption would have redrawn it, reached it and died at it again.
Refusals are now counted and stepped over,
with the run stopping if five come in a row,
since a slate is produced before any arm is judged.

## What is reported

Per class:

-   `pairedExcess`, the mean over read triples of the two narrow arms' replacement rate minus the wide arm's. Positive means the window reduced replacement. This is the primary number.
-   `entries`, the documents those triples came from, because slices are not independent observations.
-   The wide-against-narrow transition counts in both directions.
-   The narrow-against-narrow band, which is the negative control.
-   `incomplete` and `degraded` counts, so the reader can see how much of the class the analysis covers.

## What this still cannot say

Stated plainly because a number without these caveats is worse than no number.

### The screen does not provide relocation ground truth

`classifyDisplacement` produces relocation CANDIDATES, not verdicts.
A lower replacement rate on this population establishes that neighbouring Chinese changed decisions on a size-screened mixture.
It does not establish that judges recognised relocations.
Narrowing that claim needs the candidates hand-labelled.

### The primary population is 19 slices

`relocation-high` is the only class the treatment can mechanically reach,
and the corpus yields 19 of them at this screen.
The earlier measured replacement rate is 0.83 to 0.94,
so most slices will replace in both arms and discordant pairs will be few.
A null on 19 slices is weak evidence,
and no amount of care in the instrument changes that.

### The wide prompt changes several things at once

Semantic neighbouring information, prompt length, evidence position and context-limit exposure all move together.
Separating the semantic part needs a fourth arm carrying length-matched IRRELEVANT Chinese:
real neighbour against sham neighbour tests semantic relevance,
sham against narrow tests the effect of extra context as such.
That is a design expansion, not a fix, so it is a question rather than a change.

### The denominator is rows that exist

The report derives its population from the ledger,
so a slice that failed before writing any row is absent rather than incomplete.
A frozen draw manifest, validated before the client is built, would fix that.
The refusal counter and the run log cover the operational need for now.

## Open questions for the user

1.  Is a fourth sham-context arm worth roughly a third more quota, to separate semantic relevance from extra context as such?
2.  Should the relocation candidates be hand-labelled before the result is quoted as being about relocations, or is the narrower claim, that neighbouring Chinese moved decisions on a size-screened population, enough?
3.  `relocation-low` slices are bought and reported but the treatment cannot reach them: neighbouring CHINESE cannot say where missing ENGLISH went. Keep buying them as a within-trial control, or drop them and spend the quota on repeats of the high endpoints?

## Commits

Reachable on `translation-repair-rebased`:

-   `f18476ae7` compose the window trial probe
-   `84b21b3f3` live window check, build entry, mise task
-   `d950af5e8` four validity fixes (partial-triple resume, short panel, control stride, refusal wedge)
-   `45cb13e07` resumption key mismatch
-   `e3f830344` protocol filtering, relocation endpoint split, blank window
-   `6890cd2bf` counterbalanced arm order
-   `a969e0293` paired estimate as the primary number

## Next action

The run is live against a throwaway `TRANSLATION_REPAIR_RUNS_DIR`.
Read `pairedExcess` per class against the narrow band,
and read `relocation-high` separately from everything else.
