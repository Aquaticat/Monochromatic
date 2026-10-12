# Audit ledger, part 50

Part 50 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Process mistakes in this audit, continued

### M82: commit scopes written as `translation-repair`, not the package's name

Status:
happened throughout the audit,
caught 2026-09-30 (UTC) while writing the ninth batch's record.
The repository's commit rule takes the scope from the package name less `@monochromatic-dev/`,
and `package.json` names this package `@monochromatic-dev/module-translation-repair`,
so the scope is `module-translation-repair`.
Of the last 400 subjects on the branch,
245 used `translation-repair` and 131 `module-translation-repair`
(`git log --format=%s --max-count=400`,
counted by type and scope);
the ninth batch's first eleven commits,
`8536b28e1` to `9e7469896`,
all used the short form,
and its last seven the full one.
No doc in the package or the handover prescribes the short form.
Nothing reads the scope,
so no commit is wrong in what it says,
and none is amended.
Prevention:
a commit's scope is read off `package.json`'s `name` before the first commit of a session,
and a message file is checked for it with the `#` and task-number checks.

### M83: a lint's findings left unread because the command printed its log only on failure

Status:
happened 2026-09-30 (UTC) during the ninth batch's `51b888ac2`,
caught before the commit,
and first misdiagnosed.
The Markdown lint of `doc/slice-context.md` ran as `astral-safe-lint.mjs <path> > <log> || tail <log>`,
the shape every build and lint command in this audit takes.
`astral-safe-lint.mjs` exits 0 whatever it finds,
so the `tail` never ran,
and its log,
which read `semantic-line-breaks 3`,
went unread.
The run was then taken for one against the main checkout,
since the shell starts every command there and this one had no `cd`,
and it was run again from the worktree;
that run's three findings were fixed before the commit.
The diagnosis was wrong:
the wrapper joins every path onto the worktree root (its `repo` constant),
the main checkout holds no such file,
and the first run had linted the edited file.
The ninth batch's record first carried the wrong diagnosis as this entry;
it was corrected before commit by reading the first log and the wrapper.
Prevention:
a tool that exits 0 with findings is read by its output,
not its exit status
(`astral-safe-lint.mjs`,
the census,
`run-guards-named.ts`):
its log is printed or searched every time,
and a diagnosis of why a run misread is checked against the tool's source before it is written down.

### M84: a value quoted from memory in a message, and again in its correction

Status:
happened 2026-09-30 (UTC) in `65deb5167`'s message,
found the same day while drafting B66's entry,
and corrected by a comment on that commit,
whose first wording was wrong as well and was edited within minutes.
The message quoted the lane contest's finding as "below the 3 needed";
`LANE_CONTEST_QUORUM` is 2 (`lane-contest-stage.ts` line 49).
The comment first said the 3 belonged to the polish gate's twin of the finding;
`CONSOLIDATION_POLISH_GATE_QUORUM` is 2 as well (`consolidation-polish-gate-stage.ts` line 31),
and it was read only after the comment was posted.
M77's rule,
that a class a message names is read from the code,
covers a constant too,
and neither text applied it.
Prevention:
a constant a message or a comment names is read from its declaration in a command before the text is written,
and a correction is held to the rule it corrects.

### M85: a refusal case rewritten to name its side, checking less than it did

Status:
happened 2026-09-30 (UTC) while writing T8's sixteenth batch,
found the same day reading the diff before `c2974bea9`,
and corrected in that commit.
The block-pairing reader's out-of-range case asserted `toThrow(BlockPairingError)` on the original side.
Rewritten to cover both sides and name each,
it asserted `toThrow` with each message instead,
and module-test hands a string straight to chai's `.throw`
(`package/module/test/src/expect-matchers-core.ts` lines 138-140),
which checks only that the message contains it
(`compatibleMessage` in chai 6.2.2's `index.js`,
lines 80-81).
The class was left unchecked,
though `readBlockPairingOutcomes` records only a `BlockPairingError` as an unusable reply
and rethrows any other.
The rule in `doc/mistake-prevention.md`,
that a refusal case checks the message beside the class,
was not applied to the rewrite.
Prevention:
a rewritten assertion is compared with the one it replaces,
and a matcher that takes a class or a text checks one of them only,
so a refusal is caught with `caught`,
then checked with `toBeInstanceOf` and with `caughtValueText` whole.

