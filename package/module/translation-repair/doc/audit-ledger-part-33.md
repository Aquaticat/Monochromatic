# Audit ledger, part 33

Part 33 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B171: a cached block pairing naming a block its section lacks ended the run with a missing-value error

Red in `5df296c5f`,
fixed in `25c33df4f`.

Found on 2026-10-05 (UTC),
as an item ledger B138 left open.
`prepareBlockPairing` (`prepare-block-pairing.ts`) handed a cached record's pairs to `claimMediaAdjacentTargets` as stored.
The cache reader checks a record's shape only (`isPairList`),
and three comments said the record was re-read through `readBlockPairing`,
which happened only where media adjacency widened it.
A record naming original block 9 of 2 reached `pairSharesMedia`,
whose `nonNullishOrThrow` ended the section with `Expected non-nullish value, got undefined`,
naming no section,
key or block.
The key hashes the blocks' text,
so such a record is a damaged or hand-edited file,
which is an input all the same.

The fix:
the warm path reads the cached pairs through `assertPairsNameBlocks`,
the check `readBlockPairing` reads a reply's indices through.
A record that does not fit is a miss:
the warning names the section and the key,
gives the refusal (`pairing names original block 9, and there are 2`)
and says the roster is asked again,
and the section is bought and stored over the same key.
The comments in `corpus-run/slice-cache-store.ts`,
`pair-media-adjacency.ts` and `pair-definition-order.ts` now say that.
The red run printed the missing-value error for the case
"MISSES ON A CACHED PAIRING THAT NAMES A BLOCK ITS SECTION LACKS,
warns in the refusal's words,
and buys the section again".

