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
X18's first fixture),
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
and its runtime case asserted a literal `true` (ledger B31).

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
A message says a case pins a branch only once the mutant removing that branch is caught;
until then it says what the case fails on today,
and a case that must pass a precondition to reach its branch
is read against that precondition in the code first.
A case guarding a short circuit is run once with the short circuit removed,
and must fail there,
before its commit says what it guards.
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
and a port control reproducing an earlier census's totals passed because that census had the same flaw (M67).

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
A measurement that aggregates is checked against an invariant any correct output meets,
not only against an earlier tool's totals,
since two tools sharing a flaw agree:
the coverage census refuses a report in which an uncalled function's first line sits in no stretch of its own source.
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
and the coverage census's placement refusal and baseline format check (`requirePlacedFunctions`,
`CENSUS_FORMAT`).

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
found ten cold stretches in four of those modules (M66).

The rule:
every number,
log line,
cause and quoted rule is read from its source in the same step it is written,
and the source is named beside it.
A claim that tests cover a module's branches comes from a census of the claimed sources
(`mise run coverage-census -- <test files>`),
each loaded and holding no stretch in a census of format 2 or later (M67),
never from reading the tests.
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
A suite's count is its describe blocks,
one PASS line each,
never its cases:
one record called 1,384 PASS lines cases (M74).
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
its four error classes and a copied helper failing two scans on the census's own first run.

The rule:
read a region with the Read tool before editing it.
Lint,
type check and the named tests run after the final edit of a commit,
in that order,
and the commit follows only a clean run of all three (M46).
The named tests of a source commit include the package-wide source scans,
run as one task,
`mise run source-scans`
(its description lists all fifteen),
since a new class,
function,
export,
link,
sheet or clock time is read by those and not by its own file's tests;
a ledger entry is closed only after a full suite has passed on its last commit (M12,
M59).
Neither the type check nor the linter reports an unused import here
(issue #578 asks for a check),
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
which the package build never ships.
A line-range `sed --in-place` names one file,
since it applies the range to every file it is given (M71).
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
B31).

## Tasks, builds and bulk output

What happened:
a source-map build was named `build:coverage`,
and the package's `build` fan-out starts every `build:*` child at once,
so each plain build ran it beside the normal one into the same directory (M63);
the census first chose `tmpdir()` for about 8 GB of raw coverage,
where `/tmp` is a tmpfs held in memory (M64);
a test's stand-in command carried a literal `[FAIL]`,
which a warning quoted into the suite's own log,
where the census counts it (M65).

The rule:
a task that must not run with a fan-out parent is named outside the parent's prefix,
and a new task's first run is read in its log for every task it started.
Output that can reach gigabytes goes under the package's cache directory on disk,
after `df` has shown the filesystem.
A fixture printing a marker that tooling counts builds the marker when it runs,
and a new test file's first run is read for markers,
not only for its exit.

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
