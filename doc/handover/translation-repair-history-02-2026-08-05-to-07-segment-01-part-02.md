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

- Task 52.
  `runCheckerStage` is asked about EVERY accepted issue,
  including
  unenveloped ones and ones whose envelope received no surviving operation,
  and
  `resolvedHighSeverity` / `resolvedTotal` are computed over that whole set.
  So
  a patch touching issue A can beat unchanged on credit for issue B that no
  operation touched.
  The new provenance exposes this as records with
  `resolved: true` and `repairDisposition: 'no-region'`.
- Task 53.
  `regressionCount` can only count EXISTING accepted issues the
  checkers marked regressed,
  so a wholly new defect the patch introduces has
  nowhere to be counted,
  despite the field being documented as "new defects".
  `changedCharCount` sums `Math.max(baseText.length, newText.length)`,
  which is
  touched-region size rather than differing characters.
- Task 54.
  Emptying `resolvedIssueIds` when unchanged wins is semantically
  correct,
  but the checkers' opinion of the rejected candidate is lost.
  The
  rejected repair itself is now recorded;
  only the verdict on it is not.

### Tooling note

`pi`'s file attachment is a POSITIONAL argument form,
`pi [options] [@files...] [messages...]`,
not `@path` written inside the message text.
Writing the paths into a prompt file and passing that file got back
"the prompt contains file paths,
not their contents".
Passing each source as its own `@path` argument and the question as the message
works,
and sidesteps the `Argument list too long` failure that killed an earlier
163 kB inline prompt.

### Second review, and what it caught (2026-08-06)

A second sol pass over the IMPLEMENTED code found five real defects,
all fixed in `21134e8bb`.
Recording them because each is a class of mistake,
not a one-off.

REFINEMENT-ONLY SHIPMENT WAS HIDDEN.
`runRefinePhase` runs whatever the accuracy selection decided,
so a slice whose targeted repair lost can still be rewritten and reach the
reader.
The sheet said only "nothing reached the reader",
which is true of the repair and false of the text.
The disposition itself is correct and was left alone;
it describes the TARGETED repair's fate,
and its TSDoc now says so explicitly.
The returned slice is shown either way now;
only the grade box depends on a targeted repair having shipped.
An earlier fix of mine (`cc9f6ad58`) had made this worse:
it removed the refinement caveat from ungradable items to resolve a
contradiction,
which resolved the contradiction by deleting the true half.

REPLACED TEXT CROSSED INTO MARKDOWN GRAMMAR RAW.
A replacement is arbitrary corpus-derived model output.
Interpolated into a bullet list it can contain a line starting `###`,
a literal `- repair grade: [ ]`,
or a backtick run,
and the first invents a heading,
the second puts a grade box on the sheet that nobody wrote,
and the third breaks the block.
Curly quotation marks are not Markdown syntax and prevent none of it.
This is AGENTS.md SYB,
and it was missed in review-one because the question
asked was about measurement bias rather than about encoding.
Both sides are fenced now via `markdown-fence.ts`,
which chooses the fence against the content the way
`candidate-select-wire.ts` already chooses its prompt fence.
The test asserts grade boxes OUTSIDE fenced blocks,
since fencing does not delete the injected characters,
it stops them being read as sheet.

A RECORD CARRYING REGIONS BUT NO DISPOSITION READ AS A LEGACY RECORD.
Keying the legacy judgement on one field made a half-written repair the one
malformed shape a strict parser would silently accept.
Absence is now judged over every repair field.

A FINAL DRAW OVER PRE-RECORDING ARTIFACTS RENDERED FIFTY UNGRADABLE ITEMS AND
REPORTED A NUMBER ANYWAY.
`--final` now refuses when any sampled item carries no recorded repair.
Reachable simply by drawing against a directory still holding an earlier
round's artifacts,
which `corpus-pass` never overwrites.

SHEET WRITES WERE NOT TRANSACTIONAL.
The detection sheet was written before the repair path was resolved,
so a refused repair path left a protected detection sheet with no companion.
Both paths resolve before either write now.

Also from that review:
the preliminary banner now reaches both sheets rather than only the detection
one;
the slice-cache guard requires `refined`;
the zh original is carried onto the repair sheet,
since that is what "does it fix it" is answered against;
and a deletion says it is a deletion instead of rendering `after: ""`,
which read as a rendering fault.