### M86: a short-bench case sized from a quorum not read

Status:
happened 2026-09-30 (UTC) while writing T8's sixteenth batch,
found on the first run of both short-bench cases,
and corrected before `c2974bea9`.
Both cases refused two seats of four and expected a short bench;
`rosterQuorumSize` is half the bench rounded up
(`roster-quorum-size.ts` line 20),
so two of four is a quorum,
and each case failed at its own premise,
`expect(quorum.short).toBe(true)`,
before reaching the stage.
The benches are now five seats refusing all but `MIN_STAGE_VOICES`.
Prevention:
a fixture's size is taken from the rule it must cross,
read in the code before the fixture is written,
and the case keeps asserting its premise from the exported helper,
which is what caught this.

### M87: a test's idiom moved into a fixture file that lints as source

Status:
happened 2026-09-30 (UTC) while writing T8's sixteenth batch,
found by the package lint before `c2974bea9`,
and corrected in that commit.
The short-bench client came from a copy in a unit test,
written with arrow functions and `async` bodies without `await`.
Moved into `refusing-seats-client.test-fixture.ts`,
it drew three `no-arrow-function` errors and six `require-await` warnings:
the shared lint config relaxes those rules only for `**/*.{test,bench}.ts`
(`testOverride` in `package/config/oxlint/src/overrides.ts`),
so a `*.test-fixture.ts` file is held to the source rules.
Prevention:
code moved from a test into a fixture follows an existing fixture's idiom
(`archive-selection.test-fixture.ts` for a scripted client),
and the lint runs before the move is used.

### M88: shared readers extracted with no unit test of their own

Status:
happened 2026-10-01 (UTC) in `f0bad6d25`,
found the same day reading the prevention doc against B72's census,
and corrected in `3429c8229`.
`f0bad6d25` moved `treeNodes` into `mdast-tree-nodes.ts`
and wrote `emphasisSpans` and `oneLine` into `corpus-run/emphasis-spans.ts`,
each with two callers,
and tested them only through the italic-title pass and the formula floor.
The prevention doc's rule that a shared reader gets a unit test of its own when it is extracted
stood under "Text by code point",
where a reader of structure is not looked for.
Writing those tests found `oneLine`'s TSDoc saying every whitespace run reads as one space,
where the code folds the space and the line feed alone (ledger B72).
A probe at `3429c8229`
(`shared-untested-probe.mjs`,
its control `code-points.ts` read as tested)
counts 167 of the 562 production modules imported by two or more others,
barrels aside,
with no unit test file of their own.
Prevention:
the rule now stands under "Copies of shared code",
where moving a helper is looked for;
a source scan failing on a new shared module without its own test,
over a classified list of the 167,
is open.

### M89: a guard-off build whose last mutant's case never ran

Status:
happened 2026-10-01 (UTC) during B72's reader tests,
found reading the run's output,
and corrected by a second build.
One build carried three mutants:
`treeNodes` made recursive,
`emphasisSpans` parsing strictly
and `oneLine` folding every whitespace character.
The last one's case sits in `oneLine`'s suite,
the second top-level `describe` of `emphasis-spans.unit.test.ts`.
Each test file awaits its suites at the top level,
and a suite with a failing case rejects,
so the file stopped after its first suite failed,
and the `oneLine` case never ran;
the harness prints a line per failing case and per passing suite,
so it printed nothing for that case or its suite.
A second build with that mutant alone failed the case.
Prevention:
a guard-off build mutates cases in one top-level suite per file,
and a mutant whose case prints no FAIL line is read as surviving
only once that case's suite is seen to have run.

### M90: a census probe narrower than the family it counted

