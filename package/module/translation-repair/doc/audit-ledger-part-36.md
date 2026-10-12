# Audit ledger, part 36

Part 36 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B219: the grouping dropped a translation block ahead of a sealing note without a word

Fixed in `843bd6ce0`,
with its cases,
which name a class the fix adds;
the fixing agent's red run failed both.

Found on 2026-10-05 (UTC),
as the item ledger B172 left open.
A translation block that stands ahead of the archive's note,
with no paired run before it,
has no run to join:
nothing folds into a sealed run,
and every block after the note is sealed with it.
`mergeOneSidedRuns` (`group-merge.ts`) returned its runs without the block and said nothing.
B172 had six shapes that did not reach the state through `prepareDocumentPair`.
The fixing agent's seeded generator did:
of 3,000 sections reaching the merge,
1,446 of them sealed,
115 lost a block this way,
77 under the scorer's walk and 38 under a supplied one,
and two more seeds gave 182 of 4,462 and 176 of 4,493.
`prepareDocumentPair` refused every such page,
a layer up,
as a block that reached no slice,
so none shipped;
a caller of `groupNodesSealed` alone was handed the runs.

The fix:
where a sealed run stands and translation blocks are still held,
`mergeOneSidedRuns` throws `UnplacedTranslationBlocksError`,
naming the blocks by their positional ids.
The agent's first version threw a plain `Error`.
The lead sent it back:
a log line through `refusalText` would have read `refused by Error`,
where the coverage refusal it pre-empts is marked and prints its sentence.
The class is marked,
its message a count word,
the ids and sentences written in the module,
and the message inventory names the class and its parts.
`mergeOneSidedRuns`,
`groupNodesSealed` and `prepareDocumentPair` each say so in a `@throws`.
After the fix the first seed's 115 sections are refused in the merge and none is dropped,
by the agent's run.

Cases in `group-aligned.unit.test.ts` hold the refusal from the grouping and through `prepareDocumentPair`,
each by its class,
its whole text and the line `refusalText` gives,
beside a control page whose greeting has an original of its own.

Measured by the lead with the package's slice census on `cf50117c5`,
before this fix:
92 complete pairs and 1,259 slices over the pinned corpus,
and no page refused.
So no page of the corpus reaches the refusal under the deterministic aligner;
a roster's pairing still can,
as the supplied walks of the probe did.

Open to the owner's veto,
and open:
the page is refused,
where the other way carries the block with the archive's bytes untouched so that the entry proceeds.
A follow-up was launched for that and had not handed back when this was written.
It has since:
B247 (`df807a8b5`) carries such a block as the archive has it,
and removes the refusal class this entry added.
Seen by the agent and not looked into:
two generated inputs of the second seed ended in `PlacementLayoutError`,
from supplied pairings that repeat a pair.

Recurrence:
`mistake-prevention.md`,
"Refusals inside a composed operation":
a step that cannot place something refuses it there,
by name,
in a class a log line may print.

### B220: a request the transport rejected left the lookups as the transport's own error

Red in `63567b4f5`,
fixed in `843bd6ce0`.

Found on 2026-10-05 (UTC),
as the item ledger B180 left open.
`searchWorkTitle` (`work-title-search.ts`) and `fetchCitedReference` (`cited-reference-fetch.ts`) awaited `fetch` bare.
A rejection passed on as the runtime's `TypeError`,
which is unmarked,
so the lookups' log lines read `refused by TypeError`,
naming neither the endpoint nor what failed.

The fixing agent's probe of the runtime,
on local addresses and an invented header value:
a name that does not resolve rejects with a cause carrying a system code;
a refused connection rejects with a cause carrying none;
and a header value holding a line break rejects with no cause and a message that quotes the value.
So a system code cannot tell a network failure from a request the transport will not send,
and the rejection's message cannot be repeated,
since the header is the key.

The fix:
a rejection before any answer is rethrown as the lookup's own marked class,
`WorkTitleLookupError` or `CitedReferenceFetchError`,
with the rejection as its cause and never in its message.
The detail names the endpoint and says the request failed before any answer came back:
either the network could not be reached,
or the transport refused to send the request,
as it does for a key or header holding a line break;
and it says to check the connection and the key.
The agent's first wording said the network had failed,
which is untrue of the second case,
and the lead sent it back.
A connection that fails while the body is read says the network was lost while the endpoint was answering.
The caller's abort passes on as it came,
and so does a body that is not JSON,
whose parser message quotes the text it refused (ledger B166).