TEST FIXTURE THAT PROVED NOTHING.
`repair-record.unit.test.ts` used the refined wording as `repairedText` even
when `refined` was false,
so the conditional-`finalSliceText` test passed while modelling a state its own
documentation says cannot occur.
The fixture now returns patched text carrying the replacement verbatim for a
shipped unrefined slice,
and a test asserts that containment directly.

STILL OPEN FROM THAT REVIEW,
deliberately:
the slice-cache key covers version,
index,
and both texts but NOT the model
roster,
adjudication config,
editor addendum,
or identity context,
so a
cross-run cache could return an outcome produced under different inputs.
Not a live hazard for round three because the round-two slice cache was
archived with its artifacts and the version bumped,
but it is a real gap.

### Round three preparation

Round two ARCHIVED to `round-two-archive/` inside the runs dir,
mirroring the
existing `round-one-archive/` layout:
`artifacts/`,
`attempts.json`,
`slice-cache/` moved,
and `gate-verdict.md` plus
`grading-sheet.md` COPIED so the seed-named originals stay where
`resolveSheetPath` protects them from being clobbered.
A fresh empty `artifacts/` was created in their place.

`corpus-pass -- --plan` verified at zero quota after the archive:
tip `f7943a196`,
92 pending,
0 done,
client constructed,
soft budget 12h,
hard cap 3h per entry.

`DEFAULT_SAMPLE_SEED` advanced to `milestone-three-precision-round-three`.
A new seed does NOT guarantee no already-graded issue is redrawn;
what mostly changes is the population,
since round three draws from artifacts
produced by a fresh pass and issue ids are content-derived.

`sentinel-probe` now reports accepted issues counted by repair disposition and
how many issues were refined,
so a real-model probe can tell a run that records
provenance from one that does not.
That check is the one unit tests cannot do.

### Round three run policy (user decision, 2026-08-06)

STOP AT ~15 SETTLED ENTRIES,
then draw.
User asked why the next step needed twelve hours;
it does not,
and the twelve-hour figure was the run's SOFT BUDGET rather than a wait.

The arithmetic that decided it,
recorded because it recurs every round:

- The sample is 50 ISSUES,
  not 50 entries.
  Round two's 31 entries produced 2257 accepted issues,
  so issue supply is never the constraint.
- What entry count buys is PAGE DIVERSITY.
  `selectFromBand` round-robins across entries,
  so 31 entries spread 50 issues over ~31 pages
  and 15 entries spread them over ~15,
  about 3 to 4 per page.
  Sample size is unchanged either way,
  so the confidence interval is unchanged;
  what rises is clustering,
  since issues from one page share a translator and an error style.
- `band-order.ts` interleaves bands round-robin and documents reaching
  ten per band at about thirty entries,
  so fifteen entries lands about five per band by construction.
  A plain artifact count is therefore a correct stop condition;
  no band-aware check is needed.
- At round two's measured rate (252 min for 7 entries,
  about 36 min/entry),
  fifteen entries is roughly seven to nine hours,
  against roughly eighteen for thirty.

The pass is NOT reconfigured for this.
`SOFT_BUDGET_MINUTES` stays 720;
the run is stopped by hand once the artifact count reaches fifteen.
Changing run config mid-run would not affect the running process anyway.

### Task 48 tooling, built while the pass ran

`grade-sheet-read.ts` (`parseGradedSheet`) and
`grade-agreement.ts` (`scoreGradeAgreement`,
`scoreGradedPrecision`).

The parsing rules come from the two sheets the user has ACTUALLY graded,
which are in different formats and neither of which anyone specified:

-   round one:
    `### 3. grade: Y  (Y = ...)`,
    bare,
    and `### 2. grade: N. <rationale>`.
-   round two:
    `### 4. grade: [Y]`,
    bracketed,
    and `### 7. grade: [Y, <rationale>]`.
-   both rounds:
    answers that are NO verdict,
    such as `[Not enough context to grade]` and
    `[Not sure which tense is best here...]`.

A verdict letter counts as a verdict only when a delimiter follows it.
`Not enough context to grade` begins with `N`,
and reading it as a false positive would move a question the grader DECLINED
into the precision denominator on the strength of one letter.
Both denominators exclude declined items and report their positions,
so their number is never invisible.

PRE-GRADES STAY IN THEIR OWN FILE,
never printed on the sheet.
This was decided rather than asked,
because the user's own stated plan determines it:
showing the agent's grade would anchor the human toward agreeing,
and the same sheet produces the milestone gate number,
so the calibration would be bought by corrupting the measurement it calibrates
against.
Nothing is lost,
because the agreed plan only starts FILTERING items a round later.

