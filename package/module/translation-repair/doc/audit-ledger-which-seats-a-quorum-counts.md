# Audit ledger: which seats a quorum counts

Quorums that counted seats which never answered,
could not answer,
or were withheld.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## B27: a quorum counting seats the router refused (B21, family five)

Status:
fixed,
2026-09-29.
The short-bench rule
(`doc/decision/translation-repair-short-bench-share.md`)
sizes a gather's quorum on the seats a wet provider serves.
Family five asked where a threshold derived from a gather still counted the whole bench.

### The census

Every quorum-sizing line in the package's source was read
(`f5-sites.txt` in `~/temp/agent/audit-glossary-fix/`,
157 lines,
18 of them calls or mentions of `rosterQuorumSize` or `reachableQuorum`),
and each threshold was asked which seats its denominator counts.
Outside its own file,
`rosterQuorumSize` had 8 calls when the census read them,
and has 7 since the fix removed the archive block review's.
The gather itself (`stage-quorum.ts`),
the windowed rounds,
the select minimum
and the naturalness verdict rebuilt from its recorded basis
all take `reachableQuorum`.
The first round's window (`firstRoundWindow`) sizes a round before any seat is lost,
and `shortBenches` uses the whole bench's quorum to say what short means;
both count the whole bench by design.
Reference attestation takes its majority over the voices heard,
the vote tally over the ballots cast,
and insertion admission over the reachable seats coverage asked.
The checker bench width is a roster floor,
and the non-translation finding compares characters,
not seats.

### What was wrong

`runArchiveBlockReviewStage` held its anchored voices to `rosterQuorumSize` over the whole bench,
while the same function's outage test had taken `reachableQuorum` since the short-bench rule.
On a bench whose reachable seats fell short of the whole bench's quorum,
a block every reachable seat anchored in the original was left unresolved:
it skipped its naturalness read
and carried a finding naming the whole bench's quorum as the number required.
The archive's own text ships either way,
so the defect cost evidence rather than wording.

Two sentences claimed what a short bench cannot do.
The seat reader's wait line said it waits "rather than seating a bench that cannot settle",
and its function's TSDoc said the same;
the run client contract said "a phase that settles on nobody"
and named `run-seats.ts`,
from which the reading had moved to `run-seats-read.ts`.
Since the short-bench rule,
a short bench decides on a share of the seats a wet provider serves,
or is an outage below two of them.

### Exposure

Under `~/temp/agent/`,
1,404 stored logs and JSON files name the stage,
which is the control that the store is live,
and 10 carry the review's uncorroborated-claim finding,
which is the control that its findings reach stored files.
5 carry the unresolved finding:
2 are test output
(`audit-tests/it-blocks.json`,
`gfp-20260902/anchor-test.log`),
and 3 are replays or a probe from 2026-09-10
whose benches heard 7 of 11 seats,
so at least 7 were reachable and the quorum stays 6 under the fix.
No stored file outside the test output carries the review's short-bench finding.
The defect was latent.

### The fix

One `reachableQuorum` is computed from `gather.unreachable` before the outage test,
and both the outage test and the participation threshold read it.
The wait line now says "rather than seating a bench short of its quorum",
the TSDoc says when a bench the phase leans on would sit short of its quorum,
and the contract names `run-seats-read.ts` and `pass-reseat-hook.ts`
and says what a short bench decides.
Red `dd6d22874`,
fix `a3c83b333`,
boundary case `b968cbdc6`.

### Mutants and caches

The red case seats eight reviewers with five refused,
asserts from the exported helpers that the reachable seats fall below the whole bench's quorum
and meet the reachable share,
and asserts the review gather recorded the short bench.
The mutation batch (`b27-mutants.json`) caught ignoring the refusals,
but a boundary mutant turning the threshold's `<` into `<=` survived:
no case held anchored voices exactly at the quorum.
The boundary case has exactly the first quorum's worth of reviewers anchor,
and the rerun caught both mutants,
with the comment control surviving both times.
The archive block review keeps no cache (B26),
and the seat reader's line is a log.
The full suite passed on `b968cbdc6` with no failing case.

