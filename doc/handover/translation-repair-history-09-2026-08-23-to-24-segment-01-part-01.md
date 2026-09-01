# Translation repair history: 2026-08-23 to 2026-08-24

Part of the [translation repair history index](translation-repair-history.md).

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## Checker width: measured over 231 rounds, and the wide arm is deleted (`#188`)

The owner revised the "all producing roles to 4" ruling on 2026-08-23.
Producing roles STAY AT
THREE,
because `#186` measured that exact comparison and came back null and because four writers
leave two checkers,
which cannot decide anything.
Checker width was ruled separately and NOT by
opinion:
relax the independence assertion behind a switch,
run the arms,
compare per-issue
resolution,
ship the winner and delete the loser.

### What landed

`assertCheckerIndependence` takes `selfCertificationPermitted`.
Set,
the whole roster may check and
`tallyResolutionChecks` halves a checker per issue whose shipped text it wrote.
Unset,
which is the
default,
nothing changed.
Two refusals ignore the switch entirely:
a repeated checker id,
because it
makes `gatherStageVoices` count toward quorum what `runCheckerStage` collapses to one ballot,
and a
roster below three,
which is the new `assertCheckerQuorumReachable`.

The floor is `MINIMUM_CHECKER_COUNT = 3`,
derived rather than chosen:
resolution needs
`fixed > (notFixed + worse)`,
so at two checkers a disagreement returns nothing and only a unanimous
pair decides.
It is scale-free under the discount,
since halving both sides of that comparison
leaves it unchanged.

The floor found two test fixtures modelling rosters production would refuse:
`repair-translation`
ran two checkers and `repair-window-threading` ran one.
Both widened to three,
every checker still
clear of that fixture's editors.

### The instrument: one run, both arms

`runCheckerStage` summed three verdicts into a tally and discarded the verdicts.
It now publishes
one line per ballot naming checker,
issue,
verdict,
and whether that checker wrote the text under
review.
Ids and verdicts only,
pinned by a test,
because it prints on every run over an archive
nobody licensed us to copy.

THAT LINE IS WHAT MAKES THE COMPARISON PAIRED.
`buildResolutionMessages` does not read the roster,
so the sheet a narrow run sends is the sheet a wide run sends,
and every ballot a narrow arm would
have bought is present in a wide arm's log.
Both tallies are therefore read off ONE run:

-   narrow,
    over the three disjoint checkers at full weight
-   wide,
    over all six with the author marker choosing each weight

The arms differ by exactly the three ballots under test,
so run-to-run variation,
which `#186` found
large enough to swamp its signal,
cannot reach this comparison at all.

Rounds are recovered per issue rather than by log contiguity:
the k-th ballot a given model casts on
a given issue belongs to the k-th time that issue was checked.
Issue ids are `adjudicated/<hex>` and
unique per document,
measured 25 distinct over 25 rows on `lintong`,
and the refinement recheck asks
about the same issue a second time,
which is why the index is needed.

The analyser is `~/temp/agent/checker-width-tally.mjs`,
positive-controlled before use on a
synthetic log where one round must flip (narrow 2 fixed against 1 not-fixed resolves;
three authoring
writers at half weight take it to 2 against 2.5,
undecided) and one must not.

CORRECTED THE SAME DAY,
AND THE CORRECTION IS THE LESSON.
Reading ballots out of a log was a
workaround for the artifact not carrying them,
and the right fix was to make the artifact carry them.
`RepairIssueRecord.checkerReading` now holds every ballot,
the author flag that sets each weight,
the
seated roster and the tally,
so `~/temp/agent/checker-width-from-artifacts.mjs` reads settled runs
directly and re-tallies at either width with no log parsing and no re-running of the stage.
That
analyser is positive-controlled the same way,
and additionally recomputes each stored tally from its
own ballots so a weighting that changed under a settled artifact becomes visible rather than silent.

The log lines stay,
for two reasons that are not the artifact's job:
an operator watching a live pass
has the log and not the artifact,
and a run that aborts before settling leaves nothing else.
They are
derived from the readings,
so the two cannot drift.

### ANSWERED 2026-08-24: width changes nothing, and the wide arm is deleted

Four wide runs answered it.
Read off their `checker-ballot` lines by `~/temp/agent/checker-width-tally.mjs`,
one arm counting only the disjoint three and the other counting all six with a writer at half weight:

