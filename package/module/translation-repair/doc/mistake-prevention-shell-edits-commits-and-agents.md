# Preventing mistakes: shell commands, edits, commits and agents

Rules for how the work is carried out:
shell commands and tasks,
lint and edits,
commit messages,
questions to the owner,
and work handed to agents.

Part of [Preventing this package's mistakes](mistake-prevention.md),
which lists every file of this record.

## Shell commands

What happened:
`;` joined commands dozens of times,
so a failed step's successor ran anyway and hid which failed;
heredocs and inline `python3 -c` scripts were chained to other commands;
foreground sleeps and do-nothing calls waited on background work;
git ran outside the repository root and cli-git refused it (M1,
M14,
M38,
M92);
a command ran in the same batch as the write it read,
and ran a stale file of the same name (M51).
A transcript census found 9,324 of 22,058 calls breaking the rule after it took its current wording,
and the rule itself misread as three `&&` rather than three steps (M1).
The slip recurred after every record of it,
four times,
then three more,
then three times after M116 was written,
across 2026-10-05 and 2026-10-06 (UTC) (ledger M107,
M116).
Each of those last three was a read of a log by two searches whose results were both wanted.
Five more followed around the merges of 2026-10-06 (UTC),
two of them a `;` after `rg --count` to get past its exit of 1 on a count of zero (ledger M116),
and two more after those,
each a read of a log between two steps of a merge (ledger M116).
An agent stopped its own census with `pkill -f` on a pattern that matched every agent's census on the machine
(ledger M126).
Loops,
a sleep,
polls of a running log and a heredoc chained to a second command came again,
from the lead and from agents (ledger M132).
The lead's came once more on 2026-10-06 (UTC):
calls chaining four steps with `&&`,
a heredoc with a second command,
a `git diff` run from a subdirectory,
and a count expected to be zero leading an `&&` chain it then stopped;
and agents chained three more reads or writes with `;` (ledger M116,
M139).
A background command of the lead's chained the source scans and the lint with `;` (ledger M140).
On 2026-10-10 (UTC) a `git add` of the lead's ran from inside the package directory,
and the git policy refused it as not at the root (ledger M141);
the agents writing the changes of ledger B365 to B378 chained six read-only calls with `;`,
one ran a heredoc and then `node` in one call,
and one edited files through inline `node --eval` scripts,
one of which lost its backticks to the shell.
On 2026-10-11 (UTC) the lead chained four `&&` steps in one call,
and created an agent worktree through the Git wrapper without `--no-worktree-copy`,
so it copied 888 MB of ignored logger files and held the settlement lock for over 45 minutes;
the script that sets up agent worktrees then ran under `mise exec`,
where `git` was plain Git and refused the flag (ledger M152).

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
An agent worktree is created with `--no-worktree-copy` from a shell whose `git` is the wrapper,
then set up.
A process is stopped by its own id,
or by the task id of the call that started it,
never by name or pattern.
A count that may be zero is a call of its own,
since `rg --count` exits 1 on zero.
While a background task runs,
the turn ends;
a notification arrives when it finishes.
A permission refusal names an outcome,
so no other command reaching it is tried:
writing an older version over a tracked file was refused once
and attempted again through `git show` (M73);
an agent's read of the corpus clone was refused inside the agent,
and the count it then asked the lead to run stayed untaken and went to the owner (M118);
a before-and-after measurement of one module renders both versions from scratch copies
whose relative imports point at the worktree's sources.

What enforces it:
nothing automated yet;
issue #579 asks the repository's guardrail hook to deny such calls.
The rate fell while slips were recorded by hand but never reached zero,
so until the hook lands,
count the `&&` and look for `;` before sending,
and rerun the M1 census before an entry claims a count.

## Tasks, builds and bulk output

What happened:
a source-map build was named `build:coverage`,
and the package's `build` fan-out starts every `build:*` child at once,
so each plain build ran it beside the normal one into the same directory (M63);
the census first chose `tmpdir()` for about 8 GB of raw coverage,
where `/tmp` is a tmpfs held in memory (M64);
a test's stand-in command carried a literal `[FAIL]`,
which a warning quoted into the suite's own log,
where the census counts it (M65);
a scratch sweep walked the package and `doc/` with a recursive `readdirSync`
and held 6.7 GB resident after 16 minutes,
when it was stopped (M96).
A background suite written as `<suite> > <log> || echo "exit $?"` printed its fallback into the task output,
not the log,
and the task reported exit 0 while the log held a failing scan (ledger B103).
With that rule written,
a script making agent worktrees failed at its first worktree twice behind the same fallback,
its task reported exit 0,
its log went unread,
and an agent was sent to a worktree that did not exist (ledger M114).

The type check ran before the build on a fix tree and reported ten errors in two test files,
read against the old built declarations (ledger M132).
Two listings printed several hundred file names into a session where a count was wanted (ledger M132).
A message that resumed stopped agents said they had been stopped for a usage limit,
and one read it as being cut short and handed back part of its work (ledger M127).
The type check reads the built declarations,
so it runs after the build;
a count comes before a listing;
and a message that resumes an agent says the whole task stands.
A package task started from the main repository's root,
not the worktree holding the branch,
found no such task (ledger M134);
every package task names its worktree as its directory in the call.
A gate started as a user unit under `mise exec` met a `git` without the worktree flag its setup uses,
failed in its first seconds,
and was found about twenty minutes later,
since the waiter armed on its log's last line never fired;
and a unit wrote its log into a folder not made yet,
and failed at setting up its output (ledger M141).
The agent porting the runner observations change ran a lint beside the source scans,
which rebuilt `dist` under it,
and counted that lint void (ledger B366),
the shared build directory of M63 again:
a run that reads `dist` never runs beside one that rebuilds it.
The first lines of a started run's log are read before a waiter is armed,
a waiter watches the failure line as well as the success line,
and the folder a unit writes to exists before the unit starts;
a gate runs in the plain shell,
since it makes worktrees with the shell's `git`.
The lead's brief for the runner leftovers handed on ten observations from a task title and two old notes,
three of them with no source text in the notes,
so the agent had to find each again from the code and the ledger (ledger M142).
A brief names the source of each observation it hands on
(a file and line,
a ledger code or a report),
or says it holds none,
so the agent knows whether it is checking a claim or searching for one.
On 2026-10-11 (UTC) the lead again started a package task from the main repository's root,
ran the type check while the named-test runner was rebuilding `dist`,
and piped `git apply --check` into a filter,
so the shell reported the filter's exit and a patch that applied read as refused (ledger M150);
a command whose exit decides the next step runs unpiped.
An agent waiting on its suite read a background task's output file in the harness's task folder,
which its brief forbids,
then stopped and read its own scratch logs instead (ledger M149);
a continuation brief restates every binding rule of the brief it continues,
since a fresh agent has not read the old one's corrections.

The rule:
a task that must not run with a fan-out parent is named outside the parent's prefix,
and a new task's first run is read in its log for every task it started.
Output that can reach gigabytes goes under the package's cache directory on disk,
after `df` has shown the filesystem.
A fixture printing a marker that tooling counts builds the marker when it runs,
and a new test file's first run is read for markers,
not only for its exit.
A background run appends its exit status to its own log
(`<suite> > <log> 2>&1 || echo "suite exit $?" >> <log>`)
and is read by its `[FAIL]` markers and that line,
never by the task's reported status.
A command that sets up what a later step uses
(a worktree,
a build,
an install)
is read by its log before that step starts,
and a path an agent is sent to is listed in the call that sends it.
A scratch scan lists its files from git's index,
or walks with a bound that skips `node_modules`,
and runs with a heap cap (`node --max-old-space-size=512`);
one that runs past its expected time is checked once by process status.

What enforces it:
the coverage census,
which refuses a suite whose log carries a failing marker,
and one that printed no pass marker (ledger B384);
habit for the names,
the directories and the sources a brief names.

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
a page's link markup quoted as prose rendered as fifteen live links to files that do not exist (D32);
changes that stopped calling a function left it behind,
and nothing reported one (ledger B20);
the guard written for that counted a test,
or a barrel's re-export list,
as a use,
so 57 functions only tests reached passed it (ledger B30):
wrappers over parts production calls apart,
tested in place of the parts;
modules built beside the live path,
never wired,
and superseded;
functions whose callers changed course;
and test support shipped as package source,
23 values of the same kinds among them (ledger B31);
four type imports only the removed code read stayed,
and nothing reported them;
two error classes were marked safe to print and a third added
with only each commit's own tests run,
so the scan that reads every class failed two commits later (M59),
and the coverage census did the same with the rule written,
its four error classes and a copied helper failing two scans on the census's own first run;
and a scripted client moved from a unit test into a `.test-fixture.ts` file drew three lint errors and six warnings,
since the lint config relaxes the arrow-function and `require-await` rules
only for `*.test.ts` and `*.bench.ts` files (M87);
line numbers for in-place edits were worked out from offsets rather than read,
and garbled comments in three runner files before the diff showed it (M93);
and the scratch readers of lint output could miss a finding:
a location pattern written with a Unicode dash,
and a summary pattern that misses oxlint's singular "1 warning" (M95);
and 30 TSDoc blocks documented nothing,
each standing before a second block,
a `//` comment or a statement,
which the tsdoc lint plugin never reads,
since it walks from each declaration back to the nearest block (ledger B96);
four test declarations nothing read and 24 fixture exports no other file imported outlived their callers,
since the lint leaves `no-unused-vars` off and nothing else reads tests (ledger B118);
and 16,856 lines ended in whitespace,
nearly all TSDoc blank lines holding one space,
though `.editorconfig` forbids it,
since no configured check enforces that for TypeScript (ledger B119);
and a commit made on its named tests alone,
its message putting the lint off to a change that then went to agents,
shipped a lint warning to the twelve agent checkouts made from it (ledger M114);
and a line range for an in-place edit was counted off a print whose first line the tool had trimmed,
so the edit replaced the wrong lines of a TSDoc (ledger M117).

A red commit went out without the source scans,
and a scan failed at it on two test files that each built one body (ledger M123);
the fix commit for it went out without a lint run,
and the whole-suite run on that commit ended its lint with one warning (ledger M124).
The scans run before a red commit as before a fix,
and lint runs before any commit that adds a helper.
A fix commit that changed a doc went out without the Markdown lint,
which then found three findings in its paragraph (ledger M133):
the Markdown lint runs on every doc a commit touches,
a code commit's included.
A docs commit went out after its findings were fixed without the lint running again,
and one flagged line was left
(the 2026-10-11 recurrence of ledger M133):
the lint's last run before a commit is after the last edit,
and its output holds no finding.
The merge of a patch written at `f3c2bae13` ran its own files by name,
the scans and the lint,
and left the whole suite to the gate;
main had since gained cases pinning the provider's words in the line a stop writes,
which the merged change no longer writes,
and four of them failed at the gate though each change was green at its own base (ledger M140).
A patch whose base predates commits touching the modules it changes,
or their consumers' cases,
gets the whole suite on the merged tree before its fix commit,
not only its own files by name.
The port of the runner observations change onto a main that had rewritten its files
met three conflicts and four breaks with no conflict marker:
a case calling a builder without the parameter the change made required,
which only the type check found,
a fixture building an error without a field the change made required,
and cases expecting a kind and a remedy the change had split (ledger B366).
A port runs the type check and the cases of every user of each API it changes,
found by a search,
not only the files it changed.
Review of the combinator scan found declarations without TSDoc
and `@param` and `@returns` lines that said what a value is (ledger B356):
a destructuring or a loop's binding carries TSDoc as any declaration does,
and a parameter or a result line says why.
Review of the runner observations change found the same lines,
a `@returns` naming ids for a count,
and TSDoc describing a message language `LC_ALL=C` no longer lets through (ledger B377):
added TSDoc is read against the code it sits on after every merge.

The rule:
read a region with the Read tool before editing it.
An applied patch that deletes code runs `mise run source-scans` before its named tests,
and an agent asked to delete code is asked to count the deleted names' remaining uses (ledger M75).
Lint,
type check and the named tests run after the final edit of a commit,
in that order,
and the commit follows only a clean run of all three (M46).
A commit that defers its whole-suite gates says so,
and starts them in the background in the call after it;
"with the next change" names no time (M114).
The named tests of a commit touching the package's source,
docs,
README or task file include the package-wide source scans,
run as one task,
`mise run source-scans`
(its description names each),
since a new class,
function,
export,
link,
sheet,
clock time or reference by position is read by those and not by its own file's tests;
a docs-only commit runs them too,
since four of them read the docs (M59);
a ledger entry is closed only after a full suite has passed on its last commit (M12,
M59).
Neither the type check nor the linter reports an unused import here
(issue #578 asks for a check),
and three of this audit's removals left ten imports unread in one day (M75),
so a removal counts the removed names' uses,
and a change that stops calling a function removes it in the same commit.
Code is live only when production reaches it,
never because a test or a re-export names it.
A wrapper over steps production runs apart,
with work between them,
is not written for a test:
the test calls the parts in production's order.
A module built beside the live path is wired in the change that builds it,
or goes in the change that supersedes it.
A helper only tests call lives in a `.test-fixture.ts` file,
which the package build never ships,
and which lints as source:
code moved there from a test follows an existing fixture's idiom
(`archive-selection.test-fixture.ts` for a scripted client).
A line-range `sed --in-place` names one file,
since it applies the range to every file it is given (M71),
and takes its line numbers from `rg --line-number '' <file> | sed --quiet 'A,Bp'` just before the edit,
read again after any insertion higher in the file (M93).
A replacement of more than one line is a Read and an Edit,
which fail where the text is not there;
a number for `sed` is printed beside its line,
never counted from a range's start (M117).
Lint's summary is read with `rg 'Found [0-9]+ warnings?'`,
beside the findings list,
each a check on the other (M95).
Commit before `--fix` and read the diff after it for anything but layout.
A split searches `src`,
tests and `doc` for the old file's name and repoints every hit in the same commit.
A TSDoc block sits directly before the declaration it documents:
a note on a statement is a `//` comment,
two blocks for one declaration are one,
and a lint suppression on a documented declaration opens before the TSDoc and closes after the declaration (ledger B96).
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
Markup quoted in prose,
a link above all,
goes in a code span,
or behind an escaped bracket inside a quotation that spans lines.
No line ends in whitespace,
except inside a template literal's text,
where the whitespace is the value:
a blank TSDoc line is an empty line,
the form the edit tool writes (ledger M103,
B119).
A change that stops calling a test helper deletes it,
and a fixture exports only what another file imports or re-exports,
since an export its own file alone reads offers nothing (ledger B118).

What enforces it:
`mise run source-scans`,
one command for every scan a new file can fail;
the linter's `max-lines` and every other rule,
read in full before staging;
the Markdown linter,
which exits 0 only when no finding remains;
`src/living-doc-links.unit.test.ts`,
which fails on a relative link,
image or link definition in the living docs,
the package's docs or its README whose file or heading does not exist;
`src/dead-code.unit.test.ts`,
which fails on a private function or value its file never names
and on a top-level function,
class or value no production code reaches,
counting from the module-level statements of every non-test source file that declare nothing,
with a value named only in types counted as unreached
and the spend meter's reset its one allowed seam,
and on an allowed seam that production reaches or no file declares (ledger B30,
B31);
`src/unused-imports.unit.test.ts`,
which fails on an import binding its file never names outside its imports,
type positions and export lists counted,
unless a TSDoc link names it (ledger B32);
`src/tsdoc-attachment.unit.test.ts`,
which fails on a TSDoc block followed by anything but the declaration,
member or function it documents,
a lint suppression among them,
outside `@module` headers (ledger B96);
`src/dead-test-declarations.unit.test.ts`,
which fails on a top-level declaration in a test file or fixture whose name its file never reads,
property and member names and other bindings not counted,
on a fixture export no other file imports or re-exports,
and on a default export,
namespace import or dynamic relative import,
which it cannot follow (ledger B118);
`src/trailing-whitespace.unit.test.ts`,
which fails on a line ending in whitespace outside a template literal's text (ledger B119;
issue 585 asks for a repository-wide lint rule in its place).

## Commit messages

What happened:
messages claimed records not yet written,
named hashes typed by hand,
chose `test` for a commit that changed production code,
named a task-list number as a GitHub issue,
and gave a cause that no command had yet shown (M16,
M39,
M49).

A red commit's message named three test files as failing and not the scan that failed beside them (ledger M123),
and a check of a message for task-list numbers matched the message's own words,
and stopped the commit without a word (ledger M130).
A message that names what fails names every failure of its tree,
and a check that stops a commit says that it stopped it.

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
A suite's count is its describe blocks,
one PASS line each,
never its cases:
one record called 1,384 PASS lines cases (M74).
A red run's findings are described from the arrays it printed,
each group counted against them,
never from the plan:
one red message summed eight findings as nine
and named a class its site's callee never throws (M77).
A batch's stretch counts are read from the baseline census's rows file by file,
each stretch placed in exactly one of reachable or removed,
and an edit the census never listed is named apart:
one record counted a narrowing the census had not listed as a removed stretch (M78).
A case is said to reach a stretch only once a census shows the stretch ran;
until then the message names the stretch the case is written for
(one message claimed two arms for a case that reached one,
M102).
A lint a message reports ran on the bytes the commit holds,
after the last edit to each file it reads
(one message reported a clean ledger the commit's ledger failed,
M106).
A lint run for a side checkout takes that checkout's root as an argument,
and its verdict is repeated only beside the root it read:
one message reported a clean lint that a script holding the main checkout's path had run on the main checkout's files,
whatever directory it was started from (M119).
A constant a message or a comment names is read from its declaration first,
and a correction is held to the same rule:
one message quoted a quorum of 3 where both quorums were 2,
and its correction's first wording repeated the slip (M84).
On 2026-10-11 (UTC) a merge message was drafted with call counts no source in front of the lead held,
and named the wrong file for the threshold it described;
both were rewritten from the diff before the commit ran (M150).
A message file takes a name no earlier message used,
checked with `ls` before any tool writes it (M72).
Before the commit runs,
and after the message's last edit (M46),
read the message for `#` followed by digits:
this audit's task list numbers its items like issues,
and two commits named a task as an issue within one hour.
An inaccurate message is never amended:
a commit comment corrects it.

What enforces it:
habit,
which failed twice in one hour on the issue numbers.

## Questions to the owner

What happened:
an adopted reading parked in docs across a compaction (M7);
a measurable question asked instead of measured (M8);
a fix started against a ruling (M15);
quality calls put to the owner as design questions (M30).
Later rounds took the alternatives of recorded vetoes,
and the page of veto choices for the owner,
which collects paragraphs by a marker phrase,
did not read their closing notes,
so the old veto paragraphs stayed on that page as live cards,
asking the owner to keep or veto behaviour that no longer existed (ledger M146).
A question described an idiom's sense that three of its four occurrences in the corpus contradict,
and the owner chose an option on that description (ledger M148).

The rule:
measure what can be measured before asking.
A sense,
count or reading an option rests on is measured over the pinned corpus before the question is asked,
every occurrence read.
A choice that differs only in the quality of the result is decided for quality,
built,
recorded,
and open to veto.
A ruling goes into [the design commitments](design-commitments.md) the turn it is given,
and a finding is checked against them before any fix starts.
When a later round takes the alternative of a recorded veto,
the lead writes the closing note,
lists the item ids the page of veto choices holds for the old paragraph,
and turns each reversed choice into a pointer on the page,
or removes it,
before the page is rebuilt,
then drives the page again.
The owner ruled on 2026-10-10 (UTC) that a choice left unmarked on the page of veto choices counts as kept.

What enforces it:
habit,
and the commitments page.

## Work merged from parallel briefs

What happened:
the tense work and the consistency pass were built apart and both changed what artifact generation 15 holds,
so five replay fixtures of one broke on the other's section when merged (ledger M153).
Then the consistency review and the consistency modules' own tests were briefed together from one base,
kept apart by test file only,
and both changed the same production modules:
each fixed the reader's slot-offset and place-count rules its own way,
the merge held one rule twice,
and four test files pinned rules or messages the other had changed (ledger M156).
A three-way merge with no textual conflict said nothing about either.

The rule:
work that may change the same production files runs one after the other,
or one brief owns those files and the others only read them;
separating test files is not separating the work.
When two pieces of work did run apart,
the second merge runs every test file of both on the merged head before its commit is relied on,
and a rule both stated is kept once.

What enforces it:
nothing in the package;
the lead's briefs name the files each may change,
and the lead's named run after each merge covers both pieces of work.

## How an agent waits

What happened:
the brief for the consistency review's fixes forbade `sleep` and shell loops
but gave no way to wait for the whole unit suite.
The agent started the suite with the Bash tool's background mode,
armed a Monitor whose `ps` filter matched its own command line,
armed two more,
then counted the log's lines in about twenty separate calls while the suite ran;
one call also ended in `; echo done` (ledger M162).
Each count cost a turn and decided nothing.

The rule:
a brief that forbids a way of waiting names the way to wait.
A command that ends inside ten minutes runs in the foreground with the Bash timeout at 600000.
A longer one runs as its own `systemd-run --user` unit with its output in a scratch log,
followed by one foreground call to `wait-unit.ts <unit>.service` in the lead's scratch folder,
which returns only when the unit ends and prints its result;
a timed-out wait is repeated once,
not replaced by polling.
No Monitor,
`pgrep` or `ps` loop,
or line count of a growing log stands in for it.

What enforces it:
the shared facts every brief points to carry the waiting rule and the exact unit form;
the lead checks a new brief for a forbidden form of waiting with no named replacement.
