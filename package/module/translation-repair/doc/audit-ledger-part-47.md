# Audit ledger, part 47

Part 47 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B401: the cap, the ceiling and the drift opt-in were read by library code

Red in `7285b3c98c55a4654832943f3c444569cb536182`,
fixed in `e749bca51e21079a2ee4289ad20ae73206900c7e`.

Found on 2026-10-10 (UTC) by the agent working the open items B398 left.
`resolveHardCapMinutes` (`corpus-run/cap-override.ts`) and `resolveSpendCeilingUsd` (`corpus-run/spend-ceiling.ts`)
read `process.env` in the default of `raw`,
and `readDriftOptIn` (`corpus-run/pass-generation-guard.ts`) read it in its body;
`corpus-pass.ts` is each one's only production caller,
and the barrels re-export them.
By the agent's run against the base build,
`readDriftOptIn` handed `env: {}` with the process's variable at `yes` returned true,
and the walk case handed `yes` returned false:
two cases of `pass-generation-guard.unit.test.ts` fail at the base,
the one test file of the four named that the red commit's message counts failing.
The two resolvers already honoured a `raw` they were handed,
so their move is a signature change the type checker holds:
by the agent's account,
the two base cases that read the environment
("READS THE ENVIRONMENT when the caller names no raw text ..." in `cap-override.unit.test.ts`
and "READS THE DIAL FROM THE ENVIRONMENT when no value is handed in ..." in `spend-ceiling.unit.test.ts`)
give TS2741 against the new declarations,
and the new case in each file,
"READS ONLY THE TEXT IT IS HANDED,
never the process's own variable",
passes at the base.

The fix:
`raw` is required on both resolvers,
with no default that reads the environment;
`readDriftOptIn({ env })` reads the environment it is handed,
taking `env` rather than `raw`,
since `ALLOW_DRIFT_VAR` is private to its module;
and `corpus-pass.ts` reads all three over `process.env`,
in the order it read them before,
the opt-in now after the corpus pin and ahead of `resolveRunsDir()`,
a move no refusal can observe,
since the read cannot throw.
What each setting means and every refusal text are unchanged.
The TSDoc of `runCorpusPass` lists the drift opt-in among the reads made inside the refusal boundary,
and names the four library modules that read no environment for them.
This closes the first open item of B398.
The lead's gate on `e749bca51e21079a2ee4289ad20ae73206900c7e` passed:
the suite at 2,047 passing and 0 failing,
lint with no warnings or errors,
and 49 source scans passing.

Open,
seen by the agent and left:
`resolveRunsDir()` (`corpus-run/run-config.ts`) still reads `process.env` itself,
left since every production call of it is in an entry file,
or in a procedure an entry hands it to as a function
(`resolveRuns`,
or `resolveRunsDir` for `runCoverageProbe`),
by a search made for this entry;
and `streamBoundMs`,
which `bedrock-client.ts` arms a stream with,
is not a key of the real clock scan,
though no test or fixture sets it.
The stream bound was measured and closed on 2026-10-11 (UTC) by B416,
which found three test files arming a card's bound.

Open to the owner's veto:
the drift opt-in is read ahead of the runs directory,
where reading it after the runs directory,
inline as before,
is the alternative;
`readDriftOptIn` takes `env`,
where taking `raw` and exporting `ALLOW_DRIFT_VAR` is the alternative;
and the cap and ceiling cases point the process's own variable elsewhere to show the read never consults it,
so they write `process.env` and run one at a time,
where relying on the type checker alone is the alternative.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B402: the real clock scan did not read the windows a stage settings value carries

Found and closed in `7285b3c98c55a4654832943f3c444569cb536182`,
the red commit of B401:
the scan lives in its own test file,
so it passes against any production code,
and `e749bca51e21079a2ee4289ad20ae73206900c7e` does not touch it.

