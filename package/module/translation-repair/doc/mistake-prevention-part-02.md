# Preventing this package's mistakes, part 02

Part 02 of [Preventing this package's mistakes](mistake-prevention.md),
whose index lists every part in order.

## References in code and docs

What happened:
588 task-list numbers stood in the package's source,
tests,
docs and task descriptions as if they were references,
seven of them in lines the commands print (D22).
One number named different tasks in different sessions,
and on GitHub each named an unrelated issue,
so no reader could recover any of them.
Several sat beside claims the work they named had since overtaken.
The repository-level docs carried 1,206 more (D26),
and the current handover's open-work list was task numbers
naming two pieces of work recorded nowhere else.
Two cache-account paragraphs written for B24 said "same cache check as the paragraph before",
which names nothing once a paragraph is added between them (M60),
and a census found hundreds more references by position in the package and the living docs (D33),
five of them pointing the wrong way after the text around them moved.
A read-only agent's comments named a guard as "the check just made" (T8,
twenty-fourth batch),
and a search for that shape found five more code pointers by sequence in the tests
("the next check",
"the NEXT check down",
"the next line can show",
"the previous case",
"reaching the next line"),
which D33's scan does not read.
A trial fix's comment named its check as "the check below",
and the position scan turned the suite red before the change landed (M111).
Six case names and a comment cited "the fidelity cluster",
"the group cluster" and the like,
names a writer gave its own work that no ledger entry holds (ledger B333).

The rule:
a reference names something a later reader can open:
a ledger entry,
a doc heading or path,
a file or symbol,
a commit,
a date,
or the finding itself in words,
and never a position
("above",
"the paragraph before",
"the case before this",
"the next check",
"the check just made"),
which a later insertion silently repoints.
A group of work is cited by the name the ledger gives it
(an entry,
or a numbered batch of a section),
never by a name a writer made for it.
Open work goes in the ledger,
not only on a task list.
A GitHub issue is cited only after `gh issue view` shows it is the one meant,
and is added to the guard's list in the same commit.
Before a citation is rewritten,
the claim beside it is checked against the code,
since the work it named may have changed that claim,
and the number is read in the task record of the session that wrote it,
since the same number names different work in another.
An owner's words keep their number verbatim,
checked against the transcript or the file the owner wrote in,
and are listed in the guard.

What enforces it:
`src/task-list-numbers.unit.test.ts`,
which fails on a sign followed by one to four digits
anywhere in the package's source,
tests,
docs,
README or `mise.toml`,
and in the living repository-level docs `src/living-docs.test-fixture.ts` locates,
unless it is a listed issue or sits inside a listed owner quotation,
and on a listed issue or quotation that no longer occurs;
it fails too on a number written after the word "task" (D31)
outside the listed takeover-era stretches,
which keep that tracker's numbers under their notes.
`src/position-references.unit.test.ts` (D33) reads the same texts
and fails on "above" or "below" after any word that marks no comparison,
bound or placement,
unless what follows compares or names,
on a reference verb or a parenthesis around one,
on a sequence noun before "before this" or "after it",
on "earlier in this file" and its kin,
and on "the former" and "the latter",
outside its listed exemptions,
and on an exemption that no longer names a reference.
Its first version read positions only after a listed noun
and passed a couple of hundred after nouns the list lacked;
a guard built on a word list is measured against a broader scan before it closes an entry.
Nothing enforces the sequence form:
of the 33 lines in `src` matching "just" before a verb of reading or making,
or "the previous",
"preceding",
"next" or "following" before a line,
check,
statement,
block,
call,
case or loop,
the five fixed ones pointed at code;
the other 28 name a document's lines or blocks,
a parser's input
or a run's order,
which a word list cannot tell apart from a pointer.
A reviewer reads new comments and case names for them.

## Dates and clock times

What happened:
owner answers given between 00:00 and 04:00 UTC were dated by the local day before,
the voting rulings in 40 places (D12);
clock times were copied as `git log` and `find` print them,
in local EDT with no zone,
157 of them in 17 files,
and the scan that found them skipped 14 more written with seconds (D25).

The rule:
a date or time is read from its source's own timestamp and written in UTC with its zone.
Transcripts and run logs print UTC;
`git log`,
`find` and `stat` print local time,
so they run under `TZ=UTC` with a local-format date.
An owner answer is dated by the UTC day of its transcript entry.
A range states its zone once,
after its second end;
a time whose zone cannot be recovered says so in words.

