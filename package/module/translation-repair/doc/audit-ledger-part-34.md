# Audit ledger, part 34

Part 34 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B189: quotes and spans that show a reader nothing were anchored

Red in `806039cb1`,
fixed in `2b789a4ae`.

Found on 2026-10-05 (UTC)
by a census of every blankness test in the package's production source,
after B128.
The fixing agent read the 25 wire modules field by field,
swept the source for the comparisons,
and ran a syntax-tree pass that found 397 tests of blankness at its base.
It fixed 20 sites,
recorded here and in B190 to B194,
and held the rest,
each with why its question is another one (B195).
Each fixed site tested a text a model wrote by a comparison with the empty string,
a trimmed comparison or a length,
where the package's one question is `rendersAsNothing`.

`locateQuote` (`locate-quote.ts`) refused a quote only when it was the empty string,
so a critic's quote of one ideographic space anchored on the one such space a source held.
`anchorLocatedSpan` (`rendering-audit-anchor.ts`) compared the canonical locator and focus with the empty string,
so a focus of one space anchored inside its locator.
`readSide` (`rendering-audit-screen.ts`) decided again whether a side quoted anything,
by the same comparison on the raw text,
so an omission whose unused candidate side held `U+200B` was dropped as `forbidden-side-quote (candidate)`.
`quoteIsIn`,
`mergedAttestations` and `attestedDetailsOverlapping` (`reference-attest-match.ts`)
searched for a quote without asking whether it showed anything,
so an item quoting `U+200B` on both sides verified against texts holding that character.

The fix:
each asks `rendersAsNothing` of the text the model sent.
Every case of this entry and of B190 to B194 hands its field spaces,
`U+200B` and `U+3164`,
written as escapes,
and asserts the whole result an empty field gets.
The red run printed a failure for each of 27 cases in 23 files.

The whole suite ran on `2b789a4ae` in a side checkout:
1,605 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 36 source scans passing.

No cache version moved,
for this entry or for B190 to B194.
The cache account audit of 2026-10-05 (UTC) found 13,714 slice-cache records,
the newest written 2026-09-27T04:26Z,
with every cache version set since then,
so no stored record exists under a current version.
Whether any stored reply ever carried such text was not measured.

Open to the owner's veto:
padding on a rendering-audit claim's unused side is read as empty and the claim kept,
where the other way goes on dropping the claim.

Recurrence:
`mistake-prevention.md`,
"Text that shows nothing";
`readSide` beside the anchor is also a second reader of one emptiness,
under "Two layers reading one refusal".

### B190: a reading, a finding, a title, a category and a replacement that show nothing counted as said

Red in `806039cb1`,
fixed in `2b789a4ae`.

Found on 2026-10-05 (UTC) by the same census.
`readingMakesSense` (`image-reading-sense.ts`) asked whether a picture reading was blank only through its length floor,
so sixteen Hangul fillers,
or forty zero-width spaces,
read `usable`.
The naturalness review's wire guard (`absolute-naturalness-review-wire.ts`) took a `problem` of `U+200B` as a finding.
`mostGiven` (`page-title-lexicon-stage.ts`) counted a seat's rendering of `U+200B` as a voice,
so two such seats outvoted one seat rendering the title in words.
`repair-damage-evidence.ts` named a prober's category of `U+3164` as itself,
where an empty one is named `unspecified`,
and `repair-sheet.ts` showed an editor's replacement of `U+200B` as text,
where an empty one is said to be a deletion.

The fix:
each asks `rendersAsNothing`.
The reading is refused `too-short` before its characters are counted.
That file was merged by hand,
since B186 had changed the same lines after the agent's base:
the screen asks whether the reading shows anything and then asks `solidCharacters`.

Open to the owner's veto:
a long reading of invisible characters is refused under the existing `too-short` clause,
where the other way gives it a clause of its own;
and the repair sheet says a replacement that shows nothing was a deletion.

Recurrence:
`mistake-prevention.md`,
"Text that shows nothing".

### B191: an archive block revision that shows nothing shipped as wording

