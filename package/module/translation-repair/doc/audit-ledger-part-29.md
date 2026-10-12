# Audit ledger, part 29

Part 29 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B108: test helpers left their temporary directories behind

Found 2026-10-01 (UTC) by a census of the package's test code,
fixed in the commit adding this entry.
A parse of the 947 test and fixture files found 108 calls that make a temporary directory,
in 70 files.
43 of them,
in 41 files,
could leave the directory on disk:
a helper returned the bare path with nothing to remove it,
built a disposer no caller bound,
removed the directory only when the case did not throw,
or wrapped such a helper,
and `artifact-generation-git.unit.test.ts` made two at module scope and never removed them.
The system's temporary directory held 35,060 entries when this entry was written,
with the leaking helpers' prefixes in the thousands
(`artifact-placement-` 4,294,
`artifact-generation-` 3,205,
`runs-lock-` 2,576).

Each now goes through `scratchDir` (`scratch-dir.test-fixture.ts`) bound with `await using`,
directly,
through a helper that returns its directory with a disposer delegating to `scratchDir`,
or through a helper that takes the directory a caller made that way;
`freshLedger` in the three `window-trial-*` test files no longer awaits anything and is synchronous.
Over one run of `artifact-placement.unit.test.ts`,
the file as it stood at `8cc9a3650` left 25 directories behind and this commit's left none;
over one run of all 41 changed files,
no leaking helper's prefix gained an entry,
and the directory's total stayed at 35,060.
All 41 changed files pass,
and a separate reviewer read the change and found nothing in them to fix.
The helpers that already removed their directories every time,
65 calls,
still make them themselves rather than through `scratchDir`.

The directories already left behind are not deleted here:
they sit in the system's temporary directory,
outside the repository,
and removing them is the owner's call.

What enforces it:
nothing yet.
A scan refusing any temporary directory in test code made other than through `scratchDir` waits on moving the 65 remaining calls onto it.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B109: counts printed before a modifier and a fixed plural

Found 2026-10-01 (UTC) by reading what B98's scan could not see,
red in `07621943a`,
fixed in the commit adding this entry.
B98's scan read a count only where a counted plural followed it directly ("1 slices"),
so a count before one or two modifiers and then a fixed plural passed it:
"discarding 1 cached slices",
"1 usable ballots".
Widened to read up to two modifier words,
a proper adjective among them ("Latin tokens"),
the scan named 75 printed sites in the package's source
(72 distinct keys,
three printed twice),
in log lines,
command-line output,
error messages
and stored findings;
none of them is text a model reads.

Each site now chooses its noun with `wordForCount`,
and five keep a fixed plural as exemptions,
each a count that cannot be one,
with why.
A separate reviewer read the 82 changed call sites
and found two verbs and pronouns still fixed to the plural
(`spend-report.ts` "has",
`score-attribution.ts` "its" and "It is");
both now agree with their count.
The stream line `reportStreamProgress` writes also printed "unreadable frames" after any count,
which the scan could not name because no `wordForCount` call counted frames yet;
it now does.

The stream line's change had a reader.
`cap-census-read.ts` found a completed stream's content count by the text " content chars",
so a stream that delivered one content character,
logged "1 content char" after this fix,
would have read as no completed stream and left its `SPEND` line unpaired.
The reader now takes the unit up to its plural ending and accepts both spellings,
since lines logged before this fix wrote "chars" after every count,
and the cap-census cases build their stream lines through `reportStreamProgress` rather than copying its wording,
with a case reading a one-character stream in each spelling.
The guard-off meant to show that case failing against the old reader was refused by the session's permission classifier,
so that case is unmeasured against it.

Counting the recovery round's nouns took `stage-quorum.ts` to 312 lines of code against the linter's 300,
so the recovery round moved to `stage-recovery-round.ts`,
the one self-contained step of the gather,
with a unit test of its own;
its two log lines now carry the tag `[runRecoveryRound]`.
`message-names-only.unit.test.ts` names the four new `wordForCount` parts that marked error classes interpolate.

No cache version moves:
the stored findings among the changed sites differ only in a noun's number,
and no code reads those words back
(a search of the package's source outside tests for each changed finding's noun phrase finds only TSDoc,
comments and prompt prose).

