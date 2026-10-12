# Audit ledger, part 46

Part 46 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B387: `UnansweredContestSliceError` printed as a bare class name in the tally and in verify-published

Red in `3fa45b1377073e74042d66fdb033f2533abbb7cc`,
fixed in `9d558da592162f9765fb03a2280af9477ada147d`.

Found on 2026-10-10 (UTC) by the agent working the runner leftovers.
`UnansweredContestSliceError` (`corpus-run/would-ship-text.ts`) took a finished message and was unmarked,
so `refusalText` named its class alone:
a corpus pass's TALLY line read `refused by UnansweredContestSliceError`,
and verify-published's refusal line,
which `reportingRefusals` (`corpus-run/cli-refusal.ts`) writes through `refusalText`,
named the class the same way before printing the frames,
the slice lost in both,
where its marked siblings,
`CollapsedHeadingError` among them,
print their sentence.
By the agent's run against the base build,
the new `tally-error-text` case fails;
and the `verify-published-run` ordering case,
now building the error from its slice,
reads an empty message,
which is the red the new constructor gives against the base class,
since that class took a finished message.

The fix:
the class declares `messageNamesOnly: true`,
carries `sliceIndex`,
and writes "slice" and the index,
then "differs across lanes and the contest names it nowhere";
it is listed in `MARKED_CLASSES`.
Like `CollapsedHeadingError`,
it names no remedy for the operator.

Open to the owner's veto:
verify-published still prints this error as a fault at exit 5;
the alternative is a stated refusal at exit 6.

Closed on 2026-10-10 (UTC) by `752be22cf8f4d875333bf1d54efdb90955d619a1`,
which keeps the fault and records why in its message.
Every artifact verify-published reads goes through `parseSettledTwoLaneArtifact`,
which hands `parseLaneSelection` the comparison it recomputes,
and `assertContestCoversEligible` (`corpus-run/artifact-two-lane-read-contest.ts`)
refuses a contest that omits a slice whose lanes differ as an `ArtifactParseError`,
which `readEntry` (`corpus-run/verify-published-entry.ts`) prints as a `REFUSED by` line.
So the error is reachable only through a defect in the reader,
and its sentence offers the operator nothing to change;
no honest input reaches it,
and no case is red.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries".

### B388: two runners logged per-entry lines in completion order

Red in `3fa45b1377073e74042d66fdb033f2533abbb7cc`,
fixed in `9d558da592162f9765fb03a2280af9477ada147d`.

Found on 2026-10-10 (UTC) by the agent working the runner leftovers,
in its census of combinator calls in `src/corpus-run`:
48 sites,
five of them logging from inside a member.
The census reads only function bodies written inline in a combinator's arguments,
so a member passed by name is out of its sight,
and the order of log lines was checked only at the two sites fixed.
`probeDisplacement` (`corpus-run/displacement-probe-run.ts`) logged its per-entry lines
from inside its member of `allInInputOrder`,
and `withCitedReferences` (`corpus-run/rendering-audit-settled-buy.ts`) logged each page's CITED REFERENCES line
from inside its read,
so one input gave its lines in whichever order the members ended.
By the agent's probes against the base build,
with a print added to each test file and the file restored after,
the displacement probe logged Tabby before Mittens,
and the settled audit logged tabby's `characters=64` before mittens' `characters=77`;
the cases
"LOGS EACH ENTRY IT SKIPS IN THE ORDER THE ENTRIES ARE LISTED when the later entry's carve ends first,
so two walks over one archive log the same lines"
and
"LOGS WHAT EACH PAGE CITES IN BUYING ORDER when the later page's read ends first,
so two runs over one archive log the same lines"
fail there.

The fix:
the members return what they found,
and each runner logs after `allInInputOrder` has settled,
in the order of its input.

Left by the agent,
each with its reason:
`editor-calibrate-drive.ts` and `pass-insertion-admission.ts` print progress lines,
which follow completion by design;
and `entry-pictures.ts` reads through nothing a case can script,
so no case can order its reads and none can be red.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order" and "Searches and censuses that miss".

### B389: the settled audit counted cited characters in UTF-16 units, and its docs named the wrong caller

Red in `3fa45b1377073e74042d66fdb033f2533abbb7cc`,
fixed in `9d558da592162f9765fb03a2280af9477ada147d`.