What enforces it:
`src/clock-time-zones.unit.test.ts` for clock times,
over the package's comments,
docs and README,
the decision records and the current handover;
dates by habit,
with the D12 census as the way to check them.

## Cached decisions

What happened:
floors,
sheets and quorums changed what a cached stage asks or accepts,
and no cache version moved (M25);
the correction then checked three of six versions (M28);
a key gained a field from a flag's name,
not from what the field changes (M37).
The tense-candidate change (ledger B419) moved no version,
since every affected stage's run shape names the recorded death and the subject names,
so its key moves for exactly the entries whose question changed;
the three pinned-key witnesses were read first,
and kept their pinned strings for an entry that records no death.

The rule:
a commit changing a floor,
a sheet,
a threshold or a settlement rule in a cached stage
names in its message the version it moves,
or why none moves.
A field enters a key only when a run that goes ahead reads it into a question or a weighting.
Keys hash one JSON value of fixed shape with the version in it (X15),
never joined strings.

What enforces it:
the key-shape tests (`block-pairing-question-key.unit.test.ts`,
`pass-page-titles.unit.test.ts`)
fail when a key drops its version;
the checklist's cache step covers the rest,
through the `cache-account-audit` task,
which reads the constants out of the source rather than from a remembered list,
and whose readers are pinned by `cache-account-read.unit.test.ts` and `cache-account-commits.unit.test.ts`.

## Tests touching the real world

What happened:
a unit test prepared an original naming a title,
and the preparation bought a live web search with the key the suite inherits from `mise`
and wrote the answer into the real lookup cache (M43,
X19).
The fix made the seam required of the preparation,
but the entry driver above it went on handing down the run's readers itself,
so the entry tests still prepared through the key,
the real caches and the corpus clone (M68).
The run client and the provider gate read the provider keys,
the Bedrock ledger's place and the transport from the process by default,
and their tests set some keys and built on the rest the suite inherits (X23).
43 test helpers made a temporary directory and could leave it behind,
and the system's temporary directory had gathered thousands under their prefixes (ledger B108).

The T8 trial added an OCR reader parameter that defaulted to the real program and five cases that ran
`magick`,
`dwebp` and `tesseract`;
the reader now requires its program runner,
and its cases run scripted programs (ledger M113).
A program on the machine is an outside read like the corpus,
and its runner is a required parameter.

The picture sources still defaulted to the corpus and the real programs
in the functions that hand them to that reader,
and one case read the pinned checkout for an invented entry (ledger B185).
A default is looked for at every function that hands a seam on,
not only where the seam is first read.

Each test that started a child process built the child's environment itself,
or passed none,
so the children of 27 test files and fixtures could inherit the provider keys the suite holds under `mise`,
and one fixture,
merged unread,
started a node child on the built package with the parent's environment whole (ledger B291,
M121).
None called a provider.
`nano-spawn` merges the environment it is given into the parent's,
so a variable left out of that object is still there:
an environment for a merging spawner states each name it removes,
with the value `undefined`.
An agent then ran a built command from its own shell,
behind a strip of its own making that removed nothing,
and bought six provider calls (ledger M120).
A test starts a child only through `src/child-environment.test-fixture.ts`
(`spawnKeyless`,
`runKeyless`,
`runBuiltCommand`),
which removes every variable whose name ends in `_API_KEY` and every `TRANSLATION_REPAIR_` setting,
and only then sets what the case names.
A built command is started the same way by an agent as by a test,
and an environment is never stripped,
filtered or rebuilt by hand.
Three as-built suites still started their command through `runKeyless` with a path each built itself,
without the start marker `runBuiltCommand` adds (ledger B386);
a test starts a built command through `runBuiltCommand` alone.
A shared brief called the logger's sink verification lines noise,
not a failure,
and the first run of the whole-suite census at `116bf6f4b` then failed nine as-built cases on such a line,
since each pins the stderr of the child it starts whole (ledger M145,
T9).
A brief names a known defect of another package as a defect,
with the cases it is known to fail,
and tells the agent to report such a case and run it again,
never to ignore it.