### Provenance verified in a live run

The first slice the round-three pass persisted
(`slice-cache/AmbeR_the_anpa/a821a954...json`) carries
`repairRegions` with one real region
(envelope id,
one issue served,
14 characters replaced by 12),
`accuracyPatchSelected: true`,
`refined: false`,
and that issue in `resolvedIssueIds`.
The slice cache is what made this checkable in minutes rather than after a whole
entry:
it serializes `ChunkRepairOutcome` after EVERY finished slice,
so provenance is inspectable long before the first artifact lands.
Use it that way next time instead of gating a long run behind a probe entry.

### Grading arithmetic is now reproducible from the sheets

`mise run //package/module/translation-repair:score-agreement -- --sheet <abs path>`
reads a graded sheet and prints the numbers,
so a verdict no longer depends on counting by hand.
Pass an ABSOLUTE path:
mise runs the task with the package directory as cwd,
so a repo-relative path resolves wrongly.

Validated against both sheets a human has graded.
Round two reproduces its published verdict EXACTLY:

```text
PRECISION items=50 scored=47 realDefects=37 strict=0.740 excluded=0.787 lenient=0.800 unscored=10,12,17
```

That is the strongest available check on the reader,
since it recovers a measurement nobody told it.
It also settles what the three published numbers meant,
which was never written down:
strict counts a declined item as a false positive (37/50),
excluded drops declined items from the denominator (37/47),
and lenient counts them as real defects (40/50).

Round one,
scored by the same tool for the first time:

```text
PRECISION items=50 scored=44 realDefects=28 strict=0.560 excluded=0.636 lenient=0.680 unscored=12,16,21,33,34,48
```

So the fix rounds moved excluded precision 0.636 -> 0.787,
and round three's target remains 0.9.
Both rounds left a similar share undecided
(six of fifty,
then three of fifty),
which is worth watching:
the undecided share is itself a signal about how gradable the sheet is.

Output carries counts and sheet POSITIONS only,
never a quote,
a claim,
or a grader's rationale,
so it is safe to paste into a verdict or a message
even though the sheets hold unlicensed corpus text.

### Policy change: land certainly-good pipeline fixes immediately (user, 2026-08-06)

User instruction,
verbatim intent:
land all certainly-good pipeline changes immediately and restart the runs as
many times as needed;
there is no need to save tokens on this provider.

This REVERSES the sequencing used earlier in the session,
where pipeline fixes were held so the round-three measurement would run against
frozen code.
Restarting is cheap;
measuring a pipeline you already know is wrong is not.

"Certainly-good" still does work in that sentence.
Landed under it:

-    Task 52,
     credit only served issues.
    The defect is indefensible rather than debatable:
    a patch could win on credit for an issue nothing touched.
-    Task 56,
     cache key covers run shape.
    Same character:
    a resumed slice could carry another roster's outcome silently.

NOT landed under it,
because each is a design choice rather than a defect with one right answer:

-    Task 53's REBUILD half.
    Renaming `regressionCount` and `changedCharCount` to what they measure is
    safe;
    building the measurements their names promise changes what selection ranks
    by and needs a decision.
-    Task 31,
     judge crosscheck.
    A new stage with its own cost and failure modes.
-    Task 54.
    Purely additive telemetry,
     so it is safe,
     but it was not needed to unblock
    the run and can land beside 53's rename.

### Round three, run 002

Run 001 was stopped after one entry and three slices.
Its slice cache was DELETED rather than kept:
the pipeline changed under it,
and although the new run-shape key would have missed those entries anyway,
leaving them invites the exact confusion the key exists to prevent.
Artifacts were still empty,
so nothing settled was lost.

`pass8-run-002.log` is the live run.
Stop condition remains fifteen settled entries.

### Findings from run 001 that survive the restart

REPAIR PROVENANCE WORKS END TO END ON LIVE DATA.
Three real slice outcomes yielded seven accepted issues,
all `shipped`,
all carrying regions.
Rendering both sheets from them showed:
seven grade boxes and seven headings OUTSIDE fenced blocks,
no replacement text outside a fence,
and no replacement text anywhere in the detection sheet.

READING THE SHEET AS A GRADER FOUND WHAT COUNTS COULD NOT.
The SHARED line printed five full 64-character issue ids,
about a third of a kilobyte of hash a grader cannot look up,
burying the one fact they can act on:
the same before and after text is about to repeat under other items.
It now names those items by SHEET POSITION,
and says plainly when a sibling was not drawn into the sample.
Structural checks over that same file all passed,
so nothing but reading it would have caught this.
Generate a sheet and READ it before every round.

