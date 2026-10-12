# Audit ledger, part 28

Part 28 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B97: a list-shaped alias skipped the identity rule

Found 2026-10-01 (UTC) in T8's twenty-third batch,
red in `7088bf67d`,
fixed in the commit adding this entry.
Where an original's `name` and `info.alias` are one identity,
a translation must carry its name among its alias renderings.
`visibleIdentityOf` (`front-matter-translation.ts`) read `info.alias` only as a string,
and took any other shape for another schema,
so where the original wrote its alias as a YAML list holding just its name,
the rule never ran,
and a candidate whose list dropped the name passed.
The package's other alias reader,
`aliasesOf` (`corpus-run/directory-id-name.ts`),
already read a list by joining its items on the comma;
`visibleIdentityOf` now reads a list of strings the same way.

Reach:
none today.
No pinned page or `info.yml` writes `alias` as a list
(`b23-front-shapes.mjs` in the audit's scratch folder:
92 entries,
254 `alias` keys across their pages,
none list-shaped),
and the site's build shows each `info` field as one value
(`scripts/build.ts`,
line 205,
in the data repository),
so a list is a shape the site does not expect either.
The refusal's wording still says "comma-separated" for a list.
The two readers still split on different separators:
the candidate side on the comma its sheet tells a model to use,
`aliasesOf` on the three the originals use;
each separator constant now says so and names the other.

The same batch found a second reading,
which stands:
a page whose front matter fence pair holds nothing parses to null,
and `pageFrontMatter?.data ?? sourceData` then judges a candidate by the original's shape,
as for an insertion.
The audit's reader called that conflating an empty archive with none;
an empty block has no established keys to keep,
and judging by the empty shape would refuse every candidate that translates the original's metadata,
so the behaviour stays,
its comment now says so,
and a case pins it.

Calls made here are open to veto:

- a list alias read as its items joined on the comma,
  rather than left as another schema;
- the original's shape governing a page whose front matter holds nothing.

Recurrence:
`mistake-prevention.md`,
"Copies of shared code".

### B98: counts printed before a fixed plural

