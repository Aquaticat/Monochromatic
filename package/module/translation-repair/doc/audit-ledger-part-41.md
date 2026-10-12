# Audit ledger, part 41

Part 41 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B302: `corpus-pass` resolved its cap and its spend ceiling before its refusal boundary

Red in `ea16d3b51`,
fixed in `9a68e3c78`.

Found on 2026-10-06 (UTC) while moving `corpus-pass` into modules a test can load (T8).
The cap for one entry and the spend ceiling were resolved in module constants,
before the refusal boundary ran.
An unreadable `TRANSLATION_REPAIR_HARD_CAP_MINUTES`,
or an unreadable spend ceiling,
exited 1 under a dump of bundled source,
although both refusals are stated ones.

The fix:
the entry reads the cap,
the ceiling and both windows inside its run callback,
in that order,
before the lock is taken.
The procedure is `corpus-pass-run.ts`,
which takes the environment,
the clock,
the tip,
the client factory,
the settlement and the corpus pin as required parameters and reads none of them itself.
The lead read the moved procedure against the one it replaces:
the steps run in the order they ran.

Measured by the lead on the red tree for B302 and B303:
`corpus-pass.unit.test.ts`,
eight cases that hold against the command as it stood,
prints one pass line and no fail line;
`corpus-pass-refusals.unit.test.ts` fails in its four cases and passes in none.
The agent's measurements,
not rerun by the lead:
a census over its eleven test files shows no cold stretch in the entry file,
in the sources it loads or in any new module,
and one invariant throw (`corpus-pass-order.ts`).
Not reachable without a key,
by the same agent:
a run to its end as built,
since the run client is built before the `--plan` return and before the queue;
wet meters over the real transport;
a real settlement of an entry.
The whole suite ran on `9a68e3c78` in a side checkout,
which holds the fixes of B302 to B304:
1,924 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 41 source scans passing.

Open,
seen by the agent and left:
`run-config.ts` resolves the corpus pin at load,
so an unreadable `TRANSLATION_REPAIR_CORPUS_COMMIT` exits 1 with a stack,
the same shape as the cap;
the `ONLY` line says the ordering is bypassed although the entries asked for are still ordered;
the detail of an `INCOMPLETE` line says to check that the clone exists for a page that is simply absent;
and the pair target on the `DONE` line is a literal 92.

Closed on 2026-10-10 (UTC) for the corpus pin by B394 (`d415f1ddac6b11f68193865985a69842ff9387d2`):
each entry reads the pin inside its refusal boundary,
and an unreadable value is a stated refusal at exit 6.
The other three were not reproduced at that round's base,
`791196bdc8458c54962cd834b0ac1a58851fdf78`,
since `cfac5b981` had already met them.
The `ONLY` line says the entries named are run in the pass's own order,
which the case
"RUNS THE ENTRIES --only NAMES IN THE PASS'S OWN ORDER,
resuming one holding cached slices ahead of one the command line and the corpus both name first"
(`corpus-run/corpus-pass-select.unit.test.ts`),
added by that round and passing at its base,
now pins.
The detail for an absent page says "check the path,
or pin a commit that has it",
and an unreadable clone prints no `INCOMPLETE` line,
since it is a stated refusal.
The `DONE` line counts `artifacts=N/M` over the complete pairs the walk found,
and no literal 92 is left in production code.
What those changes left open is under B394.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal":
a setting that can refuse is read inside the boundary that prints refusals,
never in a module constant.

### B303: the artifact guards' five refusals printed as faults of `corpus-pass`

Red in `ea16d3b51`,
fixed in `9a68e3c78`.

Found by the move B302 records.
An artifact nothing can place,
and four more refusals of the artifact guards,
each printed as a fault in the command,
at exit 5 under frames,
for a message that tells an operator what to do next.

The fix,
the lead's on the agent's work:
the five guard classes
(`UnplaceableArtifactError`,
`LegacyPipelineError`,
`GenerationDriftError`,
`SchemaGenerationError`,
`MislabelledArtifactError`)
extend `StatedRefusalError`.
The agent had caught the five in the pass and rethrown each inside a `StatedRefusalError`.
A refusal that is always an operator's is one by class,
as the samplers' is (B296),
and the catch,
its cause chain and two inventory entries it wanted are not in the commit.
`corpus-pass-guards.unit.test.ts` holds each refusal as its own class,
a stated refusal,
with its whole message.
The whole suite's run on `9a68e3c78` is recorded in B302.

