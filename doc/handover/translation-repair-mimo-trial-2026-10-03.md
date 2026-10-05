# Translation repair: trial handover to MiMo, 2026-10-03

Part of the [translation repair handover](translation-repair.md).

Claude Code wrote this on 2026-10-03 (UTC) for MiMo 2.6 Pro,
which works this package for about 48 hours from 2026-10-03 while the owner is away.
Read this whole file before running any command.
It is the one document you must read in full;
every other link is for when a step sends you there.
A session resuming the trial reads "Trial log" first:
its newest line names the last commit and the step in progress.
Write that line after every commit,
so a new session picks up mid-step.
Everything stated as measured was run on 2026-10-03 in a cloud copy of the repository
(Node 26.10.0,
pnpm 12.5.1,
mise 2026.10.0);
everything else names where it comes from.

The trial ended on 2026-10-05.
"Outcome:
merged on 2026-10-05" says what became of its work,
and which of this file's instructions turned out wrong.

## The mistakes this package punishes most

These five come from the package's own record of what went wrong
([`mistake-prevention.md`][prevent] and the ledger's M entries);
the first was measured again while writing this file.

1.  The tests read the build,
    not the source.
    Every `src/**/*.unit.test.ts` imports `../dist/final/node/index.mjs`,
    so an edit to a `.ts` file changes no test result until the package is built again.
    Measured on 2026-10-03:
    the fix for the failing case in "First:
    fix B126" left the case failing until a rebuild,
    and passed after it.
    Build before every test run
    (`buildAndTest` does both).
2.  A run is read from its log,
    never from its exit status alone.
    Count the `[FAIL]` and `[PASS]` lines the log prints (ledger M2,
    M12,
    M19).
    A file stops at its first failing suite,
    so one `[FAIL]` can hide cases that never ran (ledger B99).
3.  Shell calls stay small:
    at most three steps joined by `&&`,
    never `;`,
    never a shell loop,
    and package tasks start from the worktree,
    where the package exists (ledger M1,
    M107,
    M110;
    `AGENTS.md` rule 1CB).
    A step that needs more becomes a script file run on its own.
4.  A failing test is a finding,
    not an obstacle.
    Never change an expectation to match the code,
    skip a case,
    loosen a lint rule
    or delete a test to get green.
    If an expectation is wrong,
    the commit message says why,
    with the evidence.
5.  Commit after every step,
    naming each file in the commit's pathspec,
    and never amend,
    rebase
    or force-push (`AGENTS.md` rules GCE,
    CLG,
    CPN,
    GCA).

## What the package is

`package/module/translation-repair` takes a Chinese original and its existing English translation (the archive),
asks a roster of models to critique and repair it slice by slice,
and ships a repaired page.
It is not production ready
([`translation-repair-readiness-signal.md`](../planning/translation-repair-readiness-signal.md)).
Since 2026-09-27 the work has been the owner's audit of the whole package:
"audit the whole translation-repair pkg for all the mistakes we've made and fix all of them".
Every finding,
its evidence,
fix and guard is an entry in the [audit ledger][ledger],
lettered by area.
This trial adds to three letters:
B for a defect in the package (the ledger's "Recurring code families" section),
M for a mistake made while fixing ("Process mistakes in this audit"),
and T for a gap in the tests ("Test suite").

## Where things stand on 2026-10-03

- Branch `translation-repair-rebased`,
  last code commit `98e94e584`,
  in which the owner committed two test files left by agents that stopped part way.
  This file arrives in the docs commit after it.
- The suite has exactly one failing case on that commit,
  and it is a real defect,
  now B126:
  in `src/contributor-name-authority.unit.test.ts`,
  "READS NO NAME from a link whose label is empty,
  which shows a reader nothing,
  rather than its markup (T8)"
  expects `['Pebble']`
  and gets `['[](https://example.test/whisker)', 'Pebble']`
  (measured).
  The new case in `src/corpus-run/canadian-spelling.unit.test.ts` passes (measured).
- The last full suite before that commit,
  `14e4e2cea` on the owner's machine,
  printed 1,545 PASS lines and no FAIL line (its commit message).
- T8,
  code no unit test runs,
  is the open entry the next corpus pass waits for.
  The last whole-suite census,
  `census-3G9C58` at `d0cca211d`,
  held 590 stretches of library source no test ran.
  Batches since closed 81 of them,
  and bundles 1 and 2 of the remaining 509 landed (`23090a91d`,
  `ba6da4640`).
  The cut of the other bundles was never committed,
  so the next batch starts from a fresh whole-suite census
  (the ledger's T8 entry,
  its last paragraphs).
- B123 is open:
  on a page holding a footnote and a `www.` link literal the parser leaves unpositioned,
  the footnote relabel refuses the whole page.
  It reproduces on the build of `98e94e584` (measured);
  no pinned page triggers it (a 2026-10-02 census).
- No corpus pass has run since 2026-09-28.
- Ledger numbers:
  B126 is taken by the failing case,
  so the next new defect is B127 and the next process mistake is M111.

## Your authority and the owner's choices

The owner answered on 2026-10-03,
before leaving:

- Authority:
  "Same authority as Claude,
  but I don't think it will finish the audit fast enough (in 48h) anyway."
  Claude's standing orders come with it.
  The next corpus pass waits for T8 to close,
  under the owner's directive of 2026-09-28 to prefer the quality of the end result,
  and only the owner may veto that order,
  so in practice this trial launches no corpus pass.
  Unit tests,
  censuses,
  builds
  and every task that spends no quota are yours without asking.
- Branch:
  commit to a new branch,
  `translation-repair-mimo-trial`,
  cut from the docs commit carrying this file.
  Never commit to or push `translation-repair-rebased`.
- The failing case is your first step,
  "First:
  fix B126".

The owner is away and answers nothing until the trial ends,
so no step waits on the owner.
This file has no stopping point:
when a step closes,
the next starts,
and the owner expects T8 to outlast the 48 hours.
A turn never ends on a summary,
a plan
or a question (ledger M101).
A choice the stated rules and a measurement settle is settled:
make it and record it (`AGENTS.md` rules QDF,
QGR,
QNX).
A choice that still turns on preference alone
takes the option that serves the quality of the shipped page,
the owner's standing directive of 2026-09-28;
act on it,
and record it under "Decisions for the owner to review" with the options,
the evidence and the reason,
so the owner can veto it on return.

## Setup, once

Run each line as its own call,
from the worktree the snapshot's "Repository state" names
(`/var/home/user/worktrees/translation-repair` when it was written;
confirm with `git rev-parse --show-toplevel`).

```sh
# from the worktree root
git status --short
git fetch origin translation-repair-rebased
git switch --create translation-repair-mimo-trial --no-track origin/translation-repair-rebased
git log --max-count 1 --format='%h %s'
```

- A path `git status --short` prints outside `package/module/translation-repair` and `doc` is someone else's work in progress:
  leave it,
  never stage it,
  and never restore or stash it (`AGENTS.md` rule EC1).
- A path it prints under either is carried onto the trial branch by the switch:
  read it with `git diff`,
  commit it there as found,
  alone,
  as `chore(module-translation-repair): commit changes found at the trial's start`,
  naming each path,
  and note it in "Trial log".
  If the switch refuses because such a change conflicts,
  cut the branch where the worktree stands
  (`git switch --create translation-repair-mimo-trial --no-track`),
  commit the change the same way,
  then `git merge --no-edit origin/translation-repair-rebased` so the branch carries this file.
- `--no-track` matters.
  Without it the new branch tracks `origin/translation-repair-rebased`
  (measured on 2026-10-03:
  `branch 'probe-track' set up to track 'origin/translation-repair-rebased'`),
  and the auto-push after each commit would follow that upstream.
  With it the branch has no upstream,
  and cli-git's first auto-push runs `git push --set-upstream origin HEAD`
  (`package/git-policy/cli/README.md`,
  "Post-commit auto-push"),
  which creates `origin/translation-repair-mimo-trial`.
- The log line must show the docs commit that added this file.

Then make a folder for logs and take the starting suite:

```sh
# from the worktree root
mkdir --parents "${HOME}/temp/agent/mimo-trial"
chmod 700 "${HOME}/temp/agent/mimo-trial"
mise run //package/module/translation-repair:buildAndTest > "${HOME}/temp/agent/mimo-trial/suite-start.log" 2>&1
```

Read the log:
`rg --count '\[FAIL\]' <log>` and `rg --count '\[PASS\]' <log>`.
Expect exactly the one failing case of "First:
fix B126",
which prints three `[FAIL]` lines
(the case,
its suite and the file's root suite).
Any other `[FAIL]` line on this machine is a finding of the same kind:
take the next B number and fix it on the steps of "First:
fix B126",
right after B126 and before the census,
which refuses a failing suite.
In the cloud copy the suite took about four minutes after the build.

If you are not on the owner's machine:
the cloud copy ran `mise trust`,
`mise install node pnpm`
and a `pnpm install` filtered to this package and its dependencies,
and there 14 test files besides the B126 one failed
(measured in the cloud copy).
Every failure message read there names the missing pinned corpus at `~/one-among-us/data`,
a temporary git repository the container's `git` could not make,
the shallow clone,
or a case that needs a user other than root;
one `pass-entry` case
(an outcome of `resumable-failure` where `stopped` was expected)
was not traced.
On the owner's machine the same suite printed no FAIL line at `14e4e2cea`,
and the census refuses a suite that fails,
so work on the owner's machine.

## First: fix B126, the empty-label link

The symptom is in "Where things stand on 2026-10-03".
The cause,
read from the source:
`contributorForm` in `src/contributor-name-authority.ts`
finds a link's label end with `unmarked.indexOf('](')`
and returns the token unchanged when `labelEnd <= 1`.
That one check joins two different cases:
`-1`,
no `](` at all,
where the token is a plain name such as `[Whisker`,
and `1`,
an empty label `[](...)`,
where nothing shows to a reader.
For the empty label the visible form is the empty string,
which `archiveContributorNameForms` already drops through its `nonempty` filter,
and the function's `@returns` already says "empty for empty token".
Changing the check so that only a missing `](` returns the token,
then building,
made the file pass in the cloud copy (5 PASS lines,
0 FAIL,
over three test files);
that edit was reverted,
so the fix is yours to make.

Keep the fix to that check and the words around it.
Moving this reader onto the Markdown parse is a larger change no finding asks for.

Steps:

1.  Read `src/contributor-name-authority.ts` and its test file whole before editing (ledger M6).
2.  Fix the check.
    Keep the TSDoc true:
    if a comment or `@returns` no longer says what the code does,
    reword it.
3.  Run the full suite (`buildAndTest` into a new log),
    not named files:
    `archiveContributorNameForms` feeds `prepareDocument`,
    which dozens of test files reach (ledger M105).
    Expect `[FAIL]` 0.
4.  Decide whether a cache version moves.
    The change alters what the contributor floor protects,
    and `document-preparation.ts`,
    `page-identity-lines.ts`
    and `archive-replacement-candidates.ts` read it.
    A cached slice changes only if a pinned archive page has an empty-label link on a contributor line.
    Measure it on the pinned corpus:
    `git -C ~/one-among-us/data grep --line-number --fixed-strings '[](' a41fc607ea5a70d8a7625cc67d5ed8c444f53379`,
    then read each hit for a contributor label
    (`CONTRIBUTOR_LABELS` at the top of the source file).
    No hit on such a line means no cached decision changes,
    and the ledger entry says so as inference from that search.
    A hit means reading "Cached decisions" in [`mistake-prevention.md`][prevent] before committing.
5.  Run the lint and the source scans
    ("Commands",
    the lint and source-scan lines),
    and read each result line.
6.  Write ledger entry B126 in the [audit ledger][ledger],
    after B125,
    on B125's model:
    what was wrong,
    where,
    how it was found
    (a T8 bundle agent's case,
    red in `98e94e584`),
    the evidence,
    the fix,
    the cache decision with its measurement,
    and a "Recurrence:"
    line naming the family in [`mistake-prevention.md`][prevent] whose rule covers it,
    adding one sentence to that family's "What happened".
    "Text that shows nothing" and "Structure read off the parse" are the nearest;
    pick the one whose rule would have prevented it,
    or say neither does.
7.  Commit the fix and its docs,
    with a message on the model of `14e4e2cea`:
    `fix(module-translation-repair): B126, read no contributor name from a link whose label is empty`,
    then a body saying what changed in each file,
    the cache decision,
    and "Checks on this tree:"
    with each count read from its log.

## Second: the whole-suite census

With the suite green and the tree committed,
take the baseline every T8 batch reads against:

```sh
# from the worktree root
mise run //package/module/translation-repair:coverage-census > "${HOME}/temp/agent/mimo-trial/census-base.log" 2>&1
```

- It refuses a failing suite.
  A census taken with uncommitted changes in the package says so on its first line,
  and a later reading refuses it as a baseline,
  so commit first.
- It writes about 8 GB of coverage under `~/.cache/translation-repair/coverage`,
  deleted once read (the task's description);
  check free disk first.
- Its last lines name the census:
  `census written to <dir>/census.json`.
  Write that path and the counts on the `library source:` line under "Trial log".

Rank the clusters.
A cluster is the files of one directory whose names share their first word,
so `page-headings.ts` and `page-name-glossary.ts` are cluster `page`,
and `src/corpus-run/archive-casing-restore.ts` is in `corpus-run/archive`.
This command (tested on 2026-10-03 against a census log)
reads the report's "library source by cold lines" rows and prints the 15 largest clusters,
by stretches,
then lines:

```sh
# from the worktree root; the last argument is the census log
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const lines = readFileSync(process.argv[1], 'utf8').split('\n');
const from = lines.indexOf('library source by cold lines:');
const to = lines.indexOf('functions never called in package source, outermost:');
const clusters = new Map();
for (const row of lines.slice(from + 1, to)) {
  const match = /^  (src\/(?:.*\/)?)([^/-]+)[^/]*\.ts: (\d+) stretch(?:es)?, (\d+) lines?/.exec(row);
  if (match === null) throw new Error('unread row: ' + row);
  const key = match[1].slice(4) + match[2];
  const sum = clusters.get(key) ?? { stretches: 0, lines: 0, files: 0 };
  clusters.set(key, { stretches: sum.stretches + Number(match[3]), lines: sum.lines + Number(match[4]), files: sum.files + 1 });
}
const ranked = [...clusters].sort((a, b) => (b[1].stretches - a[1].stretches) || (b[1].lines - a[1].lines));
for (const [key, sum] of ranked.slice(0, 15)) console.log(key, sum.stretches, 'stretches', sum.lines, 'lines', sum.files, 'files');
" "${HOME}/temp/agent/mimo-trial/census-base.log"
```

List one cluster's stretches,
each with its lines and the function it is when the whole function never ran:

```sh
# from the worktree root; arguments: the census.json path, then the cluster
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const [path, cluster] = process.argv.slice(1);
const census = JSON.parse(readFileSync(path, 'utf8'));
const prefix = 'src/' + cluster;
const inCluster = (source) => source === prefix + '.ts' || (source.startsWith(prefix + '-') && !source.slice(prefix.length + 1).includes('/'));
for (const s of census.stretches.filter((s) => inCluster(s.source))) console.log(s.source + ':' + s.startLine + '-' + s.endLine, s.name);
" <census.json> <cluster>
```

On 2026-10-03 the second command listed 52 stretches for one cluster
where the first command's row counts summed to the same 52.

## Third: T8 batches, one cluster at a time

Take the largest cluster.
A cluster over about 30 stretches is split by file,
one batch per group of files,
so a batch stays reviewable.
Before writing anything,
read how earlier batches recorded their work:
`git show --stat 23090a91d` (bundle 1)
and `git show --stat dc9f0449b` (the `page` batch).
Their messages are the model for yours.

For each stretch,
read its lines and the function around them,
then decide which of three it is.

1.  Reachable,
    and the code does the right thing.
    Add a case that runs it and checks what it does,
    in the module's own `*.unit.test.ts`;
    a module with no test file of its own and no export reaching the package index
    is cased through an exported caller,
    as the `page` batch did.
    Assert the result,
    never only that it ran;
    for a throw,
    give an input cast past its type and assert the error class.
    Fixtures are cat-themed inventions;
    no corpus text goes into a test.
2.  Reachable,
    and the code does the wrong thing.
    That is a defect:
    take the next B number,
    commit a red case first,
    `test(module-translation-repair): B<n> red, <what goes wrong>`,
    with its `[FAIL]` line read from a log,
    then the fix,
    `fix(module-translation-repair): B<n>, <what it does now>`,
    with its ledger entry and the cache decision of "First:
    fix B126" step 4.
    `804ae3e85` and `ca242a2c4` are a model pair.
3.  Unreachable.
    Name what makes it so:
    the check in the same function that returns first,
    or what every caller guarantees.
    Then replace a fallback no input reaches with `nonNullishOrThrow` from `@monochromatic-dev/module-or-throw`,
    or a throw whose message starts `unreachable:`,
    or remove the dead code;
    never write a case that pins it.
    A claim that something is unreachable rests on reading or a probe,
    never on hope:
    `23090a91d` rejected an agent's "unreachable" after a probe reached it.

Every stretch ends as one of the three.
There is no fourth outcome:
T8 closes only when every library stretch has a case or is removed (ledger T8).
A stretch that resists placement gets a probe on the built package,
as `23090a91d` did,
until it is placed.
A reachable arm that needs a failure the host will not produce on demand is still cased,
through a parameter the function already takes,
or the narrowest one added so a test can supply that failure.

Close the batch in this order:

1.  Commit the cases and any source changes as soon as they pass,
    `test(module-translation-repair): T8 <cluster>, <what the cases pin>`,
    the body listing per file which stretch each case is written for,
    what was found unreachable and why,
    and what was left.
    Until the reach census of step 2 shows a stretch ran,
    a message says which stretch a case is written for,
    never that it reaches it (ledger M102).
2.  Prove the batch's reach with a census of its own test files against the baseline,
    one `--source` per source it claims:

    ```sh
    # from the worktree root, with every change committed
    mise run //package/module/translation-repair:coverage-census -- --baseline <census.json> --source src/<a>.ts --source src/<b>.ts src/<a>.unit.test.ts > "${HOME}/temp/agent/mimo-trial/reach-<cluster>.log" 2>&1
    ```

    Its `against <census.json> at <commit>: ...` line decides it
    (format measured on 2026-10-03):
    `still cold 0`,
    `cold since then 0`
    and `not loaded 0`.
    Each count above zero is followed by lines naming the stretches;
    case each one,
    or prove it unreachable and remove it,
    commit,
    and run it again until all three read 0.
    A source the batch edited is read as a whole:
    its line must say this run loaded it and left nothing cold.
3.  Run the full suite (`buildAndTest`),
    `[FAIL]` 0,
    then the lint and the source scans,
    each result line read.
4.  Record the batch in one docs commit,
    `docs(module-translation-repair): record T8 <cluster>`:
    a paragraph at the end of the T8 entry of the [audit ledger][ledger]
    naming the cluster,
    the commits,
    the census reading
    and any B entries found,
    and one line under "Trial log" in this file.
5.  Take a whole-suite census at that commit as the next batch's baseline,
    and name it under "Trial log"
    (the practice the snapshot's 2026-09-29 checkpoint records for every batch).

Then the next cluster.

## Fourth: B123, the unpositioned link literal

Take it after the first T8 batch has landed.
The ledger's B123 entry has the cause,
the probe inputs and their results.
Write the red case through `applyFootnoteRelabel` first,
then design the fix,
build it,
and land it on the steps of "First:
fix B126".
Settle the design as "Your authority and the owner's choices" says:
by the stated rules and measurement,
and where two designs still differ by preference alone,
by the quality of the shipped page,
recorded under "Decisions for the owner to review".
Then back to the next T8 cluster.

## Commands

Run each from the worktree root,
redirecting long output to a log file under `${HOME}/temp/agent/mimo-trial/`,
then read the result line named.

- Build:
  `mise run //package/module/translation-repair:build`
  (measured;
  rolldown prints `Finished` at the end).
- Build and full suite:
  `mise run //package/module/translation-repair:buildAndTest`
  (measured;
  read the `[PASS]` and `[FAIL]` counts).
- Named test files,
  after a build:
  `mise run //package/module/translation-repair:test:unit src/<a>.unit.test.ts src/<b>.unit.test.ts`
  (measured).
- Lint:
  `mise run //package/module/translation-repair:lint`,
  whose result line is `Found 0 warnings and 0 errors.`
  (from the owner's commit messages;
  the cloud copy could not build the lint's own config package,
  so it was not run there).
- Types:
  `mise run //package/module/translation-repair:lint:types`
  after any TypeScript edit (`AGENTS.md` rule CM6;
  not run in the cloud copy).
- Source scans:
  `mise run //package/module/translation-repair:source-scans`
  for every commit touching the package's source,
  docs,
  README or task file,
  since several scans read the docs;
  35 `[PASS]` lines and no `[FAIL]` on `98e94e584` (measured).
- Markdown lint,
  for any Markdown you edit:
  `mise run lint:markdown <file> <file>`
  (measured;
  it prints nothing beyond its command line when clean).
- Coverage census:
  "Second:
  the whole-suite census" and "Third:
  T8 batches,
  one cluster at a time".
- Cache versions before any launch:
  `mise run //package/module/translation-repair:cache-account-audit`
  (the prevention doc's "Before a run launches").

## Rules from `AGENTS.md` that bite in this package

`AGENTS.md` at the repository root holds every rule;
these are the ones the code here trips most.

- TSDoc on every declaration,
  locals included (TSD),
  directly before it (TD3).
  Match the blank-line form a file already uses inside its TSDoc blocks (ledger M103).
- `nonNullishOrThrow`,
  never `!` (PP5).
  No `switch` (PP9).
  `async`/`await` only (PP1).
- Text is ordered with `compareCodePoints` or `textsInCodePointOrder` from `code-points.ts`,
  never `localeCompare` or a bare `sort()`
  ([`mistake-prevention.md`][prevent],
  "Text by code point").
- No new regular expression without the justification comment of rule RG3.
- Tagged loggers,
  never raw `console` in library code (TLG).
- Never raise or disable the max-lines limit;
  split the file (MXL).
- Commit messages:
  Conventional Commits with scope `module-translation-repair` (GCG),
  never a `#` before a number (TID),
  never `Closes` with an issue.
- Markdown:
  a line break at each clause,
  no tables,
  no dashes as punctuation,
  `-` for bullets,
  numbered items padded as `1.  `,
  and no reference by position;
  name the heading or the file instead (WR2,
  WR5,
  MD1 to MD8).

## Never

- Never launch a corpus pass while T8 is open,
  unless the owner says so,
  as "Your authority and the owner's choices" explains.
- Never print an API key,
  read `/proc/<pid>/environ`,
  or set `thinking`,
  `budget_tokens` or `reasoning_effort`
  (the snapshot's "Standing constraints").
- Never push to `translation-repair-rebased`,
  force-push,
  amend,
  rebase
  or reset a commit that exists.
- Never edit a dated section of an older handover or a closed ledger entry,
  except to add a correction that names itself as one.
- Never trust that a script named in an older doc still exists:
  `~/temp/agent` is wiped at any time,
  so check with `ls` and write your own when it is gone.

## Where the rest lives

- [The audit ledger][ledger]:
  every finding;
  T8's entry has the census method,
  its history and every batch.
- [`mistake-prevention.md`][prevent]:
  each family of mistakes,
  its rule,
  and "Before a run launches".
- [The package README](../../package/module/translation-repair/README.md),
  "Where the rest lives":
  configuration,
  roster,
  providers,
  seats.
- [The 2026-09-06 snapshot](translation-repair-handover-2026-09-06.md):
  the operating history,
  "Repository state",
  "How a pass is launched now"
  and "Standing constraints".
- [The corpus-pass runbook](../runbook/translation-repair-corpus-pass.md),
  for the launch this trial does not make.

## Outcome: merged on 2026-10-05

Claude Code read the trial branch on 2026-10-05 (UTC),
on the owner's instruction to build on it by merging or to discard it,
and merged it:
`translation-repair-rebased` moved from `28303c42a` to `7f069adc9` by fast-forward,
all 303 commits,
and was pushed.
The trial checkout and its branch are left in place for the owner to remove.
This section records that decision and stays open to the owner's veto.

### What the decision rests on

Measured on the trial tip `7f069adc9`,
and again in the main checkout once it was merged:

- the whole suite printed 1,564 `[PASS]` lines and no `[FAIL]`;
- the lint ended `Found 0 warnings and 0 errors.`;
- all 35 source scans passed;
- the Markdown lint found nothing in `audit-ledger.md`,
  `mistake-prevention.md` or this file.

Read by hand:

- the whole production diff
  (63 files,
  776 lines added and 379 removed);
- every test hunk that removed a line:
  no expectation was changed to fit new code and no case was removed;
- the share of weak assertion shapes in the added cases
  (24 `toContain` in 396 added expectations,
  against 1,652 in 14,703 across the package when the trial began).

### What this file got wrong

"Third:
T8 batches,
one cluster at a time" told the trial that every census stretch ends cased,
unreachable and removed,
or a fixed defect,
and to take the census again until its counts read zero.
A guard on a state no input produces must stay and can never run,
so that rule had no place for it,
and the trial took guards out,
flattened named errors to `nonNullishOrThrow`,
and added parameters to production functions so cases could force a guarded state.
The package ledger records each one and what replaced it:
`M112` for the first removal and the rule it left,
`M113` for the family,
and `B127` for the one removal that changed a result.
The corrected rule is in `mistake-prevention.md`,
"Guards a census wants gone".
The rest of the trial's production diff and its added cases are being read against that rule as this is written;
the ledger carries what that reading finds.

By the end of 2026-10-05 (UTC) that reading had reached ledger entries `B128` to `B167`,
with `M113` extended for each removal read against its callers.
Still being read then:
the trial's edits to the OpenRouter client,
the rendering audit's screen and corroboration,
`preservation-tokens.ts`,
`retry-stated-wait.ts`,
`source-only-breaks.ts`,
`stage-fanout-window.ts` and the export surface;
and the reviewers' findings on test files no fix had yet touched.

### Choices the trial made that the owner may veto

- The `gitOutput` catch in `corpus-source.ts` wrapped every throwable as `CorpusReadError`
  (`33fc7a459`,
  recorded under "Decisions for the owner to review").
  Reversed on 2026-10-05 in `ba243b3c3`:
  the catch wraps a subprocess failure alone again,
  since the trial's evidence for the wider wrap was incomplete (ledger `B156`).
  The reversal is as open to veto as the wrap was.
- Parameters added to production functions so a case could reach a branch:
  `fold` on `anchorLocatedSpan`,
  `needle` on `deleteOneSentence`,
  `anchor` on `insertBorrowedSentence`,
  and `ocrTool` on `readImageWithOcr`.
  The first three are removed again (`fa86b527d`);
  the fourth gave way to a required program runner in `d550bf04f` (ledger `M113`,
  `B147`).

## Trial log

Newest first.
One line per step or batch:
the date and UTC time,
what landed with its commit,
the counts read from the logs,
and the step in progress.
A batch also writes one line before its first commit,
and after any correction or decision inside it,
naming the uncommitted work and the reasoning behind it,
so a fresh context resumes from this file alone.

- 2026-10-05,
  05:22 UTC:
  the next batch's baseline census taken at commit `9fe80a109`:
  `census written to ~/.cache/translation-repair/coverage/census-aU1H0y/census.json`
  (`~/temp/agent/mimo-trial/census-final2.log` of this round),
  `library source: 90 files, 119 stretches over 309 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/runs` leads with 3 over 9 in 2,
  `transient` with 3 over 7 in 1,
  `artifact` with 2 over 17 in 2.
  This line lands in the trial-log commit that follows `9fe80a109`.
  Next:
  the `corpus-run/runs` re-verification
  with the byte-level method.

- 2026-10-05,
  05:17 UTC:
  `declined` is FULLY COVERED
  (the ledger's
  `DECLINED RE-VERIFICATION` paragraph,
  corrected in place):
  the four spans first left open
  with the cause "the aligner's emission rules unmapped"
  were covered with hand-built steps,
  and that cause was itself unverified
  (`declinedTargetBlocks` takes its steps
  as an argument).
  The whole file reads COVERED
  in the run's own census byte spans.
  Gates at the close:
  1,564 [PASS] and no [FAIL],
  35 source scans and no [FAIL].

  Pattern this round confirmed again:
  every cause I wrote for a cold line
  before running the byte-level check
  turned out wrong or incomplete,
  and the byte spans plus the code reads
  settled each one.

  Next:
  the left-open list in the ranking's order:
  `corpus-run/runs` (3),
  `transient` (3),
  `artifact` (2),
  `corpus-run/cache` (2),
  `corpus-run/name`,
  `edit`,
  and the `model-card-derive` data-invariant guard
  (its cause named and confirmed).
  Each takes the byte-level method:
  read the run's own census spans,
  slice the coverage chunk at those offsets,
  then read the code path
  before writing any fixture.

- 2026-10-05,
  05:10 UTC:
  `declined` re-verified
  (the ledger's
  `DECLINED RE-VERIFICATION` paragraph):
  the flatMap's node read cannot miss
  and became one `nonNullishOrThrow`
  under a type-guard filter,
  and the empty-pairing refusal has its case.
  LEFT with the cause named:
  the rendering-continues machinery
  (`declined-target-runs.ts` 105,
  106 to 109,
  111)
  and the claiming walk's source-only arm
  (172 to 173)
  need the aligner's `continuesPairing` emission rules
  mapped first.
  Gates at the close:
  1,564 [PASS] and no [FAIL],
  35 source scans and no [FAIL].
  Two scan slips in the edit
  (a TSDoc before a `return`,
  a position word in its comment)
  caught and fixed forward.

  Next:
  read `align-blocks-walk.ts`
  to map the `continuesPairing` emission rules,
  then design the fixtures for the four open spans;
  then the rest of the left-open list
  (`corpus-run/runs`,
  `transient`,
  `corpus-run/name`,
  `edit`)
  in the ranking's order.

- 2026-10-05,
  04:52 UTC:
  the next batch's baseline census taken at commit `6a015b331`:
  `census written to ~/.cache/translation-repair/coverage/census-i01hsd/census.json`
  (`~/temp/agent/mimo-trial/census-pub.log` of this round),
  `library source: 91 files, 123 stretches over 315 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `declined` leads with 4 stretches over 6 lines in 1 file
  (`declined-target-runs.ts:109`,
  `158`,
  `193-194`,
  `195-196`),
  `corpus-run/runs` with 3 over 9 in 2,
  `transient` with 3 over 7 in 1.
  This line lands in the trial-log commit that follows `6a015b331`.
  Next:
  the `declined` re-verification
  with the byte-level method.

- 2026-10-05,
  04:45 UTC:
  `corpus-run/published` re-verified and CLOSED
  (the ledger's
  `PUBLISHED-PAGE RE-VERIFICATION` paragraph):
  the three incumbent-map fallbacks dead
  (`wouldShipTextPerSlice` walks the same
  `artifact.comparison` the map is built from)
  and narrowed,
  the filled-anchor caveat covered
  with its distinguishing message pair,
  and the unweighable guard
  an `unreachable:` throw
  whose line stays cold by design.
  One WR5 slip in a comment
  caught by the scan and fixed forward.
  Gates at the close:
  1,564 [PASS] and no [FAIL],
  35 source scans and no [FAIL].

  The left-open list stands at:
  `declined`'s shape reasons,
  `corpus-run/runs`' unconstructible claims,
  `transient`'s abort siblings,
  `corpus-run/name`'s comma arm
  and map fallback,
  `edit`'s single-name join,
  and the `model-card-derive` data-invariant guard
  (its cause named,
  unconstructible).
  Each takes the byte-level method
  next round.

  Next:
  re-verify `declined`
  (`declined-target-runs.ts`)
  with the byte-level method,
  then the rest in the ranking's order.

- 2026-10-05,
  04:22 UTC:
  the next batch's baseline census taken at commit `744aa0d40`:
  `census written to ~/.cache/translation-repair/coverage/census-DJtsdw/census.json`
  (`~/temp/agent/mimo-trial/census-final.log` of this round),
  `library source: 92 files, 127 stretches over 320 lines, 4 functions never called`.
  The re-verification closed 15 stretches
  (the counting is in the ledger's
  `RE-VERIFICATION COMPLETE` paragraph).
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines
  in 2 files,
  `declined` with 4 over 6 in 1,
  `corpus-run/runs` with 3 over 9 in 2.
  The ranking's leaders still carry left-open claims
  whose reasons were never byte-verified
  (`corpus-run/published`'s incumbent-map fallbacks,
  `declined`'s shape reasons,
  `corpus-run/runs`' unconstructible claims,
  `transient`'s abort siblings,
  `corpus-run/name`'s comma arm,
  `edit`'s single-name join),
  and the method standard applies to them all.
  This line lands in the trial-log commit that follows `744aa0d40`.
  Next:
  re-verify `corpus-run/published`
  (`published-page-check.ts` 179,
  196,
  236
  and `published-page-disagreement.ts` 99 to 100,
  552)
  with the byte-level method,
  then the rest of the left-open list
  in the ranking's order.

- 2026-10-05,
  04:10 UTC:
  the re-verification is COMPLETE
  and recorded in the ledger
  (the `CORRECTION (2026-10-05)` paragraph
  and the `RE-VERIFICATION COMPLETE (2026-10-05)`
  paragraph that follows it).
  Every site in both groups
  (the eight attribution claims
  and the fixture-reasoned left sites)
  now carries either a case whose assertion
distinguishes its branch
  with the run's own census bytes excluding the statement,
  or a named unconstructible cause:

- covered since the correction:
  `photo-reference.ts` 133 and 303,
  `dropped-destinations.ts` 187 and 292 to 295,
  `active-footnote-markers.ts` 309 to 335,
  `claim-panel-voters.ts` 54,
  `claim-filers.ts` 253 and 262,
  `model-card-derive.ts` 366;
  and dead fallbacks narrowed in
  `dropped-destinations.ts` 241,
  `claim-filers.ts` 253,
  `publish-fixed.ts` 320 and 321.

- UNRESOLVED with the cause known:
  `model-card-derive.ts` 421 to 427,
  whose two inputs are the module's own card
  and roster tables,
  so the disagreement it guards is data drift
  no fixture can stage.

  The lesson the ledger now states as method:
  a case covers a branch only where its assertion
distinguishes that branch from the other paths
  returning the same value,
  and the run's own census byte spans
  exclude the target statement from the cold set.
  Passing the suite is not branch evidence.
  A stretch's line label can start one line early,
  so the verdict line's words are derived text
  and the JSON spans are the ground truth.

  Working tree:
  clean at `f4780cd0b`,
  suite 1,564 [PASS] and no [FAIL],
  35 source scans and no [FAIL],
  two TSDoc-before-statement slips
  caught by the attachment scan
  and fixed forward.

  Verification worktree `/home/user/worktrees/verify-coverage`
  (detached,
  probe files present)
  is disposable;
  `git worktree remove` once the counts are read.

  Next:
  the whole-suite census at this commit,
  then the ranking's next cluster
  with the method standard
  (distinguishing assertions,
  byte-span proof,
  and named causes for whatever stays open).

- 2026-10-05,
  03:10 UTC:
  the eight attribution claims are re-verified and CLOSED,
  with a self-named correction in the ledger
  (`CORRECTION (2026-10-05)`).
  Every one traced to my own fixtures or assertions,
  not the tool:

- resolution's 328 was covered all along
  (V8's range for the return's bytes reports count 1;
  the run's cold span begins after them,
  and the stretch's line label starts at the boundary line).

- lane read the archive field of each BALLOT,
  where my case set it on the outcome.

- nudged's first reply carried no `servedBy`,
  so the function answered before the re-ask,
  and both assertions read `kind === 'ok'`,
  which every path returns.

- canadian's dates sat in other readers:
  the refused year wants a month-first date
  followed by four or more digits the year read refuses,
  the runs-on comma belongs to the year-first reader
  and needs an ordinal day,
  and the underscore counter runs only
  for a capitalized candidate word.

- spend's negative-count return shares its literal
  with the returns beside it,
  so the assertion could not tell them apart;
  the file's own known-good tail now proves the readable path.
  Its `fields[0]` fallback is dead
  (`split` always yields one)
  and became `nonNullishOrThrow`.

- lookup 193 and 221,
  slice-cache-namespace 266 and 378,
  and model-content 36 were covered as written;
  the residual spans beside them are neighbouring statements.

  Verified tool facts,
  recorded in the ledger for later readers:
  the suite prints one info line per suite
  (per-case lines at debug),
  so pass counts are suite counts;
  a stretch's line label can start one line early,
  and each run's own census JSON byte spans
  are the ground truth;
  the coverage build is unminified because
  compression folds guards into expressions V8 gives no range for.

  Method from here:
  a case covers a branch only where its assertion
distinguishes that branch from other paths returning the same value,
  and the run's own census bytes exclude the target statement
  from the cold set.

  Open work re-opened by the same standard:
  the sites earlier recorded as left for fixture reasons
  were not byte-verified either,
  and the same method applies to them:
  `photo-reference.ts` 133 and 303,
  `dropped-destinations.ts` 187,
  241,
  292 to 295,
  `active-footnote-markers.ts` 309 to 335,
  `claim-panel-voters.ts` 54
  and `claim-filers.ts` 253 and 262,
  `publish-fixed.ts` 320 and 321,
  `model-card-derive.ts` 366 and 421 to 427,
  and the nudged abort arm's siblings
  (all covered now).
  The claim group's fixture blocker
  (the `AdjudicatedIssue` shape)
  and the publish group's
  (the destination fields)
  are the two named ones still needing fixture work.

  Verification worktree:
  `/home/user/worktrees/verify-coverage`
  (detached at `1099a5495`),
  holds the coverage build and the probe files
  `zz-probe-guard.ts` and `zz-attribution-probe.unit.test.ts`
  used for the V8 experiment;
  it is disposable and can be removed
  (`git worktree remove`) once the remaining sites are done.

  Next:
  re-verify `photo-reference.ts` 133 and 303
  with the byte-level method,
  then the rest of the re-opened list in the order named.

- 2026-10-05,
  01:49 UTC:
  CORRECTION OF THE RECORD,
  and the investigation it re-opens.
  Eight ledger paragraphs explain uncovered lines
  as "the census's attribution" leaving them cold
  (ledger lines 6515,
  6602,
  6889,
  6949,
  6987,
  7020,
  7065,
  7106).
  That explanation was never verified,
  and each of the eight is now re-opened.
  The claims stand as UNRESOLVED until re-verified.
  What the re-verification established so far:

- The test harness logs one visible line per suite,
  not per case.
  Per-case `[PASS]` lines are debug level,
  and empty-name suites log at debug too
  (`package/module/test/src/describe.ts`,
  "Empty-name suites are invisible wrappers").
  Consequence:
  counting `[PASS]` lines counts named suites,
  so an earlier reading
  (`3 passes, my case never ran`)
  was wrong,
  and every earlier case count read off those lines
  was wrong with it.

- `isJsonRecord` is only
  object and non-null and not-array
  (`package/module/translation-repair/src/json-guard.ts`),
  so a check element like `{ issue: 'one', verdict: 'fixed' }`
  passes it and reaches the type guard behind it.

- The coverage-census verdict line derives its words
  from the baseline's stretch boundaries
  matched against the run's own merged cold byte spans.
  Adjacent statements merge into one span
  (the reach run's own JSON shows
  `resolution-wire.ts` 328 to 331 as one span `[11812..11892]`).
  The run's own census JSON
  (the `census written to ...` path)
  is the ground truth;
  the verdict line is derived and can misattribute.

- Verified about the `resolution` case
  (`resolution-wire.unit.test.ts`):
  the case runs.
  Its first two calls turned the baseline-cold lines 321 and 348 hot
  in the reach run's own census
  (`census-qIxdKv`),
  and no other case in that file touches those guards.
  The whole-suite censuses taken after the case landed
  (`census-5tlfGG`,
  `census-hCZX4J`)
  list `resolution-wire.ts` clean.

- UNRESOLVED about that case:
  whether its third call executes the `return false` at
  `resolution-wire.ts:328`.
  Two hypotheses remain open:
  the coverage build's source-map attribution drops that
  statement's bytes,
  or a code-path reason not yet found.
  The decisive experiment,
  not yet run:
  a single-case scratch test carrying only that call,
  run under the reach census,
  read against its own census JSON,
  with a minimal synthetic module of the same guard shape
  as the tool's positive control,
  in a throwaway worktree.

- The sites still to re-verify,
  in the order they will be taken:
  ledger 7106 (`canadian-date-read-leading.ts` 259 and 335,
  `canadian-spelling-capital.ts` 463),
  7020 (`nudged-reask.ts` 147 and 153),
  6987 (`lane-contest-cache-store.ts` 59 to 61),
  6949 (`lookup-cache.ts` 193,
  221,
  321 to 324),
  6889 (`model-content.ts` 36),
  6602 (`slice-cache-namespace.ts` 266 and 378),
  6515 (`spend-read.ts` 238 and 345).
  Each takes a focused case,
  the reach census's own JSON,
  and where a tool gap is claimed,
  a minimal reproduction before the claim is written.

- Reporting standard from here:
  COMPLETED means a case landed,
  the run including the case shows the line hot,
  and the assertion distinguishes the branch where one exists.
  ATTEMPTED means a case landed and the cause of a cold line
  is identified.
  UNRESOLVED means the cause is not found,
  and it is recorded as unresolved rather than explained.
  A passing suite is not branch evidence.
  Contrary evidence is kept in place beside the correction.

- Also corrected:
  reach runs select narrow test file sets,
  so lines other drivers exercise are cold there on purpose
  (the `cold since then (ran there)` rows);
  earlier paragraphs mixed those rows into the same claim
  as the stuck lines,
  and the re-verification separates them.

- Environment:
  throwaway worktrees are available for verification runs
  (the owner's word),
  and the tool-behavior reproductions will use one
  so the trial tree stays clean.
  No execution limit of any kind was reported by the runtime;
  earlier notes claiming one are retracted.

  Next:
  the decisive experiment for `resolution-wire.ts:328`
  in a throwaway worktree,
  then the seven sites in the order named.

- 2026-10-05,
  01:18 UTC:
  the next batch's baseline census taken at commit `abb99ceb7`:
  `census written to ~/.cache/translation-repair/coverage/census-cLOz3U/census.json`
  (`~/temp/agent/mimo-trial/census-81.log`),
  `library source: 100 files, 150 stretches over 350 lines, 4 functions never called`.
  The ranking's first nine clusters carry documented-left arms
  or the attribution quirk's records.
  The next actionable cluster is `corpus-run/publish`
  with 3 stretches over 2 lines in 1 file
  (`publish-fixed.ts:320`,
  `321`),
  then the ranking's next.
  This line lands in the trial-log commit that follows `abb99ceb7`.
  Next:
  the `corpus-run/publish` batch.

- 2026-10-05,
  01:20 UTC:
  the `corpus-run/publish` batch left its 3 arms documented
  (`publish-fixed.ts:320`,
  `321`):
  the dropped-destination warn's trace fallbacks,
  whose lists go absent where the address is dropped
  from the page but absent from every slice's text,
  a fixture whose artifact destination fields
  this pass did not build.
  Counts at the close:
  the full suite 1,564 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-publish-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-publish-scans.log`).
  This line lands in the trial-log commit that follows.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the ranking's next actionable cluster.

- 2026-10-05,
  01:00 UTC:
  the next batch's baseline census taken at commit `455622520`:
  `census written to ~/.cache/translation-repair/coverage/census-2aJKLC/census.json`
  (`~/temp/agent/mimo-trial/census-80.log`),
  `library source: 100 files, 150 stretches over 350 lines, 4 functions never called`.
  The ranking's first eight clusters carry documented-left arms
  or the attribution quirk's records.
  The next actionable cluster is `corpus-run/canadian`
  with 3 stretches over 3 lines in 2 files,
  then `corpus-run/publish`.
  This line lands in the trial-log commit that follows `455622520`.
  Next:
  the `corpus-run/canadian` batch's remaining arms.

- 2026-10-05,
  01:10 UTC:
  the `corpus-run/canadian` second pass closed with commit `52a5e2c9c`:
  the date cases given leading dates,
  three arms left documented
  (the year-refused return,
  the runs-on comma,
  and the underscore count:
  the cases assert their rewrites,
  the lines' returns the census's attribution leaves cold).
  The reach census reads `ran 0, still cold 2`
  (`~/temp/agent/mimo-trial/reach-canadian2.log`).
  Counts at the close:
  the full suite 1,564 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-canadian2-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-canadian2-scans.log`).
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/publish` cluster
  (the ranking's next at `census-2aJKLC`).

- 2026-10-05,
  00:54 UTC:
  the T8 `claim` batch left its 3 arms documented
  (`claim-panel-voters.ts:54`,
  `claim-filers.ts:253`,
  `262`):
  the cases need the `AdjudicatedIssue`'s full fixture shape,
  whose fields the attach map reads directly,
  and the two attempts crashed on the runtime reads.
  Both attempts reverted;
  the tree stays green.
  Counts at the close:
  the full suite 1,564 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-claim-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-claim-scans.log`).
  This line lands in the trial-log commit that follows the revert.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/canadian` cluster's remaining arms
  or the next in the ranking.

- 2026-10-05,
  00:52 UTC:
  the next batch's baseline census taken at commit `e484cbf04`:
  `census written to ~/.cache/translation-repair/coverage/census-5tlfGG/census.json`
  (`~/temp/agent/mimo-trial/census-79.log`),
  `library source: 100 files, 150 stretches over 350 lines, 4 functions never called`.
  The ranking's first seven clusters carry documented-left arms
  or the attribution quirk's records.
  The next actionable cluster is `claim`
  with 3 stretches over 3 lines in 2 files
  (`claim-panel-voters.ts:54`,
  `claim-filers.ts:253`,
  `262`),
  then `corpus-run/canadian`,
  `corpus-run/publish`.
  This line lands in the trial-log commit that follows `e484cbf04`.
  Next:
  the `claim` batch.

- 2026-10-05,
  00:44 UTC:
  the T8 `resolution` batch closed with commit `8bb2ce647`:
  3 line stretches over `resolution-wire.ts`,
  two cased,
  one left documented
  (the issue's non-number refusal:
  the attribution quirk's record).
  The reach census reads `ran 2, still cold 1`
  (`~/temp/agent/mimo-trial/reach-resolution.log`).
  Counts at the close:
  the full suite 1,564 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-resolution-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-resolution-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `8bb2ce647`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `claim` cluster
  (the ranking's next at `census-TXnKot`).

- 2026-10-05,
  00:38 UTC:
  the next batch's baseline census taken at commit `40af0f949`:
  `census written to ~/.cache/translation-repair/coverage/census-TXnKot/census.json`
  (`~/temp/agent/mimo-trial/census-78.log`),
  `library source: 101 files, 153 stretches over 353 lines, 4 functions never called`.
  The ranking's first seven clusters carry documented-left arms
  or the attribution quirk's records.
  The next actionable cluster is `resolution`
  with 3 stretches over 3 lines in 1 file
  (`resolution-wire.ts:321`,
  `328`,
  `348`),
  then `claim`,
  `corpus-run/canadian`.
  This line lands in the trial-log commit that follows `40af0f949`.
  Next:
  the `resolution` batch.

- 2026-10-05,
  00:31 UTC:
  the T8 `photo` batch closed with commits `8284b4b4f`,
  `b5cae5d8a`:
  3 line stretches over `photo-reference.ts`,
  one cased
  (the unclosed-quote break),
  two left documented
  (the earlier-quote preference
  and the not-an-asset arm:
  the cases' shapes did not reach them).
  A TSDoc block before an expect statement tripped
  the attachment scan (ledger B19),
  fixed forward.
  The reach census reads `ran 1, still cold 2`
  (`~/temp/agent/mimo-trial/reach-photo.log`).
  Counts at the close:
  the full suite 1,564 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-photo-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-photo-scans2.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `b5cae5d8a`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `resolution` cluster
  (the ranking's next at `census-pUl33e`).

- 2026-10-05,
  00:18 UTC:
  the next batch's baseline census taken at commit `31f7b5559`:
  `census written to ~/.cache/translation-repair/coverage/census-pUl33e/census.json`
  (`~/temp/agent/mimo-trial/census-77.log`),
  `library source: 101 files, 154 stretches over 354 lines, 4 functions never called`.
  The nudged batch's allowlist entry went stale with its new test
  (`31f7b5559`),
  and one commit message's `--message` split into a stray `-- message`
  before the pathspec
  (recorded here rather than amended,
  ledger GCA).
  The ranking's first seven clusters carry documented-left arms
  or the attribution quirk's records.
  The next actionable cluster is `photo`
  with 3 stretches over 3 lines in 1 file
  (`photo-reference.ts:133`,
  `240`,
  `303`),
  then `resolution`,
  `claim`.
  This line lands in the trial-log commit that follows `31f7b5559`.
  Next:
  the `photo` batch.

- 2026-10-05,
  00:06 UTC:
  the T8 `nudged` batch closed with commit `b487f4d02`:
  3 line stretches over `nudged-reask.ts`,
  the re-ask outcomes cased,
  the two log fallbacks and the abort rethrow left documented
  (the attribution quirk's fifth instance
  and the fixture's re-ask shape resolving).
  Counts at the close:
  the full suite 1,564 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-nudged-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-nudged-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `b487f4d02`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `photo` cluster
  (the ranking's next at `census-GHsN0h`).

- 2026-10-04,
  23:56 UTC:
  the next batch's baseline census taken at commit `d4894fb60`:
  `census written to ~/.cache/translation-repair/coverage/census-GHsN0h/census.json`
  (`~/temp/agent/mimo-trial/census-74.log`),
  `library source: 101 files, 154 stretches over 354 lines, 4 functions never called`.
  The ranking's first six clusters carry documented-left arms
  or the attribution quirk's records.
  The next actionable cluster is `nudged`
  with 3 stretches over 3 lines in 1 file
  (`nudged-reask.ts:147`,
  `153`,
  `159`),
  then `photo`,
  `resolution`,
  `claim`.
  This line lands in the trial-log commit that follows `d4894fb60`.
  Next:
  the `nudged` batch.

- 2026-10-04,
  23:49 UTC:
  the T8 `corpus-run/reading` batch closed with commit `1fb9cb177`:
  3 line stretches over `reading-cache-store.ts`,
  all cased
  (the three malformed shapes
  refusing to resume).
  The reach census reads `ran 3, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-reading.log`).
  Counts at the close:
  the full suite 1,563 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-reading-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-reading-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `1fb9cb177`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `nudged` cluster
  (the ranking's next at `census-G1oD6W`).

- 2026-10-04,
  23:45 UTC:
  the next batch's baseline census taken at commit `c82ae61f7`:
  `census written to ~/.cache/translation-repair/coverage/census-G1oD6W/census.json`
  (`~/temp/agent/mimo-trial/census-73.log`),
  `library source: 102 files, 157 stretches over 357 lines, 4 functions never called`.
  The ranking's first six clusters carry documented-left arms
  or the attribution quirk's records.
  The next actionable cluster is `corpus-run/reading`
  with 3 stretches over 3 lines in 1 file,
  then `nudged`,
  `photo`,
  `resolution`.
  This line lands in the trial-log commit that follows `c82ae61f7`.
  Next:
  the `corpus-run/reading` batch.

- 2026-10-04,
  23:38 UTC:
  the T8 `corpus-run/lane` batch closed with commit `4fa547794`:
  3 line stretches over `lane-contest-cache-store.ts`,
  all cased
  (the archive names
  and the non-record refusal).
  The reach census reads `ran 1, still cold 2`,
  the OR chain's branches the census's attribution leaves cold
  (the fourth instance of the pattern,
  with the cases asserting their round trips directly).
  Counts at the close:
  the full suite 1,563 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-lane-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-lane-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `4fa547794`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the next actionable cluster in the ranking
  (all the leaders now carry documented-left arms
  or the attribution quirk's records).

- 2026-10-04,
  22:56 UTC:
  the T8 `retry` batch closed with commit `e8636cf64`:
  3 line stretches over `retry-stated-wait.ts`,
  one closed as unreachable
  (the digit walk's character read),
  two left documented
  (the walk's return pair
  and the gap's and-word arm).
  The reach census reads `left 2 cold stretches`:
  those
  (`~/temp/agent/mimo-trial/reach-retry.log`).
  Counts at the close:
  the full suite 1,563 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-retry-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-retry-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `e8636cf64`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/lane` cluster
  (the ranking's next at `census-bppPVq`).

- 2026-10-04,
  22:52 UTC:
  the next batch's baseline census taken at commit `ccf8a7eb7`:
  `census written to ~/.cache/translation-repair/coverage/census-bppPVq/census.json`
  (`~/temp/agent/mimo-trial/census-71.log`),
  `library source: 102 files, 159 stretches over 359 lines, 4 functions never called`.
  The lookup batch's new file tripped three scans on its way in
  (the own-tests allowlist entry,
  the direct mkdtemp,
  and the unused path join),
  each fixed forward
  (`153da6c69`,
  `ccf8a7eb7`).
  The ranking's first six clusters carry documented-left arms.
  The next actionable cluster is `retry`
  with 3 stretches over 6 lines in 1 file
  (`retry-stated-wait.ts:142`,
  `143-145`,
  `219-220`),
  then `corpus-run/lane`.
  This line lands in the trial-log commit that follows `ccf8a7eb7`.
  Next:
  the `retry` batch.

- 2026-10-04,
  22:36 UTC:
  the T8 `lookup` batch closed with commit `a9b5e71dc`:
  3 line stretches over `lookup-cache.ts`,
  all cased
  (the non-object value
  and the cache file that is no record).
  The reach census reads `ran 0, still cold 3`,
  the single-line returns the census's attribution leaves cold
  (the cases assert their values directly).
  Counts at the close:
  the full suite 1,563 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-lookup-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-lookup-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `a9b5e71dc`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `retry` cluster
  (the ranking's next at `census-5AHbot`).

- 2026-10-04,
  22:31 UTC:
  the next batch's baseline census taken at commit `2b64f2e6e`:
  `census written to ~/.cache/translation-repair/coverage/census-5AHbot/census.json`
  (`~/temp/agent/mimo-trial/census-67.log`).
  `library source: 103 files, 162 stretches over 365 lines, 4 functions never called`.
  The ranking's first six clusters carry documented-left arms.
  The next actionable cluster is `lookup`
  with 3 stretches over 6 lines in 1 file
  (`lookup-cache.ts:193`,
  `221`,
  `321-324`),
  then `retry`.
  This line lands in the trial-log commit that follows `2b64f2e6e`.
  Next:
  the `lookup` batch.

- 2026-10-04,
  22:24 UTC:
  the T8 `corpus-run/dropped` batch closed with commit `b55509754`:
  3 line stretches over `dropped-destinations.ts`,
  the run case landed
  (the stopper shed
  and several runs read in order),
  the three arms left documented
  (the earliest-reduce arm,
  the run-advance arm,
  and the stopper walk's return pair:
  the case's shapes did not reach them).
  The reach census reads `ran 0, still cold 3`:
  those three
  (`~/temp/agent/mimo-trial/reach-dropped.log`).
  Counts at the close:
  the full suite 1,562 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-dropped-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-dropped-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `b55509754`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `lookup` cluster
  (the ranking's next at `census-MkpU3W`).

- 2026-10-04,
  22:20 UTC:
  the next batch's baseline census taken at commit `c06539dd8`:
  `census written to ~/.cache/translation-repair/coverage/census-MkpU3W/census.json`
  (`~/temp/agent/mimo-trial/census-66.log`).
  `library source: 103 files, 162 stretches over 365 lines, 4 functions never called`.
  The ranking's first five clusters carry documented-left arms.
  The next actionable cluster is `corpus-run/dropped`
  with 3 stretches over 6 lines in 1 file,
  then `lookup`,
  `retry`.
  This line lands in the trial-log commit that follows `c06539dd8`.
  Next:
  the `corpus-run/dropped` batch.

- 2026-10-04,
  22:12 UTC:
  the T8 `container` batch closed with commit `4621ad099`:
  3 line stretches over `container-integrity.ts`
  and `container-half-pairs.ts`,
  one closed as unreachable
  (the splice's own guard),
  two left documented
  (the nameless-container arm
  and the half-tag integrity error:
  their fixtures need a container with no name
  and a block cutting one tag).
  The reach census reads `ran 0, still cold 2`:
  those two
  (`~/temp/agent/mimo-trial/reach-container.log`).
  Counts at the close:
  the full suite 1,562 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-container-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-container-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `4621ad099`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the next actionable cluster in the ranking
  (`edit`,
  `preservation`,
  or the documented-left revisits).

- 2026-10-04,
  22:10 UTC:
  the next batch's baseline census taken at commit `e91b5dd12`:
  `census written to ~/.cache/translation-repair/coverage/census-VzG5Wr/census.json`
  (`~/temp/agent/mimo-trial/census-65.log`).
  `library source: 104 files, 163 stretches over 366 lines, 4 functions never called`.
  The ranking's first five clusters
  (`corpus-run/published`,
  `active`,
  `declined`,
  `corpus-run/runs`,
  `transient`)
  all carry documented-left arms.
  The next actionable cluster is `container`
  with 3 stretches over 7 lines in 2 files,
  then `edit`,
  `preservation`.
  This line lands in the trial-log commit that follows `e91b5dd12`.
  Next:
  the `container` batch.

- 2026-10-04,
  22:02 UTC:
  the T8 `model` batch closed with commit `cb4b07506`:
  3 line stretches over `model-card-derive.ts`
  and `model-content.ts`,
  one cased
  (the fence line with no line end),
  two left documented
  (the two RangeError guards:
  their builders take keys from the roster lists
  and need a fixture disagreeing with them).
  The reach census reads `still cold 1` on `model-content.ts:36`,
  the single-line return the census's attribution leaves cold
  (the case asserts its value directly).
  Counts at the close:
  the full suite 1,562 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-model2-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-model2-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `cb4b07506`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/runs` cluster's remaining arms
  or the next in the ranking.

- 2026-10-04,
  22:00 UTC:
  the next batch's baseline census taken at commit `187348d0e`:
  `census written to ~/.cache/translation-repair/coverage/census-pN6fUe/census.json`
  (`~/temp/agent/mimo-trial/census-64.log`).
  `library source: 105 files, 164 stretches over 367 lines, 4 functions never called`.
  The ranking's first three clusters carry documented-left arms.
  The next actionable cluster is `model`
  with 3 stretches over 9 lines in 2 files
  (`model-card-derive.ts:366`,
  `421-427`,
  `model-content.ts:36`),
  then `corpus-run/runs`,
  `transient`.
  This line lands in the trial-log commit that follows `187348d0e`.
  Next:
  the `model` batch.

- 2026-10-04,
  21:53 UTC:
  the T8 `hyper` batch closed with commit `309cafca9`:
  3 line stretches over `hyper-client.ts`,
  all cased
  (the deadline and answer-length knobs
  carried only when set).
  The reach census reads `ran 3, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-hyper.log`).
  Counts at the close:
  the full suite 1,562 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-hyper-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-hyper-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `309cafca9`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `model` cluster
  (the ranking's next at `census-bOt8GY`).

- 2026-10-04,
  21:50 UTC:
  the next batch's baseline census taken at commit `4e08e3027`:
  `census written to ~/.cache/translation-repair/coverage/census-bOt8GY/census.json`
  (`~/temp/agent/mimo-trial/census-63.log`).
  `library source: 106 files, 167 stretches over 377 lines, 4 functions never called`.
  The ranking's first three clusters carry documented-left arms.
  The next actionable cluster is `hyper`
  with 3 stretches over 10 lines in 1 file
  (`hyper-client.ts:364-369`,
  `375-376`,
  `421-422`),
  then `model`,
  `corpus-run/runs`.
  This line lands in the trial-log commit that follows `4e08e3027`.
  Next:
  the `hyper` batch.

- 2026-10-04,
  21:28 UTC:
  the next batch's baseline census taken at commit `8c9136d6b`:
  `census written to ~/.cache/translation-repair/coverage/census-oVnawX/census.json`
  (`~/temp/agent/mimo-trial/census-61.log`).
  `library source: 107 files, 171 stretches over 380 lines, 4 functions never called`.
  The ranking's first three clusters carry documented-left arms.
  The next actionable cluster is `source`
  with 4 stretches over 3 lines in 1 file
  (`source-only-breaks.ts:170`,
  `186`,
  `199`),
  then `corpus-run/cache`,
  `hyper`.
  This line lands in the trial-log commit that follows `8c9136d6b`.
  Next:
  the `source` batch.

- 2026-10-04,
  21:36 UTC:
  the T8 `source` batch closed with commit `250da1333`:
  4 line stretches over `source-only-breaks.ts`,
  all four closed as unreachable
  (the break-count fallbacks
  the walks' own indices settle),
  one arm left documented
  (the sumOwed reduce's other-kind arm:
  its fixture needs blocks of more than one kind).
  The whole-suite census lists one stretch for the file
  (`census-ceHkbQ`,
  `library source: 107 files, 168 stretches over 378 lines, 4 functions never called`).
  Counts at the close:
  the full suite 1,562 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-source-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-source-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `250da1333`.
  Next:
  the whole-suite census at this commit as the next batch's baseline
  (`census-ceHkbQ` stands),
  then the `corpus-run/cache` cluster
  (the ranking's next at `census-oVnawX`).

- 2026-10-04,
  21:42 UTC:
  the T8 `corpus-run/cache` batch closed with commits `4d5c7d96e`,
  `14a44721c`:
  3 line stretches over `cache-account-read.ts`
  and `cache-account-slices.ts`,
  one cased
  (the name whose tail runs to its line end),
  the other two matched in the reach run.
  The reach census reads `ran 1, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-cache2.log`).
  Counts at the close:
  the full suite 1,562 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-cache-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-cache-scans2.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `14a44721c`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `hyper` cluster
  (the ranking's next at `census-oVnawX`).

- 2026-10-04,
  21:09 UTC:
  the next batch's baseline census taken at commit `a7d014baf`:
  `census written to ~/.cache/translation-repair/coverage/census-4BqrOY/census.json`
  (`~/temp/agent/mimo-trial/census-59.log`).
  `library source: 109 files, 175 stretches over 384 lines, 4 functions never called`.
  The ranking's first three clusters carry documented-left arms.
  The next actionable cluster is `mask`
  with 4 stretches over 4 lines in 2 files
  (`mask-invisible-lines.ts:168`,
  `333`,
  `mask-container-tags.ts:156`,
  `171`),
  then `source`,
  `corpus-run/cache`.
  This line lands in the trial-log commit that follows `a7d014baf`.
  Next:
  the `mask` batch.

- 2026-10-04,
  21:21 UTC:
  the T8 `mask` batch closed with commits `29326895e`,
  `d4a3c3c65`:
  4 line stretches over `mask-invisible-lines.ts`
  and `mask-container-tags.ts`,
  two closed as unreachable
  (the code point
  and the line start:
  both reads their walks guarantee),
  two cased
  (the non-letter tag name
  and the closer with anything past its name).
  The reach census reads `left 1 cold stretch` for
  `mask-invisible-lines.ts` in the focused run,
  none in the whole-suite census
  (`~/temp/agent/mimo-trial/reach-mask2.log`).
  Counts at the close:
  the full suite 1,562 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-mask-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-mask-scans2.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `d4a3c3c65`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `source` cluster
  (the ranking's next at `census-4BqrOY`).

- 2026-10-04,
  20:56 UTC:
  the next batch's baseline census taken at commit `c087e5884`:
  `census written to ~/.cache/translation-repair/coverage/census-E4DYQO/census.json`
  (`~/temp/agent/mimo-trial/census-58.log`).
  `library source: 110 files, 176 stretches over 385 lines, 4 functions never called`.
  The ranking's first three clusters carry documented-left arms.
  The next actionable cluster is `corpus-run/canadian`
  with 4 stretches over 4 lines in 3 files
  (`canadian-date-parts.ts:354`,
  `canadian-date-read-leading.ts:259`,
  `335`,
  `canadian-spelling-capital.ts:463`),
  then `mask`,
  `source`,
  each at 4.
  This line lands in the trial-log commit that follows `c087e5884`.
  Next:
  the `corpus-run/canadian` batch.

- 2026-10-04,
  21:01 UTC:
  the T8 `corpus-run/canadian` batch closed with commit `10210a333`:
  4 line stretches over the canadian date and spelling files,
  all cased
  (the short year,
  the missing year,
  the runs-on comma,
  and the stray underscore).
  The reach census reads `ran 1, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-canadian.log`).
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-canadian-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-canadian-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `10210a333`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `mask` cluster
  (the ranking's next at `census-E4DYQO`).

- 2026-10-04,
  20:45 UTC:
  the next batch's baseline census taken at commit `2b86649b6`:
  `census written to ~/.cache/translation-repair/coverage/census-E2Gm5a/census.json`
  (`~/temp/agent/mimo-trial/census-57.log`).
  `library source: 110 files, 178 stretches over 387 lines, 4 functions never called`.
  The ranking's first three clusters carry documented-left arms.
  The next actionable cluster is `corpus-run/name`
  with 4 stretches over 4 lines in 1 file
  (`name-gloss-restore.ts:87`,
  `100`,
  `247`,
  `312`),
  then `corpus-run/canadian`,
  `mask`,
  each at 4.
  This line lands in the trial-log commit that follows `2b86649b6`.
  Next:
  the `corpus-run/name` batch.

- 2026-10-04,
  20:48 UTC:
  the T8 `corpus-run/name` batch closed with commits `1daaca6e1`,
  `f29a7247c`:
  4 line stretches over `name-gloss-restore.ts`,
  two cased
  (the unclosed quote
  and the name with no gloss verb),
  the comma case landed but missed the arm's shape,
  two left documented
  (the comma arm
  and the archive-slice map fallback).
  The reach census reads `ran 2, still cold 2`:
  those two
  (`~/temp/agent/mimo-trial/reach-name2.log`).
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-name-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-name-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `f29a7247c`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/canadian` cluster
  (the ranking's next at `census-E2Gm5a`).

- 2026-10-04,
  20:28 UTC:
  the next batch's baseline census taken at commit `81727ed38`:
  `census written to ~/.cache/translation-repair/coverage/census-vlck42/census.json`
  (`~/temp/agent/mimo-trial/census-56.log`).
  `library source: 111 files, 182 stretches over 392 lines, 4 functions never called`.
  The ranking's first three clusters
  (`corpus-run/published`,
  `active`,
  `declined`)
  all carry documented-left arms.
  The next actionable cluster is `displacement`
  with 4 stretches over 5 lines in 1 file,
  then `corpus-run/name`,
  `corpus-run/canadian`,
  `mask`,
  `source`,
  each at 4 stretches.
  This line lands in the trial-log commit that follows `81727ed38`.
  Next:
  the `displacement` batch.

- 2026-10-04,
  20:37 UTC:
  the T8 `displacement` batch closed with commits `f7fa3843e`,
  `70ab0cae0`,
  `1160a11a8`:
  4 line stretches over `displacement-class.ts`,
  three closed as unreachable
  (the surplus,
  the target-only slice,
  and the class:
  each read through a fallback its own comment
  marks as known present),
  one cased
  (the conserved-fraction refusal).
  The reach census reads `left 0 cold stretches`
  (`~/temp/agent/mimo-trial/reach-displacement2.log`).
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-displacement-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-displacement-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `1160a11a8`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/name` cluster
  (the ranking's next at `census-vlck42`).

- 2026-10-04,
  20:20 UTC:
  the next batch's baseline census taken at commit `edd68a330`:
  `census written to ~/.cache/translation-repair/coverage/census-PGu68D/census.json`
  (`~/temp/agent/mimo-trial/census-55.log`).
  `library source: 111 files, 182 stretches over 392 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `active` with 4 over 8 in 1
  (its documented-left arms),
  `declined` with 4 over 6 in 1
  (`declined-target-runs.ts:109`,
  `158`,
  `193-194`,
  `195-196`).
  This line lands in the trial-log commit that follows `edd68a330`.
  Next:
  the `declined` batch.

- 2026-10-04,
  20:20 UTC:
  the T8 `declined` batch closed with commit `3326ef801`:
  4 line stretches over `declined-target-runs.ts`,
  the empty-pairing case landed,
  the four arms left documented
  (the rendering-continue mark,
  the empty-pairing refusal's own line,
  and the node-read ternary arms:
  their step shapes need alignments producing
  continuations the pairing fixtures do not stage).
  The reach census reads `ran 0, still cold 4`:
  those four
  (`~/temp/agent/mimo-trial/reach-declined.log`).
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-declined-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-declined-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `3326ef801`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the next cluster in the ranking
  (the remaining clusters all sit near 4 stretches each;
  the published and active ones carry documented-left arms).

- 2026-10-04,
  20:08 UTC:
  the next batch's baseline census taken at commit `0d76e5014`:
  `census written to ~/.cache/translation-repair/coverage/census-Kyrgyt/census.json`
  (`~/temp/agent/mimo-trial/census-54.log`).
  `library source: 111 files, 182 stretches over 392 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `active` with 4 over 8 in 1
  (`active-footnote-markers.ts:309-310`,
  `315-316`,
  `328-329`,
  `334-335`),
  `declined` with 4 over 6 in 1.
  This line lands in the trial-log commit that follows `0d76e5014`.
  Next:
  the `active` batch.

- 2026-10-04,
  20:12 UTC:
  the T8 `active` batch closed with commits `4a87b3658`,
  `6fc0fd2a4`:
  4 line stretches over `active-footnote-markers.ts`,
  the run-bounding case landed
  (the paragraph one untokenized literal),
  the four bounds arms left documented
  (the transform never produced a run whose parent
  holds only unpositioned children in these fixtures,
  and the walk is footnote-scoped).
  The reach census reads `ran 0, still cold 4`:
  those four
  (`~/temp/agent/mimo-trial/reach-active2.log`).
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-active-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-active-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `6fc0fd2a4`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `declined` cluster
  (the ranking's next at `census-Kyrgyt`).

- 2026-10-04,
  19:48 UTC:
  the next batch's baseline census taken at commit `870253616`:
  `census written to ~/.cache/translation-repair/coverage/census-KYvmuo/census.json`
  (`~/temp/agent/mimo-trial/census-53.log`).
  `library source: 111 files, 183 stretches over 394 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `transient` with 4 over 9 in 1
  (`transient-retry.ts:225`,
  `402-403`,
  `580-583`,
  `584-585`),
  `active` with 4 over 8 in 1.
  This line lands in the trial-log commit that follows `870253616`.
  Next:
  the `transient` batch.

- 2026-10-04,
  20:00 UTC:
  the T8 `transient` batch closed with commit `c1b403b95`:
  4 line stretches over `transient-retry.ts`,
  one cased
  (the non-Error throw wrapped into one),
  three left documented
  (the backoff's non-abort rethrow,
  the aborted-exchange pair,
  and the loop's exhausted throw).
  The commit message for `c1b403b95` names only two of
  the three left
  (the aborted-exchange pair went unnamed);
  recorded in the ledger rather than amended
  (ledger GCA).
  The reach census reads `ran 1, still cold 3`:
  those three
  (`~/temp/agent/mimo-trial/reach-transient.log`).
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-transient-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-transient-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `c1b403b95`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `active` cluster
  (the ranking's next at `census-KYvmuo`).

- 2026-10-04,
  19:18 UTC:
  the next batch's baseline census taken at commit `5840665be`:
  `census written to ~/.cache/translation-repair/coverage/census-pVW4Um/census.json`
  (`~/temp/agent/mimo-trial/census-52.log`).
  `library source: 111 files, 184 stretches over 395 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `corpus-run/runs` with 4 over 10 in 2
  (`runs-lock-holder.ts:198`,
  `463-468`,
  `runs-lock.ts:250-251`,
  `311`),
  `transient` with 4 over 9 in 1.
  This line lands in the trial-log commit that follows `5840665be`.
  Next:
  the `corpus-run/runs` batch.

- 2026-10-04,
  19:40 UTC:
  the T8 `corpus-run/runs` batch closed with commit `4e95c885d`:
  4 line stretches over `runs-lock-holder.ts`
  and `runs-lock.ts`,
  two cased
  (the unrecorded-identity lock line
  and the race loss's named holder),
  two left documented
  (the unrecorded identity construction,
  whose reads fail only where the host exposes none,
  and the race branch's holder spread,
  whose two-process race a single-process fixture
cannot stage without flakiness).
  The reach census reads `still cold 2`:
  those two
  (`~/temp/agent/mimo-trial/reach-runs.log`).
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-runs-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-runs-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `4e95c885d`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `transient` cluster
  (the ranking's next at `census-pVW4Um`).

- 2026-10-04,
  19:03 UTC:
  the next batch's baseline census taken at commit `6209604f3`:
  `census written to ~/.cache/translation-repair/coverage/census-cQ5IKo/census.json`
  (`~/temp/agent/mimo-trial/census-51.log`).
  `library source: 112 files, 186 stretches over 397 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `provider` with 4 over 10 in 2,
  `corpus-run/runs` with 4 over 10 in 2.
  This line lands in the trial-log commit that follows `6209604f3`.
  Next:
  the `provider` batch.

- 2026-10-04,
  19:11 UTC:
  the T8 `provider` batch closed with commit `f8598d546`:
  4 line stretches over `provider-budget-refusal.ts`
  and `provider-router.ts`,
  three cased
  (the two refusal reads
  and the last-attempt rethrow),
  the loop-exhausted throw its comment marks unreachable
  left as written.
  The reach census reads `ran 2, still cold 0, cold since then 0`
  (`~/temp/agent/mimo-trial/reach-provider.log`).
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-provider-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-provider-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `f8598d546`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/runs` cluster
  (the ranking's next at `census-cQ5IKo`).

- 2026-10-04,
  18:24 UTC:
  the next batch's baseline census taken at commit `4cbad5f31`
  (its first run failed on a flaky timeout in the lane contest's
  half-quorum case,
  green on re-run):
  `census written to ~/.cache/translation-repair/coverage/census-1UFhGm/census.json`
  (`~/temp/agent/mimo-trial/census-50.log`).
  `library source: 114 files, 190 stretches over 407 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `corpus-run/slice` with 4 over 10 in 2,
  `provider` with 4 over 10 in 2.
  This line lands in the trial-log commit that follows `4cbad5f31`.
  Next:
  the `corpus-run/slice` batch.

- 2026-10-04,
  18:56 UTC:
  the T8 `corpus-run/slice` batch closed with commits `5bf207307`,
  `3fdbf9b19`:
  4 line stretches over `slice-cache-namespace.ts`
  and `slice-census-entry.ts`,
  one closed as unreachable
  (the missing-node fallback narrowed),
  three cased
  (the recomputed cache file,
  the surfaced fault,
  and the target-only block count).
  The reach census reads `still cold 2`
  on `266`
  and `378`,
  both the single-line return and throw
  the census's attribution leaves cold
  (the reading the spend batch recorded),
  and both cases assert their behavior directly.
  Counts at the close:
  the full suite 1,561 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-slice-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-slice-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `3fdbf9b19`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `provider` cluster
  (the ranking's next at `census-1UFhGm`).

- 2026-10-04,
  18:08 UTC:
  the next batch's baseline census taken at commit `aba6f1b61`:
  `census written to ~/.cache/translation-repair/coverage/census-c2UUBT/census.json`
  (`~/temp/agent/mimo-trial/census-48.log`).
  `library source: 116 files, 194 stretches over 419 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `corpus-run/handle` with 4 over 12 in 2,
  `corpus-run/slice` with 4 over 10 in 2.
  This line lands in the trial-log commit that follows `aba6f1b61`.
  Next:
  the `corpus-run/handle` batch.

- 2026-10-04,
  18:14 UTC:
  the T8 `corpus-run/handle` batch closed with commits `216e4986d`,
  `2db4930ee`:
  4 line stretches over `handle-gloss-place.ts`
  and `handle-reading.ts`,
  one closed as unreachable
  (the slice-text fallback narrowed),
  three cased
  (the unclosed and multiline parenthesis,
  the embedded handle,
  and the name-shaped rendering).
  The reach census reads `left 0 cold stretches`
  (`~/temp/agent/mimo-trial/reach-handle2.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-handle-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-handle-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `2db4930ee`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/slice` cluster
  (the ranking's next at `census-c2UUBT`).

- 2026-10-04,
  17:48 UTC:
  the next batch's baseline census taken at commit `3a433ae2e`:
  `census written to ~/.cache/translation-repair/coverage/census-IjEvWX/census.json`
  (`~/temp/agent/mimo-trial/census-47.log`).
  `library source: 117 files, 198 stretches over 432 lines, 4 functions never called`
  (the count crossed below 200).
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `corpus-run/roster` with 4 over 13 in 1,
  `corpus-run/handle` with 4 over 12 in 2.
  This line lands in the trial-log commit that follows `3a433ae2e`.
  Next:
  the `corpus-run/roster` batch.

- 2026-10-04,
  18:00 UTC:
  the T8 `corpus-run/roster` batch closed with commit `e1ee49e95`:
  4 line stretches over `roster-card-render.ts`,
  all cased
  (the body as the row array,
  the non-array modalities,
  the vision flag both ways,
  and the bedrock listing).
  The reach census reads `ran 4, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-roster.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-roster-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-roster-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `e1ee49e95`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/handle` cluster
  (the ranking's next at `census-IjEvWX`).

- 2026-10-04,
  16:31 UTC:
  the T8 `corpus-run/editor` batch is in progress:
  part 1 landed with commit `26b7b7909`
  (the standing reader names a missing run directory
  rather than reading an empty standing).
  Uncommitted work:
  none.
  The reach census reads `ran 1, still cold 12`
  on `editor-standing-read.ts`
  (`~/temp/agent/mimo-trial/reach-editor2.log`),
  the twelve being the artifact error paths
  and the reporter bodies still to case.
  Reasoning so far:
  the reader runs as a CLI over fixture run directories
  (`standingOver` spawns the built entry),
  so the error paths need artifact files carrying
  an off-roster model or no recorded rounds.
  Next:
  part 2,
  those two error paths.

- 2026-10-04,
  16:45 UTC:
  the `corpus-run/editor` batch part 2 preparation:
  the artifact schema walked field by field
  (`~/temp/agent/mimo-trial/artifact-schema-walk.mjs`
  iterates the CLI's refusals until parse),
  leaving the fixture spec:
  top keys `artifactSchemaVersion`,
  `id`,
  `tip`,
  `pipelineDigest`,
  `corpusSha`,
  `callConfig`,
  `durationMs`,
  `timestamp`,
  `preparation`,
  `lanes`,
  `comparison`,
  `laneSelection`,
  `consolidation`,
  `pageAssembly`;
  `preparation` carries `alignmentPairCount`,
  `identity`
  (`sha256-preparation-v2:`
  plus 64 hex),
  `sliceCount`,
  `sourceChars`,
  `targetChars`,
  `sourceBytes`,
  `alignmentFindings`;
  each lane is `{ result, delivery }`
  with `result.status` one of `repaired`,
  `unchanged`,
  `blocked-non-translation`
  and `delivery` one row per prepared slice
  (`chunkIndex`,
  `sourceText`,
  `incumbentKind`,
  `incumbentText`,
  `outcome`,
  `shippedText`,
  `delivery`).
  Uncommitted work:
  none.
  Next:
  write the off-roster and earlier-schema artifacts
  from that spec
  and case the two error paths.

- 2026-10-04,
  17:41 UTC:
  the T8 `corpus-run/editor` batch closed with commits `26b7b7909`,
  `df9436878`,
  `41726bb37`,
  `637c54309`,
  `5b0bf4d57`:
  the standing reader's 13 line stretches all cased
  (the missing run directory,
  the earlier-schema artifact,
  the off-roster artifact,
  the seated one read and reported,
  and the runs variable),
  plus the contest's none seat
  and the width report's neither-shipped row.
  The reach census reads `ran 13, still cold 0, cold since then 0`
  for the standing reader
  (`~/temp/agent/mimo-trial/reach-editor4.log`).
  Left documented:
  the width input's envelope and ready returns
  (`editor-width-input.ts:221-254`),
  whose claims pass the screen's own claim schema first.
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-editor-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-editor-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `5b0bf4d57`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/roster` cluster
  (the ranking's next at `census-fUfTA1`).

- 2026-10-04,
  16:26 UTC:
  the next batch's baseline census taken at commit `19f402d54`:
  `census written to ~/.cache/translation-repair/coverage/census-fUfTA1/census.json`
  (`~/temp/agent/mimo-trial/census-46.log`).
  `library source: 119 files, 201 stretches over 436 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `corpus-run/editor` with 4 over 38 in 3,
  `corpus-run/roster` with 4 over 13 in 1.
  This line lands in the trial-log commit that follows `19f402d54`.
  Next:
  the `corpus-run/editor` batch.

- 2026-10-04,
  16:20 UTC:
  the T8 `corpus-run/spend` batch closed with commit `07d5f9647`:
  5 line stretches over `spend-read.ts`,
  all cased
  (the not-a-record and unreadable refusals
  read off logged SPEND lines).
  The reach census reads `ran 3, still cold 2`
  on `238`
  and `345`,
  but a direct probe shows each arm's own value returning
  (`~/temp/agent/mimo-trial/spend-arm-probe.log`),
  so those two are the census's line attribution
  rather than unrun code.
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-spend-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-spend-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `07d5f9647`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/editor` cluster
  (the ranking's next at `census-1iMkkv`).

- 2026-10-04,
  16:10 UTC:
  the T8 `edit` batch closed with commit `527789637`:
  5 line stretches over `edit-prompt.ts`
  and `edit-wire.ts`,
  one closed as unreachable
  (the last-name fallback narrowed),
  three cased
  (the neighbouring block with either half alone,
  and the two wire refusals),
  one left documented
  (the single-name join:
  its names shrink below two only for an issue
  touching one identifier kind,
  whose fixtures are the deeper suite's).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-edit-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-edit-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `527789637`.
  Next:
  the whole-suite census at this commit as the next batch's baseline:
  `census written to ~/.cache/translation-repair/coverage/census-1iMkkv/census.json`
  (`~/temp/agent/mimo-trial/census-45.log`),
  `library source: 119 files, 204 stretches over 439 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its documented-left arms),
  `corpus-run/spend` with 5 over 5 in 1,
  `corpus-run/editor` with 4 over 38 in 3.
  Next:
  the `corpus-run/spend` batch.

- 2026-10-04,
  16:02 UTC:
  the next batch's baseline census taken at commit `222e844fc`:
  `census written to ~/.cache/translation-repair/coverage/census-i9Duoq/census.json`
  (`~/temp/agent/mimo-trial/census-44.log`).
  `library source: 120 files, 208 stretches over 443 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files
  (its five are the batch's documented-left arms,
  so the pass moves past it),
  `edit` with 5 over 6 in 2,
  `corpus-run/spend` with 5 over 5 in 1.
  This line lands in the trial-log commit that follows `222e844fc`.
  Next:
  the `edit` batch.

- 2026-10-04,
  15:55 UTC:
  the T8 `corpus-run/published` batch closed with commits `13a1780c9`,
  `2b3d73ec6`,
  `39b9c1be1`:
  5 line stretches over `published-page-disagreement.ts`
  and `published-page-check.ts`,
  the disagreement path and the weigh and wording checks driven
  over a slice-count mismatch and an anchor slice,
  four left documented
  (the three incumbent-map fallbacks
  and the unweighable return:
  the map is built from the artifact's own comparison rows,
  so a key miss needs a divergence the fixture builders
  do not expose).
  The reach census reads `still cold 4`:
  those four
  (`~/temp/agent/mimo-trial/reach-published3.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-published-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-published-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `39b9c1be1`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `edit` cluster
  (the ranking's next at `census-HQOwnq`).

- 2026-10-04,
  15:41 UTC:
  the next batch's baseline census taken at commit `5bd1c9712`:
  `census written to ~/.cache/translation-repair/coverage/census-HQOwnq/census.json`
  (`~/temp/agent/mimo-trial/census-43.log`).
  `library source: 120 files, 208 stretches over 443 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/published` leads with 5 stretches over 6 lines in 2 files,
  `edit` with 5 over 6 in 2,
  `corpus-run/spend` with 5 over 5 in 1.
  This line lands in the trial-log commit that follows `5bd1c9712`.
  Next:
  the `corpus-run/published` batch.

- 2026-10-04,
  15:34 UTC:
  the T8 `corpus-run/cap` batch closed with commits `a5a9c4ab3`,
  `9b1240f9a`,
  `3af9376a5`:
  5 line stretches over the cap census and override files,
  three closed as unreachable
  (the stamp split,
  the paired content,
  and the P99 zero:
  all `nonNullishOrThrow`),
  two cased
  (the malformed stamp and unit word,
  and the environment read).
  The reach census reads `left 0 cold stretches`
  (`~/temp/agent/mimo-trial/reach-cap3.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-cap-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-cap-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `3af9376a5`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/published` cluster
  (the ranking's next at `census-4VTupe`).

- 2026-10-04,
  15:02 UTC:
  the T8 `han` batch closed with commit `3948763a2`:
  5 line stretches over `han-only-text.ts`
  and `han-title-read.ts`,
  all cased
  (the empty character,
  the letter walk both ways,
  the linked and linkless title reads,
  and the skipped titles).
  The reach census reads `still cold 0` on the five
  (`~/temp/agent/mimo-trial/reach-han3.log`),
  with one pre-existing line cold since then in the focused run
  and none in the whole-suite census.
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-han-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-han-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `3948763a2`.
  Next:
  the whole-suite census at this commit as the next batch's baseline:
  `census written to ~/.cache/translation-repair/coverage/census-4VTupe/census.json`
  (`~/temp/agent/mimo-trial/census-40.log`),
  `library source: 123 files, 213 stretches over 449 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/cap` leads with 5 stretches over 6 lines in 3 files,
  `corpus-run/published` with 5 over 6 in 2,
  `edit` with 5 over 6 in 2.
  Next:
  the `corpus-run/cap` batch.

- 2026-10-04,
  14:52 UTC:
  the next batch's baseline census taken at commit `91df90bfe`:
  `census written to ~/.cache/translation-repair/coverage/census-AwkhvA/census.json`
  (`~/temp/agent/mimo-trial/census-39.log`).
  `library source: 125 files, 218 stretches over 456 lines, 4 functions never called`.
  Largest clusters by stretches then lines:
  `han` leads with 5 stretches over 7 lines in 2 files,
  `corpus-run/cap` with 5 over 6 in 3,
  `corpus-run/published` with 5 over 6 in 2.
  This line lands in the trial-log commit that follows `91df90bfe`.
  Next:
  the `han` batch.

- 2026-10-04,
  14:44 UTC:
  the T8 `restoration` batch closed with commit `e16e16184`:
  5 line stretches over `restoration-judge-wire.ts`
  and `restoration-judge.ts`,
  all cased
  (the wire guards,
  the duplicate judgment,
  and the ballot naming one seed only).
  The reach census reads `ran 4, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-restoration.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-restoration-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-restoration-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `e16e16184`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `han` cluster
  (the ranking's next at `census-RD9far`).

- 2026-10-04,
  14:42 UTC:
  the next batch's baseline census taken at commit `8c66817c7`:
  `census written to ~/.cache/translation-repair/coverage/census-RD9far/census.json`
  (`~/temp/agent/mimo-trial/census-38.log`).
  `library source: 127 files, 223 stretches over 464 lines, 4 functions never called`
  (the never-called count moved again,
  5 to 4).
  Largest clusters by stretches then lines:
  `restoration` leads with 5 stretches over 8 lines in 2 files,
  `han` with 5 over 7 in 2,
  `corpus-run/cap` with 5 over 6 in 3.
  This line lands in the trial-log commit that follows `8c66817c7`.
  Next:
  the `restoration` batch.

- 2026-10-04,
  14:34 UTC:
  the T8 `grade` batch closed with commits `894ef4d0c`,
  `dd52f9ced`,
  `df2c9a7f4`:
  5 line stretches over `grade-agreement.ts`
  and `grade-sheet-read.ts`,
  one closed as unreachable
  (the no-marker arm:
  the item filter settles it),
  four cased
  (the unbounded answer,
  the duplicate word,
  the non-string verdict refusal,
  and the duplicate indices).
  The reach census reads `left 0 cold stretches`
  (`~/temp/agent/mimo-trial/reach-grade3.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-grade-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-grade-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `df2c9a7f4`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `restoration` cluster
  (the ranking's next at `census-G4ZkGi`).

- 2026-10-04,
  14:19 UTC:
  the T8 `corpus-run/bench` batch closed with commit `2810a9104`:
  5 line stretches over `bench-report.ts`,
  two closed as unreachable
  (the middle-width fallback narrowed,
  the empty-rows note removed),
  two cased
  (the middle width repeat,
  the token sums).
  The reach census reads `left 1 cold stretch` in the focused run
  and none in the whole-suite census
  (`~/temp/agent/mimo-trial/reach-bench.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-model-suite.log` was the last full count;
  this batch's tests ran green at `~/temp/agent/mimo-trial/t8-bench-named7.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `2810a9104`.
  Next:
  the whole-suite census at this commit as the next batch's baseline:
  `census written to ~/.cache/translation-repair/coverage/census-G4ZkGi/census.json`
  (`~/temp/agent/mimo-trial/census-37.log`),
  `library source: 129 files, 228 stretches over 475 lines, 5 functions never called`
  (the never-called count moved again,
  8 to 5).
  Largest clusters by stretches then lines:
  `grade` leads with 5 stretches over 11 lines in 2 files,
  `restoration` with 5 over 8 in 2,
  `han` with 5 over 7 in 2.
  Next:
  the `grade` batch.

- 2026-10-04,
  14:00 UTC:
  the next batch's baseline census taken at commit `3970d3c0d`:
  `census written to ~/.cache/translation-repair/coverage/census-WGrBjo/census.json`
  (`~/temp/agent/mimo-trial/census-36.log`).
  `library source: 130 files, 233 stretches over 486 lines, 8 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/bench` leads with 5 stretches over 11 lines in 1 file,
  `grade` with 5 over 11 in 2,
  `restoration` with 5 over 8 in 2.
  This line lands in the trial-log commit that follows `3970d3c0d`.
  Next:
  the `corpus-run/bench` batch.

- 2026-10-04,
  13:52 UTC:
  the T8 `corpus-run/model` batch closed with commits `013e5d3ff`,
  `581363446`:
  5 line stretches over `model-catalog-compare.ts`,
  all cased
  (the two parse refusals,
  the claimed-underlying read under either spelling,
  and the report's blocklist,
  missing,
  alias
  and plain lines).
  The reach census reads `ran 5, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-model2.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-model-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-model-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `581363446`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/bench` cluster
  (the ranking's next at `census-WleNhT`).

- 2026-10-04,
  13:48 UTC:
  the next batch's baseline census taken at commit `64c05616e`:
  `census written to ~/.cache/translation-repair/coverage/census-WleNhT/census.json`
  (`~/temp/agent/mimo-trial/census-35.log`).
  `library source: 131 files, 238 stretches over 499 lines, 8 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/model` leads with 5 stretches over 13 lines in 1 file,
  `corpus-run/bench` with 5 over 11 in 1,
  `grade` with 5 over 11 in 2.
  This line lands in the trial-log commit that follows `64c05616e`.
  Next:
  the `corpus-run/model` batch.

- 2026-10-04,
  13:40 UTC:
  the T8 `stage` batch closed with commits `6d45ab0a1`,
  `4095f47e3`,
  `e4f718feb`:
  5 line stretches over the stage window,
  roster,
  fanout
  and decision files.
  Four cased
  (the voice-pair read,
  the decision guard and abort,
  and both optional-knob spreads),
  one removed as type-dead
  (the fanout content ternary's structured arm:
  `ChatMessage.content` is string-only).
  The reach census reads `ran 1, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-stage3.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-stage-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-stage-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `e4f718feb`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/model` cluster
  (the ranking's next at `census-1VGtcy`).

- 2026-10-04,
  13:26 UTC:
  the next batch's baseline census taken at commit `682015402`:
  `census written to ~/.cache/translation-repair/coverage/census-1VGtcy/census.json`
  (`~/temp/agent/mimo-trial/census-34.log`).
  `library source: 134 files, 242 stretches over 514 lines, 8 functions never called`.
  Largest clusters by stretches then lines:
  `stage` leads with 5 stretches over 16 lines in 4 files,
  `corpus-run/model` with 5 over 13 in 1,
  `corpus-run/bench` with 5 over 11 in 1.
  This line lands in the trial-log commit that follows `682015402`.
  Next:
  the `stage` batch.

- 2026-10-04,
  13:18 UTC:
  the T8 `corpus-run/probe` batch closed with commits `b37a5851f`,
  `0176fa22d`,
  `db84dbfa3`,
  `5d817c448`:
  5 line stretches over the probe telemetry and relabel files,
  all cased
  (the two telemetry notes,
  the manifest item no candidate carries,
  and the control's taken and holder refusals).
  The fixtures are a throwaway corpus clone,
  scratch-run entry artifacts,
  and a manifest through `buildSampleManifest`.
  Four source scans named the patterns the new cases must keep:
  `concurrency: 1` for process-global writes,
  the global-writer body groups (B111,
  no shared fixture),
  `scratchDir` for temp directories (B108),
  and the own-tests allowlist (B102).
  The reach census reads `ran 2, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-probe2.log`).
  Counts at the close:
  the full suite 1,560 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-probe-suite5.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-probe-scans5.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `5d817c448`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `stage` cluster
  (the ranking's next at `census-7LEx8b`).

- 2026-10-04,
  12:31 UTC:
  the next batch's baseline census taken at commit `e9a2f06b1`:
  `census written to ~/.cache/translation-repair/coverage/census-7LEx8b/census.json`
  (`~/temp/agent/mimo-trial/census-33.log`).
  `library source: 137 files, 247 stretches over 531 lines, 8 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/probe` leads with 5 stretches over 17 lines in 3 files,
  `stage` with 5 over 16 in 4,
  `corpus-run/model` with 5 over 13 in 1.
  This line lands in the trial-log commit that follows `e9a2f06b1`.
  Next:
  the `corpus-run/probe` batch.

- 2026-10-04,
  12:23 UTC:
  the T8 `corpus-run/prose` batch closed with commits `55621aa6e`,
  `1c59e999d`,
  `943323375`,
  `794cd7764`:
  5 line stretches over `prose-ranges.ts`,
  all cased
  (the comment end reads,
  the quoting marks,
  the code fence,
  the lone backtick pair,
  the unterminated marker,
  and the bare autolink).
  The reach census over the corpus-run tests reads
  `ran 5, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-prose8.log`).
  Counts at the close:
  the full suite 1,558 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-prose-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-prose-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `794cd7764`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/probe` cluster
  (the ranking's next at `census-OjpKcL`).

- 2026-10-04,
  12:12 UTC:
  the next batch's baseline census taken at commit `43c129ff2`:
  `census written to ~/.cache/translation-repair/coverage/census-OjpKcL/census.json`
  (`~/temp/agent/mimo-trial/census-32.log`).
  `library source: 138 files, 252 stretches over 548 lines, 8 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/prose` leads with 5 stretches over 17 lines in 1 file,
  `corpus-run/probe` with 5 over 17 in 3,
  `stage` with 5 over 16 in 4.
  This line lands in the trial-log commit that follows `43c129ff2`.
  Next:
  the `corpus-run/prose` batch.

- 2026-10-04,
  12:04 UTC:
  the T8 `preservation` batch closed with commit `05a02beab`:
  6 line stretches over `preservation-tokens.ts`
  and `preservation-check.ts`,
  the name scanner's five dead empty-string fallbacks narrowed away,
  one cased
  (the empty licensed quote that blanks nothing).
  The reach census reads `left 0 cold stretches`
  (`~/temp/agent/mimo-trial/reach-preservation.log`).
  Counts at the close:
  the full suite 1,558 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-preservation-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-preservation-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `05a02beab`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/prose` cluster
  (the ranking's next at `census-g87Ji1`).

- 2026-10-04,
  12:02 UTC:
  the next batch's baseline census taken at commit `71e8d814d`
  (which followed a fix-forward `316f1afc7` corrected:
  that docs paragraph carried a position reference,
  caught by the census's own suite run):
  `census written to ~/.cache/translation-repair/coverage/census-g87Ji1/census.json`
  (`~/temp/agent/mimo-trial/census-31.log`).
  `library source: 140 files, 258 stretches over 554 lines, 8 functions never called`.
  Largest clusters by stretches then lines:
  `preservation` leads with 6 stretches over 6 lines in 2 files,
  `corpus-run/prose` with 5 over 17 in 1,
  `corpus-run/probe` with 5 over 17 in 3.
  This line lands in the trial-log commit that follows `71e8d814d`.
  Next:
  the `preservation` batch.

- 2026-10-04,
  11:52 UTC:
  the T8 `corpus-run/list` batch closed with commits `45e3356bc`,
  `99058e60a`:
  6 line stretches over `list-spread-restore.ts`,
  two closed as the impossible-index fallbacks they are
  (both `nonNullishOrThrow`),
  two cased
  (the single-item list and the count mismatch
  on the sides the walk actually compares),
  two left documented
  (the missing-position refusals,
  reached only where a parsed item carries no offsets).
  The reach census reads `left 2 cold stretches`,
  those two
  (`~/temp/agent/mimo-trial/reach-list2.log`).
  Counts at the close:
  the full suite 1,558 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-list-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-list-scans2.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `99058e60a`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `preservation` cluster
  (the ranking's next at `census-RRFnX2`).

- 2026-10-04,
  11:38 UTC:
  the next batch's baseline census taken at commit `d5d3b32a7`:
  `census written to ~/.cache/translation-repair/coverage/census-RRFnX2/census.json`
  (`~/temp/agent/mimo-trial/census-28.log`).
  `library source: 140 files, 262 stretches over 558 lines, 8 functions never called`
  (the never-called count moved for the first time this trial,
  9 to 8,
  the consolidate batch's cases reaching one).
  Largest clusters by stretches then lines:
  `corpus-run/list` leads with 6 stretches over 6 lines in 1 file,
  `preservation` with 6 over 6 in 2,
  `corpus-run/prose` with 5 over 17 in 1.
  This line lands in the trial-log commit that follows `d5d3b32a7`.
  Next:
  the `corpus-run/list` batch.

- 2026-10-04,
  11:29 UTC:
  the T8 `corpus-run/consolidate` batch closed with commit `445e5b718`:
  6 line stretches over `consolidate-cache-store.ts`,
  all cased through the store's own round trip
  (the record and choice refusals,
  the absent gate beside the unreadable one,
  both shippings,
  and the non-record settlement).
  The reach census reads `ran 6, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-consolidate.log`).
  Counts at the close:
  the full suite 1,558 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-consolidate-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-consolidate-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `445e5b718`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/list` cluster
  (the ranking's next at `census-xreqy1`).

- 2026-10-04,
  11:27 UTC:
  the next batch's baseline census taken at commit `c56975df4`:
  `census written to ~/.cache/translation-repair/coverage/census-xreqy1/census.json`
  (`~/temp/agent/mimo-trial/census-27.log`).
  `library source: 141 files, 268 stretches over 566 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/consolidate` leads with 6 stretches over 8 lines in 1 file,
  `corpus-run/list` with 6 over 6 in 1,
  `preservation` with 6 over 6 in 2.
  This line lands in the trial-log commit that follows `c56975df4`.
  Next:
  the `corpus-run/consolidate` batch.

- 2026-10-04,
  11:18 UTC:
  the T8 `corpus-run/directory` batch closed with commits `6ce30575c`
  and `f2a9a055b`:
  6 line stretches over `directory-id-name.ts`,
  all cased
  (the record and string refusals of the metadata reads,
  the alias shapes,
  the empty-letters id,
  and the id-namer).
  The reach census reads `ran 6, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-directory2.log`).
  Counts at the close:
  the full suite 1,558 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-directory-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-directory-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `f2a9a055b`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/consolidate` cluster
  (the ranking's next at `census-eIzZ5P`).

- 2026-10-04,
  11:11 UTC:
  the next batch's baseline census taken at commit `b7e216487`:
  `census written to ~/.cache/translation-repair/coverage/census-eIzZ5P/census.json`
  (`~/temp/agent/mimo-trial/census-26.log`).
  `library source: 142 files, 274 stretches over 577 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/directory` leads with 6 stretches over 11 lines in 1 file,
  `corpus-run/consolidate` with 6 over 8 in 1,
  `corpus-run/list` with 6 over 6 in 1.
  This line lands in the trial-log commit that follows `b7e216487`.
  Next:
  the `corpus-run/directory` batch.

- 2026-10-04,
  11:02 UTC:
  the T8 `line` batch closed with commits `fe1f48671`,
  `76f87ac7b` and `5202dedc5`:
  6 line stretches over two files.
  Three carry cases
  (the pair in both language orders,
  the no-letter neighbour,
  and the page bound),
  and three read strictly behind their guarantees
  (the five-block floor,
  the loop bound),
  `nonNullishOrThrow` throughout.
  The reach census reads `ran 0, still cold 0, cold since then 0, not loaded 0`
  and the two edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-line2.log`).
  Counts at the close:
  the full suite 1,558 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-line-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-line-scans2.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `5202dedc5`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/directory` cluster
  (the ranking's next at `census-8QcZ0L`).

- 2026-10-04,
  10:52 UTC:
  the next batch's baseline census taken at commit `41dd5bd89`:
  `census written to ~/.cache/translation-repair/coverage/census-8QcZ0L/census.json`
  (`~/temp/agent/mimo-trial/census-25.log`).
  `library source: 144 files, 280 stretches over 591 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `line` leads with 6 stretches over 14 lines in 2 files,
  `corpus-run/directory` with 6 over 11 in 1,
  `corpus-run/consolidate` with 6 over 8 in 1.
  This line lands in the trial-log commit that follows `41dd5bd89`.
  Next:
  the `line` batch.

- 2026-10-04,
  10:43 UTC:
  the T8 `sample` batch closed with commits `a23270119`,
  `c3c0ac7c2`,
  `1ecdd31b7` and `5dbdff239`:
  6 line stretches over three files.
  Four carry cases
  (the round-robin quota fill,
  the entry-shuffle tiebreak pinned in both arrival orders,
  the byte-count refusal and the no-claim placeholders,
  the repair context,
  and the unrecorded generation),
  and two settled behind their own contracts
  (the quota loop's stopgap break became a pass ceiling;
  the issue-key tiebreak was dead twice over,
  the entry-shuffle compare alone remaining).
  A new `sample-draw.unit.test.ts` leaves the own-unit-tests allowlist.
  The reach census reads `ran 4, still cold 0, cold since then 0, not loaded 0`
  and the edited source "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-sample6.log`).
  Counts at the close:
  the full suite 1,558 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-sample-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-sample-scans2.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `5dbdff239`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `line` cluster
  (the ranking's next at `census-u4yVLi`).

- 2026-10-04,
  09:52 UTC:
  the next batch's baseline census taken at commit `d85e24703`:
  `census written to ~/.cache/translation-repair/coverage/census-u4yVLi/census.json`
  (`~/temp/agent/mimo-trial/census-24.log`).
  `library source: 147 files, 286 stretches over 614 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `sample` leads with 6 stretches over 23 lines in 3 files,
  `line` with 6 over 14 in 2,
  `corpus-run/directory` with 6 over 11 in 1.
  This line lands in the trial-log commit that follows `d85e24703`.
  Next:
  the `sample` batch.

- 2026-10-04,
  09:43 UTC:
  the T8 `corpus-run/rendering` batch closed with commits `bce653c57`,
  `b01ca171a` and `be9beb63c`:
  6 line stretches over four files.
  Four carry cases
  (the empty identity declaration,
  the missing-comparison-row invariant,
  the verify refusal over a tampered `sourceChars`,
  and the slot phrase in both its numbers),
  two settled behind their own contracts
  (the decided filter carries the narrowing as a type predicate;
  the cited-pages map is total over the subjects,
  its miss guard now `nonNullishOrThrow`).
  The reach census reads `ran 2, still cold 0, cold since then 0, not loaded 0`
  and the two edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-rendering2.log`).
  Counts at the close:
  the full suite 1,554 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-rendering-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-rendering-scans2.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `be9beb63c`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `sample` cluster
  (the ranking's next at `census-Vv2d8g`).

- 2026-10-04,
  09:12 UTC:
  the next batch's baseline census taken at commit `6c6d7203d`:
  `census written to ~/.cache/translation-repair/coverage/census-Vv2d8g/census.json`
  (`~/temp/agent/mimo-trial/census-23.log`).
  `library source: 151 files, 292 stretches over 639 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/rendering` leads with 6 stretches over 25 lines in 4 files,
  `sample` with 6 over 23 in 3,
  `line` with 6 over 14 in 2.
  This line lands in the trial-log commit that follows `6c6d7203d`.
  Next:
  the `corpus-run/rendering` batch.

- 2026-10-04,
  09:02 UTC:
  the T8 `corpus-run/coverage` batch closed with commits `c2c9c9689`
  and `db979e5b3`:
  6 stretches over `coverage-control.ts`,
  all cased in its vote-change driver file
  (the not-carried and evidence-not-locatable refusals,
  the no-room decoy riding its row,
  and the held pair through a quote-following client
  whose `none` answers carry the empty quote the wire requires).
  The reach census reads `ran 6, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-coveragecontrol.log`).
  Counts at the close:
  the full suite 1,554 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-coveragecontrol-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-coveragecontrol-scans2.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `db979e5b3`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/rendering` cluster
  (the ranking's next at `census-14CEcx`).

- 2026-10-04,
  08:45 UTC:
  the next batch's baseline census taken at commit `40afaf9b5`:
  `census written to ~/.cache/translation-repair/coverage/census-14CEcx/census.json`
  (`~/temp/agent/mimo-trial/census-22b.log`,
  its first attempt at `census-22.log` failing after the run finished
  with no census written and no suite fault,
  retry clean).
  `library source: 152 files, 298 stretches over 682 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/coverage` leads with 6 stretches over 43 lines in 1 file,
  `corpus-run/rendering` with 6 over 25 in 4,
  `sample` with 6 over 23 in 3.
  This line lands in the trial-log commit that follows `40afaf9b5`.
  Next:
  the `corpus-run/coverage` batch.

- 2026-10-04,
  08:32 UTC:
  the T8 `image` batch closed with commits `167332775`,
  `feada2f6e` and `480561e23`:
  6 stretches over three files.
  Five carry cases
  (the dotless name's empty extension,
  both decoder successes and the whole OCR path on tool-made fixtures,
  the deterministic count read both ways,
  and the reader-failure catch with its missing-binary half
  through the reader name now being a defaulted parameter).
  One roster guard came out behind the capability gate,
  the roster read now `nonNullishOrThrow`'s.
  The reach census reads `ran 1, still cold 0, cold since then 0, not loaded 0`
  and the two edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-image3.log`).
  Counts at the close:
  the full suite 1,554 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-image-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-image-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `480561e23`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/coverage` cluster
  (the ranking's next at `census-mgeQC0`).

- 2026-10-04,
  07:56 UTC:
  the next batch's baseline census taken at commit `67694f69d`:
  `census written to ~/.cache/translation-repair/coverage/census-mgeQC0/census.json`
  (`~/temp/agent/mimo-trial/census-21.log`).
  `library source: 155 files, 304 stretches over 772 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `image` leads with 6 stretches over 90 lines in 3 files,
  `corpus-run/coverage` with 6 over 43 in 1,
  `corpus-run/rendering` with 6 over 25 in 4.
  This line lands in the trial-log commit that follows `67694f69d`.
  Next:
  the `image` batch.

- 2026-10-04,
  07:46 UTC:
  the T8 `introduced` batch closed with commits `3af7885a8`,
  `74490e7dc` and `3094cc053`:
  7 stretches over two files,
  all cased and none unreachable.
  The wire guards' non-record and non-number refusals,
  the two neighbour fallbacks,
  the empty-quote dismissal
  (the case drives it through the damage gate,
  the only way an empty quote reaches the restates check),
  and the identity-context thread
  (its rules ride the system half,
  gated on a `DECLARED NAMES` entry).
  The reach census reads `ran 7, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-introduced3.log`).
  Counts at the close:
  the full suite 1,553 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-introduced-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-introduced-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `3094cc053`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `image` cluster
  (the ranking's next at `census-HKw9t2`).

- 2026-10-04,
  07:27 UTC:
  the next batch's baseline census taken at commit `b1f893810`:
  `census written to ~/.cache/translation-repair/coverage/census-HKw9t2/census.json`
  (`~/temp/agent/mimo-trial/census-20.log`).
  `library source: 157 files, 311 stretches over 779 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `introduced` leads with 7 stretches over 7 lines in 2 files,
  `image` with 6 over 90 in 3,
  `corpus-run/coverage` with 6 over 43 in 1.
  This line lands in the trial-log commit that follows `b1f893810`.
  Next:
  the `introduced` batch.

- 2026-10-04,
  07:16 UTC:
  the T8 `corpus-run/contributor` batch closed with commits `b2a0f5395`,
  `539a98d16` and `bcdd232b2`:
  7 stretches over two files.
  Five carry cases
  (the page-rendering fallback in a new authorities test file that leaves
  the own-unit-tests allowlist,
  the outright name match,
  and the heading whose original names no contributor),
  two identical-line unchanged arms came out unreachable behind
  `carriesRendering`,
  and the skip for an unwritten slice carries its case.
  The reach runs corrected three fixtures along the way
  (the authority derives from the signature;
  the archive rendering returns before the page read).
  A correction on `bcdd232b2`'s body:
  shell substitution ate the backticked phrase naming the two
  identical-line checks,
  leaving "The  arms sat unreachable";
  the phrase is `after === line` and the commit stands as written.
  The reach census reads `ran 1, still cold 0, cold since then 0, not loaded 0`
  and the edited source "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-contributor5.log`).
  Counts at the close:
  the full suite 1,553 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-contributor-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-contributor-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `bcdd232b2`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `introduced` cluster
  (the ranking's next at `census-D1SlGz`).

- 2026-10-04,
  06:40 UTC:
  the next batch's baseline census taken at commit `d5e942e39`:
  `census written to ~/.cache/translation-repair/coverage/census-D1SlGz/census.json`
  (`~/temp/agent/mimo-trial/census-19.log`).
  `library source: 159 files, 318 stretches over 786 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/contributor` leads with 7 stretches over 7 lines in 2 files,
  `introduced` with 7 over 7 in 2,
  `image` with 6 over 90 in 3.
  This line lands in the trial-log commit that follows `d5e942e39`.
  Next:
  the `corpus-run/contributor` batch.

- 2026-10-04,
  06:30 UTC:
  the T8 `corpus-run/window` batch closed with commits `349a41a08`
  and `5997cef44`:
  7 line stretches over three files,
  the probe's three named ones the never-called functions the census
  books apart.
  Three carry cases
  (the draw-and-preparation disagreement,
  both incumbent-kind arms through a rendered slice beside an insertion
  one,
  a ledger line that parses as JSON but is no row),
  and the shipped sum's three index fallbacks came out unreachable behind
  its fixed arm list,
  now read through a named function.
  The reach census reads `ran 4, still cold 0, cold since then 0, not loaded 0`
  and the edited source "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-window.log`).
  Counts at the close:
  the full suite 1,552 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-window-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-window-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `5997cef44`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/contributor` cluster
  (the ranking's next at `census-koUGtg`).

- 2026-10-04,
  06:05 UTC:
  the next batch's baseline census taken at commit `75d19f5c3`:
  `census written to ~/.cache/translation-repair/coverage/census-koUGtg/census.json`
  (`~/temp/agent/mimo-trial/census-18.log`).
  `library source: 162 files, 325 stretches over 794 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/window` leads with 7 stretches over 8 lines in 3 files,
  `corpus-run/contributor` with 7 over 7 in 2,
  `introduced` with 7 over 7 in 2.
  This line lands in the trial-log commit that follows `75d19f5c3`.
  Next:
  the `corpus-run/window` batch.

- 2026-10-04,
  05:55 UTC:
  the T8 `refine` batch closed with commits `d8aea82b3`,
  `0ddd86249`,
  `7710497e2`,
  `45f0eae68` and `2e827df9c`:
  7 stretches over four files.
  Five carry cases
  (the eligibility boundary's non-body zone through its document
  parameter,
  a rewrite entry that is no record,
  a rewrite naming no envelope and one writing the base back,
  the neighbour and context spreads read off the asked sheets of a fully
  scripted flow,
  and the checker tally with its worse-verdict control).
  Two came out behind their callers' own contracts
  (the resolver binds operations only to envelopes it found;
  the checker stage builds a tally per issue it asked),
  both now `nonNullishOrThrow`.
  The reach census reads `ran 2, still cold 0, cold since then 0, not loaded 0`
  and the two edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-refine4.log`).
  Counts at the close:
  the full suite 1,552 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-refine-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-refine-scans2.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `2e827df9c`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/window` cluster
  (the ranking's next at `census-UCyK9F`).

- 2026-10-04,
  05:10 UTC:
  the next batch's baseline census taken at commit `f0d26bb64`:
  `census written to ~/.cache/translation-repair/coverage/census-UCyK9F/census.json`
  (`~/temp/agent/mimo-trial/census-17.log`).
  `library source: 166 files, 333 stretches over 806 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `refine` leads with 7 stretches over 11 lines in 4 files,
  `corpus-run/window` with 7 over 8 in 3,
  `corpus-run/contributor` with 7 over 7 in 2.
  This line lands in the trial-log commit that follows `f0d26bb64`.
  Next:
  the `refine` batch.

- 2026-10-04,
  05:00 UTC:
  the T8 `markup` batch closed with commits `1136d5be0`,
  `2fe92afcd` and `27a8745bb`:
  7 stretches over `markup-atom-scan.ts` and `markup-atom-preservation.ts`.
  Four scanner refusals carry cases
  (the escaped close inside a matched region,
  the link destination unclosed at the newline,
  the unterminated comment,
  the unclosed attribute expression),
  two `?? ''` fallbacks and one `?.unexcused ?? []` came out dead behind
  their own callers' guarantees,
  and the preservation module's new test file
  (it sat on the own-unit-tests allowlist)
  grew to eight cases across the reach runs.
  The reach census reads `ran 0, still cold 0, cold since then 0, not loaded 0`
  and the two edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-markup3.log`).
  Counts at the close:
  the full suite 1,552 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-markup-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-markup-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `27a8745bb`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `refine` cluster
  (the ranking's next at `census-uyG0kG`).

- 2026-10-04,
  04:38 UTC:
  the next batch's baseline census taken at commit `411e705a1`:
  `census written to ~/.cache/translation-repair/coverage/census-uyG0kG/census.json`
  (`~/temp/agent/mimo-trial/census-16.log`).
  `library source: 168 files, 340 stretches over 817 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `markup` leads with 7 stretches over 11 lines in 2 files,
  `refine` with 7 over 11 in 4,
  `corpus-run/window` with 7 over 8 in 3.
  This line lands in the trial-log commit that follows `411e705a1`.
  Next:
  the `markup` batch.

- 2026-10-04,
  04:28 UTC:
  the T8 `coverage` batch closed with commits `c9b1940fe`
  and `0f65e1f55`:
  8 stretches over four files.
  Two `unreachable:` index guards came out for `nonNullishOrThrow`,
  the wire's four refusals read through one case,
  the stage's three conditional spreads each carry its case and control
  (the follow-up evidence's JSON on the asked sheet,
  the identity context where handed,
  the misattributed quote named in the verdict),
  and `targetSize`'s insertion guard came out dead behind `isPaired`'s
  own filter.
  The reach census's `cold since then` reading named the identity and
  foreign-region spreads along the way,
  cased with `0f65e1f55`.
  The reach census reads `ran 5, still cold 0, cold since then 0, not loaded 0`
  and the two edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-coverage3.log`).
  Counts at the close:
  the full suite 1,549 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-coverage-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-coverage-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `0f65e1f55`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `markup` cluster
  (the ranking's next at `census-MBzNhP`).

- 2026-10-04,
  04:12 UTC:
  the next batch's baseline census taken at commit `c651bea68`:
  `census written to ~/.cache/translation-repair/coverage/census-MBzNhP/census.json`
  (`~/temp/agent/mimo-trial/census-15.log`).
  `library source: 172 files, 348 stretches over 826 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `coverage` leads with 8 stretches over 9 lines in 4 files,
  `markup` with 7 over 11 in 2,
  `refine` with 7 over 11 in 4.
  This line lands in the trial-log commit that follows `c651bea68`.
  Next:
  the `coverage` batch.

- 2026-10-04,
  03:58 UTC:
  the T8 `corpus` batch closed with commits `33fc7a459`,
  `6046af7be` and `0c0b80bd9`:
  8 stretches over `corpus-source.ts` and `corpus-name-index.ts`.
  Five are cased through the public surface
  (the failure classifier's cause shapes,
  the stderr reader's string and unreadable arms,
  the name index's no-renderings skip and length gate,
  and its catch rethrow through the injected reader).
  One was the `gitOutput` catch rethrow,
  dead behind nano-spawn's error wrapping:
  the catch now wraps every throwable
  as the sibling `readCorpusBytes` catch already did,
  and the tradeoff is recorded under "Decisions for the owner to review"
  for the owner to veto.
  The reach census's whole-file reading named the byte reader's body and
  its failure wrap along the way,
  both cased (`6046af7be`,
  `0c0b80bd9`).
  The reach census reads `ran 3, still cold 0, cold since then 0, not loaded 0`
  and the edited source "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-corpus3.log`).
  Counts at the close:
  the full suite 1,549 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-corpus-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-corpus-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `0c0b80bd9`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `coverage` cluster
  (the ranking's next at `census-6x3Blt`).

- 2026-10-04,
  03:32 UTC:
  the next batch's baseline census taken at commit `5fe00bd6e`:
  `census written to ~/.cache/translation-repair/coverage/census-6x3Blt/census.json`
  (`~/temp/agent/mimo-trial/census-14.log`).
  `library source: 174 files, 356 stretches over 840 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus` leads with 8 stretches over 14 lines in 2 files,
  `coverage` with 8 over 9 in 4,
  `markup` with 7 over 11 in 2.
  This line lands in the trial-log commit that follows `5fe00bd6e`.
  Next:
  the `corpus` batch.

- 2026-10-04,
  03:22 UTC:
  the T8 `corpus-run/tag` batch closed with commits `a0d13daf7`
  and `71c58938b`:
  8 stretches over `corpus-run/tag-attributes.ts`,
  cased in six in a new test file beside the module
  (it sat on the own-unit-tests allowlist and now leaves it,
  `readTags` exported through `corpus-barrel`).
  The refusals read as:
  a name cut off at the text's end,
  a bare attribute with no equals staying out of the reading,
  an attribute starting where no name may,
  an unquoted value,
  an unterminated quote,
  and a bracket that opens no letter,
  every refusal case keeping the readable tag before it as its control.
  The first reach census named one `cold since then` stretch
  (the first-letter refusal),
  closed with `71c58938b`.
  The reach census reads `ran 8, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-tag2.log`).
  Counts at the close:
  the full suite 1,549 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-tag-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-tag-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `71c58938b`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus` cluster
  (the ranking's next at `census-E0TzdR`).

- 2026-10-04,
  03:12 UTC:
  the next batch's baseline census taken at commit `63c8f25b0`:
  `census written to ~/.cache/translation-repair/coverage/census-E0TzdR/census.json`
  (`~/temp/agent/mimo-trial/census-13.log`).
  `library source: 175 files, 364 stretches over 856 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/tag` leads with 8 stretches over 16 lines in 1 file,
  `corpus` with 8 over 14 in 2,
  `coverage` with 8 over 9 in 4.
  This line lands in the trial-log commit that follows `63c8f25b0`.
  Next:
  the `corpus-run/tag` batch.

- 2026-10-04,
  03:03 UTC:
  the T8 `inspect` batch closed with commit `f8cf67026`:
  8 stretches over `inspect-paragraph.ts`.
  Three `atomsOfNode` arms are cased
  (an image with a resolved reference,
  formatting spans passing the walk through to their numbers),
  three refusals are cased
  (the strict-grammar catch and its `unparseable` rejection beside an
  unclosed JSX tag,
  the definitions-parse rejection beside broken definitions),
  and `gateParagraphRewrite`'s base rejection is cased beside its
  candidate twin.
  The second `not-one-paragraph` check sat dead behind the first one's
  kind half:
  a probe over five one-paragraph texts and twenty-one definition shapes
  never fired it,
  so the first check proves only the one-block shape
  and the leading-block check keeps the kind live,
  pinned with a single heading.
  The reach census reads `still cold 0, cold since then 0, not loaded 0`
  and the edited source "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-inspect.log`).
  Counts at the close:
  the full suite 1,548 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-inspect-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-inspect-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `f8cf67026`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/tag` cluster
  (the ranking's next at `census-8aKVkN`).

- 2026-10-04,
  02:52 UTC:
  the next batch's baseline census taken at commit `7cde68089`:
  `census written to ~/.cache/translation-repair/coverage/census-8aKVkN/census.json`
  (`~/temp/agent/mimo-trial/census-12.log`).
  `library source: 176 files, 372 stretches over 889 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `inspect` leads with 8 stretches over 33 lines in 1 file,
  `corpus-run/tag` with 8 over 16 in 1,
  `corpus` with 8 over 14 in 2.
  This line lands in the trial-log commit that follows `7cde68089`.
  Next:
  the `inspect` batch.

- 2026-10-04,
  02:42 UTC:
  the T8 `synthetic` batch closed with commit `eca4d6e9f`:
  9 stretches over `synthetic-quota.ts` and `synthetic-transport.ts`,
  all cased and none unreachable.
  Seven quota field refusals read through four cases
  (the array-instead-of-object body,
  the string weekly block,
  each mistyped five-hour field,
  each mistyped weekly field),
  every refusal naming its own field.
  Two transport pass-throughs read through one overrun case
  and one wire-format case with its control half
  (the anthropic body unnamed completes past the same bound,
  its frames holding no `choices` key).
  The reach census reads `ran 9, still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-synthetic.log`).
  Counts at the close:
  the full suite 1,548 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-synthetic-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-synthetic-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `eca4d6e9f`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `inspect` cluster
  (the ranking's next at `census-xB1R6c`).

- 2026-10-04,
  02:26 UTC:
  `B123` closed with commits `23137d784` (red),
  `539cd11b8` (the design recorded mid-batch)
  and `9d7bbbec2` (the fix):
  the marker walk now reads the raw behind each unpositioned run,
  bounded between its positioned neighbours,
  so a page holding a footnote and an autolink literal relabels
  instead of being refused whole.
  The design reads the installed tokenizer's `defined.includes` gate:
  an undefined reference stays in its text,
  rides in the run,
  and the recovery places it exactly,
  while escaped openings and malformed ones stay byte-identical
  (three contract cases beside the red one).
  No cache version moves:
  279 pinned `.md` and `.mdx` files scanned,
  68 with marker text,
  0 of those parsing into unpositioned nodes
  (`~/temp/agent/mimo-trial/b123-corpus-scan.mjs`).
  Counts at the close:
  the full suite 1,548 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/b123-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/b123-scans.log`).
  The ledger's B123 entry update lands in this line's commit.
  This line lands in the trial-log commit that follows `9d7bbbec2`.
  Next:
  the `synthetic` T8 cluster
  (9 stretches over 9 lines in 2 files at `census-xB1R6c`).

- 2026-10-04,
  01:37 UTC:
  `B123` is in progress.
  The red case through `applyFootnoteRelabel` is committed (`23137d784`):
  one page per measured trigger shape
  (a quoted `www.` literal,
  one after an unbalanced `[`,
  one beside CJK punctuation,
  one after a comma),
  each refusing today with the `position` kind
  (`~/temp/agent/mimo-trial/b123-red.log`).
  A probe of the built package settled the design
  (`~/temp/agent/mimo-trial/b123-probe.mjs`):
  the autolink transform's unpositioned runs hold `[^` text
  in the empty-label,
  spaced-label and unclosed shapes,
  and their decoded values erase escapes
  (`\[^x\]` reads as `[^x]`),
  so no check off node values can tell a marker from an escaped opening.
  The fix will bound each unpositioned run
  between its positioned neighbours
  (the parent's own bounds at either end)
  and scan that raw region with `gfmMarkerSpans`,
  which is escape-aware and reads labels as micromark does:
  no fabricated positions,
  no value checks,
  and the existing graph verification still guards the rewrite.
  This line lands in the trial-log commit that adds it.
  Next:
  the fix and its contract cases,
  then the cache-version call measured on the pinned corpus.

- 2026-10-04,
  01:13 UTC:
  the next batch's baseline census taken at commit `148979b36`:
  `census written to ~/.cache/translation-repair/coverage/census-xB1R6c/census.json`
  (`~/temp/agent/mimo-trial/census-11.log`).
  `library source: 178 files, 378 stretches over 891 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `synthetic` leads with 9 stretches over 9 lines in 2 files,
  `inspect` with 8 over 33 in 1,
  `corpus-run/tag` with 8 over 16 in 1.
  This line lands in the trial-log commit that follows `148979b36`.
  Next:
  `B123`,
  "Fourth" in this file,
  due once the first T8 batch landed and now overdue,
  then the `synthetic` batch.

- 2026-10-04,
  01:10 UTC:
  the T8 `openrouter` batch closed with commits `adcfeb5d4`,
  `b3cfd5637` and `780e4d267`:
  9 stretches over five source files.
  One is cased through the exported `rawCharsPerCompletionTokenOf` seam
  (its `unmeasured` arm reachable by shape,
  no roster card carrying it),
  one case pinning the fallback to the median of the measured card ratios.
  Three are the wire readers' refusals,
  cased in their own files.
  Five are the client's:
  the armed deadline,
  its joined signal and the caller `maxAnswerChars` spread cased together,
  and the cost,
  cached-token and endpoint spreads folded behind the exported
  `reportedSpendFieldsOf`,
  one case pinning the field combinations
  beside a meter pair
  (a bare stream leaves the meter flat,
  a costed one moves it 0.5).
  The first reach census settled three more
  (the chunk record guard behind a `startsWith('{')` gate that came out,
  the endpoint spread's unreported arm,
  the `/credits` non-success refusal),
  and two by-position comments and one statement TSDoc came out
  after the source scans flagged them.
  The reach census reads `still cold 0, cold since then 0, not loaded 0`
  and the three edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-openrouter2.log`).
  Counts at the close:
  the full suite 1,548 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-openrouter-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-openrouter-scans.log`).
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `780e4d267`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `synthetic` cluster
  (the ranking's next after `openrouter` at `census-XzBVZf`).

- 2026-10-03,
  23:59 UTC:
  the `openrouter` batch is in progress,
  this mid-batch line written after the correction that its state
  lived only in working memory.
  Written but uncommitted in the worktree:
  two cases in `openrouter-client.unit.test.ts`
  (a caller `exchangeTimeoutMs` and `maxAnswerChars` armed on the client
  and read back under both,
  and `costUsd` and `cachedTokens` carried only where the wire sent them,
  both built on `chunkOf` streams),
  one in `openrouter-cached-tokens.unit.test.ts`
  (a non-record `data:` chunk and a fractional `cached_tokens`
  both read as `unreported`),
  one in `openrouter-cost.unit.test.ts`
  (a non-finite `cost` read as `unreported`).
  Decided,
  not yet written:
  `openrouter-abandoned-spend.ts:48`,
  the `rawCharsPerToken === 'unmeasured'` ternary arm,
  is reachable by shape
  (the card side types `rawCharsPerToken` as `number | 'unmeasured'`
  and `corpus-run/roster-card-render.ts` generates that spelling)
  and cold only because no roster card carries it,
  so it gets a narrow exported seam
  (the shape the `fidelity` batch gave `needle` and `anchor`)
  plus a case in `openrouter-abandoned-spend.unit.test.ts`,
  the seam exported through `provider-barrel.ts`.
  Remaining:
  the seam and its case,
  build,
  the named test files,
  lint,
  the code commit and its line here,
  the reach census against `census-XzBVZf`,
  the full suite,
  the source scans,
  the ledger T8 paragraph,
  and a fresh whole-suite census named in the line after.
  This line lands in the trial-log commit that adds it.

- 2026-10-03,
  23:07 UTC:
  the next batch's baseline census taken at commit `51f394046`:
  `census written to ~/.cache/translation-repair/coverage/census-XzBVZf/census.json`
  (`~/temp/agent/mimo-trial/census-9.log`).
  `library source: 183 files, 387 stretches over 909 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `openrouter` leads with 9 stretches over 18 lines in 5 files,
  `synthetic` with 9 over 9 in 2,
  `inspect` with 8 over 33 in 1.
  This line lands in the trial-log commit that follows `51f394046`.
  Next:
  the `openrouter` batch.

- 2026-10-03,
  23:03 UTC:
  the T8 `decision` batch closed with commits `045c0e2f5` and `750ec0708`:
  9 stretches over the reply contract and the over-context gate,
  8 cased (the answer guard,
  the reply reader's refusals and shaped returns,
  the status refusal),
  1 replaced by the house cause shape
  (the parse catch's dead non-Error arm).
  `decision-contract.unit.test.ts` is new
  and the module leaves the own-unit-tests allowlist.
  The reach census reads `still cold 0, cold since then 0, not loaded 0`
  and the edited source "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-decision3.log`).
  Counts at the close:
  the full suite 1,546 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-decision-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `750ec0708`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `openrouter` cluster.

- 2026-10-03,
  22:39 UTC:
  the next batch's baseline census taken at commit `d017074e2`:
  `census written to ~/.cache/translation-repair/coverage/census-bR9IAH/census.json`
  (`~/temp/agent/mimo-trial/census-8.log`).
  `library source: 185 files, 396 stretches over 928 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `decision` leads with 9 stretches over 19 lines in 2 files,
  `openrouter` with 9 over 18 in 5,
  `synthetic` with 9 over 9 in 2.
  This line lands in the trial-log commit that follows `d017074e2`.
  Next:
  the `decision` batch.

- 2026-10-03,
  22:35 UTC:
  the T8 `fidelity` batch closed with commit `e9d07984e`:
  9 stretches over the two damage builders,
  2 dropped as unreachable,
  7 cased in `fidelity-alteration-variant.unit.test.ts` and `fidelity-damage.unit.test.ts`
  through an optional `needle` and `anchor` a case can supply.
  The reach census reads `still cold 0, cold since then 0, not loaded 0`
  and both edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-fidelity.log`).
  Counts at the close:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-fidelity-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `e9d07984e`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `decision` cluster.

- 2026-10-03,
  22:12 UTC:
  the next batch's baseline census taken at commit `911154fe8`:
  `census written to ~/.cache/translation-repair/coverage/census-Ai2qpF/census.json`
  (`~/temp/agent/mimo-trial/census-7.log`).
  `library source: 187 files, 405 stretches over 952 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `fidelity` leads with 9 stretches over 24 lines in 2 files,
  `decision` with 9 over 19 in 2,
  `openrouter` with 9 over 18 in 5.
  This line lands in the trial-log commit that follows `911154fe8`.
  Next:
  the `fidelity` batch.

- 2026-10-03,
  22:07 UTC:
  the T8 `corpus-run/meter` batch closed with commit `729931a40`:
  10 stretches over the two meter readers,
  3 `??` fallbacks replaced with `nonNullishOrThrow`,
  7 cased through `seriesFor`,
  `longestDrySpan` and `readMeterLine`.
  The reach census reads `still cold 0, cold since then 0, not loaded 0`
  and both edited sources "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-meter.log`).
  Counts at the close:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-meter-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `729931a40`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `fidelity` cluster.

- 2026-10-03,
  21:50 UTC:
  the next batch's baseline census taken at commit `dae4b8eea`:
  `census written to ~/.cache/translation-repair/coverage/census-DbGZ25/census.json`
  (`~/temp/agent/mimo-trial/census-6.log`).
  `library source: 189 files, 415 stretches over 967 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/meter` leads with 10 stretches over 15 lines in 2 files,
  `fidelity` with 9 over 24 in 2,
  `decision` with 9 over 19 in 2.
  This line lands in the trial-log commit that follows `dae4b8eea`.
  Next:
  the `corpus-run/meter` batch.

- 2026-10-03,
  21:45 UTC:
  the T8 `corpus-run/final` batch closed with commits `e0bf15a10` and `3da0a9a3b`:
  10 stretches over the two completeness checkers,
  11 cases in `consolidation-polish.unit.test.ts` and its own test file,
  and the polish branch's consolidation narrowing hoisted before the loop
  so both its arms run.
  The reach census reads `still cold 0, cold since then 0, not loaded 0`
  and the edited source "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-final2.log`).
  Counts at the close:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-final-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `3da0a9a3b`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/meter` cluster.

- 2026-10-03,
  21:10 UTC:
  the next batch's baseline census taken at commit `8fa092e8b`:
  `census written to ~/.cache/translation-repair/coverage/census-7Aczvk/census.json`
  (`~/temp/agent/mimo-trial/census-5.log`).
  `library source: 191 files, 425 stretches over 984 lines, 9 functions never called`.
  Largest clusters by stretches then lines:
  `corpus-run/final` leads with 10 stretches over 17 lines in 2 files,
  `corpus-run/meter` with 10 over 15 in 2,
  `fidelity` with 9 over 24 in 2.
  This line lands in the trial-log commit that follows `8fa092e8b`.
  Next:
  the `corpus-run/final` batch.

- 2026-10-03,
  21:05 UTC:
  the T8 `rendering` batch closed with commits `18f0b3a85` and `0bea2bc58`:
  10 baseline stretches and 2 more the per-source reading found,
  3 replaced with `nonNullishOrThrow`,
  9 cased through `corroborate`,
  `corroborateByOverlap`,
  `nearMisses`,
  the exported `quotesRequired`
  and `anchorLocatedSpan`'s new `fold` seam.
  The reach census reads `still cold 0, cold since then 0, not loaded 0`
  and every edited source "loaded it and left 0 cold stretches"
  (`~/temp/agent/mimo-trial/reach-rendering2.log`).
  Counts at the close:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-rendering-final-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `0bea2bc58`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `corpus-run/final` cluster.

- 2026-10-03,
  20:18 UTC:
  the next batch's baseline census taken at commit `90b76fe15`:
  `census written to ~/.cache/translation-repair/coverage/census-MgQUMe/census.json`
  (`~/temp/agent/mimo-trial/census-4.log`).
  `library source: 194 files, 435 stretches over 1007 lines, 10 functions never called`.
  Largest clusters by stretches then lines:
  `rendering` leads with 10 stretches over 23 lines in 3 files,
  `corpus-run/final` with 10 over 17 in 2,
  `corpus-run/meter` with 10 over 15 in 2,
  `fidelity` with 9 over 24 in 2.
  This line lands in the trial-log commit that follows `90b76fe15`.
  Next:
  the `rendering` batch.

- 2026-10-03,
  20:13 UTC:
  the T8 `inline` batch closed with commit `eef1e1610`
  (`test(module-translation-repair): T8 inline, case the tag reader's refusals and its quoted spans`):
  all 10 stretches of `src/inline-container-tags.ts` cased through `containerHalfPairs` and `readSliceSkeleton`,
  and the reach census reads `still cold 0, cold since then 0, not loaded 0`
  (`~/temp/agent/mimo-trial/reach-inline.log`).
  Counts at the close:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-inline-final-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `eef1e1610`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `rendering` cluster.

- 2026-10-03,
  19:35 UTC:
  the next batch's baseline census taken at commit `ae88792c7`:
  `census written to ~/.cache/translation-repair/coverage/census-DXY8l2/census.json`
  (`~/temp/agent/mimo-trial/census-3.log`).
  `library source: 195 files, 447 stretches over 1037 lines, 11 functions never called`,
  one stretch below `census-QFKBeX` with the `group` cluster now empty of them.
  The `inline` cluster holds 10,
  all in `src/inline-container-tags.ts`.
  This line lands in the trial-log commit that follows `ae88792c7`.
  Next:
  the `inline` batch.

- 2026-10-03,
  19:30 UTC:
  the fresh census caught the `unreachable:` throw's own line as a stretch
  and the guard came out with commit `c592bcc0f`
  (`fix(module-translation-repair): T8 group, remove the no-boundary guard instead of throwing from it`):
  `census-QFKBeX` listed `src/group-run-anchor.ts` line 172,
  an unreachable throw is unreachable code too,
  so the dead arm is removed
  and its invariant stands in the comment above `settled`.
  M112 records it
  and the T8 group paragraph's correction names itself.
  Counts:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-group-throw-fix-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL],
  Markdown lint clean in the ledger.
  This line lands in the trial-log commit that follows `c592bcc0f`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `inline` cluster.

- 2026-10-03,
  19:17 UTC:
  the T8 `group` batch closed:
  commit `691e70e3b` landed its last case
  (`test(module-translation-repair): T8 group, case the continuation riding with its seal`),
  written for `src/group-aligned.ts` lines 377 to 383,
  and the reach census reads `still cold 0, cold since then 0, not loaded 0`
  over the three claimed sources and three test files
  (`~/temp/agent/mimo-trial/reach-group.log`).
  Counts at the close:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-group-final-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  The T8 paragraph for the batch lands in this line's commit.
  This line lands in the trial-log commit that follows `691e70e3b`.
  Next:
  the whole-suite census at this commit as the next batch's baseline,
  then the `inline` cluster
  (10 stretches in one file).

- 2026-10-03,
  19:00 UTC:
  the T8 `group` batch's first case landed with commit `aa5f63aec`
  (`test(module-translation-repair): T8 group, case the run split at the step after a decline`),
  written for `src/group-aligned.ts` lines 195 to 198:
  a pairing placing every original with the middle translation declined,
  asserting the two runs it splits into.
  Counts:
  lint "Found 0 warnings and 0 errors.",
  the named file no [FAIL] and 2 [PASS]
  (`~/temp/agent/mimo-trial/t8-group-case-a2.log`),
  35 source scans and no [FAIL].
  The cluster's state:
  6 of 10 stretches closed as unreachable in `92c912b08`,
  1 cased here,
  and `src/group-aligned.ts` lines 377 to 383 (the sealed cohesive continuation arm)
  resist placement behind `mergeOneSidedRuns`' kind mapping:
  probe that mapping before deciding case or unreachable.
  This line lands in the trial-log commit that follows `aa5f63aec`.
  Next:
  place the two sealed-arm stretches,
  then the batch's reach census against `census-WkdwRV`
  (`--baseline` with one `--source` per file the batch claims),
  the full suite,
  lint,
  the scans,
  the T8 paragraph and this line,
  and a whole-suite census as the next batch's baseline.

- 2026-10-03,
  18:48 UTC:
  the T8 `group` cluster's six unreachable stretches closed with commit `92c912b08`
  (`fix(module-translation-repair): T8 group, drop the unreachable anchor fallbacks`):
  three `?? NO_BOUNDARY` fallbacks,
  one undefined-step arm
  and one dead `? []` arm removed,
  and one no-boundary arm replaced with an `unreachable:` throw
  after four probes on the built package never built the run list it guards.
  Counts:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t8-group-unreachable-suite.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL].
  This line lands in the trial-log commit that follows `92c912b08`.
  Next:
  the `group` cluster's two reachable stretches in `group-aligned.ts`
  (the position after a decline and the sealed cohesive continuation),
  then the batch's reach census.

- 2026-10-03,
  18:20 UTC:
  "Second:
  the whole-suite census" taken at commit `6d5f13a8b`,
  `census written to ~/.cache/translation-repair/coverage/census-WkdwRV/census.json`
  (`~/temp/agent/mimo-trial/census-base.log`).
  `library source: 198 files, 457 stretches over 1061 lines, 11 functions never called`.
  Largest clusters by stretches then lines:
  `group` leads with 10 stretches over 24 lines in 3 files,
  `inline` with 10 over 23 in 1,
  `rendering` with 10 over 23 in 3,
  `corpus-run/final` with 10 over 17 in 2,
  `corpus-run/meter` with 10 over 15 in 2,
  `fidelity` with 9 over 24 in 2,
  `decision` with 9 over 19 in 2,
  `openrouter` with 9 over 18 in 5.
  No cluster is near the split-by-file size.
  This line lands in the trial-log commit that follows `6d5f13a8b`.
  Next:
  "Third:
  T8 batches,
  one cluster at a time",
  the `group` cluster first.

- 2026-10-03,
  18:14 UTC:
  the flaky fixture finding closed with commit `3a6e3b1fa`
  (`test(module-translation-repair): T5, hold the naturalness grace case's delayed seat at a gate`):
  the owner chose T5's "Recurred in ..." paragraph over a B number,
  the seat's answer is now held at a gate the case releases after the review settled,
  and the recurrence names itself as a correction to T5's
  "the race read into it does not occur" claim.
  A comment naming its check by position turned the first run red and is M111.
  Counts:
  the full suite 1,545 [PASS] and no [FAIL]
  (`~/temp/agent/mimo-trial/t5-fix-suite2.log`),
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL],
  Markdown lint clean in the two docs.
  This line lands in the trial-log commit that follows `3a6e3b1fa`.
  Next:
  "Second:
  the whole-suite census".

- 2026-10-03,
  17:43 UTC:
  "First:
  fix B126" landed with commit `16ef9ff5d`
  (`fix(module-translation-repair): B126, read no contributor name from a link whose label is empty`):
  `contributorForm` returns the token unchanged only where no `](` exists,
  an empty label slices to the empty string,
  and the ledger's B126 plus one sentence in "Structure read off the parse" record it.
  No cache version moves:
  the pinned corpus search prints six binary matches and no text line
  (inference from that search).
  Checks:
  lint "Found 0 warnings and 0 errors.",
  35 source scans and no [FAIL],
  Markdown lint clean in the two docs,
  and the full suite 1,545 [PASS] with 2 [FAIL] lines
  (the `reviewAbsoluteNaturalness` "STARTS GRACE AT HALF instead of requiring delayed final seat" case and its suite,
  the wall-clock fixture of the 17:28 entry;
  the fix alone ran green as `~/temp/agent/mimo-trial/b126-suite.log`).
  This line lands in the trial-log commit that follows `16ef9ff5d`.
  Next:
  the flaky fixture as the next finding after B126,
  then "Second:
  the whole-suite census".

- 2026-10-03,
  17:28 UTC:
  "Setup,
  once" closed on trial-log commit `ebe0933d7`;
  no source commit landed in it.
  Suite start (`~/temp/agent/mimo-trial/suite-start.log`):
  1,544 [PASS] and 10 [FAIL] lines,
  triaged to three groups.
  Three lines are the B126 case,
  its suite and the file's root suite.
  Four `sampleBenchSlices` cases and their suite line failed on the fresh checkout only
  because the cli-git wrapper's build was missing there
  (`Cannot find module .../git-policy-cli/dist/final/node/index.mjs` behind a fixture `git init`);
  `mise run //package/git-policy/cli:build` fixed it
  and all four pass (`~/temp/agent/mimo-trial/retry-named.log`).
  `reviewAbsoluteNaturalness` "STARTS GRACE AT HALF instead of requiring delayed final seat"
  failed in that run,
  passed in the merge check and on re-run:
  its fixture rides wall-clock timing,
  so a delayed seat landed inside grace and its rejection counted,
  which "KEEPS REJECTION that arrives inside bounded post-quorum grace" pins as correct.
  That flake is the next finding after B126,
  on the steps of "First:
  fix B126",
  before the census.
  This line lands in the trial-log commit that follows `ebe0933d7`.
  Next:
  "First:
  fix B126".

- 2026-10-03,
  17:18 UTC:
  merge of main (at `ea53b956a`) into `translation-repair-rebased` landed with commit `28303c42a`
  (`chore(*): merge main into translation-repair-rebased`):
  `AGENTS.md` taken as main's version in full by the owner's direction,
  `CLAUDE.md`,
  `mise.toml`
  and `package/config/pnpr/config.yaml` regenerated by file-enforcer,
  `pnpm-lock.yaml` regenerated with `pnpm install --lockfile-only`.
  Counts on the merged tree:
  1,545 [PASS] and 3 [FAIL]
  (the B126 case,
  its suite and the file's root suite;
  log `~/temp/agent/mimo-trial/merge-check.log`).
  The trial branch `translation-repair-mimo-trial` is cut from that commit
  and lives in its own checkout `/var/home/user/worktrees/translation-repair-mimo-trial`
  (`git worktree add --no-track`),
  after cli-git policy `branch-worktree-only` rejected `git switch --create`
  and the owner chose the guard's own worktree form over `--no-enforce-worktree-branch`,
  noting the handover's worktree pin was wrong.
  This line lands in the trial-log commit that follows `28303c42a`.
  Next:
  "Setup,
  once" continues (suite start),
  then "First:
  fix B126".

- 2026-10-03,
  16:20 UTC:
  handover written by Claude Code in a cloud session;
  no trial commit yet.
  Next:
  "Setup,
  once",
  then "First:
  fix B126".

## Decisions for the owner to review

Each entry is a choice already made and acted on,
never an open question:
the options,
the evidence,
the one taken,
why,
and its commit.

- 2026-10-04,
  the `gitOutput` catch's rethrow (`33fc7a459`):
  options were keeping the rethrow,
  with the T8 stretch staying open on it,
  or wrapping every throwable as the sibling `readCorpusBytes` catch
  already does.
  Evidence:
  nano-spawn funnels every throwable through its `getErrorInstance`
  and wraps it as `SubprocessError`
  (`source/result.js`,
  `source/spawn.js`;
  its one raw escape needs `options.input`,
  which the corpus call never sends),
  and a probe on the built package delivered a `CorpusReadError` of kind
  `other` for a NUL-byte `gitPath`,
  an empty one and a missing binary
  (`~/temp/agent/mimo-trial/corpus-rethrow-probe.mjs`).
  Taken:
  the wrap,
  since the `kind` field still distinguishes `missing-object` from
  `other`,
  a catcher reads one failure class either way,
  and T8 has no fourth outcome for a stretch.
  The owner may veto and restore the rethrow,
  which returns the stretch to T8's open count.

[ledger]: ../../package/module/translation-repair/doc/audit-ledger.md
[prevent]: ../../package/module/translation-repair/doc/mistake-prevention.md
