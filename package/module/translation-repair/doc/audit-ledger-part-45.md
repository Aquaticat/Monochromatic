# Audit ledger, part 45

Part 45 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B373: a cut failure text read as whole

Red in `bb2a8b9ad1e164974e54d2750432a25b267ef0de`,
fixed in `cfac5b981`.

Found on 2026-10-06 (UTC) by the review of the runner observations change,
its seventh finding.
`cappedFailureText` cut a corpus read's opening at its cap,
then appended the kind and the remedy with no mark,
so a cut path read as the whole path.
By the agent's run on the port build,
the two cases with a long id,
in `tally-error-text` and `sentinel-probe-line`,
fail,
since each now expects the cut to end in the mark.

The fix:
an opening longer than the cap is cut one unit short of it and ends in `CUT_MARK`,
the ellipsis character,
before the kind and the remedy,
and the TSDoc of `TALLY_ERROR_CAP` says so.
By the agent's measurement,
the closing texts run to 92,
105,
140 and 93 units,
so a corpus read line's error text is at most 200 plus 140 units.

Open to the owner's veto:
The error text of the PROBE,
TALLY and CLEANUP lines can run up to 140 units past the cut,
and a cut opening ends in the mark within the cap;
the report names no alternative.

Recurrence:
`mistake-prevention.md`,
"Checks that vouch for a whole block".

### B374: a commit probe that threw in the process dropped the read's failure

Red in `bb2a8b9ad1e164974e54d2750432a25b267ef0de`,
fixed in `cfac5b981`.

Found on 2026-10-06 (UTC) by the review of the runner observations change,
its eighth finding.
A working directory removed under the process made the probe throw `ENOENT` before git ran,
and the read's own failure was lost:
by the agent's run on the port build,
the case removing the working directory saw an `Error` with the code `ENOENT` alone.

The fix:
`probeKeepingRead` wraps any probe failure that is not a child's
in an `AggregateError` holding the read's failure and the probe's,
with the probe's as its cause,
still no `CorpusReadError`;
the case,
renamed for stopping with both failures,
asserts the name,
the message and both members,
code 128 and then `ENOENT`.

Open to the owner's veto:
A probe failure in the process surfaces as an `AggregateError` holding both failures,
still a fault at exit 5;
the report names no alternative.

Recurrence:
`mistake-prevention.md`,
"Defaults that stand in for an input".

### B375: `offPin` counted artifacts its name did not say

Red in `bb2a8b9ad1e164974e54d2750432a25b267ef0de`,
fixed in `cfac5b981`.

Found on 2026-10-06 (UTC) by the review of the runner observations change,
its ninth finding.
The DONE line's `offPin=`,
named for artifacts of entries off the pin,
also counted the artifact of a finished entry whose English page the pin lacks,
though the pin holds that entry.
By the agent's run on the port build,
a new case putting such an entry through the DONE line fails,
with the renamed expectations.

The fix:
the field is `unpairedArtifacts`,
and its TSDoc names both populations it counts.

Open to the owner's veto:
The DONE line's field is `unpairedArtifacts=`;
the alternative is the old name,
`offPin=`.

Recurrence:
`mistake-prevention.md`,
"Labels a message names".

### B376: the `--only` line said a finished entry runs

Red in `bb2a8b9ad1e164974e54d2750432a25b267ef0de`,
fixed in `cfac5b981`.

Found on 2026-10-06 (UTC) by the review of the runner observations change,
its tenth finding.
The line said the entries it names run,
where a named entry that has finished does not.
By the agent's run on the port build,
a new case naming one finished entry beside one pending fails,
with four other expectations of the line.

The fix:
the verb comes from `wordForCount`,
"if still pending it runs" for one entry and "those still pending run" for more,
and the TSDoc says why.

Open to the owner's veto:
The `--only` line's verb reads "if still pending it runs" or "those still pending run";
the report names no alternative.

Recurrence:
`mistake-prevention.md`,
"Command lines".

### B377: TSDoc and wording defects in the runner observations change

Red in `bb2a8b9ad1e164974e54d2750432a25b267ef0de`,
fixed in `cfac5b981`.