Found on 2026-10-10 (UTC) by the agent working the runner leftovers.
The CITED REFERENCES line of `withCitedReferences` printed `characters=` from the text's `length`,
in UTF-16 units,
so a character beyond the first plane counted twice.
By the agent's run against the base build,
the case
"COUNTS WHAT A PAGE CITES IN CHARACTERS,
a character outside the basic plane once,
as the line names its unit"
fails:
a page citing U+1F408 (cat),
a space and `naps.`
logs `characters=8`,
where it expects 7.
Five TSDoc paragraphs in `corpus-run/rendering-audit-settled-buy.ts` said `main` was their function's only caller,
where it is `runSettledAudit` (`corpus-run/rendering-audit-settled-drive.ts`);
one said `readCap` refuses a typed negative cap,
where `readAuditArguments` reads `--cap` through `wholeNumberFlag`;
and a comment in `corpus-run/rendering-audit-settled-args.ts` placed `capped` in `rendering-audit-settled.ts`.

The fix:
the line counts with `codePointLength` (`code-points.ts`),
as the package counts a page's characters,
and each doc names the code as it stands.

Recurrence:
`mistake-prevention.md`,
"Text by code point" and "Claims without their evidence".

### B390: the runs lock warned that a claim's staged text was left when no claim had written it

Red in `5ba14c371fdc57996fb2aba3fdffb32758f62b33`,
fixed in `f5ea0872bf9f4e8d551b92c64aeba925cf1933e2`.

Found on 2026-10-10 (UTC) by the agent working the runner and git stretches of the final census (T8),
in a catch the census listed as cold in `corpus-run/runs-lock.ts`,
lines 214 to 217.
`stagedRemoval` removes the name a claim stages its lock text under,
and when that removal failed it warned
`<staged> is left after a claim and could not be removed (<code>)`.
A runs directory whose lock file fits within `PATH_MAX` while the staged name does not
refuses the claim's write with `ENAMETOOLONG`,
and the removal of the same name fails the same way,
so the warning named a file left behind that was never written.
The agent's probe (`crowded-probe.mjs` in its scratch folder),
run against the built package over a runs directory built to 4,060 units,
printed the old warning,
with `ENAMETOOLONG`,
for that unwritten file.

The fix:
the warning reads
`<staged> could not be removed after a claim (<code>); it stands beside the lock if the claim wrote it`,
and the TSDoc of `stagedRemoval` says why.
The case is
"SAYS THE CLAIM'S STAGED TEXT STANDS ONLY IF THE CLAIM WROTE IT,
where removing it fails:
a runs directory whose path leaves no room for the staged name refuses the claim with the system's own error,
and the removal fails the same way",
over a real runs directory of that length.
Against the unchanged code,
`runs-lock.unit.test.ts` alone fails,
with 3 FAIL lines,
by assertion on the warning line,
and the other nine named test files pass.
Run on the merged tree before the fix commit:
lint clean,
49 scans passing,
and the suite at 2,033 passing with no failure,
one more than before for the suite the runs lock cases added.

Open to the owner's veto:
the wording;
the alternative tells a failed write from a failed removal and says the text is left only for the second.

Recurrence:
`mistake-prevention.md`,
"Claims without their evidence".

### B391: the width probe built its client before anything a keyless operator could be told

Red in `cb553634188266b72019e60b6bd285d5746b0d32`,
fixed in `752be22cf8f4d875333bf1d54efdb90955d619a1`.

Found on 2026-10-10 (UTC) by the agent working the runner entry tails,
from the open items of the T8 passage "The runner and git cluster of the final census".
`editor-width-probe.ts` built its run client with `createRunClient()`
before it resolved the runs directory,
and `runEditorWidthProbe` (`corpus-run/editor-width-probe-run.ts`) took the built client,
so a process holding no key refused at the client
and never printed the count,
the draw,
or the refusal of an empty draw,
none of which needs a provider;
and the rest of `main` stayed cold in every keyless child.
By the agent's run against the unchanged production code,
three cases of `editor-width-probe-run.unit.test.ts` fail,
among them the new
"BUILDS THE CLIENT ONLY ONCE THE DRAW HOLDS A SLICE,
so a process holding no key prints the header and the draw and then refuses with what building the client said,
asking the panel nothing";
and two as-built cases of `editor-width-probe.unit.test.ts` fail:
the keyless refusal,
now expected after the header and the draw,
and
"REFUSES DRAW B OF A ONE-SLICE SAMPLE as stated and exits 6 before any client is built,
so the refusal that needs no provider is the one a keyless operator reads".
The as-built cases run over a throwaway runs directory,
lookup cache and corpus clone (`benchWorld`),
since the draw now comes before the client and would otherwise read the operator's own clone.
The red commit's message counts 9 of its 23 named test files failing against the unchanged production code,
four of them for want of the modules they import (B392);
the other 14 pass,
handing a repository the old signatures ignore (B393).