## B46: ballot guards that disagreed on whether a finding's shape costs a voice

Status:
fixed 2026-09-30 (UTC),
found reading the ballot-reply guards in T8's eighth batch.
Three guards decide whether a judge's reply is a ballot:
the lane contest's (`lane-contest-wire.ts`),
the consolidation gate's (`consolidate-gate-wire.ts`)
and the polish gate's (`consolidation-polish-gate-wire.ts`).
The lane contest refused a reply whose `unsupported` or `dropped` was missing or not a list of strings,
choice and reason readable or not.
The two gates kept a reply whose findings were anything at all,
reading a non-list as no findings,
but refused one with a findings key left out.
So a reply whose findings were `null` was a ballot at the gates and a lost voice at the contest,
and a reply with `dropped` left out was a lost voice at all three.

How they came apart:
`57e0ad7fa` (2026-08-20) stopped the lane contest's guard refusing findings over their wording,
after calibration lost two of its first sixty voices that way,
on the rule that the choice is what a contest counts and no wording of a finding may cost a voice;
it kept the shape check,
which its test pinned so that the reader would never receive a value it could not read.
consolidate-10
(`f83e9b449`,
2026-08-26,
`doc/audit/translation-repair-package-audit.md`)
carried the rule to type at the consolidation gate,
narrowing in the reader instead,
but left the gate's key-presence checks,
and neither change read the other guard.
The shape check was deliberate,
but for the reader's sake,
and a reader that narrows removes that reason.

Decided,
under the owner's standing quality directive and open to veto:
one rule for all three.
A reply is a ballot when its choice names a candidate and its reason is text;
findings left out,
`null`,
a bare phrase or a list carrying anything but strings read as no findings,
raw findings included.
`findingsOrNone` (`contest-ballot-wire.ts`) is the one reading,
and each reader takes both fields through it;
the lane contest's wire type now carries the findings,
and the archive answer its guard never checked,
as `unknown`.
Cases:
each guard's case in `consolidate-gate-wire.unit.test.ts`,
`lane-contest-wire.unit.test.ts` and `consolidation-polish-gate.unit.test.ts`
accepts a reply with a findings key left out;
the lane contest's case that pinned the refusal of a non-list now pins its acceptance;
a reader case each for the lane contest and the polish gate reads non-list findings as none,
choice kept;
`contest-ballot-wire.unit.test.ts` pins `findingsOrNone`.
Those cases were committed red first (`395567499`):
the three guard cases and the lane contest's non-list case failed against the build before the fix.
The change turns a lost voice into a kept one and never the reverse,
which changes whose voices a round hears,
so the accounts ride inside `LANE_CONTEST_CACHE_VERSION` 6 and `CONSOLIDATE_CACHE_VERSION` 20:
no slice-cache file was written after 04:27 UTC on 2026-09-27
under the agent runs or either worktree's runs directory,
copy payloads left out,
where a control from midnight that day finds 494.
The replies the runs stored under `prompt-payloads/` were not counted for such ballots:
they sit in many run roots,
and no count over them could show it covered every reply behind a cached ballot.

## B141: a refinement recheck nobody answered read as passed

Red in `9c2eb03d9`,
fixed in `e0151b92c`.

Found by the independent review of the trial's cases (report 4,
F1),
behind a case asserting `refine-recheck-passed` for a round in which no checker was heard.
`retainsResolvedIssues` rolled a rewrite back over an open issue only where a tally said `worse`,
and a round with no ballot has no tally saying anything,
so it returned `refine-recheck-passed` and the rewrite shipped.
It read neither `heardCheckers` nor the checker stage's findings,
so a round every checker answered `not-fixed` and a round nobody answered left one findings list.
On a bench of three,
the floor `assertCheckerQuorumReachable` holds a run to,
one checker heard of three passed the recheck by itself.
The stage's `stage-quorum-unmet (checker 0/3)` was dropped with the rest of its findings,
so the settlement passed `everyStageHeard` and was written to the refine cache.
A confirmed issue in such a round did roll back,
under `refine-rolled-back`,
which names it as an issue the rewrite broke,
and that was cached too.
Ledger L11 rules that a rewrite ships only after a checker round;
a round short of its quorum is none.

