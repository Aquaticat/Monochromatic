# Audit ledger, part 37

Part 37 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B232: a model reply's opening reached log lines and stored details through the parse refusal

Red in `afee9dcda`,
fixed in `4c26a48a0`.

Found by a census of every place a caught value becomes text,
and merged on 2026-10-06 (UTC).
`parseModelJson` (`model-content.ts`) returned `String(error,)` of its `JSON.parse` failure as `detail`,
and `readJsonPastFalseStart`,
`readJsonBeforeTrailingText` and `readPayload` (`stream-delta-scan.ts`) logged or kept the same.
V8's `SyntaxError` quotes ten characters of the text it refused:
a model's reply,
a provider's body or a stream frame.
The detail reached the schema-mismatch detail of `chat-json-outcome.ts` and the `stage-call.ts` lines,
while `lookup-cache.ts` already said this detail must never be repeated.
The red cases are the parse refusal of a reply opening with a ten-character word,
asserted against `refused by SyntaxError`,
and the package case of the scan B237 records.

The fix:
`parseModelJson` returns `refusalText` of the failure,
and the three readers go through `parseModelJson` where each caught a parse itself.
The parser is still a bare try around `JSON.parse`,
so the stream path does no more work per frame.
The reply's own opening and the stop reason stay in the outcome;
V8's reason and position are lost.

The lead ran 35 named test files before the fix was committed,
the scan among them,
with the 37 source scans and a clean type check.
The whole suite's runs on this change are recorded in B235.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries".

### B233: a failed model exchange was logged and recorded by its own message

Red in `afee9dcda`,
fixed in `4c26a48a0`.