Reach:
`count-nouns.unit.test.ts` passes with its 16 exemptions,
and the cases touching every changed message,
the source scans and lint pass at this commit.

Recurrence:
`mistake-prevention.md`,
"Counts in printed text" and "Readers of the package's own log lines".

### B110: the floor compared top-level blocks only, so a quote nested in a container could be dropped

Queued by B42,
red in `734f7da63`,
fixed in the commit adding this entry.
The translate floor (`validateTranslatedSlice`) and the archive-revision shape check (`revisionShapeFindings`)
compared only the top-level block sequence,
so a candidate keeping a container tag,
a list,
a footnote or a blockquote
while turning a quote nested inside it into prose passed both.
In the translate lane only the quote guard after judging caught it,
keeping the whole archive where a floor finding would have sent the candidate back to its translator first;
in the archive block review nothing caught it.

The floor now compares quoted passages at every depth,
read off the strict parse the floor already makes (`SliceSkeleton.quotedPassages`),
against the page as it stands,
or the original where there is none
(`quotedPassageFloorFindings` in `translate-validate-blocks.ts`),
beside the block comparison rather than inside it;
its finding states both counts and asks for every quoted passage to stay one.
A revision with the block's own shape is withheld when it carries fewer quoted passages than the block;
one of another shape is already withheld for its shape,
so it gets one finding,
not two.

Before landing,
a replay counted what the any-depth comparison refuses
over 1,277 pinned archive-against-original slices and 5,520 settled would-ship slices,
none unreadable.
Every slice it refuses there the block comparison already refuses:
5 against the original in the first population,
and in the second 3 against the original and 1 against the page,
each a top-level kind or count change.
No slice drops a nested quote under a matching top level,
and a positive control,
the one nested quote in `hakureico` slice 0 stripped of its markers in memory,
is caught.
So no pinned or settled verdict moves.

The cache versions do not move:
translate 15,
consolidation 20 and lane contest 6 were each set after the newest slice-cache record,
and the cache-account audit with the agent runs added finds the newest of 13,714 records still the one of 04:26 UTC on 2026-09-27,
so each account records the change as riding inside its number.
The patch that prepared this fix bumped all three,
against the accounts' own convention.

The quote guard after judging (`settleTranslateSlice`) stays.
A read of every path a winner takes to `stageResult.text` found each fresh candidate floored against the same `incumbentText`,
read by the same `readPageSkeleton` the guard reads,
so on a Markdown slice the guard no longer refuses anything the floor passed,
and the B42 case that reached it now settles on the archive through the floor
(`translate-slice-guards.unit.test.ts`).
Two paths still reach it:
a front-matter slice,
whose floor checks YAML and counts no quotes,
though no pinned front matter carries a line Markdown reads as a quote
(276 of 276 people pages read);
and a winner the invisible-variant fold changes after the floor read it,
which no measurement has looked at.

Open:
whether the quote guard should read front matter at all,
since the declared-name guard beside it skips it
(it should not,
and does not since B113);
whether the floor should read the folded text that ships rather than the text before the fold
(it should,
and does since B112);
and,
once both are settled,
whether the guard becomes a throwing invariant or keeps a case that reaches it
(neither:
B113 keeps it as a refusal that ships the archive,
which no settled slice reaches).
No case reaches its `refused-quote-loss` branch since this fix.

Reach:
both red cases fail at the build of `734f7da63` and pass here.
That red commit carried a TSDoc block on an `expect` statement in each of its two cases,
which the TSDoc attachment scan refused when the full suite first ran over this fix;
both are line comments here.
The red commit had been checked by lint and its two test files alone,
not by the source scans.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse".

### B111: test files kept 90 groups of copied helper bodies

Queued by B101 and B103,
fixed in part in the commit adding this entry.
The duplicate-body grouping,
run over the package's test files and fixtures at the parent commit
(948 files,
bodies of 80 or more characters with comments and whitespace aside),
finds 90 bodies kept in two or more places,
247 copies in all.
After this change it finds 58 groups and 137 copies over 966 files.
A read-only agent wrote the patch:
32 groups move into 18 new `.test-fixture.ts` files
(scripted clients,
stream frames,
refusal readers,
glossary lookups,
lane evidence and others),
and 80 test files import them.
Two helpers that shared one name did different things,
so each fixture names its own:
`rejectionOf` hands back whatever a call rejected with,
and `statedRefusalMessage` reads the message of the package's own stated refusal.
The stage-recovery-round test's meow reply,
its guard and its format move onto the shared trivial-reply fixture with them.