Found on 2026-10-06 (UTC) by the review of the runner observations change,
its eleventh finding.
`countAmong`'s `@returns` named ids for a count;
`@param` and `@returns` lines of `countAmong`,
`classifyCorpusReadFailure`,
`kindOfFailure`,
`corpusReadRefusal`,
`codePointLength` and `roundWasJudged` said what and not why;
a test helper's name opened with an article;
the TSDoc of `MISSING_OBJECT_PHRASES` and of the `other` kind
described a message language `LC_ALL=C` no longer lets through;
and the off-roster note of `noJudgedRoundLine` read "1 of these artifacts name".
By the agent's run on the port build,
the case at one off-roster artifact fails on that note;
the TSDoc has nothing a case can fail.

The fix:
each is corrected,
and the off-roster sentence goes through `wordForCount`.

Recurrence:
`mistake-prevention.md`,
"Lint and edits" and "Counts in printed text".

### B378: the seven files the clock census deferred, and two ceilings on elapsed time in the round test

Red in `37c3419ea`,
fixed in `b7244804f`.

Found on 2026-10-10 (UTC) by the follow-up the census of B358 left open.
With `DEFERRED` emptied and no other edit,
`real-clock-bounds.unit.test.ts` fails with 34 findings in 15 keys,
all in the seven files
(`coverage-probe-run`,
`recall-benchmark-run`,
`sentinel-probe-run`,
`settled-carve`,
`translate-probe-run`,
`window-trial-probe-run` and `stage-round`),
by the measurement of the agent that wrote the change:
six more than the census counted at its base,
from cases added to `stage-round.unit.test.ts` in `d1e6af41c` and `154da3c68`.
That file held the round's quorum mark under 125 ms past its first answer,
which failed in 2 of 4 runs beside the stop cases (B365),
and held the grace of a round whose roster all answered under its 250 ms window.
By the agent's controls,
a busy loop of 300 ms between the first answer and the quorum mark fails the first,
and the same stall as the round cuts its seats fails the second.

The fix:
22 reads that only stopped a hang read `HANG_STOP_MS`;
12 stay listed with a class and a reason:
one window the case that loses a voice reaches,
seven values read back
(`recall-benchmark-run`,
`sentinel-probe-run`,
`settled-carve`),
and four other.
Six of the round test's grace windows moved to the hang stop,
since those rounds end before their window:
by the agent's probe,
every case passes at a window of 0,
where at the old shape only the case that loses a voice fails there.
The quorum mark is held to the span from the round's start to the next turn of the event loop,
which the microtasks between the first answer and the mark cannot outlast;
the whole-roster round's line is read at a timer armed after its last voice's own and as long,
and its grace is held to the span from that answer to that turn.
By the agent's controls,
each new shape passes under the same stall,
and fails when quorum waits for the slow voice,
or when the round waits out a window.
`DEFERRED` is empty,
with TSDoc saying why;
`DEFERRED_REASON`,
which nothing read,
and `QUORUM_MARK_SLACK_MS` are gone.
The lower bounds and the round's bound of an hour stay as the census left them.
Run on the merged tree before the fix commit:
lint clean,
49 scans passing,
and the suite at 2,030 passing with no failure.

Found on the way:
the per-call deadline of `translate-probe-run.ts` is armed as the whole slice round's signal,
and no case reaches it;
the other per-call deadlines in these files go to scripted stages or clients that never arm them.

Open:
the logger package's own sink verification bound of 5,000 ms timed out 21 times in the agent's suite run,
without failing a case.

Open to the owner's veto:
`concurrency: 1` stays on the round test's top-level describe,
its comment rewritten to give its history;
the alternative is to drop it,
now that the timing case no longer breaks beside other work.
The second case's ordering instrument is a `wait(SLOW_MS)` the case arms,
listed as class 4;
the alternative is a `setImmediate` started from the slow seat's answer through a hook on `scheduledClient`,
which adds no bound for the guard to read.
The second case's window moved from 250 ms to `HANG_STOP_MS`;
the alternative is to keep 250 as a value of class 1,
since the ordering check makes the window's length irrelevant there.
`CALL_TIMEOUT_MS` of `sentinel-probe-run`,
1,234 ms,
stays a distinctive value listed as read back;
the alternative is `HANG_STOP_MS`,
which the read-back would still match but which no longer marks the value as the test's own.
Two reason constants are new,
`RECALL_CALL_CONFIG` and `SENTINEL_DEADLINE`;
the alternative is reason strings written inline.
The round test's file TSDoc gains a paragraph,
"NO CEILING ON THE CLOCK";
the alternative is to leave the rule to `mistake-prevention.md` alone.