Open to the owner's veto:
the guard classes as stated refusals.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal":
a refusal that is always the operator's is a stated refusal by class.

### B304: the pass order left medium and large bands tied, and retried a failing entry first on every run

Fixed in `9a68e3c78`,
with its cases,
which the agent ran red in its worktree.

Found by the move B302 records,
reading the comparator against its own comment.
The comparator's comment and the bands' own doc say the larger band leads within one rank,
and that the fewest attempts go first so a flaky entry is deprioritized.
The code let only the small band trail,
so medium and large tied.
Ranks are unique within a band,
so the attempts tier could only ever break that one tie:
an entry that kept failing kept its place in the walk and was retried first on every run.

The fix:
large leads medium leads small within a rank,
and a band's ranks follow fewest attempts first,
so a tried entry waits behind the untried ones of its band.
Which entry a pass starts first can differ from before.
`smallBandIds` (`band-order.ts`),
which the new order leaves with no caller,
is removed with its cases and its barrel line;
and `selectPendingEntries` computed the order twice and dropped the first result,
and computes it once.
The whole suite's run on `9a68e3c78` is recorded in B302.

Not measured:
no pass ran under the new order,
and no count was taken of how often a tried entry led a past run.

Open to the owner's veto:
the order as described,
and reverting to the comparator as it was.

Recurrence:
`mistake-prevention.md`,
"Claims without their evidence":
a comment that states an order is a claim,
and a case holds each tier it names.

### B305: `producer-calibrate` printed a standing over rounds that never ran

Red in `cd78288d7`,
fixed in `f8e99b84d`.

Found on 2026-10-06 (UTC) while moving `producer-calibrate`,
`recall-benchmark` and `roster-bench` into modules (T8).

- The run client was built inside the catch that counts a slice as lost.
  A launch with no provider key printed `LOST (RunConfigError)` for every slice,
  then a standing over no round,
  and exited 0.
  The loop rethrows a stated refusal.
- `producer-calibrate --candidates <one id> --candidates-alone` drew the corpus
  and asked the translate stage for every slice,
  which refused the same roster of one seat each time;
  each refusal was read as a lost slice.
  The roster is checked before the draw,
  and the stage's own refusal is stated.
- A calibration in which no round finished printed `STANDING over 0 rounds` and exited 0.
  It refuses,
  after the lost lines,
  naming how many slices were drawn.

The first is cased in `cd78288d7`;
the other two were cased red first by the agent in its worktree.

Measured by the lead on the red tree for B305 to B307:
six cases fail,
each on the assertion its commit message names,
and no other case of the four files fails.
Measured by the lead on the fix tree:
the cluster's thirteen test files,
the three as-built suites among them,
print no fail line against a fresh build;
the source scans print 41 pass lines and no fail line;
and lint reports no warning and no error.
The agent's measurements,
not rerun by the lead:
a census over its eleven test files shows every one of the eleven sources loaded and no cold stretch,
with two invariant throws (`producer-calibrate-run.ts`,
`roster-bench-run.ts`).
Not reachable without a key,
by the same agent:
a round that reaches a provider,
a recall run with real quorums,
a report written from a live row.

The whole suite ran on `f8e99b84d` in a side checkout and is not green:
1,938 `[PASS]` lines and 2 `[FAIL]` lines,
the lint finding nothing,
and the 41 source scans passing.
Both fail lines are for one case this change does not touch,
the case and its suite:
`displacement-probe as built`,
"REFUSES as stated and exits 6 when an artifact names a commit the clone lacks".
B300 records that case,
the lead's reading of why it fails under load,
and that its fix is in no commit through `f8e99b84d`.

Open,
seen by the agent and left:
`BenchReportError` is not a stated class,
so any other caller of `benchWidths` prints its refusal as a fault;
and `drawPinned` is written twice,
once in each of two entry files.

Open to the owner's veto:
the missing-key refusal comes at the first slice,
after the draw and the opening line,
since each slice builds a fresh client;
the wording of each new refusal.

Recurrence:
`mistake-prevention.md`,
"What a catch charges":
a catch that counts one unit as lost rethrows a refusal that would be every unit's.