The patch needed more than its review found.
A fixture file gets the package's production lint rules,
not the test-file override,
and lint over the patched tree reported 18 errors and 33 warnings:
arrow functions,
missing return types,
type-only imports without `import type`,
positional parameters,
callbacks passed by reference,
unchecked type assertions,
and a named import nano-spawn does not export (TS2614).
Reading found an import the patch had written inside a template literal,
names that collided once two copies met in one file,
and TSDoc blocks left on statements,
which the TSDoc attachment probe still found three of after the first fixes.
All are fixed here;
the assertions are type guards or `Error.isError` checks,
and the glossary tests call `seededAmong` rather than passing `isSeeded` to `filter`.

One move was wrong in kind and is undone.
The patch hoisted `collectingInto`,
which replaces `console.log`,
out of the two report tests whose suites run one case at a time.
The global-writes scan follows a writer to its cases by calls within one file,
so in a fixture its write has no case.
Run with that fixture restored for the measurement,
the scan fails on both of its writes,
each `console assigned, in collectingInto, which no call by name reaches`;
the source scans had not yet run over the patched tree.
Both copies stand beside their sequenced suites again.

Open:
the 58 remaining groups,
among them five capturing `console.log` that the case's own sandbox
(`ctx.sinon.stub(console, 'log')`)
could replace in one fixture,
and eight glossary cases whose bodies match because each reads its own file's term list.
The duplicate-body scan widens to test files once each is hoisted or listed.
Its grouping strips whitespace inside string literals as well,
so two bodies differing only in a literal's spaces group as one;
the widened scan has to compare literals as written.

Recurrence:
`mistake-prevention.md`,
"Copies of shared code"
and "Globals a case replaces".

### B112: the translate and consolidation lanes checked an answer before folding it

Found 2026-10-02 (UTC) while answering B110's open question about the fold after the floor,
red in `4092757d3`,
fixed in the commit adding this entry.
The invisible-variant fold (U+2011 to a hyphen,
U+00A0 and U+202F to a space,
U+00AD,
U+200B,
U+2060 and U+FEFF dropped)
ran in `buildTranslateCandidates`,
after the publication rule,
the repair turn and the floor had read each translator's answer as written.
The consolidation lane read the same way:
its verdicts before and after the repair round,
which the validity floor reads,
saw the unfolded proposal.
The repair lane folds at its wire readers (`edit-wire.ts`,
`refine-wire.ts`),
and `invisible-variants.ts` said each lane folds where an answer becomes a candidate.

What it let through,
measured against the build of the red commit with `validateTranslatedSlice`:
a one-paragraph rendering whose middle line holds only U+00A0,
U+202F or U+200B is valid as written and invalid once folded,
against a one-paragraph page,
since a line holding only such a character is no blank line to the parser;
the one-paragraph and blank-line controls read the same both ways.
So such an answer passed every check and reached the slate as two paragraphs.
A disputed wording written with U+2011 for its hyphen passed the disputed-wording check,
which strips whitespace only,
and stood on the slate as the refused wording.
The repair turn's copy check read the unfolded text too,
so a copy of the incumbent differing only in U+2011 was validated and could be sent back rather than collapsing into it.
The run caches hold 294 fold findings
(over every slice cache under the agent runs folder,
three folders unreadable;
cached records repeat across copied runs,
so this counts findings,
not answers):
136 single U+2011,
the rest U+2011,
U+202F,
U+00A0 and U+FEFF.
Which of them changed a verdict is not measured.

The fix folds every answer where the lane first holds it (`translator-answer-fold.ts`):
after the translate gather,
after the consolidation gather,
and an author's revision in the repair turn before its recheck.
The fold findings move with it,
from the slate's findings to the producing half's,
after the gather's.
`buildTranslateCandidates` folds nothing now and throws `UnfoldedTranslationError` on a voice the fold would still change,
as B43 and B45 make callers rule out a floor that compared nothing;
every production caller folds first,
and the two candidate tests that handed it unfolded voices fold them first.
`corpus-run/translate-probe.ts` still prints each answer as the model wrote it,
which is what that probe is for.

