# Audit ledger, part 44

Part 44 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B355: forms the combinator scan reads were not planted in its fixture

Planted in `d1e6af41c`,
coverage only,
passing before and after `ce2654b2c`.

Found on 2026-10-06 (UTC) by the review of the input-order change's second pass;
no defect.
`global`,
`globalThis['Promise']`,
the optional,
non-null and parenthesized callees,
a sequence callee,
a cast,
`.apply`,
`.bind` and a tagged template are now planted in the case "FINDS EVERY WAY",
each with its finding.
By the agent's measurement,
the scan before the change gave all 27 expected findings.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B356: declarations without TSDoc and parameter lines that said what, not why

Changed in `ce2654b2c`.

Found on 2026-10-06 (UTC) by the review of the input-order change's second pass.
Four destructurings and a loop's binding in the combinator scan had no TSDoc,
the example of `memberKeyOf` passed a value of another type than the node it takes,
and `@param` and `@returns` lines in the scan and in `corpus-run/bench-sample.ts` said what rather than why.
They now say why,
the example passes a `TreeNode`,
and the TSDoc of `printSkipLine` names `skippedAt` as the builder of its line.

Recurrence:
`mistake-prevention.md`,
"Lint and edits".

### B357: the prevention doc recorded neither the combinator scan nor the gather round's lost failure

Changed in `ce2654b2c`.

Found on 2026-10-06 (UTC) by the review of the input-order change's second pass.
The agent's report says no section of `mistake-prevention.md` covered concurrent work,
and it wrote a new one,
"Outcomes decided by which call ends first",
where "Output decided by arrival order" already held the family (B253,
B316,
B317).
At the merge the lead folded the new section into the existing one:
the bench draw's and the gather round's facts,
the rule that a combinator call outside the helper is listed with its reason and what holds it,
and the scan that enforces it,
rather than a second section on one rule.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B358: bounds on the real clock across the tests, which a loaded machine could outrun

Red in `1f983c322`,
fixed in `4cca8c301`.

Found on 2026-10-06 (UTC) by the census B340 left open,
after a 5,000 ms signal on a whole drive of scripted consolidation work ran out twice under load.
By the agent's census at its base `a7eca7f`,
the tests and fixtures set 976 bounds on the real clock in 194 files
(the argument of `AbortSignal.timeout`,
the delay of a timer or a sleep under any local name,
and twenty option keys production arms a timer with or compares elapsed time against):
948 outside seven files deferred to the changes in flight on them,
and 28 inside.
The lead's search for B340 had counted 604 sites in 138 files;
the agent could not reproduce that count,
and its closest pattern gave 683 lines in 144 files.
`real-clock-bounds.unit.test.ts` fails on each such bound that is not `HANG_STOP_MS` of `hang-stop.test-fixture.ts`,
unless it is listed with its class and reason or sits in a deferred file.
The agent's red at `a7eca7f`,
with an empty list,
gave 948 findings in 442 keys;
on main at `1f983c322` the package case fails with findings differing from the list,
which names the values the fix leaves.

The fix:
787 of the 948 bounds,
in 152 files,
read `HANG_STOP_MS`,
60,000 ms:
a stop for a case that hangs,
never a limit a passing case approaches.
158 stay,
each listed with a class and a reason:
33 a case reaches,
86 a case reads back
and 39 other.
Three sleeps that stood for ordering became gates.
The scan joins the source-scans task,
and "Tests on the real clock" carries the census and its classes.
By the agent's measurement,
no describe of the moved files grew by more than 0.8 s;
with the drive signal of `absolute-naturalness-review-stage` at the old 5,000 ms and every seat slowed by 5.1 s,
its cases fail with `TimeoutError`,
and at the hang stop they pass.
The agent measured and kept the meters and instruments that wait 10 or 20 ms:
with a hold of 1,000 microtask turns they all pass and with none they all fail,
so the overlap they hold for is in place within one turn of the event loop.
The holds in the budget's coalescing cases and the router's slot cases decide nothing,
since those cases pass with no hold,
and the windows moved to the hang stop in `stage-recovery-round`,
`stage-windowed-rounds`,
`naturalness-quorum-roundtrip` and two `stage-quorum` recovery cases pass at a window of 0.
The cases whose outcome depended on the clock are B359 to B363,
and B364 records what the census found about per-call deadlines.
Run on the merged tree before the commit:
lint clean,
49 scans passing,
and the suite at 2,027 passing with four cases failing,
the four B352 leaves open.

