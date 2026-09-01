# Translation repair history: 2026-08-07 to 2026-08-12

Part of the [translation repair history index](translation-repair-history.md).

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## How to read corpus-pass progress without inventing a stall

Reading the pass log for liveness has one trap,
and it cost this session several
probes before it resolved.

CHUNK INDICES ARE NOT MONOTONIC ACROSS THE LOG.
A tail of `chunk N: repaired`
lines reads `1, 3, 1, 2, 3, 4, 5, 6, 3, 5, 9, 11, 12, 13, 1, 0, 11`.
That is not
corruption and not a restart loop.
Indices are per entry,
and the slice cache
resumes a partial entry by recomputing only its uncached chunks,
so an entry that
already has chunks 0 through 8 cached emits 9,
11,
12,
13 and nothing else.

THE FALSE ALARM THIS PRODUCES:
comparing the newest artifact mtime against the
newest `chunk 1: repaired` line suggests the run sat idle for hours.
It did not.
The interval was full of `selectBestCandidate` ballots,
which are per envelope
inside the editor stage and carry no chunk or stage prefix,
so a grep filtered to
`stage:` or `chunk ` shows an empty window over an hour that logged 120 lines.

WHAT ACTUALLY ESTABLISHES LIVENESS,
in increasing order of cost:

-   Per-hour line counts including `drainBody`.
    A live pass logs a few hundred
    per hour.
    Zero for an hour is the real stall signal.
-   Chunk completion timestamps.
    Steady spacing means healthy;
    this run held ten
    to fifteen minutes per chunk across forty chunks.
-   Stage lines for the entry in flight,
    which show `critic` through `checker`
    advancing rather than one stage repeating.

FIRST-BYTE LATENCY IS NOT A HEALTH SIGNAL AT THIS PROVIDER.
Consecutive calls
reading 58s,
126s,
163s,
193s,
222s look like a provider degrading under a
climbing backlog.
Measured across the whole run the mean is 54.7s over 1488
calls with a maximum of 336s,
so that climb is ordinary variance sampled at a
window boundary.
Do not infer throttling from a handful of adjacent lines;
take
the distribution over the run.

AN ENTRY TAKING MUCH LONGER THAN ITS PREDECESSORS IS USUALLY CHUNK COUNT,
NOT A
HANG.
Entries here range from a handful of chunks to more than thirteen,
and
settle time tracks that count nearly linearly.
Check how many chunks the entry
has emitted before concluding anything is wrong with it.

## Run 007 ended on its budget, not on its target

`pass8-run-007` exited 0,
which reads like success and is not one.
The final
lines are what matter:

```text
SOFT budget reached after 52381272ms; not starting new entries
DONE processed=9 of pending=92; artifacts=9/92 elapsed=52381272ms
```

IT STOPPED BECAUSE TIME RAN OUT,
having settled 9 entries of 92 pending in
14.5 hours.
Exit 0 means the driver shut down cleanly at its own soft budget,
so never read a zero exit from `corpus-pass` as "the corpus was processed".
Read the `DONE` line.

TWO OF ELEVEN ATTEMPTED ENTRIES HIT THE PER-ENTRY DEADLINE.
`Dethelly` and
`Futajuhuacha` each burned the full 10800000ms (3 hours) and produced no
artifact.

CORRECTION TO AN EARLIER READING OF THIS,
recorded because the wrong version was
committed first:
that is NOT 41 percent of the budget wasted.
Each of those
entries banked 15 completed chunks into the slice cache before the deadline
fired,
and run 008 resumed both from there.
No artifact is not the same as no
progress,
and the slice cache is exactly the mechanism that makes the difference.
Judge a timed-out entry by its cached chunk count,
never by the missing
artifact.

WHAT THE 9 SETTLED ENTRIES SUPPORT.
`draw-sample` produced a real round-three
sheet from them:
small 3 entries with 22 accepted,
medium 4 with 108,
large 2
with 72,
pool 202,
drawn 50,
`unrecordedRepairs=0`.
All three bands are
represented,
so the sheet is gradeable.
Entry coverage is still far short of the
~10/10/10 target,
so treat the resulting precision as provisional until more
entries settle.