The cache versions do not move:
the cache-account audit with the agent runs added finds the newest of 13,714 records still the one of 04:26 UTC on 2026-09-27,
and all 7 versions were set after it,
so the change rides inside each.

Decided for quality and open to veto:
the throw in `buildTranslateCandidates` rather than a second fold,
since a second fold would hide a caller that skipped the first,
and every check before it would then have read other bytes.

Recurrence:
`mistake-prevention.md`,
"Checks on the bytes that ship".

### B113: the quote guard read front matter as Markdown

Found 2026-10-02 (UTC) while settling B110's open question on front matter,
red in `146039a2f`,
fixed in the commit adding this entry.
`settleTranslateSlice`'s quote guard counted quoted passages with the page parser on every slice it guarded,
front matter included,
while the declared-name guard beside it skipped front matter
and the front-matter floor checks YAML.
In YAML a line opening with `>` inside a block scalar is the scalar's content.
A probe against the build of `7314a8606`:
a page of front matter alone prepares into one front-matter slice;
`countQuotedPassages` reads a block scalar line `  > Meow` as one quoted passage on the archive's side
and none on a rendering that writes the motto as a plain scalar;
`validateTranslatedSlice` passes that rendering.
Driven through `settleTranslateSlice`,
the slice settled as `refused-quote-loss` and kept the whole archive.
No pinned verdict moves:
no pinned front matter carries such a line
(276 of 276 people pages read for B110).

The guard now reads Markdown slices only,
as the declared-name guard does.
With B110's any-depth count in the floor and B112's fold at intake,
no slice the pipeline settles reaches `refused-quote-loss` now.

Decided for quality and open to veto:
the refusal stays,
shipping the whole archive,
rather than becoming a throw,
since a throw would fail the entry where the owner's rule is that a run always ships;
no case reaches it,
so the coverage census reads that branch cold,
expected and recorded here.

The cache versions do not move:
the audit run for B112 found no slice-cache record newer than any version,
so the change rides inside translate 15.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse".

### B114: test files kept helper bodies twice within one file

Queued by B111,
fixed in the commit adding this entry.
Of the 58 groups B111 left,
19 sit within one file.
A read-only agent read every copy and found no test defect:
no pair of cases whose identical bodies left one case's claim untested.
Ten groups were one helper written twice and are hoisted to one function in their file
(`critic-wire`,
`candidate-select`,
`archive-block-review-stage` with four copies,
`provider-router`,
`repair-translation`,
`translate-retry`,
`translate-selection-sheet`,
and in `corpus-run` `run-timing`,
`artifact-two-lane-read` and `insertion-container-deficit`).
Six are one scenario split into cases that assert different things of it,
the class of an error in one and its message in another,
and stay.
Three are not copies at all:
the grouping strips every character `trim` reads as space,
inside string literals too,
and `trim` reads U+FEFF as space,
so a cut leaving one space against one leaving two (`fidelity-splice`),
a line of U+FEFF alone against one mixing it with spaces (`mask-invisible-lines`)
and an empty override against one of three spaces (`grace-override`)
group as one body.

The grouping over the tree with this change finds 48 groups and 115 copies over 967 files.
The duplicate-body scan's widening to tests has to compare literals as written
and lists the six split scenarios with their reason.

Recurrence:
`mistake-prevention.md`,
"Copies of shared code".

### B115: test files kept helper bodies in two or more files

Queued by B111,
fixed in the commit adding this entry.
A read-only agent wrote the patch for the groups B114 left that span files:
17 new `.test-fixture.ts` files hold the hoisted helpers
(delta routing,
container tag ownership,
coverage-control cases,
the cap refusal,
scripted replies,
wet budgets,
a recorded transport,
issue-author builders,
slice and anchor pairs,
attribution proposer ids,
seed coverage,
insertion slices,
an unfilled-anchor artifact
and lane candidates),
and 41 test files import them.
Helpers that shared a name but built different things get names of their own
(`preparedPairAt` and `slicePairOf` for two different `pairOf`).
Three of the 41 files had changed under B114 after the agent read them;
those three were merged three-way against the commit it read,
with no conflict.
The grouping over the tree with this change finds 20 groups and 55 copies over 985 files.

