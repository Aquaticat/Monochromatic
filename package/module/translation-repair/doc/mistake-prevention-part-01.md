# Preventing this package's mistakes, part 01

Part 01 of [Preventing this package's mistakes](mistake-prevention.md),
whose index lists every part in order.

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
    M19),
    and not the `[PASS]` lines:
    a suite with failing cases still prints its pass line,
    so that count is the same in a red run and a green one (M125).
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
8.  Both output streams reach the log through one descriptor (M147):
    the runbook's `> "${RUNDIR}.log" 2>&1`,
    or a systemd unit given `StandardOutput=truncate:<log>` and no `StandardError` property,
    which then inherits stdout's file;
    never `StandardOutput=truncate:` beside `StandardError=append:` on the same file,
    whose stdout overwrites every stderr line,
    every `warn` among them.
    Right after the launch,
    `systemctl --user show --property=StandardError <unit>` prints `StandardError=inherit`
    (the runbook's launch step).

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
so it could not be seen failing (M97);
and the attribution reader's cases for generations 2 and 3 wrote each record's index as generation 4 does,
so they agreed with a decoder that read one spelling for every generation,
while 42 stored artifacts those generations wrote were refused (ledger B107);
and cases another contributor added asserted a prefix of a damaged heading (ledger B133),
an empty result that holds with or without the check named (ledger B130),
a comparison over a fixture with nothing to compare (ledger B131),
or the wrong result as the intended one (ledger B128,
B139).

More on 2026-10-05:
a scripted client no prober ever heard,
whose cases asserted no findings (ledger B143);
footnote cases whose expected text was the fixed function's own output (ledger B146);
a coverage control that held with no decoy taken (ledger B150),
and called a cut that left nothing evidence it could not locate (ledger B149);
and a store guard that checked a settlement's fields one by one and never two that come together (ledger B151).
A scripted client is shown heard by each stage it serves before a case built on it counts,
and an expectation for a parse-dependent result is written off the printed tree.

Trial cases named a guard no input can tell from its absence,
reached an invariant throw through a cast,
and asserted an answer alone under a name for two knobs (ledger B178).
A case is shown to fail with the thing it names taken out of the build,
before its name is believed.

The consolidate store still resumed a gate whose choice its own ballots do not give,
and flags no writer sets beside their terminal (ledger B187).
Two reading-cache cases built records that a closing check refused whatever field they named (ledger B188),
and trial cases in seven files were refused before the line they named was read,
or answered a status that never reached the throw they named (ledger B211).
A refusal case hands in a record with one cause,
and resumes the same record with that cause mended.

Trial cases in twenty more files asserted what no change to the code under test could move:
a default compared with its own expression,
a check for `undefined` on a value never undefined,
a sheet searched for a sentence its run is never given,
a seed whose shuffle agrees with arrival order and with alphabetical order,
a scripted verdict outside the wire's vocabulary,
and a note never shown absent where its count is zero (ledger B225,
B226).
A case that reads the environment sets it and clears it,
and a note or a finding is shown absent beside the input that raises it.

The consolidate store was first driven against the real stage on 2026-10-06 (UTC),
and resumed a gate that heard fewer voices than its quorum,
a settlement the stage returns and the persistence rule never writes (ledger B249).
Cases in six more files could not fail on what they named:
a refusal checked by its class alone,
an input that could not tell one guard from another,
a length read where the whole operation was meant (ledger B256).
And an agent's strip of its shell's environment,
built by filtering the printed environment for key names,
removed nothing,
since the filter printed the matched text and never a name,
so a built command ran with the run's keys (ledger M120).
A guard is shown to remove,
refuse or fail on the thing it is for,
on a real instance of that thing,
before anything is run behind it.

Agents' cases pinned how many texts a scan passes over a generated family (60,
36 and 36)
and how many spellings a grammar accepts (106),
and one compared a list's length with itself (ledger M137).
A count read off a run moves with the fixture and says nothing of the property it stood for,
and the owner's rule is to avoid magic-number tests.
A case asserts the property itself:
the passed texts are exactly those the stated rule skips,
or both verdicts occur and every reader agrees with the grammar.