RUN 008 IS ACCUMULATING ON TOP OF THIS.
Settled entries are not recomputed and
the slice cache preserves partial work,
so the two timed-out entries resume from
their cached chunks rather than restarting from zero.

## State at the 2026-08-07 compaction

WHAT IS RUNNING:
`pass8-run-008`,
started 2026-08-07,
logging to
`pass8-run-008.log` in the runs directory.
It resumed `Dethelly` from cached
chunk 14 and was past chunk 18 an hour in.
Nine artifacts settled,
all from run
007.
The run notifies on exit;
do not poll it.

WHAT TO DO WHEN IT EXITS,
in order:

-   Read the `DONE` line,
    never the exit code.
    Exit 0 means the driver stopped
    cleanly at its soft budget.
-   Re-run `score-probe`.
    Costs no quota,
    reads local artifacts,
    refreshes the
    figures the gating decision doc quotes.
-   Check whether the large band gained entries.
    If it did,
    redraw with
    `draw-sample -- --final` for the gate sheet;
    if not,
    restart the pass.
-   Check whether `Dethelly` or `Futajuhuacha` reached `TALLY status=repaired`.
    That answers the open half of the deadline task.

THE ONE BLOCKER EVERYTHING CHAINS OFF:
the final gate sheet needs more
large-band entries.
Precision re-measure waits on that,
pre-grading waits on the
gate sheet,
the probe false-positive comparison waits behind pre-grading,
and
the recall re-measure,
naturalness probe,
and judge crosscheck want throughput
this run holds while the provider is the measured bottleneck (54.7s mean first
byte over 1488 calls,
336s max).

DECIDED THIS SESSION:
the introduced-defect probe stays in shadow mode,
recorded
in `doc/decision/introduced-defect-probe-gating.md`.
Nothing else is waiting on
a decision.

NOT DONE ON PURPOSE,
so nobody re-opens these as oversights:
no pre-grading (the
preliminary sheet is not the gate sheet,
and items 1 through 5 were sighted);
no
change to the per-entry deadline or soft budget (resume is measured to work,
so
the deadline costs wall time rather than entries,
and both limits are the user's
design call);
no concurrent quota-bound measurement while the pass runs.

## The per-entry deadline is starving the large band specifically

Measured read-only off run 007 at zero quota,
so this needs no rerun.

BAND THE ATTEMPTED ENTRIES BY `page.md` SOURCE BYTES,
using the pipeline's own
cuts from `band-order.ts` (`SMALL_PAGE_BYTES` 1843,
`MEDIUM_PAGE_BYTES` 3686).
That reproduces `draw-sample`'s split exactly (small 3,
medium 4,
large 2),
which is what makes the proxy trustworthy rather than a second,
different
measurement:

-   large:
    `Dethelly` 6171 TIMEOUT,
    `Arita` 5951 settled,
    `Futajuhuacha` 5448
    TIMEOUT,
    `Chinatsu_Suzuki` 5353 settled.
    Two of four lost.
-   medium:
    `Considerate_cat` 3513,
    `AmbeR_the_anpa` 2122,
    `Anilovr` 1985,
    `Everythings99` 1859.
    Four of four settled.
-   small:
    `Aniloviraw` 1481,
    `Acheron` 938,
    `AkiraComplex` 743.
    Three of three
    settled.

FIFTY PERCENT LOSS IN THE LARGE BAND,
ZERO EVERYWHERE ELSE.
The deadline is not
trimming entries at random.

SIZE CORRELATES BUT DOES NOT DETERMINE,
and this is the part worth not
forgetting.
`Dethelly` is the largest and timed out,
but `Futajuhuacha` at 5448
timed out while the LARGER `Arita` at 5951 settled.
Something beyond size varies,
most plausibly provider latency across the window.
Do not model the deadline as
a pure size threshold and do not predict which large entries will fail.

