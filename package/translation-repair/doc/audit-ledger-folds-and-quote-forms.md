# Audit ledger: folds and quote forms

Comparisons that used the wrong fold for their question:
straight against curly quotes,
layout-only differences,
case folds,
and answers checked before they were folded.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## B24: straight against curly quotes (B21, family three)

Status:
fixed,
2026-09-29,
site by site with each site's exposure measured;
the sites the pinned corpus cannot reach are recorded as unexposed and left as written.
A comparison of text that one side writes with curly quotation marks
and the other with straight ones,
or with corner brackets where the other writes English quotes,
failed wherever it compared bytes.

### Two folds, for two questions

`quote-normalize.ts` names both (`7c3b7f6e3`).
The evidence fold (`normalizePunctuation`) asks whether a model's quote is the document's words,
and maps ‘’“”,
「」 and 『』,
and the no-break space.
The typography fold (`straightenQuotes`) asks whether two renderings are one wording
up to what the typography restoration would change,
and maps ‘’“” only,
since a rendering that kept 「」 and one that wrote English quotes are two renderings.
`straightenProseQuotes` reads the typography fold only where the restoration reads,
in prose,
since a quote inside a code span or a tag is content.

### Evidence sites

The archive block review's source-quote anchor (`isArchiveSourceQuoteAnchored`) found a reviewer's quote with a raw `includes`
and counted its minimum in UTF-16 units.
Of the 13 stored source-supported replies,
8 anchor verbatim,
none anchors only after the fold,
and 5 anchor neither way.
Red `b457f1c6a`,
fix `4b9e1519d`.

The reference attestation's `compacted` removed whitespace but not quote style,
so a voice quoting the archive's curly apostrophe straight lost its vote.
The run logs hold 195 extraction summaries with 126 items answered and 109 verified,
and the drops were not logged item by item until B25 made them so.
Red `0103559d0`,
fix `a57e6c4c9`;
the sheet now states the check it gets (`f2ddc237c`).

The introduced-defect screen (`screenEvidence`,
`restatesPriorIssue`) anchored a prober's quote,
and compared it with an accepted issue's,
after folding whitespace only.
Of the 650 stored claims,
562 recompute to their stored verdict,
and one (four-entry-pin-20260901) turns from unanchored to corroborated under the fold.
Red `c8d3f480e`,
fix `74a55e92b`;
the red commit's restatement case named no issue on its region (M58).

### Typography sites

The Latin title floor exempted a bracketed English title the page writes with a raw `includes`.
Replayed frozen against current over every archive slice and would-ship slice,
15 rows fire under both,
none clears and none is added;
the positive control shows the builds disagree on the cat fixture.
Red `2ebde5da3`,
fix `8af5ec09a`.

The page-title lexicon's comparison key folded case and ASCII spaces only,
so "The Cat's Song" and "The Cat’s Song" split their votes,
and its wrapper set lacked 「」,
『』 and underscores.
Nothing is cached under the page-title version:
a find for slice-cache files since 2026-09-28T19:38Z finds none,
and one from 2026-09-27T00:00Z finds 494.
Red `7cc0b1f7f`,
fix `84e647be5`.

The slate's `collapseKey` kept apart renderings that differ only in prose quote style,
which the restoration makes one after the ballot,
so a copy of the incumbent with straightened quotes stood as a second candidate and split its stake.
Of the 2,905 stored translate and consolidation slates,
305 carry such a twin
(327 pairs,
the same under the prose-only and the every-quote reading),
246 of the pairs with the incumbent;
in 30 the chosen candidate was the incumbent's quote-only twin,
and in 7 the twins' summed weight reaches the chosen candidate's.
The repair lane's copy check reads the same key.
Red `d31aad464`,
fix `b3b4e59db`.

The title-reference pass settled several quoted spans by the one whose raw text starts with the heading's rendering,
and called a reference the heading's only on raw equality.
Reading both through the typography fold also exposed a B23 leftover:
the start had no word edge,
so beside a second quoted title "Catnip Days" was taken as the heading "Cat"'s reference
and rewritten to "Cat".
Replayed frozen against current over the 254 settled artifacts,
28 findings stand under both and no replacement differs;
the control shows the builds disagree on both fixtures.
Red `cbee994be` and `0dad08334`,
fix `7a18a1d1d`.