Recurrence:
`mistake-prevention.md`,
"Tests on the real clock".

### B379: the ledger and meter reports wrote the exit code on the caller's process

Red in `3fa45b1377073e74042d66fdb033f2533abbb7cc`,
fixed in `9d558da592162f9765fb03a2280af9477ada147d`.

Found on 2026-10-10 (UTC) by the agent working the runner leftovers,
among the observations the lead's brief handed on.
`reportLedger` (`corpus-run/ledger-report-run.ts`) and `reportMeters` (`corpus-run/meter-report-run.ts`)
wrote `process.exitCode` inside the procedure,
so a caller importing either had its own process status changed.
By the agent's census of the 42 distinct entries `src/build-entries.ts` lists
(it names `coverage-census.ts` twice),
37 set no exit code themselves,
leaving 4,
5 and 6 to `reportingRefusals` (`corpus-run/cli-refusal.ts`),
and after the fix five set one:
`ledger-report`,
`meter-report`,
`model-health` and `verify-published` from what their procedure returns,
and `editor-standing-read` inside its own `reportStandings`.
By the agent's search with `git log -S 'process.exitCode'` over `src/corpus-run`,
23 commits touched such a write,
and two removed one,
each on purpose:
`97aeee2ca` took `ASKED_WITHOUT_A_SEAT` out of `ledger-report.ts`,
a case the command-line reader now refuses,
and `354f6bae7` took `PUBLISHED_TREE_DISAGREES` out of verify-published,
which exits 0 with its findings;
the moves of `387af02b7` and `8206fa5c6` kept every code.
By the agent's run against the base build,
seven cases of `ledger-report-run.unit.test.ts` and three of `meter-report-run.unit.test.ts` fail,
each expecting the code returned and none left on the process,
for example `expected { lines: [ …(2) ], …(2) } to deeply equal { lines: [ …(2) ], returned: 1, …(1) }`.

The fix:
`reportLedger` returns `NOTHING_TO_READ` (1),
`LEDGER_INCOMPLETE` (2) or the new `LEDGER_READ` (0),
and `reportMeters` returns `NOTHING_RECORDED` (1) or the new `REPORTED` (0);
each entry sets `process.exitCode` from what its procedure returns,
and `meter-report.ts` gains a `main`.
`captureCodedReport` (`corpus-run/report-run-capture.test-fixture.ts`) reads what a report returned
beside what it left on the process,
and the cases expect the code returned and the process code unset.

The red commit fails 26 of the 68 named test files against `b7244804f`'s production code,
one of them without running a case,
since it imports `readPoolPolicy`,
which the fix adds (B380);
the other 42 pass either way.
Run on the merged tree before the fix commit:
lint clean,
49 scans passing,
and the suite at 2,032 passing with no failure,
two PASS lines more than B378's 2,030,
from the two suites `artifact-pool-conflict.unit.test.ts` gained.

Open:
the logger package's own sink verification bound of 5,000 ms timed out 12 times in the agent's suite run,
without failing a case,
as it did in the run B378 records;
the agent ran no suite at the base to compare.

Open to the owner's veto:
`editor-standing-read` still sets `NOTHING_RECORDED` on the process itself,
since its procedure lives inside the entry file;
the alternative is to split it into a `-run.ts` procedure that returns the code,
as its siblings are.

Closed on 2026-10-10 (UTC) by B392 (`752be22cf8f4d875333bf1d54efdb90955d619a1`),
which took the alternative:
`reportStandings` (`corpus-run/editor-standing-read-run.ts`) returns `NOTHING_RECORDED` (1) or `STANDINGS_READ` (0),
and the entry sets `process.exitCode` from what it returns.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B380: the artifact pool read its commit policy from the environment inside library code

Red in `3fa45b1377073e74042d66fdb033f2533abbb7cc`,
fixed in `9d558da592162f9765fb03a2280af9477ada147d`.