The fix:
`runEditorWidthProbe` takes `newClient`,
as `runRosterBench` does,
and calls it once,
after the draw is known to hold a slice and before `controlHolds` asks the panel;
the entry passes `createRunClient`.
By the agent's census over the round's 24 named test files,
the entry's one cold line is the closing `},);` of its awaited run,
which is wiring (the T8 passage).

Run on the merged tree of this round,
B394's and B398's:
lint clean,
49 scans passing,
and the suite at 2,047 passing with no failure,
14 more than B390's 2,033:
5 from this round's suites,
3 from B394's and 6 from B398's.
At the merge the lead resolved two TSDoc example lines,
in `corpus-run/draw-sample-pool.ts` and `corpus-run/draw-sample-run.ts`,
keeping both the pin of B394 and the repository of B393.

Open to the owner's veto:
one client,
built right before the control;
the alternatives are one client per stage,
or one built at the start as before.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B392: the editor standing read printed its stderr lines in whichever order its reads ended

Red in `cb553634188266b72019e60b6bd285d5746b0d32`,
fixed in `752be22cf8f4d875333bf1d54efdb90955d619a1`.

Found on 2026-10-10 (UTC) by the agent working the runner entry tails,
while moving the printer out of `corpus-run/editor-standing-read.ts`,
an open item of the T8 passage "The runner and git cluster of the final census" and of B379's veto.
The entry file held the whole printer and set its own exit code,
605 lines.
The listing of every named directory and the reading of every artifact ran side by side under `Promise.all`,
and each member printed its "no artifacts under",
off-roster or refused line from inside itself,
as it found it,
so one set of archives gave its stderr lines in completion order.
The case that holds it is
"SAYS EACH REFUSED ARTIFACT IN THE ORDER ITS ARCHIVE WAS NAMED when the later archive's read ends first,
so two runs over the same archives say the same lines",
which puts a 32 MB refused artifact in the archive named first and an empty one in the archive named second;
by the agent's measurement against the unmoved printer,
the second's line printed first.
At the base the case's file,
`corpus-run/editor-standing-read-run.unit.test.ts`,
cannot load,
since it imports a module the fix adds;
the order's red rests on that one measurement of a slow read,
and the fix does not depend on timing.
Before the move,
the agent tightened the as-built suite to pin whole outputs;
it passed against the unmoved printer and again after the move,
so the move changed no byte,
by the agent's account.

The fix:
the entry file is 43 lines of wiring,
and the printer is four role modules:
`corpus-run/editor-standing-read-listing.ts`,
`corpus-run/editor-standing-read-artifact.ts`,
`corpus-run/editor-standing-read-seat.ts` and `corpus-run/editor-standing-read-run.ts`,
whose `reportStandings` returns `NOTHING_RECORDED` (1) or `STANDINGS_READ` (0),
and the entry sets `process.exitCode` from it.
The listing and the reader return what they have to say (`said`),
and `reportStandings` prints every line once all reads settle,
in the order the directories were named and their artifacts listed.
The listing's "no artifacts under" lines have no red of their own,
since two failed listings end together;
the run case
"SAYS WHY EACH NAMED DIRECTORY COULD NOT BE LISTED,
in the order they were named,
and returns 1 over no artifact"
pins their order.
The editor runner barrel names the new modules;
the key in `caught-value-text.unit.test.ts` and two entries of `promise-combinators-in-order.unit.test.ts` follow them.