WHY IT BLOCKS THE MILESTONE RATHER THAN JUST COSTING TIME.
`draw-sample` refuses
a final gate sheet until the large band fills,
and the preliminary draw pulls 16
large-band slots from 2 entries.
The deadline is starving exactly the band the
gate depends on,
so the budget task and the precision re-measure are one problem,
not two.

THE DESIGN ALREADY EXPECTS THIS,
AND RESUME IS NOW MEASURED TO WORK.
`band-order.ts` orders the large band first,
commenting that a large entry may
need a second run to settle so starting it earlier lets it resume sooner.

THE EVIDENCE,
observed live:
after run 007 died on both entries,
the slice cache
held `Dethelly` and `Futajuhuacha` only,
at chunks 0 through 14 each,
contiguous
from zero.
Settled entries discard their caches,
which is why nothing else is
there.
Run 008's FIRST chunk completion is `chunk 14`,
roughly eight minutes
after it started,
not `chunk 0`.

WHAT THAT SETTLES:
the deadline costs wall time,
not entries,
as long as the pass
is restarted.
Raising it is therefore not urgent and probably not the right knob.
The remaining cost is only the work in flight when the deadline fires,
which is
at most one chunk,
plus the per-restart overhead of reaching the entry again.

WHAT IT DOES NOT SETTLE:
whether these entries eventually settle at all,
or keep
consuming a deadline per run without reaching their last chunk.
That needs run
008 to carry one of them to a `TALLY ... status=repaired`.

## Verifying a sheet renders is in tension with pre-grading it blind

READING A GRADING SHEET CONTAMINATES ANY LATER BLIND PRE-GRADE OF THE ITEMS
READ.
This session printed the first 48 lines of the round-three preliminary
detection sheet to confirm it was well-formed,
which put items 1 through 5,
their claims,
and their source and target quotes into an agent context.
Those
five can no longer be pre-graded blind by that session.

WHY IT MATTERS BEYOND ONE SESSION:
`scoreGradeAgreement` weights every row the
same,
so a handful of sighted rows inflate the agreement figure that the
calibration task exists to produce,
and nothing in the artifact records which
rows were sighted.
The damage is invisible in the output.

HOW TO KEEP BOTH:
verify structure without reading claims.
Count `###` item
headings,
check the header block and the `[ ]` slots,
confirm the banner and the
corpus pin,
and stop there.
If item text must be inspected,
do it in a session
that will not produce the pre-grades,
or record the sighted indices alongside
the pre-grades so they can be excluded.

THIS PARTICULAR CONTAMINATION IS MOSTLY MOOT,
because the preliminary draw is
not the gate sheet and the final draw shifts as the pool grows,
so pre-grades
keyed to preliminary indices do not transfer anyway.
Do not let that specific
reprieve hide the general rule.

## Probe trigger rate: the decision doc is canonical now

Issue #53 is decided:
the probe stays in shadow mode,
recorded in
`doc/decision/introduced-defect-probe-gating.md` with the rejected gating
designs and the condition that reopens it.
The follow-up measurement,
comparing
corroborated regions against the round-three human repair grades,
is tracked
separately and is blocked on those grades existing.

STOP ADDING A SECTION PER SETTLED ENTRY.
This file accumulated one at five
entries and another at seven,
which makes the series hard to read and easy to
quote stale.
The current figures live in the decision doc;
refresh them there
with `mise run //package/module/translation-repair:score-probe`,
which costs no
quota and reads only local artifacts.

THE SERIES SO FAR,
for whoever wants the shape without rerunning anything:
`majorityIntroduced` has been 1 at every checkpoint (1,
5,
6,
7,
8,
9 entries)
while regions went 13,
67,
68,
72,
79, 83.
The numerator has never moved.
`minorityIntroduced` was 1 at one entry,
5 at five,
and 6 at both eight and
nine;
the six- and seven-entry checkpoints recorded only the majority column,
so
treat the minority series as four measured points,
not six.
`contradicted` and
`unanchored` are still zero,
and at nine entries `unprobedRecords` is zero
across 202 shipped records,
so the probe is reaching everything rather than
skipping quietly.

