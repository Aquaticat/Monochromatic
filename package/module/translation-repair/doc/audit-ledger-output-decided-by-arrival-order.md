# Audit ledger: output decided by arrival order

Findings,
refusals and log lines whose content or order depended on which concurrent work ended first,
and the scan that looks for it.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## B253: one checker round read twice ordered its findings by which seat lost its first answer

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

## B287: the author table of `score-crosscheck` ordered ties by the directory listing

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

## B310: `verify-published` printed its entry lines in the order the disk answered

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

## B316: when several concurrent reads failed, the refusal named whichever ended first

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

## B317: fifteen more concurrent read sets reported the failure that came first, two under docs saying otherwise

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

## B328: a test helper sorted away the order the recheck guarantees

Changed in `75ea14bff`;
its red is the agent's measurement in its worktree,
since the cases pass on the stage as it stands.

Found on 2026-10-06 (UTC),
the helper a review had flagged without settling.
`missingChecksSorted` and `readingsInSeatOrder` put the findings and the ballots of every recheck verdict in order
before the cases of `refine-recheck.unit.test.ts` compared them,
for a gather order the stage no longer exposes:
`repair-edit-stages.ts` returns them in the roster's order.
By the agent's measurement,
with the roster ordering removed from the stage every case of the file still passed,
and with both helpers removed as well six failed.

The fix:
both helpers are gone from that file,
and its cases assert the roster order as the stage returns it.

Open:
`refine-slice-settle.unit.test.ts` wraps `readingsInSeatOrder` the same way.
Closed since by B343.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order":
a case asserts an order exactly,
never after a sort of its own.

## B343: a second test file sorted away the order the recheck guarantees

Changed in `de6ff17`;
its red is the agent's measurement,
since the cases pass on the stage as it stands.

Found on 2026-10-06 (UTC),
the item B328 left open.
`refine-slice-settle.unit.test.ts` compared each settled slice's recheck readings through `readingsInSeatOrder`,
which sorted the ballots into seat order.
By the agent's mutant,
with the checker stage's roster ordering removed from `repair-edit-stages.ts`,
every case of the file still passed while `refine-recheck.unit.test.ts` failed six;
with the helper also removed,
the two cases whose round heard three checkers failed.
The third case hears no checker,
so it has no ballots to order.

The fix:
the three cases assert the readings as the stage returns them,
and `readingsInSeatOrder` is gone from `sunbathing-recheck.test-fixture.ts`.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

## B367: the bench draw decided between a skip and a refusal by which read ended first

Red in `bb2a8b9ad1e164974e54d2750432a25b267ef0de`,
fixed in `cfac5b981`.

Found on 2026-10-06 (UTC) by the review of the runner observations change,
its first finding.
The change rethrew a read failure inside the catch of a `Promise.all`,
so an entry whose original was absent and whose English page git could not produce
was skipped or refused depending on which read ended first.
The port kept main's `textOf`,
which had no rethrow,
and two of main's cases named the skip of an entry unreadable for another reason.
By the agent's run on the port build,
five cases fail,
each because the draw returned where it should refuse:
two new cases scripting the later read failing first,
within one entry and across two;
main's two cases,
renamed to refuse;
and the change's own case on a lost object.

The fix:
`textOf`'s catch rethrows every read failure except `isMissingCorpusObject`,
failures that are no `CorpusReadError` among them,
decided at the read,
and `allInInputOrder` reports the first in input order,
so which read ended first no longer decides a skip or a refusal.
Parse and alignment failures stay skips,
since they happen in `stepOf`.
The TSDoc and `@throws` of `textOf`,
`sliceEntry`,
`sliceListedEntries` and `sampleBenchSlices` say so.

Open to the owner's veto:
The draw refuses every read failure except a page absent at a commit the clone holds,
faults that are no corpus read refusal included;
the alternative is the narrowing of the change's second report,
which rethrew a `CorpusReadError` alone and skipped any other failure.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

## B388: two runners logged per-entry lines in completion order

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

## B392: the editor standing read printed its stderr lines in whichever order its reads ended

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

## B414: the cited-reference and work-title lookups wrote their per-member lines in completion order

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