Production code then started its own children with the run's whole environment:
git children,
the picture program and the coverage census's suite child (ledger B314);
and the corpus listing's git child kept the repository variables its guard meant to drop,
since the spawner merged the names left out back in from the parent (ledger B315).
Every production start passes the environment `childEnvironment` builds.
A built command then gained a guard of its own:
in a process that holds a key,
it runs only when `TRANSLATION_REPAIR_STARTED_BY` names it,
which its task sets,
and the test fixture,
or an operator by hand where a pass forbids a rebuild (ledger B319).

A review of the trial's cases found the real corpus pin written as fixture data in nine test files,
where no code the cases reach checks it against the pin (ledger B332),
and a case that made a file unreadable with mode `000`,
which the superuser reads anyway,
so the case failed whenever the suite ran as root (ledger B334).
Eight log lines that print a provider's failure had no case reaching them
through the real client over the real transport (ledger B330).
The corpus git children kept the caller's locale variables,
and git translates the refusals the corpus reader tells apart by their English words:
under a German `LANGUAGE`,
`LANG` or `LC_MESSAGES` a path absent at a held commit printed its refusal in German (ledger B347).

The process's own state was also read and written inside library code,
not at the entries.
The ledger and meter reports wrote `process.exitCode` inside their procedures,
so a caller importing either had its process status changed (ledger B379).
The artifact pool read its commit policy from the environment inside `resolvePool`,
so a case chose its pool by writing the process's variables (ledger B380);
and three readers of the runs directory read the environment themselves,
so the relabel and verify procedures read whatever the variable named,
not the directory they were handed (ledger B381).
A procedure returns its exit code,
and the entry sets it on the process.
Library code takes a setting as a value from the entry,
and the entry reads the environment;
a read left inside library code is recorded with why it stays (ledger B381).
The same held deeper in the pipeline.
The corpus pin was resolved while `run-config.ts` loaded,
and seven library modules read it as a module constant,
so the draw's entry loader,
the window trial's digest,
an entry's artifact and its decline record used that constant whatever pin they were handed (ledger B394 to B397).
The straggler and writer windows were read at every round and inside the writer stages,
the contest records' directory under every selection,
and the editor calibration wrote its window back into the process for its rounds to find (ledger B398,
B399);
the slice overlap was read for each entry (ledger B400).
Each is now read by the entry file and handed down as a value,
and no production code writes `process.env`.
The cap,
the spend ceiling and the drift opt-in were still read in library code,
in the defaults of `resolveHardCapMinutes` (`corpus-run/cap-override.ts`)
and of `resolveSpendCeilingUsd` (`corpus-run/spend-ceiling.ts`),
and in the body of `readDriftOptIn` (`corpus-run/pass-generation-guard.ts`);
`corpus-pass.ts`,
each one's only production caller,
now reads all three over `process.env` and hands them in (ledger B401).
One read stays in library code:
`resolveRunsDir()` (`corpus-run/run-config.ts`) reads `process.env` itself,
and every production call of it is in an entry file,
or in a procedure an entry hands it to as a function (ledger B401).
The width probe built its run client before its draw,
so a process holding no key refused before every refusal that needs no provider,
and its as-built cases never reached the draw (ledger B391).

The artifact pool's case for a required commit named by a revision read this checkout's `HEAD` and `HEAD~1`,
since `resolveCommit` and `tipContains` (`corpus-run/artifact-generation.ts`)
took a repository that defaulted to the package's own directory,
and `resolvePool` handed them none,
so the case failed on a checkout of one commit (ledger T8,
the runner and git cluster of the final census).
The repository is now a required value from the five pooling entries down to `resolveCommit` and `tipContains`,
and the case builds a throwaway repository of two commits (ledger B393).
One suite still reads this checkout's own git:
four cases of `corpus-run/artifact-eligible.unit.test.ts` read its root commit and `HEAD` read-only,
through `gitBounds`,
and hand the checkout in as `THIS_CHECKOUT`.
It stands against the rule that an outside read is a required seam,
awaiting the owner's word,
where a throwaway repository is the alternative (ledger B393).