### B306: `recall-benchmark --plan` printed `PLAN ok` over a corpus that yielded no entry

Red in `cd78288d7`,
fixed in `f8e99b84d`.

Found by the move B305 records.
`--plan` is the setup check before a run of hours.
Over a clone that holds no entry the plan passed,
and the key refusal followed.

The fix:
it refuses before a client is built.
The whole suite's run on `f8e99b84d` is recorded in B305.

Open:
`recall-benchmark` without `--plan` over a corpus that yields no entry still builds a client
and keeps an empty scorecard before its own refusal,
where the plan refuses before the client.

Recurrence:
`mistake-prevention.md`,
"Work no floor can check":
a setup check that found nothing to run over does not print that the plan is in order.

### B307: an empty corpus and a roster too narrow to judge printed as faults of the bench commands

Red in `cd78288d7` for the empty corpus,
fixed in `f8e99b84d`,
with the roster's case run red by the agent in its worktree.

Found by the move B305 records,
and for the empty corpus by the cluster of B299,
which saw it in a file it did not own.

- `sampleBenchSlices` (`bench-sample.ts`) threw a plain `Error` for a corpus that yields no slice,
  which `producer-calibrate` and `roster-bench` both printed as a fault at exit 5.
  It raises a `StatedRefusalError` naming how many entries the pin lists.
  The cases and the change are the lead's.
- `roster-bench` printed the refusal of a roster of fewer than two as a fault in the command,
  at exit 5 under frames.
  It states the refusal before the corpus is drawn.

`refuseUnjudgeableRoster` restates a `ProducerRosterError`,
a class that elsewhere is a fault and so is not stated by class.
The whole suite's run on `f8e99b84d` is recorded in B305.

Open to the owner's veto:
the narrow-roster refusal as a stated refusal and not an invariant;
the clock and the report writer as parameters of the roster bench.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal".

### B308: counts in the runners' printed lines stood before a fixed plural, verb or pronoun

Fixed across the runner moves,
each with a case the moving agent ran red in its worktree,
or a red case in the commit named:

- `spend-report`:
  `1 call reported no usage block, so their tokens` (`387af02b7`);
- `score-attribution` and `score-crosscheck`:
  `1 artifact could not be read and are in NEITHER population`
  (red in `a13f71ba8` for the attribution report,
  fixed in `1088e72d9`);
- `cache-account-audit`:
  `1 cache versions`,
  on the terminal and in its progress line (`53e25b458`);
- `coverage-probe`:
  `1 unpaired passages` (`da8a963cc`);
- `corpus-pass`:
  "1 minutes" on the line naming the ceiling a run ran under
  (red in `ea16d3b51`,
  fixed in `9a68e3c78`),
  and "1 more cache records" and "its 1 cache records are" on the `REATTEMPT` and `STALLED` lines (`9a68e3c78`).

Found on 2026-10-06 (UTC) by the agents moving the runners,
whose cases pin whole printed lines.
Until the moves no test ran these commands as built,
by the messages of the commits that added their as-built suites.

The fix:
each noun,
verb and pronoun follows its count through `wordForCount`.
With `passage` a counted noun of the coverage probe,
the `count-nouns` scan named the fixed plural of `sideClause` (`quote-preservation.ts`),
which had an arm for one and a fixed plural for the rest.
The agent proposed an exemption;
the lead had the helper take its noun from `wordForCount`,
which says the same text without one.
One exemption is added to that scan for a line of `corpus-pass` where "records" is a verb.

Not examined:
why the `count-nouns` scan had passed each noun.
By `mistake-prevention.md`,
"Counts in printed text",
it reads a noun the package already counts with `wordForCount`,
and verbs and pronouns are reviewed by hand.

Recurrence:
`mistake-prevention.md`,
"Counts in printed text".

### B309: counts before a fixed plural in four more runners, and a noun chosen by a difference's sign

Red in `a9d447691` for the fidelity probe's preflight line,
fixed in `8206fa5c6`;
the other lines were run red by the agents in their worktrees.

Found on 2026-10-06 (UTC) by the agents moving seven runners into cased modules,
whose cases pin whole printed lines:

- `verify-published`:
  a page one character shorter than its artifact implies printed "-1 characters",
  since the noun followed the signed difference;