Status:
happened 2026-10-01 (UTC) during B73,
found the same day writing the guard from it,
before any fix rested on its count.
`number-reads-probe.mjs` counted calls of `Number`,
`parseInt`,
`parseFloat`,
`BigInt` and the two `Number` members,
and unary plus:
35 keys over 1,075 production files.
It did not look for a reader handed on as a value (`.map(Number)`),
nor for `Date.parse` and `new Date`,
which read numbers out of text the same way.
A search for `Number` as an argument found two,
`admitWithinShortfall`'s callers reading back positions written as text,
and a search for date parsing found four,
three of them log-stamp readers that took a stamp without its zone as local time (ledger B73).
Prevention:
before counting a family,
list every way the language reaches the behaviour
(a call,
a construction,
a value handed on,
a coercion)
and every function with the same behaviour on another type;
the guard then says which it reads and which it leaves out of reach.

### M91: a veto-open call about a writer's output made from the fixtures

Status:
happened 2026-10-01 (UTC) in `65dd1e6a8`,
found 13 minutes later measuring the stored listings,
and reversed in `ee2d57372` and `0ebf573a3`.
`65dd1e6a8` refused an exponent in a listing price,
calling it a veto-open call on the ground that the fixtures copy listings that write plain decimals.
The fixtures are this package's copies,
not the providers' output:
over the 28 stored listings,
LLM Gateway's catalogue writes `0.042e-6` twice,
a real price the rule left unlisted (ledger B73).
Prevention:
a call about what a writer writes is measured over that writer's stored output before it is made,
with a control the measurement must flag,
and the commit cites the measurement,
never the fixtures.

### M92: commands outside the repository's shell rules

Status:
happened 2026-10-01 (UTC) during B73,
twice,
with no wrong outcome landing.
A read-only listing of the package's docs ran two commands chained with `;`,
against rule 1CB in `AGENTS.md`.
And a commit ran from the package directory,
which `git-policy-cli` refused (`require-root/not-at-root`);
it was rerun from the worktree root with the same paths and message.
Prevention:
a shell call chains at most three steps with `&&` and reports with `||`;
`git` runs from the worktree root,
with paths relative to it,
read from a list file where they are many.

Recurred 2026-10-01 (UTC) after T8's twenty-first batch,
with no wrong outcome landing:
the source scans for the B86 readers note ran without pinning the worktree,
from the main checkout the shell returns to after each call,
where `mise` has no such task and exited 1 before any scan ran.
The log was read as that,
not as a scan result,
and the scans ran again from the worktree root.
The prevention stands:
every shell call names its directory,
a `mise run` included.

### M93: line numbers for in-place edits worked out rather than read

Status:
happened 2026-10-01 (UTC) during B75,
three times,
each seen in the diff before any commit and restored.
Inserting `argv: process.argv` and doc lines across the runner entries with `sed --in-place`,
line numbers were worked out from offsets and from listings taken before an insertion higher in the same file:
`sentinel-probe.ts` had its doc comment garbled
(rewritten through the scratch `replace-lines.mjs`),
`coverage-census.ts` had an `@param` placed in the wrong comment and a line written over
(restored),
and a delete in `score-probe.ts` took one line more than meant,
the opening of a doc comment
(restored).
Prevention:
a line number for an in-place edit is read from `rg --line-number '' <file> | sed --quiet 'A,Bp'`
taken just before the edit,
one file per call;
after an insertion,
the numbers below it are read again rather than shifted by hand.

Recurred 2026-10-01 (UTC) in T8's twenty-first batch,
on a scratch probe rather than a package file:
a `sed --in-place` aimed at the probe's `require` line took line 9 from memory,
where line 9 opened a doc comment,
and garbled it;
the tool's own diff showed it and the next call restored both lines.
The prevention stands,
scratch files included.

### M94: a commit message draft naming a lint finding at a commit that did not raise it

Status:
happened 2026-10-01 (UTC) during B75,
caught before the commit.
The draft of `1f37aa07d`'s message said max-lines fired at `97aeee2ca`;
the reader passed max-lines' 300 counted lines only once `1f37aa07d` itself laid it out one element per line,
and the message was rewritten to say so.
Prevention:
a message's claim about what a tool reported at a commit names the run that printed it,
as every claim in a message is command output or a labelled inference.

### M95: scratch readers of lint output that could miss a finding