Open to the owner's veto:
`resolveRuns` is called only when the command line names no directory,
so git is never asked when directories are named,
as at the base;
the alternative is to resolve it at the start.
A kind-union outcome carrying `said` replaces the string sentinels and the `ARTIFACT_ABSENCES` record;
the report names no alternative.
The summary still prints `archives=0` when the runs directory is read by default,
byte for byte as before;
the alternative counts that directory as one archive.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B393: the artifact pool asked the package's own checkout for ancestry

Red in `cb553634188266b72019e60b6bd285d5746b0d32`,
fixed in `752be22cf8f4d875333bf1d54efdb90955d619a1`.

Found on 2026-10-10 (UTC) by the agent working the runner entry tails,
from the veto on the artifact pool case in the T8 passage "The runner and git cluster of the final census".
`resolveCommit` and `tipContains` (`corpus-run/artifact-generation.ts`)
defaulted `repository` to the directory of the built bundle,
and `resolvePool` (`corpus-run/artifact-pool.ts`) handed them none,
so the case
"RESOLVES A REQUIRED COMMIT NAMED BY A REVISION ..."
read this checkout's `HEAD` and `HEAD~1`
and failed on a checkout of one commit,
and no caller of `resolvePool` could ask another repository.
The rewritten case builds a throwaway repository of two commits with `makeNamingArchive`;
by the agent's run against the unchanged production code,
it failed with "Cannot place pipeline commit ... against required commit ...".

The fix:
`repository` is a required value on `resolveCommit`,
`tipContains`,
`selectEligible`,
`resolvePool`,
`gatherAttributionEntries`,
`gatherProbeReadings`,
`collectShippedRegions`,
`readDrawPool` and the five pooling procedures
(`printAttribution`,
`printCrosscheck`,
`printProbeScore`,
`drawGradingSample` and `sampleDamage`);
the five entries pass `import.meta.dirname`,
and every built bundle sits flat in `dist/final/node`,
so they name the checkout the default named.
`selectEligible` asks the repository nothing when no commit is required,
and cases with no required commit pass `UNASKED_REPOSITORY` (`corpus-run/pool-policy.test-fixture.ts`),
a path no directory stands at.

Open to the owner's veto:
`repository` is required even where no commit is required;
the report names no alternative.
Four cases of `corpus-run/artifact-eligible.unit.test.ts` still read this checkout's root commit and `HEAD`,
through `gitBounds`,
and hand the checkout in as `THIS_CHECKOUT`;
the alternative is a throwaway repository.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B394: the corpus pin was resolved at module load

Red in `b42882f3a74c02b8e77549e8075a18ccbad0a221`,
fixed in `d415f1ddac6b11f68193865985a69842ff9387d2`.