Found by the census of B232.
Twenty-two functions turned a caught exchange failure into text with `String(error,)` or `caughtValueText`,
among them `attemptStageCall`,
`attemptDecisionCall`,
`reaskElsewhereNudged`,
`reuseTwinOrBuy`,
`readImagePair` (a rejected `allSettled` reader),
`runPick`,
`readDryness`,
`gateProvider`,
`reportModelHealth`,
the coverage probe,
`runRepairBenchmark` (two log lines and the stored `detail`),
and the abort-path lines of `repair-refine-step.ts`,
`repair-slice-buy.ts` and `translate-slice-attempt.ts`.
Three kinds of message can ride there.
A runtime `fetch` rejection for a header it cannot send quotes the header's value,
which is the key
(measured as a `TypeError` in the model-provider probe of 2026-10-05,
by the agent's report);
V8's JSON parse failure quotes the opening of the text it refused;
and `SyntheticHttpError` excerpts the provider's reply body on purpose.
The red cases throw a `TypeError` quoting a stand-in key (`quoting-failure.test-fixture.ts`,
invented)
and a `SyntheticHttpError` with a body,
and the logged lines held both.

The fix:
`exchangeFailureText` (`exchange-failure-text.ts`) prints a marked class's own sentence,
`refused by SyntheticHttpError with HTTP <status>` for a provider's status failure,
and the class name for anything else.
Every site named here uses it.
The lead's edit on the agent's change:
the model-health probe names an unreachable model's failure class once,
where it read `UNREACHABLE (TypeError): refused by TypeError`.

What was lost:
no log line carried a provider's own account of a refusal any more,
only its status,
and two comments (`completion-shape.ts`,
`request-size-refusal.ts`) that said the account stays on `bodyExcerpt` "for the log" became untrue for every class.
That account is the evidence a model is dropped on.
B266 and B268 record the follow-up that put it back by a typed read.

Not cased:
the abort-path lines,
the provider gate and the two probe commands have no behavioural case and rest on the scan (the agent's report).

Open to the owner's veto:
a separate `exchangeFailureText` where a wider `refusalText` is the alternative;
the picture reader's two lines left printing the local reader's failure text at this commit
(held in the scan with that reason,
and closed by B269).

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries".

### B234: the retry ladder logged a raw transport rejection and wrapped a non-Error without its cause

Red in `afee9dcda`,
fixed in `4c26a48a0`.

Found by the census of B232.
`exchangeWithRetry` (`transient-retry.ts`) logged `String(thrown,)` on every retry of a thrown transport failure,
the one place the unsendable-header rejection reaches before any marked class wraps it,
and `attemptExchange` turned a thrown value that is no `Error` into `new Error(String(error,),)` with no `cause`.
The red cases throw the quoting `TypeError`,
and a bare string,
and read the retry line and the wrapped error.

The fix:
the retry line goes through `exchangeFailureText`,
and the wrapper states `the transport threw a value that is not an Error` with the value as `cause`.

Open to the owner's veto:
the wrapper sentence no longer carries the thrown text.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries".

### B235: a cut stream's message repeated its cause and stayed withheld from every refusal printer

Red in `afee9dcda`,
fixed in `4c26a48a0`,
with one stale case repaired in `495f040b6`.

Found by the census of B232.
`StreamCutShortError` (`stream-cut.ts`) interpolated `String(cause,)`,
so it stayed withheld from `messageNamesOnly`,
and every `refusalText` caller printed `refused by StreamCutShortError`
while a `String` of it printed whatever the stream's failure said.
`stopReading` (`stream-drain.ts`) logged the cancel failure by `String` too.
The red cases cut a stream with a quoting cause and a stalled cause,
and cancel a body whose cancel throws the quoting failure.

The fix:
the class declares `messageNamesOnly`,
the inventory names the three parts it builds from,
and the cancel line uses `refusalText`.
The agent's patch stated the cause through `refusalText`;
the lead changed that to `exchangeFailureText`,
so a cause that is a provider's status failure keeps its HTTP status,
and a case asserts it.

The fix left the suite red at one case.
`stream-idle-guard.unit.test.ts`,
"reports caller steering as itself,
not as a stall",
still asserted that the cut's message contains the steering error's own words.
The lead had run 35 named test files before the commit and that file was not among them (M122).
The whole-suite run on `4c26a48a0` in a side checkout found it:
1,624 `[PASS]` lines and 3 `[FAIL]` lines,
all three that one case and its two enclosing suites,
with the lint finding nothing and the 37 source scans passing.
`495f040b6` makes the case assert what it is named for:
the thrown value is a `StreamCutShortError`,
its `cause` is the caller's own error by identity,
and its whole text is `StreamCutShortError: hf:whiskers: stream cut after 0 characters (refused by Error)`.
The whole suite then ran on `8ce45ae86`,
which holds this fix and that of B238 to B246:
1,628 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 37 source scans passing.

Open to the owner's veto:
marking `StreamCutShortError`.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries".

### B236: the window trial's two refusals were `RangeError`s the pick could only name by class

Red in `afee9dcda`,
fixed in `4c26a48a0`.

Found by the census of B232.
`runPick` (`window-trial-pick.ts`) logged `String(error,)` of anything the arms raised,
and `runSliceArms` raised two `RangeError`s whose sentences were its only account of why a slice was refused.
Naming the class alone would have lost which refusal it was.
The red case refuses a lone slice and expects the sentence in the warning.

The fix:
`TrialSliceRefusalError` (`window-trial-refusal.ts`) is marked and built from an entry id and a slice index,
the pick logs it through `exchangeFailureText`,
and the sentences are unchanged.
One test file the agent's patch no longer applied to,
`window-trial-slice.unit.test.ts`,
was merged by hand by the lead.

Open to the owner's veto:
the class change of the two refusals,
which were `RangeError`.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries".

### B237: no scan held the rule that a caught value never becomes text whole

Scan and red cases in `afee9dcda`,
wired and green in `4c26a48a0`.

Found by the census of B232.
Nothing read a caught value turned into text whole:
`caught-errors-kept.unit.test.ts` accepts any use of the binding,
and the inventory in `message-names-only.unit.test.ts` reads only the constructors of marked classes
and the sites that hand them a caught text.

The fix:
`caught-value-text.unit.test.ts` flags the forms listed in its module comment
(the argument of `String`,
`caughtValueText`,
`JSON.stringify` or a logger,
a template,
`.message`,
`.stack`,
destructuring),
keyed by file and enclosing function with a reason for each held function,
over a fixture case that finds every form.
Run on the agent's base it found 22 functions fixed by B232 to B236 and 22 held (the agent's count);
on the lead's red tree its package case listed 22 functions outside the held list.
The lead wired it into the `source-scans` task,
which ran 37 files from then.

Not reached,
by the agent's account:
a copy into another binding,
a value carried across a function under another name,
and text reaching a sink through a callback.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries".

### B238: a roster seating one model twice was gathered as several voices

Red in `d00bc71b4`,
fixed in `8ce45ae86`.

Found on 2026-10-06 (UTC)
by the second pass over the first-match census of B203,
which read the sites that census described and left.
`gatherStageVoices` counted each seat of a roster as a voice toward quorum.
The panel,
the critics and the page title bench keyed what they read by model id,
so a roster naming one model twice met quorum on voices that were one model and kept one of its replies.
Editors and checkers were refused a repeated id where their rosters are composed.
The agent's probe of the unfixed build gathered the panel,
critic and page-title stages over a roster of three seats naming one id twice,
and all three were accepted.

The fix:
such a roster is refused at the start of `gatherStageVoices`,
before any seat is asked,
as `StageRosterRepeatError` (`stage-roster-repeat.ts`),
marked,
naming the stage and each repeated id once.
The lead merged the inventory lines for the class and its `stage` part by hand beside another change's additions.

Measured by the lead:
no roster a run can seat trips the refusal.
`judgeSeatsFor`,
over all 16 combinations of four providers dry or wet,
returned 278 arrays of ids with no repeated member,
and 70 exported roster-like arrays hold none;
the same reader finds the repeat in a control roster.
Rosters a stage builds from these,
and a roster an operator's flag names,
were not read.

The whole suite's run on `8ce45ae86` is recorded in B235.

Open to the owner's veto:
a refusal in the gather for any stage.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B239: a stored naturalness confirmation bound to the first of two rounds it fits

Red in `d00bc71b4`,
fixed in `8ce45ae86`.

Found by the second pass B238 records.
`parseNaturalnessConfirmations` bound each confirmation to the first decisive round carrying its candidate's digests.
A correction chain that returns to a candidate it had reviewed leaves two rounds that fit,
and `assertNaturalnessCorrectionChain` does not refuse such a chain,
so the order and roster checks read the first round while the confirmation names neither.

The fix:
the reader gathers every fitting round and refuses a confirmation that fits more than one,
as `ArtifactParseError` naming the confirmation's position.

The agent's count,
not rerun by the lead:
76 stored artifacts carry no confirmation,
so the measurement refuses nothing and proves nothing,
and the writer records one round today.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B240: probe tallies took the later of two regions under one envelope id

Red in `d00bc71b4`,
fixed in `8ce45ae86`.

Found by the second pass B238 records.
`readRecordedTallies` built the tally table with `Object.fromEntries`,
so a second region under one envelope id in a stored record replaced the first tally without a word.

The fix:
the reader refuses the second region as `ArtifactParseError`,
naming its position and not the id.

The agent's count,
not rerun by the lead:
3,187 tally blocks in 76 stored artifacts,
none repeating an envelope id.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B241: the first slice carrying a replaced text was taken as the region's slice

Red in `d00bc71b4`,
fixed in `8ce45ae86`.

Found by the second pass B238 records.
`locateSlice` and the control gatherer of the relabel probe took the first slice
whose translation included a region's replaced text.
A short replaced text can stand in several slices,
and the probe would then rebuild its prompt from the wrong one.

The fix:
`holdingSlices` gathers every carrying slice and refuses more than one,
as `ArtifactParseError` naming the text's length,
in the case builder and in the control.

The agent's count,
not rerun by the lead:
each of the eight damaged-case positions has one carrying slice on the stored round-three run,
so none is refused,
and a two-letter text stood in 5 of 5 slices as the positive control.
The control's candidate regions were not counted.

Open to the owner's veto:
the relabel control refusing an ambiguous region where skipping it is the alternative.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B242: the window trial report let a later ledger row replace an earlier one for an arm

Red in `d00bc71b4`,
fixed in `8ce45ae86`.

Found by the second pass B238 records.
`groupBySlice` set each arm of a slice with `Map.set`,
so a ledger holding two rows for one arm credited the later one.

The fix:
a slice with two rows for one arm is left out whole and counted in `ClassReport.repeated`.
A refusal was rejected,
since the ledger is append-only
and the report would stay unreadable for want of a repair nobody may make.
`windowTrialReportLine` (`window-trial-report.ts`),
moved out of the probe's `main` so a case can read it,
ends with the count of slices left out for an arm the ledger holds twice.
The case is "PRINTS THE SLICES LEFT OUT FOR AN ARM THE LEDGER HOLDS TWICE
beside the incomplete and degraded counts,
with the noun agreeing with the count",
for two slices and for one.

Not measured:
no stored window-trial ledger was found to count repeats in.

Open to the owner's veto:
a count where a refusal is the alternative.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B243: settled audit runs were paired by a subject key built from a file the reader casts

Red in `d00bc71b4`,
fixed in `8ce45ae86`.

Found by the second pass B238 records.
`auditRepeatsAcross` keyed a run's rows by a subject key from rows the reader casts.
A repeated subject replaced the earlier row,
and a row without a numeric `sliceIndex` keyed as `undefined`.
The six stored run files,
written before commit `49e5a41cd` renamed the field `chunkIndex` to `sliceIndex`,
hold 124 rows that the old key collapsed to 15
and that are distinct by `chunkIndex` (the agent's count).

The fix:
both runs go through one reader that refuses a row naming no subject by either name,
and a subject on two rows,
as `StatedRefusalError` naming positions.
`sliceIndexOf` reads `chunkIndex` for a row with no `sliceIndex`,
so a run of that generation pairs with one of this generation by that value.
The case is "PAIRS A RUN WRITTEN BEFORE THE RENAME OF `chunkIndex` TO `sliceIndex`
with a run of this generation by that value,
since the rename changed the field's name and not what it holds".

Measured by the lead:
the rename was a rename alone in the audit's sources.
In commit `49e5a41cd`,
across the nine rendering-audit files it touches,
every removed line is one of that file's added lines with the field's name respelled;
across all 205 files of that commit the same test leaves 80 lines in 18 files unexplained,
so the test can show a difference.
Whether slicing itself changed between the stored runs of 2026-08-17 and that commit was not read.

Open to the owner's veto:
reading `chunkIndex` where refusing a run of that generation is the alternative.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B244: a pre-grade file naming one sheet position twice was scored by its later verdict

Red in `d00bc71b4`,
fixed in `8ce45ae86`.

Found by the second pass B238 records.
`scoreGradeAgreement` keyed pre-grades by sheet position with a map built from pairs,
so a file naming one position twice and carrying one row too many
matched the sheet's length and scored the later verdict.

The fix:
the map is built in a loop that refuses a repeated position as `StatedRefusalError` naming the position,
and the length check compares the count of rows.
`grade-agreement.unit.test.ts` is the module's first test file of its own,
so its line left the allow-list of `own-unit-tests.unit.test.ts`.
That scan was red at `d00bc71b4` for the stale line,
by the agent's run,
and the red commit's message says so.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B245: a prober answering one region twice was counted by its first check without a word

Red in `d00bc71b4`,
fixed in `8ce45ae86`.

Found by the second pass B238 records.
`screenIntroducedDefects` searched each prober's checks for the first on a region
and said nothing of a second.

The fix:
`resolveProberChecks` resolves each prober once,
first kept,
and writes `<model id>: duplicate-check (<region>)` for each later check,
as `resolveResolutionChecks` does for checkers.
The tallies are unchanged.
`runIntroducedDefectProbe` appends those findings to `IntroducedDefectReport.findings` after the gather's own.
The case is "REPORTS A PROBER THAT ANSWERS ONE REGION TWICE as a duplicate-check finding under its model id,
and counts its first check once".

Open:
the findings are not written into artifacts,
since `repair-record.ts` rebuilds the probe block field by field and leaves them out on purpose,
and the agent did not trace which scorecard prints them.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B246: a card dropped by a repeated served id was invisible to the key check

Fixed in `8ce45ae86`,
with its case,
which needs a name the fix adds.

Found by the second pass B238 records.
`servedRecord` (`model-card-derive.ts`) built its record with `Object.fromEntries` and checked key sets afterwards,
which cannot see a card replaced by a later card with the same served id.

The fix:
`recordOfDistinctIds` refuses the repeat where the record is built,
naming the provider and the id.
The real cards are distinct,
since the catalogs build at import and every test imports them,
so the case drives the helper.
The refusal was a `RangeError` at this commit and became an `Error` in `71974714f`,
whose message leaves that open to the owner's veto.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B247: a translation block ahead of a sealing note that no paired run could take stopped the whole page

Red in `3d4558d9c`,
fixed in `df807a8b5`.

Found on 2026-10-06 (UTC),
as the item B219 left open:
the commit that added `UnplacedTranslationBlocksError` made the drop loud and left the page refused.
`mergeOneSidedRuns` (`group-merge.ts`) threw for a held translation block when a sealed run stood in the section,
where the archive's own bytes could be kept.
The agent's seeded generator of 3,000 sections reached the refusal for 176 on one seed
(its measurement,
not rerun by the lead).

The fix:
`mergeOneSidedRuns` hands such blocks back as `unplacedTargetIds`,
`groupNodesSealed` and `subdivideSealedChunkPair` carry them,
and `prepareDocumentPair` keeps the blocks in no slice,
lists them in `unclaimedTargetBlocks`,
and names them by positional id in an `alignment target-unplaced` finding.
The refusal class is removed with its barrel line and its inventory name,
since no translation block remains that cannot be carried.
The cases are in `group-aligned.unit.test.ts`:
"CARRIES a translation block ahead of the sealing note that no paired run can take as unplaced,
with no run for it and the letter's original sealed",
and "PREPARES the same page through prepareDocumentPair with the greeting kept as the archive has it,
handed to the block correction round and named in a finding by its id".

The agent's measurements,
not rerun by the lead:
after the change all 9,000 sections of three seeds prepare,
and every translation block lands in exactly one of slice,
sealed,
declined and unplaced.
Measured by the lead:
83 named test files pass,
with the 37 source scans and a clean type check;
the slice census over the pinned corpus prints the same sixteen summary lines as before the change
(92 complete pairs,
1 incomplete,
1,259 slices).
No page of the corpus met the old refusal,
so that census does not exercise the new path.
The whole suite ran on `df807a8b5` in a side checkout:
1,629 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 37 source scans passing.
No cache version moved for B247 to B253:
the stores key on the pipeline digest,
which this build changes (the agent's note).

Open to the owner's veto:
carrying an unplaced block where refusing the page is the alternative;
the unclaimed record not telling unplaced from declined,
which only the finding's label does.

Recurrence:
`mistake-prevention.md`,
"Refusals inside a composed operation":
a step that cannot place a part keeps the part as it stands where that is sound,
and refuses the whole only where nothing can be kept.

### B248: a translation block held at a seal crossed it and was written out of order

Fixed in `df807a8b5`,
with its case,
which the agent ran red in its worktree.

Found by the generator of B247,
on 2 of 3,000 sections of another seed,
which threw a layout fault (`PlacementLayoutError`,
`overlaps-previous`).
`mergeOneSidedRuns` left a held translation block,
an unpaired heading ahead of the note,
held past the seal,
and it joined the original after the note,
so a slice at offset 0 came after an insertion at the seal's end.

The fix:
a translation block still held at a seal becomes unplaced there.
The case is "PREPARES a page whose heading ahead of the sealing note is unpaired
and whose later originals follow the seal,
keeping the heading out of every run that stands after the seal".

Recurrence:
`mistake-prevention.md`,
"Refusals inside a composed operation".

### B249: the consolidate store resumed a gate that heard fewer voices than its quorum

Red in `3d4558d9c`,
fixed in `df807a8b5`.

Found on 2026-10-06 (UTC),
closing the item B187 left open:
the store had never been driven against the real stage.
`isGateOutcomeOrAbsent` checked a gate's count against its ballots and never against `CONSOLIDATE_GATE_QUORUM`,
and the real stage returns `gate-kept-standing` with `usable: 0` when no gate voice answers.
The persistence rule never writes that settlement,
but the store resumed it.

The fix:
the store refuses a gate short of the quorum,
since a thin panel is the hour and not the slice.
A new file,
`corpus-run/consolidate-settlement-roundtrip.unit.test.ts`,
drives ten settlements of the real `settleConsolidation` through `persistConsolidationSettlement`
into an `openConsolidateCache` store and resumes each from a second one.
The cases are "REFUSES TO RESUME A GATE THAT HEARD TOO FEW VOICES,
the settlement the real stage returns when no gate voice answers and which the persistence rule never writes,
since a short gate is the hour and not the slice",
and "WRITES AND RESUMES WHOLE every settlement the real stage leaves worth keeping,
and writes none of the rest:
the store refused nothing the persistence rule wrote".

A second rule came with it,
for a state no input reaches today.
`consolidationWorthResuming` kept `slate-unjudged-standing` whatever its decision.
The agent's sweep of 160 inputs to `settleConsolidation` reached `no-voice-heard` in 12,
all of them a blank standing text beside a blank lane text,
which `laneTextsForSlate` never hands the stage.
Such a settlement is no longer kept,
since a later run could hear a voice.

Open:
the persisted variant of `wrap-erased-difference` is still proven only by the store's hand-built fixture,
since the real one in the table is kept as the archive has it.

Open to the owner's veto:
the guard for a settlement nobody was heard on.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail".

### B250: the final-selection findings read a consolidation that never ran as nothing to report

Red in `3d4558d9c`,
fixed in `df807a8b5`.

Found on 2026-10-06 (UTC),
closing the item B199 left open.
`finalSelectionFindings` read a consolidation recorded as not run as an empty list,
where `settledEntryArtifact`,
its one writer,
records every consolidation as settled.

The fix:
it throws `unreachable:` naming the kind found and that writer.
No input reaches it:
the writer sets the kind as a literal and `assertFinalNaturalnessComplete` already refuses it.
The case is "REFUSES an artifact whose consolidation has not run,
since settledEntryArtifact records every consolidation it hands persistence
and no polish can stand on a stage that never ran".

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

### B251: a 200 stream whose error chunk carried a 4xx code drew the whole retry ladder

Red in `3d4558d9c`,
fixed in `df807a8b5`.

Found on 2026-10-06 (UTC),
closing the item B202 left open.
A 200 stream whose OpenRouter error chunk carried a 400 or a 402 drew 3 exchanges for one request,
where the same refusal over plain HTTP is returned unretried (the agent's probe on a ladder of two retries).

The fix:
`InStreamRefusalError`,
a marked status failure carrying the code as its status,
is thrown by `requireNoStreamError` for a whole-number 4xx code other than 408 and 429,
and the retry ladder returns it unretried;
every other code still throws `InStreamProviderError`.
`requireBedrockStreamEnd` reads an error chunk before it asks for its terminator,
so an error chunk is named by its cause and not as a stream cut off before its end.
The cases are "SPENDS ONE EXCHANGE on a 200 stream whose error chunk carries a 4xx code,
since the same refusal over plain HTTP is returned unretried,
and a 429 chunk rides the whole ladder" (`openrouter-client.unit.test.ts`),
and "NAMES AN ERROR CHUNK on either route by its cause,
a refusal for a 4xx code and a provider failure for any other,
where both read as a stream cut off before its end" (`bedrock-stream-end.unit.test.ts`).
The lead added the `@throws` lines of the two clients' whole-message checks.

Not read from a captured frame:
the Bedrock reading is the OpenAI-compatible convention.
AWS documents no error frame in a stream,
by the agent's reading of its pages on 2026-10-06,
so a real Bedrock error frame may look different.

Open to the owner's veto:
a 409 chunk is now unretried.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal".

### B252: a picture reading's length was logged in UTF-16 units beside a verdict in solid characters

Red in `3d4558d9c`,
fixed in `df807a8b5`.

Found on 2026-10-06 (UTC),
closing the item B186 left open.
`readImageAsset` logged `trimmed.length`,
so fifteen astral letters logged as thirty characters beside a verdict that counted fifteen.

The fix:
it logs `solidCharacters` of the trimmed reading.
The case is "LOGS A READING'S LENGTH IN THE SOLID CHARACTERS THE VERDICT COUNTED,
not in UTF-16 units:
fifteen astral letters are fifteen characters and a short reading,
twenty spaced ones are twenty and a read".

Recurrence:
`mistake-prevention.md`,
"Text by code point".

### B253: one checker round read twice ordered its findings by which seat lost its first answer

Red in `3d4558d9c`,
fixed in `df807a8b5`.

Found on 2026-10-06 (UTC).
`runCheckerStage` took the gather's order,
the retry round and then the prompt rotation of the bench.
One input gave its findings and readings in two orders,
depending on which seat lost its first answer,
and two cases had sorted the findings,
which hid it.

The fix:
heard voices are ordered by roster through `inRosterOrder`,
so ballots,
findings,
readings and log lines follow the roster,
and the two sorts are removed from the cases,
whose assertions are now exact.
The case is "ORDERS THE READINGS AND THE FINDINGS BY ROSTER whichever seats lost their first answer,
since the gather hands voices back by the round that heard them and one input must read the same twice".

With the same change,
and with no change of behaviour,
the sentence for a pairing set aside is shared by the two commands that print it
(`pairingSetAsideSentence`,
the item B196 left open).

Open:
`refine-recheck.unit.test.ts` sorts its missing-check lines,
which may now be redundant (the agent's note).

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".