The fix:
the recheck reads the checker stage's findings through `silentStagesOf` (`stage-silence.ts`),
the reader the caches use,
and a round short of quorum rolls the slice back whatever its ballots say,
under `refine-recheck-unheard (<heard> of <configured> checkers heard)`,
decided before any issue is read,
so an outage is never recorded as an issue the rewrite broke.
The checker stage's findings now ride on all three verdicts,
as they do on the accuracy lane's outcome (`repair-chunk.ts`),
so a lost voice or a missing check shows on a pass and on a rollback,
and a round short of quorum keeps its settlement out of the cache.
Rolling back follows the package's gates between a new text and a standing one:
the consolidation gate and the polish gate each ship the standing text unless two ballots name the new one.
Decided for quality under the owner's standing directive and open to veto;
the alternative ships the rewrite under the unheard finding.
The gate moved to `refine-recheck.ts` for the file-length cap,
with its cases in `refine-recheck.unit.test.ts`.

Measured on the built package with a scripted bench of three:
with the unfixed gate,
none heard and one heard each gave `refine-recheck-passed (1 issue)`,
shipped the rewrite and passed `everyStageHeard`;
with the fix both roll back under `refine-recheck-unheard` and fail `everyStageHeard`.

Left as it was,
each shown by a probe:
a damage probe that hears no prober still ships the rewrite,
under `stage-quorum-unmet (introduced-defect-probe ...)` and uncached;
and a round that met its quorum counts an open issue no heard checker ruled on as passed,
now beside one `missing-check` finding a checker.

Cache:
no version moved.
A record written at refine version 5 by the unfixed gate could hold a rewrite shipped on a round short of quorum,
and would resume as it is;
none exists.
`cache-account-audit --runs-under` over the agent runs on 2026-10-05 counted 13,714 slice-cache records
under 391 runs directories,
the newest written at 04:26 UTC on 2026-09-27,
before every cache version's current value was set;
the account is in `REFINE_CACHE_VERSION`'s TSDoc (`refine-slice-key.ts`).

Recurrence:
`mistake-prevention.md`,
"Which seats a quorum counts":
a gate that passes on "nobody objected" first reads that enough voices answered,
through the stage's own account,
and carries that stage's findings with its verdict.

## B160: a damage probe that heard too few probers shipped the rewrite

Red in `779c90b3f`,
fixed in `86f7a2efa`.

Left open by the recheck fix of `e0151b92c`,
shown by its agent's probe.
`settleRefinedSlice` (`refine-slice-settle.ts`) rolled a rewrite back on the damage probe's report
only where the screen admitted a claim,
and a probe that heard no prober admits none,
so the rewrite shipped as probed.
Measured on the built package with a scripted bench of three probers:
none heard,
and one heard raising nothing,
each returned `refined: true` and shipped the rewrite,
with `stage-quorum-unmet (introduced-defect-probe 0/3)` or `(introduced-defect-probe 1/3)` among the findings
and no rollback finding.
The settlement failed `everyStageHeard`,
so it was never cached.

The fix:
`refineProbeVerdict` (`refine-probe-verdict.ts`) decides what the probe's report does to the rewrite.
An admitted claim rolls it back under `refine-rolled-back-by-probe`,
worded as before.
A round short of quorum,
read through `silentStagesOf`,
the reader the recheck and the caches use,
rolls it back under `refine-probe-unheard (<heard> of <configured> probers heard)`.
Claims are read first,
since the settler attaches no report to a rollback
and a short round named unheard would drop a claim the screen admitted from every finding;
the short round still shows by the probe stage's own `stage-quorum-unmet` beside it.
A probe outage now rolls back sound rewrites,
uncached,
so a later run buys the slice again;
the package's gates between a new text and a standing one fail closed.
Decided for quality under the owner's standing directive and open to veto;
the alternative reads the quorum first,
as the recheck does.
Cases in `refine-slice-settle.unit.test.ts`:
none heard,
one heard raising nothing,
one heard with an admitted claim,
and two heard,
which ships.