## The deadline costs wall time and a restart, never an entry (#61 answered)

Both entries that hit the 3-hour per-entry deadline in run 007 settled on
resume in run 008:

```text
TALLY Dethelly status=repaired issues=282 accepted=198 resolved=198 ms=6900394
TALLY Futajuhuacha status=repaired issues=229 accepted=167 resolved=165 ms=3685583
```

The slice cache is what makes this true.
A timed-out entry banks every completed chunk,
 and the next pass resumes from the highest cached index rather than from zero.
Dethelly spent 3 hours in run 007 reaching chunk 14,
 then 1.9 hours in run 008 finishing from there:
 about 4.9 hours of real work split across two passes,
not 3 hours thrown away and 4.9 spent again.

Run 008 produced a third casualty,
 `Huasheng` at `ms=10800002 aborted=true`,
which confirms the pattern rather than contradicting it.
It will settle the same way on the next restart.

So the answer to #61 is that the per-entry deadline is NOT the knob.
Raising it would let one pathological entry monopolize the soft budget,
 and the thing it currently costs,
 a restart,
 is already automated by the cache.
What actually bounds throughput is the 12-hour soft budget and provider latency,
 not the 3-hour deadline.
Close #61 on this evidence rather than tuning the deadline.

## Entry count per band is not what protects the draw; round-robin is

Do not read `POOL band=large entries=5` as the safety property.
The large band's candidates are wildly unequal:
 of its 449 accepted issues,
 198 are Dethelly's and 167 are Futajuhuacha's,
 so two entries hold 81% of the band.

That concentration does not reach the sample.
`selectFromBand` in `package/module/translation-repair/src/sample-draw.ts`
 groups candidates by entry,
 ranks each entry's issues among themselves,
 and sorts by rank BEFORE entry,
so the draw takes one issue from every entry before any entry's second.
With 16 large-band slots over 5 entries each entry gets about three,
 whichever entry brought 198 candidates and whichever brought 12.
`sample-grading.unit.test.ts:376` pins this:
 a pool where `Heavy` holds five candidates and `Light` holds one,
 drawn to two slots,
 must contain both.

The consequence for judgment:
 when deciding whether the pool is ready for the gate sheet,
 count ENTRIES per band,
 because that is what sets the spread,
and ignore the accepted-issue totals,
 because round-robin has already flattened them.
The earlier worry about 2 large-band entries was still correct,
 but for the right reason:
 two entries meant eight slots each,
 not that they held most of the candidates.

## The probe join attached the wrong record's verdict, and the aggregates never showed it

Found by review,
not by symptom.
A guard written to test a hypothetical collision fired immediately on the live
 run's own artifacts,
 in `Acheron`.

`score-probe` joins a graded sheet position to a probe verdict through the issue
 id:
 position to issue id through the manifest,
 then issue id to reading.
That second map was built from each reading's `regions[].issueIds`.
A region names EVERY issue it serves,
 and the README already says one replacement can serve several accepted issues,
so a shared envelope appears in the readings of every record it served and names
 all of them.
Handing those pairs to the `Map` constructor keeps the LAST one,
 so an issue could resolve to a different record's reading.

This is the ordinary case,
 not a rare hash collision.
It happens whenever an envelope served more than one issue,
 which is the merging behavior the pipeline is built around.

Two things this did NOT affect,
 both verified rather than assumed:

-   The aggregate figures.
    `summarizeProbeTelemetry` deduplicates by `envelopeId` before judging,
     so `regions`,
     `majorityIntroduced`,
     and `minorityIntroduced` never read the broken map.
    Re-running after the fix returned `entries=15 shippedRecords=647
    regions=210 majorityIntroduced=1 minorityIntroduced=18` unchanged,
    so every figure quoted in
     `doc/decision/introduced-defect-probe-gating.md` stands.