Status:
happened 2026-10-01 (UTC) during B75,
twice,
with no finding missed.
The scratch `lint-findings.mjs` paired findings with locations through a pattern written with a Unicode dash
where oxlint prints an ASCII one,
so it could match no location line;
it was corrected to `,-\[`.
And the summary check `rg 'Found [0-9]+ warnings'` cannot match oxlint's singular
"Found 1 warning and 0 errors.";
on the one run that printed it,
the findings reader showed the warning and the summary check printed nothing,
which was read back from the log before it was fixed.
Prevention:
the summary is read with `warnings?`,
and the findings list and the summary are read together,
each a check on the other.

### M96: a scratch sweep that walked directories without bound

Status:
happened 2026-10-01 (UTC) during B75;
stopped by its process id,
nothing written.
A scratch sweep of documented runner invocations listed Markdown files by walking the package and `doc/` with a recursive `readdirSync`;
it ran 16 minutes and held 6.7 GB resident before it was stopped,
and no output it gave was used.
The rewrite lists tracked Markdown through `git ls-files`
and caps the V8 heap at 512 MB,
and read 1,184 files in one run.
Prevention:
a scratch scan lists its files from git's index,
or walks with a bound that skips `node_modules`,
and runs with a heap cap (`--max-old-space-size`),
since repository rule RXI asks host-exhausting work to run bounded;
a scan that runs past its expected time is checked once by process status.

### M97: a red case hidden behind another suite's failure in the same file

Status:
happened 2026-10-01 (UTC) while writing B77's red cases,
found when the run printed no line at all for one suite,
and fixed before the red commit (`42eb0b0dd`).
`judge-crosscheck.unit.test.ts` awaited two suites at the top level.
The census suite's new red cases failed,
so that suite rejected and the file stopped before the `statusBreakdown` suite ran:
its red case printed neither a FAIL line nor its suite's PASS line,
and could not be seen failing.
The two suites now sit under one root `describe`
(the `json-guard.unit.test.ts` pattern),
and a direct run failed exactly the two new cases with every other case passing.
This is M89's mechanism met on the red side:
there a guard-off mutant's case never ran,
here a red case never ran.
Prevention:
a red case counts as red only from its own FAIL line;
a file awaiting several suites at the top level is wrapped in one root `describe`
before a case is added to any suite but the first,
and the package's other such files are queued as a family of their own.

### M98: a source scan written without listing the forms of what it scans for

Status:
happened 2026-10-01 (UTC) during B77,
twice,
the first caught before the scan's commit and the second after it,
with no fix resting on either.
Drafted,
the text-keyed table scan read a `satisfies` as typing a table with string keys.
A `satisfies` checks without widening,
so the keys stay the literal's own and a lookup by unchecked text does not compile;
the draft flagged tables the compiler already held,
`CLAIM_BY_ROLE` among them.
Committed (`f0322ce6f`),
it read a parameter as typed with string keys only when the parameter was a name annotated in place,
and missed one destructured from an object,
the form every function of two or more parameters takes here.
Moving the attempt count into `countAttempt({ attempts, id })` dropped the package findings from 36 to 35 with the write still there,
which is how the gap showed,
and `98f5b8861` closed it.
M90's family,
met again in a guard's scan.
Prevention:
before a scan is written,
list every way the language declares the shape it looks for
(an annotation,
a cast,
a `satisfies`,
an alias,
a parameter named,
destructured or defaulted)
and say for each whether it gives the shape;
the fixture holds one of each,
and a count that moves when code moves without changing what it does is read as a gap in the scan.

### M99: a search whose pattern was refused, read through its fallback as finding nothing

Status:
happened 2026-10-01 (UTC) during B77,
caught before any conclusion rested on it.
A search for casts used a lookahead,
which `rg`'s default regex engine refuses,
and the call's `|| echo` fallback said no casts were found,
printing for the refused pattern exactly as it would for an empty search.
The search was rerun with `--pcre2`,
then replaced by a typed probe (`~/temp/agent/audit-glossary-fix/b486-casts.mjs`).
Prevention:
a fallback report names the exit status (`|| echo "exit $?"`),
since `rg` exits 1 for no match and 2 for an error,
and a null is read only with the command's error output in view.

### M100: a test fixture that replaced a process global while the runner ran cases side by side