Found on 2026-10-10 (UTC) by the agent reading the corpus pin at each entry,
the open item B302 and B381 left.
`run-config.ts` held `RUN_CORPUS_PIN_SETTING`,
built by `readCorpusPinSetting` while the module loaded,
and `RUN_CORPUS_PIN`,
its pin;
and `pass-outside-reads.ts` built `RUN_OUTSIDE_READS` from them at load,
over the live `process.env`.
So an unreadable `TRANSLATION_REPAIR_CORPUS_COMMIT` or `TRANSLATION_REPAIR_CORPUS_CLONE_DIR`
exited 1 under bundled source before `reportingRefusals` ran,
in 34 of the 43 built bundles,
`index.mjs` among them,
whether or not the command reads the corpus.
Seventeen entries read the pin in code besides `corpus-pass`:
`coverage-control-probe`,
`coverage-probe`,
`displacement-probe` (its clone alone),
`draw-sample`,
`editor-calibrate`,
`editor-width-probe`,
`judge-fidelity-probe`,
`probe-relabel`,
`probe-verify`,
`producer-calibrate`,
`recall-benchmark`,
`roster-bench`,
`sentinel-probe`,
`slice-census`,
`translate-probe`,
`window-trial-probe`,
and `rendering-audit-settled` through its arguments.
Seven library modules read the constant in code:
`draw-entry-load`,
`pass-decline`,
`pass-entry-artifact`,
`pass-seated-pictures`,
`pass-outside-reads`,
`rendering-audit-settled-args` and `window-trial-protocol`.
By the agent's run against the base build,
each of the 17 commands gave code 1,
nothing on stdout and stderr beginning with the bundled source,
where `corpus-pin-entries.unit.test.ts` holds each at exit 6 with its whole stated line and nothing on stdout;
the same file holds a command that never reads the corpus,
`ledger-report`,
running past the setting.
The red commit's message counts 10 of its 15 named test files failing against the unchanged production code;
the other five pass,
the `--only` order case among them (B302's closing note),
and the rest hand a pin the old signatures ignore.

The fix:
`readCorpusPinSetting({ env, fallback })` reads the environment it is handed,
as `readPoolPolicy({ env })` does since B380;
`readRunCorpusPinSetting({ env })` replaces both constants,
its fallback a private constant of `run-config.ts`,
the same clone path and `CORPUS_COMMIT_SHA`.
Each of the 18 entries calls it inside its run callback,
at the callback's start by the agent's account,
except `corpus-pass`,
where it follows the cap,
the ceiling,
both windows and the overlap (B400)
and comes before the runs directory and the lock.
The library takes the pin as a required value:
`settleEntry`,
`runEntryPipeline`,
`loadEntry`,
`readDrawPool`,
`protocolDigest({ headSha, pin })` and `readSeatedPictures` take `pin`;
`readAuditArguments` and `runSettledAudit` take `runCloneDir`;
and `recordEntryDecline`,
`settledEntryArtifact` and `settledPageArtifact` take `corpusSha`.
`RUN_OUTSIDE_READS` is gone,
and `corpus-pass.ts` and `rendering-audit-settled.ts` call `outsideReadsFrom` in their own functions;
the removal is in this commit,
though the fix commit of B398 to B400 names it too,
having made the same change on its own branch (M144).
The pinned commit and its default are unchanged.
Cases also stand in `corpus-pass-refusals`,
`corpus-pin-override`
(rewritten so no case writes `process.env`),
`run-config`,
`draw-entry-load`,
`pass-decline`,
`pass-entry`,
`window-trial-protocol` and `rendering-audit-settled-args`.
By the agent's census over its 15 test files,
`readRunCorpusPinSetting`,
`readCorpusPinSetting`,
`loadEntry`,
`protocolDigest`,
`readAuditArguments` and `recordEntryDecline` show no cold stretch,
and the changed files it lists cold are callers whose suites were not in its run.
The whole merged tree's run is recorded in B391.

Open,
the lead's list,
not fixed:
the TSDoc in `corpus-run/corpus-pass-lines.ts` says "Until 2026-10-06" for the ordering wording and the literal 92,
where both left the code on 2026-10-10 (`cfac5b981`);
`doc/configuration.md` still names `RUN_CORPUS_PIN`,
the removed constant;
and the `INCOMPLETE` detail for an ordinary absent page still tells the operator to "check the path",
a path the pass builds itself,
where the alternative is to reword it locally in `passIncompleteLine` and `readSide`.

Closed on 2026-10-10 (UTC) for the dates and the configuration page,
by `34f669155d47ad0de95d674b21d8740b51ddff0d`:
the TSDoc in `corpus-run/corpus-pass-lines.ts` says "Until 2026-10-10" for both,
and the corpus pin paragraph of `doc/configuration.md` names `readRunCorpusPinSetting`
and says each command reads the pin once,
at the start of its run and inside its refusal boundary,
where it said the pin was read when `run-config.ts` loads.
The `INCOMPLETE` detail stays open.

Open to the owner's veto:
commands that never read the corpus now run past a malformed setting;
the alternative is to read it in every entry.
`rendering-audit-settled` refuses a malformed commit even when `--clone` is given,
as at the base;
the alternative is to read the clone half alone.
The 17 as-built cases sit in one file;
in `corpus-pass` the pin is read after the windows and the overlap and before the runs directory and the lock;
and `judge-fidelity-probe` reads the pin before `digestPipeline`;
the report names no alternative to these three.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal" and "Tests touching the real world".

### B395: the draw's entry loader read its source at the module constant

Red in `b42882f3a74c02b8e77549e8075a18ccbad0a221`,
fixed in `d415f1ddac6b11f68193865985a69842ff9387d2`.

Found by the move B394 records.
`loadEntry` (`corpus-run/draw-entry-load.ts`) read each entry's zh source at `RUN_CORPUS_PIN`,
whatever pin `drawGradingSample` was handed,
so the bands a draw built and the commit its sheets record could come from two pins.
The case is
"READS THE ENTRY'S SOURCE AT THE PIN IT IS HANDED,
never at one of its own"
(`draw-entry-load.unit.test.ts`).

The fix:
`loadEntry` takes `pin`,
which `readDrawPool` hands it from the draw.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B396: the window trial's protocol digest folded in the module constant

Red in `b42882f3a74c02b8e77549e8075a18ccbad0a221`,
fixed in `d415f1ddac6b11f68193865985a69842ff9387d2`.

Found by the move B394 records.
`protocolDigest` (`corpus-run/window-trial-protocol.ts`)
folded `RUN_CORPUS_PIN` into the digest the trial ledger resumes on,
whatever pin `runWindowTrial` was handed,
so a trial at another pin pooled rows bought at the first.
The case is
"CHANGES WITH THE CORPUS COMMIT IT IS HANDED,
so rows bought at another pin are never pooled"
(`window-trial-protocol.unit.test.ts`).

The fix:
`protocolDigest({ headSha, pin })` folds in the pin it is handed,
its clone and then its commit.

Not checked by a run,
an inference:
the digest's key order is the order the pin reader writes,
so a ledger keyed before the change still resumes at the same pin.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B397: the artifact and the decline record named the commit of the module constant

Red in `b42882f3a74c02b8e77549e8075a18ccbad0a221`,
fixed in `d415f1ddac6b11f68193865985a69842ff9387d2`.

Found by the move B394 records.
`settledEntryArtifact` (`corpus-run/pass-entry-artifact.ts`) and `recordEntryDecline` (`corpus-run/pass-decline.ts`)
named `RUN_CORPUS_PIN.commitSha` on the artifact and on the decline record,
whatever pin the pass read the entry at.
The cases are
"NAMES THE CORPUS COMMIT IT IS HANDED on the record,
never one of its own"
(`pass-decline.unit.test.ts`)
and
"NAMES THE COMMIT OF THE PIN IT IS HANDED on the artifact it writes and on a decline record,
never one of its own"
(`pass-entry.unit.test.ts`).

The fix:
both take `corpusSha`,
as does `settledPageArtifact`,
from the pin `settleEntry` is handed.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B398: the stage windows were read at every round and inside the writer stages

Red in `1e8ad4c070a15a130344f7bed7d668db6b59c6a9`,
fixed in `477bbd6601509ac08d867e858af680a59c4f91eb`.

Found on 2026-10-10 (UTC) by the agent working the pipeline-wide environment reads,
the alternatives B381 left open.
`resolveStragglerGraceMs` (`grace-override.ts`) read `TRANSLATION_REPAIR_STRAGGLER_GRACE_MS`
in the `graceMs` default of `runGatherRound` (`stage-round.ts`),
at every round;
and `writerRoundGraceMs()` (`writer-grace-override.ts`) read both window dials
inside the four writer stages
(consolidate-produce,
translate-produce,
refine and repair-editor).
So a case chose its windows by writing the process's environment,
no signature showed that a command depends on them,
and an unreadable dial refused a probe at its first round,
not at its launch.
By the agent's run against the base build,
a judges-only selection with the round dial at `300s` refused
although the case handed in its windows (`candidate-select.unit.test.ts`);
a refine stage with only the writer dial at `300s` refused with
"TRANSLATION_REPAIR_WRITER_GRACE_MS must be ...";
and eight `readWriterGrace` cases fail,
since it ignored the `env` it is handed.
The red commit's message counts 12 of its 156 named test files failing at run time
against the unchanged production code;
the rest are red only to the type checker,
which gives 540 errors in 152 test and fixture files against the base declarations,
and none in production.

The fix:
one value,
`StageSettings` (`stage-settings.ts`),
holding the `WriterGrace` and the `ContestLedger` (B399),
threaded along the one chain the reads share:
by the agent's reference walk from `runGatherRound` with oxc,
160 declarations in 128 files,
reached from 19 entries.
The 18 entries other than `editor-calibrate` call `readStageSettings({ env: process.env })` once;
`editor-calibrate` reads its windows through `readWriterGrace` with its own round fallback (B399).
`runGatherRound`,
`gatherStageVoices` and `runWindowedRounds` require `graceMs` with no default,
so a gather with no window does not compile;
reader stages pass `stageSettings.grace.roundMs`,
and the four writer stages pass `stageSettings.grace.writerMs`.
`resolveStragglerGraceMs` and `resolveWriterGraceMs` require `raw`;
`readWriterGrace({ env, roundFallback })` keeps the refusal order that names the round dial first;
`writerRoundGraceMs` is gone,
and so are the optional test seams `graceMs` on `reviewAbsoluteNaturalness` and `contestLaneSlice`.
The 17 probes now refuse an unreadable window in their entry,
before any round.
At the merge the lead resolved eleven conflicting hunks between this round and B391's and B394's,
in comments,
examples and one duplicate block (M144),
and added the overlap and the settings the merged signature requires to B394's pin case in `pass-entry.unit.test.ts`,
in the fix commit.
The whole merged tree's run is recorded in B391.

By the agent's census of direct `process.env` reads in production code,
82 at the base and 99 after,
the nine library reads of the items this round moved are gone,
and every new read is in an entry's own function.
By the agent's census over its 13 test files,
none of `stage-settings.ts`,
`corpus-run/pass-overlap.ts`,
`grace-override.ts`,
`writer-grace-override.ts` and `corpus-run/slice-overlap.ts` has a cold stretch,
and the cold stretches in the files it touched are older code.

Open:
"only entries read the environment" holds for these reads and for the bases of child environments,
not for the whole package.
`resolveHardCapMinutes` (`corpus-run/cap-override.ts`) and `resolveSpendCeilingUsd` (`corpus-run/spend-ceiling.ts`)
read the environment in their default parameters,
and `readDriftOptIn` (`corpus-run/pass-generation-guard.ts`) in its body;
`corpus-pass.ts` is each one's only production caller,
by a search made for this entry.
The alternative is a required `raw` or `env`,
as done for the windows.
A scan gap the move opened:
`real-clock-bounds.unit.test.ts` keys `graceMs`,
but not the `roundMs` or `writerMs` of a `StageSettings`.
Tests hand windows only through `SCRIPTED_STAGE_SETTINGS`
or `scriptedStageSettingsWaiting({ graceMs })` (`stage-settings.test-fixture.ts`),
whose `graceMs:` key the scan reads,
and the `WriterGrace` literals of `editor-calibrate-run.unit.test.ts` are out of its reach;
the alternative is to add both keys and list the literals of a reader's output.

Closed on 2026-10-10 (UTC) by B401 and B402
(`7285b3c98c55a4654832943f3c444569cb536182`,
and `e749bca51e21079a2ee4289ad20ae73206900c7e` for B401's production code):
`corpus-pass.ts` reads the cap,
the ceiling and the drift opt-in over `process.env` and hands each in,
and none of the three library functions reads the process's environment (B401);
and the scan keys `roundMs` and `writerMs`,
with each value it finds under them listed with its reason (B402).
The example this entry's open item named could not have fired:
the `WriterGrace` literals of `editor-calibrate-run.unit.test.ts` are `HANG_STOP_MS`,
which the scan leaves alone,
and were so in this entry's red commit.
`resolveRunsDir()` (`corpus-run/run-config.ts`) still reads `process.env` itself,
recorded under B401.

Open to the owner's veto:
one `StageSettings` value for both windows and the ledger;
the alternative is separate `graceMs` and `contestLedger` parameters.
Tests run their rounds under the hang stop,
60,000 ms for both windows in `SCRIPTED_STAGE_SETTINGS`,
instead of the 120,000 and 180,000 ms they took from the environment;
so the note case in `editor-calibrate-run.unit.test.ts` reads `60000ms ... 60000ms` where it read `5678ms ... 1234ms`,
and no longer tells the two numbers apart;
the alternative keeps 1234 and 5678 as small bounds on the real clock.
`CorpusPassInput` keeps `graceNote` and `writerNote` beside the new fields,
and `RepairChunkRequest` (`repair-chunk-request.ts`) and `PassPrepareRequest` (`corpus-run/pass-prepare-request.ts`)
are modules of types alone,
split out because `repair-chunk.ts` reached 306 code lines and `corpus-run/pass-prepare.ts` 302,
against the limit of 300;
the report names no alternative to these two.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world" and "Tests on the real clock".

### B399: the contest ledger and the calibration grace read and wrote the process's environment

Red in `1e8ad4c070a15a130344f7bed7d668db6b59c6a9`,
fixed in `477bbd6601509ac08d867e858af680a59c4f91eb`.

Found by the work B398 records.
`recordContest` (`candidate-ledger.ts`) read `TRANSLATION_REPAIR_RUNS_DIR` under every `selectBestCandidate`,
whose callers are `editor-ensemble.ts`,
`refine-stage.ts`,
`translate-judge.ts` and `judge-fidelity.ts`,
so contests landed wherever the process's variable pointed,
and a case chose where by writing it.
`adoptCalibrationGrace` (`grace-override.ts`) wrote `TRANSLATION_REPAIR_STRAGGLER_GRACE_MS` back into the process
when the launch had left it unset,
so that every round would read the calibration's window there,
and the variable stood at `300000` after a call.
By the red commit's message,
the contest ledger's cases fail at the base,
the ledger writing where the process's variable points and not where the ledger handed in says,
and the calibration grace's cases fail on the environment it ignores and the variable it writes.

The fix:
`ContestLedger` is `{ kind: 'unkept' }` or `{ kind: 'kept', runsDir }`,
read by `readContestLedger({ env })`,
where unset and empty both keep nothing,
as before;
`recordContest` writes where the ledger it is handed says,
and `selectBestCandidate` hands it the one `StageSettings` carries.
`adoptCalibrationGrace({ env })` returns the grace and writes nothing;
the calibration lane's rounds get `readWriterGrace` with `CALIBRATION_STRAGGLER_GRACE_MS` as the round fallback.
`editor-calibrate.ts` reads the overlap,
the calibration grace and both windows in functions of its own that the run calls where it used them before,
and reads the ledger in `main`.
No production code writes `process.env`:
a search over `src` outside tests and fixtures for an assignment to it
finds none at `477bbd6601509ac08d867e858af680a59c4f91eb`,
and the same search finds the write in `grace-override.ts` at `791196bdc8458c54962cd834b0ac1a58851fdf78`.
The key of `blank-text-tests.unit.test.ts` is renamed to `candidate-ledger.ts#readContestLedger`.

Open to the owner's veto:
the ledger is read from the raw variable,
not from the pass's resolved `runsDir`;
the alternative would start recording contests in a launch that named no runs directory,
which changes what the setting means.
`editor-calibrate` reads its settings where the run used them,
so the tested output and the order of refusals are unchanged;
the alternative reads them all at the start of `main`,
which puts a window or overlap refusal before the refusal of a bad slice count.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B400: the slice overlap was read for each entry, after the lock

Red in `1e8ad4c070a15a130344f7bed7d668db6b59c6a9`,
fixed in `477bbd6601509ac08d867e858af680a59c4f91eb`.

Found by the work B398 records.
`settleEntry` (`corpus-run/pass-entry.ts`) read `TRANSLATION_REPAIR_SLICE_OVERLAP` through `readPassOverlap`,
for each entry,
so an unreadable value refused the pass at its first entry,
after the runs lock was taken and the layout made,
and after `runPassQueue`,
which has no catch,
had counted and written that entry's first attempt;
and a case chose an entry's overlap by writing the process's environment.
By the agent's run against the base build,
a `settleEntry` handed overlaps 1 and 2 with the process's variable at `several` refused;
and eight `readOverlap` cases fail,
since it ignored the `env` it is handed.

The fix:
`readPassOverlap({ env })` (`corpus-run/pass-overlap.ts`) returns the `OverlapSetting`,
read once in `corpus-pass.ts` after both windows and before the corpus pin,
the runs directory and the lock;
`settleEntry` takes the setting
and logs the unchanged `OVERLAP <id> value=... source=...` line through `entryOverlap`;
`readOverlapSetting` and `readOverlap` (`corpus-run/slice-overlap.ts`) take `env`.
So the refusal now comes at launch,
before the lock,
and no attempt is recorded.
B394's fix had read the pin right after the windows;
this round put the overlap between them.
The allowlist line of `own-unit-tests.unit.test.ts` for `corpus-run/pass-overlap.ts` is gone,
since the module has a test of its own;
`window-dial-unreadable.test-fixture.ts` is new,
and `slice-overlap-dial.test-fixture.ts` gains `PASS_FALLBACK_OVERLAP`.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal" and "Tests touching the real world".
