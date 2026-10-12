# Audit ledger, part 35

Part 35 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B206: a stored page assembly was read by the first row naming a slice

Red in `49e3b8dfd`,
fixed in `21f2ec369`.

Found on 2026-10-05 (UTC) by the same census.
`pageAssemblyOverrideAt` (`corpus-run/artifact-two-lane-page-assembly.ts`) takes the first trimmed row naming a slice,
and `parsePageAssembly` admitted a file holding two.
The writer cannot write two:
`guardPageAssembly` composes the guard's trims,
one per slice by the splice,
with the rows of a map keyed by slice.
A file edited by hand or written by another build could,
and the reader answered with whichever row stood first.

The fix:
`parsePageAssembly` refuses the second row,
`expected one row per slice; slice N appears more than once`,
in the words `parseConsolidation` uses for its slices.
`withdrawn` is left alone:
it is read by membership,
where a repeat changes no answer.

No stored file is refused
(the fixing agent's measurement):
of 212 stored sections holding 221 trimmed rows,
none names a slice twice.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B207: the delivery ledger keyed trimmed texts by slice without the check its two index lists have

Red in `49e3b8dfd`,
fixed in `21f2ec369`.

Found on 2026-10-05 (UTC) by the same census.
`buildSliceDelivery` (`slice-delivery.ts`) refuses a shipped or a withdrawn index named twice,
checked against the arrays because a set forgets the repeat,
and built a map of trimmed texts by slice with no such check,
so of two trimmed replacements for one slice the later would have been the text the ledger reports.
Its callers pass the assembly guard's trims,
which the splice holds to one per slice,
so no run reaches it;
the signature admits any list.

The fix:
a second trimmed replacement for a slice is the fault `trim-repeats`
(`slice-delivery-fault.ts`),
worded `slice N carries more than one trimmed replacement, so which text the document holds there cannot be read`.

Open to the owner's veto:
the fault is a kind of its own,
where the other way widens the set name the two sibling repeats share,
which a third fault also carries and could then word wrongly;
and the refusal stands where uniqueness is proved in another file,
neither by type nor by the lines beside it.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B208: a roster card was printed from the first row a listing carries under an id

Red in `49e3b8dfd`,
fixed in `21f2ec369`.

Found on 2026-10-05 (UTC) by the same census.
`listingRowFor` (`corpus-run/roster-card-render.ts`) took the first row of a provider's listing carrying the served id.
A listing is a provider's reply,
and nothing in it makes an id name one row:
the card would describe whichever the provider listed first.

The fix:
every row under the id is read;
rows that say the same are one answer,
and rows that differ are a `StatedRefusalError` naming the id the operator typed and nothing from the listing.
The one caller is the `roster-card` command,
which states its other refusals the same way.

Open to the owner's veto:
rows that say the same count as one answer,
where the other way refuses any repeat.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B209: three readers of the package's own log lines settled a repeated field by order

Red in `49e3b8dfd`,
fixed in `21f2ec369`.

Found on 2026-10-05 (UTC) by the same census.
`reportSpend`,
`takeReading` and `armSliceCost` each write a field once,
so a line naming one twice is two records run together or a line cut and resumed.
`namedFields` (`corpus-run/spend-read.ts`) and `fieldsOf` (`slice-cost-read.ts`) kept the later value,
the second by its own TSDoc,
and `fieldValue` (`corpus-run/meter-sample-read.ts`) read the first:
each returned one clean record out of two.

The fix:
`readSpendLine` answers `'unreadable'`,
`readMeterLine` answers `'skipped'`,
for a repeated state or level,
and `readSliceCosts` drops the line and names each repeated field,
each module's own value for a record that will not read.
The meter's check is asked once both required states have read,
so that an older case about an absent first reading keeps passing for the reason its name gives;
the agent's reviewer caught a first placement that made it pass for the new reason.

No report over a stored log changes
(the fixing agent's measurement over 1,928 stored run logs,
the builds before and after the fix side by side,
with a control):
922,240 `SPEND` records and 32,751 `METERS` records read alike,
and of 292,458 `SLICE-COST` lines the 9 that read differently are test output.

Open to the owner's veto:
a damaged record is a hole,
where the other way reads its first or its last value.

Recurrence:
`mistake-prevention.md`,
"Readers of the package's own log lines".

### B210: a tag attribute was restored from the first of two the archive's tag names

Red in `49e3b8dfd`,
fixed in `21f2ec369`.

Found on 2026-10-05 (UTC) by the same census.
`attributeRewrites` (`corpus-run/jsx-attribute-restore.ts`) took the archive tag's first attribute of a name
and wrote its value over the bench's.
The archive's tag is text a person wrote,
and where it names an attribute twice,
which value a reader sees depends on what renders the tag.

The fix:
such an attribute is left as the bench wrote it,
and the tag's other attributes are restored as before.

No page changes
(the fixing agent's count at the pin):
of 118 archive tags,
none names an attribute twice.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B211: trial cases in seven files that could not fail on what they named

Changed in `bbed06b87`,
a commit of test files alone.

Found on 2026-10-05 (UTC)
by the fourth review of the trial's added cases.
No production file changed:

- `corpus-run/name-gloss-restore.unit.test.ts`:
  both cases were refused before the line shape was read,
  since the archive carried the name once and the shipped text never carried it,
  and the comma case asserted that two lengths were at least zero;
  each now has a fixture the line shape decides and a control that restores,
  with the restored row and the finding whole;
- `nudged-reask.unit.test.ts`:
  typed fixtures replace casts,
  the path where both answers fail returns a value the second answer cannot be mistaken for,
  and new cases hold a usable first answer,
  which buys no second ask,
  and the request the second ask receives,
  the nudge last and the first provider excluded;
- `provider-router.unit.test.ts`:
  the last-refusal case answered 503,
  which is no budget refusal,
  and so stopped at the first provider;
  it now refuses on budget at both providers and asserts the last refusal whole,
  and a new case holds a failure that is no budget refusal rethrown at once;
- `restoration-judge.unit.test.ts`:
  the whole judgments record,
  where `votes` shows the ballot that named one seed only;
- `hyper-client.unit.test.ts`:
  the answer-length knob and the replaced signal are read off the recorded exchange,
  not searched for in a JSON string;
- `corpus-name-index.unit.test.ts`:
  the class,
  the whole message and the kind;
- `corpus-run/tag-attributes.unit.test.ts`:
  whole readings where it asserted mapped names,
  and the batch tag is gone from six case names.

Each changed or added case failed against a mutation of the production line it names
(the fixing agent's runs,
the mutants restored).
Its one stated gap:
the unclosed-quote half of the first name-gloss case cannot fail on one guard alone,
since two guards refuse that line.
The commit was not gated alone.
The whole suite next ran two commits on,
on `cf50117c5` in a side checkout:
1,607 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 36 source scans passing.

Open to the owner's veto:
the 503 case stands beside the older 500 case and does not replace it;
and the `hyper-client` case asserts that the signal was replaced,
not how long the deadline is,
which the wire does not show.

Open:
two older `refine-wire` cases use a dog sentence as fixture text,
an older `corpus-name-index` case asserts mapped names,
and an older `provider-router` case asserts the class alone.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail".

### B212: the footnote mention scan disagreed with the parse about where a marker shape is no reference

Red in `9b872bbea`,
fixed in `cf50117c5`.

Found on 2026-10-05 (UTC)
by the lead's probes of the lexical URL reader B182 added,
as the item B182 left open.
`footnoteMentions` (`footnote-mentions.ts`) counts GFM marker shapes by scanning a fragment's raw text,
and asked that reader (`footnote-url-spans.ts`) which of them sit in a URL.
The reader began a bare literal only after whitespace or one of four characters,
where the parser begins one after any character that is no ASCII letter,
and it knew nothing of code spans,
images,
link reference definitions,
comments or the markup around a link's label.
Four guards read the scan:
`assembly-integrity.ts`,
`translate-marker-drop.ts`,
`translate-definition-leak.ts` and `corpus-run/insertion-referenced-definitions.ts`.
A mention wrongly counted tells a candidate to keep a marker its page never had,
so a good candidate is refused or withdrawn;
a mention wrongly dropped leaves a real reference unguarded,
which is the direction those guards cannot afford.

Measured by the fixing agent on the build before the fix,
as texts whose scanned references differ from the footnote graph's:
90 of the 210 texts of the lead's URL table,
6 of them lacking a reference the graph reads;
5 of 28 edge texts,
2 of them lacking one;
and 1,603 of 3,000 texts from a seeded generator,
166 of them lacking one.

Three designs were weighed.
Correcting the lexical reader rule by rule was rejected:
it means writing code spans,
link labels,
rebuilt literals and the Han boundary by hand,
which is the parser again.
Taking the document parse of the fragment as the mentions was rejected:
a fragment opening on a thematic break reads as front matter and loses its marker,
one opening on a malformed front matter block throws `FrontMatterParseError`,
and a fragment that opens a fence or a comment for the page loses the markers after it.
Chosen:
the lexical hits stay,
which keeps the roles,
the overflow refusal and the full-width markers as they were,
and a hit is dropped where a parse of the fragment reads no reference.

The fix:
`footnote-parsed-spans.ts` (`parsedSpansOf`,
`insideParsedSpan`) masks invisible lines and HTML comments as the document parse does,
splits no front matter,
parses the masked fragment under plain markdown and under strict MDX,
and keeps only the regions both grammars read as no reference.
Where strict MDX refuses the fragment,
plain markdown decides alone;
where the plain parser refuses it for its nesting,
no region is reported and every shape counts,
as `corpus-run/prose-ranges.ts` already answers that refusal.
The regions are a tokenized or angle autolink,
the marker shape of a literal the autolink transform builds,
the markup around a link's or a reference link's label,
an image,
a link reference definition,
an inline code span and a masked comment.
A shape in a code block,
a raw HTML node or a JSX attribute still counts,
since a fragment cannot settle those for the page,
and a full-width marker counts as the graph counts it.
`footnote-url-spans.ts` and its test file are deleted,
and the footnote barrel exports the new pair in their place.

Both grammars are asked because they differ in block structure.
A fence indented four spaces is a code block to strict MDX and a paragraph line to plain markdown,
where the backticks before it pair into a code span;
a parse under plain markdown alone dropped a marker the page,
read as MDX,
holds as a reference.
Keeping a region only where both grammars read it removed every such text the agent's generator found.

After the fix,
by the fixing agent's runs:
the lead's three probes agree with the graph,
the 28 edge texts among them;
seeded runs of 3,000 to 60,000 generated texts,
eleven runs,
found no text where the scan lacks a reference the graph reads,
and none where it counts more than the graph outside a code block or a raw HTML node;
over the 276 page files of the pinned corpus,
68 of which hold a marker shape,
the scan's GFM references equal the document parse's in every file,
and no file and none of 8,188 blank-line chunks differs between the scan before and after,
while the control texts do differ;
and the scan costs about 200 to 270 ms over those 68 files,
against 15 to 25 ms before,
a text holding no marker shape taking a path that parses nothing.

Cases:
`footnote-mentions-agreement.unit.test.ts` runs the scan and the graph on every text of the lead's table,
the edge texts and 3,000 seeded texts,
storing no expectation for them,
and names the two shapes where the scan counts more;
`footnote-parsed-spans.unit.test.ts` holds each region,
the unclosed comment,
the region only one grammar reads and the nesting the plain parser refuses;
and the edge case of `footnote-mentions.unit.test.ts`,
two of whose thirteen expectations the parse does not give,
is replaced by four.
Three of those cases failed on the lead's red tree.
The agent's own red run of them came after its fix,
against the restored base sources.

At the merge the lead removed the deleted file's two keys from the blankness scan's held list,
and corrected the header comment and one TSDoc of `footnote-mentions.ts`,
which still described one grammar and no masked comment.
The whole suite ran on `cf50117c5` in a side checkout:
1,607 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 36 source scans passing.

Cache:
no version moved.
The cache account audit of 2026-10-05 (UTC) found the newest slice-cache record written 2026-09-27T04:26Z,
with every cache version set since then,
so no stored record exists under a current version.

Not checked by the agent:
whether every site that slices a page cuts at a top-level block's offset,
which the module's reading of a fragment rests on and which was read from a comment in `parse-document.ts`.

Open to the owner's veto:
a marker shape in a masked comment is no longer a mention,
where the scan counted it;
a shape in a code block,
in raw HTML or in a full-width marker stays counted;
a nesting the plain parser refuses counts everything;
and the exports `urlSpansOf` and `insideUrlSpan` are gone.

Open:
a footnote definition indented four or more spaces is a definition to the scan and a reference to the graph,
for which a follow-up was launched and had not handed back when this was written;
and a text nested thousands of block quotes deep costs the parser itself,
3.2 s at 30,000 markers and 14.8 s at 60,000 by the agent's timing,
with no check made of whether another stage parses such a candidate first.
Still open at `94de8258e`:
by that timing the cost grows faster than the text,
about 4.6 times the time for twice the markers,
it is the Markdown library's own,
and no follow-up was launched for it.
Both are closed since:
the indented definition in B258 (`68df23b05`),
and the nested text in B301 (`41d5f9267`),
which bounds the nesting a parser is handed and does not make the parse linear.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
a scan of a fragment asks a parse of the fragment where its shapes are something else,
under every grammar the page may be read by.

### B213: an address was cut at its first closing parenthesis

Red in `9b872bbea`,
fixed in `cf50117c5`.

Found on 2026-10-05 (UTC),
as the two items ledger B173 left open.
`corpus-run/dropped-destinations.ts` ended an address at its first closing parenthesis (`firstStopper`),
on the scanner and on a literal alike,
so a bare `https://en.example/wiki/Cat_(animal)` read as the address without its last character,
and a source linking that address explicitly against a page writing it bare reported the destination dropped
(the fixing agent's probe on the build before the fix).
The test for an autolink literal also stood twice,
as the private `isProseAddress` beside the exported `isAutolinkLiteral` (`footnote-unpositioned-runs.ts`).

The parse's rule,
as the agent read it in the installed autolink-literal syntax (`tokenizePath` and `tokenizeTrail`):
a closing parenthesis is part of the path while fewer have closed than opened,
and a run of sentence punctuation and closing parentheses that reaches the end of the address
is shed from where it starts.

The fix:
`addressEnd` and `trailRunEnd` replace `firstStopper`.
An address keeps a closing parenthesis that balances an opening one,
ends at one that balances none,
and ends at sentence punctuation that only closing parentheses follow,
as in `(cat.)`.
The cut is one pass:
a run that turns out to be no trail is not scanned again.
`scanUrlRuns` and `trimDestination` both use it,
and `isProseAddress` is gone in favour of `isAutolinkLiteral`,
a change with no red case of its own.

After the fix,
by the fixing agent's runs:
the explicit and the bare writing of one address report nothing dropped in either direction;
none of the 276 page files of the pinned corpus reads differently through `collectDestinations`,
while a control text does,
and one page holds an address with an opening parenthesis;
and the destination the tree reader gives equals the parse's address
in 26,012 of 40,000 generated texts holding a link,
against 15,757 before.

Four cases in `corpus-run/dropped-destinations.unit.test.ts` hold the balanced parenthesis in a bare address,
the trail that ends a run,
the autolink literal with a `www` literal beside it,
and the explicit and bare pair in both directions.
All four failed on the lead's red tree;
the agent's run has no red log for the trail case,
which it wrote after its last change to the scanner.

Open to the owner's veto:
sentence punctuation standing before a closing parenthesis is shed where only closing parentheses follow it.

Open:
the scan does not shed a trailing underscore,
asterisk or tilde before a closing parenthesis as the parse's trail rule does,
which it did not before the fix either;
about 450 of 40,000 generated texts show the difference,
by the agent's count.
A follow-up was launched and had not handed back when this was written.
It has since:
B259 (`68df23b05`) sheds the three marks as the parse's trail rule does.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
a cut that stands for the parser's is written from the parser's own rule for it.

### B214: the recheck rebuilt the checker round's quorum from the wording of a finding

Fixed in `2b0bfad75`,
with its cases,
which read a field the fix adds;
the fixing agent's red run read `undefined` where 2 and 3 were expected.

Found on 2026-10-05 (UTC)
by the agent closing what the refine-lane review left of B161.
`retainsResolvedIssues` (`refine-recheck.ts`) needs the quorum the checker round closed on,
and nothing carried that number but the wording of the gather's `stage-short-bench` finding.
B161 had read it there:
`checkerQuorumClosedOn` rebuilt the finding for every count of refused seats and looked for a match.

The fix:
`CheckerStageResult` gains `quorum`,
the recheck reads it,
and `checkerQuorumClosedOn` is deleted.
The agent's patch sized the number in `runCheckerStage` (`repair-edit-stages.ts`),
from the bench size and the seats the gather found unreachable,
since the gather's file was outside the files it was given.
The lead changed that at the merge:
`gatherStageVoices` (`stage-quorum.ts`) returns `quorum`,
the number its own `quorumMet` compared the heard voices with,
and `runCheckerStage` hands it on,
so the quorum is sized in one place.
The same commit corrected the TSDoc of the gather's `findings`,
which said the list is empty when quorum was met,
though the gather names each lost voice on a met quorum too.

Cases in `repair-edit-stages.unit.test.ts` hold the quorum of two for a bench of three,
of three for a bench of five,
of two for a bench of five whose last three seats no provider serves,
beside the short-bench finding naming the same number,
and of two for a bench of three with one seat refused.
The lead's case in `stage-quorum.unit.test.ts` holds six for a bench of eleven every seat of which answers
and two for the same bench with seven seats refused,
with the nine findings that bench leaves.

Cache:
no version moved;
a result gains a field,
and no cached record holds it.

Not checked by the agent:
every writer of an artifact,
for one that stores a checker stage's result whole;
its search found no shape guard that would meet the new field,
and the whole suite passed with it.

Recurrence:
`mistake-prevention.md`,
"Which seats a quorum counts":
a reader of a gather's round takes the quorum the gather returns,
never one read back out of a finding's wording or sized a second time.

### B215: a missing check named no checker, no issue by id and no cause

Red in `1e444543d`,
fixed in `2b0bfad75`.

Found on 2026-10-05 (UTC)
by the refine-lane review,
in the finding B161 quotes.
`resolveResolutionChecks` (`tally-resolution.ts`) wrote one `missing-check (<n>)`
for each issue a checker's report left without a verdict,
numbering the issue by its place on the sheet.
Two checkers skipping one issue wrote the same line twice,
and an issue answered only with a verdict the tally does not know landed there too,
with nothing to tell it from one never mentioned.

The fix:
the resolver takes the checker's id and writes `missing-check (<issueId>, <checkerModelId>, unanswered)`
where the report held no check on the issue,
and the same with `unknown-verdict` where every check it held on the issue carried an unknown verdict;
`unknown-resolution-verdict (<verdict>)` still stands beside the second.
`runCheckerStage` passes each voice's id.
The findings for a repeated check and for a check numbered past the sheet are unchanged.
No reader takes the finding's text:
the recheck counts the reading's ballots,
and the troubleshooting doc on unread signals lists the finding by name alone.

Cases:
`tally-resolution.unit.test.ts` holds an issue never mentioned,
one answered only with an unknown verdict,
and one answered with an unknown verdict and then a known one,
which is answered;
`repair-edit-stages.unit.test.ts` holds two checkers skipping one issue,
whose two findings now differ,
and the cause beside the unknown verdict itself.
Five cases of `refine-recheck.unit.test.ts` carry the finding in their expectations and failed on the lead's red tree.
Their helper now puts the findings of several checkers in code-point order,
since the agent saw the order differ between two runs of one case.

Cache:
no version moved;
a cached record holds the old wording,
and nothing reads it.

Open to the owner's veto:
the issue is named by its id and the checker by its seat id,
where the other way prefixes every ballot finding with the checker at the stage and changes more text.

Recurrence:
`mistake-prevention.md`,
"Labels a message names":
a finding one of several voices leaves names the voice,
the item by its id and the cause,
so two findings about one item can be told apart.

### B216: a rewrite the patch refused as unchanged left no finding

Red in `1e444543d`,
fixed in `2b0bfad75`.

Found on 2026-10-05 (UTC)
by the refine-lane review,
and left by the fix of B162.
`runRefineStage` (`refine-stage.ts`) applied each rewriter's operations and read only the ones the patch applied.
A rewrite that came out as the paragraph it replaces was refused by the patch as `unchanged-region` and dropped,
and the stage reported its rewriter as heard and not proposing,
which is what it reports for a rewriter that proposed nothing.

The fix:
each such refusal leaves `<model>: refine-unchanged-rewrite (paragraph <n>)` in the stage's findings,
the paragraph numbered as the rewriter's sheet numbers it,
in roster order,
between the atom gate's findings and `refine-candidates`.
The consolidation polish round calls the same stage and gains the same finding.
Any other refusal by the patch throws `unreachable:`,
naming the reason cut at its parenthetical so that no page text reaches the message:
the lane binds its operations to its own envelopes,
applies them to the text those envelopes came from,
and skips preservation.
The agent's probe ran 4,000 generated documents,
3,807 envelopes,
through the lane's own derivation and patch:
the unchanged region was the only refusal reached,
2,031 times,
and 1,038 documents applied an operation,
which shows the probe reached the patch.
The steps that read one reply moved to `refine-stage-replies.ts` (`resolveReply`,
`applyReply`,
`inRosterOrder`),
for the file-length cap,
with no comment dropped.

Cases:
two in `refine-stage.unit.test.ts`,
one of them an older case whose expectation changed,
both failing on the lead's red tree;
and seven in `refine-stage-replies.unit.test.ts`,
two of which reach the throw through a reply built by hand with a wrong hash and an unknown envelope,
input no run produces.
One guard in the new module has no case:
the refusal of an operation naming no paragraph of the sheet,
which the patch refuses first under another reason.

The same commit gives `refineProbeVerdict` a test file of its own,
eleven cases,
written green with no mutation run,
and takes its line out of the list of modules without one.

Cache:
no version moved;
findings are added only.

Open to the owner's veto:
the finding's form,
where the other way is the editor lane's count of rejections by kind;
and the throw for every other refusal.

Open,
seen by the agent and outside these three entries:
a paragraph preceded by a byte order mark got an envelope whose text begins with the mark and ends one character short
(`parse-document.ts`),
and whether two runs of one input can order a checker round's findings differently was not settled.
A follow-up was launched for each and had not handed back when this was written.
Both have since:
the byte order mark is B257 (`68df23b05`),
and the order of a checker round's findings is B253 (`df807a8b5`).

Recurrence:
`mistake-prevention.md`,
"Refusals inside a composed operation":
a caller of a function that returns what it applied beside what it refused reads both,
or throws on the refusals its construction rules out.

### B217: a dropped destination's refusal wrote its counts as `destination(s)` and `slice 4, 7`

Fixed in `843bd6ce0`,
with its four cases;
the fixing agent's red run failed all four.

Found on 2026-10-05 (UTC),
as the item ledger B174 left open.
`DroppedDestinationError` (`corpus-run/destination-completeness.ts`),
a marked class,
wrote `destination(s)` after any count
and named several slices under the singular `slice`.

The fix:
`wordForCount` chooses the noun for the destination count and for the slices in `whereCarried`,
and the message inventory names both calls.
The four cases,
in `corpus-run/dropped-destination-error.unit.test.ts`,
hold one destination in one slice,
two in two,
one in none and two in one shared slice,
each by its whole sentence.
The file is named for the class:
one named for the module would have taken the module's line out of the list of modules without a test,
which stands in a file the agent was not given.

The count-nouns scan had passed the old wording;
why it did was not looked into.

Open:
`corpus-run/destination-completeness.ts` still stands in that list,
its cases under another file's name.
Still so at `94de8258e` (`own-unit-tests.unit.test.ts`),
with no follow-up launched for it.

Recurrence:
`mistake-prevention.md`,
"Counts in printed text".

### B218: a cached pairing was used without the reader a fresh reply goes through

Red in `63567b4f5`,
fixed in `843bd6ce0`.

Found on 2026-10-05 (UTC),
as the item ledger B171 left open.
`prepareBlockPairing` checked a cached block pairing's indices alone,
and `buySectionPairing` (`prepare-section-round.ts`) handed a cached section pairing on unread.
The fixing agent's probes of damaged records:
a section record naming a translation section the document lacks
stopped the alignment with a missing-value error naming nothing;
one naming an original section it lacks left the document with no slice,
without a word;
a repeated or reversed pair ended in `PlacementLayoutError` far from the cache;
and one original paired with two translations aligned the wrong sections,
without a word.
A block record that moves backwards ended in `SliceCoverageError`,
and one that repeats a correspondence or pairs a definition with a body block was sliced as stored.

The fix:
both warm paths read the record through the whole reader a fresh reply goes through,
`readBlockPairing` with the question's own free order,
so definitions whose labels cross still resume,
and `readSectionPairing`.
A record the reader refuses is a miss said on a warning in the refusal's words,
and the round is bought again and stored under the same key.
Three comments that leaned on the index check now name the reader
(`corpus-run/slice-cache-store.ts`,
`pair-media-adjacency.ts`,
`pair-definition-order.ts`).

Eight cases,
three in `prepare-block-pairing.unit.test.ts` and five in `prepare-section-round.unit.test.ts`,
each hold one kind of damage,
the warning and the round bought again.
All eight failed on the lead's red tree.

A risk the agent names and probed on two shapes:
a record the cold path stores after media widening could fail the stricter reader,
had media claimed a definition into a body pair;
neither shape stored such a record,
and a false miss would cost one round bought twice,
never a wrong page.

Cache:
no version moved;
no record's shape changes,
and a record the reader refuses is replaced.

Recurrence:
`mistake-prevention.md`,
"Files a later run reads back":
the check a fresh answer goes through is its whole reader,
not that reader's first test.