Status:
happened 2026-10-01 (UTC) during B78,
found by B78's first guard-off,
and fixed in `b1604a2f8`.
`wall-clock-stub.test-fixture.ts`,
as B78's red commit wrote it,
replaced `Date.now` for the whole process while a case held it.
It was written without reading how module-test schedules cases:
a suite runs its children side by side,
sixteen at a time by default (`package/module/test/src/describe.ts`).
The fix commit's checks passed,
since on the fixed tree no package code reads `Date.now`;
the logger does,
for its stamps (`package/module/logger/src/create-logger.ts`),
so a sibling's log lines during a stub window carried the stepped time,
as the FAIL lines of the fixture's own guard-offs show (`2026-09-30T23:00:00.000Z`).
The first guard-off of B78 (`monotonicMs` reading `Date.now`) showed the cost:
`request-pace.unit.test.ts` printed its B78 case's FAIL line and then did not exit;
the guard runner waited on it for eleven minutes until it was killed by hand,
and run alone it stalled again after three PASS lines.
The mechanism is an inference,
not confirmed:
a real-clock pacer case beside the stepped one read the stubbed clock,
about eight hours behind the real one,
and its pace loop slept toward that.
A regression back to the system clock would have hung the whole suite rather than failed it.

The stub now goes through the case's own sandbox,
`ctx.sinon.stub(Date, 'now')`,
which module-test answers only to code running in the owning case's async context
and restores when the case ends (`sandbox-slot.ts`,
`execution-node.ts`).
`wall-clock-stub.unit.test.ts` holds a stepping case and a sibling that waits for it,
and the sibling,
bracketing its read with `new Date()` stamps,
reads the real clock.
Guard-offs on the fixed fixture,
restored with `git diff` printing nothing after:
an added process-wide assignment beside the sandbox stub was refused by the sandbox once another case's stub was live
(`SandboxOwnershipError`),
so the stepping case failed and its sibling timed out,
the wrong route;
with the sandbox stub replaced by the plain assignment,
the sibling failed its own assertion,
its read sorting as `2026-09-30T23:00:00.000Z` ahead of the real stamps.
With the stub scoped,
the first guard-off of B78 rerun exited every file with its FAIL lines.
The scratch guard runner (`~/temp/agent/audit-glossary-fix/run-guards-named.ts`) now ends a file after 300 s and prints that it did.