No cache version moves:
the lane's generation is the digest of the built files,
which this change moves by itself
(the fixing agent's reading of `corpus-run/pipeline-digest.ts`,
with the two builds' digests measured to differ).

Open when this entry was written,
closed in B218:
the warm path checks block indices only,
not the order or the repeats `readBlockPairing` refuses;
and a cached section pairing is handed on unchecked by `buySectionPairing`.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

### B172: a walk that named no step for a block grouped the section without it

Red in `5df296c5f`,
fixed in `25c33df4f`.

Found on 2026-10-05 (UTC),
as an item ledger B138 left open.
`groupNodesSealed` (`group-aligned.ts`) read each step's blocks and never asked whether every block had a step.
A walk of one original-only step over two originals and one translation returned no runs,
and so did an empty walk,
with nothing said.

The fix:
after every step's blocks are read,
`assertWalkNamesSide` refuses a walk that leaves a block of either side unnamed,
in a message opening `unreachable: no walk step names original block 1, and there are 2`
and naming the two builders that give every block a step.
It is an invariant throw:
`alignBlocks` walks its cursor from the lists' lengths to the origin,
`bareBlockPairingSteps` gives every original a step and every translation block one,
and `mergeGap` reuses the indices it was given.
The red run printed `Expected groupsTheWalk to throw, but it returned` for the case
"REFUSES a supplied walk that names no step for a block of either side,
in the words of the refusal for a block the section lacks,
an empty walk among them".
The comment closing `mergeOneSidedRuns` named a caller's one-sided fallback that went in T8's seventeenth batch;
it now says the held blocks leave the runs unsaid and which assertion refuses that.

No carve changed:
268 version 2 artifacts rebuild to the same carve identity on both builds
(the fixing agent's measurement).

Open when this entry was written,
closed in B219,
which refuses such a block by name and reached the state through `prepareDocumentPair` with a seeded generator:
`groupNodesSealed` called alone still drops a translation-only block behind a sealed run with no paired run after it;
six shapes through `prepareDocumentPair` did not reach that state (the fixing agent's probes).

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

### B173: an explicit link destination was cut where prose would end an address

Red in `5df296c5f`,
fixed in `25c33df4f`.

Found on 2026-10-05 (UTC),
as an item ledger B139 left open.
`markdownDestinations` (`corpus-run/dropped-destinations.ts`) sent every tree destination through `trimDestination`,
which cuts at the first stopper and sheds trailing sentence punctuation.
That is right for an autolink literal,
whose address prose ran into,
and wrong for a destination its author wrote out:
two explicit links differing only past a full-width comma read as one,
and a source linking both against a page keeping the first reported nothing dropped.

The fix:
a link is an address prose ran into when it carries no span,
or its first child starts where the link starts,
the test `isAutolinkLiteral` (`active-footnote-markers.ts`) makes for the footnote relabel;
`isProseAddress` applies it,
and only such a link is trimmed.
Every other link,
every image and every definition stands as written.
`trimDestination` then meets only addresses that open on a scheme's letter,
so its emptied arm is an `unreachable:` throw.
The red run printed three [FAIL] cases in `dropped-destinations.unit.test.ts`,
two of them these;
a case pinning the literal arm was green before and after,
and fails with that arm switched off.

No pinned page reads differently
(the fixing agent's measurements):
over the 276 page files at the pin neither reader's output differs between the builds,
where an explicit destination holding a full-width comma appended to each differs on all 276,
and original against archive drops 14 destinations on both builds.
Over 249 pages rebuilt from settled artifacts on the audit machine,
one entry's page reads one more destination,
an explicit one a model wrote that ends in a closing parenthesis,
and no dropped list changes.

Open to the owner's veto:
an explicit destination keeps its trailing sentence punctuation too;
and the scanner still reads such a destination's address off the raw text and stops at the stopper,
so a source writing an address with a closing parenthesis inside as an explicit link,
against a page writing the same address bare,
now reports the explicit destination dropped.

Open when this entry was written,
closed in B213:
the literal test stands in two files,
since `isAutolinkLiteral` is private to its module;
and a closing parenthesis is a run stopper,
so a bare address holding a balanced pair of parentheses reads short on the scanner and on a literal alike
(the fixing agent's observation).
A prose cut that kept a balanced closing parenthesis would remove the difference between explicit and bare
that this fix opened.

Recurrence:
`mistake-prevention.md`,
"Defaults that stand in for an input".

### B174: a dropped destination was traced to every slice holding it as a substring

Red in `5df296c5f`,
fixed in `25c33df4f`.

Found on 2026-10-05 (UTC),
as an item ledger B139 left open.
`traceDroppedDestinations` (`corpus-run/destination-completeness.ts`) asked `text.includes` of each slice.
A dropped `https://example.org/tabby` was traced to a slice holding only `https://example.org/tabby-album`,
and a dropped `.` to every slice holding a full stop,
the shipped text among them,
which the trace's own type says is empty since the page drops it.

The fix:
each slice's text on each side is read by `collectDestinations`,
the readers that found the drop,
and a slice carries an address when one of its destinations has the same `sameAddress` key.
Nothing is read when nothing was dropped.
The red run printed two [FAIL] cases in the new `traceDroppedDestinations` suite.

No real trace changed
(the fixing agent's measurement):
14 traces over the pinned corpus,
original against archive,
and 5 over 249 pages rebuilt from settled artifacts read the same under both rules.

Open when this entry was written,
closed in B217:
`DroppedDestinationError` still words its count as `destination(s)` and several slices as `slice 4, 7`;
the fix needs a line in the message inventory.

Recurrence:
`mistake-prevention.md`,
"Defaults that stand in for an input".

### B175: the site root keyed as the empty string

Red in `5df296c5f`,
fixed in `25c33df4f`.

Found on 2026-10-05 (UTC),
as an item ledger B139 left open.
`sameAddress` (`corpus-run/destination-renderings.ts`) shed a trailing slash from every address,
so `/` keyed as the empty string,
the key of a destination written with nothing in it.
`judgeDestinationRenderings` over a source linking `/` and a page carrying an empty destination dropped nothing.

The fix:
the slash is shed only where something remains,
so the site root keys as `/`.
The red run printed `expected { root: '', ... }` for the case
"KEYS the site root as itself,
so it never compares equal to the empty string".

No pinned page links the site root:
0 of 276 page files read `/` as a destination (the fixing agent's measurement).

Recurrence:
`mistake-prevention.md`,
"Defaults that stand in for an input".

### B176: the corroboration's two empty-group refusals had lost their words

Fixed in `6d60ce1a2`,
with no red case,
since no input reaches the throw.

Found on 2026-10-05 (UTC),
reading the MiMo trial's production diff once the trial was merged.
`corroborate` and `corroborateByOverlap` (`rendering-audit-corroborate.ts`) each read the first member of a group
behind a `RenderingAuditInvariantError` that named the group and why it cannot be empty,
and the trial's T8 change (`18f0b3a85`) replaced both with `nonNullishOrThrow(members.at(0,),)`,
whose whole message is `Expected non-nullish value, got undefined`.
No claim list reaches either:
`corroborate` opens every group with the claim it is keyed on,
and `corroborateByOverlap` grows every group from its seed.

The fix:
both throws are back with their class and their words,
and each function's TSDoc names the refusal.
No case drives them,
since no input builds an empty group;
`stretchReadingOf` reads both as invariant throws,
where it reads the `nonNullishOrThrow` line as cold (the fixing agent's probe).

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

### B177: the substitute break floor took lists of different lengths without a word

Fixed in `6d60ce1a2`,
with no red case,
since no input reaches the throw.

Found on 2026-10-05 (UTC),
reading the same diff.
`substituteBreakFindings` (`source-only-breaks.ts`) takes each side as two parallel lists,
block shapes and break counts,
and read a count at a block's index with `?? 0`,
which the trial's T8 change (`250da1333`) made `nonNullishOrThrow`.
The proof the trial gave holds for production:
`readSliceSkeleton` reads both lists off one parse's top-level blocks,
and `validateTranslatedSlice` is the one caller.
But the conversion refused only some broken inputs and named none.
On the file as it stood at `7f069adc9` (the fixing agent's run of it),
a break list one entry long on either side returned no finding,
a break list one entry short returned no finding where the uncounted block was of a kind the page holds,
and otherwise threw `Expected non-nullish value, got undefined`.

The fix:
the function refuses each side at its entry where the two lists differ in length,
with a throw whose message opens `unreachable:` and names the side.
No case drives it:
the function is not exported,
and 40,009 seeded texts through `readSliceSkeleton` gave no skeleton whose lists differ
(the fixing agent's measurement).
The 55 test files that reach the function through `validateTranslatedSlice` print no failure.

Open to the owner's veto:
the entry check itself,
where the trial's three reads alone already refuse every input production builds.

The same reading left the trial's other edits to these modules standing,
each on the fixing agent's evidence.
Five string reads in `preservation-tokens.ts`,
one in `retry-stated-wait.ts` and one split read in `rendering-audit-screen.ts`
are bounded by their own string's length:
60,016 texts through each reader threw nothing,
where a control read one past the end threw 7,594 times.
The branch removed from `benchRotation` (`stage-fanout-window.ts`) rests on `ChatMessage.content` being a string,
with no cast in production code.
The two OpenRouter extractions return what the inline code at `28303c42a` returned,
over 280 and 14 inputs.
The package index exports 28 more value names than at `28303c42a` and none fewer,
and no added name is imported by nothing.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone":
when a fallback becomes a refusal,
the inputs the fallback covered are refused at the function's entry,
in words.

### B178: trial cases on the audit and the OpenRouter client that could not fail, or ran on claims no screen builds

Changed in `96ef8323e`,
a commit of test files alone.

Found on 2026-10-05 (UTC)
by the first and fourth reviews of the trial's added cases
(the first review's findings 5 and 14,
the fourth's F14 and its notes on weak assertions and test seams).
In `rendering-audit-corroborate.unit.test.ts`,
one case paired an omission that spans the candidate with one that leaves it unused,
a pair `screenRenderingAudit` cannot hand on,
and named a guard no input can tell from its absence:
with the guard cut out of the built `intersects`,
every case of the file still passes.
Two cases read a length and a voice count where the whole result is knowable,
and the trial's six cases sat in one suite and repeated one claims literal five times.
In `rendering-audit-screen.unit.test.ts`,
a case reached `quotesRequired`'s invariant throw with a category cast past its type
and claimed to catch a category added to the vocabulary and forgotten in the rule,
which a made-up word cannot do.
In `openrouter-client.unit.test.ts`,
the case named for the deadline and `maxAnswerChars` asserted the answer alone,
and the `/credits` refusal was read by class and status.

The fix:
the impossible pair and the cast case are deleted.
`quotesRequired` keeps its export behind a case that asks it for every member of `RENDERING_AUDIT_CATEGORIES`
and asserts the whole table,
so a list added to the vocabulary without the rule fails there.
The corroboration cases assert whole results over one fixture anchored on the file's own texts,
each in the suite of the function it tests.
The knob case asserts,
for a call with both knobs and a call with neither,
the answer bound on the exchange and whether its signal is the caller's;
the refusal case asserts the class and the whole message.
Eleven mutants of the built package,
one per thing a case names,
each fail the case that names it (the fixing agent's runs).

Open to the owner's veto:
the both-unused overlap case pins the member order the build returns,
second voice first,
where `corroborate` keeps arrival order and nothing reads either.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail".

### B179: nothing asserted the endpoint and the cached tokens on a completed call's spend line

Changed in `96ef8323e`,
a commit of test files alone.

Found on 2026-10-05 (UTC),
checking the fourth review's note on `reportedSpendFieldsOf`.
The trial cut the three conditional spreads of `chatText` (`openrouter-client.ts`) into an exported helper and cased the helper,
on the reason,
recorded under T8,
that the cached field's only observable is a spend line `chatText` discards.
The line is logged by `reportSpend`,
and `client-log-context.unit.test.ts` already reads such lines off `console.info`.
With `chatText` handing the helper no endpoint,
or no cached count,
`openrouter-client.unit.test.ts` printed no failure;
only the cost was held,
by the meter cases.
The extraction itself changes nothing:
280 combinations of the three readings give the same fields as the inline code at `28303c42a`.

The fix:
a case reads the spend line a completed call writes for a stream reporting a cost,
an endpoint and cached prompt tokens,
and asserts it whole.
Each of the three mutants now fails it (the fixing agent's runs).
The helper and its case stay.

Recurrence:
`mistake-prevention.md`,
"Claims without their evidence":
"the only observable" is a claim to measure,
by looking for a test that already observes the thing.

### B180: two lookups logged their failure by class name alone, losing the HTTP status

Red in `e3c217fb0`,
fixed in `ab11a69d6`.

Found on 2026-10-05 (UTC),
as the item ledger B166 left open.
`WorkTitleLookupError` (`work-title-search.ts`) and `CitedReferenceFetchError` (`cited-reference-fetch.ts`)
forwarded a `message` that held the endpoint's body,
so they could not carry `messageNamesOnly`,
and `workTitleLookupLines` and `citedReferenceBlock` log `refusalText` of what they catch:
a 401 from the search endpoint and a 429 from the contents endpoint both logged `refused by` and the class name,
with no status.

The fix:
both classes take a `detail` phrase each throw site authors,
declare `messageNamesOnly`,
and build `search ${detail}` and `contents ${detail}`;
the non-2xx throw hands them `responded` and the status,
and no longer reads the response body or repeats the query or the url,
which the lookups' own log lines still name.
Both names joined `MARKED_CLASSES`;
`detail` and `String(status,)` were already named parts.
Each lookup's test file asserts the whole logged line for a refused answer with a prose body.

Open to the owner's veto:
the thrown message no longer carries the query or the url,
which only the lookups' own log lines now name.

Open when this entry was written,
closed in B220:
a `fetch` that rejects,
for a name that does not resolve or a connection reset,
still logs as `refused by TypeError`.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries":
a class that cannot be marked loses its status in every log line that goes through `refusalText`,
so a class a log line must explain is built from named parts.

### B181: the footnote graph read a marker shape in the URL of an angle autolink

Red in `e3c217fb0`,
fixed in `ab11a69d6`.

Found on 2026-10-05 (UTC),
as an item ledger B159 left open.
`<https://cat.example/[^9]x>` on a page the strict grammar refuses,
so `parseDocument` reads it under the plain grammar,
produced a gfm reference `9` and an `unresolved-reference` finding,
since the link's span starts at the `<`,
one character before its text,
and `isAutolinkLiteral` takes only a link whose first child starts with it.

The fix:
`isAngleAutolink` (`footnote-unpositioned-runs.ts`) takes a positioned link whose raw starts at `<`,
and the graph treats it as a tokenized literal:
full-width markers in its span are read,
a GFM shape in its URL is not,
and its children are not descended.
The marker reader (`activeFootnoteMarkers`) is strict-only,
and the strict grammar refuses every angle autolink,
so it never meets one and is unchanged
(the fixing agent's probes;
that the refusal is the strict parser's is its inference).
A link with a label is told apart by its `[`;
a case pins a marker in a label beside an angle autolink.

Open to the owner's veto:
the raw `<` as what tells an angle autolink,
where its child's span and its `url` were the other way.

Recurrence:
none new;
`mistake-prevention.md`,
"Structure read off the parse",
already names the rule that a walk says which node shapes it reads.

### B182: a footnote marker shape inside a link's URL counted as a mention

Red in `e3c217fb0`,
fixed in `ab11a69d6`.

Found on 2026-10-05 (UTC),
as an item ledger B159 left open.
`footnoteMentions` scanned raw text,
so `[^9]` in `https://cat.example/[^9]x`,
`[a](https://cat.example/[^9]x)` or `<https://cat.example/[^9]x>` counted as a reference to note 9.
`suspectsFor` (`assembly-integrity.ts`) compares counts of one scanner and was unaffected,
while `droppedMarkerFindings`,
`definitionLeakFindings`,
`definesIdentifier` and `labelsOf` read the mentions of an original alone,
so a candidate that dropped or rewrote the link was told to keep a marker the page never had.

The fix:
`urlSpansOf` (`footnote-url-spans.ts`) finds the spans of inline destinations,
angle autolinks and bare literals (`http://` or `https://` or `www.`) in one linear pass
that stops each scan at whitespace or `<`,
and `footnoteMentions` drops GFM hits inside them;
a full-width marker in a URL still counts,
as the graph counts it.
A marker in a link label or beside a URL still counts.
The scan stays lexical because the module reads fragments and does not parse them;
a marker in a code span or a reference definition's destination still counts and is not part of this finding.

Open when this entry was written,
closed in B212,
found by the lead's probes of the build of `ab11a69d6` against the footnote graph,
28 invented texts of which 5 differ.
The span reader begins a bare literal only after whitespace or one of four characters,
where the installed parser begins an `http` or `https` literal after any character that is no ASCII letter;
so a marker shape in a URL that follows a Han character,
a digit or a full stop is still counted.
Whitespace before an inline destination hides the destination from the reader.
A scheme followed by no domain character is read as a literal,
and so is a URL-shaped run inside a link label;
in both the parse reads the marker as a reference,
so the scan drops a mention the graph counts,
which is the direction the guards reading mentions cannot afford.
Whether any page at the corpus pin holds a marker shape inside a URL was not measured.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
a raw scan that feeds a guard names the contexts it skips,
and a context the graph skips is skipped here too.

### B183: an unreadable census baseline reached the command as the read's own error

Fixed in `ab11a69d6`,
its cases in the same commit,
since they call the reader the fix adds.

Found on 2026-10-05 (UTC)
by the agent that fixed B163,
under its other observations.
`runCoverageCensus` (`corpus-run/coverage-census.ts`) read each `--baseline` file with `readFile`,
so a path that is not there or is a directory raised Node's `ENOENT` or `EISDIR` error unchanged,
with no refusal that names the baseline.

The fix:
`readBaselineFile` (`corpus-run/coverage-census-input.ts`) reads the file and hands its text to `readBaselineCensus`,
and a failed read throws `CensusBaselineError` naming the path and the filesystem code (`it could not be read (ENOENT)`),
with the failure as `cause`;
`runCoverageCensus` calls it.
Cases read a missing path and a directory under a scratch folder;
before the fix the same reads raised `ENOENT` and `EISDIR` (the fixing agent's red run).

Open when this entry was written,
closed in B221:
`reportingRefusals` (`corpus-run/cli-refusal.ts`) still prints a `CensusBaselineError`
followed by the fault-in-the-command lines and a stack,
as it did for the not-JSON refusal of B163,
though a baseline named wrongly is the operator's mistake and no fault of the command.

Recurrence:
`mistake-prevention.md`,
"Files a later run reads back":
a command that reads a file the operator names refuses an unreadable one by name before it spends a suite.

### B184: a deterministic picture reader that rejected ended the entry

Red in `7f99edb6a`,
fixed in `17646f215`.

Found on 2026-10-05 (UTC)
by the agent that fixed B148,
reading the reading pair's contract.
`readImagePair` (`image-reading-pair.ts`) says every reader failure but an abort is contained,
and awaited `readOcr` with no `try`;
`readDocumentPictures` (`document-readings.ts`) awaited the pair with no `try`.
A deterministic reader that rejects,
for a scratch directory that cannot be made or a scratch device with no space,
ended the pair,
the picture stage and the entry,
for a reading nothing downstream requires.
The red run printed the reader's own error,
`Error: no space left on the scratch device`,
out of the pair and out of `readDocumentPictures`,
and an abort arriving while that reader ran came out as an `Error` where an `AbortError` was expected.

The fix:
`askDeterministicReader` (`image-ocr.ts`) answers a rejection with `unavailable` and the reason `ocr-failed`,
with a warning that names the picture,
so the models are asked as they are where the tools are not installed;
where the signal has aborted it rethrows first,
since a stop is not a failure to absorb.
`readDocumentPictures` is unchanged:
its `@throws` is true once the pair contains the rejection.

The whole suite ran on `17646f215` in a side checkout:
1,604 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 35 source scans passing.

Open to the owner's veto:
every rejection of that reader but an abort is contained,
a machine fault included,
where the other way rethrows an error carrying a system code such as `ENOSPC` or `EACCES`;
the fixing agent judged an entry lost to one full device worse than one picture read without its gate.
The helper lives in `image-ocr.ts`,
with a type-only import cycle to `image-reading-pair.ts`,
on the agent's reasons:
the pair's file passed its line cap with the helper in it,
and a module of its own would have needed a test file of its own.

Open:
the new warning logs the caught value with `String(error)`,
as the reader's own failure line in the same file does,
where the package's rule for a logged failure is `refusalText`.
A census of every place a caught value is turned into text whole was launched on 2026-10-05 (UTC)
and had not handed back when this was written.
It has since:
red in `afee9dcda`,
fixed in `4c26a48a0`,
and recorded as B232 to B237.

Recurrence:
`mistake-prevention.md`,
"Refusals inside a composed operation".

### B185: the picture sources defaulted to the corpus and the real programs

Fixed in `17646f215`,
with no red case:
the change makes a parameter required,
and the type check named the one call that left it out (the fixing agent's run).

Found on 2026-10-05 (UTC)
by the agent that replaced the `ocrTool` seam (ledger M113),
among the seams it saw and did not fix.
`readPassVisualEvidence` (`corpus-run/pass-visual-evidence.ts`) defaulted `pictureSources` to `RUN_PICTURE_SOURCES`,
and `readSeatedPictures` (`corpus-run/pass-seated-pictures.ts`) took it optionally,
so a test that left it out read pictures from the pinned corpus and ran the real programs.
One did:
the case of `corpus-run/pass-entry.unit.test.ts` that stops an entry on a picture with no reviewed evidence
reached `readCorpusBytes` against the pinned checkout for an invented entry,
and with a refusing stand-in handed in it ended `resumable-failure` where it had ended `stopped`
(the fixing agent's runs).

The fix:
`pictureSources` is required in `readPassVisualEvidence`,
`readSeatedPictures`,
`createPassPictureReader`,
`runEntryPipeline` and `settleEntry`,
as `outsideReads` is;
`RUN_PICTURE_SOURCES` is named once,
where `corpus-pass.ts` calls `settleEntry`.
Tests pass `NO_PICTURE_SOURCES` (`corpus-run/pass-picture-sources.test-fixture.ts`),
whose gatherer and reader reject with a message naming the seam,
and the case that stops an entry hands in a gatherer that finds no bytes,
which is what it is about.

Open to the owner's veto:
the seam runs through `settleEntry`,
which 31 lines of its test file now hand it,
where the other way folds it into `PassOutsideReads`.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B186: one reading floor was measured in two counts

Red in `7f99edb6a`,
fixed in `17646f215`.

Found on 2026-10-05 (UTC)
by the same agent's report.
`readingMakesSense` (`image-reading-sense.ts`) compared a model's trimmed reading,
in UTF-16 units with its inner whitespace counted,
against `MIN_READING_CHARS`,
while `solidCharacters` counted non-whitespace code points against the same constant for the deterministic reader.
Fifteen astral characters,
30 units,
and fifteen letters spaced apart,
22 or 29 units,
were `usable` as a model's reading and `no-text` as the deterministic reader's
(the fixing agent's probe of its build before the fix).

The fix:
the reading screen asks `solidCharacters` of the trimmed reading,
and `solidCharacters` lives beside the constant in `image-reading-sense.ts`,
exported from there by `translate-barrel.ts`.
The rule is stricter only:
a reading that was `usable` can become `short`,
and none goes the other way.

No cache version moved.
The agent's reading of the code,
with no run made:
the picture store and every slice cache are stamped with the digest of the built files,
which this change alters,
so no reading stored under the old count is resumed.

Open to the owner's veto:
the count moved to the constant's file,
where the other way keeps it in `image-ocr.ts` behind a value import cycle.

Open when this entry was written,
closed in B252 (`df807a8b5`):
`image-reading-stage.ts` still logs a reading's length in UTF-16 units,
a number that can read larger than the count the verdict used.

Recurrence:
`mistake-prevention.md`,
"Text by code point".

### B187: the consolidate store resumed a choice, two flags and a mark the stage never writes

Red in `7f99edb6a`,
fixed in `17646f215`.

Found on 2026-10-05 (UTC),
as the couplings ledger B151 left listed.
`isConsolidationSettlement` (`corpus-run/consolidate-cache-store.ts`) checked a stored gate's `choice` against nothing,
though the stage settles it from the stored ballots with `settleGateBallots`
and `shipPastForfeitStanding` rewrites only `ships`.
It resumed `demoted` beside any terminal,
where every writer sets it on `wrap-erased-difference` alone;
`rewrapped` beside a terminal that never wraps;
and a settlement marked `archiveKept`,
which `consolidationWorthResuming` never persists
(each the fixing agent's reading of the writers).

The fix:
the store refuses each of the four.
The table of terminals carries the `demoted` flag each one writes and whether it may rewrap,
`wrapFlagsFitTerminal` reads them,
and a stored `choice` must be what `settleGateBallots` gives for the stored ballots.
A control case keeps a choice that differs from what ships resumable,
since a forfeit standing ships the consolidation over a `standing` or `neither` choice.

Not refused,
on the fixing agent's reasons:
`choice` against `ships`,
which is no coupling;
the presence of `decided`,
which the guard documents as unchecked;
and the floor against the terminal,
or its valid models against the verdicts,
which change neither what ships nor what the artifact says of the gate
and were not proved against every writer.

Open to the owner's veto:
the four refusals themselves,
of which the `rewrapped` and `archiveKept` ones carry the least.

Open when this entry was written,
closed in B249 (`df807a8b5`),
which also drives settlements of the real stage through the store and back:
a gate whose `usable` count is short of `CONSOLIDATE_GATE_QUORUM` is still resumed,
though the stage never persists one,
since the store's own comment documents a gate that heard nobody as valid
and the agent did not trace which cases rest on it.
No settlement written by the real stage was driven through the new rules end to end:
they rest on a reading of the writers and on unit round trips.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail".

### B188: two reading-cache cases refused their records for a reason they did not name

Changed in `7f99edb6a`,
a commit of test files alone.

Found on 2026-10-05 (UTC)
by the agent that fixed B149 to B153.
Two cases of `corpus-run/reading-cache-store.unit.test.ts`,
older than the trial,
built an unavailable record without `transient: false`,
so the closing check of `isPairedReading` refused each whatever field it named,
and each stayed green with its own guard removed.

The fix:
each record has one cause,
the reason `reader-failed` or readings that are strings,
and each case also resumes the same record with that field valid.
With the reason guard removed the first case fails,
and with the readings guard removed the second does
(the fixing agent's runs,
the source restored each time).

The module TSDoc of `corpus-run/coverage-control-vote-change.unit.test.ts` said one scripted answer served every round,
where the file holds three scripted clients:
the blind client,
the sheet-reading client with its two conditions,
and the denying client.
It says so now;
nothing else in that file changed.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail".