Open:
the seven deferred files,
28 reads,
wait for the changes in flight on them,
with each read's class in the agent's report;
two upper bounds on elapsed time in `stage-round.unit.test.ts`,
which the scan does not read and which load can break,
are left for the lead to restructure;
and the logger package's own sink verification bound of 5,000 ms timed out 34 times in the agent's suite run
without failing a case.
Closed since by B378 in `b7244804f`,
except the logger package's sink check,
which stays open.

Open to the owner's veto:
The name `HANG_STOP_MS`,
and a fixture file of its own for it.
Five drive signals of `CALL_TIMEOUT_MS * 8` collapse into one hang stop.
Bounds of 120,000 to 600,000 ms come down to 60,000.
The runner `timeout:` of `wall-clock-stub` rises from 10,000 and that of `pass-footnote-lifecycle` from 30,000,
both to 60,000.
Windows of 0,
50 and 60 ms move to the hang stop although they decide nothing at 0,
so a seat that ever stopped answering would hold its case for a minute.
`stage-call` keeps its 1,000 ms,
as a value read back.
Files are deferred whole rather than site by site.
Waits and overrides through environment strings are left out of the guard.
Guard keys use the nearest named function,
so identical forms in one function share a key and one class,
and the key of `SHORT_BOUND_MS` in `stream-bound` covers both a bound a case reaches and a record field.
The 150 ms pause of `gated-git` stays,
since a slow machine can only let its case pass without exercising the order it scripts,
never fail it.
The upper bounds of 880 s and 10 s in `transient-retry` stay.
The agent's report names no alternative for these choices beyond the one a "rather than" states.

Recurrence:
`mistake-prevention.md`,
"Tests on the real clock".

### B359: stalled seats in the quorum and refill cases raced a sleep against the clock

The guard's red is `1f983c322`,
and the cases changed in `4cca8c301`;
their red is the agent's control under a forced stall,
since the old cases pass when nothing stalls.

Found on 2026-10-06 (UTC) by the census of B358.
In `stage-quorum.unit.test.ts` the stalling seat slept 30 s,
and the cases "BOUNDS the recovery round" and "ABANDONS a voice" asserted elapsed time under 1,000 and 5,000 ms;
"still hears a voice INSIDE the grace" relied on a window of 2,000 ms.
In `stage-round-refill.unit.test.ts` the slow seat slept 1.5 s before the quorum,
for a round that must close on the others.
By the agent's controls,
with a synchronous busy loop standing in for a stalled process:
the old stalling case fails after a stall of 1.1 s,
the old refill case after a stall of 1.6 s before the quorum,
since the slow seat is then heard,
and the old grace case with its voice 2.1 s late;
each new shape passes under the same stall.

The fix:
the stalled seat waits on the abort,
records its reason and throws it,
and the cases assert what cut it
(`cuts` equal to `['AbortError: This operation was aborted']`,
and `cut` equal to `{ aborted: true, reason: 'AbortError: This operation was aborted' }`),
not the time spent;
the refill's slow seat waits on the abort and throws;
and the grace case's window is the hang stop,
which by the agent's measurement fails at a window of 0,
so the window is what keeps the voice.

Recurrence:
`mistake-prevention.md`,
"Tests on the real clock".

### B360: the lane-contest overlap case could pass without the finishing order it names

The guard's red is `1f983c322`,
and the case changed in `4cca8c301`;
its red is the agent's control.

Found on 2026-10-06 (UTC) by the census of B358.
`lane-contest-driver.unit.test.ts` ordered its overlapping slices by sleeps of 20 and 5 ms,
and asserted no finishing order.
By the agent's control,
a stall of 40 ms before the second slice's timer lets the first slice finish first,
and the old case still passed without exercising its order;
the old shape with the order assertion added fails,
and the new shape passes.

The fix:
the first slice's calls wait on a gate the second slice opens when every one of its calls has finished,
and the case asserts the finishing order,
the second slice's calls ahead of the first's.

Recurrence:
`mistake-prevention.md`,
"Tests on the real clock".