Found on 2026-10-10 (UTC) by the agent working the open items B398 left.
`real-clock-bounds.unit.test.ts` keyed `graceMs` but not `roundMs` or `writerMs`.
Production hands every round its window from `stageSettings.grace.roundMs` or `stageSettings.grace.writerMs`
as `graceMs`,
so those are the other names the straggler window goes by.
`CalibrationGrace.effectiveMs` and the `builtInMs` of `graceOverrideNote` are only printed,
and stay out of the keys,
as the TSDoc of `BOUND_KEYS` says.
The red is the scan's own fixture case:
by the agent's control,
a fixture text with two new `grace` literals fails
"FINDS a bare or local bound ..."
with 12 findings against the 14 it expects until both keys are added.
With both keys added,
the package-wide case lists 30 values not listed:
2 in `stage-settings.test-fixture.ts#scriptedStageSettingsWaiting`,
4 in `stage-settings.unit.test.ts#<module>`
and 24 in `writer-grace-override.unit.test.ts#<module>`.
The 28 in the two unit test files are windows a case reads back,
and no round runs under them.
The 2 in the fixture hand on its `graceMs` parameter,
whose callers' `graceMs:` values the scan already reads where they stand.
So none was a bound on the real clock the scan had missed,
and none moved to `HANG_STOP_MS`;
each is listed in the scan's `LISTED` with its reason:
`HANDED_ON` for the fixture's two;
`READER_OUTPUT`,
the output of `readStageSettings` asserted whole,
for the four of `stage-settings.unit.test.ts`;
and `WRITER_GRACE_READ_BACK`,
an output of `readWriterGrace` asserted whole,
or a grace handed to `writerGraceOverrideNote` and read back in its line,
for the 24.
The example B398 gave,
the `WriterGrace` literals of `editor-calibrate-run.unit.test.ts`,
cannot fire:
they are already `HANG_STOP_MS`.
By the agent's controls,
each reverted:
deleting one listed entry fails the scan with the finding
"found and not listed" for the `roundMs: 90_000` value of `stage-settings.unit.test.ts`;
and dropping `roundMs` from `BOUND_KEYS` fails the fixture case
and reports each listed `roundMs` key as "listed and not found".
One of the agent's controls set a literal bound in the tree for one run and put it back,
against the brief;
the lead found that file's `git diff` empty.
This closes the second open item of B398.

Open to the owner's veto:
one reason covers both the note inputs and the reader outputs of `writer-grace-override.unit.test.ts`,
where splitting the cases into named functions,
so the keys tell them apart,
is the alternative;
`effectiveMs` and `builtInMs` stay out of the keys,
where keying them and listing every printed value is the alternative;
and no value the scan found moved to `HANG_STOP_MS`,
where moving them is the alternative.

Recurrence:
`mistake-prevention.md`,
"Tests on the real clock".

### B403: a repair re-ask's own failure under the caller's stop reached no line

Red in `4cafeda7ee47f30bc19a1f110085dbe91d9bf3ac`,
fixed in `689064b25cf82602a3a1d2ed17a2e2c063cedb82`.

Found on 2026-10-10 (UTC) as the open item B365 recorded:
`repairInvalidCandidates` (`translate-repair.ts`) starts one `repairOneCandidate` per invalid candidate
and reads them through `allInInputOrder`,
and each calls `attemptStageCall`,
which rethrows a failure without writing it once the caller's signal has aborted.
So when two invalid candidates' re-asks both fail as the caller stops,
the call throws only the first failure in input order,
and a deadline or a provider's refusal the other seat's re-ask ended in reached no line.
B365 gave that as the agent's reading,
not run;
the red case runs it.
By the agent's census of production calls to `attemptStageCall`,
there are two:
the seat of a gather round in `stage-round.ts`,
which B365 covers by the line `askOnce` writes,
and this one,
which had none.

The red case,
in `translate-repair.unit.test.ts`,
sends back three candidates whose re-asks end as the caller stops:
the later-listed seat's first,
with a provider refusal carrying its words,
the first-listed seat's after it,
with another,
and a middle seat's in the caller's own reason.
It asserts one line per failing seat with that seat's own words,
no line for the seat that ended in the caller's reason,
and the first failure in input order as the thrown error.
Against the unchanged code it fails with the log holding three lines where five are expected.
By the agent's control,
removing the check that the failure is not the caller's reason fails the case with an extra line.