Red in `806039cb1`,
fixed in `2b789a4ae`.

Found on 2026-10-05 (UTC) by the same census.
The archive block review's `replacementText` spells a removal as the empty string.
`runArchiveBlockReviewStage` (`archive-block-review-stage.ts`) never asked whether a revision showed anything,
and `revisionShapeFindings` (`archive-revision-shape.ts`) asked only whether it was empty,
so a revision of `U+200B` or `U+3164` passed the shape floor and reached the selectors as revised text,
while one of three spaces was withheld as holding no block
(the fixing agent's probe).

The fix:
the stage reads a revision that shows a reader nothing as the empty removal,
once,
and every later reader
(`archive-replacement-candidates.ts`,
`corpus-run/archive-block-repair.ts`,
`archive-block-selection-evidence.ts`)
reads what was decided.
The shape floor throws `unreachable:` on a revision that is blank and not empty.
One assertion went with it:
that a revision of three spaces is withheld,
which `f9babaec4` had pinned as the behaviour it found.

Open to the owner's veto:
a revision that shows nothing is the removal an empty one spells,
where the other way withholds it as the shape floor withheld three spaces.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal":
the blankness scan holds the three raw readers,
each on the reason that it reads the decided value.

### B192: transport fields that show nothing counted as present

Red in `806039cb1`,
fixed in `2b789a4ae`.

Found on 2026-10-05 (UTC) by the same census.
`extractAnthropicCompletion` (`anthropic-completion.ts`) returned tool arguments of spaces and `U+200B`
in place of the prose answer beside them.
`extractStreamedCompletion` (`stream-completion.ts`) kept a refusal channel of `U+3164` as a refusal,
and `readJsonOutcome` (`chat-json-outcome.ts`) chose the raw text by whether the reply's text was the empty string,
two readers of one emptiness.

The fix:
all three ask `rendersAsNothing`.
A voice formerly lost to such a reply is heard now,
which no cache key reads.

Open to the owner's veto:
a refusal channel or tool arguments that show nothing count as absent.

Recurrence:
`mistake-prevention.md`,
"Text that shows nothing".

### B193: pieces of a candidate or a record that show nothing read as worded

Red in `806039cb1`,
fixed in `2b789a4ae`.

Found on 2026-10-05 (UTC) by the same census.
`isWorded` (`translate-unwrapped-link.ts`) took a link whose words were `U+200B` as worded.
`fencedLabel` (`translate-sheet-leak.ts`) took `U+3164` between two fence runs as a label.
`composeInsertion` (`insertion-separator.ts`) opened a paragraph for a fragment of `U+200B`.
`assertWordingCoherent` (`wording-coherence.ts`) passed a decided text of `U+200B`
at a place the archive never translated,
though `assertAbsentSliceFilled` refuses it where the record is built.
The coverage control (`corpus-run/coverage-control.ts`) compared a roster's spans,
and the text its cut left,
with the empty string,
and asked a second round about a page the cut had left as one line break.

The fix:
each asks `rendersAsNothing`,
the coverage control at all three of its tests.

Two of these are floors of cached stages:
the link floor refuses more and the fence floor accepts more,
for a candidate carrying invisible-only text in that one place.
No version moved,
on the audit named in B189.

Open to the owner's veto:
`assertWordingCoherent` refuses a record of an older build
that holds an invisible decided text at a place the archive never translated,
where it passed one.

Recurrence:
`mistake-prevention.md`,
"Text that shows nothing".

### B194: the page assembly took invisible text for a rendering

Red in `806039cb1`,
fixed in `2b789a4ae`.

Found on 2026-10-05 (UTC) by the same census,
on its second reading.
The page text of a slice is the replacement a lane wrote where there is one,
and the archive's own text otherwise (`corpus-run/assembly-page-text.ts`),
so the assembly passes read model wording;
the census first classed page text as parsed text and missed them.
`renderedHeadings` (`corpus-run/title-reference-unify.ts`) took a heading of `U+200B` or `U+3164`
as the title's English,
and every reference to the title was rewritten to that character,
with a `title-reference-unified` finding.
`nameAuthorities` (`corpus-run/contributor-name-authorities.ts`) took a signature of the same
as the signer's rendering,
and the restore wrote it over the name in the heading naming the signer.
`appearancesIn` (`corpus-run/handle-gloss-place.ts`) took a parenthesis holding a space or `U+200B` as a gloss.

The fix:
each asks `rendersAsNothing`.
A signer whose page rendering shows nothing falls to the pinyin reading,
which the restore writes into the heading and the signature.

Open to the owner's veto:
`readSignature` (`corpus-run/attribution-line.ts`) still reads a name span of invisible characters as a signature,
so the restore has a place to write the signer;
read as unsigned,
the line would stay nameless.

Open when this entry was written,
closed in B260 (`68df23b05`),
seen by the agent and outside this family:
a candidate that signs with an invisible name passes the signer floor (`translate-signer-handle.ts`),
which the restore now repairs at assembly;
invisible characters count toward the four code points `archive-block-evidence.ts` asks of a source quote;
and `nameAuthorities` takes the archive's signature name with no blank test,
which is parsed text and was left.

Recurrence:
`mistake-prevention.md`,
"Text that shows nothing":
a census that classes a text as parsed first reads where the text comes from.

### B195: no scan held the rule that blankness is asked of `rendersAsNothing`

Added in `2b789a4ae`.

Found on 2026-10-05 (UTC) by the same census:
"Text that shows nothing" rested on habit and review,
which let B128 and the twenty sites of B189 to B194 through.

`src/blank-text-tests.unit.test.ts`,
which `source-scans` runs,
reads every production file's syntax tree for a comparison with the empty string,
written as a string or an empty template,
either way round;
the length of a trimmed text,
or of a name its function declares from one,
compared with anything;
the length of a name annotated as a string compared with zero or asked whether it is less than one;
and any of those tested for truth.
Sites are keyed by file and nearest enclosing named function or class,
with a count,
and compared whole against a held list,
so a new function,
a second test in a listed function
and a stale entry each fail;
every held key carries why its question is another one.
The list held 297 keys at the agent's base and 298 at `2b789a4ae`,
where the lead corrected it for code that had landed since.

That it can fail
(the fixing agent's runs):
on a scratch copy seeded three ways it named each seed,
and on the source without the fixes it named 17 of the 20 fixed sites.
The three it did not name:
the reading's length floor,
where the fix puts a question ahead of a comparison that stays;
the review stage,
which never asked;
and the gloss reader,
where an offset comparison stood for an empty span.
Out of its reach,
as its module doc says:
the length or truth of a string no annotation names,
a constant holding the empty string,
a blank needle handed to a search,
a length floor on text that was never trimmed,
and a trimming helper whose result another function compares.

Open when this entry was written,
closed in B261 (`68df23b05`):
one held key is a known gap,
`introduced-defect-screen.ts#isUsable`,
which keeps a prior quote of one invisible character;
the file was another change's,
and fixing it removes the key.

Open to the owner's veto:
the scan is broad,
with a long held list,
where a narrower one would hold fewer keys and see less.

Recurrence:
`mistake-prevention.md`,
"Text that shows nothing",
whose enforcement paragraph names the scan.

### B196: the slice census stopped on a recorded pairing its text did not fit

Red in `6f61ba5dd`,
fixed in `72f5be638`.

Found on 2026-10-05 (UTC),
as the item ledger B170 left open.
`censusEntry` (`corpus-run/slice-census-entry.ts`) converted a settled recipe's block pairings itself
and caught nothing,
so an artifact recording a pairing that names a translation block past its section
ended the census with `BlockPairingError: pairing names translation block 5, and there are 4`,
where `rebuildPreparation` answers the same artifact as `moved`.

The fix:
`censusEntry` measures through `measureCarve`,
which catches the refusal through `requireBlockPairingRefusal`,
warns,
and measures every section by the deterministic aligner,
as the rebuild carves the same artifact.
The row reads `carve: 'settled-moved'`,
its `pairingRefusal` holds the sentence the rebuild gives,
and the `CENSUS carve:` line of `corpus-run/slice-census.ts` counts such rows.
The blankness scan holds one more key,
for the empty `pairingRefusal` a row carries when nothing was refused.

The whole suite ran on `72f5be638` in a side checkout:
1,605 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 36 source scans passing.
No cache version moved,
for this entry or for B197 to B202,
on the audit named in B189.

Open to the owner's veto:
every section's pairing is set aside once one is refused,
as the rebuild does;
and the row keeps `carve` as one word beside a separate `pairingRefusal`,
two fields that must agree,
where the other way makes the carve an object carrying its refusal.

Open when this entry was written,
closed in `df807a8b5`,
as B253 notes:
the sentence is worded in two places,
here and in `rebuildPreparation`,
until one shares it with the other.

Recurrence:
`mistake-prevention.md`,
"Refusals inside a composed operation".

### B197: a settled census row counted its added blocks by another carve than the one that sliced it

Red in `6f61ba5dd`,
fixed in `72f5be638`.

Found on 2026-10-05 (UTC),
as two items ledger M113 left open.
`censusEntry` counted translation-only blocks with `alignBlocks` even under a settled recipe,
so a settled row was sliced by the recorded pairing and counted by the deterministic aligner.
A fixture whose pairing declines the last translation block sliced it out,
84 characters against a baseline of 125,
and counted no such block.
The same column read 39 for an added paragraph of 44 characters and for one of 227.

M113 recorded a cause for that reading off the source:
that `estimateExpansion` divides a section's whole translation by its whole original,
so an added block raises the length expected of every rendering.
Measured by the fixing agent,
the cause holds in part.
In a section of five blocks,
forcing the clean expansion changes which block is left over for an addition of 213 characters
and not for one of 42,
which is a near tie in length between neighbouring blocks;
in a section of one original block the column reads the original's own rendering,
39 characters,
whatever was added.

The fix:
the count reads the steps that sliced the section,
`blockPairingToSteps` where the recipe holds a pairing for it and `alignBlocks` otherwise,
and a block a pairing renders for an original is not counted.
Under a recorded pairing the column reads 44 and 227;
a deterministic row still reads the aligner's leftover.

Open to the owner's veto:
`estimateExpansion` and the aligner are unchanged.
Estimating the expansion from the whole entry recovered an invented added block more often when it was long
and less often when it was short
(the fixing agent's probe over 145 sections of the pin,
1,434 insertions at each size:
1,279 recovered against 1,190 at 213 characters,
and 1,231 against 1,265 at 42),
and it would move alignments on every page.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
a figure describing a carve is read off the steps that made the carve.

### B198: a rendering that holds a colon was written twice into its heading

Red in `6f61ba5dd`,
fixed in `72f5be638`.

Found on 2026-10-05 (UTC),
as an item ledger M113 left open.
`restoreHeading` (`corpus-run/contributor-name-restore.ts`) cut the page title at its last colon to find the prefix,
so `### Three: Mao: Cat` with the rendering `Mao: Cat` read `Three: Mao:` as the prefix and `Cat` as the name,
and wrote `### Three: Mao: Mao: Cat` with a restore reported.

The fix:
the prefix ends at the page title's first colon,
as `titleNames` reads the original,
whose prefix holds no colon while its name may.
`lastColonAt` (`corpus-run/assembly-page-text.ts`) had no reader left and is gone.
`restoreSignature` reads its name by offsets and has no such shape;
the case holds a signature as its control.

No page changes
(the fixing agent's count over the pin):
none of 251 original headings and none of 251 archive headings holds more than one colon,
and none of 24 signature names holds any.

Open to the owner's veto:
a page prefix that itself holds a colon is read as part of the name,
where the other way takes any colon whose suffix already carries the rendering.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text":
a cut at a delimiter is a first or a last match on a key nothing makes unique.

### B199: an artifact whose contest never ran read as nothing to report

Red in `6f61ba5dd`,
fixed in `72f5be638`.

Found on 2026-10-05 (UTC),
as an item ledger M113 left open.
`finalSelectionFindings` (`corpus-run/final-selection-completeness.ts`) read a lane selection that was not `contested`
as an empty list of contests.
No production input reaches that arm:
`pass-entry-persist.ts` holds the function's one caller,
`settledEntryArtifact` writes the kind as a literal,
and `assertFinalNaturalnessComplete` already refuses the same state out loud (ledger B168).

The fix:
the arm throws,
its message opening `unreachable:` and naming the kind found and the writer that records it as contested.
The case that asserted the empty list asserts the whole message.

Open when this entry was written,
closed in B250 (`df807a8b5`):
the sibling arm of the same function,
for a consolidation that never ran,
has the same shape and was left,
since every fixture default of its test file builds that state.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

### B200: a parsed list item without offsets dropped its whole list without a word

Fixed in `72f5be638`,
its case in the same commit,
since it calls the reader the fix adds.

Found on 2026-10-05 (UTC),
as an item ledger M113 left open.
`readLists` (`corpus-run/list-spread-restore.ts`) returned no list at all when one item carried no start or end offset,
which would move every later list's position in the slice.
The installed parser sets a position on every node it builds
(`mdast-util-from-markdown` 2.0.3,
`enter` and `exit` in its `lib/index.js`),
and none of 54 list items on the 184 pinned pages,
nor of 31 on 13 invented lists,
lacked one
(the fixing agent's reading and counts).

The fix:
`listItemExtent` reads an item's offsets and throws `unreachable:` for an item with none;
it is exported through the barrel so that its case can hand it an item built without a position.
No input reached the old arm,
so the case had no red run on it:
on the tree of `6f61ba5dd` it failed on the missing export.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

### B201: a reference link in a contributor form read as markup where the text defines it

Red in `6f61ba5dd`,
fixed in `72f5be638`.

Found on 2026-10-05 (UTC)
by the agent that fixed B154,
among what it left.
`contributorForm` (`contributor-name-authority.ts`) read `[Whisker][w]` as the whole markup,
whether or not the text defined `w`.
Only the parse tells:
a reference shows as a link where the document defines it,
and as literal text where it does not.

The fix:
`archiveContributorNameForms` parses its text once when it holds `[`
and reads each reference link,
full,
collapsed or shortcut,
as the label it shows;
a reference with no definition keeps its markup,
which is what the page shows.

The fixing agent's version read the label by arithmetic:
it counted back from the end of the markup by the length the parser reports for the reference's own label.
That length is of the decoded label,
not of what is written,
so a reference label holding an escape or an entity moved the cut.
The lead's probe of the agent's build read `Whisker]` out of `[Whisker][a\]b]` and out of `[Whisker][w\*x]`,
and `Whisker][w&` out of `[Whisker][w&amp;x]`
(`merge-w35/probe-reference-label.mjs` in the audit's scratch folder,
with a log for each build).
The label is read off the parse now:
it ends where the link text's last inline node ends,
and a node with no end offset throws `unreachable:`.
The lead's red case holds the three shapes.

No form changes at the pin
(the fixing agent's count):
the 92 archive pages hold no reference link.

Open to the owner's veto:
a text the parser cannot take,
nested past its stack,
is read as defining no reference,
with a debug line;
and the lead's replacement of the agent's label arithmetic.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
an offset inside a node is read off its children,
never worked out from the length of a decoded value.

### B202: a request the provider refused in a stream's error event was retried

Red in `6f61ba5dd`,
fixed in `72f5be638`.

Found on 2026-10-05 (UTC),
as the item ledger B87 left open.
An Anthropic stream's error event naming a type the provider documents for a refused request
was refused as a `MalformedCompletionError` and retried on the ladder,
spending every attempt on a request the provider refuses again,
where the same refusal over plain HTTP is returned unretried,
400 being no retryable status.
A scripted 200 stream carrying an `invalid_request_error` event drew 3 transport calls where 1 was expected.

The fix:
`requireWholeAnthropicMessage` (`anthropic-whole-message.ts`) throws `StreamErrorEventError`,
a marked `SyntheticHttpError` that carries the status the refusal has over plain HTTP and names the type alone,
with nothing of the provider's body;
`attemptExchange` (`transient-retry.ts`) rethrows a thrown `SyntheticHttpError` whose status is not retryable.
The types read as refused,
by the provider's errors page as the fixing agent read it:
`invalid_request_error` (400),
`authentication_error` (401),
`billing_error` (402),
`permission_error` (403),
`not_found_error` (404)
and `request_too_large` (413).
A `billing_error` so carries 402,
which the provider-budget branches read as they read the plain one.
Retried as before:
`rate_limit_error`,
`api_error`,
`timeout_error`,
`overloaded_error`,
a type the package does not know
and an event that names none.
The class joined the inventory of marked classes,
its `errorType` a named part from a closed list this package holds.

Not read by the agent:
the provider's page on streaming,
whose section on error events it could not open in its session;
the frame's shape rests on the errors page,
on ledger B87 and on the cases the file already held.

Open to the owner's veto:
`conflict_error` (409) stays retried,
since its documentation says to resolve the conflict and then retry.

Open when this entry was written,
closed in B251 (`df807a8b5`):
`InStreamProviderError` (`openrouter-stream-error.ts`) carrying a 4xx code still rides the ladder,
and the Bedrock reader names no error event in its stream end.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal":
a refusal means the same on the ladder whichever channel it arrived by.

### B203: a title a voice answers twice was read by its first rendering without a word

Red in `49e3b8dfd`,
fixed in `21f2ec369`.

Found on 2026-10-05 (UTC)
by a census of every lookup in the package's production source that takes the first match of a key,
after B129.
The fixing agent read 403 lines of `find`,
`findIndex`,
`findLast`,
`indexOf`,
`new Map(` and `Object.fromEntries(` calls in 238 files,
each with its function,
and two shapes that pattern misses:
maps built from typed pairs,
8 of 142 typed constructions,
and maps filled by `set` in a loop,
161 sites in 111 files,
read once with no note kept for each.
By its decisions,
9 of the 403 lines were fixed,
117 stand with what makes each key unique,
11 are described and left,
15 sit in files that were another change's,
and 251 ask another question
(a scan of a string,
a membership test,
an ordered preference,
a merge of equal values).
The defects are this entry and B204 to B210,
two of them found in the shapes the pattern misses.
Out of the census's reach:
a first match written as a loop with an early return,
a record built by computed-key assignment or by spreading inside a fold,
and test files.

`settlePageTitles` (`page-title-lexicon-stage.ts`) searched each voice's reply
for the first entry numbered for a title.
`isPageTitleLexiconWire` admits any list of numbered renderings,
so nothing makes a number unique in a reply:
a voice answering one title twice had its second rendering passed over,
and a number the sheet never listed was passed over the same way,
neither with a finding.

The fix:
`resolvePageTitleAnswers` (`page-title-lexicon-wire.ts`) reads a reply once,
keeps the first rendering for each title,
and returns `duplicate-title-rendering` and `title-index-out-of-range` findings,
which the stage reports under the voice's model id,
as `resolvePanelBallot` does for a panel ballot.
No settled title changes:
the first entry for a listed number is the one the search always took.

The whole suite ran on `21f2ec369` in a side checkout:
1,606 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 36 source scans passing.
No cache version moved,
for this entry or for B204 to B210:
no stored record exists under a current version (the audit named in B189),
and by the agent's measurements no decision moves at the pin.

Open to the owner's veto:
a voice's first rendering is kept and a finding written,
where the other way drops the voice or the title;
and the `title-index-out-of-range` finding,
one step past the family,
which fell out of the same loop.

Open,
described by the agent and left,
each a first match on a key nothing makes unique.
Two follow-ups were launched on 2026-10-05 (UTC).
One took the title link,
the pair bound and the revision's block,
the sites a page pass or a floor reads:
red in `51f6dd875`,
fixed in `65bd3a645`,
and recorded since as B228 to B230,
so the first three sites of this list are closed.
The other took the readers after them in this list
and had not handed back when this was written.
It has since:
red in `d00bc71b4`,
fixed in `8ce45ae86`,
and recorded as B238 to B245,
so every site of this list is closed:

- `corpus-run/title-reference-link.ts`:
  a title linked twice in one slice has its second link's rendering never located,
  so the pass leaves that link as written;
- `bilingual-pair-bound.ts`:
  the bound compares the blocks around the first line carrying a pair's wording,
  so a refrain's second block is never compared;
- `archive-revision-footnotes.ts`:
  a block is located by the first place its text stands on the page;
- `panel-stage.ts`:
  ballots are keyed by model id against a roster nothing holds distinct for the panel,
  the critics or the page title bench,
  as it is held for editors and checkers;
- `corpus-run/artifact-two-lane-read-naturalness-confirmation.ts`:
  a stored confirmation is bound to the first decisive round carrying its candidate;
- `corpus-run/probe-relabel-artifact.ts`:
  tallies are keyed by envelope id from a stored record the reader does not check;
- `corpus-run/probe-relabel-case.ts` and `corpus-run/probe-relabel-control.ts`:
  the first slice carrying a region's replaced text is taken;
- `corpus-run/window-trial-report.ts`:
  a later ledger row for an arm replaces an older one;
- `corpus-run/rendering-audit-settled-repeat.ts`:
  a second run's rows are keyed by subject from a file the reader casts and does not check;
- `grade-agreement.ts`,
  in a file that was another change's:
  a pre-grade file naming one position twice and carrying one row too many passes both checks,
  and the later verdict for that position is scored;
- `introduced-defect-screen.ts`,
  likewise:
  a prober answering one region twice with two verdicts is counted by the first,
  with no finding.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B204: every link to an href was given the archive's last text for it

Red in `49e3b8dfd`,
fixed in `21f2ec369`.

Found on 2026-10-05 (UTC) by the same census,
reading the maps built from typed pairs.
`linkedTextPairs` (`page-name-glossary.ts`) keyed the archive's link texts by href,
and a map built from pairs keeps the last pair for a key.
An href names no one link:
a page can link one destination under a name in one sentence and under other words in another,
and every link of the original to that href then read the archive's last text for it as its rendering.

The fix:
`renderedLinks` (`page-name-link-rendering.ts`,
a module of its own with its own test file,
since the glossary file was near its line cap)
gives a link the archive's one text for its href where there is one,
the archive's link at the same place where both documents link the href equally often,
and no pairing where the counts differ,
the rule ledger B59 gave `corpus-run/title-reference-link.ts`.
A mutant putting the last text back failed the new module's place case and its count case
(the fixing agent's run).

No page changes
(the fixing agent's measurements at the pin):
none of 92 archive pages links one href under more than one text,
and the builds before and after the fix write the same 395 glossary lines over the 92 pairs.
A pin that adds such a page could move a cached decision.

Open to the owner's veto:
a link whose rendering cannot be read gets no glossary line,
and its title is left to the page title lexicon,
where the other way keeps the first or the last text.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B205: a claim's proposers were taken from the last chunk that names it

Red in `49e3b8dfd`,
fixed in `21f2ec369`.

Found on 2026-10-05 (UTC) by the same census,
reading the maps filled by `set` in a loop.
`buildCrosscheckCensus` (`corpus-run/judge-crosscheck.ts`) set a claim's proposers
at each chunk of an entry's slice critics,
so where two chunks carry one claim id the last chunk's list replaced the others,
and an author from another chunk could be seated as a judge of its own claim.
`indexProposers` (`corpus-run/attribution-report.ts`) merges such chunks,
and its comment says why.

The fix:
the proposers are merged across chunks,
each model once,
in the order first met.

Whether two chunks can carry one claim id was not proved:
the fix rests on that comment and on being harmless,
and over 226 stored artifact files holding 21,572 attributions
no claim id stands in more than one chunk of an entry
(the fixing agent's measurement,
with a control it had to flag).

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".