Found 2026-10-01 (UTC) by a census of every count printed before a noun in the package's source
(`plural-census-report.md` in the audit's scratch folder),
fixed in the commit adding this entry.
Report lines,
log lines,
refusals and findings wrote a count before a fixed plural,
so a count of one printed "1 slices";
the census read about 230 such sites across 58 nouns,
at least five of them in findings the translating model reads on a retry.
One had shipped and was pinned:
`corpus-run/editor-calibrate-standing.ts` printed "1 rounds",
and its test asserted the line as written.

Each noun after a count that can be one is now chosen by `wordForCount` (`count-word.ts`),
across 139 source files,
from a patch an agent prepared and the session applied,
its two conflicting hunks (an import each) added by hand.
The patch chose nouns and left the verbs that agree with them,
so twelve sites then read "1 entry ... are" or "1 reference go";
each now chooses its verb by the same count,
or reads without one.
The patch's seven-line calls put three files over the line cap
(`candidate-select.ts`,
`lane-contest-driver.ts`,
`corpus-run/slice-census.ts`);
their log lines now print each count as a label (`ballots: 3`),
which no count can make wrong,
and eleven calls whose count is a member chain put each step on its own line.

The count-noun scan written after the patch (`count-nouns.unit.test.ts`) found three more sites it had left:
the line-structure finding told the translating model a rendering repeated a line
"N times where the ORIGINAL repeats no line more than 1 times",
since the bound is 1 for every original that repeats no line,
and now says "more than once" through `howOften`,
with a case;
the window trial's "1 of 3 arms survive" chooses its verb;
and the target-unclaimed alignment finding counts its characters.
Two tests that pinned the old wording now read the new:
`verify-published.unit.test.ts` ("1 of 1 page carries every wording its artifact promised")
and `artifact-two-lane-verify.unit.test.ts` ("has 1 row for a preparation of").

Model-facing text changes only at a count of one,
in the translate stage's validation findings
(`translate-validate-blocks.ts`,
`bilingual-pair-bound.ts`,
`line-structure-guard.ts`);
the archive source context's reader count is two or more wherever it is printed,
so its text is unchanged.
No cache version moves:
`TRANSLATE_SLICE_CACHE_VERSION` 15 was set after the newest slice-cache record any run wrote
(the cache-account audit of 2026-10-01 UTC:
newest record 2026-09-27T04:26Z,
every version set after it),
so no answer cached under the old wording can be served.

What enforces it:
`src/count-nouns.unit.test.ts`,
among the source scans,
fails on a `String(...)` interpolation followed by a noun the package counts with `wordForCount` somewhere,
so its noun list grows as nouns are counted,
outside the eleven sites it names with why
(counts that cannot be one,
and verbs after an index such as "slice 3 claims"),
and fails when a named site no longer stands.
A word followed by `=` is a log field's name and is passed over.
Its fixture case runs first;
with `document-preparation.ts`'s character count written back as a fixed plural,
its package case failed,
and passed once the site was restored.
Out of its reach:
a noun after an adjective ("3 source chars"),
a noun split from its count across a `+` between literals,
and a noun no `wordForCount` call names yet.

Calls made here are open to veto:

- log lines in the three files over the line cap print counts as labels rather than sentences;
- verbs agree through a second `wordForCount` call rather than a rewording.

Recurrence:
`mistake-prevention.md`,
"Counts in printed text".

### B99: suites after a failing one in the same test file never ran

Found 2026-10-01 (UTC),
after it had hidden a case three times (M89,
M97,
and one of B92's red cases),
fixed in the commit adding this entry.
module-test's `describe` throws when a child fails,
and the package's test files awaited each suite at the module's top,
so the first failing suite's throw ended the module
and no suite after it ran.
The runner prints a line per failing case and per passing suite,
so a suite that never ran printed nothing,
and a file reported its first failing suite as its only one.
A codemod scanning the package's 906 test files
(`multi-suite/wrap-suites.mjs` in the audit's scratch folder)
found 291 awaiting more than one suite at the top.

Each now awaits one root suite,
`describe({ name: '', concurrency: 1, children: [...] })`,
whose children are the suites the file held,
in their order:
the root runs them one after another,
as the top-level awaits did,
and each child keeps the concurrency it set or takes `DEFAULT_CONCURRENCY`,
the default it had before,
which `module-test` now exports.
The codemod wrapped 276 files.
It refused 15 where a declaration sat between two suites;
an agent hoisted each such declaration unchanged ahead of the root,
in its order,
after reading that no suite before it reads what it names
and that the one with an effect (`prompt-payload-store.unit.test.ts`'s `writtenVersion()`,
which writes a file in a directory of its own) changes nothing an earlier suite sees.
A hoisted declaration now runs before any suite,
so one that throws stops every suite in its file rather than only the later ones.
Four files whose every suite already set its concurrency imported `DEFAULT_CONCURRENCY` for nothing after the codemod;
the unused-imports scan found them in the full suite,
and they were removed.

What enforces it:
`src/multi-suite-top-level.unit.test.ts`,
among the source scans,
fails on a `.test.ts` file holding more than one `await describe(...)`
held only by top-level statement shapes,
the shape `global-writes-sequenced.unit.test.ts` reads as a file's top-level suite;
the two scans now share `parentsOf` and `ancestorsOf` from `source-scan.test-fixture.ts`.
Its fixture case runs first and passed from the start.
Its package case failed naming the 15 hand-wrapped files before they landed and passed after;
with a second top-level suite appended to `code-points.unit.test.ts`,
it failed naming that file alone,
and passed once the line was removed.
Out of its reach:
a suite awaited inside a function the file's top calls,
and `describe` imported under another name.

Calls made here are open to veto:

- the root runs its suites one at a time,
  keeping the order the top-level awaits gave,
  rather than side by side;
- a declaration between two suites moves ahead of the root rather than into a case.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail".

### B100: six more readers counted blocks by blank-line split

Found 2026-10-01 (UTC) reading the readers B68 left open,
a census an agent took over the package's source
(`b68-open/report.md` in the audit's scratch folder),
with red cases in `2ab7849c7`
and the fix in the commit adding this entry.
B68 named four readers that split a passage on blank lines where the floor reads the parse;
the census found six,
and the fix found a seventh caller:

- `line-structure.ts` `isLineStructured` called five loose list items line-structured,
  where the floor reads one list;
- `target-only-run.ts` `splitTargetOnlyRun` protected nothing when a quoted transcript followed its anchor on the next line,
  since the split joined anchor and quote into one block that matched no source block,
  and it rejoined the blocks it kept with one blank line;
- `displacement-ratio.ts` `contentBlockCount` counted a fence with a blank line inside as two blocks and a loose list as three;
- `translate-address-drop.ts` `blocksOf` gave the two sides of a fence with a blank line inside different counts,
  so the address floor compared the texts whole and summed an address the block that switched did not hold;
  `translate-suicide-drop.ts` read the same split,
  so a paragraph and the published-work quotation on the line after it were one block,
  and the quotation's 自杀 was read as the passage's own;
- `corpus-run/prose-ranges.ts` closed a stray backtick on a code span past a heading,
  shielding prose and leaving the code span open to the page passes;
- `corpus-run/canadian-spelling-capital.ts` `opensSentence` took a capital opening a paragraph on the line after a heading for a name.

Each now reads the parse.
The slice readers read `parseSliceBody`,
the grammar the floor reads;
a passage it refuses is read whole by the address and suicide floors (`blocksOrWholeText`),
as an unequal count already was,
is not line-structured,
and has nothing protected by the target-only run.
The page passes read the page grammar through `proseBodyTree`:
comments and lone container tags masked,
then the strict grammar,
then plain markdown where it refuses,
as `parse-document.ts` reads a page.
Plain markdown refuses a body only where its nesting exhausts the parser's stack;
such a body reads as having no blocks,
so no code span or sentence start is read off it,
and any other failure propagates.
`splitTargetOnlyRun` now cuts the archive's own bytes at the anchor's end,
and `restoreTargetOnlyRun` appends the protected run as the archive wrote it,
so a retention and a restore both rebuild the archive byte for byte.
`contentBlockCount` throws `SliceBlockCountRefusalError` on a refused side rather than counting some other way;
only the displacement and window-trial probes count blocks,
since the contest size note now reads its ratio tails off character counts alone (`ratioImplausibility`),
and so parses no rendering.
`markdown-blocks.ts` `topLevelBlocks` lost its one caller and is removed;
`parsedTopLevelBlocks` gives each block's bytes,
kind and offsets.

A replay ran each reader's old build and new build over the same inputs
(`b68-fix/replay/b68-replay.mjs` in the audit's scratch folder):
the slices in 266 artifact files under 405 run directories
(three unreadable directories skipped,
6,037 usable rows),
and the 92 English pages beside their 92 Chinese pages at the pinned corpus commit,
with one synthetic control per reader,
each of which differed as built to.
Its first run found two faults in the fix,
both corrected before the figures here were taken:

- the parse masks a lone `<details>` or `</details>` to read the rest,
  so the target-only run's anchor skipped one and anchored a block early
  (`XingZ6012` slice 88);
  `parsedTopLevelBlocks` now lists each masked tag as a block of its own,
  in its place;
- on a candidate the slice grammar refuses,
  the address floor read the texts whole and its finding came before the parse floor's,
  standing in for the one that names the fault (`BI4PBV` slice 3);
  the address floor now leaves such a candidate to the parse floor.

The corrected replay:

- `isLineStructured` over 1,381 inputs:
  five answers moved,
  each from line-structured to not,
  three slices of one fidelity run losing HTML comments as blocks
  and two losing lone container tags
  (`XingZ6010` slice 76 and `XingZ6012` slice 88);
- `splitTargetOnlyRun` over 756 inputs:
  four splits moved
  (`Mio10` slices 15 and 16,
  `Mio7` slice 13
  and `XingZ6012` slice 88),
  each by the two line breaks before the protected run alone,
  and the judged part restored with the protected run rebuilt the archive in 756 of 756 inputs under both builds;
- `contentBlockCount` through `sliceSizeOf` over 3,677 inputs:
  183 block counts moved,
  read by the probes alone,
  and none threw;
- `droppedAddressFindings` over 18,541 inputs,
  `protectedRanges` over 3,678
  and `canadianizeText` over 18,633:
  no answer moved.

The full suite found a third fault,
which no replay input carried.
The Han residue floor reads every original,
page and candidate through `protectedRanges`,
which the old backtick scan let read any text;
on a page of 16,000 nested quotation markers
(`translate-floor-ground.unit.test.ts`)
plain markdown exhausted its stack inside `proseBodyTree`,
and the `RangeError` left the floor.
`parseMarkdownBody`'s TSDoc called plain markdown total;
it now names the overflow,
`requireMarkdownRefusal` (`parse-mdx.ts`) narrows a catch to it,
`proseBodyTree` reads such a body as having no blocks,
and `translate-skeleton-page.ts`,
which read any failure of the plain grammar as a refusal,
now reads that one alone.
`prose-ranges.unit.test.ts` carries the page,
beside the same code span one quote deep;
with `proseBodyTree`'s catch made to rethrow,
that case failed on the `RangeError`,
and the catch was then restored.
The suite also held three expectations the fix moved:
the protected run's leading line breaks (`archive-dispute-standing.unit.test.ts`),
the log line counting them
(`translate-slice.ts` now says the count takes in the line breaks before the run)
and the inventory of classes whose message is safe to forward,
which gains `SliceBlockCountRefusalError`.

No cache version moves:
the cache-account audit over the worktree's runs and the main checkout's
read 13,714 slice-cache records in 391 run directories,
the newest written 2026-09-27T04:26Z,
and each of the seven versions was set after it.

What enforces it:
`src/blank-line-splits.unit.test.ts`,
among the source scans,
fails on a production call to `split`,
`indexOf`,
`lastIndexOf`
or `includes` handed a string holding a blank line,
a constant the file declares with one,
or a regular expression matching two line feeds.
Its fixture case runs first.
With `folded.split('\n\n',)` planted in `isLineStructured`,
its package case failed naming that line alone (`line-structure.ts:108 split`),
and the line was then removed.
Out of its reach:
a reader that walks lines and treats an empty one as a boundary,
and a blank line built at run time.

Calls made here are open to veto:

- a passage the slice grammar refuses is read whole by the address and suicide floors,
  not line-structured,
  and protects nothing,
  rather than stopping the slice;
- the page passes read a body the strict grammar refuses as plain markdown;
- the protected run carries the line breaks between the anchor and the run;
- a paragraph or heading at any depth opens a sentence for the spelling pass;
- the probes' block count throws on a refused side rather than counting it another way;
- a candidate the slice grammar refuses is left to the parse floor by the address floor;
- HTML comments and lone container tags no longer count as blocks for line structure;
- lone container tags are blocks for the target-only run;
- a body neither grammar reads has no code span or sentence start read off it,
  its backticks prose to the page passes and the Han residue floor;
- plain markdown's refusal is a `RangeError`,
  and any other failure inside it propagates.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse".

### B101: the source-scan tests kept their own copies of the shared helpers

Found 2026-10-01 (UTC) reading the scan tests for helpers B99 had not hoisted,
fixed in the commit adding this entry.
Each scan test that parses the package's source took its tree helpers from `source-scan.test-fixture.ts`
and also defined some of them again:
15 files held a `fixture` builder returning the object it was handed,
6 held their own `identifierName` and one the same body as `identifierNameOf`,
2 held one `literalText`,
and `command-line-reads.unit.test.ts` held its own `nodesUnder`
and an `unwrapped` that returned the bare inner node.
The duplicate-body scan reads production source alone
(`duplicate-bodies.unit.test.ts` filters test files out),
so none of these copies could fail it.

The 26 local definitions are gone:
the 40 builder calls are the object literals they returned,
`literalText` joins the fixture beside `identifierName`,
and `command-line-reads.unit.test.ts` reads the fixture's `unwrapped` through its `.inner`.
Copies that differ in behaviour stay where they are:
`count-nouns.unit.test.ts`'s `literalText` unwraps first,
`floor-inputs-stated.unit.test.ts`'s `unwrapped` reads fewer wrapper kinds,
and the two `callsNamed` differ in unwrapping.

The duplicate-body scan's own logic,
run over the 946 test files and fixtures after this change,
found 96 groups holding 266 copies.
Six are whole test-case bodies:
three repeated across the glossary test files,
and three repeated within one file each
(`fidelity-splice.unit.test.ts`,
`grace-override.unit.test.ts`
and `mask-invisible-lines.unit.test.ts`).
They are queued as a family of their own,
to be hoisted,
deleted or listed with a reason before the scan widens to test files.

Recurrence:
`mistake-prevention.md`,
"Copies of shared code".

### B102: 300 production modules with no unit test of their own

Found 2026-10-01 (UTC) by a read-only census an agent ran over the package's tracked source
(`own-tests/census.mjs` in the audit's scratch folder),
guarded in the commit adding this entry.
Of 1,086 production modules,
669 have a `<stem>.unit.test.ts` beside them and 417 do not.
Of the 417,
44 are barrels,
38 hold only types and literal constants,
and 35 are runner entries `src/build-entries.ts` lists;
the other 300 are logic,
139 of them named by some other module's test
and 161 named by no test at all,
reached only through whatever imports them.
A module tested only through its importers loses that coverage without a word when an importer changes,
and nothing stopped a new module from joining them.

What enforces it:
`src/own-unit-tests.unit.test.ts`,
among the source scans,
holds the 300 in a sorted `ALLOWLIST`.
It fails on a production module with no own test,
no exemption by shape
and no line there,
and on a line whose module gained an own test,
turned out exempt
or is gone,
so the list only shrinks.
The exemptions are read off each module's own syntax tree:
a barrel,
a module of types and literal constants,
or a runner entry named among `src/build-entries.ts`'s string literals.
Its fixture case runs first and passed from the start;
with `src/active-footnote-markers.ts` taken out of `ALLOWLIST`,
its package case failed naming that module alone as unlisted,
and the line was then put back (300 lines again).
Out of its reach:
whether a module's tests exercise every branch,
which the coverage census measures,
and a runner entry known only by a top-level `await` or a `process.argv` read.

Calls made here are open to veto:

- an own test is the exact `<stem>.unit.test.ts` beside the module;
- the 300 stand listed rather than each getting a test first,
  so they are worked down by the coverage batches and the list shrinks as they go.

Recurrence:
`mistake-prevention.md`,
"Modules without a test of their own".

### B103: test files kept their own copies of the shared test helpers

Found 2026-10-01 (UTC) by a read-only census an agent ran over every unit test and fixture,
by each helper's name and by its body's shape under any name
(`fixture-migrate/report.md` in the audit's scratch folder),
fixed in the commit adding this entry.
Three fixtures held a helper whose header said test files carry their own copies
and new cases import the fixture's:
`candidateCarrying` in `translate-ballot.test-fixture.ts`,
`capturingLogger` in `capturing-logger.test-fixture.ts`
and `scratchDir` in `scratch-dir.test-fixture.ts`.
The copies the change removes number 42 under 13 names:
six readings of a judge's ballot
(five `pickCandidate` and a `correctedCandidate` with its needle fixed),
19 throwaway directories under 10 names
(eight `scratchDir`,
three `throwawayCacheDir`,
and `makeArchive`,
`throwawayTree` and others),
differing only in the prefix and the field naming the path,
and 17 capturing loggers,
13 the fixture's own under three names for the array
and four that made the array themselves and returned it beside the logger.
The duplicate-body scan reads production source alone,
so none of them could fail it.

Each file now imports the fixture:
the wrapper's call passes its needle,
callers of the four that made their own array call the new `capturingLoggerPair`,
and handles are read through `.path`.
The agent's patch needed more,
none of it found by the tests it changed.
Lint found seven files keeping an empty `import {} from 'node:fs/promises'` its import cleanup left,
one case destructuring the old `publishDir` field
(the type check's TS2339)
and `capturingLoggerPair`'s return type on one line.
The full suite's unused-imports scan found 21 imports only the deleted helpers had read
(14 `Logger`,
6 `join`
and 1 `mkdtemp`),
after lint and a run of the 41 changed test files had passed (M75);
the full suite's background task reported exit 0,
the status of the `|| echo` fallback its command ended with,
and the log's `[FAIL]` markers were what showed the failure.
Reading found that `sink-names-only.unit.test.ts` had lost the comment saying why the disposer removes a mode-000 file,
now restored beside the `chmod`.
The three fixture headers claimed every copy had moved;
they now say the copies moved and name the kinds that stay.

Copies that differ in behaviour stay where they are,
each queued:

- `corpus-run/pass-entry.unit.test.ts`'s `pickCandidate` matches any of several needles;
- `consolidate-driver.unit.test.ts`'s own `candidateCarrying`
  and the `numberedOn` inside a case in `consolidate-settle.unit.test.ts`
  read a serialized request body,
  where a line break is the two characters `\n`,
  and are the same code as each other;
- `repair-assemble-withdrawal.unit.test.ts` and `stage-call.unit.test.ts`
  each record warnings alone over their file's tagged logger,
  the same code twice;
- helpers that make a directory and never remove it are a leak,
  not a copy,
  and get an entry of their own.

Found while writing this entry:
`mistake-prevention.md`'s "Copies of shared code" still said nothing fails on a shared module without its own test,
a sentence the B102 scan made false;
B102 wrote a section of its own and left that one standing.
It now names the scan.

Recurrence:
`mistake-prevention.md`,
"Copies of shared code"
and "Current-state docs".

### B104: an attestation quote verified against a reference line's head

Found 2026-10-01 (UTC) reading B25's open item again,
red in `2b413912f`,
fixed in the commit adding this entry.
`verdictOf` (`reference-attest-verdict.ts`) looked for an item's reference quote in the whole reference line,
so a quote of the page's address,
of the head's own "reference 1",
or of the lookup's note on a page it could not fetch or read
verified as if the page had stated it.
B25 left this open because a title may hold any separator,
so the body cannot be cut from the line;
B28's `referencePageTexts` had since read a page's statement as everything after the address,
title included,
and an address holds no space,
so the cut needs no body marker.

`referenceLinePageText` (`reference-line-head.ts`) now reads one numbered line's page text,
empty for an unfetched or unreadable page,
and both readers go through it:
the attestation and the archive block review's `referencePageTexts`.
The red case builds its block with the lookup's own `referenceLineOf`
and drops the address,
head and both failure notes while keeping the title and the text;
a case on `referenceLinePageText` covers a head with nothing after it,
which the lookup never writes.

Measured before the fix
(`b25-head-only.mjs` in the audit's scratch folder,
rebuilding each line from the lookup cache as B25 did):
of 106 verified items the run logs record,
25 could not be rebuilt and all 81 others quote their named page's text,
none its head alone,
so no stored result moves.
With each quote replaced by its own page's address,
the positive control,
all 81 moved to the head alone.
No cache version moves:
the translate slice key folds in the attested lines
and the repair slice key the reference context,
so an attestation that keeps different items changes the key.

Guard shown to fail:
with `verdictOf` reading the whole line again,
the red case failed alone in its file,
and passed once the page text was restored.

Calls made here are open to veto:

- a page's title is part of what it states,
  as B28 already read it.

Recurrence:
`mistake-prevention.md`,
"Checks on one part of a composed text".

### B105: the census reading counted unmapped code as not loaded after every rebuild

Found 2026-10-01 (UTC) reading the twenty-fourth batch's census,
red in `07b5bbd49`,
fixed in the commit adding this entry.
The census records code no source map places as `(unmapped) <bundle>` at line 0,
and the bundle's name carries a content hash a rebuild moves.
`ce32e438d` left such code out of "cold since then",
but `baselineStatusesOf` (`corpus-run/coverage-census-baseline.ts`) still read every baseline stretch,
so the same six stretches of the `wording-key` chunk read as not loaded at every census whose chunk hash moved:
`census-xSHq2Q` against `census-NkULde` holds them at the same bundle offsets,
1946 to 2352,
under `wording-key-FnMvcg3m.mjs` and `wording-key-k661Sfmz.mjs`,
and the reading printed "not loaded 6".
Ten passages of the T8 batch records explained those six by hand
(`rg 'not loaded are|chunk is renamed' doc/audit-ledger.md` before this entry).
The reading now leaves unmapped code out of every status,
as it already did of "cold since then";
the census's own report still counts it on its unmapped line.
With the filter taken back out,
the new case failed alone in its file,
and passed once it was restored.

Recurrence:
`mistake-prevention.md`,
"Claims without their evidence".

### B106: the attribution reader read a missing or malformed field as an empty one

Found 2026-10-01 (UTC) reading the twenty-fourth T8 batch,
the attribution reader's stretches in `census-xSHq2Q`,
red in `48c4433d9`,
fixed in the commit adding this entry.
`gatherAttributionEntries` (`corpus-run/attribution-read.ts`) told absent from malformed for the critic record alone,
which is right,
since an artifact settled before attribution carries none.
Every other field it read fell back to an empty reading:

- `issues` absent or not an array read as no issues;
- an issue record that is not a record,
  or whose `issue` is not one,
  read as a view with an empty status and no claims,
  the reading B92's case pinned;
- a `status` that is not a string read as empty,
  `claims` absent or not an array as no claims,
  and a claim member or `claimId` of the wrong shape was passed over;
- a `lanes` key on an unversioned or version 1 artifact,
  which keeps its records at the root,
  was ignored;
- a version 2 or later artifact whose `lanes`,
  `lanes.repair` or `lanes.repair.result` is not a record read its records off the root,
  which holds none of them;
- a claim credited to a proposer its own chunk's `heardCriticIds` does not name was counted,
  and the report's roster took critics from the claim maps as well as the heard counts,
  so such a critic got a row with no chunk heard.

Every one of these fields is written by every generation that has settled an artifact.
Over the 379 stored artifacts
(the run directory's `artifacts`,
`round-one-archive` and `round-two-archive`,
and every throwaway runs directory's `artifacts` under the audit's scratch folder),
every `issues` is an array,
all 26,544 statuses are strings,
all 36,496 claim ids are strings,
all 263 artifacts of version 2 or later hold `lanes.repair.result` as a record,
no root-record artifact carries `lanes`,
and all 23,714 proposers were heard in their own chunk's record.

The reader now refuses each shape with `ArtifactParseError`,
naming the path:
`readIssueViews` and `readClaimIds` at every level,
and `recordsHolderOf` by the artifact's own generation.
`decodeChunkRecord` (`corpus-run/attribution-decode.ts`) reads `heardCriticIds` before `claimAttributions`
and refuses a proposer the chunk did not hear.
`buildAttributionReport` (`corpus-run/attribution-report.ts`) narrows the eligible entries by a type guard,
so three `?? []` defaults go,
and builds its roster from the heard counts alone,
ordered by `compareCodePoints` (ledger B95).
The entry reader is exported as `attributionEntryOf`,
and holds the artifact's `id` to its file name,
as placement does (`corpus-run/artifact-placement.ts`),
since it reads the file a second time;
its refusal names the field,
`<file>.id`,
where it named the file alone.
Its own cases reach the two refusals the gather never feeds it,
a body that is not a record and an `id` that is not the file's name.

The red commit's cases failed at the build of `020c9bebd`:
the rewritten B92 case,
and the table's 16 rows,
each of which a probe ran alone in a directory of its own
and saw read as an entry,
with nothing refused.
With the `id` check weakened to a type check,
the case naming another entry's `id` failed alone in its file,
and passed once the check was restored.

Reach:
the built gather ran over every stored directory holding JSON
(240 directories)
at the build of `48c4433d9` and at this commit's.
It read 205 entries with 42 refused before,
and 202 entries with 45 refused after;
the eligible entries stayed 202.
The three newly refused are `Cat.json` files of 180 bytes,
written 2026-09-10 in `issue-authority-cache-*` folders,
holding only `id`,
`tip`,
`pipelineDigest` and `status`:
test leftovers,
from a prefix no current source names,
that the gather had counted as ineligible entries.
The 42 refused both times are B107's.
Twelve directories the gather refuses whole,
six for an empty pool and six for mixed generations,
both times.

Calls made here are open to veto:

- a field every generation writes is refused when absent,
  rather than read as empty;
- the entry reader holds the file-name identity again
  rather than trusting the pool's earlier read;
- the roster is the heard critics alone,
  a proposer outside them being refused upstream;
- the three test leftovers count as refused rather than as ineligible entries.

Recurrence:
`mistake-prevention.md`,
"Defaults that stand in for an input".

### B107: the attribution decoder read every generation's record index under one spelling

Found 2026-10-01 (UTC) measuring B106 over the stored artifacts,
red in `3410cef02`,
fixed in the commit adding this entry.
Generations 1 to 3 wrote each per-slice record's index as `chunkIndex`,
and generation 4 onward writes `sliceIndex`;
`artifact-key-vocabulary.ts` records both,
and the attribution reader already chose the critic record's own key through it.
`decodeChunkRecord` (`corpus-run/attribution-decode.ts`) read `value.sliceIndex` whatever the generation,
so every generation 2 or 3 critic record read as missing its index,
and the whole artifact was refused as malformed.
Over the stored artifacts,
all 246 generation 2 critic records and both generation 3 ones carry `chunkIndex`,
and the gather refused 42 artifacts,
41 of generation 2 and one of generation 3
(`b24/slice-index-values.mjs` in the audit's scratch folder).
The two cases meant to cover those generations wrote `sliceIndex` into their records,
which no writer of those generations produced,
so they agreed with the decoder rather than with the writers.
A census of every reader of stored artifacts found no other reading of a renamed key outside the vocabulary:
the two-lane readers take the vocabulary,
the page-assembly reader reads only generations that spell the index `sliceIndex`,
and the change-set reader refuses every generation past 1.

`decodeSliceCritics` now takes the generation's vocabulary,
and `decodeChunkRecord` the index key it names,
so a record is read under its own generation's spelling
and a record carrying the other spelling is refused,
naming the key its generation wrote.
The generation 2 and 3 cases spell their records as those generations did,
a generation 14 case reads as the control,
and a case refuses each spelling under the other generation;
`artifactWith` and the explicit generation 1 and 2 fixtures spell each record's index `chunkIndex`,
as does the sound generation 1 fixture in `corpus-run/sink-names-only.unit.test.ts`,
which wrote `sliceIndex`,
so the fix refused it and the full suite failed on it until it was respelled.
The red cases failed at the build of `cd3cab768`,
and pass here.

Reach:
the built gather over the 240 stored directories holding JSON read 202 entries with 45 refused at the build before this fix,
and 244 entries,
all eligible,
with 3 refused here:
the three `Cat.json` test leftovers B106 names.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail".
