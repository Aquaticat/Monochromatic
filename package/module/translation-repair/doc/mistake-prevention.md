# Preventing this package's mistakes

The audit of 2026-09-27 and 2026-09-28 recorded every mistake made while fixing this package
as an M entry in [the audit ledger](audit-ledger.md#process-mistakes-in-this-audit),
and every defect found while fixing as an X entry.
The ledger is the record,
in the order things happened.
This page is the same knowledge grouped by family:
for each family,
what went wrong,
the one rule that prevents it,
and what enforces the rule.
Where a test or the type checker enforces it,
that is named;
where only a habit does,
the habit is named as such.

Read the checklist before any run launches,
and the family that matches what you are about to do before you do it.

## Before a run launches

Every step is a command whose output is read,
not a memory of having done it.

1.  The tree is committed and pushed:
    `git status --short` prints nothing (M19).
2.  The full suite runs on that commit:
    `mise run buildAndTest` from the package,
    and the log's `[FAIL]` lines are counted (zero),
    not the exit code (M2,
    M12,
    M19).
3.  Lint reads the whole `src` tree,
    and its `Found 0 warnings and 0 errors` line is read (M10,
    M23,
    M45).
4.  Every cache version is accounted for (M25,
    M28):
    list the constants with `rg 'CACHE_VERSION[A-Z_]* = ' src`;
    for each,
    find the commit that set its value (`git log -S '<CONSTANT> = <value>' -- <file>`)
    and read every source commit since it over the files its stage's sheets and floors import,
    the house rules and prose ranges included;
    a change that alters what the stage asks or accepts moves the version,
    unless no cache file was written after the change
    (`find <runs dir> -path '*slice-cache*' -type f -newermt '<time>'`,
    with a control time that must find files,
    and an output file named so the pattern cannot match it).
5.  No source file holds control bytes (M40):
    `rg --text --files-with-matches '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]' src` prints nothing,
    after the same search has found a scratch file written with one.
6.  The launch reads the plan first:
    `mise run corpus-pass -- --plan` before any spending run.
7.  The current handover says what is launching and why (M55):
    the snapshot's "What to do next" and its newest checkpoint name this launch,
    and the document map's "Current status" names the last pass read.

## Shell commands

What happened:
`;` joined commands dozens of times,
so a failed step's successor ran anyway and hid which failed;
heredocs and inline `python3 -c` scripts were chained to other commands;
foreground sleeps and do-nothing calls waited on background work;
git ran outside the repository root and cli-git refused it (M1,
M14,
M38);
a command ran in the same batch as the write it read,
and ran a stale file of the same name (M51).
A transcript census found 9,324 of 22,058 calls breaking the rule after it took its current wording,
and the rule itself misread as three `&&` rather than three steps (M1).

The rule:
a Bash call holds at most three steps joined by `&&`,
which is two `&&`,
and a leading `cd` is one of the three;
never `;`,
never a shell loop.
A report that must run after a failing command is `a || b`.
An edit script goes through the Write tool and runs in a call of its own,
in a later response than the write,
under a name no earlier script used.
Git runs from the repository root or with `git -C`.
While a background task runs,
the turn ends;
a notification arrives when it finishes.

What enforces it:
nothing automated yet;
issue #579 asks the repository's guardrail hook to deny such calls.
The rate fell while slips were recorded by hand but never reached zero,
so until the hook lands,
count the `&&` and look for `;` before sending,
and rerun the M1 census before an entry claims a count.

## Guards that cannot fail

What happened:
red guards went red for the wrong reason (a missing export,
a lint warning) (M3,
M4);
guarded one branch of a new condition (M5);
asked a function that never reads the entry guarded (M29);
matched a word the message carries twice (M34);
used fixtures that never reached the sites they named (M42,
X18's first fixture),
among them a test committed for a defect it passed on under the build before the fix (M53),
or that could not tell the claimed order from another (M44);
and mutation runs could not report a catch,
or left out the test pinning the mutated token (M27,
M41),
or read a test run that crashed before any verdict as a survivor (M50);
and a positive control addressed by line number changed nothing and read as a null (M52).

The rule:
a red guard is read case by case before the fix,
and each case must fail for the reason its name gives;
after the fix every case turns green.
A test added for a defect runs against the build before the fix and must fail there before the fix is committed.
A guard over several sites asserts that each site is reached,
one assertion per site,
and a hook under test hands a different answer each call.
An order or a precedence claim is tested with a fixture mixing every source it draws from.
Every mutation run opens with a control that must survive,
and lists every test file naming the mutated token (`rg` the tests first);
a survivor is a guard defect until a test that can fail is added and the mutant is caught.
A run that ends without a verdict (a crash,
a signal,
a timeout) is a result of its own,
never a pass,
and a harness carries one control for each outcome it reports.
A control edit is addressed by the text it changes,
and its change is counted before the measurement runs.

What enforces it:
the mutation harness in each fix's record,
run with a control;
the reach assertions in the preparation,
seam and evidence guards.

## Searches and censuses that miss

What happened:
a search capped with `head` read as complete (M33);
a pin searched by a whole clause missed a rewrapped one (M13);
a census counted a helper's fields by name,
not by contract (M24);
a teardown's audit listed only the sites it happened to see (M35);
a key was censused by its builders' names rather than by the material it hashes (M39);
raw NUL bytes made a source file binary to every line search (M40);
a lint and a probe ran over an empty or self-matching list (M45);
a census of a letter test searched the names of functions holding it and missed every inline copy,
and the search by shape then missed the same test written negated (M48);
a search for an entry id printed corpus text (M36).

The rule:
a search whose result licenses a change runs uncapped over all of `src` (or `--count` first),
then narrows.
A census of a rule searches every way the rule can be written,
not the names of functions known to hold it:
for a character test,
range comparisons on characters and on codes,
literal alphabets,
case-fold comparisons,
and regex classes and properties,
each shape in its asserted and its negated spelling.
A null result counts only after a positive control shows the search can match.
A generated list's line count is printed before anything consumes it.
A probe's output goes outside the tree it searches.
Corpus text is never printed:
a probe prints ids,
indices,
counts,
code points and markup.

What enforces it:
habit,
and the control-byte scan in the checklist.

## Claims without their evidence

What happened:
ledger numbers written from a summary or a comment instead of the log or the code (M9,
M22);
docs naming a log line the code never writes (M20);
a count put to the owner that measured something narrower than the option it backed (M18);
refusals called damage from a category name (M31);
a fix that supplies a model "missing" context built before reading the sheet (M32);
an inferred cause written as fact (X18's first draft).

The rule:
every number,
log line,
cause and quoted rule is read from its source in the same step it is written,
and the source is named beside it.
A fix that gives a model context starts by rendering the sheet and searching it for that context.
An inference is labelled as one,
or traced in the code before it is written.

What enforces it:
habit;
`rendered-sheets.test-fixture.ts` renders every sheet so reading one is a call away.

## Current-state docs

What happened:
the document map's current status still described the pipeline of 2026-09-06 three weeks later,
and said no new pass was authorized while passes kept running (D28);
the handover index put the kill-and-relaunch rule in a README section that had moved;
and the day after TianqiChen66621's page was read,
the current snapshot still listed reading it as a next step (M55).

The rule:
a page read,
an owner ruling built
or a change of plan updates the current snapshot's "What to do next" in the same sitting,
before the next piece of work,
and its newest checkpoint when the next steps change;
the map's "Current status" moves with them when what it states has changed.
A status paragraph carries the date it was written,
and points at a record by its name and date,
not by its place in a file that grows.

What enforces it:
habit,
and step 7 of the launch checklist;
no test can tell a current paragraph from a stale one.

## Commit messages

What happened:
messages claimed records not yet written,
named hashes typed by hand,
chose `test` for a commit that changed production code,
named a task-list number as a GitHub issue,
and gave a cause that no command had yet shown (M16,
M39,
M49).

The rule:
a message states only what `git show --stat` of that commit shows;
the type follows `git diff --cached --stat` (any production file under `src` makes it more than `test`);
every hash is resolved with `git rev-parse` in the command that uses it;
an issue number goes in only after `gh issue view` shows it is the one meant;
a cause goes in only after the command that shows it (blame,
log,
a probe) has run.
A count goes in only from a command run on the staged diff
(one commit said 44 and five where its diff held 40 and 6;
another counted its edit script's edits and called them the times they fixed).
Before the commit runs,
read the message for `#` followed by digits:
this audit's task list numbers its items like issues,
and two commits named a task as an issue within one hour.
An inaccurate message is never amended:
a commit comment corrects it.

What enforces it:
habit,
which failed twice in one hour on the issue numbers.

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

The rule:
a reference names something a later reader can open:
a ledger entry,
a doc heading or path,
a file or symbol,
a commit,
a date,
or the finding itself in words.
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
and on a listed issue or quotation that no longer occurs.

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
the checklist's cache step covers the rest.

## Tests touching the real world

What happened:
a unit test prepared an original naming a title,
and the preparation bought a live web search with the key the suite inherits from `mise`
and wrote the answer into the real lookup cache (M43,
X19).

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

What enforces it:
the type checker:
`preparePassEntry` and `runPassPreparation` require `outsideReads`,
and tests pass `NO_OUTSIDE_READS` (`corpus-run/pass-outside-reads.test-fixture.ts`).

## Copies of shared code

What happened:
helpers were copied rather than imported (three private Han tests and code-point counters,
one with a guard that can never fail),
and two heading readers disagreed about HTML headings (M44,
X20).

Audit area six then found the family package-wide (ledger B1 to B15):
31 groups of function bodies kept in two to
six files,
among them two readings of one event stream,
five span-rewrite appliers under three contracts,
and a benchmark grader whose re-carved slices ran one behind the run's (B10).
Declaring the shared type for one merge duplicated a type another module already exported (M47).

The rule:
before writing a helper or declaring a type,
`rg` the package for its name and for its shape
(for example `rg 'function \w*(codePoint|Han|heading)' src`,
or the field names together) and import what is there.
A copy that must stay separate (an artifact version's frozen rule) says so where it stands,
naming the live copy and the check that compares them.
Code that claims to rebuild what the pipeline built (slices,
sheets,
verdicts) calls the pipeline's own function,
or measures its agreement over the corpus and records the result.

What enforces it:
`src/duplicate-bodies.unit.test.ts` (ledger B19) fails on any function body of 80 or more characters,
comments and whitespace aside,
kept in two places in the package's source,
in one file or two,
except the frozen copies it lists with their reasons,
and fails when a listed copy no longer stands.
A copy that must stay separate is added to that list in the same change that makes it,
with the reason and the check that compares it.
The shared helpers (`code-points.ts`,
`han-only-text.ts`,
`page-headings.ts`,
`index-pair-list.ts`,
`sse-data-line.ts`,
`corpus-run/span-rewrites.ts`) say so in their headers.

## Lint and edits

What happened:
edits attempted on files not read (M6);
lint run on changed files only (M10),
its warnings unread (M23),
or an autofix changing behaviour unreviewed (M26);
a file split at the line cap left comments naming the old file (M17);
every doc commit skipped the repository's Markdown linter,
so the package docs carried 3,344 of its findings (M54),
and the repository-level translation-repair docs 16,717 (D27);
the linter's `--fix` split 186 headings in a file with astral characters,
through an offset defect of its own (issue 559);
code spans closed early by a backtick inside them rendered as loose backticks,
which no linter rule reports (D30);
changes that stopped calling a function left it behind,
and nothing reported one (ledger B20).

The rule:
read a region with the Read tool before editing it.
Lint,
type check and the named tests run after the final edit of a commit,
in that order,
and the commit follows only a clean run of all three (M46).
Neither the type check nor the linter reports an unused import here
(issue #578 asks for a check),
so a removal counts the removed names' uses,
and a change that stops calling a function removes it in the same commit.
Commit before `--fix` and read the diff after it for anything but layout.
A split searches `src`,
tests and `doc` for the old file's name and repoints every hit in the same commit.
The line cap is met by splitting by concern,
never by reformatting or disabling the rule.
A Markdown change runs `mise run lint:markdown <files>` from the repository root,
and its `--fix` output is rendered against the committed version before it is staged,
block for block (`render-blocks.mjs` in the audit's scratch folder),
not by counting markers.
Until issue 559 is fixed,
`--fix` runs on a file holding an astral character only with those characters mapped to single-unit private-use characters for the run
(`astral-safe-fix.mjs`).
A code span holding a backtick uses a longer backtick run as its delimiter,
since a backslash does not escape it,
and a rendered doc is scanned for stray backticks and asterisks (`stray-contexts.mjs`).

What enforces it:
the linter's `max-lines` and every other rule,
read in full before staging;
the Markdown linter,
which exits 0 only when no finding remains;
`src/dead-functions.unit.test.ts`,
which fails on a top-level function its file never names beyond its declaration
and on an export no other package file names.

## Questions to the owner

What happened:
an adopted reading parked in docs across a compaction (M7);
a measurable question asked instead of measured (M8);
a fix started against a ruling (M15);
quality calls put to the owner as design questions (M30).

The rule:
measure what can be measured before asking.
A choice that differs only in the quality of the result is decided for quality,
built,
recorded,
and open to veto.
A ruling goes into [the design commitments](design-commitments.md) the turn it is given,
and a finding is checked against them before any fix starts.

What enforces it:
habit,
and the commitments page.

## Sheets every model reads

What happened:
the rendered-sheets fixture said it rendered every model-facing sheet and held fifteen,
so the Canadian spelling guard never read the picture readers' "summarise" (X17).

The rule:
a new sheet is rendered by the rendered-sheets fixtures in the commit that adds it,
and sheet text is built by a named function or constant,
never inline where it is sent.

What enforces it:
`rendered-sheets-census.unit.test.ts` fails when a `build…Messages` function goes unrendered;
sheets built without that naming need their own entry by hand.
