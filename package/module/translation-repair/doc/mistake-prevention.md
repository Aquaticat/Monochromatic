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
    `mise run //package/module/translation-repair:cache-account-audit` lists every constant the source declares,
    the commit that set each value,
    and every non-test source commit since the earliest of them that no version's account names;
    read each unnamed commit against the files its stage's sheets and floors import,
    the house rules and prose ranges included;
    a change that alters what the stage asks or accepts moves the version,
    unless no cache file was written after the change
    (`find <runs dir> -path '*slice-cache*' -type f -newermt '<time>'`,
    with the time in ISO 8601 (`2026-09-27T04:26:30Z`),
    since this host's `find` is bfs and refuses `… UTC` as an invalid timestamp (M57),
    its errors written to a file that is read,
    a control time that must find files,
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
M38,
M92);
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
A permission refusal names an outcome,
so no other command reaching it is tried:
writing an older version over a tracked file was refused once
and attempted again through `git show` (M73);
a before-and-after measurement of one module renders both versions from scratch copies
whose relative imports point at the worktree's sources.

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
X18's first fixture,
and a lane comparison case whose fixture repeated both ledgers where its name repeats one,
so an earlier check refused it
(T8's fifth batch)),
among them a test committed for a defect it passed on under the build before the fix (M53),
or that could not tell the claimed order from another (M44);
and mutation runs could not report a catch,
or left out the test pinning the mutated token (M27,
M41),
or read a test run that crashed before any verdict as a survivor (M50);
a positive control addressed by line number changed nothing and read as a null (M52);
and a red commit said a case pins a check its fixture could not reach,
before any mutant had tested it (M58);
two copy-check cases passed with the copy check removed,
since their candidate was valid against the page they used (M62);
and a type-level proof that roster names are served ids outlived its purpose:
once the roster type was derived from the served ids,
the proof could never fail,
and its runtime case asserted a literal `true` (ledger B31);
and refusal cases checked only that a read threw,
or threw an error of the right class,
so a case refused by an earlier check than the one it names passed
(the naturalness review,
polish and census input tests,
tightened under T8);
and six artifact refusal reasons printed as something other than what the reader expected,
two of them the opposite,
behind cases that checked a fragment the wrong reading also held (B33);
and a refusal case rewritten to name its side swapped its class for the message,
since `toThrow` given a text checks only that the message contains it (M85);
and the slice coverage and delivery refusal cases checked the class alone or a fragment of the message,
though every check in each file throws one class carrying a structured fault
(T8's seventeenth batch);
and a guard-off build put a mutant in a file's second top-level suite beside one failing its first,
so the file stopped before the second suite and its case never ran (M89),
and a red case sat the same way behind red cases in the file's first suite,
so it could not be seen failing (M97).

The rule:
a red guard is read case by case before the fix,
and each case must fail for the reason its name gives;
after the fix every case turns green.
A refusal case checks the message the refusal carries,
the path and reason for an artifact read,
beside the error class,
and a copy with one expected message changed must fail.
`toThrow` checks a class or a text,
never both,
so a refusal is caught with `caught`,
then checked with `toBeInstanceOf` and with `caughtValueText` whole,
and a rewritten assertion is compared with the one it replaces.
Where the class carries a structured fault,
the case asserts the fault whole beside the class,
and one case per sentence checks the message.
An `ArtifactParseError` reason is printed after "expected",
so it names what the reader wanted there,
never what it found or a sentence about the record,
and its case reads the printed message whole.
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
A message says a case pins a branch only once the mutant removing that branch is caught;
until then it says what the case fails on today,
and a case that must pass a precondition to reach its branch
is read against that precondition in the code first.
A case guarding a short circuit is run once with the short circuit removed,
and must fail there,
before its commit says what it guards.
A guard-off build mutates cases in one top-level suite per file,
since a failing suite ends its file,
and a mutant whose case prints no FAIL line is read as surviving
only once that case's suite printed its pass line.
A red case counts as red only from its own FAIL line,
and a file awaiting several suites at the top level is wrapped in one root `describe`
before a case is added to any suite but its first.
When one side of a compared pair becomes derived from the other,
every guard comparing them is re-read:
one that can no longer fail goes,
and its record names the case that still carries the invariant.

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
a search for an entry id printed corpus text (M36);
the coverage census recorded each cold stretch under its first character's source,
dropping every module a stretch ran on into,
and a port control reproducing an earlier census's totals passed because that census had the same flaw (M67);
the coverage census measured a compressed build,
where guards folded into logical expressions had no range and read as run,
after the ledger had inferred from the stretched spans alone that its error ran only toward cold (M79);
a census of number reads counted calls and missed readers handed on as values (`.map(Number)`) and `Date.parse`,
six reads in all (M90);
a source scan read a `satisfies` as typing a table with string keys,
and missed a parameter destructured from an object until moving code changed its count (M98);
and a search whose pattern `rg` refused printed its `|| echo` fallback,
which read as finding nothing (M99).

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
A census of a behaviour also lists every way the language reaches it
(a call,
a construction,
a value handed on,
a coercion)
and every function with the same behaviour on another type,
and its guard says which it reads and which it leaves out of reach.
A source scan lists every way the language declares the shape it looks for
(an annotation,
a cast,
a `satisfies`,
an alias,
a parameter named,
destructured or defaulted),
says for each whether it gives the shape,
and holds one of each in its fixture;
a count that moves when code moves without changing what it does marks a gap in the scan.
A null result counts only after a positive control shows the search can match,
and a fallback report names the exit status (`|| echo "exit $?"`),
since `rg` exits 1 for no match and 2 for a refused pattern or another error.
A measurement that aggregates is checked against an invariant any correct output meets,
not only against an earlier tool's totals,
since two tools sharing a flaw agree:
the coverage census refuses a report in which an uncalled function's first line sits in no stretch of its own source.
A measurement reads code as its source writes it:
the coverage build is not minified,
and a claim that a transform's error runs only one way is tested by measuring once without the transform.
A generated list's line count is printed before anything consumes it.
A probe's output goes outside the tree it searches.
Corpus text is never printed:
a probe prints ids,
indices,
counts,
code points and markup.

What enforces it:
habit,
the control-byte scan in the checklist,
the coverage census's placement refusal and baseline format check (`requirePlacedFunctions`,
`CENSUS_FORMAT`),
and the census's refusal of a minified build (`requireUnminifiedBuild`),
before the suite runs.

## Claims without their evidence

What happened:
ledger numbers written from a summary or a comment instead of the log or the code (M9,
M22);
docs naming a log line the code never writes (M20);
a count put to the owner that measured something narrower than the option it backed (M18);
refusals called damage from a category name (M31);
a fix that supplies a model "missing" context built before reading the sheet (M32);
an inferred cause written as fact (X18's first draft);
a commit said its cases covered every branch of the coverage census,
and the census,
once run,
found ten cold stretches in four of those modules (M66);
a batch's baseline reading printed all zeros for a source its baseline never loaded,
which reads as nothing left to do (T8,
fixed in `297c72fd5`);
a message said a census recorded which bundle carried a source,
which `census.json` does not record (M76);
a baseline reading printed "ran 13" over sources edited since the baseline,
whose old stretches it matched against lines now holding other code (T8,
fixed in `d27a89dd0`);
the reading counted nowhere the code a run left cold that its baseline ran,
so a change that left code cold read clean (B61);
and it asked git about edits inside the package alone,
though the census reads other packages' sources by line too (B62);
a veto-open call refused an exponent in a provider's price on the ground that the fixtures write none,
and a stored catalogue writes one (M91).

The rule:
every number,
log line,
cause and quoted rule is read from its source in the same step it is written,
and the source is named beside it.
A claim that tests cover a module's branches comes from a census of the claimed sources
(`mise run coverage-census -- <test files>`),
each loaded and holding no stretch in a census of format 2 or later (M67),
never from reading the tests.
A claimed source the baseline holds no stretch in is proven by this run's rows alone:
the baseline reading names each one,
and one the baseline never loaded must be loaded now with no cold stretch left.
So is a claimed source edited since the baseline's commit,
which the reading names and leaves out of its counts;
a baseline is taken from a tree with nothing uncommitted under the package,
or the reading refuses it.
No stretch may read as cold since then,
code the baseline ran that this run left cold.
A comparison of two runs reads each side for what the other cannot say,
and a question put to git covers everything its answer is read against,
read NUL-separated.
A claim drawn from a census names the `census.json` field or the report line that holds it.
A fix that gives a model context starts by rendering the sheet and searching it for that context.
An inference is labelled as one,
or traced in the code before it is written.
A claim about what a writer writes is measured over that writer's stored output,
with a control the measurement must flag;
the package's fixtures are its own copies,
not the writer's output.

What enforces it:
habit;
the census reading refuses a baseline taken with uncommitted changes,
names every claimed source edited since the baseline apart from its counts,
names every stretch cold since the baseline,
and asks git about every file of the work tree;
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
A constant a message or a comment names is read from its declaration first,
and a correction is held to the same rule:
one message quoted a quorum of 3 where both quorums were 2,
and its correction's first wording repeated the slip (M84).
A message file takes a name no earlier message used,
checked with `ls` before any tool writes it (M72).
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
Two cache-account paragraphs written for B24 said "same cache check as the paragraph before",
which names nothing once a paragraph is added between them (M60),
and a census found hundreds more references by position in the package and the living docs (D33),
five of them pointing the wrong way after the text around them moved.

The rule:
a reference names something a later reader can open:
a ledger entry,
a doc heading or path,
a file or symbol,
a commit,
a date,
or the finding itself in words,
and never a position
("above",
"the paragraph before",
"the case before this"),
which a later insertion silently repoints.
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
and on a listed issue or quotation that no longer occurs;
it fails too on a number written after the word "task" (D31)
outside the listed takeover-era stretches,
which keep that tracker's numbers under their notes.
`src/position-references.unit.test.ts` (D33) reads the same texts
and fails on "above" or "below" after any word that marks no comparison,
bound or placement,
unless what follows compares or names,
on a reference verb or a parenthesis around one,
on a sequence noun before "before this" or "after it",
on "earlier in this file" and its kin,
and on "the former" and "the latter",
outside its listed exemptions,
and on an exemption that no longer names a reference.
Its first version read positions only after a listed noun
and passed a couple of hundred after nouns the list lacked;
a guard built on a word list is measured against a broader scan before it closes an entry.

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
the checklist's cache step covers the rest,
through the `cache-account-audit` task,
which reads the constants out of the source rather than from a remembered list,
and whose readers are pinned by `cache-account-read.unit.test.ts` and `cache-account-commits.unit.test.ts`.

## Tests touching the real world

What happened:
a unit test prepared an original naming a title,
and the preparation bought a live web search with the key the suite inherits from `mise`
and wrote the answer into the real lookup cache (M43,
X19).
The fix made the seam required of the preparation,
but the entry driver above it went on handing down the run's readers itself,
so the entry tests still prepared through the key,
the real caches and the corpus clone (M68).
The run client and the provider gate read the provider keys,
the Bedrock ledger's place and the transport from the process by default,
and their tests set some keys and built on the rest the suite inherits (X23).

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
When a seam becomes required,
every reference to the production value is listed (`rg RUN_OUTSIDE_READS src`),
and each one below the function a run calls moves to a parameter:
the process's own values are named once,
in that function (`createRunClient`,
`RUN_OUTSIDE_READS`,
the pass's own calls),
and in TSDoc examples.

What enforces it:
the type checker:
`preparePassEntry`,
`runPassPreparation`,
`runEntryPipeline` and `settleEntry` require `outsideReads`,
and tests pass `NO_OUTSIDE_READS` (`corpus-run/pass-outside-reads.test-fixture.ts`);
`configureProviders`,
`runClientFrom` and `assertRequiredProvidersReady` require `env` and `transport`;
`outsideReadsFrom` requires the environment,
the transport and the corpus readers;
the five provider clients require their transport,
and every corpus reader its pin or reader (X24).
A seam added to make a function testable never takes the production value as its default (M70).

## Tests on the real clock

What happened:
a case filled a 20 ms window on the real clock and expected a take started after it to still be asleep;
under the whole suite's load the window emptied first,
and the case failed only there (M69,
T5).

The rule:
a real-clock case asserts only bounds that load can widen and not break;
a case that needs a caller asleep uses a window no stall outlasts;
a new timing case counts as passing only once the whole suite has run it.

What enforces it:
the whole unit suite run before a batch's work is called done.

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
A tuning constant was declared in two files from their first commit,
one copy "mirrored from" the other,
and only the undocumented copy was read,
so retuning the documented one changed nothing (ledger B31).
The rule for what an artifacts directory holds (regular files named `*.json`) was written into two of the directory's readers,
and four others took any name ending `.json`,
so a directory or a symlink named like an artifact became a settled entry;
five more filtered the one lister's names by the suffix again,
four sliced the suffix off by hand,
and ten files spelled the directory's name (ledger B64).
The same lapse sat in the run's other directories:
the ledger report read the atomic writer's temporary files as contests,
a stray file in the published tree raised ENOTDIR out of the verifier,
and the slice cache stopped an entry on a directory named like a slice;
meanwhile B64's own listing result was a copy of one `directory-listing.ts` already had (ledger B65).
Two readers moved into modules of their own for the italic-title pass shipped tested only through their callers,
since the rule asking for their own tests stood under "Text by code point",
where a reader of structure is not looked for (M88).

The rule:
before writing a helper,
declaring a type or copying a constant,
`rg` the package for its name and for its shape
(for example `rg 'function \w*(codePoint|Han|heading)' src`,
or the field names together) and import what is there.
A copy that must stay separate (an artifact version's frozen rule) says so where it stands,
naming the live copy and the check that compares them.
Code that claims to rebuild what the pipeline built (slices,
sheets,
verdicts) calls the pipeline's own function,
or measures its agreement over the corpus and records the result.
A rule about what a directory holds lives in one module every reader lists through
(`corpus-run/artifact-file-name.ts` for artifacts),
and a new reader of that directory starts from that module;
a name spelled in two files becomes a constant one of them owns
(`runs-layout.ts` for the slice-cache and prompt-payload directories).
Every reader lists through `corpus-run/directory-listing.ts`,
naming the kind of entry its writer makes
(files or directories,
never links),
then filters by the name its writer gives a record,
so a write still under its temporary name is never read.
A helper moved into a module of its own,
or given a second caller,
gets a unit test file of its own in the same change,
with the edges no caller reaches among its cases.

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
`src/directory-listing-scan.unit.test.ts` (ledger B65),
among the source scans,
fails on any directory-listing import outside `directory-listing.ts` and the walkers it names with why.
Nothing yet fails on a shared module without its own test:
a source scan over a classified list of the 167 there are is open (ledger M88).

## Text by code point

What happened:
scans handed a character test one UTF-16 unit at a time,
and neither half of a character beyond the first plane passes a test for Han,
a letter or case:
a quote's neighbour after a script handle (class ninety-six),
a declared handle in script letters,
an Extension B ideograph in the tokenizer and the Han residue floor,
a Deseret letter beside a Canadian date,
and a pinyin pair over such an ideograph (ledger B22).
Two readings of a cased letter disagreed about script letters,
and eleven fixed-length text cuts could keep half an emoji.
The shared readers shipped tested only through their callers,
and their own tests later found a lone second half counted as nothing
and an opening that dropped a lone first half although no pair was cut.

The rule:
a test whose domain reaches past the first plane
(Han beyond the unified block,
`\p{L}` or any general category,
case)
takes a whole character:
`for...of` over the text,
or `codePointAt` and `codePointBefore` from `code-points.ts` where the scan keeps UTF-16 offsets,
stepping by the character's length.
A unit read is kept only where every test on it is ASCII or first-plane only,
and a comment says so.
A cased,
capital or small letter is read by general category (`cased-letters.ts`),
never by comparing a character with its case mapping.
A text's opening cut at a fixed length goes through `wholeOpening`.
A guard for such a scan runs its text in a script beyond the first plane
and compares the result with the same text in Latin letters.
A shared reader gets a unit test of its own when it is extracted,
with lone surrogate halves among its cases.

What enforces it:
`src/code-points.unit.test.ts` and `src/cased-letters.unit.test.ts` pin the readers themselves,
lone halves included;
`src/fixed-length-cuts.unit.test.ts` fails on any `.slice(0, LIMIT)` or `.slice(-LIMIT)` it does not list with a reason;
the Latin-twin cases in `corpus-run/canadian-forms.unit.test.ts`,
and the script and Extension B cases in the declared-name,
tokenizer,
Han residue and pinyin guards,
fail when a unit read returns.

## Words inside words

What happened:
fixed words and phrases were looked for with a raw substring,
so a glossary term matched inside a longer word
(class one hundred sixty-three,
ledger C1),
"as an ai" read as a refusal inside "as an aide",
"load" read as an inability inside "download",
and a refusal written with a typographic apostrophe matched no marker stored with a straight one (ledger B23).
An address that only began with a source link's was read as that destination kept,
and the neutral pronoun was counted only between listed marks,
so a dash or a slash after han hid it (ledger B23).
Two fixes in that pass nearly regressed:
reading a rendering's destinations through the strict grammar alone went silent
where the grammar refuses the rendering,
which is the validator's no-grammar branch that answers unknown;
and a plain word-boundary reading for the pronoun,
chosen before its tests were read,
would have counted the handles,
paths and addresses those tests exclude.

The rule:
a word or phrase looked for in prose goes through `carriesWord` or `wordStarts` (`word-bounds.ts`),
or through `glossary-match.ts` where the forms are folded,
and the text's quotes are folded with `normalizePunctuation` first
when the needles are stored with straight ones.
A name compared on its letters and digits goes through `carriesName` (`name-projection.ts`),
never containment in a projection,
which has lost the spaces between words;
a handle or a source form inside a link text is matched at handle edges,
where a hyphen and an underscore join.
A word that is never a piece of an address,
a path,
a handle or a compound goes through `tokenStarts` (`word-bounds.ts`).
A link destination is read as the grammar reads it,
the skeleton's `link-url` atoms,
never as a substring of the rendering,
and a rendering the strict grammar refuses is read under plain markdown,
never as carrying nothing.
Before narrowing any reading,
read the floor's own tests for the exclusions they pin,
and read the caller's branch for a text the reading cannot parse.
A raw `includes` on prose is kept only for containment,
a quote or a span found whole inside a text,
and a comment says so.
Turning a substring list into a word-bounded one reads,
for each needle,
the words that carry it past their start
(`/usr/share/dict/words` holds them),
and lists on its own each such word that keeps the needle's meaning.

What enforces it:
`word-bounds.unit.test.ts` pins both edges,
the open end,
digits and combining marks,
Han and punctuation edges;
the refusal,
picture-sense and reading-refusal guards hold a word carrying each marker,
a typographic apostrophe,
and each prefixed form listed on its own;
`name-projection.unit.test.ts`,
the survival guard and the link-name guard hold a key inside a longer word,
a case change and a digit inside a handle,
and a handle running on at either end;
`word-bounds.unit.test.ts` pins the token reading's joiners,
its trimmed ends and the mention mark,
and the neutral pronoun guard holds the dashes,
the slash after han and every exclusion;
the unwrapped-link guard holds a longer address
and an unwrap in a rendering whose original is refused too.

## Which fold for which question

What happened:
text written with curly quotation marks on one side
and straight ones,
or English quotes for corner brackets,
on the other was compared byte for byte (ledger B24).
A model's quote of the archive failed to anchor or to verify,
and lost its vote;
a copy of the incumbent with straightened quotes stood on the slate as a second candidate
and split the stake of one wording;
two voices giving one title with different apostrophes split their lexicon votes;
and a title reference apart from its heading only in apostrophe style was reported ambiguous
or rewritten into the other style.
Guillemets,
which English prose never uses,
shipped on one page although a judge named them,
and nothing read them.
A proposal that was the archive with its soft line breaks elsewhere,
which the site renders as spaces,
shipped as a change,
split a slate's stake with the incumbent,
or came back onto a consolidation slate as a lane text,
because each site asked whether it changed anything by bytes,
or by bytes and one rewrap of the base (ledger B26).

The rule:
first say which question the comparison asks.
A model's quote against the document it quotes takes the evidence fold (`normalizePunctuation`),
which also maps the corner brackets,
because a model quoting a Chinese passage paraphrases them.
Two renderings compared as one wording take the typography fold (`straightenQuotes`),
which maps curly and straight only,
because a rendering that kept 「」 is another rendering;
a whole slice,
which may carry code,
takes `straightenProseQuotes`,
which leaves a quote in a code span or a tag as written,
the restoration's own reach.
Whether a proposal changes the wording that stands takes `sameWording`,
which reads both through the wrap,
folds a paragraph's soft line breaks where the line-structure rule does not govern,
and keeps a hard break,
a blank line,
an opening indent and front matter apart;
every site that ships,
demotes,
collapses or offers a text asks it,
and bytes stay only where they are the contract
(assembly,
offsets,
seals,
an artifact's persisted relation).
A key is total:
before one reads text through a parser,
the parser's thrown errors are read and each gets a defined answer,
since a comparison that throws turns a question into a crash (M61).
A title,
a phrase or a document span compared with another document span needs no fold.
Offsets taken in folded text are used only in folded text:
every fold here maps one unit to one unit,
and the comparison states which text its offsets index.
A mark the pages never use is refused by a floor,
not left to the judges:
a judge who names it does not keep it off the page.
Before folding a site,
measure what the fold would move over the stored records,
with a positive control that must move,
and where the pinned corpus cannot reach the site,
record it as unexposed rather than widen a reading that brings a hazard of its own
(a single-quote pair cuts at an apostrophe;
a wider URL stop cuts an address).

What enforces it:
`quote-normalize.unit.test.ts` pins both folds and the prose reading's code span,
tag and astral characters;
the attestation,
archive-review,
introduced-defect,
Latin title,
lexicon,
slate-collapse and title-reference guards each hold a straight quote against a curly one,
and the guillemet and sheet-leak guards hold the marks,
the exemptions and the editor sheet's marker;
`wording-key.unit.test.ts` pins what the wording key folds and what it keeps apart,
and the slate,
both lane wraps,
the consolidation wrap,
the polish round,
the lane offer,
the repair turn's copy check and the archive block review each hold a layout-only twin.

## Which seats a quorum counts

What happened:
the short-bench rule moved every gather's quorum onto the seats a wet provider serves,
and the archive block review's outage test moved with it,
but the same function's second threshold,
the anchored voices a review needs,
stayed at the whole bench's quorum (ledger B27).
A short bench whose every reachable seat anchored its quote was left unresolved
and skipped its naturalness read.
Two sentences kept saying a short bench cannot settle,
which the rule had made false.
And two short-bench cases refused two seats of four,
which leaves a quorum,
since the quorum is half the bench rounded up;
each failed at its own premise before reaching the stage (M86).

The rule:
when a rule changes what a quorum counts,
census every threshold derived from a gather,
not only the gather:
every `rosterQuorumSize` call,
every "half the bench",
every count compared with a bench size,
and every sentence saying what a short bench can do.
A threshold on voices a gather produced takes the `reachableQuorum` the gather closed on,
computed once and shared by every test in the function;
only a size taken before any seat is lost
(the first round's window)
or the definition of short itself counts the whole bench.
A threshold is a floor a count reaches,
so a case holds the count exactly at it,
or a boundary mutant survives.
A short-bench fixture is sized from `rosterQuorumSize` read in the code:
a bench is short only when fewer seats are reachable than half the bench rounded up.

What enforces it:
`archive-block-review-stage.unit.test.ts` holds a bench with most seats refused,
asserting from the exported helpers that the case discriminates,
and a count exactly at the quorum;
the gather,
the windowed rounds,
coverage,
the select minimum and the naturalness review each hold a refused seat
(`stage-quorum.unit.test.ts`,
`stage-windowed-rounds.unit.test.ts`,
`coverage-stage-reachable.unit.test.ts`,
`candidate-select.unit.test.ts`,
`absolute-naturalness-review-stage.unit.test.ts`).

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
and a summary pattern that misses oxlint's singular "1 warning" (M95).

The rule:
read a region with the Read tool before editing it.
Lint,
type check and the named tests run after the final edit of a commit,
in that order,
and the commit follows only a clean run of all three (M46).
The named tests of a source commit include the package-wide source scans,
run as one task,
`mise run source-scans`
(its description names each),
since a new class,
function,
export,
link,
sheet or clock time is read by those and not by its own file's tests;
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
Lint's summary is read with `rg 'Found [0-9]+ warnings?'`,
beside the findings list,
each a check on the other (M95).
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
Markup quoted in prose,
a link above all,
goes in a code span,
or behind an escaped bracket inside a quotation that spans lines.

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
unless a TSDoc link names it (ledger B32).

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

The rule:
a task that must not run with a fan-out parent is named outside the parent's prefix,
and a new task's first run is read in its log for every task it started.
Output that can reach gigabytes goes under the package's cache directory on disk,
after `df` has shown the filesystem.
A fixture printing a marker that tooling counts builds the marker when it runs,
and a new test file's first run is read for markers,
not only for its exit.
A scratch scan lists its files from git's index,
or walks with a bound that skips `node_modules`,
and runs with a heap cap (`node --max-old-space-size=512`);
one that runs past its expected time is checked once by process status.

What enforces it:
the coverage census,
which refuses a suite whose log carries a failing marker;
habit for the names and the directories.

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

## What each sheet is shown

What happened:
two sheets listed the apparatus kinds without the bound that says what apparatus never is;
the archive block review and its slate,
coverage,
the page-title lexicon and the refine slates carried house rules that point to a DECLARED NAMES block,
and never got one,
though each caller held the names (ledger B28).
The lexicon ran before preparation,
which built the identity lines inline where nothing else could read them.
The refiner was told a handle survives exactly,
and the judges choosing among its rewrites were not.
The fixture rendered 13 of its 38 sheets naming the block without it,
so no guard reading the rendered sheets could tell a sheet that lacks the block from one the fixture left bare,
and the fence each new block needed and the follow-up coverage sheet went untested until a mutation batch.
The rendering audit,
which reads settled renderings after a run,
was shown the declared names and never the cited references the critics and panels had read (ledger B29),
and the rule it needed could not be the critics' copy:
that one names a TRANSLATION the audit never shows and a category its wire rejects.

The rule:
a sheet whose rules name a block carries that block wherever its caller holds it.
Adding a block to a sheet threads it from where production holds it
(`pass-prepare.ts`,
`pass-insertion-admission.ts`,
the stage)
in the same change,
and a case drives the caller and reads the model call.
What a writer is shown,
the judges of its text are shown,
and so is any instrument that audits the text afterwards:
the names,
the references and the bounds.
A rule shown with a block names the texts and the categories of the sheet it sits on.
A block a sheet encloses goes into the texts its fence is chosen against,
and every branch of a sheet
(a first ask,
a follow-up)
carries the same blocks.
Context read by more than one sheet is assembled once and read by each
(`page-identity-lines.ts`,
`declared-names-evidence.ts`,
`translate-slate-evidence.ts`),
never rebuilt inline beside a caller.
The rendered-sheets fixtures give each sheet what production passes it,
through the functions production calls where there are any.

What enforces it:
`rendered-sheets-context.unit.test.ts` fails on a rendered sheet that names the DECLARED NAMES block or CITED REFERENCES without carrying the fixture's,
unless it is exempt by name with its reason,
and on an exemption gone stale;
the caller cases
(`pass-prepare-archive-review-context`,
`pass-insertion-admission-identity`,
`pass-prepare-lexicon-context`,
`refine-identity-threading`)
fail when a caller stops threading the names;
`sheet-fence.test-fixture.ts` lets a case read the fence a sheet opened a block with.
A sheet whose rules name no block,
and a caller whose fixture passes a block production does not,
are outside what these can see.

## Defaults that stand in for an input

What happened:
the final polish held the slice's disputed wordings and never passed them,
so a polish landing on one shipped past the three checks that had refused it;
the chunk's checker check left the refiners out,
and the bench read at the checker stage was read for quorum alone;
two writers' sheets displayed candidates without their break counts;
reference attestation decided on one voice;
and a chunk scan swallowed a parse error with `void error` (ledger B29).
A page no grammar could read was read as an empty page,
and the translate floor passed the candidate against the original alone (ledger B36).
Each default read as "none",
and the code compiled and ran.
Three exported names were each declared twice,
one pair with one signature for two comment grammars.

The rule:
a call states every input that decides what a floor refuses,
what a sheet shows or whether a text may ship,
even where the default happens to equal it;
a call that leaves one out says why at the call or in the guard's named list.
A gate flag never defaults to the permissive answer without every caller stating it.
A reading that failed reaches the verdict as a failure,
never as an empty value a check then passes.
A check re-read mid-run applies every rule the first read applied.
A caught error is logged,
rethrown,
or returned as data carrying it;
a parse whose failure is ordinary goes through `parseModelJson`,
never a catch that drops the error.
Each exported function has a name no other file exports,
chosen for its role and its boundary.
Text is sliced by index,
never grown a character at a time.

What enforces it:
`floor-inputs-stated.unit.test.ts` fails on a production call leaving a floor input or gate flag out,
unless the call is named with its reason or sits in a named measurement file,
and on a named call or file that no longer leaves anything out;
it cannot see a key nested in a named type or a parameter typed by a named alias.
`exported-function-names.unit.test.ts` fails on a name two source files export.
`caught-errors-kept.unit.test.ts` fails on a catch clause that binds nothing,
discards its error with `void`,
or neither logs,
rethrows nor names it;
a clause that names the error only to test its class passes,
so review still reads what a clause returns.
`text-accumulators.unit.test.ts` fails on a `let` begun as text and grown inside a loop,
unless it is named as reading no text.

## Messages a marked class carries

What happened:
`ArtifactParseError` declares `messageNamesOnly`,
so every refusal printer repeats its message,
and six of its throw sites handed it another error's text.
Two quoted the stored value they refused,
a pipeline digest and a preparation identity,
through the assertion's own message;
one forwarded an unmarked class whose throw sites wrote finished sentences;
one forwarded from a check that could not fire.
The inventory checked what each marked constructor interpolates,
so none of it showed (ledger B34).
The digest's own message described the hex half as the whole value,
leaving out the scheme name every digest starts with.
A marked class can also say too little:
`PromptPayloadStoreError` gave one sentence for every check the prompt payload store makes,
so a `TALLY` line could not tell a corrupted record from a format change from a full disk,
and the one refusal case passed whichever check fired (ledger B69).

The rule:
a marked class writes its sentence itself,
from counts,
names and closed kinds it is handed,
never from a finished message.
A throw site hands a marked class a caught error's text only from a catch narrowed to marked classes,
and rethrows anything else unchanged.
A reader refusing a stored value by its shape tests the shape itself,
says in its own words what shape it expected,
built from the constants the check reads,
and never quotes the value;
an assertion that also narrows runs after that test.
A class that writes its own sentence and stays unmarked says why in the inventory's withheld list.
A marked class names what refused,
by a field's path,
a check,
a filesystem code or a class name,
since its message is all an operator sees;
where one class serves several checks,
each throw site hands it a reason of its own.

What enforces it:
`message-names-only.unit.test.ts` fails on a marked class whose constructor interpolates a part the inventory does not name,
on a marked class forwarding a `message` parameter,
on an unmarked class writing its own sentence without a withheld reason,
and on any construction of a marked class whose arguments turn a caught error into text
(a template holding the binding,
`String` or `caughtValueText` of it,
or its `message` or `stack`)
at a site `FORWARDING_SITES` does not list,
or lists as forwarding from a catch narrowed to anything but marked classes.
It reads a narrowing by its presence in the catch,
not as proof that it guards the throw,
so each listed site is still read by hand.
`prompt-payload-store.unit.test.ts` asserts each of the store's refusals as `tallyErrorText` prints it;
no scan finds a marked class whose throw sites share one sentence,
so that too is read by hand.

## Fields carried as strings

What happened:
footnote mentions were keyed as `role convention identifier` strings,
and four readers split the keys back into parts three different ways,
two with a fallback for a part the key always has (ledger B35).
A draw looked artifact file names (`whiskers.json`) up in a map keyed by entry id (`whiskers`),
both plain strings,
so no lookup matched and every real sample manifest said no kept entry recorded a pipeline digest;
the unit fixture keyed its map by file name too,
agreeing with the defect rather than with the map's builder (ledger B63).
The lone-tag mask recorded each tag's offsets and returned only its text,
so the container deficit searched the slice for that text,
found a whole element of the same name beside the container,
and counted that element's blocks as the container's (ledger B67).
The shortfall budget named each passage by its position written as text,
and its callers read the admitted names back with `.map(Number)` (ledger B73).

The rule:
a producer hands its readers fields;
a key string is built where keys are compared,
and nothing reads a part of one back.
A reader that needs a part of a key reads the field it was built from.
A finder hands its readers the offsets it found,
and a reader never searches the text again for what was found:
the search finds the first or last copy,
not the one the finder meant.
Two strings that name one thing differently are two types
(`ArtifactFileName` against an entry id),
and a lookup is fed the key its builder used.
A number handed through the package's own functions stays a number,
never written as text for a helper to hand back.
A fixture standing in for a lookup another module builds is paired with one case that drives that module.

What enforces it:
habit and review;
a fallback on a part a value always has shows in the coverage census as a stretch no test can reach.
The artifact name's template literal type (`` `${string}.json` ``) refuses a bare entry id where a file name is expected.

## Counts a finding states

What happened:
the reference-count floor wrote one sentence per missing or surplus copy,
each saying the other side carried none,
so a model carrying a link once where the original carries it twice was told it carried none (ledger B37).
Lane messages printed a count before a noun fixed in the plural,
and a repeat fault's distinct count is 1 whenever two entries share one index,
so they read "under 1 distinct indices";
one test asserted that wording,
agreeing with the defect (ledger B66).

The rule:
a finding comparing how often two sides carry something writes one sentence per thing compared,
never one per copy,
and names both counts whenever both are non-zero;
"does not" is written only for a side that carries none.
Its tests pin each count arm (none,
once,
more than once,
on each side) by the whole sentence.
A count in any message takes the word `wordForCount` (`count-word.ts`) chooses,
or `howOften` for a number of times,
and a case pins the count of 1.

What enforces it:
habit and review;
the atom floor's cases pin its arms,
and an arm no case reaches shows in the coverage census.
The rest of the count-before-plural family is to be classified and fixed as one change (ledger B66's open list).

## Paired marks

What happened:
five readers of paired marks each paired an opening mark with the next closing mark,
so an opening mark that never closed took the next title into its span,
and three of them grew with the square of the unclosed marks (ledger B38).

The rule:
a reader of paired marks (title marks,
quotation marks,
brackets) reads spans through `closedMarkSpans` (`closed-mark-spans.ts`),
never through an `indexOf` loop of its own,
and its tests carry an opening mark that never closed.

What enforces it:
habit and review;
each reader's stray-mark case fails if the reader stops using the shared rule.

## Exits an outcome rule reaches

What happened:
the owner's rule to keep wording that cannot ship and ship the slice reached the judge's decline exit,
and not its empty-slate exit beside it,
so a slice whose archive wording the floor refused and whose translators proposed nothing usable stopped the entry (ledger B39).

The rule:
a rule that changes what an outcome does (ship,
stop,
keep) lists every exit that produces that outcome:
each throw of the error class that carries it and each caller that rethrows it,
and states for each whether the rule applies and why.
Each exit it applies to has a case.

What enforces it:
habit and review;
an exit the rule missed can show in the coverage census as a rethrow no test reaches,
as this one did.

## Text that shows nothing

What happened:
the checks deciding whether a model's wording or reason said anything asked `trim()`,
which keeps every invisible character that is not whitespace,
so a reply of one zero-width space passed the reply guard,
the intake fold emptied it,
and an empty candidate reached the judges;
a zero-width reason met "Reason before vote" the same way (ledger B40).
The docs of the two backstops said no such text could reach them.

The rule:
whether text a model wrote shows a reader anything is asked of `rendersAsNothing` (`renders-as-nothing.ts`),
never of `trim()`,
`length`
or a comparison with the empty string,
and a check that also folds or tidies the text asks it of the bytes that ship.
`trim()` stays where the question is spacing:
a parsed value's edges,
a setting,
one character's class.
A test of such a check carries an invisible character `trim()` keeps
(`U+200B`)
and one no fold removes
(`U+3164`),
spelled as escapes.

What enforces it:
habit and review;
`renders-as-nothing.unit.test.ts` pins the reading,
and each check's invisible-only case fails if it returns to `trim()`.
No scan finds the old shape:
a check can store a trimmed value in one statement and compare it in another,
as the panel ballot's did,
which a token scan does not follow.

## Records of more than one round

What happened:
the judges' retry kept the findings of every ask it made,
and the translate stage's follow-up round one level up returned its own record alone,
so a slice settled at depth two could not say its first slate was declined (ledger B41).

The rule:
code that runs a stage again and returns one result carries every earlier round's findings into it,
earliest first,
with a finding naming each new round and why it was asked,
on the returning path and the raising path alike.
Its test compares the whole record around that finding.

What enforces it:
habit and review;
the stage case and the B39 case fail if the depth-two layer drops a round again.

## Structure read off the parse

What happened:
the quote guard counted blockquotes as blank-line-separated chunks opening with `>`,
while the floor it stands beside reads the parse,
so a quote opening on the line after a paragraph's was a blockquote to the floor and none to the guard,
and a replacement keeping every quote was refused
(hulicaijia24 slice 2,
ledger B42).
The census stretch for the refusal looked unreachable because the floor was read as the guard's reading.
The container block deficit counted runs of non-blank lines on each side,
so a list written tight in the original and loose in the archive,
or a fenced block with a blank line inside,
moved the deficit and admitted or refused a passage wrongly (ledger B68).
The italic-title pass read the archive's italics by splitting each line at its stars,
so a comment's or an expression's words read as a title
and a linked or underscored one was never read,
and it wrote a quoted title in italics inside an italic span,
where nothing set it apart (ledger B72).

The rule:
a question about what a passage's blocks are
(how many quotes,
which kind a block is,
what a container holds)
is asked of the parse the floor reads
(`readPageSkeleton` or `readSliceSkeleton`),
never of a blank-line split or a first character.
A split on the text stays where the question is the text itself,
as splicing a held-out run back is.
A guard's tests carry a case where the split and the parse disagree:
a block opening on the line after a paragraph's,
and one inside a container tag.
Before calling a guard behind the floor unreachable,
check that both read the structure one way.
Where a count is compared across two sides and then spent,
one reading serves all three:
the deficit's passages cost the blocks the container counted for their slices.
The same holds inline:
which words a text sets in italics,
in bold or in a link is read off the parse
(`emphasisSpans` for italics),
with HTML comments first blanked to spaces of the same length,
as `parse-slice-body.ts` does,
so that no offset moves and no comment's words are read.

What enforces it:
habit and review;
`quote-preservation.unit.test.ts` carries both disagreeing shapes,
and `quoteBlockCount` no longer exists to be reached for;
`insertion-container-deficit.unit.test.ts` carries loose against tight lists and a fenced block with a blank line;
`emphasis-spans.unit.test.ts` and `archive-italic-title-restore.unit.test.ts` carry the inline shapes a split misreads:
a comment,
a JSX comment beside one,
a link,
underscores
and a span across lines.
Three more blank-line block readers are listed under ledger B68 to be read against this rule.

## What a catch charges

What happened:
the front-matter floor read the original,
the page and the candidate inside one try,
and its catch answered every throw as the candidate's YAML,
so a refusal of the original's or the page's YAML was charged to a sound candidate
and sent its author to revise it
(ledger B44).

The rule:
a try holds only the call whose failure its catch describes,
and the catch narrows to the class that call raises
through the shared narrowing
(`requireMdxRefusal`,
`requireFrontMatterRefusal`),
whose own case reaches the rethrow of anything else.
A side the candidate did not write is read outside the candidate's try,
and a side no reader reads is reported as that side's fact
(`translate-floor-ground.ts`).

What enforces it:
habit and review;
`front-matter-slice.unit.test.ts` carries a refused original and a refused page beside a sound candidate,
and each narrowing's own cases reach its rethrow.

## Work no floor can check

What happened:
where the floor could compare nothing
(an original no grammar reads),
the translate stage still bought translators and judges,
kept the archive off the slate on the floor's `unknown`,
and let a candidate stand on the same `unknown`,
so an admitted insertion wrote a rendering nobody could check into the page,
and on a slice the archive translates every call bought nothing
(ledger B43).
The consolidation asked its writers there too,
and the floor refused all they wrote
(ledger B45).

The rule:
a stage that buys work a deterministic check must pass asks first whether the check can pass anything on that input,
through the definition the check itself reads
(`floorReach`,
`translate-floor-ground.ts`),
and settles without buying where it cannot:
on the archive where there is one,
unfilled where there is none.
Past that question,
a verdict the caller has ruled out is read through a narrowing that raises
(`requireComparedVerdict`),
never through a branch that keeps a candidate on it.

What enforces it:
habit and review;
`translate-stage.unit.test.ts`,
`translate-document.unit.test.ts` and `consolidate-driver.unit.test.ts` count the calls on a blind slice,
and `translate-floor-ground.unit.test.ts` pins the reach and the floor to one reading.

## Loops that copy what they built

What happened:
folds over a page's lines,
a slice list,
a gap list or a list of losses returned what they had built so far spread into a new list,
or cut and rejoined,
at every step,
so each step cost as much as every step before it (ledger B70).
One of them was the stub-marker scan,
whose summary called it one linear pass;
it copied every line kept so far at each line of the page.
Text edited in several places was spliced one edit at a time,
last first,
at offsets into the original,
copying the whole text per edit,
and where one edit's rewrite changed its length and another's range held it,
the second cut in the wrong place:
a title quoted inside a quoted title lost the mark after it.
Nothing read the shape:
the text accumulator scan sees only a `let` begun as text and grown in a loop.
The guard written then read folds and reassigned bindings,
and five loops that grouped or queued by key set a map entry to a copy of what it held at every repeat,
among them the cap census's queue of a label's streams (ledger B74).

The rule:
a fold or loop over its input appends to what it builds,
and removes in place where a step removes;
it never returns a copy of the list or text built so far,
nor sets a map entry to a copy of what the entry held:
it pushes onto the entry's list,
or groups with `Map.groupBy`.
A record of fixed fields may be copied per step,
since it costs the same each time.
Several edits into one text are placed by offsets into that text
and written in one pass with `spliceDisjointEdits`,
which refuses edits that share a unit or a start;
a caller whose edits can nest decides which it keeps before it writes,
and names only the edits it wrote.
A fold whose each step reads what the step before wrote,
or that walks a fixed table,
may rebuild,
and says so where the guard names it.
A summary that calls a pass linear is read against the pass.

What enforces it:
`fold-copies.unit.test.ts` fails on a `reduce` or `reduceRight` callback that copies its accumulator
(a spread into a list,
a copying method,
a `Map` or `Set` built from it,
or `+` where the fold starts from text)
and on a loop that reassigns a list or text as a copy of itself
or sets a map entry to a copy of what the map's `get` read there,
unless the fold is named with why its copies are bounded or are its meaning,
and on a named fold that no longer copies;
`disjoint-splice.unit.test.ts` holds the one-pass writer to the old splice's text and its refusals.

## Numbers read back from text

What happened:
the slice-cost reader took a count as whatever `Number` made of the field's text,
so an empty field read as 0,
`0x1F` as 31,
`1e3` as 1000,
a leading sign as part of the count,
and a digit run past the largest exact integer as a neighbouring number,
though its writer only ever writes the digits of an integer (ledger B71).
It also checked each field in one loop and read it again through helpers that threw when the loop had not,
throws no line could reach.
The same reading ran through the package (ledger B73):
counts in its own log lines,
sheets and declarations,
the dials and flags an operator types,
the prices and lengths providers list,
and the stamp on every log line,
which `Date.parse` read without its zone as local time
and,
cut off part way,
as NaN that one reader kept as a call's end and another as a sample's time.
A probe counting the family first missed readers handed on as values (`.map(Number)`) and `Date.parse`
(ledger M90),
and a call about what providers write was first made from the package's fixtures,
not their stored listings (ledger M91).

The rule:
a reader of a number in text accepts only the spelling its writer writes,
through a shared rule or a round trip through the writer:

- a count is ASCII digits a double holds exactly (`isWholeNumberText`),
  leading zeros read as written,
  and every refusal cites `WHOLE_NUMBER_RULE`;
- an amount an operator types is a plain decimal (`isDecimalText`),
  then finite;
- a number a service writes as text takes JSON's spelling (`isUnsignedNumberText`),
  then finite and not under zero;
- a log stamp is what `toISOString` writes (`isIsoStampText`),
  and a line whose stamp is not is left out and counted,
  never placed at a time nobody wrote;
- a value the package wrote with `String` is read back only when `String` spells it again.

Each field is read once,
into its value or its refusal,
and the record is built from those readings.
A number an operator types is read by the same rules,
a blank variable reads as unset,
a minus sign before digits is answered as a count under zero,
and the refusal says what leaving the value off does.
A number passed between the package's own functions stays a number:
it is never written as text only to be read back.
Before counting a family,
list every way the language reaches the behaviour
(a call,
a construction,
a value handed on,
a coercion);
before deciding what a writer writes,
measure its stored output with a control.

What enforces it:
`number-reads.unit.test.ts`,
which `source-scans` runs,
fails on a call of `Number`,
`parseInt`,
`parseFloat`,
`BigInt`,
`Number.parseInt`,
`Number.parseFloat` or `Date.parse`,
a `new Date` given an argument,
a unary plus on anything but a literal,
or any of those readers handed on as a value,
until the read is named with the rule that holds it;
`whole-number-text.unit.test.ts` and `iso-stamp-text.unit.test.ts` hold the shared rules,
and `iso-stamp-text.test-fixture.ts` lists the stamp spellings every stamp reader is shown refusing.
Out of the scan's reach:
a reader reached through `globalThis` or a renamed binding,
and arithmetic on text.

## Command lines

What happened:
every runner found its own flags with `indexOf` or `includes` on the exact token,
so `--cap=0`,
a mistyped `--olny`,
a second `--only`,
or any argument to a runner that reads none
read as not written,
and the runner ran what nobody asked for:
every pending corpus entry,
every subject the settled audit could buy,
or the seated roster in place of the models named (ledger B75).
A flag written last or before the next flag read as unwritten,
a plain-object table looked up by a typed name found `Object.prototype`'s keys,
the mise task descriptions,
written by hand,
had drifted from what five runners read,
and three refusals did not show what was typed,
one of them not even which part of the line was wrong.
An `--only` naming an entry a runner could not reach was dropped without a word,
so the runner ran over nothing,
or over the rest when the stray stood beside real entries (ledger B76).

The rule:
a runner declares what it reads in `corpus-run/command-lines.ts`
(valued flags,
repeatable flags,
switches and positions),
hands `process.argv` and its own name to `reportingRefusals`,
and reads only the line that call hands it;
a flag's value goes through `corpus-run/command-flags.ts`.
The reader refuses,
all at once and ending with the usage line,
anything the declaration does not name or a value it cannot use,
and every refusal names the part that is wrong and quotes what was typed.
A table keyed by typed text is a `Map`,
and a list the command line names,
such as the card providers,
is written once and read by both the declaration and the reader.
A task description,
and every invocation in the living docs,
names only flags the runner reads.
Ids a line names are held to what the runner can reach through `askedAmong`,
which refuses the line,
naming every stray,
before anything is spent.

What enforces it:
`command-lines.unit.test.ts` fails on a runner the build makes that the table does not declare,
a malformed declaration,
a task description out of step with its runner's flags,
or a living doc invoking a runner with a flag it does not read;
`command-line-reads.unit.test.ts`,
which `source-scans` runs,
fails on a read of `process.argv`,
an import of `parseArgs`,
or a dynamic import of `node:process` or `node:util` anywhere but a runner's own hand-off and the one reader;
`command-line.unit.test.ts` holds the reader's readings and refusals,
and `command-flags.unit.test.ts` the refusal of ids a runner cannot reach.
Habit holds a new runner that narrows its walk by id to `askedAmong`.
Out of the scan's reach:
`process` reached through `globalThis` or handed on whole,
and a property name built at run time.

## Tables keyed by text

What happened:
plain objects served as tables looked up by text the package did not write:
a provider's stream delta type,
a corpus asset's extension,
a stored issue status and repair disposition,
and corpus entry ids in the attempt counts.
An object answers `constructor`,
`toString` and the other names it inherits with the prototype's values,
and one written through `__proto__` sets its prototype and drops the entry,
so a delta typed `constructor` was routed with `Object.prototype` as its channel,
an asset named `tabby.constructor` read as usable,
a claim with that status was filed under the `Object` function as its arm,
and a count for `__proto__` was never written (ledger B77).

The rule:
a table looked up by text is a `ReadonlyMap`,
and a record filled by a key is a `Map` until it is handed on whole,
as an object from `Object.fromEntries` at its function's return or its file's write.
A table over a closed set of names keeps the names in its type
(a literal-keyed object,
checked with `satisfies` rather than annotated as a record of strings,
or a `Record` over the set's own union),
so the compiler refuses a lookup by unchecked text;
an exported table needs an annotation under `isolatedDeclarations`,
which widens its keys,
so an exported table looked up by text is a map.

What enforces it:
`text-keyed-tables.unit.test.ts`,
which `source-scans` runs,
fails on a declaration typed with string keys
(`Record<string, …>`,
that inside `Readonly`,
a string index signature,
or a package alias of one,
by annotation or by a cast)
whose value is an object literal at a module's top or `{}` anywhere,
or that is written through a computed key;
the red cases in each site's test file hold the inherited names.
Out of the scan's reach,
and read once by a typed census recorded in ledger B77:
a table built by `Object.fromEntries` or handed back from a function and then read by text,
a class field,
a parameter destructured from an object an alias types,
a key typed by a template literal,
and a cast of text to a table's literal keys.