### B361: the bedrock per-attempt bound case raced each attempt against its own bound

The guard's red is `1f983c322`,
and the case changed in `4cca8c301`;
its red is the agent's control.

Found on 2026-10-06 (UTC) by the census of B358.
In `bedrock-client.unit.test.ts`,
"GIVES EACH ATTEMPT THE WHOLE STREAM BOUND",
each attempt slept 200 ms under a stream bound of 300 ms.
By the agent's control,
a stall of 150 ms fails the old case,
and the new one passes.

The fix:
both attempts answer at once,
and the time passes in the backoff between them,
whose base of 1,000 ms sleeps at least 500 ms,
longer than the bound,
so a bound armed once around the retry ladder has run out before the retry starts.
The case's name now says the retry is not cut by the time spent before it,
in the failed attempt or the backoff.

Open to the owner's veto:
The case waits in the backoff it names,
and its name changed.

Recurrence:
`mistake-prevention.md`,
"Tests on the real clock".

### B362: the synthetic client's case on arming the deadline inside the slot could not fail

The guard's red is `1f983c322`,
and the case changed in `4cca8c301`;
its red is the agent's control.

Found on 2026-10-06 (UTC) by the census of B358.
In `synthetic-client.unit.test.ts`,
"arms the exchange deadline inside the slot,
not at dispatch",
each of two calls slept 150 ms against a deadline of 220 ms,
and the transport ignored its signal,
so the case passed whichever way the deadline was armed.
By the agent's control,
the old case still passed with the deadline firing first.

The fix:
the first call holds the one slot for 300 ms,
the second waits in the queue past its 100 ms deadline and answers at once,
and the transport refuses an exchange whose signal has aborted.
By the agent's controls,
the new case passes,
and fails when the deadline counts from dispatch.

Open to the owner's veto:
The case was reshaped to mend a check that could not fail,
in a file the agent was already editing.

Recurrence:
`mistake-prevention.md`,
"Tests on the real clock" and "Guards that cannot fail".

### B363: the nesting differential timed its parses on the real clock

The guard's red is `1f983c322`,
and the case changed in `4cca8c301`;
its red is the agent's control.

Found on 2026-10-06 (UTC) by the census of B358.
`nesting-fence-differential.unit.test.ts` held each parse of a text the scan passes to 1,000 ms of real time,
which a process taken off the CPU mid-parse stretches without bound.
By the agent's control,
a wait of 1.1 s on `Atomics.wait` inside one parse fails the old case,
and the new one passes.

The fix:
the parse time is read with `process.cpuUsage`,
user and system time together,
and the limit's TSDoc says why.

Open to the owner's veto:
The parse limit is measured on CPU time.

Recurrence:
`mistake-prevention.md`,
"Tests on the real clock".

### B364: a per-call deadline handed to a stage over a hand-scripted client is never armed

The values moved in `4cca8c301`;
no case holds the finding.

Found on 2026-10-06 (UTC) by the agent of the census of B358.
Only the provider clients arm a per-call `exchangeTimeoutMs` or `perCallTimeoutMs`,
through `armCallDeadline`;
besides them,
only the pass entry's hard cap,
`model-health-probe`,
`provider-listing` and `translate-probe-run` arm a timer in production.
By the agent's controls,
`document-lanes` at its old per-call bound of 50 ms,
with every scripted call slowed by 60 ms,
still passed;
and with the deadline at 200 ms and the grace window at the hang stop,
a case ran 60.4 s and passed on the grace alone.
What fires in a test is a signal,
a cap,
a window or a stream bound that the test arms itself
or hands to production code that arms it;
by the agent's reading,
the failure of B340 was the whole drive's `AbortSignal.timeout(5_000)`.
So a per-call value a test hands to a stage over a scripted client bounds nothing.

The change:
those values moved to the hang stop anyway,
so a stage that comes to arm them waits a minute.

Open to the owner's veto:
Per-call deadlines that are never armed moved to the hang stop anyway.

Recurrence:
`mistake-prevention.md`,
"Tests on the real clock".

### B365: a stopped gather round logged a refusal by its class alone, or not at all

Red in `154da3c68`,
fixed in `fba9c5b60`.