The fix:
`repairOneCandidate` catches the failure of its stage call,
and when the caller has aborted and the failure is not the caller's reason,
writes it on a `translate-repair` line naming the seat,
through `exchangeFailureLogText`,
as the stage round does,
then rethrows it unchanged.
The thrown error is the same as before.
Lines land in the order the re-asks end,
which the TSDoc `@throws` of both functions now says.

Open:
`readImagePair` (`image-reading-pair.ts`) reads its readers under `Promise.allSettled`
and calls `signal.throwIfAborted()` before `contained` logs a rejected settlement,
so a reader's own failure under a stop reaches no line;
the agent read it in the source,
and no case runs it.
Two lesser sites hold the same shape,
`fidelity-reference-read.ts` and `overlapped-map.ts`,
and are unread beyond that.
`gateProvider` writes the caller's own reason as a meter that could not be read,
and `meterRecordOf` names the failure's class alone,
dropping the provider's words.
Closed in B404 to B407,
which ran each;
`overlapped-map.ts` is the one site that stays open,
recorded in B405.

Open to the owner's veto:
the line reads "as the caller stopped the repair",
where the stage round's reads "as the caller stopped the round";
the stage label is the constant `REPAIR_STAGE`,
shared with the exchange's own lines;
the line carries the logger's `repairOneCandidate` tag,
where the round's `askOnce` line carries none;
the case waits one turn of the event loop for the later lines;
and a first failure on the translate path may be written twice,
once here and once by `translate-slice-attempt.ts`,
which is the agent's inference from reading both,
not run.

The double on the translate path was run on 2026-10-11 (UTC) and held;
B412 fixed it.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B404: a vision reader's own failure under the caller's stop reached no line

Red in `2a41fd28808237ce5a6441f41d3688ce9a2c8ded`,
fixed in `93850c5d3eb1bae2f7a0d023a731f24fa5b5650a`.

Found on 2026-10-11 (UTC) as the open item B403 recorded.
`readImagePair` (`image-reading-pair.ts`) reads its readers under `Promise.allSettled`
and called `signal.throwIfAborted()` before `contained`,
the one place a rejected settlement was written,
so a deadline or a provider's refusal a reader ended in as the caller stopped reached no line.
`readImageAsset` holds no `try`,
and `readPastRefusal` throws the caller's reason between asks.
Two red cases in `image-reading-pair.unit.test.ts` run it.
In the first,
three readers end as the caller stops:
the later-listed one first,
with a refusal and its words;
the first-listed one after it,
with another;
and a middle one in the caller's own reason.
In the second,
one reader is refused before the stop lands.
Against the unchanged code each fails with no line where the case expects one per failing reader.
By the agent's control,
removing the check that the failure is not the caller's reason fails both with an extra line.

The fix:
`contained` writes a failed reader's line through `exchangeFailureLogText`,
"failed outright (the failure),
and the caller stopped the reading",
when the caller has aborted and the failure is not the caller's reason,
and the abort guard now stands after `contained`,
so the thrown error is unchanged.
The lines follow roster order whichever reader ended first,
and a failure that ended before the stop is written too,
which a catch inside each reader would have missed.

Open to the owner's veto:
roster order,
where the round and the repair write in completion order at the member;
the guard moved after `contained`,
where a separate loop over the settlements needed a file split under the line limit;
and the line's wording.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B405: a pinned reference page's own failure under the caller's stop reached no line

Red and fixed in the same commits as B404.

Found on 2026-10-11 (UTC) as the open item B403 recorded.
`readReviewedFidelityReferences` (`fidelity-reference-read.ts`) reads a reference's two pages under `Promise.allSettled`
and threw the caller's reason in place of both,
though `readCorpusFile` takes no signal,
so either read's failure is always its own,
and the module held no logger.
Only the exported API reaches it:
`judge-fidelity-probe-run.ts` passes no signal.
The red case,
in `fidelity-reference-read.unit.test.ts`,
stops the read while both pages of a disposable clone fail as missing,
and fails with no line where two are expected.

The fix:
a root logger tagged `readReference` writes one line per failed page,
the source page's before the archive page's,
through `exchangeFailureLogText`,
when the caller has aborted and the failure is not the caller's reason,
then throws the reason as before.