```text
run                                     rounds  ballots  narrow split  six disagreed  flips
checker-width-wide-batch-2026-08-24         89      515             1              9      0
checker-width-wide-batch2-2026-08-24        92      545             3              5      0
checker-width-wide-2026-08-24               21      126             0              0      0
checker-reading-vub-2026-08-24              29      174             0              0      0
TOTAL                                      231     1360             4             14      0
```

THE NULL IS ABOUT WIDTH RATHER THAN ABOUT SILENCE.
The six disagreed on 14 rounds,
and on 10 of those a writer answered something no narrow checker said,
so the three extra ballots carried real information that the arithmetic then absorbed.
A checker judging text it helped write counts half,
so three writers bring 1.5 against a unanimous 3.0 and cannot move it.
They can only reach a split three,
which happened on 4 rounds,
and on none of those did all three writers dissent together.

POSITIVE-CONTROLLED BEFORE THE NULL WAS BELIEVED,
per QPC.
`~/temp/agent/control-width-log/cat-control.log` is a synthetic ballot log of two rounds:
one where the narrow three split 2-1 and three writers dissent,
which must flip resolved to undecided at 2 against 2.5,
and one where the narrow three are unanimous and the same three writers dissent,
which must not flip at 3.0 against 1.5.
The analyser reports `FLIPS: 1 of 2` and names the right one.