-   Any measurement taken so far.
    The join only runs with `--repair-sheet` and `--manifest`,
     which is task #60,
     and #60 has never been run.

The fix takes ownership from the record at parse time,
 where it is exact:
 `readArtifactProbe` now returns `owned`,
 pairing each reading with its own record's issue id,
 and a duplicate id throws rather than overwriting.

The lesson worth keeping is narrower than "check your joins".
The regions list was a plausible-looking key that was never an identity.
Nothing downstream could have detected it,
 because a wrong-but-well-formed reading produces counts that look exactly like
 right ones.
When a join key is derived rather than carried,
 ask what happens when the derivation is many-to-one.

## Three smaller draw-integrity fixes landed alongside

-   Preliminary draws used the GATE seed,
     differing from the final only in file name.
    Since a preliminary is re-run as the pool grows,
     each one previewed the gate sample,
     and choosing when to finalize after seeing them would be selecting the
     sample on its contents.
    Preliminary now draws with a derived seed.
    No contamination occurred:
     this round's preliminary sheets were never read.
-   Final sheets are now created exclusively (`flag: 'wx'`).
    `resolveSheetPath` refuses a path that exists,
     but that check and the write were separate steps,
     and human grades exist nowhere else.
-   The pool report gained `contributing=` and `perEntry=`.
    This immediately corrected a reading:
     the small band shows `entries=5` but `contributing=4`,
     because `ArtsEpiphany` settled `unchanged` and accepts nothing.
    Judge readiness on contributing entries,
     never on the raw entry count.

## What the precision figure estimates: entries, not issues

Worth stating plainly because two reviewers raised it independently and nothing
 recorded it.

The draw allocates slots per BAND,
and within a band round-robins across
 ENTRIES.
So an entry contributing 12 candidates and one contributing 198 receive about
 the same number of slots.
Their per-issue inclusion rates therefore differ by more than an order of
 magnitude,
and the pool itself is lopsided:
 small holds 38 accepted issues,
 medium 160,
 large 449,
while the sample splits roughly 17 / 17 / 16.

The number the gate reads is therefore **entry-balanced precision within each
 size band**.
It is not an unbiased estimate of precision over the accepted-issue population,
 and it was never meant to be.
Two properties are being bought with that:

-   A band's figure describes the band rather than its largest entry.
    Round two reported 0.740 / 0.787 / 0.800 per band,
    which is only meaningful
     if a band's number is not dominated by whichever entry happened to be
     prolific.
-   Rounds stay comparable.
    Round one and round two were drawn this way,
    and changing the estimand now
     would make round three a different measurement wearing the same name.

The figure to quote alongside it is the per-entry composition the POOL lines
 print,
because that is what says whether a band's spread is real.
Do NOT reweight the sample by inclusion probability to recover an
 issue-weighted precision without saying so explicitly:
 it would answer a different question from the one rounds one and two answered.

## Two things verified rather than assumed, for whoever runs #60

**The join runs,
and it resolves every position.**
The ownership fix,
the
identity check,
and their tests were all in place while the command itself had
never been executed.
Exercised against the preliminary pair at zero quota:

```text
AGREEMENT joined=50 probeFlagged=0 refutedByHuman=0 sharedWithHuman=0 flaggedUnscored=0 unflaggedFailures=0
```

`joined=50` is the figure that matters.
The zeros are expected on an ungraded sheet,
 but `joined=0` would also have printed as a clean run,
so check that number first rather than the ones beside it.

**`--repair-sheet` and `--manifest` need ABSOLUTE paths.**
The mise task runs
from the package directory,
not the repo root,
so a path relative to the runs
directory fails with `ENOENT` after the summary has already printed.
Build them
from `$(pwd)` at the worktree root.

**The entry-balanced estimand does cover round one.**
The claim recorded above
rests on rounds one and two sharing the draw,
and task #32 is titled "draw
50-issue uniform sample",
which reads like a contradiction.
It is stale wording
from before the tooling was designed:
`sample-draw.ts` has exactly ONE commit
(`da6d66fa2`,
2026-07-25),
has never been modified since,
and already contained
`selectFromBand`'s round-robin.
Round one's sheet is dated 2026-07-26,
after it.
So both graded rounds were drawn entry-balanced and the comparability argument
holds.