Prevention:
before a fixture replaces a global,
read how the runner schedules cases,
and scope the replacement to its case (module-test's `ctx.sinon` for a method)
or sequence the cases that share it;
a guard-off whose process does not exit is a finding of its own,
and a guard runner bounds each file.
The package's other tests that replace process globals
(`process.env` variables,
`console` methods,
`process.exitCode`),
in 29 files by one search,
were classified and fixed as B79.
17 of those files already set `concurrency: 1` on at least one suite,
several with a comment giving this reason
(`cli-refusal`,
`slice-cache-discard-log`,
`rendering-audit-settled-print`),
so the package knew the hazard;
no doc stated it,
and the stub was written without reading those files either.
The prevention doc's "Globals a case replaces" now states it.

### M101: a turn ended on a status report while the batch was still open

Status:
happened 2026-10-01 (UTC) at the close of T8's nineteenth batch,
caught by the owner asking whether the work would go on.
With the fix,
the frame case,
the ledger record
and the prevention section committed (`729312bb4`),
the turn ended on a summary that listed the open steps itself:
`status.md`,
the handover,
the full suite
and the twentieth batch.
It gave a shrinking context window as the reason,
though the harness summarizes a long session and work continues after it.
The same stop happened once before in this audit,
and the owner's answer then was to tighten the rule against it.
Prevention:
a turn ends only when the tracked queue is empty or a step needs the owner;
a shrinking context is handled by committing and going on,
and a summary that names a next step the agent could take itself is the sign it must not stop.

### M102: a commit message saying a case reached an arm before any census showed it

Status:
happened 2026-10-01 (UTC) in T8's twenty-first batch,
caught by the next census,
corrected by a comment on the commit and by `9244d67d3`.
`c17feba5b`'s message said its tail case reached both `sharedPrefixLength` running to the end of the shorter text
and `sharedSuffixLength` using all its room.
`census-Yh15Hq` at that commit still listed the second as cold:
the case's break sits in the shared prefix,
so `assembledOffsetOf` returns before the suffix is measured.
The claim came from reading the case against the code,
not from a run.
Prevention:
a message or record says a case reaches a stretch only after a census
(or a coverage read of that file) shows the stretch ran;
before that it says which stretch the case is written for.

Recurred the same day in the commit recording the batch's full suite:
its message file,
stating the source scans' result of 23 PASS lines and no FAIL line,
was written in the same parallel call that counted them.
The counts matched before the commit ran,
but the claim was written ahead of its evidence.
The prevention covers any count a message states:
the message is written after the call that shows the count returns.

### M103: TSDoc blank lines written in the form their file does not use

Status:
happened 2026-10-01 (UTC) in T8's twenty-second batch,
found before the third commit of the batch's fixes and corrected in it.
`anthropic-completion.ts` writes every blank line inside a TSDoc block as one space;
the blocks written by `33bffdb7b` and `08f56f71e` used empty ones,
34 of them in the file at `08f56f71e` beside 20 spaced,
and the lint and the source scans pass either form.
The same slip was corrected once before,
in `d811fcf2b`,
where the edit tool had dropped the spaces.
It is the cause again:
the B90 fix's TSDoc for `completion-shape.ts` was written with one-space blank lines
and landed with 6 empty ones,
so a line holding only a space does not survive the edit tool.
Prevention:
before committing a file whose TSDoc changed,
count its blank lines inside TSDoc blocks by form and keep the one the file used.
A source scan holding each file to one form would make this a check rather than a habit;
none is written yet,
and 264 of the package's 2,017 TypeScript files under `src` mixed the two forms when this was recorded.

The check held for the rest of the batch:
before the B93 and B94 fix commits it found 4,
4 and 7 empty lines the edit tool had left
and restored them.

### M104: a read of red runs that missed a case whose line was cut before its marker

Status:
happened 2026-10-01 (UTC) in T8's twenty-second batch,
found in a guard-off log,
and the runner fixed the same day.
The scratch runner of named tests (`~/temp/agent/audit-glossary-fix/run-guards-named.ts`)
prints each line holding `[FAIL]`,
cut to 400 characters.
A case whose name ran past the cut lost its own marker,
and the reads searched for that marker,
so they skipped the line.
B88's guard-off printed three lines and the read showed two;
the count in the file's header line gave it away.
Across the 420 runner logs then in that folder,
16 printed lines in 14 logs had lost the marker
(`~/temp/agent/audit-glossary-fix/b22-cut-marker-census.mjs`).
Every log still printed the file's count of such lines in its header.
Two of the runs were traced to their messages:
B84's red message cites the suite's own "2 children failed",
and B88's red message names all three lines.
The other twelve were not traced.
Prevention:
the runner now prints `FAILED: ` before every line it keeps,
so the marker survives the cut,
and a red run is read by that prefix and checked against the header's count.

### M105: a commit across 139 sources verified by named test files alone

Status:
happened 2026-10-01 (UTC) in `de323fc97` (B98),
found by the next full suite,
fixed in the commit adding this entry
and corrected by a comment on `de323fc97`.
B98 chose the noun after `corpus-run/bench-report.ts`'s slice count by the count,
so a group of one slice now prints "1 slice".
`corpus-run/bench-report-groups.unit.test.ts` cut each summary line at " slices"
and expected the bare count,
so its group of one cut nothing and the case failed.
The commit's runs were the test files its list named,
and the list did not name that file;
its message called them "the 21 test files the change touches",
which reads as every test file reaching the change.
The case now cuts at the line's parenthesis and expects the noun with its count,
so it also holds the group of one to the singular.
Prevention:
a change across many sources runs the full suite before its commit,
and a message names a named-file run as the files it lists,
never as the files the change reaches.

### M106: a commit message reporting a clean Markdown lint the committed ledger failed

Status:
happened 2026-10-01 (UTC) in `cd10f83f6` (B99),
found by the Markdown lint run for B100,
fixed in the commit adding this entry
and corrected by a comment on `cd10f83f6`.
The message reported that Markdown lint found nothing in the ledger,
and the ledger it committed carries one semantic-line-breaks finding in B99's own entry
(two clauses on the line naming the root suite's children).
Which edit followed the lint run that came back clean was not established.
Prevention:
a commit message reports the lint of the bytes it commits:
the Markdown lint runs after a doc's last edit,
as the commit message's own check runs after the message's last write.

### M107: a shell command chained with `;`

Status:
happened 2026-10-02 (UTC),
while reading the PASS lines of two source-scan logs in one call,
and recorded here;
no file was changed by it.
It happened again the same day,
two `diff` runs appending to one review file joined by `;`;
the second run's exit status went unread,
and a third diff in its own call followed.
The session's shell rule allows at most three `&&`-chained steps and no `;`,
since a `;` runs the next step whatever the last one returned,
so a failed read reads as an empty one.
Prevention:
two reads that do not depend on each other go in two calls,
or in parallel calls,
never one call joined by `;`.
It recurred on 2026-10-05 (UTC),
four times in one session:
a lint and a source-scan run joined by `;` in one background call,
and three reads that put `; echo` or `; rg` behind a command to show its exit status.
Every log was read by its own result line,
and no file was changed by them.
Where the exit status of a read is wanted,
the call ends in `|| echo "exit $?"`,
which runs only when the read fails.

### M108: a whitespace-only check that counted the diff's own markers as content

Status:
happened 2026-10-02 (UTC) while checking `7f529468e`'s diff,
and caught before the commit.
To show the normalization changed whitespace alone,
one check counted added diff lines holding a non-space character,
expecting none,
and read 16,849:
each added line still carried the diff's leading `+`.
The other check,
`git diff --ignore-all-space --stat`,
printed nothing and decided it;
the commit message cites that check alone.
Prevention:
a check written to come back empty is first run on a case that must not
(here a line whose added content is not whitespace),
and a check over diff text strips the diff's markers before reading content.

### M109: an edit and the command reading it sent in one parallel batch

Status:
happened 2026-10-02 (UTC),
and recorded here.
A line was cut from a named-test list by Edit
in the same parallel batch as the test run that reads the list.
The run's log names no test from the cut line,
so the edit landed first and no result was wrong,
but parallel calls may run in either order,
and the other order would have run a list naming a file that does not exist.
Prevention:
a command that reads a fresh edit is sent after the edit returns,
never beside it.
The lead's notes count a third occurrence on 2026-10-06 (UTC):
a write was refused for want of a prior read,
while the named run that needed the file launched in the same batch,
and the run was repeated after the write landed.

### M110: a package task run from the main checkout

Status:
happened 2026-10-02 (UTC),
caught at once and recorded here.
The lint and the source scans were started from the repository's main checkout,
where this package's tasks do not exist,
and both printed `mise`'s task list with exit 1 instead of a result.
Nothing was concluded from them;
both were rerun from the worktree.
Prevention:
every package task starts with `cd --` into the worktree,
and a task's log is read for its own result line
(the lint's `Found N warnings and N errors.`,
the scans' `[PASS]` count)
before its exit status is believed either way.

### M111: a comment naming its check by where it sits

Status:
happened 2026-10-03 (UTC),
caught at once and recorded here.
The T5 recurrence's fixture comment told the reader "the check below covers them",
and `position-references.unit.test.ts` turned the suite red on it before the change landed.
The comment names "the no-leak check" in words now.
Prevention:
a comment names the check it discusses in words,
never by where it sits,
since an insertion silently repoints a position.

### M112: an `unreachable:` throw that left its own line cold

Status:
happened 2026-10-03 (UTC),
caught at once and recorded here.
The group batch's no-boundary guard first became a throw whose message starts `unreachable:`,
the shape `mergedAttestations` uses,
and the fresh whole-suite census then listed the throw's own line
(`census-QFKBeX`,
`src/group-run-anchor.ts` at line 172)
as code no unit test runs:
an unreachable throw is unreachable code too.
The guard is removed now,
with its invariant in the comment above `settled`.
Prevention:
where a stretch must close,
the dead branch comes out rather than throwing from it,
and an `unreachable:` throw counts as one more uncased line
(`artifact-change-sets.ts` holds that shape open,
`census-QFKBeX` lines 212 to 215).
That prevention is withdrawn:
M113 records what following it cost and the rule that replaces it.