### Guillemets and the editor sheet's marker

The TianqiChen66611 run shipped slice 16 with «» around a quotation,
though one judge's reason on its ballot named the marks.
Across the 266 stored artifacts it is the only comparison row of 6,285
whose lane text carries a guillemet its incumbent lacks,
and no pinned original or archive carries one.
`translate-guillemets.ts` refuses prose guillemets before any judge reads a candidate,
unless the original or the page carries one.
The same characters make the editor sheet's «REGION n» marker,
which the sheet-leak floor now lists with the editor sheet's unfenced `CURRENT TEXT:` and `CONTEXT: ...` heads,
none of which the 184 pinned files carry.
Red `89ab2ce96`,
fix `db9d83146`.

### Measured and left as written

The Han title floor's page exemption compares a title from the original with the page:
none of the 133 bracketed titles in the pinned originals and archives carries a quote mark
(the same scan finds a middle dot in 4).
No heading title stands in ‘’ in the 92 originals
(1 stands in “”,
5 in 「」 or 《》),
and no heading rendering stands in single quotes on a settled page
(16 in “”);
adding single-quote pairs to the title-reference marks would cut a span at an apostrophe for no effect here.
The corpus holds one name-gloss line,
in double curly quotes.
None of the 67 cited links in the originals carries a curly quote,
a CJK bracket or CJK punctuation,
and the archives hold one bare-URL range,
which carries none;
a wider URL-stop set could cut a real IRI.
The sensitivity audit compares document text on both sides,
deduplication keys on located offsets,
and the quote-balance floor's header already says why single marks are left alone.

### Mutants and caches

The mutation batch (`b24-mutants.json`,
one or more mutants for each fold,
wrapper,
floor exemption,
line-head check and verdict branch)
caught 27 of 29,
and its comment control survived.
Reading a reference line without checking its mark survived,
since no refused line carried a number and a space where the head's number stands,
and so did leaving a restated claim's quote unfolded,
since the restatement case quoted straight against a curly issue only.
A list item as long as the mark and the mirrored restatement case (`ccf100940`) now catch both,
with the control surviving again.

Every change rides inside its cache version:
translate 15,
consolidation 20,
lane contest 6,
page title 1,
refine 5 and slice 34 were all set after the newest slice-cache file,
the one of 04:26 UTC on 2026-09-27,
and each account now names the change.
Prevention:
`mistake-prevention.md`,
"Which fold for which question".

## B26: wordings that differ from what stands only in layout (B21, family four)

Status:
fixed,
2026-09-29.
Classes sixty-five and one hundred one were read as their shape rather than their surface:
two operands of one comparison had passed through different whitespace transforms.
The transforms were enumerated first
(`collapseKey`,
the semantic wrap,
`foldSoftBreaks`,
the evidence folds,
and every cut a page composer makes),
then each comparison was asked which transform each side had passed.

### What the page shows

The site renders a soft line break as a space.
The data repository compiles every page with `remark-math` and nothing that turns a newline into a break
(one-among-us/data `scripts/mdx.ts`),
and the front end sets no `white-space` rule on the page container
(one-among-us/web).
So a proposal that is the archive with its soft breaks elsewhere publishes the page the archive already publishes.

### Measured before the fix

Over the 6,285 comparison rows of the 266 stored artifacts,
263 lane texts differed from the archive in whitespace only:
186 render as the archive does
(66 from runs on or after 2026-09-26),
and the other 77 render differently
(32 split or join a paragraph,
29 join two words or split one,
12 add or drop a hard break,
2 indent,
1 changes spacing inside a line,
1 other).
Over the 2,905 stored translate and consolidation slates,
490 carried a candidate rendering as another does beside it,
620 pairs,
443 of them with the incumbent;
in 93 the chosen candidate was the incumbent's layout twin,
and in 8 the twins' summed weight reaches the chosen candidate's.
Both slate counts include line-structured slices,
which the cache records do not mark.
Since 2026-09-26 every pair of lane texts differing from each other only in layout
had one lane on the archive's bytes,
so the contest bought for them was a contest between the archive and its copy.
The soft-break fold alone missed 6 lane texts that were the archive rewrapped,
all blockquotes,
and no slate pair.
Probes:
`f4-lane-whitespace.ts`,
`f4-soft-twins.ts`,
`f4-fold-gap.ts`,
in `~/temp/agent/audit-glossary-fix/`.