Found on 2026-10-10 (UTC) by the agent working the runner leftovers,
in its census of direct `process.env` reads in production code,
78 at the base.
`resolvePool` (`corpus-run/artifact-pool.ts`) read `TRANSLATION_REPAIR_REQUIRED_COMMIT`
and `TRANSLATION_REPAIR_POOL_ALL` itself,
under every reader that pools settled artifacts,
so a case chose its pool by writing the process's environment,
and a shell that exported either variable chose the pool a library caller measured.
The contradictory pair,
a required commit with `TRANSLATION_REPAIR_POOL_ALL=yes`,
was a plain `Error`,
which the commands printed as a fault at exit 5 under frames,
for a sentence telling the operator which variable to unset.
By the agent's run against the base build,
the as-built conflict cases of `score-attribution`,
`score-crosscheck`,
`score-probe`,
`draw-sample` and `damage-sample` exit 5 where they expect 6,
and `artifact-pool-conflict.unit.test.ts` fails to load,
with a `SyntaxError` for the missing export `readPoolPolicy`.

The fix:
`readPoolPolicy({ env })` returns a `PoolPolicy`,
its `requiredCommit` and `poolAll` read as before (`?? ''` and `=== 'yes'`);
`resolvePool` takes the policy as a required value
and refuses the pair as a `StatedRefusalError` with the same text;
and the readers over it
(`gatherAttributionEntries`,
`gatherProbeReadings`,
`collectShippedRegions`,
`readDrawPool` and the five procedures)
take the policy too.
The five pooling entries read it from `process.env` and hand it down.
By the agent's census after the fix,
82 direct reads stand:
the read in `resolvePool` is gone,
and five are new,
each in one of those entries' own functions.
`pool-policy.test-fixture.ts` holds the policy of an invoker who set neither variable,
and the pair as a built command's child is handed it and as the pool refuses it;
`artifact-pool-names.unit.test.ts` no longer clears the process's variables around its case.

Open to the owner's veto:
The contradictory pair is a stated refusal at exit 6,
where it was a fault at exit 5;
the report names no alternative.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world" and "Two layers reading one refusal".

### B381: three runs-directory readers read the environment, so relabel and verify ignored the directory handed them

Red in `3fa45b1377073e74042d66fdb033f2533abbb7cc`,
fixed in `9d558da592162f9765fb03a2280af9477ada147d`.

Found on 2026-10-10 (UTC) by the agent working the runner leftovers,
in its census of readers that reach the environment through a function.
`readArtifactRecords` (`corpus-run/probe-relabel-artifact.ts`),
`writeWidthReport` (`corpus-run/editor-width-report.ts`)
and `writeBenchReport` (`corpus-run/bench-report.ts`)
each called `resolveRunsDir()`,
which reads `TRANSLATION_REPAIR_RUNS_DIR`.
`runProbeRelabel` and `runProbeVerify` are handed a runs directory,
while their gatherers,
`gatherRelabelCases` and `gatherControlCases`,
read through `readArtifactRecords`,
so they read whatever the variable named,
not the directory their procedure was handed.
By the agent's run against a build holding these readers' base code,
each case pointing the variable elsewhere and handing the filled directory in:
`readArtifactRecords` fails with `RunJsonUnreadableError: could not read whiskers.json as JSON (ENOENT)`;
`writeWidthReport` writes outside the directory it is handed;
`writeBenchReport` leaves no `roster-bench/rows.json` there (ENOENT);
`runProbeRelabel` and `runProbeVerify` fail with `expected [ { …(2) } ] to deeply equal [ { …(3) } ]`;
and the relabel case,
control and gathering suites fail with ENOENT.
In that run the base build's width report cases tried to write under the worktree's default runs directory,
`node_modules/.monochromatic/translation-repair-runs`,
and failed with ENOENT;
by the agent's uncapped listing,
nothing was written there.

