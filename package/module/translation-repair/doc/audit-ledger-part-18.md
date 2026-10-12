# Audit ledger, part 18

Part 18 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Found while fixing, continued

### X21: a `$...$` pair is a formula on the site and prose here

Status:
closed 2026-09-29,
premise refuted by measurement;
found the same day rereading `doc/repetition.md` ("The site's grammar is not this one").
The site compiles each page under `remark-math` and `rehype-katex`,
so a `$...$` pair is a formula there,
while this package parses it as prose;
six source pages at the pin carry one.
No pass that rewrites prose
(the typography restore,
the Canadian forms passes,
the prose masks)
has been checked inside a formula,
so a prime curled or a word respelled inside one would ship unseen.
Fix:
census every math pair in the sources,
the archive English,
the settled pages and the artifact strings;
replay those passes over them;
if any rewrites inside a formula,
protect math pairs in `corpus-run/prose-ranges.ts` and `typography-prose-mask.ts` as the site's compiler reads them,
with a guard shown failing first.

What the census found:

-   No formula exists where the passes act.
    The site's own compiler
    (`@mdx-js/mdx` 3.1.1 with `remark-math` 6.0.0,
    the versions its lockfile resolves,
    installed in `~/temp/agent/x21-math/` and run after the site's own rewrite of HTML comments into JSX comments,
    `census.mjs`)
    finds no math node in any of the 92 sources or archive translations at the pin,
    nor in any of the 273 settled pages under the agent runs
    (the package's own runs roots hold artifacts but no written pages).
    A planted file holding a formula,
    a pair of dollar amounts and a display block showed the census finding all three.
-   The entry's "six source pages carry one" counted dollar signs rather than formulas.
    Of the 395 dollar signs in the pinned sources and archives,
    all but one open a template string (`'${...}'`) inside a JSX attribute such as a photo list,
    which the MDX compiler reads as code;
    the one left is a single currency sign in `mikaela_khara`'s archive translation,
    with nothing to pair with.
-   So no typography or spelling pass has ever run inside a formula,
    and a mask protecting formulas would guard nothing and could not be shown red.
    What the census did find is a different gap,
    recorded as X22.

### X22: this package's strict parse lacks the site's math grammar

Status:
fixed 2026-09-29,
found the same day closing X21.
`parse-mdx.ts` says it parses with the grammar family the site compiles with,
but the site adds `remark-math` and this package does not,
so a wording that forms a formula passes the strict parse the publisher runs (the eighth class)
and renders as TeX on the site.
Models write such wordings:
over every string of the 370 artifacts under the agent runs and the package's runs roots
(`~/temp/agent/x21-math/artifact-dollars.mjs`,
each candidate confirmed by the site's compiler),
44 form a math node.
43 are judges' reasons,
findings and claim summaries,
which reach no page;
one is page text,
a translate-slate candidate in `XingZ616` (slice 83) that wrote a TeX command between dollar signs
where the source has no formula.
It did not ship,
since no settled page carries a math node,
but nothing refused it.
Fix:
add `remark-math` at the site's major version to `parseMdxBody`,
first showing the parse tree unchanged over every current input
(so no cache version moves),
then a floor where the quote-balance floor stands that refuses a wording forming a math node its incumbent lacks,
with a guard shown failing first.

What was done:

-   `5ce9370ac` adds `remark-math` to the strict parse,
    pinned in the catalog to the site's major version with the reason beside it;
    the lockfile gains `remark-math` 6.0.0 and its own dependencies and nothing else.
    Over the 457 current inputs
    (the 92 sources and archive translations at the pin and the 273 settled pages),
    456 parse to the same tree with and without it,
    and the one left is refused both ways (the eighth class's page);
    a planted formula changed the tree,
    so the comparison could show a difference
    (`~/temp/agent/x21-math/tree-diff.mjs`).
    The tolerant fallback stays without it:
    with no MDX grammar,
    the template strings of JSX attributes read as prose there,
    and math changed 171 of the same 457 trees.
-   `9aecc5277` adds `translate-formula.ts` to the source-carry floors after the quote balance:
    a candidate forming more formulas than its original is refused before any judge,
    comments cut first,
    standing aside where the strict grammar refuses either text.
    `validateTranslatedSlice` runs it,
    so the translate lane,
    the consolidation stages and lane-contest eligibility all read it.
-   No cache version moves:
    the translate,
    consolidation and lane-contest version accounts record that no slice-cache file under the agent runs is newer than
    04:26 UTC on 2026-09-27,
    so no answer cached under the current numbers exists to be served.

Guard:
`src/translate-formula.unit.test.ts`,
committed red in `deb3406b2`:
a pair of dollar amounts,
a TeX command between dollar signs,
and a formula in a paragraph whose comment stands outside it are refused;
escaped signs,
a single amount,
the original's own formula and dollar signs inside a JSX attribute pass.
Five mutants (the floor never refusing,
ignoring the original's formulas,
keeping comments,
counting block formulas only,
and the floor unwired) were each caught,
the comment mutant only after M56's fixture was corrected.

### X23: the run client and the provider gate read the process's keys by default

Status:
fixed 2026-09-29 for the provider gate (`4138c5ade`) and the run client (`3510c8336`);
the provider clients' own transport defaults went in X24.
`configureProviders` read the four provider keys,
the Hyper pace and the Bedrock ledger's place from `process.env`,
and `createRunClient` and `assertRequiredProvidersReady` took an optional transport defaulting to the live one.
`run-config.unit.test.ts` wrote one or two keys into `process.env` and built the client on the rest,
so every one of its client cases ran on the OpenRouter and Bedrock keys the suite inherits from `mise`
and the real Bedrock ledger's path;
its refusal cases had to clear each new key by hand,
and its own comments record two landings,
on 2026-09-03 and 2026-09-07,
that turned four of them into builds.
The format 2 baseline shows it:
of the four unconfigured-provider arms in `createRunClient`,
the Bedrock and OpenRouter ones never ran in the whole suite (`census-qilSwP`).
The wiring cases hand over a transport,
so none reached a provider;
of the 189,941 lines in the live Bedrock ledger,
none has a prompt under 200 tokens,
the size of a fixture's message
(`x23-ledger-tiny.mjs` in the audit's scratch folder,
read 2026-09-29).
`configureProviders` now requires `env` and `transport`;
`runClientFrom` builds the run client over both,
and `createRunClient`,
which every runner calls,
hands it `process.env` and `fetchTransport`.
The client cases build on environments they hand over,
the Bedrock one over a ledger in a throwaway directory,
and the one case of `createRunClient` clears every key and expects the refusal.
The stand-in caller that refused by name for each absent provider went with it:
an absent provider's meter is `UNCONFIGURED_METER`,
which reads dry (`provider-meters.ts`),
and the route never picks a dry provider (`routeProviderFor` in `budget-routing.ts`),
so no call could reach one;
the router now takes only the configured callers and asserts one is present where it calls.
Prevention is M43's:
a builder that reads a key,
a cache or a transport takes it as a required parameter,
and the process's own is named once,
in the function runners call.

### X24: parameters that fell back to the live transport or the corpus clone

Status:
fixed 2026-09-29.
A census of every parameter in package source whose default reaches past the process
(`x24-default-callers.mjs` in the audit's scratch folder,
beside a search for defaults naming `fetch`,
`fetchTransport`,
`process.env`,
`homedir()`,
a cache directory or a corpus reader)
found three kinds.
The five provider clients (`createSyntheticClient`,
`createHyperClient`,
`createDecisionsClient`,
`createOpenRouterClient`,
`createBedrockClient`) defaulted their transport to the live one;
every test handed one over,
and the one runner that did not,
`budget-sample.ts`,
meant the live one.
Six corpus readers defaulted to the clone:
`readCorpusNames` its lister and reader,
`loadEntry` its source reader (M70),
and `censusEntry`,
`gatherControlCases`,
`gatherRelabelCases` and `sampleBenchSlices` their pin;
every test handed over a fixture or a throwaway clone,
and the runners that left them out meant the run's pin.
Each is now required:
the runners hand over `fetchTransport`,
`readCorpusFile` or `RUN_CORPUS_PIN`,
`slice-census.ts` hands over the run's pin for an entry whose artifact predates the recipe,
where it had left the pin out,
and `draw-entry-load.unit.test.ts` hands its refusal cases a reader that refuses any corpus read.
The third kind was read and kept:
the operator dials `resolveSpendCeilingUsd`,
`resolveHardCapMinutes`,
`resolveStragglerGraceMs` and `resolveWriterGraceMs` default `raw` to their variable,
which is configuration a run is launched with rather than a key,
a cache or the network,
and their tests hand `raw` over.
Library code reading a key from `process.env` in a function body turned up only in runners
(`model-catalog.ts`,
`roster-card.ts`),
which the runner batch of T8 reads.

## Recurring code families

Audit area six:
code kept in more than one place,
which can drift until two parts of the pipeline
read one page two ways.
`~/temp/agent/audit-glossary-fix/duplicate-bodies.mjs` parses every non-test source file with rolldown's parser
and groups function bodies with comments and whitespace removed;
on 2026-09-28 it found 31 groups of 80 normalized characters or more spanning two or more files.
`duplicate-triage.mjs` and `duplicate-texts.mjs` print each copy's full text and the module-level names it reads,
so a copy whose body matches but whose constants differ shows up as such.

The rule applied to each group:
merge when both copies are live code that must agree;
keep a copy that is an artifact generation's frozen rule,
which the reader recomputes and refuses to disagree with,
and say so where it stands.
`artifact-two-lane-comparison.ts` states this for the lane verdict (`judgeTwoLaneSlice` beside `judgeSlice`).
A reader of one artifact version never imports from a live stage;
two readers of the same version may share.

### B1: private Han tests and code-point counters, and two Han tests that read one page two ways

Status:
fixed in `67243edae`,
`edb013f38`,
red guard `58d1eefaf` and `37db4ae4b`,
2026-09-28.
`page-name-glossary.ts`,
`corpus-name-index.ts` and `handle-reading.ts` each kept a private copy of the
U+4E00 to U+9FFF test `han-only-text.ts` exports,
and two of them a code-point counter beside `codePointCount`.
The floors' `isHanCharacter` read the unified block alone while the tokenizer's `isIdeograph` added Extension A;
neither read the compatibility block or astral Han.
`isHanCharacter` now covers Extension A,
the unified block,
the compatibility block and Extensions B to H,
and `isIdeograph` delegates to it.
No pinned page carries a character from the added blocks (Extension A,
compatibility and astral counts all 0,
against 210,475 unified-block characters),
so no page reads differently.

### B2: two quote-line readers

Status:
fixed in `43132653d`,
2026-09-28.
The line structure guard and the bilingual pair bound each kept a copy of what a line carries past its `>` markers.
`quote-line.ts` now holds `carriesContent` and `pastQuoteMarkers`,
with its own unit test.

### B3: three copies of whether a footnote relabel moves a note

Status:
fixed in `441e609ab`,
2026-09-28.
The relabel planner (`archive-footnote-relabel.ts`),
its closure (`archive-footnote-closure.ts`)
and the pass that reports the relabel (`pass-footnote-relabel.ts`) each tested whether a from-to relation
folds to another footnote.
`relabelsFootnote` in `footnote-identifier.ts` now serves all three,
with a unit test for respelling and moves.

### B4: two copies of the page assembly's archive-repeat filter

Status:
fixed in `bb836ea31`,
2026-09-28.
`guardPageAssembly` dropped rows repeating the archive's wording on its first read,
and each round of `settlePageRounds` dropped them again before the footnote check,
each with its own copy.
`rowsChangingArchive` in `page-assembly-rounds.ts` now serves both.
A mutant keeping every repeat fails 9 assertions across the guard and heading-collision tests;
its control survives.

### B5: two copies of the shipped-slice reading, one lane's call untested

Status:
fixed in `184b10cf9`,
2026-09-28.
Both lanes built the per-slice list the adjacent-repetition check reads with their own copy of `shippedFor`;
`shippedSliceTexts` in `assembly-invariant.ts` now serves both.
Mutation found the translate lane's call untested:
handing it no surviving rows,
so every slice read as the archive,
failed no test,
because only the repair lane's twin (`repair-assemble-slice-match.unit.test.ts`) drove the reading.
`translate-assemble-slice-match.unit.test.ts` now kills that mutant (2 failures)
and an inverted slice match (3 failures);
its control survives.

### B6: two HTML-comment finding tests beside a third inline

Status:
fixed in `c92394058`,
2026-09-28.
`archive-original-note.ts`,
`entry-notes.ts` and `footnote-protected-ranges.ts` each spelled out the two comment kinds;
`isCommentFinding` in `parse-document.ts`,
where the kinds are defined,
now serves all three,
with a test over every finding kind.

### B7: two readings of one event stream, and a data prefix spelled with its space

Status:
fixed in `91ff1e779` and `440eb0c0d`,
2026-09-28.
The live delta scanners (`stream-delta-scan.ts`,
`anthropic-delta-scan.ts`) read `data:` lines by the event-stream
format (one trailing carriage return dropped,
the field name at the line start,
one optional space removed),
while the three readers folding the drained body (`stream-completion.ts`,
`anthropic-completion.ts`,
`openrouter-chunk-scan.ts`) trimmed every surrounding space first.
A line the format does not count as an event (one indented before `data:`) reached the answer
while the runaway guards never saw it.
`ssePayloadOf` in `sse-data-line.ts` now serves all five;
mutants restoring either trim,
keeping the carriage return,
or stripping every space each fail 2 assertions.
A sixth reader,
`requireBedrockStreamEnd` (`bedrock-stream-end.ts`),
looked for its usage chunk under `data: `
with the space,
so a usage chunk sent as `data:{...}` never counted and a whole stream was refused as cut off;
it now reads through the same function,
and a test sending the tight form fails when the spaced prefix is restored.

### B8: five span-rewrite appliers under three contracts

Status:
fixed in `8f590d8e8`,
2026-09-28.
The name casing sorted its rewrites and dropped any overlapping an earlier one;
the Canadian forms sorted and trusted a comment that dates and spellings never overlap;
the pinyin tones applied rewrites in the order parentheses were read,
sorted or not;
the casing restore and the tag attribute restore relied on their callers' order.
An unsorted or overlapping set splices behind the cursor and repeats page text.
`applySpanRewrites` in `corpus-run/span-rewrites.ts` orders by start,
the longer first,
and withholds overlaps
for all five;
mutants dropping the sort,
the tie-break or the overlap rule each fail its test.
Nested parentheses in a pinyin probe produced no duplicate rewrite,
so no page is known to have hit the defect.

### B9: small shared helpers kept twice

Status:
fixed,
2026-09-28,
each with the tests naming its callers passing.

- `longestRunOf` (`character-run.ts`) for the Markdown and prompt fences,
  which counted runs of different characters
  with one body (`304ae283d`);
  its test counts an astral character by code point.
- `runEnd` and `runStart` moved to `corpus-run/text-runs.ts`,
  and the pinyin pass's private `scanEnd` copy removed
  (`c147db8cc`).
- `chunkLabel` exported from `chunk-document.ts` for `coverage-candidates.ts` and `prepare-section-round.ts`
  (`f96ade088`;
  the 46 test files touching sectioning pass).
- `sliceSizesOf` (`displacement-ratio.ts`) for the displacement probe and the window trial (`d80ebe034`).
- `describeBlocks` and `sameShape` from `translate-validate-blocks.ts` for the archive revision shape check,
  over the same `BlockShape` (`6a80392c6`;
  54 test files pass).
- `bothHalvesInserted` (`container-half-pairs.ts`) for lone-half withholding and insertion admission (`957a5ab3e`).
- `slicesInOrder` in `heading-collision-restore.ts` and a new `rowsChangedBy` (`assembly-page-text.ts`)
  for the casing and name gloss restores (`4006a55d4`).

### B10: probes and a benchmark grader that re-carved slices and claimed to match the pipeline

Status:
fixed in `87e42628a` and `2732a2c4e` (red guard `a00128524`),
2026-09-28.
Measured over the 92 pinned pairs (`~/temp/agent/audit-glossary-fix/probe-slicing-extra.mjs`),
aligning sections and subdividing them matches `prepareDocumentPair` in order on every pair
except the front-matter slice the preparation leads with,
so a re-carve's slice numbers run one behind the run's.
The relabel probes find their slice by text,
so no result moved;
they now take the preparation's slices.
The recall benchmark's `gradeSeedDetection` indexed issue records,
which carry the run's slice numbers,
into such a re-carve:
on any document with visible front matter (all 92 pinned pairs) every issue read the next slice,
so an accepted issue at a seed was scored undetected.
It now slices through `prepareDocumentPair` as `repairTranslation` does;
a test with front matter was red before and passes after,
and the older grader test builds its expected slices the same way.
The bench sample keeps its own carve:
its line-structure flags agree with the preparation's on all 1,259 comparable
slices (`bench-line-structure-parity.mjs`),
it leaves the front-matter slice out,
and its numbering is its own.
The slice census and the translate probe measure shapes and texts,
not run indices,
and stay.

### B11: correspondence-list checks kept three times, and a type declared twice

Status:
fixed in `010e36bc5`,
`84c748aba` and `74f56d2bf`,
2026-09-28.
`pair-blocks-wire.ts`,
`pair-sections-read.ts` and `corpus-run/slice-cache-store.ts` each tested
the integer `{ source, target }` list shape;
`isIndexPairList` and `isIndexPairingWire` (`index-pair-list.ts`)
now serve them,
with a test covering ten refused shapes.
`010e36bc5` declared its own `IndexPair` while `pair-agreement.ts` already exported the same shape,
and the package failed its type check at that commit;
`84c748aba` uses the existing type (M47).

### B12: four provider clients with identical limiter and JSON plumbing

Status:
fixed in `23ae677be`,
2026-09-28.
Bedrock,
Hyper,
OpenRouter and Synthetic each kept `limiterFor` and `chatJson`;
each `chatJson` forwarded four named request fields by hand,
so `otherThan` never reached a JSON exchange
(harmless today:
the cross-provider re-ask goes through `chatText`).
`perModelLimiter` and `chatJsonThrough`,
which forwards the whole request but its validator,
now serve all four;
the 25 client test files pass and a direct test pins the forwarding.

### B13: two renderings of prior failed corrections

Status:
fixed in `4830317ef`,
2026-09-28.
`renderPriorCorrections` (`refine-selection-context.ts`) now serves the refine context and the consolidation gate.
Prompt text,
so measured rather than read (`sheet-bytes.mjs`):
hashes of all 38 rendered-sheets fixture sheets
and of both sheets with two prior corrections are identical before and after;
a one-word change to the rendering,
as a positive control,
moved all three hashes.

### B14: artifact readers with private string-list and pair-list readers

Status:
fixed in `8c897d1cc` and `657a81dbe`,
2026-09-28.
`requireStringList` (`artifact-guard.ts`) replaces four private readers and one inline copy;
`requireIndexPairList` (`artifact-exact-guard.ts`) replaces the two section-pairing readers' whole-function copies.
Both readers read one artifact version,
so sharing keeps the freeze.
The 43 artifact test files pass.

### B15: frozen copies kept on purpose

Status:
kept,
annotated in `c0d0eb22a`,
2026-09-28.
`judgeTwoLaneSlice` beside `judgeSlice` (`artifact-two-lane-comparison.ts` already said why)
and `uniqueNaturalnessFindings` beside the live `uniqueFindings`:
each reader copy is an artifact version's rule,
recomputed on read and refused on disagreement,
so merging would remove the check.
Both naturalness sites now say so.

### B16: 41 import bindings nothing referenced, and no check that reports one

Status:
fixed in `3817a99c9`,
2026-09-28;
the missing check is repository configuration,
outside the package,
and issue #578 asks for it.
`noUnusedLocals` is off in `package/config/typescript/tsconfig.options.json` and the linter reports none either,
so the provider-client merge (B12) left four `p-limit` imports behind unnoticed until counted.
A parser census over the package's 1,837 source and test files (`~/temp/agent/audit-glossary-fix/unused-imports.mjs`)
found 41 bindings no code references;
36 are removed across 24 files,
and the 5 kept are TSDoc `{@link}` targets (`ArtifactParseError` in three readers,
`FidelityReferenceError`,
`IssueEvidenceConflictError`).
The census now reports those 5 and nothing else.

### B17: the TSDoc example scan closed a fence on any three backticks

Status:
fixed in `7cc4ac642`,
2026-09-28;
found by the full suite.
`exampleCodeOf` (`tsdoc-example-scan.ts`) took the next three backticks anywhere as the closing fence,
where CommonMark closes only on a line of backticks alone,
at least as long as the opener.
`longestRunOf`'s example,
whose string quoted a fence,
was cut short and read as leaving out `character`,
and the package-wide scan failed;
the merge (`304ae283d`) had passed its own tests,
and the suite that caught it ran once,
after the audit-area-six commits.
The scan now reads fences line by line;
a fixture quoting a fence passes,
the same fixture missing a key is still found,
and a mutant restoring the old close fails 2 assertions.
The suite after it:
0 FAIL,
1,301 PASS lines.