Found on 2026-10-06 (UTC) by the gate on `ce2654b2c`,
which failed four cases the credential work had added,
each pinning the provider's words in the line a stop writes (ledger B352).
`nextSettled` (`stage-round.ts`) threw the caller's reason in place of the ask's failure,
so the catch sites printed the reason alone,
and it logged the failure it replaced through `refusalText`,
which names the class and drops the status and the provider's words.
By the agent's probe on the build of `4cca8c301`,
whose production source is that of `ce2654b2c`,
the refine,
slice-buy,
translate and pick paths each wrote `refused by SyntheticHttpError` and nothing of the reply.
The cause went beyond the lead's reading:
the round logged only the rejection that ended first,
so a refusal ending after an ask that ended in the caller's own reason reached no line,
which lost the words before `ce2654b2c` too;
and a stop after quorum stood let the wait on the grace window swallow each failure unlogged,
in `settleWithin(Promise.allSettled(asks))`.
The red commit fails eight cases against the stage round of `ce2654b2c`,
run on `4cca8c301` with the production code unchanged:
the four gate cases,
renamed so each name states what it checks,
each asserting every line its call writes;
and four cases of `runGatherRound`,
each failing on the line it asserts whole:
a refusal ending before an ask that ended in the caller's reason,
a refusal ending after such an ask,
a refusal ending after quorum stood,
and the updated pin on the failure that ends after the round rejected.
The reason assertion of every case passes.

The fix:
`askOnce` writes the call's own failure when the caller has aborted and the failure is not the caller's reason,
through `exchangeFailureLogText` with the seat's name,
then rethrows as before;
`nextSettled` keeps only the substitution of the caller's reason,
and loses its stage and logger parameters,
as `awaitHeard` does.
The five catch sites are unchanged.
Each failure is written once,
by the ask that owns it,
as it ends,
whichever order the asks end in.
The new cases bound their rounds with the hang stop and wait one turn of the event loop.
Since the line moved to `askOnce`,
B352's choice of a line tagged `nextSettled` no longer describes the code.
Run on the merged tree before the fix commit:
lint clean,
49 scans passing,
and the suite at 2,028 passing with no failure.

Open:
`repairInvalidCandidates` (`translate-repair.ts`) reads its re-asks through `allInInputOrder`,
so when two invalid candidates' re-asks both fail as the caller stops,
only the first failure in input order reaches the catch site,
and the other reaches no line;
this is the agent's reading,
not run.
It waits for a GitHub issue or a later change.
Closed in B403,
which ran it.
`runPick` under a stop still prints its slice as refused by `AbortError` and returns `refused`,
unchanged from the base,
which tells a log reader the stop ended the arms.

Open to the owner's veto:
The translate case shows three lines of the provider's words,
one per seat,
because its scripted client throws the same refusal from every call,
where a real client forwards the already aborted reason after the first
(the agent's inference from `call-deadline.ts`,
not measured);
the alternative is a client in that case that throws `request.signal.reason` once its signal has aborted,
a change of one line.
Deduplicating the lines by the thrown object's identity was rejected,
since the seat a line names would then depend on arrival order.
The stage-round test file runs its top-level describe with `concurrency: 1`,
since its timing case failed in 2 of 4 runs beside the new cases and passed in 5 of 5 after,
a cause the agent infers,
with the base's spread from run to run unmeasured;
the report names no alternative.
Lines appear in the order the asks end,
so in production a seat's line can land after the catch site's line;
the report names no alternative.
The four gate cases were renamed so each name states what it checks,
and each asserts the whole list of lines;
the report names no alternative.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B366: the runner observations change met main's rewrite of its files when it was ported

Red in `bb2a8b9ad1e164974e54d2750432a25b267ef0de`,
fixed in `cfac5b981`.