`mapOverlapped` (`overlapped-map.ts`) was read too.
A job's exchange failure under a stop is written by the code the job calls,
by `askOnce`,
`repairOneCandidate`,
`readImagePair`,
and the abort catches of `translate-slice-attempt.ts`,
`repair-slice-buy.ts` and `repair-refine-step.ts`.

Open:
a job's failure of another kind,
such as `ConsolidationLedgerGapError`,
a hook,
a roster refusal or a cache write,
ending as the stop lands while a lower job throws the reason,
is dropped at the helper's throw with no line,
in the consolidation,
contest,
translate,
refine,
repair and insertion-admission lanes when the overlap exceeds one.
This is the agent's reading of the source,
not run.
The fix is the caller's signal threaded into `mapOverlapped`,
writing each failure it does not throw unless it is that signal's reason,
and nine caller modules outside the change would pass it.

Closed on 2026-10-11 (UTC) by B408,
which ran the reading red in six of the nine callers and found the other three unable to drop a failure.

Open to the owner's veto:
the module root logger,
where the alternative is a logger the probe passes;
the check against the caller's reason,
which no input reaches while the reads take no signal,
and which stays so the line remains right if a read starts honouring the signal;
and the line's wording.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B406: the census of fan-outs that read a caller's stop

Run on 2026-10-11 (UTC) as B403 asked of a fix of this shape.
Of 56 production files calling `Promise.all`,
`Promise.allSettled`,
`Promise.race`,
`allInInputOrder` or `mapOverlapped`,
36 hold no signal.
Of the 20 sites that do,
each member's own failure under a stop is written:
by `askOnce` for the gather round,
its race and the recovery round;
by `repairOneCandidate` for the repair;
by `meterRecordOf` and `gateProvider` for the meters;
and by the cited reference and work title lookups
(their catches then,
their returned outcomes since B414).
Two sites wrote none:
`readImagePair` (B404)
and the reference read (B405).
The settled buy passes a signal that never aborts.
`attemptStageCall` has two production callers,
`stage-round.ts` and `translate-repair.ts`,
as B403 counted,
and `attemptDecisionCall` has one,
`attemptStageCall` itself.
Every model exchange outside the clients and their decorators reaches one of those lines.

Open:
the `mapOverlapped` residual B405 records.
The lookups for cited references and work titles write the caller's own reason as a fetch failure
and answer it as data,
which is the shape B407 fixed in the gate;
this is the agent's inference from reading,
not run.

Closed on 2026-10-11 (UTC):
the `mapOverlapped` residual by B408,
and the lookups by B409,
which ran the inference and found it true.
The sentence on this entry's census that the lookups' catches write a member's own failure holds only for a failure that is not the caller's reason.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B407: the required-provider gate read the caller's stop as a meter failure, and the meter line dropped the provider's words

Red and fixed in the same commits as B404.

Found on 2026-10-11 (UTC) as the open item B403 recorded.
`gateProvider` (`corpus-run/required-providers.ts`) caught the caller's own reason,
wrote it as a meter that could not be read,
and refused the arm as `meter unavailable`.
By the red case,
with the stop landing while two meter reads ran,
it wrote "synthetic meter could not be read:
refused by Error"
and threw `RequiredProviderError` naming synthetic.
Only the exported API reaches it:
the pass's own call passes a signal that never aborts.
`meterRecordOf` (`provider-meters.ts`) wrote the failure's class alone,
"budget unreadable,
treating as spendable (SyntheticHttpError)",
dropping the status and the provider's words,
on every meter read a run makes,
and wrote a stopped read the same way.

The fix:
`gateProvider` takes the signal
and rethrows the caller's reason unchanged and unwritten,
still writing a read's own failure with the provider's words;
`meterRecordOf` takes the signal,
writes a stopped read as "budget not read,
since the caller stopped the reading",
and renders any other failure through `exchangeFailureLogText`.
A stopped read still records `unreadable`,
since the reading is shared and its first caller's stop resolves it for every sharer (`takeReading`).

