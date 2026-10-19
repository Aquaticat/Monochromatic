# Audit ledger: runner reports and probes

Report and probe commands that printed a claim their own figures deny,
or bought work nothing could use.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## B279: `ledger-report --model` cut a candidate at 400 units with no word that it was cut

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

## B280: `spend-report` said four things its own figures deny

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

## B281: `meter-report` merged two readings that shared a stamp and the first two providers' states

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

## B282: `probe-verify` asked the whole roster before it refused a sheet already taken

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

## B286: score reports said nothing, or one thing for three states

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

## B288: `cap-census` counted a log once for every named path that reached it, and one unreadable log ended the census

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

## B289: `slice-cost-report` printed no spread block and no word about it, and a missing log as a fault

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

## B294: `translate-probe` without a key reported three failed slices and exited 0

Red in `7d2ca2604`,
fixed in `da8a963cc`.

Found on 2026-10-06 (UTC) while moving five probe runners into modules a test can load (T8).
`translate-probe` built its client inside the `try` that reports one slice as failed.
With no provider key,
the stated refusal printed as `SLICE FAILED: RunConfigError: ...` once for each of three slices,
and the command ended at exit 0 having asked nobody.

The fix:
the client is built before the `try`.
A refusal to build one stops the command,
exit 6,
and a failure inside the gather is still reported for its slice.

Two more in the same commit,
each cased red first by the agent in its worktree:
`translate-probe` printed `probing the first 3` whatever the count of slices was,
and prints the smaller of the count and three;
and B308 records the count of `coverage-probe`.
With them,
no defect:
`displacement-probe` answered `false` without a word
where a relocation candidate named a slice its slicing did not hold,
in the two filters that count transcription suspects and markup donors.
No input builds that state,
so it is an `unreachable:` throw naming the slice and the slice count,
and no case drives it.

Measured by the lead on the red tree:
four of the five as-built test files pass against the unmoved commands,
and `translate-probe` fails in that one case by assertion,
exit 0 where 6 is expected.
The agent's measurement,
not rerun by the lead:
a census over its 20 test files lists none of the five bundles among those no test loaded,
and no cold stretch in the entry files or new modules beyond the one throw.
The whole suite ran on `da8a963cc` in a side checkout:
1,858 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 41 source scans passing.

Open,
to rule on:
`coverage-control-probe` refuses the whole run where an entry lacks a page,
and `coverage-probe` skips such an entry as an ordinary state of the corpus.

Open to the owner's veto:
the client built before the `try` for one slice,
where rethrowing a stated refusal from the catch is the alternative,
which would also stop a slice whose gather refused;
`probing the first 1` and `probing the first 2` in the existing form of the line;
the stamps of the log lines of `displacement-probe` read as `<time>` in its as-built cases,
where pinning them wants a clock handed to the logger.

Recurrence:
`mistake-prevention.md`,
"What a catch charges":
a catch that charges one unit of work does not also hold the setup every unit shares.

## B299: `editor-width-probe` over a draw holding no slice bought the control and wrote a report with no row

Tests in `327ea1de0`,
fixed in `77a213478`,
with its case,
which the agent ran red in its worktree.

Found on 2026-10-06 (UTC) while moving `editor-calibrate` and `editor-width-probe` into modules (T8).
`editor-width-probe 1 b` drew one slice,
of which draw B takes none,
then bought the positive control and wrote a report with no row:
a clean finish over no work,
paid for.

The fix:
a draw that holds no slice is a stated refusal before the control,
naming how many slices that draw needs.

The as-built cases are in `327ea1de0` and pass against the unmoved commands and the moved ones:
six for `editor-calibrate` and two for `editor-width-probe`,
every child through the keyless fixture,
over a throwaway repository holding one invented entry.
The whole suite ran on `77a213478` in a side checkout:
1,898 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 41 source scans passing.

Open,
seen by the agent and left to rule on:
`editor-calibrate-standing.ts` counts a round whose lone composite candidate has no ballot as judged,
while the shipped table counts it as not unvoted;
and the wording of the reach line,
"the rest carried no paragraph",
which the agent questions.
B307 closes the third thing it saw,
the bare `Error` of `bench-sample.ts`.

Open to the owner's veto:
the stage seams of the width probe (`controlHolds`,
`gather`,
`runSlice`,
`writeReport`) and the draw passed in as functions;
the wording of the empty-draw refusal;
`readOverlap`,
`adoptGrace`,
`readWriterGrace` and `newClient` passed as functions.

Recurrence:
`mistake-prevention.md`,
"Work no floor can check":
state known at the start is checked before anything is bought.

## B304: the pass order left medium and large bands tied, and retried a failing entry first on every run

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

## B305: `producer-calibrate` printed a standing over rounds that never ran

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

## B306: `recall-benchmark --plan` printed `PLAN ok` over a corpus that yielded no entry

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

## B312: the settled rendering audit named its runs directory only after buying every subject

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

## B372: the standing reader counted no digest whose rounds drew no ballot

Red in `bb2a8b9ad1e164974e54d2750432a25b267ef0de`,
fixed in `cfac5b981`.

Found on 2026-10-06 (UTC) by the review of the runner observations change,
its sixth finding.
The summary printed `digestsWithRounds=`,
so beside a judged digest,
a digest whose rounds drew no ballot was counted nowhere.
By the agent's run on the port build,
a run of two digests,
one judged and one with no ballot,
printed `digestsWithRounds=1` and no trace of the second.

The fix:
the summary prints `digestsJudged=`,
`digestsUnjudged=` and `unjudgedDigestRounds=` in its place,
and the case compares all four runs in one object;
`child-environment.unit.test.ts`,
outside the change,
quotes the summary line and moved with it.

Open to the owner's veto:
`editor-standing-read` still exits 1 for rounds with no ballot,
with the summary fields `digestsJudged`,
`digestsUnjudged` and `unjudgedDigestRounds`,
and an off-roster note that follows its count;
the report names no alternative.

Recurrence:
`mistake-prevention.md`,
"Claims without their evidence".