Cases in `work-title-lookup.unit.test.ts` and `cited-reference-fetch.unit.test.ts`:
the rejecting transport,
the header value holding a line break,
the body cut while it is read,
and in the first file the log line.
Seven of them failed on the lead's red tree,
where the header case showed the transport's own text,
the invented value in it,
as the refusal.
A fixture file holds the response whose body fails,
which both test files share.
One case name and two TSDoc summaries are the lead's rewording,
to say what the final detail says.

Open to the owner's veto:
a body that is not JSON stays the parser's unmarked error,
logged by class alone.

Open:
`work-title-search.ts` still stands in the list of modules without a test of their own,
its cases in the lookup's test file.
Still so at `94de8258e` (`own-unit-tests.unit.test.ts`),
with no follow-up launched for it.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries":
an authored account says only what holds for every cause it covers,
and names the possibilities where it cannot tell them apart.

### B221: seven refusals of the operator's own mistake printed as faults of the command

Red in `63567b4f5`,
fixed in `843bd6ce0`.

Found on 2026-10-05 (UTC),
as the item ledger B183 left open and what the agent found beside it.
`reportingRefusals` (`corpus-run/cli-refusal.ts`) prints a `StatedRefusalError` as the command declining,
its sentence alone,
and anything else as a fault,
with the fault line,
the frames and the fault's exit code.
Seven classes carry an authored,
marked sentence about something the operator named or set,
and each printed as a fault:
`CensusBaselineError` (`corpus-run/coverage-census-input.ts`),
`SpendCeilingOverrideError` (`corpus-run/spend-ceiling.ts`),
`BedrockCreditOverrideError` (`bedrock-ledger.ts`),
`UnsafeSeedError` and `GradedSheetExistsError` (`corpus-run/sheet-path.ts`),
and `EmptyPoolError` and `MixedGenerationError` (`corpus-run/artifact-pool-refusal.ts`).

The fix:
each extends `StatedRefusalError`,
its message word for word as it was,
so the command prints the sentence alone and exits with the stated-refusal code.
`corpus-run/cli-refusal.unit.test.ts` holds one case for each class,
asserting the printed line and the exit code,
and `corpus-run/coverage-census-input.unit.test.ts` holds the baseline's class.
All eight failed on the lead's red tree,
the seven reading exit code 5 where 6 was expected.

The lead's part:
`StatedRefusalError` takes an optional `cause`,
kept on the error and never repeated in its message,
committed in `2b0bfad75` with a test file of its own;
`CensusBaselineError` hands its cause to it,
where the agent's patch set the property by hand after construction.

Left as they were:
`HardCapOverrideError` and `RunsDirectoryBusyError`,
the same shape,
in files another change held;
`SheetBindingError`,
whose message quotes values read off files and is unmarked,
so it needs an authored message first;
and `CoverageFileError`,
`SourceMapFileError` and `CorpusReadError`,
which the agent read as faults of the environment without running each command.
A follow-up is prepared for these six and was not launched when this was written.
It was launched and merged since:
B254 (`51ccd8680`) makes five of the six stated refusals,
and keeps `CoverageFileError` a fault with its reason said.
`LedgerShapeError`,
`BedrockLedgerShapeError` and `ArtifactParseError` are damaged data and stay faults,
which an existing case pins.

The whole suite ran on `843bd6ce0` in a side checkout,
which holds the fixes of B214 to B221:
1,615 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 36 source scans passing.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal":
a refusal's class says whether it is the operator's mistake or the command's fault,
and a case drives each such class through the printer.

### B222: the lone container tag masker read whitespace inside a tag otherwise than the strict grammar does

Red in `81ad0add4`,
fixed in `0b687fbdf`.