MEASURED THROUGHPUT,
corrected.
An earlier claim that the run was slower than round two was WRONG:
it divided wall clock from PASS start,
which includes corpus fetch and setup,
rather than from when `repairTranslation` began.
Measured from the log timestamps on a large-band entry:
7 slices declared,
finished slices at 1.52 and 7.35 minutes,
mean 4.44 min/slice,
against round two's 8.56 min/slice for large.
Per-slice speed is fine.
The genuinely new cost is the naturalness lane,
which did not exist when round two's 36 min/entry was measured
and adds a rewriter call,
a judge round,
and a recheck per eligible slice.

### Run 003, and the rest of the certainly-good backlog

Landed after run 002 started,
so the pass restarted again as `pass8-run-003`:

TASK 54,
`candidateResolvedIssueIds` on `ChunkRepairOutcome`.
`resolvedIssueIds` discards two different things and both are worth auditing:
verdicts on issues no operation served,
which must not earn selection credit but are still what the checkers SAID,
and every verdict at all when the unchanged text won,
so a rejected candidate left no trace of how it was judged.
The new field records them and decides nothing.
`SLICE_CACHE_VERSION` went 2 -> 3 for the shape change.

The served-issue derivation moved to `chunk-measure.ts` as
`selectCreditableIssues`,
because adding the telemetry pushed `repair-chunk.ts` to 301 lines.
Splitting rather than raising the budget,
as MXL requires;
`chunk-measure.ts` is where the other selection inputs already live.

STILL NOT LANDED,
and still deliberately:

-    Task 53's rebuild half.
    The RENAME half is safe and pending only because it changes a public type
    for no measurement gain mid-run;
    it can land any time.
-    Task 31,
     judge crosscheck.
    A new stage with its own cost and failure modes.

RESTART DISCIPLINE that emerged,
worth keeping:
stop the pass,
CONFIRM no `corpus-pass` process survives
(`ps --no-headers -eo pid,args | rg corpus-pass | rg --invert-match 'rg |pgrep'`,
since a bare `pgrep --full` matches its own command line and reads as a false
positive),
delete the slice cache,
then start the next numbered log.
Deleting the cache is belt and braces now that the key covers run shape,
but a stale directory invites exactly the confusion the key exists to prevent.

### Run 004: the introduced-defect probe, and a misread of the user I had to undo

Commits `21f5e9092` (probe) and `e3ba6d325` (integration tests).
The pass restarted as `pass8-run-004`.

#### What I got wrong first, because it will recur

The user was asked two questions.
Whether regressions should gate or rank,
offered as four options,
and whether to build a check for defects nobody had raised.
They answered the second with "Build it now"
and the first with "I believe there is a better option than those 4 you
listed",
naming none.

I then told them my reading was "build the check,
let it gate",
and called that their better option.
That is supplying an answer to the one question they withheld.
My own hedge in the same message,
"if that's not the better option you had in
mind,
tell me",
was the tell that I knew I was guessing.

The rule this earns:
a declined menu is not a delegation.
When a user rejects every option and names no replacement,
the question is still theirs,
and the only honest move is to do the part that WAS authorized and leave the
rest open.

#### Shadow mode, and why it is also the better engineering

The probe records and decides nothing.
`compareCandidates` is untouched.

That is not only deference.
The probe's failure mode is known before its first call:
every region it inspects contains a defect BY CONSTRUCTION,
since that is why the region was edited,
so a model asked whether anything is wrong will find something.
Its false-positive rate is unmeasured.
Wiring an unmeasured stage into a blocking position would let one bad verdict
discard a whole chunk's repair including fixes in other envelopes.
The 98.1 percent checker confirmation rate already on record is the reason to
measure a new prompt rather than assume a differently worded one discriminates.

Round three's artifacts plus the human repair-sheet grades
("fully fixes this defect AND breaks nothing nearby") are the measurement.
Re-open the gate question only with those numbers in hand.

#### Three defenses against the known failure mode

The verdict vocabulary offers NO `clean`.
It is `introduced-defect`,
`no-introduced-defect-found`,
`uncertain`.
`clean` would be false of a region whose original defect survives,
and forcing a prober to choose between `clean` and a defect verdict would push
every such region into the defect bucket.
The long negative name says what a negative verdict actually proves.