- `coverage-census`:
  a suite that printed one failure marker was refused as "1 FAIL markers";
- `judge-fidelity-probe`:
  a request selecting one reference printed "1 reviewed reference specifications selected",
  and the suite's own helper pinned that plural for one;
- `rendering-audit-settled`:
  "BUYING 1 of 1 selectable subjects";
- `rendering-audit-settled-report`:
  "1 subjects".

The fix:
each noun follows its count through `wordForCount`,
and the verifier's noun follows the size of the difference,
not its sign,
while the signed number is still printed so the direction stays visible.
Cases pin each line at one and at many,
the verifier's at minus one and minus seven.

Not examined:
why the `count-nouns` scan passed these;
by the coverage census agent's account,
its noun was a template literal in a file the move changed.

Recurrence:
`mistake-prevention.md`,
"Counts in printed text";
B308 records the same family in six other commands.

### B310: `verify-published` printed its entry lines in the order the disk answered

Red in `a9d447691`,
fixed in `8206fa5c6`.

Found on 2026-10-06 (UTC) by the agent moving the command.
It read its entries together,
and each read printed its lines as it finished,
so a run's entry lines came in the order the reads ended,
not in the order the run lists its entries,
and two runs over one directory could print two orders.
By the agent's measurement,
six of six runs of the unmoved command over sixty settled entries printed them out of order.
The red commit's case over sixty entries expects listing order.

The fix:
`judgePublishedEntry` (`corpus-run/verify-published-entry.ts`) returns its lines,
the reads still run together,
and `verifyPublishedRun` (`corpus-run/verify-published-run.ts`) prints each entry's lines in listing order.

Open to the owner's veto:
the listing order;
the bytes of a report over two or more entries can differ from before in order only.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order",
which named this defect from the lead's notes before its merge.

### B311: `coverage-census` run where no build stands printed a listing error as a fault

Red in `a9d447691`,
fixed in `8206fa5c6`.

Found on 2026-10-06 (UTC) by the agent moving the command.
Run from a directory with no `dist/final/node`
(the wrong working directory,
or no build yet),
the census listed the build directory with a bare read,
whose `ENOENT` went up uncaught,
and the command printed `refused by Error` with stack frames at exit 5,
the exit of a fault in the command.

The fix:
`requireCoverageBuild` (`corpus-run/coverage-census-build.ts`) lists through `namesIn`
and refuses as stated at exit 6,
naming the directory,
the filesystem code (`ENOENT`,
`ENOTDIR`)
and the task that builds with source maps.
The lead made the census's logger a required parameter of its run and of its build check,
owned by the entry file,
where the agent had made it optional with the module's own as the default.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal":
a directory the operator did not make is a stated refusal,
never an uncaught listing error.

### B312: the settled rendering audit named its runs directory only after buying every subject

Fixed in `8206fa5c6`,
with its case run red by the agent in its worktree.

Found on 2026-10-06 (UTC) by the agent moving `rendering-audit-settled`.
The runs directory was resolved when the run was kept,
after the last roster call,
so a directory that could not be named cost the whole roster's calls.

The fix:
`runSettledAudit` (`corpus-run/rendering-audit-settled-drive.ts`) resolves the runs directory
right after the buying line,
before the client is built;
a case with a resolver that refuses asserts that no model,
client or page read happened.

Recurrence:
`mistake-prevention.md`,
"Work no floor can check":
state known at the start is checked before anything is bought.

### B313: a row of a settled run file that was no object was read as a row

Red in `a9d447691`,
fixed in `8206fa5c6`.

Found on 2026-10-06 (UTC) by the agent moving `rendering-audit-settled-report`.
`readRunRows` checked that a run file's `rows` was a list and cast what it held,
so a row such as `7` or `null` passed:
it was keyed as `undefined`,
or ended a later reading in a `TypeError` printed as a fault.

The fix:
the reader refuses a row that is no object as stated,
naming its position and never its content;
the fallback in `sliceIndexOf` (`corpus-run/rendering-audit-settled-repeat.ts`) that answered for such a row,
which the coverage census listed as cold,
is an `unreachable:` throw saying why.

Seen by the agents of B309 to B313 and left,
to rule on or fix after `8206fa5c6`:
the verifier counts a page's length in UTF-16 units and calls them characters;
a request-operation `FidelityReferenceError`
(an unknown entry,
`--context`)
prints as a fault at exit 5;
the unpaired census ranks entries by unpaired source characters alone;
a suite that exits 0 with no pass prints a census of nothing.

