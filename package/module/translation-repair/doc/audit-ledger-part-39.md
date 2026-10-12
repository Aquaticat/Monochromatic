# Audit ledger, part 39

Part 39 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B272: `percentileOf` answered zero for a percentile no rank belongs to

Red in `96dad6b2c`,
fixed in `5723cd071`.

Found on 2026-10-06 (UTC) by the coverage cluster over the `corpus-run` files (T8),
in a fallback the census listed as a cold stretch of `census-spread.ts`.
`percentileOf` answered zero for a percentile under zero or not a number on a sample that holds values,
since the rank read nothing and `?? 0` filled in.
No caller passes such a percentile
(the reported ones are 50,
90 and 99,
by the agent's reading),
so no printed figure was wrong.

The fix:
such a percentile throws a `RangeError` naming it,
and the value at a clamped rank is an `unreachable:` throw.
A percentile over 100 still reads the last rank,
and an empty sample still reads zero.
The case is "REFUSES a percentile below zero or not a number";
on the lead's red tree it failed with `Expected act to throw, but it returned`.

Measured by the lead for B272 and B273:
37 named test files pass on the fix tree,
with the 39 source scans and a clean type check.
The whole suite ran on `5723cd071` in a side checkout:
1,648 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 39 source scans passing.
That run started a child with the provider keys in its environment,
through a fixture this commit added (M121,
closed by B291).

Open to the owner's veto:
the refusal,
where clamping to rank zero is the alternative.

Recurrence:
`mistake-prevention.md`,
"Defaults that stand in for an input".

### B273: a replacement for a slice the page lacks was taken with the archive read as empty text

Red in `96dad6b2c`,
fixed in `5723cd071`.

Found by the coverage cluster of B272.
`restoreNameGlossLines` (`name-gloss-restore.ts`) read the archive of a slice the pairs lack as empty text
and passed the row on.

The fix:
it reads through `pageTextOf`,
which throws `SliceNotOnPageError`,
the refusal the other page passes give.
The page text of a slice in `quote-style-unify.ts` is read through `pageTextOf` too,
over a map built from the same slices.
On the lead's red tree the case failed with `Expected act to throw, but it returned`.

Open to the owner's veto:
the refusal,
where passing the row on is the alternative.

Recurrence:
`mistake-prevention.md`,
"Pairing by position".

### B274: a parse offset was read out of a file's own words

Red in `f45278048`,
fixed in `71974714f`.

Found on 2026-10-06 (UTC) by the coverage cluster over the library files from m to z (T8).
`offsetIn` (`run-json-read.ts`) took the digits after the first ` at position ` of V8's refusal
as the offset the parser stopped at.
V8 quotes a short file back whole,
so a file reading `cat at position 7` was reported unreadable `at byte 7`,
an offset no parser stated.

The fix:
a refusal that ends ` is not valid JSON` quotes the file and states no position,
so it yields none.
A V8 refusal with a position phrase and no whole offset,
and `JSON.parse` throwing a value that is no error,
are `unreachable:` throws.
On the lead's red tree `run-json-read.unit.test.ts` failed by assertion.

Measured by the lead for B274 to B276:
of 48 named test files 47 passed and the duplicate-bodies scan failed,
until a shared fixture closed it (M123);
with the fixture in place the two test files that use it pass,
with the 39 source scans and a clean type check.
The whole suite ran on `71974714f` in a side checkout:
1,656 `[PASS]` lines and no `[FAIL]` line,
the 39 source scans passing,
and the lint ending with one warning,
which `230623bec` removed (M124).

Open to the owner's veto:
the position phrase throwing if V8 changes its wording.

Recurrence:
`mistake-prevention.md`,
"Numbers read back from text":
text a message may quote is never searched for a phrase the same message uses as structure.

### B275: a routed call that left its loop with no attempt left said every provider refused it

Red in `f45278048`,
fixed in `71974714f`.

Found by the coverage cluster of B274.
`routedText` (`provider-router.ts`) ended a call that left its loop with no attempt left
as `every provider refused this call`,
under a comment calling that end unreachable.
It is reached when the last attempt is cut at its stream bound,
which takes a model all four providers serve.

The fix:
the stream bound holds are read there as the next decision would have read them
(`reachPastBoundHoldsOrRefusal`,
shared with `chooseProvider`),
so four providers cut in turn end with the reason a model three providers serve already ends with,
naming the hold.
Where a provider before the last refused on its budget,
the reason says the providers refused the call or ran past their bound.

The ending and one of the two cases are the lead's.
The agent's fix worded the end as every provider serving the model having run past its stream bound,
which the loop can also reach after budget refusals,
so that wording would have been false there.
The cases are in `provider-router-stream-bound.unit.test.ts`:
one cuts the call at its stream bound on all four providers,
the other has three providers refuse on their budgets and the fourth cut,
and on the lead's red tree both failed with the old reason in place of the expected one.

Open to the owner's veto:
the two reasons.

Recurrence:
`mistake-prevention.md`,
"Defaults that stand in for an input":
a comment calling a loop's end unreachable is checked against every `continue` in the loop.

### B276: seed detection skipped an issue naming a slice the preparation lacks

Red in `f45278048`,
fixed in `71974714f`.

Found by the coverage cluster of B274.
`gradeSeedDetection` skipped an issue naming a slice the preparation lacks without a word,
which reads every seed of that slice as never reported.

The fix:
it throws.
On the lead's red tree `seed-detection-slicing.unit.test.ts` failed by assertion.

Open to the owner's veto:
the throw.

Recurrence:
`mistake-prevention.md`,
"Defaults that stand in for an input".

### B277: 44 test cases in ten files passed without printing a pass line

Scan red in `0634aa8bc`,
fixed in `63f8f838a`.

Found on 2026-10-06 (UTC).
An agent closing housekeeping items reported that `fidelity-reference-read.unit.test.ts` "prints nothing and exits 0",
in a file that was not its own,
and the lead followed it up.
`describe` of the test module logs the passing children of a suite named `''` at `debug`,
so a case whose nearest suite has an empty name passes without a `[PASS]` line.
A failure there still prints and still fails the file (the agent's control run),
so nothing was hidden but the count.
Every count of `[PASS]` lines this ledger quotes is a count of suites that print,
and such cases were in none of them
(the T8 entry already records that the count is of named suites and not of cases).

The fix:
`silent-test-cases.unit.test.ts` finds every `it` whose nearest `describe` has an empty name,
or none,
and names the file,
the suite chain and the case.
Its package case failed with 44 findings in ten files.
`deepseek-v41-admission.unit.test.ts` and `deepseek-v41-routing.unit.test.ts`
kept every case in a root suite named `''`;
the roots take a name.
Five files each kept a case loose beside their named suites
(`displacement-class`,
`edit-wire`,
`photo-reference`,
`restoration-judge-wire` with two,
`transient-retry`);
each case sits in a named suite of its own.
The four `fidelity-reference*` test files are rewritten under named suites.
Every refusal case there asserts the whole message and names the boundary that fired,
through fixture helpers that spell the message out and do not build it with the class under test,
and the command-line case no longer names a real page:
it reads the entry that lacks an alteration from the checked-in manifest.
The scan joined the `source-scans` task,
which ran 40 files from then.

The agent's measurements,
not rerun by the lead:
38 single-site mutations of the fidelity-reference modules,
each caught by a rewritten case,
23 of them by none of the cases they replace;
with every file run by name against one build,
1,644 `[PASS]` lines where 1,628 stood,
the rise being suites that print now and did not.
No production file changed.
The whole suite ran on `63f8f838a` in a side checkout:
1,672 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 40 source scans passing.

Not reached,
by the agent's account:
a suite named by a variable or a member reads as named whatever it holds,
and `describe` or `it` imported under another name is not followed.

Open:
the six allow-list lines of `own-unit-tests.unit.test.ts` for the fidelity-reference modules stay,
since the one test file reaches several modules and splitting it is a change of its own.

Open to the owner's veto:
the root names and the six wrapper suite names;
the row for an unsupported damage family kept through `as never`,
as the case of a loud guard production cannot reach.

Recurrence:
`mistake-prevention.md`,
"Claims without their evidence".

### B278: three report commands faulted on an unreadable log and totalled a log named twice

Red in `5e116395a`,
fixed in `387af02b7`.

Found on 2026-10-06 (UTC) while moving the four report runners into modules a test can load
(T8,
the runner entry files).
`run-timing-report`,
`spend-report` and `meter-report` read each named log with `readFile`.
A log path that could not be read left the command as a fault,
exit 5,
naming nothing.
A log named twice was totalled twice by `run-timing-report` and `spend-report`,
so every call,
round and credit doubled.
The line count was a split on the newline,
so the closing newline every log a run wrote ends with counted as one more line.

The fix:
the three share `report-log-read.ts`.
`readLogTexts` refuses an unreadable log as a stated refusal,
exit 6,
naming the path as typed and the filesystem's code.
`refuseRepeatedLogs` refuses a path named twice,
the two paths compared once made absolute,
in the two commands that total;
`meter-report` keeps accepting one,
since it collapses exact repeats by design.
`linesOfLog` drops the empty piece after a closing newline.
The cases are in each command's suite "<command> as built",
which runs the built command in a child process over files the case writes,
and in the test files of the run modules.
Measured by the lead on the red tree:
`ledger-report` passes as it stands,
and the other three as-built files fail by the assertions named
(three cases,
two and one).

For B278 to B281,
measured by the lead on the fix tree:
35 named test files pass,
with the 40 source scans and a lint that finds nothing,
its type check included.
The agent's measurement,
not rerun by the lead:
a census over its 16 test files lists none of the four bundles among those no test loaded,
and no cold stretch in the entry files or the new modules beyond two `unreachable:` throws.
The whole suite first ran over this change on `53e25b458`,
with the two runner clusters that followed it:
1,821 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 40 source scans passing.

Open:
two paths that reach one log through a symbolic link are not seen as one.

Open to the owner's veto:
refusing a log named twice,
where totalling it twice was the behaviour.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal",
for the fault,
and "Readers of the package's own log lines".

### B279: `ledger-report --model` cut a candidate at 400 units with no word that it was cut

Fixed in `387af02b7`,
with its cases,
which the agent ran red in its worktree.

Found by the move B278 records.
`printReading` printed each candidate through `wholeOpening` at 400 UTF-16 units and nothing else.
A candidate of 450 units showed its opening with no sign it was longer,
so a reader weighing a seat's wording took the opening for the whole.

The fix:
a cut opening is followed by a line saying how many of the whole's units are shown.
The cases in `ledger-report-print.unit.test.ts` hold an excerpt of exactly 400 units,
a cut,
and a cut that would split a surrogate pair.

Open to the owner's veto:
the line after a cut candidate.

Recurrence:
`mistake-prevention.md`,
"Checks that vouch for a whole block":
an excerpt of evidence shown to a reader states its cut.

### B280: `spend-report` said four things its own figures deny

Fixed in `387af02b7`,
with its cases,
which the agent ran red in its worktree.

Found by the move B278 records,
reading each printer whole.

- `printCost` said no call went to the metered provider wherever no seat was priced.
  A run whose every metered call sat on a seat the price table has no row for said so,
  then listed those seats under the heading for unpriced ones.
  It says none was priced in that state,
  and keeps the old line where no metered call exists.
- The USD group holds OpenRouter and Bedrock seats,
  and its heading and total said OpenRouter,
  so a Bedrock bill read as OpenRouter's.
  Heading and total name the providers present,
  byte for byte unchanged for a run on OpenRouter alone;
  a seat of neither provider throws `unreachable:`.
- The floor note wrote `1 call reported no usage block, so their tokens`.
  The pronoun follows the count through `wordForCount`.
- A log with no spend line printed NOTHING RECORDED,
  whose own line says silence is not a zero,
  and then a zero credit total.
  The report stops after its notes where no seat was read.

Open to the owner's veto:
nothing printed after NOTHING RECORDED.

Recurrence:
`mistake-prevention.md`,
"Claims without their evidence":
a claim of absence is printed only in the state that proves it.

### B281: `meter-report` merged two readings that shared a stamp and the first two providers' states

Fixed in `387af02b7`,
with its cases,
which the agent ran red in its worktree.

Found by the move B278 records.
The merge key was the stamp,
the Synthetic and Hyper states and the numbers joined with a comma.
It left out the OpenRouter and Bedrock states,
and the join let one field holding a comma read as two fields.
Two readings that differed only there collapsed into one.

The fix:
the key is every field of the reading,
so a reading differing in the third or fourth provider's state,
or in a number,
is a reading of its own;
exact repeats still collapse.

Open:
`reportLedger` and `reportMeters` set `process.exitCode` themselves,
so their cases hold and restore it.
The lead's rule for the clusters after this one is that a moved procedure returns its code and the entry sets it;
these two are left to change with that follow-up.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B282: `probe-verify` asked the whole roster before it refused a sheet already taken

Fixed in `abb506b7b`,
with its cases,
which the agent ran red in its worktree.

Found on 2026-10-06 (UTC) while moving five probe and sensitivity runners into modules (T8).
`probe-verify` asked the whole roster about every damaged and control region,
and only then found the sheet or its manifest already in the runs directory,
refused,
and wrote nothing.
A rerun over a graded sheet paid for the whole run.

The fix:
the check is `assertSheetPairFree`,
taken out of `writeSheetPair` (`sheet-write.ts`),
which still uses it,
and it runs before anything is gathered or asked.

The as-built suites of the five commands are in `139a31f4a` and pass against the unmoved commands and the moved ones,
so the move is shown to change nothing a keyless run can see.
Measured by the lead for B282 and B283:
the 22 test files of the cluster and 10 guard and inventory files pass;
lint ends with no warning and no error,
its type check included;
of the 40 source scans 39 pass,
and `dead-test-declarations` fails on four fixture names of `a13f71ba8`,
which only the test files of `1088e72d9` read.
The agent's measurement,
not rerun by the lead:
a census over its 23 test files lists none of the five bundles among those no test loaded,
and no cold stretch in the entry files or new modules beyond one throw.
The whole suite's run over this change is the one B278 records.

Open to the owner's veto:
a builder of clients in place of a client,
since a client answers a prompt it was already asked from its stored reply;
the gatherers passed in by the entry;
`resolveRunsDir()` read before the audits in `audit-sensitivity`,
where it was read after.

Recurrence:
`mistake-prevention.md`,
"Work no floor can check":
state known at the start is checked before anything is bought.

### B283: the `issues-absent` arm of `probe-relabel` sent the production disclosure with an empty list

Fixed in `abb506b7b`,
with its case,
which the agent ran red in its worktree.

Found by the move B282 records.
The arm that claims no issue list is known sent the production disclosure with an empty list,
which under a rendered disclosure writes the heading for a list into the prompt.

The fix:
it sends the withheld disclosure.
Production's setting is withheld today,
so today's output is unchanged.

Recurrence:
`mistake-prevention.md`,
"What each sheet is shown".

### B284: the score commands' refusals reached the operator as faults with no words

Red in `a13f71ba8`,
fixed in `1088e72d9`.

Found on 2026-10-06 (UTC) while moving the five score runners into modules (T8).
Each of these ended at exit 5 with a stack and no words:

- `score-verify` and `score-probe` over a sheet and a manifest of different lengths;
- a manifest row with a wrong position;
- `score-attribution`,
  `score-probe` and `score-crosscheck` over a runs directory with no `artifacts` directory;
- a graded sheet that could not be read,
  absent or a directory,
  in `score-verify`,
  `score-agreement` and `score-probe`,
  which named no path.

The fix:
each is a stated refusal,
exit 6.
The length refusals name the counts;
the position refusal no longer quotes the file's value;
`requireArtifactsDir` (`score-artifacts-dir.ts`) names the directory and the filesystem's reason;
and `readSheetText` (`score-sheet-text.ts`) names the path,
the reason and what to name instead.
Measured by the lead on the red tree:
`score-probe` and `score-crosscheck` pass against the unmoved commands,
and `score-attribution`,
`score-verify` and `score-agreement` fail by assertion
(two cases,
two and one).

For B284 to B287,
measured by the lead on a tree that also held the files of `53e25b458`:
44 test files pass,
this cluster's 22 among them,
with the 40 source scans and a lint that finds nothing.
The tree of `1088e72d9` is that one less the files of `53e25b458` and its lines in two files both commits edit;
it was not built on its own,
and its message says so.
The agent's measurement,
not rerun by the lead:
a census over its 22 test files lists none of the five bundles among those no test loaded,
and no cold stretch in the entry files or new modules beyond the throws.
The whole suite's run over this change is the one B278 records.

Open,
to rule on:
`resolvePool` (`artifact-pool.ts`) reads the environment itself;
`score-verify` counts a sheet answer of `Duplicate` as unscored,
where `score-agreement` reports duplicates apart.

Open to the owner's veto:
`requireArtifactsDir` as a listing of its own before the gather's;
full paths in the two readers' refusals.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal".

### B285: `score-agreement` scored without a file the operator named

Red in `a13f71ba8`,
fixed in `1088e72d9`.

Found by the move B284 records.
`--manifest` or `--pre-grades` with a path that was not there printed the note for a file nobody named,
and scored without the file the operator typed the flag to supply.

The fix:
`readNamedOrBeside` refuses a named file that is absent,
and `readOptional` states every other read failure in words.

Open to the owner's veto:
refusing a named file that is absent.

Recurrence:
`mistake-prevention.md`,
"Defaults that stand in for an input":
absence is an answer only for a file nobody named.

### B286: score reports said nothing, or one thing for three states

Fixed in `1088e72d9`,
with their cases,
which the agent ran red in its worktree.

Found by the move B284 records.

- `score-verify` over a sheet and a manifest with no item printed only its closing note,
  which reads as a report over something.
  It prints a line saying no set was reported.
- `score-crosscheck` printed its status breakdown label and nothing more
  where every judgeable claim was accepted.
  It prints `none`.
- `score-crosscheck` said no entry carried attribution in three different states.
  Where every claim was proposed by the whole roster,
  it said so and returned before its warning about unjudgeable claims;
  where entries carried attribution and no issue joined to it,
  it said the same.
  Each state has its own note,
  and the whole-roster note is followed by the warning.

Three branches no input reaches are `unreachable:` throws:
the rate of a critic heard on no chunk,
which rendered `n/a` or `INCONSISTENT`,
and the joins of positions behind a length check in `score-verify` and `score-probe`.

Open to the owner's veto:
a line for an empty verify sheet,
where a refusal is the alternative;
the unreachable rate throwing where it rendered a word.

Recurrence:
`mistake-prevention.md`,
"Claims without their evidence":
an early return names which state reached it.

### B287: the author table of `score-crosscheck` ordered ties by the directory listing

Fixed in `1088e72d9`,
with its case,
which the agent ran red in its worktree.

Found by the move B284 records.
Authors with equal accepted counts came out in whichever order the artifacts were read,
and the listing is not sorted.

The fix:
`tallyAuthors` breaks a tie by model id in code-point order.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B288: `cap-census` counted a log once for every named path that reached it, and one unreadable log ended the census

Fixed in `53e25b458`,
with its cases,
which the agent ran red in its worktree.

Found on 2026-10-06 (UTC) while moving three report runners into modules (T8).
`capCensusLogsUnder` listed a log once for every named path that reached it,
so a directory named beside a log inside it counted each of that log's calls twice
and moved the percentile the cap rule reads.
The walk counted a directory it could not list and went on,
but a log it could not open ended the whole census as a fault,
exit 5,
discarding the census of every readable log.

The fix:
each log is taken once,
by its resolved path;
and a log that cannot be opened is counted and named like the directory,
through the one printer `reportCapCensusUnreadable`.
The cases are "TAKES A LOG ONCE where the paths named reach it twice"
and the one that begins "COUNTS A LOG IT CANNOT READ".

The as-built suites of the three commands arrive with the move and not in a red commit of their own,
since they share their files with the cases of the moved functions.
For B288 to B290,
measured by the lead:
44 test files pass,
the 18 of these three commands among them;
after one local was renamed,
the 40 source scans pass and lint ends with no warning and no error.
Before the two edits named here as the lead's,
two of the 40 scans failed,
on those two lines alone.
The held entry of `caught-value-text` names `reportCapCensusUnreadable`,
where the agent's report named `visit`;
and a local of `slice-cost-bands.ts` whose name was a position word became `smallerBound`,
since the position-reference scan reads the word as a pointer by position,
a finding the agent's report did not list (M131).
The whole suite ran on `53e25b458` in a side checkout:
1,821 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 40 source scans passing.

Recurrence:
`mistake-prevention.md`,
"Searches and censuses that miss":
a census over named paths collapses its inputs before it counts,
and the two reads of one walk share one policy.

### B289: `slice-cost-report` printed no spread block and no word about it, and a missing log as a fault

Fixed in `53e25b458`,
with its cases,
which the agent ran red in its worktree.

Found by the move B288 records.
`printSpread` returned without a word for a log with fewer than two priced slices,
or one whose cheapest priced slice took no measurable time,
so a reader could not tell an omitted block from a clean one.
A log that was not there was a fault with a stack,
exit 5.

The fix:
both arms say why no spread is shown;
and a missing log is a stated refusal naming the path,
exit 6,
while other read errors still leave as the fault they are.
A fallback of zero for a band with no bound before it (`slice-cost-bands.ts`) is an `unreachable:` throw.

Recurrence:
`mistake-prevention.md`,
"Claims without their evidence":
a branch that skips a block of a report says so.

### B290: two refusals of `cache-account-audit` printed as faults of the command

Fixed in `53e25b458`,
with its cases,
which the agent ran red in its worktree.

Found by the move B288 records.
The audit read every tracked file with no check that the file existed,
so a removal not yet committed ended a check made before a launch as a fault,
exit 5.
A cache version declared in a form the audit cannot read raised `CacheAccountReadError`,
whose message tells the operator how to write the declaration,
and it printed as a fault of the command with frames.

The fix:
the missing file is a stated refusal naming the file,
and `CacheAccountReadError` extends `StatedRefusalError`.
`cache-account-slice-report.ts` takes the runs directory where it looked it up,
and has a test file of its own.

Open,
to rule on:
`unaccountedCommits` and `printSliceCacheAccount` compare times to the second,
so a version set in the same second as a record reads as not set after that record;
telling the two apart needs ancestry and not seconds.

Open to the owner's veto:
`resolveRunsDir()` read before the audit,
where it was read after the version report.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal".