Open to the owner's veto:
the gate still refusing as `meter unavailable` when a meter fails of its own under a stop;
a stopped read recorded `unreadable` in the `METERS` line,
which rests on the TSDoc of `takeReading` and on no ledger ruling;
and the stop line's wording.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B408: an overlapped job's own failure under the caller's stop reached no line

Red `7781cbaaa7`,
fixed in `63a4a35f0a`.

Found on 2026-10-11 (UTC) as the open item B405 recorded.
`mapOverlapped` (`overlapped-map.ts`) kept each job's failure by position
and threw the lowest position's,
so once the caller stopped,
a higher job's own failure reached no line when a lower job ended in the caller's reason.
By the red cases on the build of `e241a7be6`,
the consolidation,
contest,
translate,
refine,
repair and insertion-admission lanes each threw the reason at overlap two
and wrote nothing for a later slice refused by its hook,
by a re-seated roster with no translator,
or by an outcome naming no prepared slice.
The panel stage,
the judge fidelity probe and the reference read run one lane,
so they cannot drop one.
A buy's failure was already written by the twin memo,
and the abort catches of `translate-slice-attempt.ts`,
`repair-slice-buy.ts` and `repair-refine-step.ts` throw the reason.
B405 named a cache write among the dropped kinds;
that holds for neither the consolidation nor the contest,
where the persist runs inside the buy and the twin memo writes its failure.

The fix:
`mapOverlapped` takes the caller's signal,
a logger and an item namer,
all required,
and once every lane has ended and the signal has aborted,
writes each failure it does not throw,
in position order,
through `exchangeFailureLogText`,
except the signal's reason and a failure marked written through `markFailureWritten`,
which the twin memo calls after its own line.
The thrown error is unchanged.
Twelve cases hold it:
four in `overlapped-map.unit.test.ts`,
one per lane driver,
and the two lookup cases of B409.
A new fixture,
`stop-landing-hook.test-fixture.ts`,
lets a case land the stop inside a job's hook.

Open to the owner's veto:
the required item namer;
the caller's logger rather than the root;
position order once every lane has ended;
the module `WeakSet` marker,
set by the twin memo and not by `repairOneCandidate`;
a never-aborting signal in the reference read when its caller gave none;
the refine case's `UnpreparedSliceError`;
and the line's wording.

Changed on 2026-10-11 (UTC) by B412 and B413:
`repairOneCandidate` now marks its failure too,
and the map writes its unthrown failures whether or not the caller has stopped.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B409: the work-title and cited-reference lookups wrote the caller's stop as a failed fetch

Red `7781cbaaa7`,
fixed in `63a4a35f0a`.

Found on 2026-10-11 (UTC) as the open item B406 recorded.
`workTitleLookupLines` (`work-title-lookup.ts`) and `citedReferenceBlock` (`cited-reference-lookup.ts`)
caught the caller's own reason in each member,
wrote it as a lookup that failed or a page that could not be fetched,
and answered it as data:
by the agent's probe on the build of `e241a7be6`,
"refused by Error" for the member ending in the reason,
and the call resolved.
No ruling or caller holds a data answer under a stop.

The fix:
each member rethrows a failure that is the signal's reason while the signal has aborted,
unwritten,
so the call refuses with that one reason whichever member ended first;
every other failure keeps its line and its data answer.
The two scan entries now read `shared-abort`,
resting on `aborted` and `reason`.

Open to the owner's veto:
preparation now fails with the reason at the lookups,
where it went on with unfetched lines.

Changed on 2026-10-11 (UTC) by B414:
the members no longer reject,
so the two scan entries read `catches-own` and rest on the outcome readers.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B410: the census of other fan-outs found none open, and four defects beside them

Run on 2026-10-11 (UTC) beside B408.
Every caller of `mapOverlapped`,
the twin memo
and both lookups were read for a member's own failure under a stop that reaches no line,
on top of B406's census;
none remains.

Open,
found by that reading:
the twin memo writes the caller's reason as an abandoned buy on the translate and repair paths,
since its catch holds no signal (`twin-memo.ts`,
read);
a repair seat's failure under a stop is written by both `repairOneCandidate` and the twin memo in the consolidation,
the agent's reading,
not run;
two failures without a stop still drop the higher one,
which the owner's rule on a stop does not cover;
and the cited-reference block writes its per-page lines in completion order,
which its case hides by sorting.