`consolidate-proposal-wrap.unit.test.ts` held six helpers nothing called:
its one suite tests the wrapper alone,
and the helpers drove the stage,
which `consolidate-slate-carries-shipping-text.unit.test.ts` covers with live copies.
The agent deleted four with their constants and imports;
two more,
`asSent` and `judgeBallot`,
named only in their own TSDoc examples,
are deleted here.
No configured check reports a declaration nothing reads,
the same gap B32 closed for imports;
a census of the package's test files for more is open.

The patch needed more than its review found,
as B111's did.
Lint over the patched tree reported 13 warnings and an error,
all in the new fixtures or in callers of them:
the callback-arity rule resolves a local function's parameters but not an imported one's,
so two `map(toLaneCandidate)` calls now pass a named wrapper;
stubs with no `await` return a settled promise instead,
the budget stubs as module functions,
as `pass-outside-reads.test-fixture.ts` writes them;
a void function carried `@returns`,
and two expressions broke the one-step-per-line and one-property-per-line rules.
The unused-imports scan then found four type imports the hoists had orphaned,
`ModelTransport` in two client tests and `BudgetView` in two router tests,
which lint does not report.
The agent kept two type assertions it could not check without a compiler,
`as ChunkPair` and `as unknown as WouldShipSource`;
both literals type-check without them,
and both are gone.

The 20 groups left are not helpers waiting to move.
Six are the split scenarios B114 kept,
and three are B114's literal-whitespace groupings.
Two are the glossary cases B111 named,
each reading its own file's term list.
Five replace a process global
(`console.log` collectors and environment restores),
which the global-writes scan follows only within one file.
Four have the same text over different bindings:
`refusalOf` asks a different command-line reader in each file,
`ask` sends each file's own messages,
`sliceOf` cuts each file's own document,
and `capturingLogger` wraps each file's own tagged logger,
the pair `capturing-logger.test-fixture.ts` already names as kept apart.

Open:
the duplicate-body scan widens to test files,
comparing literals as written
and listing the remaining groups with their reasons
(closed by B116);
the census of test declarations nothing reads
(B118).

Recurrence:
`mistake-prevention.md`,
"Copies of shared code".

### B116: the duplicate-body scan read production source alone and grouped literals by their visible characters

Queued by B101,
B111 and B115;
red in `de7c6b099`,
cleared in `5b43c5f45` and `8ea5e7fa5`.
The scan read no test file,
so a helper copied between tests,
or a test restating a module's body as its expectation,
could not fail it.
And its grouping dropped every character `trim` reads as space,
inside string and template literals too,
so bodies building different text grouped as one (B114).
It now reads every file under `src`,
and compares each literal token as written
while dropping the spacing of the code around it;
a fixture case shows the change,
and a scratch copy comparing literals the old way fails that case.

Over the tree at `de7c6b099` the widened scan found 26 groups where 4 frozen copies are listed.
Seventeen were the groups B115 left,
less its three literal-whitespace groupings.
Five more only the widened scan could see.
Two were short predicates that each spelled a long fixture string twice,
in `consolidate-driver` and `consolidation-polish`,
past the 80-character floor once the string's spaces count;
each now reads one named constant,
used where the string is offered and where it is sought.
Three were tests carrying a production body.
B115's own lane-candidate fixture was a copy of the function `buildTranslateCandidates` wrote inline;
`translate-candidates.ts` now exports it as `laneCandidate`,
and the fixture is gone.
`run-seats.unit.test.ts` restated `run-config.ts`'s translator filter as its expectation,
which can fail only if the formula itself changes;
it now states translators as the writers less the seats dropped from the translator role,
a relation between two exported lists.
`slice-implausible.unit.test.ts` restated `sliceSizesOf`'s map;
it now spells out each slice's size from its own texts.

The six split scenarios B114 kept are one named function each in their files,
each case still asserting its own claim;
in `repair-contract.unit.test.ts` one case's assertions are a superset of the other's,
and both stay.
The groups over different bindings take the binding as a parameter:
the glossary cases' term lists,
the command-line reader `refusalOf` asks,
the messages `ask` sends,
the document `sliceOf` cuts,
and the logger `capturingLogger` wraps.
The console captures stub `console.log` on the case's own sandbox,
which the global-writes scan reads as no write,
and read their lines off the stub's recorded calls with `util.format`;
the agent's version faked `console.log` with a rest-parameter arrow function,
which fixture lint refuses.
Three groups stay,
listed as `GLOBAL_WRITER_COPIES` with their reasons:
each writes an environment variable the code under test reads itself,
and the global-writes scan follows a writer within one file only.