The rule:
before a test drives a production entry point,
list what that entry point reads outside the process
(`process.env`,
`fetch`,
`homedir()`,
the pinned corpus) and hand each a fixture.
A seam that reaches the network,
a real cache or the corpus is a required parameter,
never an optional one.
When a seam becomes required,
every reference to the production value is listed (`rg 'outsideReadsFrom\(' src`),
and each one in a function the entry calls moves to a parameter:
the process's own values are named in the entry file,
inside its refusal boundary
(`createRunClient`,
the `outsideReadsFrom` calls of `corpus-pass.ts` and `rendering-audit-settled.ts`,
`readStageSettings`,
`readRunCorpusPinSetting`,
`readPassOverlap` and `readDriftOptIn` over `process.env`,
and the cap and ceiling texts `corpus-pass.ts` hands to `resolveHardCapMinutes` and `resolveSpendCeilingUsd`),
and in TSDoc examples;
no module builds one while it loads (ledger B394).
A client a run builds is handed in as a factory
and built where the run first needs it,
after every refusal that needs no provider (ledger B391).
A test makes a temporary directory only through `scratchDir`,
bound with `await using` where it is made or by every caller of a helper returning it,
so the directory goes when the case ends,
however the case ends.
A helper that fills the directory before returning it makes it through `scratchDirWith`
(a setup with fields to hand back)
or `scratchDirPrepared`
(a setup handing back nothing),
which remove the directory if the setup throws;
a helper that only makes it is no helper,
and its callers bind `scratchDir` themselves (ledger B117).
An environment variable a case points at its directory is written by a function the case calls by name,
after the directory stands,
and its disposer is bound after the directory's,
so the variable is restored first.
A fixture writes invented data where any value would do:
a commit id no code checks against the corpus pin is an invented one (`feedface` repeated),
and the real pin stands only where a comment records where something was measured
or a production example shows the package's own pin.
A fault a case makes holds whoever runs the suite:
a file a case must fail to read is one Node refuses by its size
(a sparse file of 2 GiB),
never one a mode forbids.
A line that prints a provider's failure is reached by a case
through the real client over the real transport with a stubbed `fetch`
(`provider-status-failure.test-fixture.ts`).
A reader of another program's words fixes the language that program speaks
where the environment for its child is built
(`LC_ALL=C` for the corpus git children),
and a case runs the real program under another locale
beside a control showing that the program translates there.
The corpus reader's search ceiling held the parent of the clone directory as named,
while git compares the list with its real working directory,
so a clone directory that is a link read the repository it points into (ledger B369);
and git splits that list at colons,
so a parent path holding one voided the ceiling (ledger B370).
A path handed to another program is resolved as that program resolves it,
and a value written into a list the program splits at a delimiter is refused,
before the program runs,
when it holds the delimiter.