Cache:
no version moved;
a short probe round never reached the cache;
`cache-account-audit` found no slice-cache record under refine version 5.

Recurrence:
`mistake-prevention.md`,
"Which seats a quorum counts":
a gate that ships on "no objection" first reads that enough voices were heard,
through `stage-silence.ts`,
and reads positive evidence before silence wherever a rollback carries no report.

## B161: a recheck that met its quorum passed an issue it cast too few ballots on

Red in `779c90b3f`,
fixed in `86f7a2efa`.

Left open by the same fix.
`retainsResolvedIssues` (`refine-recheck.ts`) read the round's quorum off the checker stage's findings,
but read each issue's verdict from its tally whatever the number of ballots behind it.
A checker heard on the round may skip an issue,
leaving `missing-check (<n>)`.
B215 has since made that finding name the issue by its id,
the checker and the cause.
On a bench of three that met its quorum of two,
two checkers skipping the second of two open issues left one ballot on it,
and the round returned `refine-recheck-passed (2 issues)` and kept the rewrite.
A confirmed issue with one `fixed` ballot read as unresolved under `MIN_RESOLUTION_BALLOTS`
and was named under `refine-rolled-back` as one the rewrite broke.
On a five-seat bench the router left with two reachable seats,
closing on two,
one ballot on an issue passed too.

The fix:
an issue's count is its reading's ballots,
one per heard checker that ruled on it,
compared with the quorum the checker stage closed on:
the bench quorum,
or the quorum in the gather's `stage-short-bench` finding,
matched by rebuilding that finding with `shortBenchStageFinding` and `reachableQuorum` (`checkerQuorumClosedOn`).
B214 replaced that rebuild:
the gather returns the quorum it closed on,
and the recheck reads it.
An issue short of it is named `refine-recheck-unheard (<issue>: <n> ballots, quorum <q>)`,
whatever its ballots say,
and is never read as regressed or worsened;
a heard issue that broke is named beside it under `refine-rolled-back`.
Decided for quality under the owner's standing directive and open to veto.
Such a rollback carries no `stage-quorum-unmet`,
so it is cached as a rollback.
Cases in `refine-recheck.unit.test.ts` hold the count at one and at exactly the quorum,
on the bench of three and on the short bench of five.

Cache:
no version moved;
`cache-account-audit` found no slice-cache record under refine version 5,
the newest written at 04:26 UTC on 2026-09-27.

Recurrence:
`mistake-prevention.md`,
"Which seats a quorum counts":
a per-issue threshold on a gather's ballots takes the quorum the gather closed on.

## B214: the recheck rebuilt the checker round's quorum from the wording of a finding

Fixed in `2b0bfad75`,
with its cases,
which read a field the fix adds;
the fixing agent's red run read `undefined` where 2 and 3 were expected.

Found on 2026-10-05 (UTC)
by the agent closing what the refine-lane review left of B161.
`retainsResolvedIssues` (`refine-recheck.ts`) needs the quorum the checker round closed on,
and nothing carried that number but the wording of the gather's `stage-short-bench` finding.
B161 had read it there:
`checkerQuorumClosedOn` rebuilt the finding for every count of refused seats and looked for a match.

The fix:
`CheckerStageResult` gains `quorum`,
the recheck reads it,
and `checkerQuorumClosedOn` is deleted.
The agent's patch sized the number in `runCheckerStage` (`repair-edit-stages.ts`),
from the bench size and the seats the gather found unreachable,
since the gather's file was outside the files it was given.
The lead changed that at the merge:
`gatherStageVoices` (`stage-quorum.ts`) returns `quorum`,
the number its own `quorumMet` compared the heard voices with,
and `runCheckerStage` hands it on,
so the quorum is sized in one place.
The same commit corrected the TSDoc of the gather's `findings`,
which said the list is empty when quorum was met,
though the gather names each lost voice on a met quorum too.