Open to the owner's veto,
for the three clusters of `8206fa5c6`:
the fidelity probe reading its build digest and closure when the process starts,
as the settled audit always did,
where it read them after the corpus;
the buyer of one slice passed into the window trial's walk;
the five census steps passed as one object;
each new refusal's wording.
The whole suite on `8206fa5c6`,
run in a side checkout:
1,982 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and 41 source scans passing.

Recurrence:
`mistake-prevention.md`,
"Files a later run reads back":
a file's elements are checked where the file is read.

### B314: every child production code starts was handed the run's provider keys and settings

Red in `93c30e8ea`,
fixed in `4049d9eb2`.

Found on 2026-10-06 (UTC),
the item B291 left open.
The git children of the corpus reads,
of the artifact generation checks,
of the cache account,
of the run configuration and of the coverage census,
the census's suite child,
and the picture program
were started with the run's whole environment,
or with nothing said about it.
A key could leave through a child's own log,
a crash dump,
a tool's debug output,
or a hook or alias that a repository's configuration has a git child run.
Measured by the lead on the red tree:
the new scan reported thirteen starts,
and all ten new cases failed,
nine of them seeing the invented key and setting arrive beside the plain variable.

The fix:
`child-process-environment.ts` builds the environment of every child,
the parent's with every name ending `_API_KEY` and every `TRANSLATION_REPAIR_` setting stated as absent,
and every start of a child in the package's source passes it;
`corpusGitEnvironment` is built on it.
The lead made the four git starts of `corpus-run/coverage-census-commit.ts`
and the suite child of `corpus-run/coverage-census-steps.ts`,
which another agent was moving at the time.
`production-children-keyless.unit.test.ts`,
among the source scans,
fails a production start whose `env` is not built by `childEnvironment`;
`production-children-environment.unit.test.ts` starts each site's real child against an invented key
and reads from the child's own side,
git's trace or a file the program writes,
that only the plain control variable arrives.
The whole suite on `4049d9eb2`,
run in a side checkout:
1,985 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and 42 source scans passing.

Not measured:
a picture program reading a real picture without the removed names,
and the whole suite run as the census's child without any setting of the package;
the next whole-suite census measures the second.
Out of the scan's reach,
by its own header:
a start through an alias (`const run = spawn`),
a computed member,
and starts in other workspace packages.

Open to the owner's veto:
removed names stated as `undefined`;
the settings removed with the keys for every child,
with no switch for a site;
the sites reading the process's environment where they start the child;
the cases writing invented variables to the test process's environment,
one at a time.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B315: the corpus listing's git child kept the repository variables its guard meant to drop

Red in `93c30e8ea`,
fixed in `4049d9eb2`.

Found on 2026-10-06 (UTC) by the agent of B314.
`corpusGitEnvironment` left `GIT_DIR` and its kin out of the object it returned,
which only `execFile` reads as absent;
`nano-spawn` merges the object it is given over the process's environment,
so every name left out came back from the parent.
`listCorpusPeople` starts its git through `nano-spawn`,
so with `GIT_DIR` pointing at another repository it failed its read with `CorpusReadError`,
while `readCorpusBytes`,
which starts its git through `execFile`,
read the right bytes.
The red commit's case sets `GIT_DIR` to another repository and expects the listing of the pinned clone.

The fix:
the environment states each removed name with the value `undefined`,
which both spawn forms read as absent.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world":
an environment for a merging spawner states what it removes,
and the case reads the child's own environment.

### B316: when several concurrent reads failed, the refusal named whichever ended first

Red in `75085f17f`,
fixed in `f3c2bae13`.

Found on 2026-10-06 (UTC),
the case B300 left open:
`displacement-probe as built` failed in whole-suite runs on its expected stderr for a commit the clone lacks,
and passed alone.
`carveSettled` (`corpus-run/settled-carve.ts`) read an entry's `page.md` and `page.en.md` with `Promise.all`,
both reads refuse for such a commit,
and `Promise.all` rejects with whichever member fails first by the clock.
The agent's real-git probe of 100 such pairs named `page.md` 98 times and `page.en.md` twice,
which measures the reading B300 recorded as the lead's inference.
The diff of the suite failure was cut,
so tying that failure to this cause stays an inference.
Measured by the lead on the red tree:
nine site cases fail,
each printing the later member's refusal,
in `corpus-name-index`,
`displacement-probe-run`,
`draw-sample-pool`,
`editor-calibrate-drive`,
`entry-pictures`,
`required-providers` and `translate-repair`.