A damage case checked only that its text held the borrowed sentence,
which a sentence set anywhere also satisfies (ledger B331).
Three guards no input can tell from their absence stood with nothing at their site to say so:
one had a record saying every case passes without it,
and the case that named it deleted (ledger B178);
the other two were found by a review of the trial's cases (ledger B335).
The bench-draw cases held three `toContain` assertions where each whole value was known (ledger B348).
A case on arming a deadline inside a queue's slot passed whichever way the deadline was armed,
since its transport ignored the signal the deadline aborts (ledger B362):
a scripted transport honours the signal a case means to see fire.
The pass republish case read the page it expected from the output it was checking,
so it passed whichever page the line named;
it now names the original page,
and a mutant reading the English page first fails it (ledger B368).
A case never takes its expectation from the value under test.

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
A fixture standing for a stored record of one generation is spelled as that generation's writer spelled it
(`artifact-key-vocabulary.ts` names each renamed key),
never in the reader's own names,
and a reader of a renamed key gets its spelling from the vocabulary.
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
Every test file awaits one root `describe` at its top,
its suites as children run one at a time (ledger B99),
since a failing suite awaited at the top ends its file
and every suite after it goes unrun and unreported;
`multi-suite-top-level.unit.test.ts` holds each file to it.
A mutant whose case prints no FAIL line is still read as surviving
only once that case's suite printed its pass line,
and a red case counts as red only from its own FAIL line.
A case over a pass that rewrites text asserts the whole text it returns,
and a case named for a check feeds the check an input only that check decides.
When one side of a compared pair becomes derived from the other,
every guard comparing them is re-read:
one that can no longer fail goes,
and its record names the case that still carries the invariant.
A guard whose mutant no input can catch is an equivalent mutant:
no case is written for it,
and it stays or goes by what it does for the code
(a narrowing the type check needs,
a plain word for an edge);
one that stays carries a comment at its site saying why no case can separate it,
so a reader of a later mutation run finds the reason beside the survivor,
not in a ledger entry.

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
a scan of map writes read every two-argument `set` as one,
a typed array's copy among them,
and code was bent into a loop to pass it (ledger B342);
and a search whose pattern `rg` refused printed its `|| echo` fallback,
which read as finding nothing (M99).

A fix was committed after a run of 35 named test files that left out the one file asserting the old wording,
and the suite was red at that commit (ledger M122).
A count of 26 files matching a pattern was taken as proof a form was in use,
with no match read and no lint run,
and the linter warns on the form (ledger M124).
A probe for a byte order mark matched three code points and not three bytes,
found nothing,
and its positive control used another pattern (ledger M128).
And a census over named paths counted a log once for every path that reached it,
which moved the percentile a cap rule reads (ledger B288).
A named run after a wording change holds every test file that holds the old words,
found by a search for the words;
precedent is a match that was read,
never a count;
a positive control uses the probe's own pattern and tool;
and a census collapses its inputs to distinct files before it counts.
A census of combinator members that log read only function bodies written inline in the call's arguments,
so a member passed by name stayed out of its sight,
and the order of log lines was checked only at the two sites it fixed (ledger B388);
a census names the forms it cannot see beside its count.

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
A scan reading a method call tells the receiver's kind from the declaration the receiver's name resolves to,
never from the method's name alone,
and a finding that would bend correct code to pass it is read as a defect of the scan first.
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
Corpus page text may be printed since 2026-10-05 (UTC),
when the owner ruled,
"I've allowed you to handle PII.
The corpus is public."
Until then a probe printed ids,
indices,
counts,
code points and markup alone (M36).
The lead's reading of the ruling,
open to the owner's veto:
a probe need not mask corpus page text,
and a doc may quote it where the quotation helps;
credentials and raw provider requests and replies stay private,
a run log's lines of model reasoning among them;
the corpus stays out of the repository,
since it is unlicensed;
unit fixtures stay invented;
and a session transcript is still neither searched nor quoted,
since it holds more than the corpus.

A scan's package-wide case compares what it found through a helper of `src/scan-findings.test-fixture.ts`
(`expectNoFindings` for a list that should be empty,
`expectFindingsAsListed` for a list that should equal an inventory,
`expectRecordAsListed` for a record),
never through `toEqual` or `toStrictEqual` alone:
the assertion library prints a value longer than forty characters cut to its length
(`expected [ …(31) ] to deeply equal []`,
issue 610),
so a failing scan named nothing it found until its walk ran again in a probe.
Each helper writes every difference whole on a line of its own,
then makes the comparison the scan made.

What enforces it:
habit,
the control-byte scan in the checklist,
the coverage census's placement refusal and baseline format check (`requirePlacedFunctions`,
`CENSUS_FORMAT`),
and the census's refusal of a minified build (`requireUnminifiedBuild`),
before the suite runs.
`src/scan-direct-comparisons.unit.test.ts`,
among the source scans,
fails on `toEqual` or `toStrictEqual` called on `expect(...)` in a case of a scan the `source-scans` task names
where the case reads the package's files,
and on a scan none of whose cases reads them.

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
it left code no source map places out of "cold since then" and still counted it as not loaded,
so the same six stretches in a renamed bundle read as not loaded at every census,
and each batch record explained them by hand (B105);
a veto-open call refused an exponent in a provider's price on the ground that the fixtures write none,
and a stored catalogue writes one (M91).

A field's only observable was said to be a line the code discards,
and the line was logged all along,
read by a test in another file (ledger B179).
A claim that nothing can observe a value is measured,
by looking for a test that already observes it.