## The round-three gate sheet is drawn

Run 008 ended on its soft budget:

```text
SOFT budget reached after 48328009ms; not starting new entries
DONE processed=9 of pending=83; artifacts=18/92 elapsed=48328009ms
```

Note the elapsed time exceeds the 43200000ms soft budget.
The budget stops the driver STARTING entries;
 the ones already in flight finish,
so a pass always overruns by roughly its slowest surviving entry.

The gate sheet was drawn at 18 settled entries,
 with the pass stopped so nothing could be added mid-read,
 and the user chose that timing over accumulating further:

```text
SAMPLE final=true seed=milestone-three-precision-round-three pool=740 drawn=50 unrecordedRepairs=0 unrecordedInPool=0
```

Contributing entries were 5 small,
7 medium,
5 large.
The slot distribution is the thing to look at,
 because it settles the concentration question empirically rather than by
 argument:

```text
Arita:4 Futajuhuacha:3 Chinatsu_Suzuki:3 Dethelly:3 Jennife80677612:3
```

`Dethelly` brought 198 candidates and `Jennife80677612` brought 12,
 and both received 3 slots.
The two entries holding 81% of the large pool took 6 of its 16 slots.
Round-robin does what it claims.

The one-shot guard was then verified rather than trusted:
 a second `--final` run refused with `GradedSheetExistsError`,
 and all three files were byte-identical afterwards.

## What is true right now

-   The gate sheet,
    repair sheet,
    and manifest exist under the round-three seed
     and must not be redrawn.
    Nothing in this session has READ the detection sheet,
    so #48's blind
     pre-grade path is still clean.
    Keep it that way:
     do not `cat`,
    `head`,
    or `sed` it.
