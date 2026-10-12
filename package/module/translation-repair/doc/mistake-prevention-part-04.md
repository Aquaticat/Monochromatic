# Preventing this package's mistakes, part 04

Part 04 of [Preventing this package's mistakes](mistake-prevention.md),
whose index lists every part in order.

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

The relabel probe's arm that claims no issue list is known sent the production disclosure with an empty list,
which under a rendered disclosure writes a list's heading into the prompt (ledger B283).
An arm that claims a thing is absent sends the form production sends when it is absent.

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
The archive revision's footnote floor passed every revision of a block the archive did not carry,
a branch its comment kept for fixtures a caller composed,
though production hands it an exact slice and no test reached it (T8's eighteenth batch).
The attribution reader read every missing or malformed field but one as empty,
though every generation that settled an artifact writes each of them,
and credited a proposer its own chunk had not heard (ledger B106).
Two readers made an empty string stand for an input and then compared it as a key:
a directory id with no Latin letter read as empty,
as did any alias in another script,
so the id stood on an alias that was not it (ledger B131);
and a link destination the trim cut to nothing compared equal to every other one it emptied,
so a page that dropped the parent directory and kept the current one dropped nothing (ledger B139).

A textless confirmation recorded the deterministic reader's count as `0`
where that reader never ran (ledger B158).
A reading that failed reaches the verdict as a failure,
never as an empty value.

The destination reader cut every destination where prose would end an address,
so two explicit links differing only past a full-width comma read as one (ledger B173).
The trace of a dropped destination searched each slice for the address as a substring,
and found a shorter address inside a longer one and a full stop in every sentence (ledger B174).
The site root,
shed of its trailing slash,
keyed as the empty destination (ledger B175).
A rule written for one kind of input is applied to that kind alone,
told apart by what the parse says,
and a key never maps a value that names something onto the key of nothing.

A percentile no rank belongs to was answered with zero (ledger B272);
a routed call that left its loop with no attempt left said every provider refused it,
under a comment calling that end unreachable (ledger B275);
seed detection skipped an issue naming a slice the preparation lacks (ledger B276);
and a score command given a named file that was absent scored without it,
under the note for a file nobody named (ledger B285).
Absence is an answer only for an input nobody named,
and a comment calling a loop's end unreachable is checked against every `continue` in the loop.

An agent's regression count looked the incumbent's count up by position with `?? 0`,
so a missing count would have read as zero (ledger B323,
M137).
A value that belongs to a key is carried with that key,
and a read that cannot miss throws if it does.

A commit probe that threw in the process,
its working directory removed before git ran,
replaced the failure of the read it was asked about with its own (ledger B374).
A failure caught while another is being handled is carried with it,
as an `AggregateError` of both.

The rule:
a call states every input that decides what a floor refuses,
what a sheet shows or whether a text may ship,
even where the default happens to equal it;
a call that leaves one out says why at the call or in the guard's named list.
A gate flag never defaults to the permissive answer without every caller stating it.
A reading that failed reaches the verdict as a failure,
never as an empty value a check then passes.
No branch is kept for a fixture production cannot build:
an input that breaks the caller's contract is refused with a named class,
and the fixture changes.
A reader of stored records refuses a field every generation writes when it is absent,
naming the path,
and keeps an absent reading only for a field some generation never wrote,
saying which.
A refusal added to such a reader is run over every stored record at the builds before and after it,
and each record whose reading moves is accounted for.
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
A trim or reading that can come out empty says what the empty result means,
and an empty reading is never compared as a key:
one key never stands for two inputs a reader would follow to two places.

What enforces it:
`directory-id-name.unit.test.ts` and `dropped-destinations.unit.test.ts` hold inputs whose readings are empty;
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

Two lookups logged `String()` of whatever their catches caught,
so a provider body that is not JSON reached the log quoted through V8's parse error (ledger B166);
and the Bedrock ledger's marked refusal named the line and not the file a variable can move (ledger B167).
A caught value reaches a log line through `refusalText`,
and a marked class names what refused,
which for a file repaired by hand is the file.

Two lookup errors forwarded a message that could hold a provider body,
so they could not be marked,
and every log line that went through `refusalText` named their class alone,
the HTTP status lost (ledger B180).
A class a log line must explain is built from named parts,
so that it can be marked.
`UnansweredContestSliceError` took a finished message and stayed unmarked,
so a corpus pass's TALLY line named its class alone and lost the slice,
where its marked siblings print their sentence (ledger B387);
it is now built from the slice's index and marked.

A stream's error event naming a refused request is thrown as a marked class
that names the provider's documented error type,
from a closed list this package holds,
and nothing of the event's body (ledger B202).

A rejected request passed out of two lookups as the transport's own error,
whose message can quote a header value,
so it stayed unmarked and their log lines named its class alone (ledger B220);
and a refusal a page can reach was first written as a plain `Error`,
which the same log reader prints as `refused by Error` (ledger B219).
A failure a log line must explain is caught where it is raised
and rethrown as a marked class,
with an authored account and the caught value as its cause.
An authored account says only what holds for every cause it covers,
and names the possibilities where it cannot tell them apart:
the lookups' first wording said the network had failed,
which is untrue of a request the transport will not send.
The corpus reader read a commit probe's exit of 128 as a clone git could not open,
where git exits 128 too for a corrupt object in a clone it opens,
so the refusal sent the operator to check that the directory is a repository (ledger B371).
An exit status is read for every cause the tool gives it,
and a second question to the tool tells them apart where the refusal's advice differs.

A census of every place a caught value becomes text found 22 functions that logged or stored one whole:
a parse refusal quoting a reply's opening,
a failed exchange quoting a header or a provider's body,
a cut stream repeating its cause (ledger B232 to B236).
A caught value now reaches a line,
a record or a message by its class,
through `refusalText` or `exchangeFailureText` (ledger B237).
That took the provider's own account of a refusal out of every log line,
and a typed read put it back for log lines alone (`exchangeFailureLogText`,
ledger B268).
A credential the request sent could come back inside a reply and leave by any reader of the reply.
The transport masks it out of the assembled body (ledger B266),
and three kinds of reader the transport's mask never covered were masked one by one:
the stream drain's opening line,
two listing readers and two lookups (ledger B293,
B295,
B300).
A reply is masked as text before anything parses,
cuts or logs it,
by whichever code first holds it.
The mask then searched only the spellings the request sent,
so a key a provider echoed percent-encoded,
as a form value,
in base64,
as JSON unicode escapes
or as the decoded pair of a `Basic` header passed through (ledger B329).
And the stream drain's cancel line logged `response.url` whole,
which after a redirect is an address the provider chose,
its query able to repeat the key the request sent (ledger B341).

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
A credential is masked in every spelling a decoder of the reply's formats recovers,
not only as the request sent it;
a spelling the mask leaves out of reach is named as out of reach in its record.
Whatever text a provider chose is reply text,
an address a redirect named among it,
and is masked before anything logs it.

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
`caught-value-text.unit.test.ts`,
which `source-scans` runs,
fails on a caught value turned into text whole outside the functions it holds with a reason each (ledger B237),
and `body-excerpt-readers.unit.test.ts` holds the reply excerpt field to five named files (ledger B268).
No scan finds a reader of a reply that the credential mask never reads;
each of the four closed so far was found by reading (ledger B293,
B295,
B300,
B341).
`credential-mask.unit.test.ts` holds each spelling the mask reads,
and the case of each surface that prints a reply holds the other spellings masked there (ledger B329);
a spelling no decoder named in that entry recovers,
or nested past three decoders,
is out of reach by rule.
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
The archive revision's shape refusals listed the blocks' shapes where a count belongs,
"the block is paragraph and the revision is paragraph,
paragraph",
where the translate lanes' block floor says "1 block (paragraph)" (T8's eighteenth batch).

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
A message saying what a text holds says how many before listing them
(`1 block (paragraph)`),
and says "nothing" for none.

What enforces it:
habit and review;
the atom floor's cases pin its arms,
and an arm no case reaches shows in the coverage census.
The rest of the count-before-plural family is to be classified and fixed as one change (ledger B66's open list).