Found on 2026-10-10 (UTC) by the agent porting the runner observations change onto `4cca8c301`,
from its base `f3c2bae13`.
Of the change's 77 modified files,
15 had changed on main,
and three conflicted.
`corpus-run/bench-sample.ts` conflicted because main had replaced `sliceOne`,
which held the change's only hunk there,
with `textOf`,
`pageOf` and `stepOf` under `allInInputOrder`;
main's file was kept,
and the change's rule moved into `textOf` (B367).
`corpus-git-context.ts` conflicted on two TSDoc paragraphs added at one place,
main's on `LC_ALL` and the change's on `GIT_CEILING_DIRECTORIES`,
and both were kept;
`corpus-run/bench-sample-draw.unit.test.ts` conflicted where both sides appended cases,
and the clean part of its merge doubled an import.
Four more broke on main's code with no conflict marker:
main's case of `corpus-git-context` called the builder without `cloneDir`,
which the type check found;
main's `ordered-page-reads.test-fixture.ts` built a `CorpusReadError` without the `commit` the change requires;
two of main's `rendering-audit-settled-input` cases named a lacked commit while expecting `missing-object`;
and main's bench draw cases read one remedy where the change gives two.
On the port build,
by the agent's run,
61 of 62 named test files passed,
and the one holding the change's own case on a lost object failed as expected,
since that case needs the rethrow of B367.
The red commit fails 51 of the 65 named test files
against `4cca8c301`'s production code plus the fix of `fba9c5b60`,
four of them without running a case,
since they import exports the fix adds
(`code-points`,
`corpus-git-context`,
`editor-calibrate-standing` and the new `editor-standing-absence`);
the other 14 pass either way,
and the red commit leaves the type check failing on those exports.

The fix:
the fixture takes `commit` from its case,
the two settled-input cases expect `missing-commit`,
and `CLONE_ADVICE` is split into `ABSENT_PAGE_ADVICE` and `OTHER_FAILURE_ADVICE`,
with the findings of the review of the change fixed beside the port (B367 to B377).
`corpus-source.ts` and `editor-standing-read.ts` went over the line cap,
so the commit probe moved to `corpus-commit-probe.ts`
and `noJudgedRoundLine` to `corpus-run/editor-standing-absence.ts`,
each with a test file of its own;
two barrel lines export `gitSearchCeiling` and `noJudgedRoundLine` for tests.
Run on the merged tree before the fix commit:
lint clean,
49 scans passing,
and the suite at 2,030 passing with no failure.

Open to the owner's veto:
The DONE line gains `declined=`,
the `--only` parenthetical and one more English read per finished entry;
the report names no alternative.
`countSettled` and `judgedAuthors` are removed;
the report names no alternative.
The two splits at the line cap add the modules `corpus-commit-probe.ts` and `corpus-run/editor-standing-absence.ts`;
the report names no alternative.

Recurrence:
`mistake-prevention.md`,
"Lint and edits".

### B367: the bench draw decided between a skip and a refusal by which read ended first

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

### B368: the republish case accepted either page

Pinned in `bb2a8b9ad1e164974e54d2750432a25b267ef0de`,
whose change is fixed in `cfac5b981`;
nothing at the red commit can fail the case,
since main's `readPinnedPair` already reads in input order,
so its red is the agent's mutant.

Found on 2026-10-06 (UTC) by the review of the runner observations change,
its second finding.
The pass republish case read the page name it expected from the output it was checking,
so it passed whichever page the `REPUBLISH LEFT` line named.
It now expects `page.md`,
the original page,
and its name says so.
By the agent's mutant,
which lists `page.en.md` first in `readPinnedPair`,
the case fails,
as does the case writing the missing page,
since the swap trades source and target;
the file was restored and checked unchanged with `git diff --quiet`.

Open to the owner's veto:
The `REPUBLISH LEFT` line keeps its shape and its `because=refused by <Class>`,
and now always names `page.md` when both pages fail;
the report names no alternative.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail".

### B369: a clone directory that is itself a link escaped git's search ceiling

Red in `bb2a8b9ad1e164974e54d2750432a25b267ef0de`,
fixed in `cfac5b981`.

Found on 2026-10-06 (UTC) by the review of the runner observations change,
its third finding,
and measured with git 2.55 by the agent porting it.
`GIT_CEILING_DIRECTORIES` held the parent of the clone directory as named,
while git compares the list with its real working directory,
so a clone directory that is a link to a plain directory inside a repository read that repository's page.
By the agent's run on the port build,
the corpus-source case on such a link fails,
the read returning where it should refuse;
and at the environment level,
before the interface changed,
the ceiling held the scratch directory where the case expected the link's real parent.