CONSEQUENCE IN THE CODE:
`TRANSLATION_REPAIR_WIDE_CHECKERS` is gone,
and `RUN_MODELS.checkerModelIds` is the disjoint three unconditionally.
`checkerSelfCertificationPermitted` stays on `RepairModels` as the guard that refuses a writer`s
self-certification,
and production leaves it unset,
so the half-weight discount has nothing to apply to.

ONE CAVEAT FOR A READER RE-DOING THIS FROM ARTIFACTS RATHER THAN LOGS.
Three of those four runs were launched from a build predating `RepairIssueRecord.checkerReading`,
so `~/temp/agent/checker-width-from-artifacts.mjs` sees 0 rounds in them and 29 in the fourth.
The log analyser is what carried this measurement.
A rebuild does not change a running pass,
so a pass launched before a field exists never writes it,
however long it runs.

### The power of this measurement is bounded, and the bound is computable

Measured over 12 settled entries carrying issues,
514 accepted issues in all:

```text
shipped      / resolved=true    303
shipped      / resolved=false     7
no-region    / resolved=false   203
not-selected / resolved=false     1
```

The headline "58.9 percent resolved" is a dilution,
not a finding:
`no-region` issues never reach a
checker,
because no repair region served them.
Among the 310 issues the checkers actually ruled on,
303 resolved,
which is 97.7 percent and matches the 98.1 percent `checker-sensitivity.ts` recorded.

WHICH ROUNDS CAN FLIP IS DECIDABLE IN ADVANCE,
and the answer is narrow:
only rounds where the three
disjoint checkers SPLIT.
At three to nil the wide arm adds at most 1.5 of opposing weight against
3.0,
so the verdict holds.
At two to one the narrow arm resolves on 2 against 1,
and three authoring
writers answering the other way take it to 2 against 2.5,
which does not resolve.
So the count of
narrow-split rounds is a ceiling on the flip count,
and the analyser prints it first for that reason.

A NULL FLIP COUNT IS THEREFORE ONLY MEANINGFUL BESIDE THAT CEILING.
If the narrow three split on
almost nothing,
zero flips says the checkers agree,
not that width is irrelevant,
and the honest
report is that the experiment could not have answered the question at this sample size.
The 7 of 310
unresolved rate suggests the ceiling will be low,
so this is the likely outcome and is written down
BEFORE the data arrives rather than after.

### Two working hazards checked while the wide runs were in flight

REBUILDING `dist/` DURING A LIVE PASS IS SAFE,
and it was worth checking rather than assuming:
this
session rebuilt the bundle roughly a dozen times while two multi-hour verification passes were
executing out of it.
Every `import(` in `src/` is a TSDoc `{@link import('...')}` reference,
so the
package has no runtime dynamic import and a running pass holds every module it will ever need from
startup.
A rebuild that renames hashed chunks therefore cannot reach it.

`mise run //package/module/translation-repair:test:unit` DOES NOT BUILD.
The package declares two
tasks with that name,
and the bare one runs the suite against whatever `dist/` already holds.
A
source change followed by `test:unit` alone reports on the previous build,
which looks exactly like a
change that had no effect.
Run `build` first,
always.
This session read "the new log line never
appears" off a stale bundle before a positive control on a neighbouring line from the same function
exposed it.

### Interim reading, and one interim statistic that already moved

Across three wide passes,
234 ballots over 39 checker rounds,
every round hearing all six:

```text
rounds carrying at least one self-vote                     36 of 39
rounds where the narrow three split                         2 of 39   <- ceiling on flips
rounds where any of the six dissented                       4 of 39
rounds where a writer said something no narrow checker did  2 of 39
FLIPS                                                       0 of 39
```

CORRECTING AN EARLIER READING OF THIS SAME RUN.
At 24 rounds the last line read 0 of 24,
and that
was written up as the finding that carried the weight:
the added voices were not contributing a
distinct opinion at all.
Fifteen rounds later it reads 2,
so that claim was an artefact of sample
size and is withdrawn.
This is recorded rather than quietly overwritten because it is the exact
failure the ceiling discipline exists to catch,
and it caught it here on the strength of the numbers
rather than on anybody noticing.

WHAT THE NUMBERS SUPPORT SO FAR,
stated no more strongly than they earn.
The three added voices do
occasionally say something the disjoint three did not,
about one round in twenty.
In none of those
rounds did the verdict move,
and the arithmetic says why:
those rounds had a UNANIMOUS narrow panel,
so the wide arm reads 3.0 against at most 1.5 and cannot resolve differently.
The two rounds that
could have flipped,
the ones where the narrow three split,
are not the two where a writer dissented
uniquely.

So the honest position at 39 rounds is that no flip has been observed and only two rounds have ever
been able to produce one.
That is not yet an answer about width;
it is a measurement of how rarely
this checker panel splits at all,
which is 2 of 39.

The discount is genuinely engaged rather than idle:
36 of 39 rounds carry at least one self-vote,
so
this measures self-certification and not merely panel size.
That was the failure mode written down
in advance,
and it did not happen.

### Correcting the rebuild-safety reason, and a suite-counting rule that was wrong

THE REBUILD CONCLUSION HOLDS,
THE REASON GIVEN FOR IT DOES NOT.
The claim above says the package has
no runtime dynamic import because every `import(` in `src/` is a TSDoc reference.
The built bundle
was then searched directly,
which is the artifact a running pass actually executes,
and it carries
two:
`await import('node:fs/promises')` and `await import('node:path')`,
both inside
`run-config-*.mjs`.
Both resolve to Node builtins rather than to hashed chunks,
so a rebuild still
cannot reach a running pass,
but the safety rests on what those two imports name and not on their
absence.
The check to run is:

```sh
# from package/module/translation-repair
grep -oE '(^|[^.[:alnum:]_$])import\(' dist/final/node/*.mjs | grep -v 'import.meta' | wc -l
```

Anything that is not a `node:` specifier would break the guarantee.

`] PASS ` LINE COUNTS DO NOT DETECT FAILURE,
which contradicts how this document has been counting
suites.
The runner emits one `] PASS ` line per describe listing the cases that passed,
and separate
`] FAIL ` lines for the ones that did not,
so a describe with one failing case out of three emits a
PASS line AND a FAIL line.
A guard-removal run in this session held at 568 PASS while two cases were
failing,
and only the exit code and the FAIL count showed it.
Count all three:

```sh
grep -c '] PASS ' suite.log; grep -c '] FAIL ' suite.log; echo "exit=$?"
```

Exit code decides.
The clean baseline for this package is 568 PASS,
0 FAIL,
exit 0.

## The refinement recheck keeps its ballots too (`#192`)

WHAT WAS MISSING.
The naturalness lane asks the checkers a second time,
about the text a refiner
rewrote,
and until this landed that round left one finding and nothing else:
`refine-recheck-passed`
or `refine-rolled-back (<issue ids>)`.
A rolled-back slice therefore named the issues it lost and
never named who called them lost.
That is the same gap the deciding round had one stage over,
and it
was scoped out of that landing deliberately rather than missed.

WHAT LANDED.
`ChunkRepairOutcome` gains `recheckReadings` (required,
so every construction site says
whether a round ran) and `RepairIssueRecord` gains `recheckReading` (optional,
so an issue nobody
rechecked is absent rather than falsely unanimous).
`retainsResolvedIssues` now returns the readings
it already had in hand,
and both of its callers attach them:
the rollback path as well as the
keep path,
because the rollback is the case whose evidence matters most.

WHY IT IS A SECOND FIELD RATHER THAN AN UPDATE TO THE FIRST.
Both rounds rule on the same issue ids,
but `resolved` rests on the first alone.
The recheck is a rollback gate:
it keeps or discards a
rewrite whole and never revises `resolvedIssueIds`.
A reader that merged them would present a
verdict about text that may have been thrown away as the verdict behind what shipped,
and would hide
a checker that answered differently between the two rounds.

GFP,
BOTH DIRECTIONS,
each mutation applied to a committed guard and then reverted:

-   Making `retainsResolvedIssues` return `readings: {}` failed both new `runRefinePhase` cases and
    left the third one passing,
    which is the control:
    a slice with no confirmed issue buys no round,
    so an empty reading there is correct rather than a loss.
-   Removing the `recheckReading` spread in `repair-record.ts` failed the new disk-boundary case in
    `repair-provenance.unit.test.ts` and nothing else.

THE ANALYSER READS BOTH ROUNDS NOW,
labelled rather than merged,
and was positive-controlled on a
synthetic artifact carrying one deciding round that cannot flip and one recheck round built to flip.
It reports `FLIPS: 1 of 3` on that file with the flipping row labelled `recheck`,
so a null from it
is a null about the data rather than about the reader.

### Interim reading at 71 rounds

Four wide passes now,
422 ballots over 71 checker rounds:

```text
rounds carrying at least one self-vote                     68 of 71
rounds where the narrow three split                         2 of 71   <- ceiling on flips
rounds where any of the six dissented                       5 of 71
rounds where a writer said something no narrow checker did  3 of 71
FLIPS                                                       0 of 71
```

TWO OF THE FOUR PASSES ARE THE SAME ENTRY,
`lintong`,
run twice:
`checker-width-wide-2026-08-24` and
`checker-reading-vub-2026-08-24`.
Those two contribute 38 of the 71 rounds and rule on the same
underlying issues,
so they are correlated and the effective sample is smaller than 71.
Recorded here
because a later reader summing the four directories would otherwise treat them as independent.

The picture has not changed shape since 39 rounds:
the ceiling is still 2,
and the reason no flip
has been seen remains that this panel almost never splits.
One round in the batch pass lost a voice
and was decided by five rather than six,
which is the only panel-size variation observed.

### Why adding a required outcome field cannot crash a resumed run

THE WORRY,
WHICH IS REAL AND ALREADY ANSWERED.
`isChunkRepairOutcome` in
`package/module/translation-repair/src/corpus-run/slice-cache-store.ts` validates a cached outcome
field by field,
and it checks neither `checkerReadings` nor `recheckReadings`.
A cache file written
before those fields existed would therefore pass the guard,
and `buildIssueRecords` would then index
`undefined` and throw.
Two required fields were added to that type today,
so this is the exact shape
of failure to check for.

IT CANNOT HAPPEN,
because the cache is namespaced by the built pipeline's digest.
Each lane keeps its
own marker file next to its slices (`generation.txt`,
`refine-generation.txt`,
`translate-generation.txt` and so on),
`digestPipeline` computes that marker by walking the build
output directory recursively,
and a lane whose marker has moved deletes its own files rather than
reading them.
Measured rather than reasoned:
a run started under the pre-`checkerReadings` bundle
carries `sha256-tree-v1:b...` and one started after carries `sha256-tree-v1:9...`,
so the two never
share a namespace.

THE COST SIDE OF THAT SAME PROPERTY.
Any rebuild invalidates every cache,
so a pass resumed after a
source change re-buys everything it had already settled.
That is the reason not to restart a
long-running pass merely to pick up a field:
the in-flight passes finish under the bundle they
started with,
and a fresh run directory is what gets the new one.

### How much evidence the recheck was discarding, measured on settled artifacts

Across the 11 settled version 2 artifacts on disk (`~/translation-repair-runs-20260817/artifacts` and
`~/translation-repair-runs-flagged-20260818/artifacts`),
all of which predate both reading fields:

```text
issue rows                                          489
rows sitting on a slice the naturalness lane rewrote 208
of those, rows recorded resolved                     141
refine-recheck-passed findings                        23
refine-rolled-back findings                            0
rows carrying any checker reading                      0
```

So the recheck round has been ruling on 141 issue-level verdicts across 11 entries and leaving 23
one-line findings behind.
At the production roster of three that is several hundred ballots bought
and discarded in this population alone,
and none of it can be recovered without re-running the stage.
Nothing has ever rolled back,
which is worth knowing before reading a future rollback as routine.

A CAUTION FOR WHOEVER READS THESE ARTIFACTS NEXT.
There is no `slices` array under
`lanes.repair.result`;
the per-slice facts ride on the issue rows,
and `refined` is a field of
`RepairIssueRecord`.
A reader that walks a `slices` path gets zero from every artifact and the zero
looks like a measurement.

### The deciding round reaches a real artifact, with a same-entry negative control

VERIFIED AT THE USER BOUNDARY on 2026-08-24,
which is what `#188`'s instrument was owed.
The pass at
`~/temp/agent/checker-reading-vub-2026-08-24` settled `lintong` under the bundle that carries
`checkerReading`,
and its artifact holds:

```text
issue records                                     38
records carrying a reading                        29   all shipped / resolved=true
records carrying none                              9   all no-region / resolved=false
ballots per round                                  6
seated roster recorded                             6
rounds whose stored tally disagrees with a recompute   0
```

THE CONTROL IS THE SAME ENTRY ONE BUNDLE EARLIER.
`~/temp/agent/checker-width-wide-2026-08-24` ran
`lintong` with the same settings before the field existed,
and its artifact carries 30 issue records
and zero readings.
Same entry,
same switch,
one build apart:
the field is being written rather than
defaulted.

TWO INDEPENDENT READERS AGREE ON THE SAME RUN.
The log reader recovers 29 rounds and 174 ballots from
`checker-ballot` lines;
the artifact reader recovers 29 rounds of 6 ballots from
`RepairIssueRecord.checkerReading`.
They share no code and read different files,
so this cross-checks
both instruments at once,
and it also settles that a reading is present for exactly the issues a
checker ruled on and absent everywhere else.

### The split rate is a property of the ENTRY, which changes how to sample this

At 171 rounds and 1022 ballots across five wide passes:

```text
rounds where the narrow three split                         7 of 171   <- ceiling on flips
rounds where any of the six dissented                      15 of 171
rounds where a writer said something no narrow checker did  8 of 171
FLIPS                                                       0 of 171
```

WHERE THOSE SEVEN SPLITS LIVE MATTERS MORE THAN THE TOTAL.
`lintong` contributes 50 of the 171 rounds
across two separate passes and zero splits in either.
`Arita` and `GLaDOSister` contribute 20 rounds
so far and 4 splits,
which is a fifth of their rounds.
The panel's disagreement rate is therefore an
entry property rather than a constant,
and half the rounds bought so far came from the entry least
able to produce evidence.

CONSEQUENCE FOR ANYONE EXTENDING THIS.
Buying more `lintong` rounds raises the round count and leaves
the ceiling where it is.
Entries whose panels actually split are the only ones that can answer the
width question,
and the settled artifacts already say which those are:
read `refine-recheck-passed`
counts and per-entry split rates before choosing what to run.

## The accept gate keeps its ballots too (`#193`)

FOUND BY AUDITING WHAT A SETTLED ARTIFACT ACTUALLY NAMES,
rather than by reading code.
Walking one
artifact for every path whose value looks like a catalog id gives the whole inventory of per-model
evidence in a settled run:

```text
.lanes.repair.result.issues[].checkerReading.ballots[].modelId       174
.lanes.translate.result.sliceSelections[].round.ballots[].modelId     12
.lanes.translate.result.slices[].stageResult.ballots[].modelId        12
.consolidation.slices[].verdicts[].modelId                            12
.lanes.translate.result.sliceSelections[].round.producers[].modelId   11
.lanes.repair.result.chunks[].heardCriticIds                           3
```

The adjudication panel is absent from that list,
and it is the stage that decides whether a claim
becomes an issue the pipeline repairs at all.
`AdjudicatedIssue.tallies[claimId]` held five weighted
numbers and nothing else.
One measured entry carried 60 claims,
none naming any model,
with an
observed tally reading `supported=1, unsupported=5` and no way to know which panelist said which.

WEIGHTED,
SO THE SUMS ARE NOT RE-DERIVABLE.
`voteWeight` folds `AdjudicationConfig.weights` into the
totals before they are stored,
and no artifact records that table.
Even with the votes,
a run under a
non-default table could not be re-tallied.
The ballot therefore stores its own weight.

WHAT ELSE THE AUDIT CLEARED,
so nobody re-opens it:
`claimAttributions[].proposers` already names who
FILED each claim (`#76`),
and the editor and judge `rounds[]` already carry `ballots`.
Only the
panel's own votes were summed away.

### Why this one is optional where `checkerReadings` is required

`AdjudicatedIssue.readings` is optional,
and the reason is a real difference rather than convenience.
About thirty files construct an `AdjudicatedIssue`,
and almost all of them are readers and tools
rebuilding one from a settled artifact rather than adjudicating anything.
Requiring the field would
make every one of them write an empty record,
which would say "no panel voted" where the truth is "I
am not the panel".
Absence here has exactly one meaning:
this issue did not come from `tallyVotes`.

`configuredPanelists` IS required on `tallyVotes`,
threaded from the roster the caller already counts
for its log line.
A lost voice leaves no ballot while an abstention leaves one,
and only the seated
count separates them.

### Size, measured rather than assumed

Injecting a realistic six-panelist reading per claim into all twelve settled artifacts on disk:

```text
growth per artifact                    9% to 17%
largest artifact after injection      681 KiB
ceiling (#168)                       7168 KiB
headroom                                   91%
```

### GFP, three mutations

-   `readClaim` returning no ballots failed the three content cases and left the keying case passing,
    which is the control:
    that case is about pairing,
    not about what a ballot says.
-   Dropping `readings` from the merged-cluster branch failed the keying case and nothing else.
-   Rebuilding `RepairIssueRecord.issue` field by field,
    which is how the tally came to be the only
    thing stored,
    failed the new disk-boundary case.
    `buildIssueRecords` passes the issue through
    whole today,
    so that case exists to keep it that way.

Suite 569 PASS,
0 FAIL,
exit 0.
Lint 0/0.

### Two files split, neither for cosmetics

`tally-votes.ts` was exactly at the 300-line cap,
so `voteWeight` and `tallyClaim` moved to
`tally-claim.ts` beside the new `readClaim`.
`pipeline-barrel.ts` went to 303 lines,
so the ballot and
reading exports moved to a new `ballot-barrel.ts`,
which now holds every export belonging to one
question:
who voted,
what they said,
and what it summed to.
Three stages of this pipeline decide by
weighted vote and all three now record their ballots.

### A false verification, and the shell trap that produced it

RECORDED BECAUSE THE CLAIM WAS PUBLISHED BEFORE IT WAS CHECKED.
This session reported that the
settled rendering audit read both a pre-change archive and a new-schema archive cleanly,
"exit 0",
and that passing `--clone` was what made the difference.
Both halves were wrong,
and one shell line
caused it:

```sh
# WRONG: $? is basename's, not the audit's
printf 'exit=%s\n' "$(basename "$arch")" "$?"
```

Command substitutions in an argument list run left to right,
so `$(basename ...)` executes first and
resets `$?` to its own status.
Every reading came back `0`.
Capture the status into a variable on the
line after the command,
before anything else runs:

```sh
mise run ... > "$OUT" 2>&1
code=$?
```

WHAT WAS ACTUALLY HAPPENING,
once the status was read correctly.
`--clone` never mattered:
its
default is `RUN_CORPUS_PIN.cloneDir`,
which is `join(homedir(), 'one-among-us', 'data')` and already
correct.
The refusal was `readArchiveSubjects` doing exactly what it is built and tested to do,
refusing a directory that carries artifacts at its root AND in subdirectories.
A corpus RUN directory
is such a directory:
`artifacts/` beside `attempts.json` and `pass.lock`.
The audit wants the
`artifacts/` directory itself.

```sh
# from the worktree; note the trailing artifacts/
mise run //package/module/translation-repair:rendering-audit-settled -- \
  --archive "${HOME}/<run dir>/artifacts" --cap 0
```

THE REAL RESULT,
measured that way:
exit 0 on both,
zero error lines,
160 and 155 lines of report.
A full artifact consumer reads the two new reading fields without complaint,
which is the end-to-end
half of `#192` and `#193` that a parser call alone does not cover.

ALSO FIXED WHILE IN THERE.
`rendering-audit-settled-args.ts` used `NO_CAP` as the sentinel for
`indexOf` returning nothing found,
so one constant meant both "buy everything" and "not in the array".
Split into `NO_CAP` and `FLAG_ABSENT`,
which is the `#170` rule applied to a file that had escaped it.

## XIEPT2 lost 4 h 48 m at its last step, and the first diagnosis was wrong (`#194`)

THE `#189` VERIFICATION RUN FINISHED AND DELIVERED NOTHING.
`~/temp/agent/xiept2-verify-2026-08-23`
ran 17,295,337 ms with zero error lines,
wrote no artifact and no fixed page,
and the background
command reported exit code 0.
The only trace of the failure is the last line of its log:

```text
TALLY XIEPT2 status=ERROR ms=17295337 aborted=false
error=slice 12 has no translation and writes none: an anchor is where a rendering belongs, ...
```

`aborted=false`,
so this was not the per-entry deadline.
It threw at the very end,
in `spliceSlices`.

### The root cause named here first was WRONG, and the wrong one is the natural reading

RECORDED RATHER THAN QUIETLY REPLACED,
because it took a run log to refute and would be
re-derived by the next reader of `consolidate-settle.ts`.

The claim was:
`settleConsolidation` calls `judgeTranslateSlate` with `incumbentKind: 'present'`
hardcoded,
so at an anchor it judges and gates against a standing text that does not exist.
That line is unreachable with a blank standing text.
`settleConsolidation` returns `no-standing-text` about ninety lines above it,
at `if (standingText === '')`,
before any judge or gate is bought.
What the judges fall back on at that stage is `standingText`,
not the archive's own wording,
so where the literal is reached there really is a text to keep,
and it is true rather than assumed.
Threading the slice's own `incumbentKind` there would be actively wrong:
an anchor whose lanes both produced wording does have a standing text.
`9daa6e728` puts that reasoning in the file beside the literal.

### What actually happened, traced through the log

```text
pass.log:753   00:40  [translateDocument] slice 12: no translation in the archive
                      and none produced (no-candidate-backed); the passage stays missing
pass.log:754   00:40  SLICE-COST lane=translate chunk=12 sourceChars=344 exit=unfilled
pass.log:1962  04:12  TALLY XIEPT2 status=ERROR
                      error=slice 12 has no translation and writes none
```

THE ABSENCE MACHINERY WORKED.
`TranslateAbsenceError` was raised,
caught,
and the slice recorded unfilled,
which is exactly what `translate-absence.ts` promises:
one refused anchor costs its own slice rather than the entry.
The entry then ran the contest and the consolidation for another three and a half hours
and died at its last step,
in `publishFixedPage`.
`pass-entry.ts` calls that BEFORE the artifact write,
deliberately,
so that an artifact existing means a page was published;
the cost of the ordering is that a publish refusal keeps neither.

### The defect was one expression in the publisher

```ts
// corpus-run/publish-fixed.ts, before 5dabe9c92
replacementText: (reading.kind === 'wording') ? reading.text : '',
```

`WouldShipReading` exists to make that unrepresentable.
Its own comment:
"NEVER REPRESENTED AS AN EMPTY STRING,
which is the trap this whole shape exists
to close ... A reading that carries no `text` key at all makes that unrepresentable rather than
warned against."
Thirty lines later the builder turned the named absence back into the empty string,
and handed the splice a blank rendering at an anchor.

THE EMPTY STRING IS NOT SIMPLY WRONG,
which is why the fix is narrower than deleting that branch.
At a CONTENT span it is a real decision:
both lanes may have removed wording the archive held,
and the splice allows that.
Dropping the row instead would republish text the deciders agreed to drop.

THE TEST PINNED IT,
and its fixture is what gives the game away.
`publish-fixed-replacements.unit.test.ts` asserted a silent slice gets the empty string,
reasoning that "republishing the archive underneath it would undo it",
over a fixture with `incumbentKind: 'absent'` and `repairDelivery: 'gap-remains'`.
There is no archive wording at an anchor to republish.
The rationale was about content spans and the fixture proving it was an anchor.

### What shipped

`5dabe9c92`:
a silent slice contributes no replacement AT AN ANCHOR and keeps `''` at a content
span,
branching on `incumbentKind` rather than on an empty incumbent,
per `translate-absence.ts`:
testing the text conflates an anchor with a span whose archive wording
genuinely is blank.

THE SPLICE GUARD IS UNCHANGED AND STILL PROVEN.
`splice-slices.ts` refuses blank text at an anchor because it "leaves the passage missing while the
run reports it delivered",
and it is the only thing that stopped a silent hole reaching a memorial
page.
What changed is upstream:
nothing feeds it a rendering nobody wrote.
Its case moved into `publish-fixed.unit.test.ts` beside the case that now publishes the gap.

GFP-PROVEN BOTH DIRECTIONS.
Removing the anchor branch fails two cases in 38 ms:
`shippableReplacements` returns a row where it must return none,
and `publishFixedPage` raises the very `SliceSpliceError` that cost XIEPT2 its run.
Two control cases stay green through the removal,
the content-span silence and the ordinary decided wording,
so the failures are about anchors rather than about silence.

THE POLICY REVERSAL IS DELIBERATE.
The publisher used to refuse the entry outright,
on the argument that a half-document is worse than a failed entry because only the failure gets
retried.
XIEPT2 settled that:
the refusal kept neither page nor artifact,
and a retry meets the same passage and the same judges.
The archive already carries that gap,
so the page loses nothing that was ever there
and keeps every slice the run did buy.
The run still says so out loud:
`pageSilent` has been on the TALLY line since `#175`,
and the artifact records the slice as `unfilled` and `gap-remains`.

BLAST RADIUS ZERO on what already exists.
Across 44 artifacts on disk,
37 parsed,
199 slices,
every slice reads `wording`
and none reads `nothing-ships`,
so no published page deleted or refused anything.
The probe is `~/temp/agent/silent-slice-blast.mjs`;
that null rests on the anchor test case as its positive control rather than on itself.

### The silence column could not tell a gap from an emptying either (`#195`)

Every member of `WouldShipSilence` names which stage left a slice with no wording
and none of them says whether there was anything there to lose.
`lanesAgreedOn` admits it in its own comment:
an agreed empty string "covers a gap neither lane wrote into and text both lanes removed".
The two contest reasons share the fault at one remove,
since a content span whose archive wording is blank reaches them as readily as an anchor.

`a86cbb034` and `932e0b280`:
the silent reading carries `incumbentKind`,
filled from the comparison
row at both producers,
and `pageRelationLabel` reads `gap:<reason>`,
`emptied:<reason>`,
or
`silent:<reason>` for a row written before the field existed.
Three words rather than a name split,
so all three reasons are covered and no name is added.

IT ALSO CORRECTED `5dabe9c92`,
which had put `incumbentKind` on `WouldShipSlice`.
Two fields that must always agree with nothing enforcing it is worse than one where it is needed,
and the distinction only decides anything where nothing ships.

Nothing of the failed run is recoverable but the log.
The verification re-run is `~/temp/agent/xiept2-anchorfix-2026-08-24`,
launched 2026-08-24 04:47
from the fixed build.

## The published tree is read back now, and the first check that did it was too weak (`#197`)

FOUND 2026-08-24,
while looking for what else could fail the way `#194` did.

`#175` made the mirrored tree of fixed `page.en.md` files the thing this pipeline produces.
Every check built since reads artifacts.
An artifact is what the deciders said;
a page is what a reader gets.
`#194` is the price of the gap:
the publisher handed the assembler a blank rendering,
and the only thing that noticed was a guard inside the splice,
four hours and forty-eight minutes into the entry.

`verify-published` closes that.
It spends no quota and touches no model.
Run it with `TRANSLATION_REPAIR_RUNS_DIR=<dir> mise run //package/module/translation-repair:verify-published`.

### The first version passed a page with two hundred characters cut out of it

The check as first built was an ordered occurrence scan:
every wording the artifact says would ship must appear in the page,
in slice order,
without overlapping.
Its module note claimed
"a correct page always passes it,
and a page that lost or reordered a rendering cannot".

Run against four real run directories it reported everything clean.
Per QPC that is worth nothing until the probe is shown able to fail,
so the control was a throwaway copy of `163b-verify`
with two hundred characters cut from the middle of `dogesir_/page.en.md`.

    dogesir_: wordings=10 silent=0 pageChars=3640 missing=0
    CONTROL exit=0
