# Translation repair history: segment 2.2

Part of the [translation repair history index](translation-repair-history.md).

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## Continued record

### Preserved chronological continuation

```text
PROBE  entries=1 shippedRecords=35 unprobedRecords=0 regions=13
       majorityIntroduced=1 minorityIntroduced=1 noneIntroduced=11
CLAIMS added=1 dropped=2 contradicted=0 unanchored=0 degradedRosterRegions=0
```

FOUR THINGS THIS SETTLES.

The plumbing works end to end on real output,
not only on fixtures:
35 shipped records,
0 unprobed,
every one carrying telemetry the reader could
parse.

THE DEDUPE IS NOT A DETAIL.
Thirty-five shipped records collapsed to THIRTEEN
distinct regions,
a factor of 2.7.
Summing over records rather than envelopes
would have inflated every count by that much,
and nothing downstream would have
looked wrong.

The probe is not silent on real data.
The earlier "eight regions,
zero claims"
reading was a small sample and has now moved:
three claims across thirteen
regions,
one region drawing a majority and one a minority.

THE OMISSION DIRECTION IS EARNING ITS PLACE.
Two of the three claims are
`dropped`,
meaning wording present before the edit and absent after.
Under the
forward-only screen this session started with,
those two claims could not have
anchored at all.
The fix advisor caught is now validated on corpus data rather
than on a cat fixture.

ALSO WORTH NOTING:
zero contradicted and zero unanchored.
Every claim the
probers made resolved against the region it was about,
so the verbatim-quote
requirement is being honored rather than worked around.

WHAT IT DOES NOT SETTLE:
one entry.
`majorityIntroduced=1` of 13 regions is
about 8 percent,
which is the rate a gate would have blocked,
and whether those
blocks would have been RIGHT is exactly what the repair grades decide.
Do not
read 8 percent as a defect rate;
read it as the population `refutedByHuman` will
be measured against.

### Coverage gap CLOSED (2026-08-06)

Re-measured after the work below:
of 192 exported functions,
2 are named by no
test,
down from 33.
Both are deliberate and are listed here so nobody reopens
them as oversights.

`applyCandidate` is a pure delegation to `applyPatchOperations`,
which has
its own suite.
Its one plausible misuse,
swapping the arguments,
is a type
error because `EditableEnvelope[]` and `PatchOperation[]` are distinct.
A
test there asserts nothing the compiler does not.

`runCriticStage` runs on every case of the `runChunkCriticPhase` suite,
which scripts critic replies and asserts wire-level vote counting,
resolution
failures reaching findings,
and heard-critic accounting.
Its branches execute;
only its name is absent.

TWO LIVE DEFECTS came out of writing these,
both in code that looked fine:

`requireRecord` delegated to `isJsonRecord`,
whose test is
`typeof value === object && value !== null`,
so an ARRAY satisfied a guard
whose entire doctrine is throwing loudly.
Fixed locally rather than in
`isJsonRecord`,
which nineteen modules share for values where arrays are fine.

The refiner prompt fenced both the original chunk and every paragraph with a
fixed `=====`.
Enclosed text carrying that line closes its own block early,
so
the rest of the paragraph reads to the model as instructions.
`=====` is a
setext heading underline,
a shape real documents contain.
Not currently
triggered (no corpus file carries a five-or-longer equals run,
checked first),
fixed because `candidate-select-wire.ts` and the probe already settled this
with `selectFence`.

TWO LATENT FRAGILITIES are documented rather than changed:
`bandOf` duplicates
`classifyBand` with the same two cuts,
now pinned by an agreement test;
and
`ensembleRecall` never intersects hits with the seed universe,
safe only
because `prepare-entry.ts` and `gradeHits` derive both from one list.

METHOD NOTE WORTH KEEPING:
four of my own fixtures were wrong before the
toolchain or a reviewer caught them.
Two asserted shapes production cannot
produce (a duplicate seed hit;
two records sharing one model and entry),
one
asserted bug-shaped output as expected (`ensembleRecall > 1`),
and one
compiled only because a cast stopped TypeScript checking the literal
(`refusal-shaped` carries `marker`,
not `detail`).
Before writing a case,
check the shape can occur;
before trusting a passing case,
check nothing cast
the fixture into silence.