The fix:
`gitSearchCeiling({ cloneDir })` in `corpus-git-context.ts` returns the parent of the clone's real path,
and falls back to the parent of the path as named only for `ENOENT`,
`ENOTDIR`,
`EACCES` and `ELOOP`,
each of which ends git at its own `-C` with exit 128,
by the agent's probe;
any other failure of `realpath` is rethrown.
The keyless scan requires every spawn to build its environment inline,
which a first asynchronous version failed,
so `corpusGitEnvironment` stays synchronous and takes `{ searchCeiling }`,
which every read in `corpus-source.ts` resolves before its `try`.
A new case pins the fallback for a clone directory that does not exist,
and the TSDoc sentence saying git resolves a link in the list is corrected.

Open to the owner's veto:
The fallback covers four codes;
the alternative is the review's,
`ENOENT` alone,
where the agent measured the other three ending git at its own `-C` as well.
`unreadable-clone` covers an enclosed directory,
and now also a clone directory that is a link to one;
the report names no alternative.
A failure of `realpath` outside the four measured codes surfaces as a fault at exit 5,
not as `unreadable-clone`;
the report names no alternative.
`corpusGitEnvironment` takes `{ searchCeiling }` and `gitSearchCeiling` is exported;
the alternative is the merge plan's note to pass `{ cloneDir }`,
which this supersedes.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B370: a parent path holding a colon voided git's search ceiling

Red in `bb2a8b9ad1e164974e54d2750432a25b267ef0de`,
fixed in `cfac5b981`.

Found on 2026-10-06 (UTC) by the review of the runner observations change,
its fourth finding.
Git splits its ceiling list at colons,
so by the agent's probe a plain directory under `a:b` read the enclosing repository,
and a page absent there read as git's words for a missing object;
a link to that directory keeps the colon in its real path,
and a real clone under `c:d` reads correctly without the ceiling.
By the agent's run on the port build,
the case reading a page,
its bytes and a listing under such a parent fails,
each read returning where it should refuse.

The fix:
`gitSearchCeiling` throws a `StatedRefusalError` before any git call
when the real parent path holds a colon,
naming the clone and the parent,
and saying to move the clone to a directory whose path holds no colon.
`doc/configuration.md` says so beside `TRANSLATION_REPAIR_CORPUS_CLONE_DIR`.

Open to the owner's veto:
The refusal says to move the clone only;
the alternative is the review's remedy,
to move or link it,
where by the agent's measurement a link keeps the colon in the real path.
A clone whose real parent path holds a colon is refused as stated,
working clones there included,
by the agent's measurement;
the report names no alternative.
The paragraph in `doc/configuration.md` goes beyond what the review asked and was kept,
lint clean;
the alternative is to drop it.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B371: exit 128 read as a clone git could not open

Red in `bb2a8b9ad1e164974e54d2750432a25b267ef0de`,
fixed in `cfac5b981`.

Found on 2026-10-06 (UTC) by the review of the runner observations change,
its fifth finding.
By the agent's probe with a corrupt commit object,
`show`,
the commit probe and `ls-tree` all exit 128 with `inflate: data stream error`,
while `rev-parse --git-dir` exits 0 there,
and 128 for a plain or a missing directory.
The reader took the probe's 128 as a clone git could not open,
and the refusal told the operator to check that the directory is a repository.
By the agent's run on the port build,
the case naming a commit git cannot inflate in a clone it opens fails,
reading `unreadable-clone` where it expects `other`.

The fix:
on a commit probe's exit of 128,
`probeGitDir` asks for the git directory:
128 means `unopened`;
0 means `unasked` keeping the 128 failure,
so the kind is `other`;
and any other failure means `unasked` with both failures.
The `unasked` arm carries its failures,
and the TSDoc of `unreadable-clone`,
`unopened`,
`unasked`,
`GIT_FATAL` and the probe says what 128 means.
The `AggregateError` now reads "the corpus read failed,
and the probe of its commit got no answer about it",
since its old wording,
that the probe got no exit status it reads,
became false;
two stand-in git cases changed on that sentence alone.

Open to the owner's veto:
The remedy wordings are unchanged,
and a clone git opens but cannot read is now `other`,
whose remedy is to run the same git read by hand;
the alternative is the old kind,
`unreadable-clone`.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries".

### B372: the standing reader counted no digest whose rounds drew no ballot

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