The fix:
the three readers take `runsDir`,
as do `gatherRelabelCases` and `gatherControlCases`,
and `runProbeRelabel` and `runProbeVerify` hand them their own directory;
`runRosterBench`,
`runEditorWidthProbe` and `runWidthDraw` take `runsDir`,
and the entries `roster-bench.ts` and `editor-width-probe.ts` pass `runsDir: await resolveRunsDir()`.
By the agent's census after the fix,
every production caller of `resolveRunsDir` is an entry or is handed the function
(`coverage-probe-run.ts` takes it as a parameter).
`runsDirPointedAt` (`corpus-run/runs-dir-pointed.test-fixture.ts`) stays for the three cases
showing that a directory handed in wins over the variable,
and the gathering,
bench report,
relabel case and relabel control tests no longer write the variable.

Not shown red:
`roster-bench-run.unit.test.ts`'s changed expectation,
which records the runs directory each report write is handed,
never ran against the base,
and no base build was left to run it on;
the red commit's message does not say whether that file is among the 26 it shows failing.
The width loop and width run tests pass `runsDir` to fakes that do not record it,
so only the type checker holds that pass-through.

Open,
a defect left to the owner:
`run-config.ts` reads the corpus pin at module load
(`RUN_CORPUS_PIN_SETTING`,
through `readCorpusPinSetting`,
which reads `TRANSLATION_REPAIR_CORPUS_CLONE_DIR` and `TRANSLATION_REPAIR_CORPUS_COMMIT`),
75 production files import that module by the agent's count,
and an unreadable value refuses at import,
exiting 1 with a stack outside `reportingRefusals`.
B302 records it as still open.

Open to the owner's veto:
`roster-bench` and `editor-width-probe` resolve the runs directory once at start,
not at each report write;
the variable means the same,
but with it unset a git failure in `resolveWorktreeRoot` now refuses before any quota is spent,
not after the first row;
the alternative is to keep the resolution lazy by handing the procedures a resolver.
The pipeline-wide reads stay where they are,
since moving each would change the signature of every stage on its way:
the straggler grace,
read by `resolveStragglerGraceMs` in the default of every round (`stage-round.ts`),
where the alternative is to hand the grace from the entry into each stage;
the writer grace,
read through `readWriterGrace` inside the consolidate,
translate,
refine and repair editor stages,
where the alternative is to thread it from the entry;
the slice overlap,
read by `readPassOverlap` inside `settleEntry` for each entry,
where the alternative is to read it once at the corpus-pass entry;
the contest records,
whose `recordContest` (`candidate-ledger.ts`) reads `TRANSLATION_REPAIR_RUNS_DIR` under `selectBestCandidate`,
where the alternative is to thread a runs directory through candidate selection;
the calibration grace,
whose `adoptCalibrationGrace` (`grace-override.ts`) reads and writes `process.env` for `editor-calibrate`,
where the alternative is to return the grace and pass it down;
and the outside reads,
`RUN_OUTSIDE_READS` (`pass-outside-reads.ts`) handing the live `process.env` on at module load,
where the alternative is to build them in the corpus-pass entry.

Closed on 2026-10-10 (UTC):
the corpus pin read at load,
and the outside reads,
by B394 (`d415f1ddac6b11f68193865985a69842ff9387d2`);
and the straggler grace,
the writer grace,
the slice overlap,
the contest records and the calibration grace by B398 to B400 (`477bbd6601509ac08d867e858af680a59c4f91eb`),
each by the alternative this entry named.
The resolution of the runs directory once at start still stands for `roster-bench` and `editor-width-probe`;
since B391 the width probe resolves it in `main`,
before its run builds the client.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B382: a refused fidelity reference request printed a stack at exit 5

Red in `3fa45b1377073e74042d66fdb033f2533abbb7cc`,
fixed in `9d558da592162f9765fb03a2280af9477ada147d`.

Found on 2026-10-10 (UTC) by the agent working the runner leftovers,
from the code,
since the lead's brief named it with no source text (M142).
`runFidelityProbe` (`corpus-run/judge-fidelity-probe-run.ts`) handed what the command line asked for
to `reviewedFidelityRequest`,
whose `FidelityReferenceError` reached `reportingRefusals` as a fault,
printed under frames at exit 5,
where the command's other refusals of what was typed print one stated line at exit 6.
The class is a fault elsewhere,
where a reference read from the clone fails its reviewed hashes.
By the agent's run against the base build,
three as-built cases of `fidelity-reference-cli.unit.test.ts` exit 5 where they expect 6,
with one stderr line and nothing on stdout:
an entry with no reviewed reference,
unreviewed context,
and the default damage families for an entry with no reviewed alteration;
and the case of `judge-fidelity-probe-run.unit.test.ts` on unreviewed context fails.