-   Corpus pass run 009 is running,
    logging to `pass8-run-009.log`.
    It cannot affect the drawn sheet,
    which is already written,
     and its entries serve round four,
    recall (#51),
    and the naturalness probe
     (#58).
-   `score-probe` reads 18 entries,
    740 shipped records,
    246 regions,
     `majorityIntroduced=2`.
    The join runs and reports `joined=50` against the preliminary pair;
     it has not been run against the FINAL pair because that needs human grades.

## Round-three blind pre-grades are recorded

Written to `pre-grades-milestone-three-precision-round-three.json` in the runs
directory,
 which is where `score-agreement` looks for them by seed.
50 items,
indices 1 to 50 complete,
49 scored and 1 left `unscored` and handed
 over as genuinely contested.
`parsePreGrades` accepts the file.

THE VERDICTS ARE NOT REPRODUCED HERE,
and were not reported to the user when
 they were written.
The decision recorded under "PRE-GRADES STAY IN THEIR OWN FILE" is that showing
 the agent's grade anchors the human toward agreeing,
and the same sheet produces the milestone gate number,
so the calibration would be bought by corrupting the measurement it calibrates
 against.
Naming which items the agent called false positives does that just as
 effectively as printing them on the sheet.
The per-item reasoning lives in the `note` field of each pre-grade,
 which stays outside git because it quotes corpus text.

Method worth repeating next round:
 the sheet deliberately shows no source anchor for addition-class claims,
 because an addition points at nothing in the original,
so an addition claim cannot be graded from the sheet alone.
For those the corpus was read directly at the pinned commit
 (`/var/home/user/one-among-us/data`,
read-only,
never committed),
 and several claims resolved cleanly in one direction or the other on evidence
 the sheet could not carry.
Grades reached that way are marked `VERIFIED AGAINST SOURCE` in their note.

This creates a real asymmetry to disclose at scoring time:
 the agent graded some items with more information than the sheet shows.
Disagreement on those items may reflect that asymmetry rather than judgment,
 and the agreement rate should be read with the marked items identified.

## The runtime-neutral bundle this package supposedly has does not exist

Recorded because it once blocked a decision on a false premise.

A `test-import(require-eventual-artifact)` error on
 `src/corpus-run/sheet-path.unit.test.ts` was held up on the belief that the
 rule's suggested remedy,
 exporting the module from the package entry,
would break an invariant:
 that `dist/final/neutral/index.mjs` carries ZERO `node:` specifiers,
 the library being runtime-neutral while all filesystem IO lives in corpus-run
 tooling.

That invariant was never verified.
The question was sent to `pi` and the call died fetching the provider's model
 list,
 so no answer ever came back,
and the premise sat unexamined.

There is no neutral bundle.
`dist/final/` holds `node` and `types` only,
 and `neutral` appears nowhere in the package's `mise.toml`,
`package.json`,
or
 config files;
the sole JavaScript target is `build:js:node`.
So exporting a module that imports `node:fs/promises` through the barrel breaks
 nothing.

The error itself is long resolved along exactly the route that was doubted:
 `sheet-path.ts` is exported from `sheet-barrel.ts`,
 the test imports `../../dist/final/node/index.mjs`,
and the package reports zero `require-eventual-artifact` findings.
Later exports through that barrel (`readSheetIdentity`,
`trackDrawOutputs`,
 `indexReadingsByIssue`) follow the same established pattern rather than
 inventing one.

The general lesson is about the failure mode rather than the bundle:
 a question sent to a reviewer and never answered leaves a premise looking
 examined when nothing examined it.
A dead call is not a deferred answer.

## Run 009 was killed from outside, and nothing was lost

Four background tasks stopped at the same moment:
 run 009 and three stale `pi` calls left over from an earlier session.
The log ends `ERROR sh exited with non-zero status: no exit status`,
 which is a signal rather than an exit,
and the simultaneity points at a harness-level cleanup of background tasks
 rather than anything the pass did.

Nothing was lost,
 and this is worth checking rather than assuming next time it happens:

-   All four round-three gate files are byte-for-byte intact
     (sheet 22087,
    repair sheet 52756,
    manifest 8213,
    pre-grades 9662).
    The draw is already written,
    so no pass can affect it.
-   All 21 artifacts pass the accepted-count reconcile,
    which is now STRICT,
     so a half-written artifact from the kill would have thrown rather than
     joined the pool silently.
    None did.
-   Run 009 settled 3 entries before dying:
     `Huasheng`,
    `LCG_Akiball`,
    `CuspariaKLSY`.

`Huasheng` is the notable one.
It was run 008's deadline casualty (`ms=10800002 aborted=true`),
 and it came back on resume with 145 accepted issues,
which is a third independent confirmation of the #61 finding that the per-entry
 deadline costs a restart rather than an entry.

Band composition is now 6 small,
7 medium,
7 large contributing,
 over a pool of 939.
That is BETTER than the 5/7/5 the gate sheet was drawn at,
 and it changes nothing about the gate:
 the draw is one-shot and already spent,
so these entries serve round four,
recall (#51),
and the naturalness probe
 (#58).

## The probe judges wording the naturalness lane can replace

Found while sizing #58,
and it changes what #60 can conclude.

Ordering,
from the source rather than from memory:
 `repair-chunk.ts:299` runs `runIntroducedDefectProbe` inside the accuracy
 stage,
and `repair-translation.ts:429` runs `runRefinePhase` afterwards over those
 outcomes.
So on a slice the lane rewrote,
the probe's before/after pair is the accuracy
 stage's,
and the text that reached the reader is `finalSliceText`.

`repair-sheet.ts:175` handles its side of this correctly and always did.
For a refined slice it prints
 "a later naturalness pass rewrote this slice,
so the wording above is not
 final",
 shows "the slice as actually returned",
and instructs "grade the RETURNED wording".
So the human grades post-refinement text while the probe judged
 pre-refinement text,
and joining them treats the two as one.

Measured across 28 entries:
 151 refined records,
 90 of them shipped,
 out of 1214 shipped records,
and 10 of the 50 positions in the drawn round-three gate sample.

Two consequences that must not be conflated:

-   GATING is unaffected.
    A gate would act during candidate selection,
    which is also before the lane
     runs,
    so the probe judges exactly the text such a gate would judge.
-   VALIDATION against human repair grades is affected,
    on those positions only.
    `score-probe` now reports `refinedJoined` so they can be excluded and the
     exclusion reported.

DETECTION PRECISION IS NOT AFFECTED AT ALL,
and this is worth stating plainly
 because it is the number currently out for grading.
The detection sheet asks whether an accepted issue is a real defect in the
 ORIGINAL translation.
It shows the original's wording and no correction,
so nothing the repair or the
 lane did afterwards can reach that question.

The remaining work is #58 proper:
 nothing probes whether the naturalness lane itself introduces defects,
 and it rewrote 90 shipped records here.
That is the same blind spot the introduced-defect probe was built to close,
 one stage later.

## The naturalness lane is audited now, and the audit was checked before trusting it

#58 is built,
wired,
read,
reported,
and validated live.

An accepted refinement runs the same introduced-defect probe against the pair
 that actually matters for it:
 `baselineText` is the repaired text and the region is the rewritten slice.
One region per slice,
because `RefineStageResult` exposes only whole-slice text
 and because `retainsResolvedIssues` already rolls back per slice,
so the audit's unit matches the lane's own unit of decision.
The roster is the checkers,
whom `assertCheckerIndependence` has already proved
 disjoint from the refiners.

THE PROMPT NEEDED A SECOND FRAMING,
and this was the part worth being careful
 about.
The probe tells reviewers the editor was "trying to fix defects that were
 ALREADY THERE",
 which is false of a lane that rewrites already-correct text for fluency.
The rule that saves it,
"Stylistic preference is NOT a defect",
was already
 there and is shared.
A first attempt neutralised that rule's neighbour into kind-agnostic wording,
 which would have silently reworded the ACCURACY prompt too;
the accuracy prompt is byte-identical to the one every artifact was produced
 under,
and a test pins it.

VALIDATED LIVE rather than assumed,
all three at 3/3 heard:

```text
SENSITIVITY refinement/clean          noneFound=3   (no claims)
SENSITIVITY refinement/omitting       removal=3
SENSITIVITY refinement/contradicting  corroborated=3
```

The control is the one that mattered.
This lane exists to rephrase,
so a prober reading rephrasing as damage would
 flag every refinement the pipeline ships,
and in a shadow-mode stage nobody reads,
that failure looks exactly like a clean
 run.
It reported nothing on the clean rewrite and caught both injected damages.

READING IT:
`score-probe` prints a REFINEMENT line,
kept separate from the
 accuracy figures because the two audit different edits against different
 baselines and their region counts are different units (rewritten slices against
 replaced envelopes).
`rewrittenSlices=0` prints a note saying so,
because every artifact before run
 012 predates the audit and a bare zero there would read as "the lane broke
 nothing" when it means "nothing asked".

## State at the 2026-08-09 compaction

Branch `translation-repair-rebased`,
447 commits ahead of `main`,
nothing
unpushed.
Working tree carries only foreign drift (three plugin bundle `.mjs`,
the
IntelliJ jar,
untracked `.idea/.name`);
leave it alone.

### The one thing waiting on the user

Round three's gate sheet is DRAWN and awaiting its human grade.
The draw is spent and must not be repeated:
 `resolveSheetPath` refuses a final path that exists,
 and that refusal is the only thing protecting hours of grading that nothing
 else reproduces.
Verified rather than trusted:
 a second `--final` run refused with `GradedSheetExistsError` and left all three
 files byte-identical.

```text
grading-sheet-milestone-three-precision-round-three.md    ← grade this first
repair-sheet-milestone-three-precision-round-three.md     ← only after
sample-manifest-milestone-three-precision-round-three.json
pre-grades-milestone-three-precision-round-three.json     ← do NOT read first
```