Closed on 2026-10-11 (UTC) by B411 to B414,
which ran each reading red on the build of `06ca2a85ca`.
All four held,
and the run of the second found the translate path doubled as well.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B411: the twin memo wrote the caller's stop as an abandoned buy

Red `142ed0e987`,
fixed in `6c39c45556`.

Found on 2026-10-11 (UTC) as the open item B410 recorded.
`reuseTwinOrBuy` (`twin-memo.ts`) caught a buy's failure with no signal in reach,
and wrote the caller's own reason as "the buy for a shared key was abandoned (refused by Error)",
on every translate and repair buy the stop ended,
since their abort catches throw the reason.
By the red case on the base build,
a buy and the twin waiting on it each wrote that line.

The fix:
`reuseTwinOrBuy` takes the caller's signal,
required,
and `acquireConsolidation` with it;
the four production callers pass the signal their buy honours
(`consolidate-driver.ts`,
`lane-contest-driver.ts`,
`translate-slice-settle.ts` and `repair-slice-settle.ts`),
and no `AbortSignal.any` sits on those paths.
A failure that is the stopped caller's reason withdraws the key and writes nothing,
and the waiting twin still asks for itself,
its own buy meeting the same stop,
which the case shows by two buys started.
Every other failure keeps its line and the provider's words.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B412: a repair re-ask's failure under a stop was written twice

Red `142ed0e987`,
fixed in `6c39c45556`.

Found on 2026-10-11 (UTC) as the open item B410 recorded,
and on the translate path as the inference B403 left open.
In the consolidation,
`repairOneCandidate` wrote a seat's own failure as the caller stopped,
and the twin memo wrote the same failure again as an abandoned buy;
on the translate path,
`attemptTranslateSlice` wrote it again as the slice's abandoned line,
the memo then seeing only the caller's reason.
Both fail red on the base build.

The fix:
`repairOneCandidate` marks the failure it writes through `markFailureWritten`;
the twin memo writes no line for a failure that `failureWritten` reports;
the translate attempt writes its abandoned line without the failure's words when the failure is marked;
`mapOverlapped` already skipped marked failures.
The seat's line was kept because it names the seat and the stage,
is the only writer for every seat after the first in input order
and for callers with no memo,
and is written first.
Dropping the memo's clause "so any twin waiting on it asks for itself" loses no fact of the event:
it holds for every withdrawn key and is the documented behaviour of `reuseTwinOrBuy`.
By the agent's control,
restoring the memo's line for a marked failure fails the composed case with a third line.

Open to the owner's veto:
the memo writes nothing for a marked failure,
where the alternative is a short line with no failure text saying only that the key was withdrawn;
the translate attempt's line for a marked failure is bare,
where the alternative keeps the words and accepts the double;
and the marker stays in `overlapped-map.ts`,
now imported by the twin memo,
`translate-repair.ts`,
`translate-slice-attempt.ts` and `corpus-run/run-seats-read.ts`,
where the alternative is a module of its own.

Reversed by this entry:
B408's choice that the twin memo sets the marker and `repairOneCandidate` does not.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B413: an overlapped job's own failure with no stop reached no line, and the seat reading's was written twice

Red `142ed0e987`,
fixed in `6c39c45556`.

Found on 2026-10-11 (UTC) as the open item B410 recorded.
`mapOverlapped` (`overlapped-map.ts`) wrote nothing while the caller had not stopped,
so of two jobs failing of their own the higher one's failure reached no line;
and `readDrynessPastShortBench` (`corpus-run/run-seats-read.ts`) wrote its writing-bench stop
and threw it unmarked from the per-slice hook,
so under a stop the map wrote it a second time.
Both fail red on the base build.

