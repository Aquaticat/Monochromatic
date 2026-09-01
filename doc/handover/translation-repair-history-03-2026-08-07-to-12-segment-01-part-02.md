# Translation repair history: segment 1.2

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

Follow `doc/runbook/translation-repair-round-three-grading.md`,
which is
current.
NOTHING IN THIS SESSION HAS READ THE DETECTION SHEET,
so the blind pre-grade
 comparison is still clean.
Keep it that way.

### What is running

Corpus pass run 012,
logging to `pass8-run-012.log`.
It is the FIRST pass whose artifacts carry the naturalness audit,
which is why
 restarting it mattered.
Read its `DONE` line rather than its exit code:
 a pass exits 0 on its soft budget with most of the corpus unprocessed,
and
 elapsed always overruns the budget because the budget stops it STARTING
 entries while those in flight finish.

### Landed this session

-   The gate sheet drawn at 18 entries,
    5/7/5 contributing,
    pool 740,
    after the
     user chose to draw rather than accumulate further.
    Per-entry slot counts confirmed the round-robin empirically:
     `Dethelly` (198 candidates) and `Jennife80677612` (12) both got 3 slots.
-   Blind pre-grades for all 50,
    49 scored and 1 handed over.
-   Three defects that produced confident wrong numbers rather than failures:
     the probe join keyed ownership off region issue lists (many-to-one,
    so a
     graded position could receive another record's verdict);
     the majority rule compared CLAIM counts against a roster headcount;
     and an unguarded top-level `await main()` meant importing the LIBRARY ran a
     corpus scan.
-   The naturalness lane is audited (task 58),
    validated live against injected
     damage before being trusted.
-   Every item of task 62 (draw and probe-scoring durability).

### The correction worth carrying forward

`doc/decision/introduced-defect-probe-gating.md` claimed the corroboration rate
 was "roughly 1 in 120 and has stayed there rather than climbing."
That was written on TWO events and was not supportable;
 the interval around 2 in 246 comfortably contains the 7 in 412 measured later.
The sentence is withdrawn rather than updated.
At 38 entries it reads 8 in 508,
about 1.6%,
spread one apiece across distinct
 entries.
The deferral still stands,
but on "low and unvalidated" rather than on a column
 that barely moves.

### Open, in the order they unblock

-   #60 needs the human grades.
    When scoring,
    subtract `refinedJoined` FIRST:
    10 of the 50 positions have a
     probe verdict about wording the naturalness lane replaced,
    so those rows
     compare two different texts.
-   #48 closes with #60,
    since the agreement rate needs the same grades.
-   #63 is the deferred design work,
    now unblocked by the draw being spent:
     bind sheets to an exact draw by digest,
    and stop the telemetry reader
     returning claims with empty quote fields.
-   #51 and #31 are untouched and need quota,
    so they contend with the pass.

## Run 012 settled, and the naturalness audit has its first live numbers

Run 012 ended on its SOFT budget,
not on a fault.

```text
DONE processed=4 of pending=54; artifacts=42/92 elapsed=43529854ms
SOFT budget reached after 43529854ms; not starting new entries
```

Two entries settled (40 to 42 artifacts) out of 4 processed.
`Y1Ran` burned its full 3-hour per-entry deadline and ended `status=ERROR
 aborted=true`.
Per #61 that costs a restart rather than an entry:
 `attempts.json` shows `Y1Ran: 1`,
so its banked chunks resume on the next
 attempt.
Throughput was poor and the log says why,
in the drain lines rather than in any
 pipeline stage:
 first-byte times of 43s,
112s,
143s,
161s,
191s,
217s and 262s on a single
 stage,
and one critic round losing 6 of 6 voices to the 360s deadline before
 the retry recovered all six.
That is provider latency,
recorded here as an observation with its evidence and
 NOT as a trend:
it is one run.

RUN 013 IS RUNNING,
launched from the same task at the same tip,
log
 `pass8-run-013.log`.

### The first REFINEMENT line, and how not to misread it

`score-probe` at 42 entries:

```text
PROBE       entries=42 shippedRecords=1791 unprobedRecords=0 regions=583
            majorityIntroduced=12 minorityIntroduced=67 noneIntroduced=504
CLAIMS      added=60 dropped=32 contradicted=1 unanchored=2
            degradedRosterRegions=0
REFINEMENT  rewrittenSlices=9 majorityIntroduced=1 minorityIntroduced=3
            noneIntroduced=5 added=3 dropped=2 contradicted=0 unanchored=1
```

The audit built in #58 is producing output on live corpus data.
Three artifacts carry it (`Toka_ls`,
`SS3B_0016`,
`TianqiChen666`),
being the
 ones settled since the lane was instrumented.

WHAT THESE NINE SLICES DO NOT SUPPORT:
any rate,
and any comparison against the
 accuracy line.
n IS 9.
The two lines count different units,
rewritten slices against replaced
 envelopes,
which `score-probe.ts` states at its own REFINEMENT summary;
 setting 1 in 9 beside 12 in 583 would be a ratio between incompatible
 denominators AND a rate from single digits.
That is the same move withdrawn from
 `doc/decision/introduced-defect-probe-gating.md`,
which asserted a stable rate
 on two events.
Report the counts with their denominator and stop there until the sample grows.

What IS supportable at n=9:
the lane's audit is wired end to end,
it reports
 non-zero,
and it does not report zero everywhere (which would have been the
 signature of a probe that never fires).
The `noneIntroduced=5` cell matters as much as the flagged one:
a probe reading
 every rephrasing as damage would have flagged all nine.

### Checked rather than assumed, for whoever picks up #63

The suspicion that a re-draw could overwrite the MANIFEST while `wx` protected
 the sheets is FALSE.
`corpus-run/draw-sample.ts` uses one `writeFlag` for all three outputs,
and a
 final draw sets it to `wx`,
so a final draw creates every output exclusively or
 creates none.
The digest binding is still worth building,
for a different reason:
 the sheets print no issue id anywhere,
so a header is the ONLY thing that can
 tie a sheet to the items it was drawn from.

## Task 63 landed: sheets bind to a draw, and the reader stops faking claims

Both halves are built,
tested,
and exercised on the real command path.

### The binding

Sheets are joined to their manifest BY POSITION,
and the only check was that
 both declared the same seed and the same corpus pin.
That check cannot do the job it was asked to do.
The draw is deterministic in its SEED but not in its POOL,
the pool grows with
 every entry that settles,
and so one seed at one corpus commit names a
 different set of items at different times.
Two draws can agree on seed,
on pin,
and on item count while describing
 different issues;
 the join would then mislabel every verdict and error nowhere.

Now all three outputs carry a digest over the ordered item identities
 (`position`,
`entryId`,
`issueId`),
plus the seed and pin,
under a
 `sample-draw/v1` domain prefix.
It is computed ONCE per draw,
from the manifest object both sheets are rendered
 beside,
so the three files cannot disagree about the thing that exists to prove
 they agree.
Canonicalized through `JSON.stringify`,
never a delimiter join:
 an entry id containing the delimiter would otherwise let two different draws
 hash alike,
which is the SYB failure in miniature.

`parseSampleManifest` RECOMPUTES the digest rather than trusting the stored
 string.
A digest never checked against its own contents proves only that two files carry
 the same characters,
so editing the items and leaving the digest alone would
 still match a sheet carrying the stale value.

Positions are now checked against where each item sits.
`requireCount` admits zero and admits any ordering,
while both scorers read
 grades by ARRAY INDEX and take the issue id from the item at that index,
so a
 manifest recording another order described one join while the code performed a
 different one.

### Two defects found on the way, neither in the original task

`score-agreement` had NO manifest check at all,
and looked up pre-grades under
 a fixed default seed while `--sheet` could point anywhere.
An earlier round's graded sheet scored against this round's pre-grades would
 have reported a confident agreement rate between unrelated draws.
It now derives the pre-grade path from the seed the sheet declares,
and
 validates a manifest.

The first version of that check sat AFTER the early return taken when no
 pre-grades exist,
so it never ran.
The unit tests passed the whole time.
What caught it was running the real command against a deliberately mismatched
 pair:
two preliminary draws from pools of 304 and 364 candidates at the same
 seed and pin,
then scoring the first sheet against the second manifest.
It printed the precision line and no refusal.
The check now runs before anything is reported.

### Legacy sheets are scoreable, and say so

A missing digest is a NOTE,
not a refusal.
Round three was drawn before the binding existed,
and a final draw refuses to
 overwrite itself precisely because a sheet may already carry hours of grading,
 so refusing would strand work nothing can reproduce.
Verified:
both scoring commands still run against the real round-three files and
 print the weaker-binding note.
The round-three files were NOT backfilled with a digest.
Writing into a sheet the user may open at any moment buys a retroactively
 trusted association,
which is not what the digest is for.

### The reader half

`ProbeClaimAttribution`,
`TelemetryRegionTally` and `TelemetryProbeReading` name
 what the artifact reader actually returns.
It parses `modelId` and `admissibility` and drops every quote field,
because
 those carry unlicensed corpus text into a summary meant to be pasteable;
 it used to satisfy the full claim type by writing `''` into all five text
 fields,
which is a claim shaped exactly like a complete one.
A caller reading `claim.evidence` could not tell "not parsed" from "quoted
 nothing",
and only the first is ever true,
since the screen cannot admit an
 unanchored claim as corroborated.

Region parsing moved to `artifact-probe-tally.ts`.
That was forced rather than chosen:
the refinement audit had pushed
 `artifact-probe-read.ts` to 326 code lines against a 300 cap,
which the package
 lint reported and the previous session did not re-run after landing it.

### A methodology trap worth carrying forward

`*.unit.test.ts` files import `../dist/final/node/index.mjs`,
the BUILT bundle,
 and `lint:types` does NOT type-check them.
So `mise run //package/module/translation-repair:test:unit` on its own tests the
 PREVIOUS build,
and a green run right after a source edit means nothing.
Use `buildAndTest`.
Two green runs were collected here before that was noticed,
and neither had
 executed a line of the new code.

### Two follow-ups from the task 63 review, one closed and one recorded

CLOSED:
absence was accepted ASYMMETRICALLY.
A legacy sheet paired with a NEW manifest passed under the weaker check,
as did
 a bound sheet whose manifest carried nothing.
One draw writes all three files in one instant and always computes a digest now,
 so a one-sided pair was assembled from two draws,
which is the case the binding
 exists to refuse.
It throws now,
and `requireSheetSeed` replaced the
 `identity.seed || DEFAULT_SAMPLE_SEED` fallback for the same reason:
 measured first,
every grading and repair sheet in the runs directory carries a
 `Draw seed` header (only the gate verdicts do not),
so the fallback was
 unreachable for real input and only ever a way to place an unplaceable file
 under whichever round is current.

RECORDED,
NOT CLOSED:
the pre-grades file carries no draw identity at all.
It is a bare position-to-verdict map with keys `"0"` to `"49"`,
joined by
 position like everything else here.
Deriving its path from the seed the sheet declares is enough for round three,
 because the one-shot draw guard means exactly one draw ever held that seed.
It is not enough in general,
and the fix is a schema change to a file that
 currently exists once,
on disk,
in the middle of the measurement it feeds.
Do it when #48 and #60 close,
not before.

## Run 013, and the naturalness lane failing without saying so

```text
DONE processed=5 of pending=50; artifacts=47/92 elapsed=43783207ms
```

Five entries settled,
none lost to the per-entry deadline,
which is a better
 return than run 012's two.
Entries:
`Y1Ran` (resumed from its run 012 abort,
per #61),
`SevenBird`,
 `Uekawakuyuurei`,
`TLL1122`,
`cheonwoomaeng`.

### What the numbers looked like, and why that was the tell

At 47 entries the accuracy probe had grown from 583 regions to 666,
while
 `REFINEMENT rewrittenSlices` had not moved from 9.
Not one of run 013's five entries carries a single `refined: true` record.

The cause is in the log and is unambiguous:

```text
24 refiner hf:moonshotai/Kimi-K3: schema-mismatch, voice lost
 6 refiner: retry round 1 for 1 lost voices    (also rounds 2 and 3)
```

Six refinement attempts,
four tries apiece,
every one lost.
Run 012's log carries ZERO refiner lines,
because a lost voice is what gets
 logged and run 012 never lost one.
So between two consecutive runs on unchanged pipeline code the lane went from
 working to producing nothing,
which makes it a provider-side change rather than
 a regression anyone introduced here.
`Y1Ran` reads `1/1 heard` only because its refine finding came back with its
 banked slices from run 012.

### Why nothing reported it

The lane is ONE model.
Every other stage retries to a quorum and reports a degraded roster;
 a roster of one has no quorum to lose,
so total failure moved no number that
 anything printed.
The refinement audit stayed at 9 and printed no note,
because its zero-note only
 fires when the total is zero and the total was non-zero from run 012.
A stage that had stopped working was indistinguishable from a stage nobody had
 asked to work.
That is the exact ambiguity the zero-note was written for,
arriving in the one
 shape the note does not cover.

### What landed

`score-probe` prints a LANE line,
counted from the per-slice findings the refine
 stage already wrote:

```text
LANE slicesOffered=101 slicesSilent=6 entriesWithRewrites=15/47
```

`slicesSilent` is slices where NO refiner answered.
Findings are read as plain strings and never validated into a vocabulary,
 because this count exists to notice a stage going quiet and throwing on drifted
 wording would silence it in precisely that case.

### What did NOT land, and why

The roster is unchanged.
Adding a second refiner costs a judge per selection round,
and round three
 already carries an accepted attribution cost from changing the roster,
the
 editor,
the checker set and this lane at once;
 changing it again mid-round would widen that further.
Whether the schema-mismatch is persistent or was a provider window is not
 established at ONE run,
and treating one run as a stable rate is the error
 already withdrawn twice in this document.
Recorded as task #64,
needing the user.
Read the next pass's refiner lines before proposing a roster change.

## The silent lane was the small half: the EDITOR ensemble degraded too

Chasing the refiner found the same failure one stage earlier,
in the stage the
 user's "no single model controls any part of the pipeline" rule was written
 for.

Kimi-K3 plays four roles here:
critic,
panel,
editor,
refiner.
Schema-mismatch counts across two consecutive passes on UNCHANGED pipeline code:

```text
run 012   Kimi-K3   0
run 013   Kimi-K3   61   (refiner 24, panel 13, critic 13, editor 11)
```

Critic and panel survive it:
they retry to a quorum,
and run 013 still shows 62
 chunk-runs at `critic stage: 6/6 heard`.
The EDITOR does not announce a stage line at all.
Its heard count lives only in a per-chunk finding,
and there:

```text
cheonwoomaeng   9 x editor-candidates (1/2 heard, 1 repairing)
TLL1122         3 x editor-candidates (1/2 heard, 1 repairing)
Toka_ls        10 x editor-candidates (2/2 heard, 2 repairing)   [run 012]
```

`cheonwoomaeng` repaired EVERY chunk it has with one editor.
Judges still chose what shipped,
so selection was not single-model,
but they
 chose among one model's proposals,
and the README's claim that "every editor in
 `editorModelIds` rewrites the chunk independently" is false for those chunks.

AND THE STAGE WAS BEHAVING CORRECTLY,
which is the part to understand before
 anyone fixes the wrong thing.
`stage-quorum.ts:154` computes `Math.ceil(modelIds.length / 2)`,
so a roster of
 two reaches quorum on ONE voice.
The editor stage met its quorum on every one of those chunks.
Nothing reported a fault because,
by the rule as written,
there was none.

This is not a malfunction,
it is two rules disagreeing.
"At least half the roster" is a sensible quorum for a six-model critic panel and
 a meaningless one for a two-model ensemble,
where half is one and the ensemble
 property is exactly what the second model was added to provide.
The disagreement is invisible while every model answers,
which is why it
 survived #45 and everything since.

That reframing changes the fix.
A per-stage MINIMUM,
the editor requiring both voices rather than half of them,
 addresses it without touching roster membership,
and is a far smaller change
 than swapping a model that holds four roles.
It also fails LOUDLY,
which is the direction this whole session has been
 arguing for.

### What landed

`summarizeStageRoster` replaces the refine-only version,
because a count that
 answers "could this stage speak" belongs to every stage that fans out.
`score-probe` prints:

```text
ROSTER editorOffered=322 editorDegraded=15 editorSilent=0
       refineOffered=101 refineDegraded=6 refineSilent=6
       entriesWithRewrites=15/47
```

Twelve of the fifteen degraded editor chunks are run 013's.
So the degradation is real but bounded at 15 in 322 across everything settled,
 and it is NOT a rate to quote from one pass.