What enforces it:
the type checker:
`preparePassEntry`,
`runPassPreparation`,
`runEntryPipeline` and `settleEntry` require `outsideReads`,
and tests pass `NO_OUTSIDE_READS` (`corpus-run/pass-outside-reads.test-fixture.ts`);
`readPassVisualEvidence`,
`readSeatedPictures`,
`runEntryPipeline` and `settleEntry` require `pictureSources`,
and tests pass `NO_PICTURE_SOURCES` (`corpus-run/pass-picture-sources.test-fixture.ts`);
`configureProviders`,
`runClientFrom` and `assertRequiredProvidersReady` require `env` and `transport`;
`outsideReadsFrom` requires the environment,
the transport and the corpus readers;
the five provider clients require their transport,
and every corpus reader its pin or reader (X24);
`runGatherRound`,
`gatherStageVoices` and `runWindowedRounds` require `graceMs`,
every stage on the way to them takes `stageSettings`,
and tests pass `SCRIPTED_STAGE_SETTINGS` (`stage-settings.test-fixture.ts`,
ledger B398,
B399);
`settleEntry` requires the pin and the overlap setting (ledger B394,
B400);
`resolveHardCapMinutes` and `resolveSpendCeilingUsd` require `raw`,
and `readDriftOptIn` requires `env` (ledger B401);
and the pool and its readers require `repository`,
which tests that require no commit pass as `UNASKED_REPOSITORY` (`corpus-run/pool-policy.test-fixture.ts`,
ledger B393).
A seam added to make a function testable never takes the production value as its default (M70).
`src/temp-dirs-scratch.unit.test.ts` (ledger B117),
among the source scans,
fails on a direct `mkdtemp` or `tmpdir` call in a test or fixture outside the kept sites it names with why,
and on a `scratchDir` call that is not the initializer of an `await using` declaration.
`src/test-children-keyless.unit.test.ts` (ledger B291),
among the source scans,
fails on a test file or fixture,
other than the shared one,
that imports a spawning module or calls a spawning function;
the shared fixture's own test starts real children that print the names they see.
`src/production-children-keyless.unit.test.ts`,
among the source scans,
fails on a production start of a child that does not pass the environment `childEnvironment` builds
(`child-process-environment.ts`,
commit `4049d9eb2`,
ledger B314 and B315,
which close the item ledger B291 left open);
`src/production-children-environment.unit.test.ts` starts each site's real child
and reads from the child's own side that no key or setting arrived.
`src/corpus-git-context.unit.test.ts` asserts the corpus environment whole
and reads real git's refusal in English under a German locale,
beside a control that fails on a host whose git does not translate (ledger B347);
`src/corpus-source.unit.test.ts` refuses a clone directory that links to a plain directory inside a repository,
still reads through a link to a real clone,
and refuses a clone whose parent's real path holds a colon (ledger B369,
B370).
`task-runner-guard.ts` refuses a built command started in a process that holds a key
unless that process names the command (ledger B319),
and `src/task-runner-guard-reach.unit.test.ts`,
among the source scans,
fails a task that starts a built command without the marker,
a built command no task starts,
and an entry file that hands the guard no environment.
A process that imports the built library directly is outside the guard,
and a shell in a worktree still holds the keys.
`corpus-run/ledger-report-run.unit.test.ts` and `corpus-run/meter-report-run.unit.test.ts`
assert the code each report returns and that it leaves the process's code unset (ledger B379);
the cases of the relabel artifact reader,
the width report and the bench report point the variable elsewhere and hand a directory in (ledger B381);
and the as-built conflict cases of the five pooling commands hold the pool's refusal at exit 6 (ledger B380).
The cases of the window readers,
the contest ledger and the overlap readers hand each its own environment
beside a process that holds another value (ledger B398 to B400),
as do the cases of the cap,
the ceiling and the drift opt-in (ledger B401),
and `corpus-run/corpus-pin-override.unit.test.ts` writes no `process.env` (ledger B394).
`corpus-run/editor-width-probe-run.unit.test.ts` holds the order of the draw,
the client and the control,
and its as-built suite runs over a throwaway runs directory,
lookup cache and corpus clone (`benchWorld`,
ledger B391).
No source scan finds an environment read,
an exit-code write or a hand-built path to a built command outside where these rules put it,
by the names of the scans the `source-scans` task runs;
the censuses that found them were scratch scripts,
so the rest is habit.

## Tests on the real clock

What happened:
a case filled a 20 ms window on the real clock and expected a take started after it to still be asleep;
under the whole suite's load the window emptied first,
and the case failed only there (M69,
T5).

Two stage cases expected a voice delayed 30 ms to land inside a 100 ms grace window,
which a loaded machine could outrun (ledger B318).
Their windows are 60,000 ms,
which the round never waits for since it ends at the last answer,
and each case fails at a window of 0,
which shows the window is what keeps the late voice.

The consolidation driver test bounded each call and each drive at 5,000 ms over milliseconds of scripted work,
and its TSDoc said nothing bought a call where a case bought calls;
on a loaded machine the case driving two slices serially and then two at once
failed with a `TimeoutError` its name never states,
twice,
and passed in every other run of the whole suite (ledger B340).
Its bound is 60,000 ms,
documented as a stop for a hang that no case waits for.

The census that followed,
on 2026-10-06 (UTC),
read every bound the tests and fixtures set on the real clock,
948 of them outside seven files deferred to the changes in flight on them
(ledger B358).
The bounds that only stopped a hang now share one constant;
the bounds a case reaches bound work that cannot end before them;
a seat that slept past a window,
a head start that ordered two slices,
and a ceiling on elapsed time gave way to gates and to what the case can read off the abort (ledger B359,
B360);
an attempt that slept 200 ms under its own bound of 300 ms gave way to one that answers at once,
the time passing in a backoff longer than the bound (ledger B361);
a parse's time limit moved to the process's CPU clock (ledger B363).
A case on where a deadline is armed could not fail,
since its transport ignored the signal;
it now holds the slot past the deadline and refuses an aborted exchange (ledger B362).
The census also found that a per-call deadline handed to a stage over a hand-scripted client is never armed,
since the provider clients arm it (ledger B364):
what fires in a test is a signal,
a cap,
a window
or a stream bound
that the test arms itself or hands to production code that arms it.