The fix:
`requestedSpecs` restates a `FidelityReferenceError` from the request check
as a `StatedRefusalError` carrying its message,
with the caught error as its cause,
and rethrows anything else;
its TSDoc says an empty checked-in manifest,
or one repeating an id,
is restated too,
though that refusal is not the operator's.
The site is listed in `FORWARDING_SITES` (`message-names-only.unit.test.ts`)
and held in `caught-value-text.unit.test.ts`,
both added before either scan flagged it.
A request a transport refused still logs `voice lost`,
and a trial whose judges are all lost logs `roster declined`,
as its siblings do.

The comment the fix wrote at `requestedSpecs` cited "ledger B313" for this defect,
an entry on a settled run file's row that was no object;
it cites this entry since `dc23e67cc1a4db79842412a448fd35c693ad433c`.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal".

### B383: the fidelity probe read its start after its references

Red in `3fa45b1377073e74042d66fdb033f2533abbb7cc`,
fixed in `9d558da592162f9765fb03a2280af9477ada147d`.

Found on 2026-10-10 (UTC) by the agent working the runner leftovers,
from the code,
since the lead's brief named it with no source text (M142).
`runFidelityProbe` read the start it records in its plan after it had read every reference,
so the time those reads took was left out of the run the plan and the kept run date.
By the agent's run against the base build,
the case
"READS THE START OF THE RUN BEFORE IT READS ANY REFERENCE and the finish after the last row,
so the plan and the kept run date the whole run and not the end of the corpus read"
fails;
it counts the reference reads made by each clock reading,
and expects `[0, 1]`.

The fix:
`startedAt` is read once,
after the request check and the return for a cap of 0,
before `readReferences`.
By the agent's census of the other runners,
`audit-sensitivity`,
`recall-benchmark`,
`coverage-probe` and the settled audit's drive read their start before any work;
`sentinel-probe` reads each entry's start before that entry's reads;
`roster-bench` reads its start before each stage call;
and `pass-entry.ts` reads it at the entry's start.
`corpus-pass` starts its loop clock after selection and republish,
which its documentation calls loop time shared with the soft budget,
and is unchanged.

Recurrence:
`mistake-prevention.md`,
"Durations on the system clock".

### B384: the coverage census counted every line as unrun for a suite that ran no test

Red in `3fa45b1377073e74042d66fdb033f2533abbb7cc`,
fixed in `9d558da592162f9765fb03a2280af9477ada147d`.

Found on 2026-10-10 (UTC) by the agent working the runner leftovers,
from the code,
since the lead's brief named it with no source text (M142).
`runCoverageCensus` (`corpus-run/coverage-census-run.ts`) refused a suite that failed,
and counted one that exited clean having printed no PASS marker,
so a suite that ran no test gave a census claiming every line of the package was code no test ran.
By the agent's run against the base build,
the new case's scripted suite of no passes,
no failures and exit 0
printed a census of nothing,
its first line `coverage-census at abc123def: the unit suite, 0 passes`,
and wrote `census.json`.

The fix:
the census throws a `StatedRefusalError` when the suite printed no pass,
before it tallies or places anything:
"the suite printed no PASS marker,
so it ran no test;
its log is" the log's path,
and why such a census is not counted.
The case asserts the whole message,
no tally,
no placement and nothing printed.

The comment the fix wrote beside the refusal cited "ledger B313" for this defect,
an entry on a settled run file's row that was no object;
it cites this entry since `dc23e67cc1a4db79842412a448fd35c693ad433c`.

Recurrence:
`mistake-prevention.md`,
"Claims without their evidence" and "Tasks,
builds and bulk output".

### B385: runner tests kept near copies of helpers a shared fixture could hold

Changed in `3fa45b1377073e74042d66fdb033f2533abbb7cc`,
passing before and after `9d558da592162f9765fb03a2280af9477ada147d`;
nothing in it can be red.