### The fix

`wording-key.ts` gives one answer to whether a proposal is the wording that stands.
`wordingKey` is the old `collapseKey`
(trailing whitespace,
blank quote lines,
prose quote style),
and where the line-structure rule does not govern
it reads the text through the wrap and folds each top-level paragraph's soft breaks.
The wrap inside is compared and never shipped;
it catches a blockquote the rule rewrapped.
The key relies on the wrap moving nothing on a second application:
over the 7,462 distinct stored lane and archive texts the first wrap moved 1,876 and the second none.
It leaves front matter as written:
over the 92 archive front-matter blocks neither the wrap nor the fold moved a line,
nor a planted long value,
where both controls moved.
A text whose fenced YAML does not parse is laid out as written (M61).

Seven sites read it:
the slate collapse and the repair turn's copy check;
both lane wraps,
asked before either early return and on the wrapped text,
with a demoted proposal keeping the archive's own bytes;
the consolidation wrap on both branches,
where the `standingAsWritten` key is gone;
the consolidation polish round;
the lane offer;
and the archive block review,
read as prose whatever the block,
since a demotion there only keeps the archive's bytes.
`buildTranslateCandidates` now requires `lineStructured`,
so no slate folds verse by default.
`repairInvalidCandidates` and `laneTextsForSlate` still default it to false,
which every production caller overrides
(`translate-produce.ts`,
`consolidate-produce.ts`,
`consolidate-driver.ts`);
both are handed to family seven,
silent fallbacks,
to take the same required argument.
Two cases that pinned the old behaviour now pin the new:
a rewrap of unwrapped archive wording settles on the slate without buying either round,
and the polish round's finding reads "consolidation-polish is the base in all but layout".
Red `a3d3a04a6`,
fix `eabe073e3`.

### Read and left as written

The lane relation and the contest's slice test
(`judgeSlice`,
`judgeTwoLaneSlice`,
`contestEligibleIndexes`)
compare bytes as artifact generation 2 defines them;
the layout twins they met since 2026-09-26 all had one lane on the archive's bytes,
which the wrap demotion now makes the archive standing.
Assembly invariants,
placement offsets,
the archive-original seal,
delivery coherence,
slice-record agreement and the unheard assertions compare bytes by contract.
The consolidation candidate label,
the standing verdict's incumbent check,
the stand-in check and the judged part compare lane texts the wraps now settle,
or archive text with archive text.
Disputed wordings already compare with every whitespace removed.
The published-page check reads the fragment body the splice writes since class one hundred one,
and the carried-insertion check folds both sides.
Of the 187 `trim` calls in the package's source files,
tests aside,
42 are direct blank checks;
the 144 lines carrying the rest parse replies,
logs,
titles or git output,
or test for blank through a variable,
and none compares a trimmed text with an untrimmed one
beyond the lane offer's standing check,
which B26 fixes.

### What the fix moves over the stored runs

Replayed with the current key over the 254 settled artifacts the floor replay can rebuild,
each slice's line-structure flag read from the frozen build's rebuilt preparation
(`b26-replay.mjs`):
of 6,177 comparison rows,
210 were skipped because their archive text is no longer the rebuilt slice's,
and among the rest the lane wraps now keep the archive's bytes for 263 lane texts,
246 on prose slices
(81 from runs on or after 2026-09-26)
and 17 on line-structured ones.
155 of them differ from the archive in whitespace only.
The other 108 differ in prose quote style as well,
which the key has folded since B24:
in 96 the lane had flattened the archive's curly quotes,
so keeping the archive restores them;
in 5 the lane curled the archive's straight ones,
which the typography restoration itself never does to a straight document;
7 keep the same count of curly marks.
The slate counts stay upper bounds:
of the 225 runs whose artifacts rebuild,
2 hold any slice-cache files and none holds a slate,
so a slate's line-structure flag cannot be read back.

### Mutants and caches