The seven deferred files were read on 2026-10-10 (UTC),
34 findings in 15 keys,
six more than the census counted from cases added since its base (ledger B378).
Six grace windows in the round test bounded rounds that end before them,
since every case there passes at a window of 0,
and went to the hang stop.
The round test held its quorum mark under 125 ms past the first answer,
which failed in 2 of 4 runs beside other new cases (ledger B365),
and a whole-roster round's grace under its window;
a stall of 300 ms broke each.
The quorum mark is now held to the span from the round's start to the next turn of the event loop,
which the microtasks before the mark cannot outlast,
and the grace to the span from the last answer to a timer armed after that voice's own and as long;
each new shape passes under the stall,
and fails when quorum waits for the slow voice,
or when the round waits out a window.

The rule:
a real-clock case asserts only bounds that load can widen and not break;
a case that needs a caller asleep uses a window no stall outlasts;
a grace window a case relies on is one the round never reaches,
and the case is shown failing at a window of 0;
a window a round ends before is the hang stop,
and the case is shown passing at a window of 0;
a bound that only stops a hang is `HANG_STOP_MS` of `hang-stop.test-fixture.ts`,
60,000 ms,
never a number of its own;
a bound a case means to reach bounds work that cannot end before it on any machine,
work that ends only on its own abort or a sleep armed after the bound and longer than it;
a meter or a sleep that must overlap or order other work is shown in place within one turn of the event loop,
or gives way to a gate the case opens;
elapsed time is asserted only as a lower bound,
or as no more than a span the case reads itself over the same work,
up to a turn of the event loop or a timer armed after the work's own and as long,
which no stall can make shorter than what it bounds;
synchronous work is timed on the process's CPU clock;
a new timing case counts as passing only once the whole suite has run it.
A bound on scripted work is a stop for a hang,
which no case waits for,
documented as such where it is declared;
never a few seconds over milliseconds of work,
which a loaded machine outruns.
A case that needs a run stopped brings its own controller,
so the stop for a hang never doubles as the stop a case asserts.

What enforces it:
`real-clock-bounds.unit.test.ts`,
among the source scans,
fails a bound a test or fixture sets on the real clock other than the shared hang stop
unless it is listed with its class and reason,
and fails a listed bound or a deferred file the source no longer holds,
with no file deferred since ledger B378;
the whole unit suite run before a batch's work is called done.
No scan reads an upper bound on elapsed time;
review holds each to a span the case reads itself.
Since the stage windows became a `StageSettings` value (ledger B398),
tests hand them through `SCRIPTED_STAGE_SETTINGS` or `scriptedStageSettingsWaiting({ graceMs })`
(`stage-settings.test-fixture.ts`),
whose `graceMs:` key the scan reads.
The scan also keys `roundMs` and `writerMs`,
the two windows a `WriterGrace` carries inside a `StageSettings`,
from which every stage hands one to its round as `graceMs` (ledger B402);
the values it finds under them that keep their own,
a window handed on from its caller,
a reader's output asserted whole,
or a grace read back in its launch note,
are listed with their reasons.
A calibration grace's `effectiveMs` and a note's `builtInMs` are not keys,
since production only prints them.
The scan keys a model card's `streamBoundMs` too,
and reads a `createBedrockClient` imported from the built package under any local name
whose options name no `streamBoundMsOverride`,
since the client arms each card's own bound on the real clock around every attempt unless handed one;
a stream bound of `'unbounded'` is left,
as the override tests hand it (ledger B416).
A test builds a Bedrock client with the override,
`'unbounded'` unless the case reaches the bound.
Open,
as the follow-up merged on 2026-10-10 (UTC) left it (ledger B358,
B378):
the logger package's own sink verification is bounded at 5,000 ms,
which timed out 15 to 34 times per whole-suite run in the agents' runs that counted it,
and 12 times in one run of the source scans,
without failing a case.
A timeout can fail a case all the same:
the logger then writes `logger internal error: sink verification failed ...` into the process's stderr,
and in the first run of the whole-suite census at `116bf6f4b` that line failed nine as-built cases,
which pin their child's stderr whole (ledger T9,
M145).
It is the logger's defect,
open as GitHub issue 573;
a case it fails is reported and run again,
never ignored (the rule in "Tests touching the real world").
