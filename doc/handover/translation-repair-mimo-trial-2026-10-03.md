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

## Trial log

Newest first.
One line per step or batch:
the date and UTC time,
what landed with its commit,
the counts read from the logs,
and the step in progress.

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

None yet.

[ledger]: ../../package/module/translation-repair/doc/audit-ledger.md
[prevent]: ../../package/module/translation-repair/doc/mistake-prevention.md
