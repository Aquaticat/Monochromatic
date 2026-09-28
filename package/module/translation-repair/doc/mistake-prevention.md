# Preventing this package's mistakes

The audit of 2026-09-27 and 2026-09-28 recorded every mistake made while fixing this package
as an M entry in [the audit ledger](audit-ledger.md#process-mistakes-in-this-audit),
and every defect found while fixing as an X entry.
The ledger is the record, in the order things happened.
This page is the same knowledge grouped by family:
for each family, what went wrong, the one rule that prevents it, and what enforces the rule.
Where a test or the type checker enforces it, that is named; where only a habit does, the habit is named as such.

Read the checklist before any run launches,
and the family that matches what you are about to do before you do it.

## Before a run launches

Every step is a command whose output is read, not a memory of having done it.

1.  The tree is committed and pushed: `git status --short` prints nothing (M19).
2.  The full suite runs on that commit: `mise run buildAndTest` from the package,
    and the log's `[FAIL]` lines are counted (zero), not the exit code (M2, M12, M19).
3.  Lint reads the whole `src` tree, and its `Found 0 warnings and 0 errors` line is read (M10, M23, M45).
4.  Every cache version is accounted for (M25, M28):
    list the constants with `rg 'CACHE_VERSION[A-Z_]* = ' src`;
    for each, find the commit that set its value (`git log -S '<CONSTANT> = <value>' -- <file>`)
    and read every source commit since it over the files its stage's sheets and floors import,
    the house rules and prose ranges included;
    a change that alters what the stage asks or accepts moves the version,
    unless no cache file was written after the change
    (`find <runs dir> -path '*slice-cache*' -type f -newermt '<time>'`, with a control time that must find files,
    and an output file named so the pattern cannot match it).
5.  No source file holds control bytes (M40):
    `rg --text --files-with-matches '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]' src` prints nothing,
    after the same search has found a scratch file written with one.
6.  The launch reads the plan first: `mise run corpus-pass -- --plan` before any spending run.

## Shell commands

What happened: `;` joined commands dozens of times, so a failed step's successor ran anyway and hid which failed;
heredocs and inline `python3 -c` scripts were chained to other commands;
foreground sleeps and do-nothing calls waited on background work;
git ran outside the repository root and cli-git refused it (M1, M14, M38).

The rule: a Bash call holds at most three steps joined by `&&`, never `;`, never a shell loop.
A report that must run after a failing command is `a || b`.
An edit script goes through the Write tool and runs in a call of its own.
Git runs from the repository root or with `git -C`.
While a background task runs, the turn ends; a notification arrives when it finishes.

What enforces it: nothing automated. The ledger's M1 counts every slip, and the count kept growing
after the rule was written down; count the `&&` and look for `;` before sending.

## Guards that cannot fail

What happened: red guards went red for the wrong reason (a missing export, a lint warning) (M3, M4);
guarded one branch of a new condition (M5);
asked a function that never reads the entry guarded (M29);
matched a word the message carries twice (M34);
used fixtures that never reached the sites they named (M42, X18's first fixture),
or that could not tell the claimed order from another (M44);
and mutation runs could not report a catch, or left out the test pinning the mutated token (M27, M41).

The rule: a red guard is read case by case before the fix, and each case must fail for the reason its name gives;
after the fix every case turns green.
A guard over several sites asserts that each site is reached, one assertion per site,
and a hook under test hands a different answer each call.
An order or a precedence claim is tested with a fixture mixing every source it draws from.
Every mutation run opens with a control that must survive,
and lists every test file naming the mutated token (`rg` the tests first);
a survivor is a guard defect until a test that can fail is added and the mutant is caught.

What enforces it: the mutation harness in each fix's record, run with a control;
the reach assertions in the preparation, seam and evidence guards.

## Searches and censuses that miss

What happened: a search capped with `head` read as complete (M33);
a pin searched by a whole clause missed a rewrapped one (M13);
a census counted a helper's fields by name, not by contract (M24);
a teardown's audit listed only the sites it happened to see (M35);
a key was censused by its builders' names rather than by the material it hashes (M39);
raw NUL bytes made a source file binary to every line search (M40);
a lint and a probe ran over an empty or self-matching list (M45);
a search for an entry id printed corpus text (M36).

The rule: a search whose result licenses a change runs uncapped over all of `src` (or `--count` first),
then narrows.
A null result counts only after a positive control shows the search can match.
A generated list's line count is printed before anything consumes it.
A probe's output goes outside the tree it searches.
Corpus text is never printed: a probe prints ids, indices, counts, code points and markup.

What enforces it: habit, and the control-byte scan in the checklist.

## Claims without their evidence

What happened: ledger numbers written from a summary or a comment instead of the log or the code (M9, M22);
docs naming a log line the code never writes (M20);
a count put to the owner that measured something narrower than the option it backed (M18);
refusals called damage from a category name (M31);
a fix that supplies a model "missing" context built before reading the sheet (M32);
an inferred cause written as fact (X18's first draft).

The rule: every number, log line, cause and quoted rule is read from its source in the same step it is written,
and the source is named beside it.
A fix that gives a model context starts by rendering the sheet and searching it for that context.
An inference is labelled as one, or traced in the code before it is written.

What enforces it: habit; `rendered-sheets.test-fixture.ts` renders every sheet so reading one is a call away.

## Commit messages

What happened: messages claimed records not yet written, named hashes typed by hand,
chose `test` for a commit that changed production code, and named a task-list number as a GitHub issue
(M16, M39).

The rule: a message states only what `git show --stat` of that commit shows;
the type follows `git diff --cached --stat` (any file outside tests makes it more than `test`);
every hash is resolved with `git rev-parse` in the command that uses it;
an issue number goes in only after `gh issue view` shows it is the one meant.
Before the commit runs, read the message for `#` followed by digits:
this audit's task list numbers its items like issues, and two commits named a task as an issue within one hour.
An inaccurate message is never amended: a commit comment corrects it.

What enforces it: habit, which failed twice in one hour on the issue numbers.

## Cached decisions

What happened: floors, sheets and quorums changed what a cached stage asks or accepts,
and no cache version moved (M25); the correction then checked three of six versions (M28);
a key gained a field from a flag's name, not from what the field changes (M37).

The rule: a commit changing a floor, a sheet, a threshold or a settlement rule in a cached stage
names in its message the version it moves, or why none moves.
A field enters a key only when a run that goes ahead reads it into a question or a weighting.
Keys hash one JSON value of fixed shape with the version in it (X15), never joined strings.

What enforces it: the key-shape tests (`block-pairing-question-key.unit.test.ts`, `pass-page-titles.unit.test.ts`)
fail when a key drops its version; the checklist's cache step covers the rest.

## Tests touching the real world

What happened: a unit test prepared an original naming a title,
and the preparation bought a live web search with the key the suite inherits from `mise`
and wrote the answer into the real lookup cache (M43, X19).

The rule: before a test drives a production entry point, list what that entry point reads outside the process
(`process.env`, `fetch`, `homedir()`, the pinned corpus) and hand each a fixture.
A seam that reaches the network, a real cache or the corpus is a required parameter, never an optional one.

What enforces it: the type checker: `preparePassEntry` and `runPassPreparation` require `outsideReads`,
and tests pass `NO_OUTSIDE_READS` (`corpus-run/pass-outside-reads.test-fixture.ts`).

## Copies of shared code

What happened: helpers were copied rather than imported (three private Han tests and code-point counters,
one with a guard that can never fail), and two heading readers disagreed about HTML headings (M44, X20).

The rule: before writing a helper, `rg` the package for one that does the job
(for example `rg 'function \w*(codePoint|Han|heading)' src`) and import it.

What enforces it: habit;
the shared helpers (`code-points.ts`, `han-only-text.ts`, `page-headings.ts`) say so in their headers.

## Lint and edits

What happened: edits attempted on files not read (M6);
lint run on changed files only (M10), its warnings unread (M23), or an autofix changing behaviour unreviewed (M26);
a file split at the line cap left comments naming the old file (M17).

The rule: read a region with the Read tool before editing it.
Commit before `--fix` and read the diff after it for anything but layout.
A split searches `src`, tests and `doc` for the old file's name and repoints every hit in the same commit.
The line cap is met by splitting by concern, never by reformatting or disabling the rule.

What enforces it: the linter's `max-lines` and every other rule, read in full before staging.

## Questions to the owner

What happened: an adopted reading parked in docs across a compaction (M7);
a measurable question asked instead of measured (M8);
a fix started against a ruling (M15);
quality calls put to the owner as design questions (M30).

The rule: measure what can be measured before asking.
A choice that differs only in the quality of the result is decided for quality, built, recorded, and open to veto.
A ruling goes into [the design commitments](design-commitments.md) the turn it is given,
and a finding is checked against them before any fix starts.

What enforces it: habit, and the commitments page.

## Sheets every model reads

What happened: the rendered-sheets fixture said it rendered every model-facing sheet and held fifteen,
so the Canadian spelling guard never read the picture readers' "summarise" (X17).

The rule: a new sheet is rendered by the rendered-sheets fixtures in the commit that adds it,
and sheet text is built by a named function or constant, never inline where it is sent.

What enforces it: `rendered-sheets-census.unit.test.ts` fails when a `build…Messages` function goes unrendered;
sheets built without that naming need their own entry by hand.