The scan now lists 7 groups,
the 4 frozen copies and those 3.
The agents' fixtures needed lint fixes before they passed
(a duplicated import,
chain and import layout,
an inline object type),
of the kinds B111 and B115 record;
`repair-assemble-slice.test-fixture.ts` also gained a refusal for a slice wording its document does not hold,
where the copies addressed offset -1.

Open:
the global-writes scan following a writer through its imports,
which would let the three kept groups share one fixture.

Recurrence:
`mistake-prevention.md`,
"Copies of shared code".

### B117: test temp directories made outside `scratchDir`, or bound only after their setup ran

Queued by B108,
red in `9473905a0`,
fixed in `cdd36a98d` and `8ea5e7fa5`.
B108 fixed 43 leaking test directories and left the family unguarded.
`temp-dirs-scratch.unit.test.ts` now holds two rules over tests and fixtures:
no direct `mkdtemp` or `tmpdir` call outside `scratch-dir.test-fixture.ts`
and the 8 kept sites it names with why;
and every `scratchDir` call is the initializer of an `await using` declaration,
since a bare binding leaves a window between the directory's making and anything bound to remove it.
At `9473905a0` the first rule found 57 calls,
the 8 kept sites among them,
and the second 9.

A read-only agent's patch moved them:
`scratchDirWith` runs a setup against a fresh directory's path and removes the directory if the setup throws,
and two-directory helpers make the second inside a `try` that removes the first.
Before committing,
the patch needed:
its two rules folded into one top-level suite,
since two let a failure of the first stop the second (B99);
a lint-refused `String()` of untyped node fields replaced by the shared readers;
five setups returning `Record<PropertyKey, never>`,
which lint refuses,
replaced by `scratchDirPrepared` for setups that hand back nothing,
and by plain `scratchDir` bindings at the twelve callers of two helpers with no setup;
an environment variable written inside a setup,
a function only ever passed as a property,
which the global-writes scan cannot follow by name,
moved into `runsDirPointedAt`,
called by name and disposed before the directory;
23 TSDoc blocks left on return statements turned into line comments;
and an import its move orphaned removed.

The patch also undid work.
The agent's copy of `entry-pictures.unit.test.ts` predated B115,
and its diff was taken against the files as they stood when it finished,
so rebuilding its base from that diff gave the current file,
and the three-way merge copied the agent's file whole,
bringing back the local `sliceOf` B115 had moved to `content-slice-of.test-fixture.ts`.
The widened duplicate-body scan caught it;
the import is restored in `8ea5e7fa5`.
A line-level check of the nine temp-dir files any commit since B108 changed
(lines those commits added that the merge no longer held,
and lines they removed that it held again)
found no other.
The patch also wrote one setup into two files,
now `scratchDirOfEmptyRecords`.

The full suite at `8ea5e7fa5` left no new entry in `/tmp`
(`find /tmp -maxdepth 1 -newer` a marker touched before the run lists `/tmp` itself alone,
and `tmpdir()` is `/tmp` under `mise`);
`/tmp` still holds 35,065 top-level entries on 2026-10-02 (UTC),
most named by the test helpers B108 found leaking
(4,294 `artifact-placement-*`,
2,883 `artifact-generation-*`,
2,576 `runs-lock-*` the largest),
which this audit leaves for the owner to delete.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world"
and "Copies of shared code".

### B118: test declarations nothing read, and fixture exports nothing imported

Red in `5f3e63e67`,
fixed in `cacfa20fb`.
B30 and B31 guard package source by production reach,
and B32 guards imports,
but nothing read the declarations of test files and fixtures:
the repository's lint leaves `no-unused-vars` off
and its TypeScript configuration leaves `noUnusedLocals` false.
Four declarations were read nowhere:
`SUPPORTING_READERS` and `NAME_QUOTE` (`archive-naming.test-fixture.ts`),
`sliceCarrying` (`fidelity-damage.unit.test.ts`)
and `withoutBreaks` (`semantic-wrap.unit.test.ts`),
the last two named only inside their own `@example`.
Twenty-four fixture exports no other file imported,
each read only inside its own fixture,
from constants such as `ARCHIVE_PATH` to the `ScratchDir` and `ParsedSource` types;
an `export` only its own file reads offers nothing,
and hides the next dead one behind it.