Found on 2026-10-05 (UTC)
by the agent applying the first review of the trial's added cases,
which probed the installed parser on that review's note about a closer written `</details >`.
`tagOnLine` (`mask-container-tags.ts`) ended an element name at the first space
and refused any closer carrying text past its name.
The strict grammar steps over whitespace between a name and the closing bracket:
it reads `</details >` as closing the element,
and refuses that closer standing alone.
The masker left such a lone closer unmasked,
so the parse refused a slice holding it,
the failure the masker exists to prevent.
With a tab the name itself went wrong.
A closer with a tab before its bracket got a name holding the tab and paired with nothing,
so a whole element closed that way read as two lone tags and was masked,
and an opener whose attribute follows a tab got a name holding the tab and the attribute.
How many pages of the pinned corpus hold either spelling was not counted.

The fix:
`nameEndOf` ends a name at the first space or tab,
and a closer may carry spaces and tabs after its name and nothing else,
so `</p x>` is still no tag.
Three cases failed on the lead's red tree,
each file run by name against the build of the red commit's parent:
"MASKS A LONE CLOSER WITH A SPACE BEFORE ITS BRACKET as the closer of its element,
since the strict grammar reads that spelling as closing the element and refuses it alone",
"MASKS A LONE CLOSER WITH A TAB BEFORE ITS BRACKET under the element's name alone,
and an opener whose attribute follows a tab under its name alone"
and "PAIRS AN OPENER WITH A CLOSER WRITTEN WITH A SPACE OR A TAB BEFORE ITS BRACKET,
so a whole element is masked nowhere".

The agent's measurements against `parseMdxBody`,
not rerun by the lead:
a tab,
a no-break space,
an ideographic space,
a form feed,
a vertical tab and a carriage return before the bracket all parse,
and a zero-width space is refused.

Open when this entry was written,
closed in B262 (`68df23b05`):
the masker matches a space and a tab alone,
so it still differs from the grammar on the other whitespace the grammar takes;
and `inline-container-tags.ts` reads tags its own way and was not examined.
A follow-up for both was launched on 2026-10-06 (UTC)
and merged in that commit,
which gives both readers the grammar's whitespace through one predicate.

The whole suite ran on `f7653073b` in a side checkout,
which holds the changes of B222 to B227:
1,621 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 36 source scans passing.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
a reader of a tag's shape is shown the strict parser's verdict for each whitespace spelling.

### B223: the width contest answered `none` for a composite whose text is neither seat's

Red in `81ad0add4`,
fixed in `0b687fbdf`.