The fix:
the map writes each failure it does not throw,
in position order,
stopped or not,
skipping the thrown one,
a failure marked written
and the aborted signal's reason;
a line with no stop names the item whose failure is thrown;
the seat reading marks its refusal.
The check that the signal has aborted stays,
since an unstopped signal's reason is `undefined`,
which a job can throw;
by the agent's control,
dropping it fails the case of a failure that is no error at all.
The case that pinned the old behaviour,
"WRITES NOTHING WHILE THE CALLER HAS NOT STOPPED",
is rewritten into the case that writes each unthrown failure with no stop.
From reading the source,
not running each caller,
the census of the nine callers' jobs found the hook refusals marked,
the buy failures written by the twin memo,
and a few kinds nothing wrote that the map now writes
(a consolidation ledger gap,
a roster refusal,
an unprepared slice,
and the stage and cache failures of the refine phase);
the panel stage,
the judge fidelity probe and the reference read run one lane and cannot leave a failure unthrown.
Of the catch blocks that both write and throw,
the writers reaching a job's end were the twin memo,
the seat reading and `repairOneCandidate`,
all now marked;
the scan's reach is limited to writes within eight lines of the throw.

Open to the owner's veto:
the map writes without a stop,
where the alternative is writing only under a stop,
which drops the higher failure;
and the no-stop line's wording,
"and the failure thrown is X's,
which comes before it".

Open:
under a stop,
`repair-slice-buy.ts` and `repair-refine-step.ts` would write a marked seat-reading refusal from the hook
a second time in their "abandoned by the caller's abort" line;
reaching it needs the dryness read to resolve as the stop lands,
and no honest red case was built,
so nothing was changed there.
Closed on 2026-10-11 (UTC) by B415,
which built the red cases.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B414: the cited-reference and work-title lookups wrote their per-member lines in completion order

Red `142ed0e987`,
fixed in `6c39c45556`.

Found on 2026-10-11 (UTC) as the open item B410 recorded for `citedReferenceBlock`,
and beside it for `workTitleLookupLines`.
Each lookup wrote its `REFERENCE` line,
its page that could not be fetched
or its failed lookup
from inside its member,
as the member ended,
and the cited-reference case hid it by sorting.
With a later page or title ending first,
both fail red on the base build.

The fix:
no member rejects;
each returns a named outcome (`PageOutcome`,
`TitleOutcome`),
the caller's reason as a stop;
once every lookup has ended,
the lines are written in input order from what each returned,
and the first stop's reason is thrown unchanged;
the cases assert the order exactly;
the scan entries now read `catches-own`,
resting on `failedPageOutcome` and `failedTitleOutcome`.
B409's stop case needs no wait for the line any more.

Open to the owner's veto:
a stopped call now waits for every lookup before refusing,
where the alternative refuses at the first lookup that ends in the reason
and gives up the input order of a stopped call's lines.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B415: a seat reading's refusal under a stop was written again by the repair buy and the refine step

Red `0f8847e91f`,
fixed in `5b0b8fef14`.

Found on 2026-10-11 (UTC) as the open item B413 recorded.
`buyRepairSlice` (`repair-slice-buy.ts`) and `refineSettledSlices` (`repair-refine-step.ts`) wrote their
"abandoned by the caller's abort" line with the failure's words,
even when the failure was the writing-bench refusal that `readDrynessPastShortBench` (`corpus-run/run-seats-read.ts`)
had written and marked,
so the refusal reached two lines when the stop landed as the checker stage or the recheck re-seated.
By the agent's run on the base build,
both modules,
handed the pass's own `reseatHookFor` over a client whose dryness read stops the caller
and then reports Bedrock alone wet,
wrote the refusal's clauses inside the abandoned line.
It can happen in production:
the budget read answers from its cached reading without consulting the signal,
and holds decay with the clock,
so the gate can see a hold the reading no longer sees.

The fix:
both catches write the abandoned line without the failure's words when `failureWritten` reports it,
as `translate-slice-attempt.ts` has since B412;
an unmarked failure keeps its words.
The three abort catches now agree on a marked failure.
`repair-benchmark.ts` writes the one other such line;
by reading its path no marked failure reaches it,
since its repair gets no hook and runs at overlap one.
The shared fixture `stop-landing-hook.test-fixture.ts` gained `stopLandingSeatReading`.

Open to the owner's veto:
the line for a marked failure is bare,
where the alternative keeps the words and accepts the double;
and the fixture sits in `stop-landing-hook.test-fixture.ts`,
where the alternative is a fixture of its own.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".