`dead-test-declarations.unit.test.ts` reads every test file and fixture.
An unexported top-level declaration fails unless its name stands where it is read:
never as a property,
member,
class or interface member,
enum member,
specifier name or label,
and never as another binding,
such as a parameter or a nested declaration.
A fixture export fails unless another file imports or re-exports it by name.
A default export,
a namespace import and a dynamic `import()` of a relative path fail as forms the scan cannot follow;
the package's tests use none.
A read of a nested binding that shadows a top-level name,
and two declarations reading only each other,
still count as reads,
since telling them apart needs scope resolution.
At `5f3e63e67` the scan found 28,
the same 28 names the agent's TypeScript-checker census of the same tree listed.

A read-only agent drafted the fix and the scan.
Its fix was applied as written;
its scan was reworked before the red commit:
the draft counted a property key or member name spelling a declaration's name as reading it,
counted a fixture export its own file reads as live,
which left the 24 exports unguarded,
and carried a default-import branch that could mark nothing read.

Recurrence:
`mistake-prevention.md`,
"Lint and edits".

### B119: 16,856 lines ended in whitespace, which `.editorconfig` forbids and nothing checked

Red in `f6bf25ef2`,
fixed in `7f529468e`.
The repository's `.editorconfig` sets `trim_trailing_whitespace = true` for every file but HTML,
yet no configured check enforces it for TypeScript:
dprint's TypeScript plugin is disabled in `package/config/dprint/index.json`,
and the repository's stylistic oxlint plugin has no such rule.
At `f6bf25ef2` the package held 16,856 lines ending in spaces or tabs in 1,316 TypeScript files,
nearly all of them TSDoc blank lines written as a lone space:
at `6d8889c90`,
its 2,078 TypeScript files held 25,568 TSDoc blank lines,
16,851 holding whitespace and 8,717 empty,
and 285 files mixed both forms.
An editor honouring `.editorconfig` strips the lines it touches,
so every edit carried whitespace-only diff lines,
and the edit tool,
which writes a blank TSDoc line empty (M103),
left files mixing the two forms.

`trailing-whitespace.unit.test.ts` fails on a line ending in anything `trimEnd` removes,
unless a template literal's text covers part of that run,
since a string or regular-expression literal cannot hold a line end;
none of the 16,856 sat in one.
A scratch normalizer that parses each file,
strips only outside literals,
and refuses a file whose literals change,
made `7f529468e`:
16,849 lines,
the other 7 having gone with the TSDoc blocks B118 deleted;
`git diff --ignore-all-space` over it is empty.
The same lines run through the whole repository:
30,859 more in 2,800 TypeScript files across 136 other packages,
every one of them whitespace-only;
issue 585 asks for a stylistic rule with an autofix,
after which this package's scan can go.

Recurrence:
`mistake-prevention.md`,
"Lint and edits".

### B120: the global-writes scan followed a writer only within its own file

Red in `c9639c9ff`,
fixed in `dbefa8aec`.
B116 left it open:
the scan placed a write inside a function declared by name at the calls of that name in the writer's own file,
so a writer moved into a shared fixture read as one no call by name reaches wherever it was used,
and three groups of environment writers stayed copied between test files
(`GLOBAL_WRITER_COPIES` in `duplicate-bodies.unit.test.ts`).
Each test file is now read once into its parents,
its calls by name
and the names it imports by name from a relative path.
A named writer's callers are its own file's calls of the name,
plus the calls of the name an import binds,
alias or not,
in every test file importing it from the writer's file.
Out of reach,
and named in the scan's module header:
a writer reached through a namespace import or a re-export.
The package's tests use neither,
and the dead-declaration scan already fails a namespace import.
`resolveSpecifier` moved into `source-scan.test-fixture.ts`,
which both scans import.
The three `GLOBAL_WRITER_COPIES` groups can now move into a fixture;
that move is queued.
Closed since by B385 in `3fa45b1377073e74042d66fdb033f2533abbb7cc`.

Recurrence:
`mistake-prevention.md`,
"Copies of shared code".