Found on 2026-10-05 (UTC)
by the first review of the trial's added cases (its finding 4),
behind a case pinning the answer.
`seatThatWon` (`corpus-run/editor-width-contest.ts`) reads which seat won
from the shipped producer and the shipped text,
and closed with `return 'none'` where a composite's text matched neither seat.
`contest`,
its one caller,
seats two composites,
each carrying its arm's patch as the candidate's value,
and a stage that reports a composite ships one candidate's value
(the agent's reading of `contest` and of `selectChunkPatch` in `editor-ensemble.ts`),
so no run produces that state.
`none` is also the answer where no candidate won,
so the sentinel could not be told from an honest reading.

The fix:
the branch is `throw new Error('unreachable: …')`,
naming the composite whose text is neither seat's and why the slate cannot hold one,
with a `@throws` line.
The case that pinned `none` is replaced by
"REFUSES A COMPOSITE WHOSE SHIPPED TEXT IS NEITHER SEAT'S,
since the two seats are the only composites on the slate and a winner ships one of their patches",
which asserts the class and the whole message
and failed on the lead's red tree.
The whole suite's run on `f7653073b` is recorded in B222.

Open to the owner's veto:
the throw,
where deleting the line and keeping `seatThatWon` total over two seats was the other way.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

### B224: the refine eligibility boundary kept a verdict for a paragraph no parse emits

Fixed in `0b687fbdf`,
with no red case,
since the state cannot be built without a cast.

Found on 2026-10-05 (UTC)
by the first review of the trial's added cases (its finding 3),
behind a case that reached the arm through an `as unknown as` cast.
`judgeParagraph` (`refine-eligibility.ts`) skipped a paragraph standing outside the body zone,
with the reason `not-body-zone`.
`parseDocument` gives a node the zone `footnote-definition` exactly where its kind is `footnoteDefinition`
(`document-node.ts`,
the zone's one writer by the agent's reading),
and the kind test refuses that kind first,
so the arm answered for a node no parse emits.
The trial's fifteenth T8 cluster had recorded as much and cased the arm all the same,
handing the boundary a document built for it.

The fix:
the arm is `throw new Error('unreachable: …')`,
naming the paragraph outside the body zone and the zone's one source,
with a `@throws` line;
`not-body-zone` leaves `IneligibleReason`,
which only the module and its test named on the red commit's tree (`git grep`);
and the case is deleted.
The whole suite's run on `f7653073b` is recorded in B222.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone":
no verdict is kept for a fixture production cannot build.

### B225: trial cases in twelve files that could not fail on what they named

Changed in `0b687fbdf`,
beside the fixes of B222 to B224.

Found on 2026-10-05 (UTC)
by the first review of the trial's added cases.
No production file changed for these:

- `corpus-run/roster-card-render.unit.test.ts`:
  a row asserted to be other than `undefined`,
  which `listingRowFor` never returns,
  is asserted whole,
  and the Bedrock card is asserted as its five fields where two were read;
- `corpus-run/cap-override.unit.test.ts`:
  the environment case compared the default call with its own expression,
  so a reader ignoring the environment passed it;
  it now sets the variable through a disposable and reads 15,
  clears it and reads the fallback,
  in the suite of the function it tests,
  which runs one case at a time;
- `corpus-run/window-trial-slice.unit.test.ts`:
  the insertion case searched the translator's sheets for a sentence an insertion run is never given;
  it now reads the judges' sheets,
  every one saying nothing stands where the target is an insertion and none saying so where a rendering exists,
  and the draw refusal is asserted by class and whole message;
- `han-title.unit.test.ts`:
  the line-end refusal is asked for under the form where it alone keeps a two-line title out;
- `corpus-run/cache-account-read.unit.test.ts`:
  a declaration that runs to its line end joins the refused list,
  and the line-end case moves to the suite of the function it tests;
- `corpus-run/runs-lock.unit.test.ts`:
  the holder's message is asserted whole in a case of its own,
  where `toContain` checks had been appended to another case,
  and the lock line is asserted as its whole text;
- `coverage-stage.unit.test.ts`:
  scripted verdicts said `all`,
  a word outside the wire's vocabulary,
  and now say `full`;
  the misattribution case asserts the whole verdict;
- `introduced-defect-wire.unit.test.ts`:
  the one-neighbour case asserts the whole nearby block,
  the empty half included;
- `model-content.unit.test.ts` and `provider-budget-refusal.unit.test.ts`:
  cases move under the function they test,
  and the payment refusal and the stated wait each gain cases of their own;
- `seeded-error.unit.test.ts`:
  both refusals are asserted by class and whole message;
- `refine-eligibility.unit.test.ts`:
  the case behind B224 is deleted.

The fixing agent's runs,
not rerun by the lead:
thirteen mutations of the production lines the changed cases name,
each turning its case red and restored from a byte copy.
Its stated gaps:
the change from `all` to `full` was not shown red by a mutation,
and the branch of `lockRunsDir` that names the holder after a lost race is still run by no case.
The whole suite's run on `f7653073b` is recorded in B222.

Open when this entry was written,
closed in B256 (`042a9245d`):
that branch,
and dog-themed fixture text left in two older cases
(`seeded-error.unit.test.ts`,
`introduced-defect-wire.unit.test.ts`).
A follow-up holding both was launched on 2026-10-06 (UTC)
and merged in that commit.
Two cases reach both arms of the lost takeover;
the rebase case of the first file is cat-themed and its case with a dog needle is deleted;
and a search of both files for `dog` at `f8e99b84d`,
letter case ignored,
finds nothing,
where the same search for `cat` finds lines in each.

Open to the owner's veto:
`concurrency: 1` on the suite whose case writes a process variable.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail".

### B226: trial cases in eight more files that asserted less than their names said

Changed in `27726ecc0`,
a commit of test files alone.

Found on 2026-10-05 (UTC)
by the third review of the trial's added cases.
No production file changed:

- `sample-draw.unit.test.ts`:
  the case ordering one entry's issues used a seed
  whose shuffle agrees with arrival order and with alphabetical order,
  so a sort by id passed;
  it uses a seed that puts `issue-b` first and runs both arrival orders,
  and `candidateOf` no longer casts a `sourceAnchor` the type does not hold;
- `sample-grading.unit.test.ts`:
  two casts that hid fields the types lack are gone,
  the repair is asserted to be the same object,
  and the byte-count refusal is asserted by class and whole message;
- `corpus-run/contributor-name-authorities.unit.test.ts`:
  the case is named for the missing signature it tests and asserts the whole map with its origin;
- `corpus-run/editor-standing-read.unit.test.ts`:
  the runs-directory case passed on any directory,
  since the summary prints its count whatever was read;
  it pins the first summary line and the fixture's own refusal,
  and the seated run asserts the whole report;
- `corpus-run/editor-width-report.unit.test.ts`:
  rows shipped on the narrow arm alone and on the wide arm alone join the two that could not tell the arms apart;
- `corpus-run/probe-telemetry-report.unit.test.ts`:
  each note is shown absent where its count is zero;
- `corpus-run/slice-cache-namespace-resume.unit.test.ts`:
  a bare rejection becomes the permission message,
  and a case that depends on no file mode shows a raising guard surfacing;
- `fidelity-alteration-variant.unit.test.ts`:
  two case names say what their cases test and lose the batch tag.

Each changed case went red against one production break made for it
and green once the break was restored from a byte copy
(the fixing agent's runs,
not rerun by the lead);
the two renamed cases have no red run.
The whole suite's run on `f7653073b` is recorded in B222.

A correction to the commit's message and to the agent's report,
both of which leave open a field `RankedCandidate.issueKey` as written and never read.
`RankedCandidate` (`sample-draw.ts`) has no such field at `27726ecc0`:
the field stands on `KeyedCandidate`,
where `byIssueKey` reads it to order one entry's issues,
as B127 records.
A follow-up launched on 2026-10-06 (UTC) was handed the same claim.

Open:
the permission case still depends on running as a user a file mode can refuse.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail".

### B227: no other list was behind its union, and each that must be complete is now held by the compiler

Changed in `f7653073b`,
a refactor with no red case.

A census after B169,
which had left open the package's other values that must name every member of a type declared apart from them.
The agent read the lists,
lookup tables and branch chains over a union in the production source:
the lead's candidates and what its own searches found.
None was behind its union,
so no behaviour changes.
`METER_STATES` (`corpus-run/meter-sample-read.ts`),
the one list B169 named as read through a cast without defining its union,
was complete and is now a record keyed by `MeterState`.

The change is that a member added to a union fails to compile until each of these names it,
in one of three forms:

- a union derived from its `as const` list,
  where the list is also iterated:
  the wire vocabularies that feed a guard and a schema `enum`,
  provider order,
  size bands,
  stream channels,
  damage kinds,
  repair dispositions and round stages;
- a record keyed by the union,
  read through `requireKeyOf` (`artifact-exact-guard.ts`) or an own-key guard,
  where a stored or typed-in word is checked against the vocabulary:
  the artifact readers,
  meter states,
  cached dispositions and settlement terminals;
- a chain's closing refusal of a member no branch handles,
  where the last member had taken the tail by falling through,
  in fourteen functions,
  each with a `@throws` line.

A deliberate subset keeps its list,
typed by its union,
with TSDoc naming the members left out and why.
Hand-spelled copies of one vocabulary are gone for the list they copied,
and `SETTLEMENT_TERMINALS` became `SETTLEMENT_WAYS`,
a record by terminal.
By the agent's account,
the readers of older artifact generations are keyed by their frozen vocabularies and never by the live unions.

An independent reviewer read every production hunk for a change of order,
value or member and found none,
comparing member by member where a list feeds prompt text,
schema bytes,
refusal text or report rows.
Its four findings were closed before the commit:
`@throws` lines missing from the fourteen functions;
a filter in `corpus-run/editor-standing-read.ts` whose comment promised more than a `typeof` test holds,
now a record of the absences;
two comments giving a reason for a tuple annotation that nobody had measured,
now stating the two compiler errors seen without it (`TS9039`,
`TS9013`);
and no case for a member whose discriminant is not text.

The agent's measurements,
not rerun by the lead:
removing one entry of a converted record,
or renaming one handled branch,
gives a compile error where the form promises one (`TS2741`,
`TS2322`).
The whole suite's run on `f7653073b` is recorded in B222.

The closing refusal was written as a call to a helper,
a shape the coverage census reads as code no test ran;
B231 records that and its repair.

Open when this entry was written,
answered in B249 (`df807a8b5`):
whether the decision `no-voice-heard`,
which maps to a terminal cached as settled,
can reach the persistence check
(the agent's question,
handed to a follow-up launched on 2026-10-06 (UTC)).
No input reaches it today,
by that follow-up's sweep,
and a settlement on which no voice was heard is no longer kept.
Read by the agent and left unconverted,
each complete at this commit by its reading:
`CARD_PROVIDERS` (`model-card-derive.ts`),
a reordered twin of the provider names whose order command output pins,
and the size-band and damage-lane lists that shadow their unions locally.

Recurrence:
`mistake-prevention.md`,
"Lists that must name every member of a type".

### B228: a title linked twice in one slice had its second link's rendering never located

Red in `51f6dd875`,
fixed in `65bd3a645`.

Found on 2026-10-05 (UTC)
by the first-match census of B203,
which described the site and left it.
`titleLink` (`corpus-run/title-reference-link.ts`) took the first link of the original whose text is the title.
Where one slice links a title twice,
to one destination or to two,
only the first link's rendering was located,
and the second stayed as the bench wrote it,
so a page could keep one title in two renderings.

The fix:
`titleLinks` gathers every closed link of the title,
and `locateLinks` locates each by the rule the file already had (ledger B59),
the page's link at the same place among the links to one destination,
and returns the located renderings in page order.
Where any link of the title is ambiguous the slice is,
since rewriting the located links and leaving the other would leave the title said two ways;
a link whose destination the page does not link at all is left as the page has it.
Three cases failed on the lead's red tree:
the two that begin "READS EVERY LINK OF THE TITLE",
for one destination and for two,
and the one that begins
"STANDS ASIDE WHERE ONE OF THE TITLE'S TWO DESTINATIONS IS LINKED A DIFFERENT NUMBER OF TIMES on the page".
A fourth,
for a page that dropped one of the title's two destinations,
passed before the fix and stays as a guard.

Not measured:
how many slices of the pinned corpus link one title twice.
The agent's read of the corpus clone was refused by its permission check,
and the lead did not run the count in its place (M118);
the count stays open for the owner to authorize.

The whole suite ran on `65bd3a645` in a side checkout,
which holds the fixes of B228 to B230:
1,621 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 36 source scans passing.
No cache version moved,
for this entry or for B229 and B230:
no stored record exists under a current version (the audit named in B189).

Open to the owner's veto:
a slice is ambiguous when any link of the title is;
and the located renderings are sorted into page order.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B229: the bilingual pair bound compared only the first place a refrain's wording stands

Red in `51f6dd875`,
fixed in `65bd3a645`.

Found on 2026-10-05 (UTC)
by the first-match census of B203.
`lineAt` (`bilingual-pair-bound.ts`) took the first line carrying a pair's English wording,
in the page and in the rendering.
Where the wording stands on more than one line,
a refrain,
only the first blocks were compared,
so a rendering that widened the refrain's second block was not refused;
and a rendering that repeated the line before the pair was measured against a block it could not be paired with
(the agent's probes before the fix).

The fix:
`linesAt` returns every place.
Where the page and the rendering carry the wording equally often,
the places are compared in order;
where they do not,
the bound says nothing for that pair and the repeated-line check speaks.
Two cases failed on the lead's red tree:
"REFUSES a rendering that widens the SECOND block of a refrain the page carries in two places"
and "STAYS SILENT ON THE PAIR where the rendering carries the wording on more lines than the page does,
leaving the repeat to the repeated-line check".

The agent's first patch kept a set of the wordings already compared,
keyed by the English wording alone,
so the second of two pairs sharing one English wording was skipped where the page kept the first pair's Han line only.
The lead's review found it.
The agent dropped the set,
each pair is read on its own,
and a set of the rendering blocks already named keeps one block from being named twice.
The case for it,
"REFUSES a widened block through the second of two pairs sharing one English wording,
where the page kept the first pair's Han line only",
was red against that first patch (the agent's run).

Not measured:
how often a wording stands on more than one line of a slice,
and what the bound says there where the counts differ,
for the reason B228 gives.
The choice of silence where the counts differ therefore rests on the file's own rule,
that nothing is refused where a block cannot be paired,
and on fixtures,
and is the first thing to read again once the count is taken.
The whole suite's run on `65bd3a645` is recorded in B228.

Open to the owner's veto:
silence where the two texts carry a wording a different number of times.

Open when this entry was written,
closed in B255 (`51ccd8680`):
the repeated-line finding prints a number before a counted noun (the agent's note),
handed to a follow-up launched on 2026-10-06 (UTC).

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B230: an archive block's revision was checked where the block's text first stands on the page

Fixed in `65bd3a645`.
Its cases need a parameter the fix adds,
so they were committed with it,
and their red runs are the agent's alone.

Found on 2026-10-05 (UTC)
by the first-match census of B203.
`revisionFootnoteFindings` (`archive-revision-footnotes.ts`) found the block again
with `indexOf` of its text in the page.
A block whose text stands on the page twice had its revision tried at the first place.
With the first copy inside a code fence,
where a marker references nothing,
and the second in the body,
where it references a note,
a revision dropping the marker from the body's block left no finding
(the agent's probe before the fix).

The fix:
the caller's offset comes through `runArchiveBlockReviewStage` and `replacementCandidates`
as a required `blockOffset`,
which `corpus-run/archive-block-repair.ts`,
the stage's one production caller,
fills from the block it cut out;
and the floor throws `BlockOutsideArchiveError` where the page does not hold the block at that offset.
The cases:
"READS THE REVISION AT THE OFFSET THE CALLER GIVES:
a block that stands twice,
the first inside a code fence,
loses the marker the note hangs on at its second place",
"REFUSES an offset at which the page does not carry the block,
though it carries the block elsewhere",
and the same block read at its first place,
which passed before the fix.
The whole suite's run on `65bd3a645` is recorded in B228.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text":
a caller that cut a block out passes where it stands,
and the callee does not find it again by its text.

### B231: fourteen chain tails refusing an unhandled member read to the census as code no test ran

Changed in `94de8258e`,
a refactor with no red case.

Found on 2026-10-06 (UTC)
in the whole-suite coverage census taken at `65bd3a645` (`census-5RzoUC`).
B227 closed fourteen branch chains over a union with a call to a helper,
`refuseUnhandledMember`,
which threw a plain `Error`.
The census counts a cold stretch apart from untested code only where it holds nothing but
`throw new Error('unreachable: …')` or a throw of a class whose name ends in `InvariantError`
(`corpus-run/coverage-invariant-throw.ts`).
A call to a helper is neither,
so each tail was listed as cold code:
fourteen cold stretches over 80 lines,
one in each of the fourteen caller files
(the lead's count over the census file,
by a script kept in the session's scratch).
The prevention doc already held that an invariant is written in a shape the census reads (ledger M115);
the helper's shape was not read against that at B227's merge.

The fix:
the helper is the class `UnhandledMemberInvariantError` (`unhandled-member.ts`),
thrown at the chain's end.
Its message is the helper's,
unchanged,
and its constructor keeps the `never` parameter,
so a widened union still stops the build at the throw site;
the thrown value's class name changes from `Error` to the class's own.
The fourteen `@throws` lines name the class.
The class stays unmarked,
as the helper's `Error` was,
since its discriminant is read off a value the types say cannot exist.
The inventory scan refuses an unmarked class that writes its own sentence without a recorded reason,
failed on that at the merge,
and now holds the reason in its withheld list.
The test builds the class through `Reflect.construct`,
since the constructor takes `never`,
and compares the whole text of each refusal.

The whole suite ran on `94de8258e` in a side checkout:
1,621 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 36 source scans passing.

Not measured:
that the census now counts the fourteen apart.
That is read off the census's rule,
and the recount is owed to the next whole-suite census.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone":
an invariant is written in a shape the census reads,
and a helper that throws for its caller is not one.