The pre-existing accepted issues are rendered into the sheet under
"PRE-EXISTING DEFECTS THIS EDIT TARGETED (these are NOT your findings)".

Every claim must quote the damaged wording from the AFTER text,
and `introduced-defect-screen.ts` then judges the quote with no model involved:
present in AFTER and absent from BEFORE is `corroborated`,
already present in BEFORE is `contradicted`,
missing or unfindable is `unanchored`.
Whitespace is collapsed on both sides first so a rewrapped quote still resolves.
That follows `screenNonTranslationVotes`:
deterministic evidence DISMISSES an impossible claim and never has to prove a
possible one.
There is no mechanical test for mistranslation,
so demanding positive proof would blind the probe to its own subject.

#### Where the telemetry lands

`ChunkRepairOutcome.introducedDefects` carries the whole report;
`RepairIssueRecord.introducedDefects` carries the tallies for the regions
serving THAT issue,
so a sheet item and the probe's opinion of the same item
join up inside one artifact record.
Both optional,
absent meaning unprobed.
The corpus artifact writer serializes `result.issues` wholesale,
so no writer change was needed.

`SLICE_CACHE_VERSION` 3 -> 4.

#### Also landed, found by sol while reviewing the probe

`assertCheckerIndependence` now refuses a checker roster listing one model
twice.
`gatherStageVoices` counts a repeated id's replies separately toward quorum
while `runCheckerStage` keys ballots by model id and collapses them,
so a three-model roster with a repeat could report quorum on what is really one
independent voice.
`assertJudgeableProducerRoster` already refused repeats for producers.
Latent,
not live:
the configured roster has no duplicates.
Verified.

Sol also flagged that `repair-chunk.ts` calls `assertCheckerIndependence`
without `refinerModelIds`.
CHECKED,
and it is not a defect:
`refine-phase.ts:111` makes the same call WITH refiners before any refinement
runs,
and returns early when the lane is off.
The chunk-level call happens before any refiner has written anything.

#### Gaps left open on purpose

The probe inspects the ACCURACY patch only.
The refiner lane is on (Kimi-K3,
which also edits),
so a defect the naturalness
rewrite introduces is invisible to it.
Sol's recommendation was to probe after every text-producing stage.
Not built:
it doubles the probe's cost and round three needs the accuracy
measurement first.
Watch for it when reading grades where `refined` is set,
since a human grading the final wording can mark N for damage the probe never
saw.

Sol's Q1 preference was a writer-disjoint DISCOVERY roster separate from a
confirming one,
so no model confirms its own claim.
The probe uses the checker roster for both.
Recorded because it is the first thing to try if the measured precision is poor.

#### File-budget moves

The critic stage plus its vote screening moved to `chunk-critic-phase.ts`,
and the probe exports to `probe-barrel.ts`,
both because the additions pushed `repair-chunk.ts` to 310 lines and
`pipeline-barrel.ts` to 324.
Split,
never raised (MXL).
`refine-barrel.ts` was the existing precedent for a second barrel.

#### The integration gap the warnings exposed

The pipeline stub in `repair-translation.unit.test.ts` had no script for
`introduced_defect_report`,
so every end-to-end run lost all prober voices and
the probe returned an empty report:
the wiring was never exercised and the suite would have stayed green if the
tally never reached the records.
Three cases now cover it,
and the middle one is the load-bearing assertion:
a defect EVERY prober corroborates must still ship.
That test fails the moment anything downstream starts reading the report,
which is what pins shadow mode against a future accidental gate.

### Run 005: the probe could not prove an omission

Commit `ec92567a5`.
Found by the advisor review immediately after run 004
started,
so the pass restarted again as `pass8-run-005` with zero artifacts lost.

The screen ran the differential in ONE direction only:
a quote had to be present in the AFTER text and absent from BEFORE.
The prompt said as much,
"quote the exact damaged wording FROM THE AFTER TEXT".

Omission damage has nothing in the AFTER text to quote.
Its absence IS the defect.
So every claim of the form "this edit dropped a clause" landed in `unanchored`
however true it was,
and a region the editors emptied outright could not be claimed against at all.

That is worse than a crash for a measurement instrument.
Dropping a clause while rewriting is among the likeliest ways an editor causes
collateral damage,
so `unanchored` would have filled with exactly the class that matters most,
and I would have read the round-three telemetry as "probers gave unusable
quotes" rather than "the screen cannot express this claim".
Sol's earlier review had flagged it in advance,
"zero-width insertions and empty replacements need explicit boundary-anchor
support",
and I shipped without it.