### Coverage gap: 33 exported functions no test names

Measured 2026-08-06 while acting on the user instruction "Fix even pre-existing
issues."
Of 192 exported functions,
33 are never named in ANY test file.
Two
groups were closed the same day (the `artifact-guard.ts` guards,
and
`spliceSlices`);
this records the rest so the next session does not have to
re-derive it.

HOW TO REPRODUCE.
Extract every `^export (async )?function NAME` from
`src/*.ts` and `src/corpus-run/*.ts`,
then for each name grep `--word-regexp`
across every `*.unit.test.ts`.
Names with zero hits are the gap.

TWO MEASUREMENT TRAPS,
both of which caught me.

Sibling-file absence is NOT the measure.
`align-blocks-walk.ts` has no
`align-blocks-walk.unit.test.ts`,
yet `alignBlocks` is thoroughly tested from a
neighbouring suite.
Counting modules without sibling tests reported 34 modules;
counting functions no test names reported 33 functions,
and they are different
sets.
Indirect coverage through a tested caller is real coverage (TC2),
so the
function-level count is the honest one.

Matching import blocks by indentation is NOT the measure either.
A first pass
read names out of import statements with a two-space-indent pattern and
silently missed every single-line and differently-indented import,
reporting
`normalizePunctuation` as untested when five tests name it.
Use `--word-regexp`
across the whole test file.

WHAT IS STILL UNCOVERED,
grouped by what a defect would cost.

Selection and measurement,
where a defect moves the milestone number:
`compareCandidates`,
`computeScorecard`,
`selectCreditableIssues`,
`classifySourceAnchor`,
`corroboratedCount`,
`downgradeCount`,
`applyCandidate`.
Note on `compareCandidates`:
its caller
`selectRepairCandidate` IS tested,
so the branches run,
but the comparator's
own ordering is never asserted directly.
That is the function issue #53 is
about.

Sampling,
where a defect biases the sheet the gate is graded on:
`bandOf`,
`countSettledPerBand`,
`rankWithinBands`,
`smallBandIds`,
all in
`corpus-run/band-order.ts`,
which has no test at all.

Wire guards,
where a defect admits a malformed model reply:
`isCandidateBallotWire`,
`isRefineReportWire`,
`resolveRefineRewrites`,
`collectDefinitions`,
`groupNodesAligned`,
`buildRefineMessages`,
`buildEditorCandidates`,
`assertJudgeableProducerRoster`.

Network stage runners,
testable only with an injected scripted client the way
the `createSyntheticClient` suite already does:
`runCriticStage`,
`runPanelStage`,
`runCheckerStage`,
`runEditorStage`,
`runChunkCriticPhase`,
`attemptStageCall`,
`exchangeWithRetry`.

Run-tooling IO,
lowest value since a failure there is loud and immediate:
`createRunClient`,
`readHeadSha`,
`resolveRunsDir`,
`readAttemptMap`,
`openSliceCache`,
`discardSliceCache`,
`listResumableEntries`.

WHY THIS IS WORTH DOING rather than noting.
Writing the `artifact-guard.ts`
suite took one pass and immediately found a real defect:
`requireRecord`
delegated to `isJsonRecord`,
whose test is `typeof value === 'object' && value
!== null`,
so an ARRAY satisfied a guard whose entire stated doctrine is
throwing loudly rather than returning a fallback.
That hole sat in the layer
feeding the precision measurement.
The gap list is not bookkeeping;
it is where
the next defect of that kind is.

PKG makes this a completeness condition,
so the package is not finished while
the list is non-empty.
It is also entirely zero-quota work,
which makes it the
right thing to reach for whenever a corpus pass is holding the provider budget.

### Trigger rate at seven entries: numerator still one

```text
PROBE  entries=7 shippedRecords=188 unprobedRecords=0 regions=72
       majorityIntroduced=1 minorityIntroduced=5 noneIntroduced=66
CLAIMS added=5 dropped=2 contradicted=0 unanchored=0 degradedRosterRegions=0
```