Every count of `[PASS]` lines this audit quoted was a count of suites that print,
and 44 cases in ten files sat in a suite with an empty name,
which the test module logs at `debug`,
so they passed without a line (ledger B277).
The same count cannot show a failure either:
a suite with failing cases still prints its pass line (ledger M125).
Report commands claimed what their own figures deny:
that no call went to the metered provider where every metered call sat on an unpriced seat,
a zero total under a line saying silence is not a zero,
one note for three different states,
and a block left out with no word that it was (ledger B280,
B286,
B289).
A comparator's comment stated an order its code did not keep,
with no case for either tier (ledger B304).
A notes file for agents described three fixtures before they were read (ledger M129),
and a commit message repeated an agent's account of code the lead had not read (ledger M131).
A claim of absence is printed only in the state that proves it,
a branch that skips part of a report says so,
a comment that states an order has a case for each tier it names,
and an account its writer has not checked is labelled as whose it is.
A generator's comment said every suffix followed every prefix where its code paired each with one,
and a module comment named two of the three readers it served (ledger M137);
a comment that states what code covers is read against the code.
Four agents' reports were kept only in the session and had to be extracted from its transcript later (ledger M136);
a report is written to a file when it arrives.
A red commit's message was first drafted saying every failing case was a new one,
where an existing case failed too,
and a note tied a bound to another entry's list before checking which bound that entry meant (ledger M139);
a message describing a run is written from the run's log line by line,
and a link between two records is checked before it is written,
or written as unverified.
A standing summary counted the digests whose rounds were judged,
so a digest whose rounds drew no ballot was counted nowhere (ledger B372):
every population a filter drops is counted on a line.
The coverage census refused a suite that failed,
and counted one that exited clean having printed no PASS marker,
so a suite that ran no test gave a census claiming no test ran any line of the package (ledger B384):
a suite with no pass marker is refused,
not counted.
Five TSDoc paragraphs of the settled audit named `main` as their function's only caller,
where the caller is `runSettledAudit`,
and one named a reader of `--cap` the package does not define (ledger B389);
a doc naming a caller or a reader is read against the code each time that code moves.
The runs lock warned that a claim's staged text was left after the claim whenever its removal failed,
though a runs directory too long for the staged name refuses the write and the removal with the same error,
so the warning named a file left behind that was never written (ledger B390);
a message says a file stands only where its write is known to have succeeded,
and otherwise says what failed and on what condition the file stands.

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
A kind of record a reading leaves out of one count it leaves out of every count it prints,
and a figure a batch record keeps explaining by hand is a reading defect to fix,
not to explain.
A claim drawn from a census names the `census.json` field or the report line that holds it.
A fix that gives a model context starts by rendering the sheet and searching it for that context.
An inference is labelled as one,
or traced in the code before it is written.
A claim that no code does a thing is a search's result:
the search runs before the claim is drafted,
since a commit message drafted first said no production code compares an artifact's commit with the corpus pin,
and the search then found the pin stamped into artifacts and compared in three files (ledger M138).
A claim about what a writer writes is measured over that writer's stored output,
with a control the measurement must flag;
the package's fixtures are its own copies,
not the writer's output.
A check's log counts only with its exit status and its own verdict line:
a docs commit was recorded as Markdown-lint clean from a log holding only the logger's sink timeout,
and no line from the linter (ledger M151).

What enforces it:
habit;
the census reading refuses a baseline taken with uncommitted changes,
names every claimed source edited since the baseline apart from its counts,
names every stretch cold since the baseline,
leaves unmapped code out of every status it reads (`coverage-census-report.unit.test.ts`),
and asks git about every file of the work tree;
`rendered-sheets.test-fixture.ts` renders every sheet so reading one is a call away.
`src/silent-test-cases.unit.test.ts`,
among the source scans,
fails on a case whose nearest suite has an empty name or none,
so every passing case prints a line (ledger B277).

## Current-state docs

What happened:
the document map's current status still described the pipeline of 2026-09-06 three weeks later,
and said no new pass was authorized while passes kept running (D28);
the handover index put the kill-and-relaunch rule in a README section that had moved;
and the day after TianqiChen66621's page was read,
the current snapshot still listed reading it as a next step (M55).
The scan B102 added gave this doc a section of its own,
and "Copies of shared code" went on saying nothing fails on a shared module without its own test (ledger B103).
A batch's state file listed two agents as running after the session that launched them had ended,
their folders unwritten since 2026-10-06 (UTC) and nothing handed back,
and four days passed before a merge showed their patches missing (ledger M140).

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
A state file's "running" line carries the check that proved it
(an agent's id answering,
or a folder written since);
after a session break,
each agent's folder times are checked before the line is trusted.
A change that adds a guard searches this doc for sentences calling the gap open
(`rg --line-number 'Nothing yet|is open' doc/mistake-prevention.md`,
and the guard's subject by name)
and rewrites each in the same change.

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