Found on 2026-10-10 (UTC) by the agent working the runner leftovers.
Its census read every top-level helper in the package's tests and fixtures,
reduced each body to its syntax shape
(node kinds,
operators and property keys kept,
identifiers and string,
template and number values dropped),
and grouped shapes of length 300 or more:
111 groups,
41 of them with members in two or more runner files.

The change:
the red commit names four fixtures,
`fresh-run-seats`,
`pool-policy`,
`runs-dir-pointed` and `slice-overlap-dial`,
with `runProbeOver` in the probes-b fixture.
`fresh-run-seats.test-fixture.ts` holds `withFreshRunSeats`,
whose body stood identical in the cli-refusal and run-config tests (group 104);
`runs-dir-pointed.test-fixture.ts` holds `runsDirPointedAt`,
identical in four tests (group 24);
`slice-overlap-dial.test-fixture.ts` holds the overlap dial of the slice-overlap and pass-entry tests,
a pair outside the census's 41;
and `probes-b-built-command.test-fixture.ts` holds `runProbeOver` and `ONE_ENTRY_CORPUS`,
from the `runOverOneEntry` of the coverage-probe and coverage-control-probe tests (group 12),
which the translate-probe test now uses too,
its second case keeping a corpus of its own for the `commitSha` it needs.
`pool-policy.test-fixture.ts` holds the values of the pool change (B380),
and replaced the variable clearer of `artifact-pool-names.unit.test.ts`,
which had no copy.
`GLOBAL_WRITER_COPIES` is gone from `duplicate-bodies.unit.test.ts`:
its three groups were `runsDirPointedAt`,
the `restore` nested in it and the overlap dial's restore,
kept apart while the global-writes scan followed a writer within its own file,
which it no longer does (B120);
the case's name no longer mentions them.
By the agent's run against the base build,
the moved files pass with their case names as at the base,
the renamed duplicate-bodies case aside.

Left,
each with the agent's reason,
read from a diff it ran:
group 3,
two cache stores answering `get` and `has`;
group 4,
two row scenarios with different counts;
group 8,
two console methods diverted;
group 43,
clients scripting different sheets;
and group 67,
different corpora,
pages and pictures.
Identical raw bodies the duplicate-bodies scan passes,
though it reads the whole package,
since it compares bodies of 80 or more characters with whitespace and comments aside,
and these fall under that floor once normalized,
by the agent's reading:
group 28,
`textsOf` and `idsOf`,
80 to 92 characters raw,
and group 72,
the Canadian helpers,
72 characters raw.
Read by names and members only:
group 38,
reports driving different procedures;
groups 14,
60,
88 and 98,
two-lane cat and kitten families for different scenarios;
group 53,
width clients scripted by model and by stage;
group 103,
`noReaches` over different reach types;
and 23 groups of shape alone,
helpers with different subjects and literals
(31,
32,
45,
52,
62,
65,
68,
73,
75,
76,
79,
80,
81,
82,
84,
91,
94,
99,
107,
108,
109,
110 and 111).

Open to the owner's veto:
Group 25's environment setters,
`withDriftVar` and `withRunsDir`,
set different variables and stay apart;
the alternative is a new setter keyed by the variable's name.

Recurrence:
`mistake-prevention.md`,
"Copies of shared code".

### B386: three as-built suites started their command through their own path

Changed in `3fa45b1377073e74042d66fdb033f2533abbb7cc`,
passing before and after `9d558da592162f9765fb03a2280af9477ada147d`;
nothing in it can be red.

Found on 2026-10-10 (UTC) by the agent working the runner leftovers.
`verify-published.unit.test.ts`,
`editor-standing-read.unit.test.ts` and `sink-names-only.unit.test.ts`
started their built commands through `runKeyless` with a path each built itself
(`VERIFIER`,
`STANDING_ENTRY` and a `command` and `args` pair),
not through the shared starter,
`runBuiltCommand`,
which adds the `TRANSLATION_REPAIR_STARTED_BY` marker the built command's guard reads;
the working directory,
`PACKAGE_ROOT`,
is the same.

The change:
the three start through `runBuiltCommand`,
and `VERIFIER` and `STANDING_ENTRY` are gone.
By the agent's run against the base build,
the three pass with their case names as at the base,
and pass after the fix.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".