THE NUMERATOR HAS NOT MOVED ONCE.
Across 1,
5,
6,
and 7 entries the count of
regions a gate would have blocked has stayed at exactly 1 while the denominator
went 13,
67,
68, 72.
Reading that as roughly 1.4 percent is the wrong emphasis;
the shape is that a SECOND blocking region has not appeared at all across
seventy-odd regions of real corpus output.

WRONG,
AND KEPT HERE AS THE MISTAKE IT WAS.
A second blocking region did appear,
at 18 entries,
and by 38 entries the count was 8 across 508 regions,
about 1.6%.
"Roughly 1.4 percent" was the right emphasis all along and this paragraph
talked itself out of it.
One event cannot distinguish a rare thing from an
absent one,
and dressing a small numerator up as a qualitative shape is how a
sample size gets mistaken for a finding.
The corrected series and the reasoning
are in `doc/decision/introduced-defect-probe-gating.md`.

WHAT IT MEANS FOR ISSUE #53.
Every option on the table (fall back to a
runner-up candidate,
salvage by dropping confirmed-defective operations and
revalidating,
reject the whole chunk) is machinery that runs only when the probe
confirms a defect.
At one region per seven entries,
a salvage pass that must
reapply from the original target and rerun judging,
checking,
probing,
measurement,
and selection buys one region of preserved repair per seven
entries.
That is the cost-per-trigger the decision turns on,
and it is measured
rather than projected.

WHAT IT DOES NOT MEAN.
This is the rate a gate would FIRE at,
not a defect
rate.
Whether that single blocking region was right is what the repair grades
decide,
and `refutedByHuman` is the cell that answers it.

ALSO CONFIRMED HERE:
the tightened `requireRecord` (which now refuses an array)
read all seven settled artifacts without throwing,
so that change is verified
against real data rather than only against fixtures.

### The trigger rate at five entries, and why the one-entry reading misled

Five entries settled (`AmbeR_the_anpa`,
`Arita`,
`Acheron`,
`Anilovr`,
`Chinatsu_Suzuki`) and `score-probe` read all of them:

```text
PROBE  entries=5 shippedRecords=179 unprobedRecords=0 regions=67
       majorityIntroduced=1 minorityIntroduced=5 noneIntroduced=61
CLAIMS added=5 dropped=2 contradicted=0 unanchored=0 degradedRosterRegions=0
```

THE HEADLINE IS THE DENOMINATOR.
`majorityIntroduced` did not move at all:
it
was 1 at one entry and is still 1 at five.
The region count went from 13 to 67.
So the rate a gate would fire at is about 1.5 percent of regions,
not the 8
percent the first entry suggested,
and the single blocking region found so far
is one region across five entries rather than one per entry.

THIS IS THE CONSTRAINT ANY DESIGN OPTION MUST CLEAR.
Every option on the table
for issue #53 (fall back to another editor candidate,
salvage by dropping
confirmed-defective operations and revalidating,
reject the whole chunk) is
machinery that only runs when the probe confirms a defect.
At roughly one region
per five entries,
a salvage pass that must reapply from the original target and
rerun judging,
checking,
probing,
measurement,
and selection buys one region's
worth of preserved repair per five entries.
Cost per trigger is the number to
argue about,
and it is now measured rather than guessed.

WHAT MOVED INSTEAD IS THE MINORITY COLUMN:
`minorityIntroduced` went from 1 to
5,
tracking the region count almost exactly.
Probers keep making claims;
what
stays rare is a MAJORITY of them agreeing on the same region.
That is the shape
you would expect from an instrument with real but noisy sensitivity,
and it is
the opposite of the "silently broken,
always negative" failure the sensitivity
check was built to rule out.

STILL ZERO contradicted and ZERO unanchored across 67 regions.
The
verbatim-quote requirement is holding at scale,
not just on the first entry.

THE METHOD LESSON,
AGAIN:
this session already withdrew a checker finding taken
off n=1,
wrote down that n=1 on a stochastic ensemble proves nothing,
and then
quoted an n=1 probe rate as a design constraint anyway.
The rule is not "be
careful with small samples",
it is DO NOT QUOTE A RATE WHOSE DENOMINATOR IS ONE
ENTRY.
Re-run `score-probe` as entries settle;
it costs no quota and reads only
local artifacts,
so there is never a reason to be working from the stale one.