The mutation batch (`b26-mutants.json`,
one mutant for each fold of the key,
its line-structured branch,
its front-matter answer,
and each site's demotion)
caught 19 of 20,
and its comment control survived.
Reading the repair turn's copy check on the old key survived:
its case offered the candidate against a page lacking the heading too,
where validation passes it with or without the check,
and the older "REPRODUCED THE INCUMBENT" case had the same shape (M62).
Both now check against a page carrying the heading,
and the rerun (`b26-copy-mutants.json`) catches that mutant and one removing the check,
with its control surviving.
Copy cases `e4cfae398`,
corrected in `f0ddd425d`;
`e4cfae398` carries a correcting comment.

The slate,
the consolidation wrap,
the polish round and the lane offer ride inside translate 15 and consolidation 20,
each account naming the change;
no slice-cache file was written after 04:27 UTC on 2026-09-27,
where a control from midnight finds 494.
The lane wraps run at assembly,
after the slice cache.
The archive block review keeps no cache:
the prepare pass calls it afresh on every run (`pass-prepare.ts`),
no preparation is stored for a resume to reuse,
and neither the review stage nor `archive-block-repair.ts` stores,
persists or memoizes a reply.
The full suite passed on `f0ddd425d` with no failing case.

## B112: the translate and consolidation lanes checked an answer before folding it

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

## B121: one length-changing lower case on a page switched off the archive-name casing veto

Red in `545d9a416`,
fixed in `69816085b`.
`phraseOccurrences` (`corpus-run/archive-name-runs.ts`) lowered the whole text
and returned no occurrence at all when the lower case came out longer,
since its offsets would no longer line up.
One İ (U+0130),
which lowers to two UTF-16 units,
anywhere on a page does that.
`restoreArchiveNameCasing` checks "never in another casing" with `.every` over those occurrences,
which holds over none,
so the veto stopped applying to the whole page,
and a row holding an İ was never restored.
On the red case's page,
a row writing the name "Yarn hall" was rewritten to title case
though the archive also writes the name in lower case,
and the row naming İpek kept its lowered street name.

The scan now lowers one code point at a time (`lengthKeepingLowerCase`),
keeping as written any code point whose lower case has another length,
and lowers the phrase the same way,
so offsets always line up and a kept code point still matches itself.
Measured reach:
none of the 2,837 `.md`,
`.mdx`,
`.json` and `.txt` files of the pinned corpus holds such a code point
(the probe found U+0130 in a control file holding it),
so no pinned archive triggered the defect;
shipped wording still could.
The package's other whole-text lowerings search or fold within the lowered copy
and map no offset back to the original,
so none shares it.
A read-only agent's T8 case had pinned the read-past as intended behaviour;
it was held back.

Recurrence:
`mistake-prevention.md`,
"Which fold for which question".

## B427: straight double quotation marks were not read as quotation

Red `cda53b4338`,
fixed in `566de2e511`.

The reader treated only corner brackets and curly marks as quotation,
so a repeat inside straight double marks was reported.
The pinned corpus writes ASCII `"` in 98 body paragraphs;
two of its characters,
in one paragraph,
reach the wording.

The fix:
a straight mark opens a quotation when none is open in its paragraph,
and closes the open one otherwise.

## B449: the consistency pass compared the judges' quotes as exact strings

Found on 2026-10-12 (UTC) in the read of TianqiChen66623,
the first pass to run the consistency pass,
which changed nothing on the page.
`agreedQuoteOf` and `agreedSlotOf` (`consistency-count.ts`) counted a quote as agreed only when a strict majority
of usable ballots gave the same string.
Three of four judges chose the first place of the repeated sentence,
yet two quoted it without its final period and two with it,
so the place read `no-agreement` and the winner `chosen-unlocated`;
the refrain's quotes split the same way on a line break against a space and a straight against a curly apostrophe.
This is the straight-against-curly and trimmed-text family again,
in a module written after both were recorded.
Changed by the lead's decision,
in work still open when this entry was written:
ballots agree on a place when their quotes locate the same span of its English,
whitespace runs,
quotation-mark style and the punctuation at a quote's edges read as equal,
and later steps use the place's own span,
never a judge's string.