The fix:
`allInInputOrder` (`all-in-input-order.ts`) takes promises the caller has already started,
so the work still runs together;
where members fail,
it throws what the first failing member in input order rejected with,
unchanged,
once every member before it has settled.
It cancels nothing and gives a caller's abort no precedence.
Eight sites moved onto it with a case that scripts the later member failing first,
`carveSettled` taking its corpus reader as a required parameter so its case can;
B317 records the sites moved without one.
By the agent's measurement,
with the helper degraded to `Promise.all` seven of its cases and every site case fail.
The whole suite on `f3c2bae13`,
run in a side checkout:
1,986 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and 42 source scans passing.

Open,
and given to a follow-up agent whose work is not merged at `3ce947dce`:
the sites other agents were moving then
(`pass-republish`,
the settled audit's input and buy,
the coverage census's reads,
`verify-published-run`);
a scan failing a bare `Promise.all` outside the helper;
the bench sample's skip line,
left on `Promise.all` because its cut of 80 UTF-16 units ends inside the commit hash,
so both pages print one line;
and lines several members print as they end,
which still come out in completion order.

Open to the owner's veto:
first in input order as the rule,
at the cost that a later failure waits for the earlier members to settle;
one helper and no variant;
in `corpus-name-index`,
an entry whose original is absent is stepped over even when its archive page was refused for another reason;
`translate-repair` moved though its voices' refusals differ only in a detail field.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B317: fifteen more concurrent read sets reported the failure that came first, two under docs saying otherwise

Fixed in `f3c2bae13`,
with no case at the sites;
what holds them is the helper's own cases.

Found on 2026-10-06 (UTC) by the agent of B316,
in its census of every `Promise.all`,
`allSettled`,
`race` and `any` in the package's source:
by its count,
53 lines in 40 files called `Promise.all` in production code at its base,
and 28 in 20 after the fix.
Fifteen sites read with no parameter a case could script
(a direct file read,
`stat`,
`rm`,
`readlink` or a git child),
among them the cache account's readers,
the pass schema census and guard,
the pipeline digest,
the published tree listing,
the report log read,
the score probe's gather,
the process identity and the cited reference lookup.
The TSDoc of `readLogTexts` said it reported "the first to fail",
which `Promise.all` did not deliver,
and the comment of `score-probe-gather` said its first report was not fixed.

The fix:
each site goes through `allInInputOrder`,
and the TSDoc and the comment say what the code does.

Open to the owner's veto:
the sites moved with no case of their own.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B318: two cases kept a late voice inside a grace window a slow timer could outrun

Fixed in `f3c2bae13`.

Found on 2026-10-06 (UTC) by the agent of B316,
searching the tests for bounds on the clock.
`lane-contest-stage.unit.test.ts`,
"KEEPS DELAYED ELIGIBLE VOICES that arrive inside bounded grace",
and `absolute-naturalness-review-stage.unit.test.ts`,
"KEEPS REJECTION that arrives inside bounded post-quorum grace",
each expected a voice delayed 30 ms to land inside a 100 ms grace window,
which a loaded machine could outrun.

The fix:
both give a window of 60,000 ms,
which the round never waits for,
since it ends at the last answer.
By the agent's measurement,
each case fails at a window of 0,
so the window is what keeps the late voice.

Left by the agent,
each with its reason and none shown to fail:
peak-concurrency instruments that wait 10 ms,
meters that wait 20 ms,
a bound of 5,000 ms over about 50 ms of work,
and a lower bound only.
A bound of that kind has since been shown to fail:
the consolidation driver test's 5,000 ms hang bound,
outrun on a loaded machine (B340);
whether it is the bound listed here is not established.
In the census of B358 the meters and instruments of that kind were measured and kept.

Open to the owner's veto:
a window of 60,000 ms and no gate in the scripted clients.

Recurrence:
`mistake-prevention.md`,
"Tests on the real clock".