Cases in `repair-edit-stages.unit.test.ts` hold the quorum of two for a bench of three,
of three for a bench of five,
of two for a bench of five whose last three seats no provider serves,
beside the short-bench finding naming the same number,
and of two for a bench of three with one seat refused.
The lead's case in `stage-quorum.unit.test.ts` holds six for a bench of eleven every seat of which answers
and two for the same bench with seven seats refused,
with the nine findings that bench leaves.

Cache:
no version moved;
a result gains a field,
and no cached record holds it.

Not checked by the agent:
every writer of an artifact,
for one that stores a checker stage's result whole;
its search found no shape guard that would meet the new field,
and the whole suite passed with it.

Recurrence:
`mistake-prevention.md`,
"Which seats a quorum counts":
a reader of a gather's round takes the quorum the gather returns,
never one read back out of a finding's wording or sized a second time.

## B298: a region no prober answered for was recorded as silent

Fixed in `097b6ac40`,
with its cases,
which the agent ran red in its worktree.

Found by the move B295 records.
`damage-sample` recorded a region no prober answered for as silent,
which is the human grade's negative reference.
A region nobody heard and a region every prober passed read the same on the sheet.

The fix:
such a region is printed as unheard and left off the sheet,
and a run in which no region is heard refuses.
A tally missing after a region was probed is an `unreachable:` throw.
The whole suite's run on `097b6ac40` is recorded in B295.

Open to the owner's veto:
an unheard region left off the sheet and counted in a printed line,
where refusing the whole run at the first one is the alternative;
one client opened for each region of the damage sample,
as before.

Recurrence:
`mistake-prevention.md`,
"Which seats a quorum counts":
no answer is never recorded as an answer.

## B420: a seat that threw on every call kept its place on every bench for the whole run

Red `2a049370cd`,
fixed in `06442b4689`.

Found on 2026-10-11 (UTC) in the read of TianqiChen66622,
where seats that threw on every call they were given were still asked by every later gather
and still counted in every quorum denominator,
so each gather waited on them and sized its quorum on a bench they could not fill.

The fix:
`seatTallyClient` (`seat-tally.ts`) takes a `minAsks` threshold
and refuses a seat the tally has withheld with `NoProviderForModelError` before the inner client is asked,
which every stage already reads as an unreachable seat;
a refusal is not an ask,
so it leaves the counts as they were.
The threshold is `SEAT_WITHHOLD_ASKS` in `stage-quorum.ts`,
`STAGE_RETRY_ROUNDS` plus one:
the most asks one gather gives a lost seat,
so a withheld seat has failed a whole gather's worth of asks rather than one round.
The quorum gather leaves withheld seats out of its bench and its denominator,
and each gather whose stage named a withheld seat warns which seats it did not ask and why.
The run's seat line names each withheld seat with how many of its asks threw.

Open to the owner's veto:
the threshold of four asks;
`runWindowedRounds`,
the judge benches and the floor checks do not filter withheld seats themselves,
and reach them only through the refusal.

## B421: a call the caller abandoned would have counted as the seat's failure

Red `2a049370cd`,
fixed in `06442b4689`.

Found on 2026-10-11 (UTC) in the lead's review of the B420 patch,
before it merged.
Every catch in `seatTallyClient` recorded `threw`,
so a call the caller aborted
(a straggler cut off after quorum,
a stage deadline,
an entry stop)
counted as the seat's own failure.
A slow but healthy seat cut off four times would then have been withheld for the whole run;
Kimi-K3 took 44 to 74 seconds to its first byte in TianqiChen66622,
which is that shape.

The fix:
a throw after the request's signal has aborted records nothing,
the treatment the tally already gave a call cut off when the process ends.
One case records nothing for four calls a caller aborted and that then threw,
and another withholds a seat whose four calls threw with the caller still waiting on each.
