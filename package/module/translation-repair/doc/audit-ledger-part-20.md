# Audit ledger, part 20

Part 20 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B23: fixed words and phrases found inside longer words (B21, family two)

Status:
fixed,
2026-09-29;
every site the census classed as a finding now reads its word,
name or address as one.
Class one hundred sixty-three found a glossary term inside a longer word,
and area one bounded the glossary's matcher (C1).
This pass reads every other site that looks for a fixed word or phrase in text,
starting from the 460 of 668 `includes`,
`indexOf`,
`startsWith` and `endsWith` calls whose needle is not a literal
(`~/temp/agent/audit-glossary-fix/b23-needle-census.mjs`).
Those that test membership of a list were set aside,
and each text search was classed as bounded already,
a deliberate substring
(quote and evidence containment,
the declared-name projection,
a pinyin prefix),
a needle with Han edges only,
or a finding.

#### The refusal readers

`detectRefusalShape` (`refusal.ts`),
the picture refusal phrases (`image-reading-sense.ts`)
and the inability markers (`reading-refusal.ts`)
matched raw substrings of text with straight quotes:
"as an ai" fired inside "as an aide",
"i cannot" inside "taxi cannot",
"load" inside "download",
"quality" inside "equality",
and a reply opening with a typographic apostrophe
("I won’t be able to")
was no refusal at all.
`word-bounds.ts` finds a needle whose Latin edges stand at word boundaries,
the glossary's rule;
both opening windows fold their quotes to ASCII first (`normalizePunctuation`),
and the inability markers are read as the starts of words.
Red `d090a0f0a`,
fix `23974cfa8`;
18 mutants,
each undoing one part,
are caught,
and a comment control survives.
A neighbour is read as a whole character,
and since every Latin letter the package names sits in the first plane,
a unit read decides the same;
that mutant would be equivalent and is not run.

Reading markers as word starts dropped every form a prefix joins to one.
Every word of `/usr/share/dict/words` that carries a marker past its start was read
(`b23-inability-lexicon.mjs`).
The forms that still name access to the picture are listed on their own:
download,
upload,
reload,
the stems inaccessib and unaccessib,
and unprocessable and unloadable,
which that list lacks.
The rest
(workload,
payload,
overload,
inequality,
uncorrupted and the like)
name no inability.
Download,
upload and reload stay inability markers
although an absence report could name a download icon,
because the costs differ.
Two absence reports overrule the deterministic reader
and confirm a picture textless (`image-reading-pair.ts`),
so an access failure read as absence is silent.
An absence read as inability leaves the picture unread,
and the visual evidence check then pauses the entry and says why.
The red guard in `d090a0f0a` that took a download icon for absence
became a boatload in the fix.

Measured with the frozen build `2f26f440d` against the fix
(`b23-screen-replay.mjs`):
the 707 distinct stored picture readings,
from 447 reading-store files,
get the same verdict under both.
Over the 409,436 distinct strings of the 370 stored artifacts,
the refusal detector newly reads 22 openings as "i won't be able to"
and 1 as "i can't help",
and no longer reads 2 as "as an ai".
The picture screen newly refuses 291 strings
(274 as a refusal,
17 as an absence report),
every one through a typographic "I can’t" in its opening,
and passes 1 it refused,
a romanized name ending in i before "cannot".
None of those strings is a picture reading;
they show what the phrase list now refuses whichever apostrophe a reading uses.
That list is a heuristic stated as one,
and an English transcription opening with "I can’t" is refused,
as one with a straight apostrophe always was.

No cache version moves.
A gather treats a reply read as refusal-shaped and an unparseable one alike,
both off-shape (`recovery-nudge.ts`),
so the detector changes a log line and the scorecard's counts,
not whose voices a round hears.
The picture screen's verdict reaches a slice key through the reading's words,
which the translate and consolidation keys carry,
and the reading store is stamped with the build's digest.

#### Declared names and the link-name floor

The census had classed the survival guard's projection containment as deliberate,
and it is,
for what the projection sees through:
a `\_` escape,
a space or underscore where the other side writes none,
a name wrapped behind a `> ` prefix.
It also drops the spaces between words,
so containment found a declared key across a word edge:
a candidate that lost "Ann" but said "cannot" kept the name,
and a base that said only "cannot" put an "Ann" it never held at stake.
The guard's header claimed that widening what counts as carried
could only turn a missed loss into a caught one;
that was wrong in both directions.
The link-name floor compared the same projection,
and matched a Latin source form,
a mention and a page handle as raw substrings,
so a tomcat named Tom and `@mi-mi-420` carried `@mi-mi-42`.

The edge rule came from the glue itself,
read by general category only (`b23-projection-bounds.mjs`).
Where a declared key sat inside a longer word in the stored texts,
the long keys and the one settled page were glued by a case change or a digit
inside a handle,
and the lowercase-to-lowercase glue was prose collision
(one handle stem inside a common first name among them).
`name-projection.ts` keeps,
per projected unit,
where its character sits in the text as composed,
and `carriesName` counts a key only where each Latin end meets a word edge,
a letter meeting a digit and a small letter meeting a capital being edges.
The form-inside-form check that reports a lost long form once reads the same way,
so a shorter form running on inside a longer one is its own loss.
The link floor reads its source forms,
mentions and page handles at handle edges,
where a hyphen and an underscore join.
Red `83a3457d0`,
fix `11d029fde`,
the before-edge case `edac4d209`;
15 mutants,
each restoring containment at one site or dropping one edge rule,
are caught,
and a comment control survives.

Measured with the fix
(`b23-projection-final.mjs`):
over every declared and contributor form against the texts of its own entry,
all 285 carriages in the 92 archives
and all 544 on the 214 settled pages stand as names,
and 1,422 of 47,389 in the stored artifacts existed only across a word edge.
Replayed against the frozen build `2f26f440d` over 1,264 archive slices and 3,975 would-ship slices
(`~/temp/agent/audit-floor-replay/names-replay.mjs`):
the survival guard now refuses four would-ship wordings of two slices,
each of which dropped a declared form the incumbent carried as a word
and kept its letters only inside a longer word;
contributor authority moves nothing;
the link floor's three moves on archive slices come from the account-handle rule of `9c085dcd3`,
which the frozen build predates,
and none from this change.
The translate,
consolidation,
contest,
refine and repair versions carry rides-inside accounts
(`3a68938ef`);
the refine and repair accounts rest on the translate replay,
since no stored rewrite or patch was replayed.

#### The page-name note

`declaredNameNote` (`linked-title-declared-name.ts`) matched the source form
and the declared rendering as raw substrings,
while the link-name floor reads the same link at handle edges and as a name.
The note now reads it the floor's way,
so a title rendered "Tomcat" draws a note for a declared "Tom",
an archive writing the handle with an escaped underscore draws none,
and a Latin source form inside a longer word names no one.
The handle reading moved into `handle-token.ts`,
which both read.
Red `b571f4303`,
fix `c60a2f4ff`;
7 mutants are caught,
and a comment control survives.
Over the 92 entries the frozen and current builds write the same linked-title lines,
and the page-name lines ride in the identity context every stage key hashes.

#### The title reference passes

`referenceScope` (`title-reference-scope.ts`) took the first framed line holding the bare title,
so a footnote naming the title without brackets,
ahead of the footnote that brackets it,
held the quote search to the wrong line.
The scope and the unify pass's gate now read one `bracketsTitle`.
`rewriteLocated` (`title-reference-unify.ts`) read any located span
ending with the heading's rendering as the heading's,
so a footnote quoting a longer rendering was never unified.
A quoted,
bracketed or linked span now has to equal the rendering,
and a glossed run,
whose lead-in words the locator cannot separate from the title,
may end with it only at a word edge (`endsWithWords` over `wordStarts`).
Red `10c60dae8` and `4bdb2f614`,
fixes `089bd9388` and `89f4fcba3`.
Restoring a bare gate in the unify pass survived the first mutation run;
a case pinning that a slice naming the title without brackets is left alone now catches it,
and all 6 mutants of the two passes are caught,
with a comment control surviving in each run.
At the pin,
6 of 264 Han heading titles are referenced in brackets
and none has an earlier bare framed line;
on the 273 settled page files no quoted,
bracketed or linked span ends with one of the page's 1,061 heading renderings without being it.

#### The name-gloss restore

`nameGlosses` (`name-gloss-restore.ts`) counted an archive's uses of a glossed name by splitting on it,
and `restoreNameGlossLines` placed the gloss with `indexOf`,
so a longer word carrying the name's letters ("Pipit" for "Pip") counted as a use
and decided where the gloss went.
Both read the name through `wordStarts`.
Red `a6b8a6177` and `5cef56405`,
fix `6ef70915a`;
3 mutants are caught,
and a comment control survives.
At the pin the archives carry 1 gloss line,
and neither its use count nor its place on the 14 settled pages of its entry moves.

#### The work-title lookup

`namesWork` (`work-title-lookup.ts`) tested the bare title with `includes`,
so a result titled "Catcraftopia" read as naming 《Catcraft》,
drew no neighbour warning and could sort first.
It reads the title with `carriesWord`,
and a Han title is found as before.
Red `8c39cc87c`,
fix `a49c3ac80`;
2 mutants are caught,
and a comment control survives.
Over the 58 cached lookup records at hand
(290 hits,
11 titles carrying Latin letters or digits)
no warning moves,
and the lookup lines ride in the identity context every stage key hashes.

#### The unwrapped-link floor

`unwrappedLinkFindings` (`translate-unwrapped-link.ts`) asked
whether the rendering still carries the href with `includes`,
so a bare address that only begins with it (`windowsill-nap.html2`) counted as the destination kept,
and the model was told its destination was intact when it had changed.
It now reads the rendering's `link-url` atoms,
the destination floor's own reading.
That first fix read a rendering the strict grammar refuses as carrying no destination.
Where the original is refused too,
the validator runs only the floors that need no grammar and otherwise answers unknown,
which translate-repair lets stand as written,
so a genuine unwrap there went unrefused.
Such a rendering is now read under plain markdown,
the page side's downgrade,
through the skeleton's own atom walk (`walkAtoms`).
Plain markdown reads a bare destination inside a raw html block as html,
so the floor is silent there,
and its header says so.
Red `49f64c4e3` and `fbe758d77`,
fixes `fc3b3373e` and `28a4ceb63`;
4 mutants are caught,
with a comment control surviving in each run.

Replayed against the frozen build over 1,264 archive slices and 3,975 would-ship slices
(`~/temp/agent/audit-floor-replay/floor-replay.mjs`),
the floor fires on none under either build.
Its positive control (`unwrap-control.mjs`) shows the builds disagree on the longer address
and agree on a genuine unwrap and on a kept link.
`unparseable-link-census.mjs` finds 1 archive slice whose original the strict grammar refuses,
with no link syntax,
and no would-ship slice.
That doubly refused branch runs no destination floor at all,
by the design of F-5;
the census bounds its reach at the pin,
and it is left as it is.

#### The neutral pronoun floor

`neutralPronounFindings` (`translate-neutral-pronoun.ts`) counted TA,
Ta or ta only between listed marks,
whitespace or characters at or above U+2E80,
compared by UTF-16 unit.
The listed 「」 was redundant,
not 『』 missing:
both sit above U+2E80.
What the list missed sat below it:
a doubled Chinese dash or a slash after han in an original,
so the floor never applied to that slice,
and an em dash,
an ellipsis,
an arrow or emphasis in a rendering,
so it passed a kept pronoun.
`pronoun-disagreement-census.mjs` read every occurrence
where the list and a word-boundary reading disagree,
in the pinned originals and archives and every string of the stored artifacts,
by the key holding it and a masked context.
In originals and renderings each one was a pronoun the list missed
(originals of XingZ60,
Mizuki_Yuuki and qianyuanakg;
renderings of XingZ60 and noname),
and the rest sat in judges' reasons.
A bare word-boundary reading would lose what the floor's tests pin:
a handle,
a path,
an address and the interjection "ta-da" are not the pronoun.
`tokenStarts` (`word-bounds.ts`) reads a word standing as a token of its own:
the run of Latin word characters and address joiners around it,
trimmed of joiners at its ends,
is the word alone,
and a word after a mention mark is a handle.
The floor counts with it,
which retires its UTF-16 comparison too.
"he/TA" and "Well...Ta" read as one token each,
as under the list,
and the census found neither.
Red `79d588b5e`,
fix `2c0cc08d8`;
7 mutants are caught,
and a comment control survives.

`pronoun-entry-census.mjs` reads TA in 2 of the 92 sources,
Ta in 7 and ta in 8 under the token reading,
the figures the floor's header gave on 2026-09-04;
the list read Ta in 6.
Replayed against the frozen build (`floor-replay.mjs`),
4 slices fire under both,
none clears and none is added:
three archive slices of XingZ60,
whose archive keeps a bare TA,
and one would-ship slice of SS3B_0016,
a settled wording the frozen build already refused.
The frozen build predates the F-9 source gate,
so the 4 were also read under the floor as it stood before this fix
(`pronoun-previous-check.mjs`),
which fires on all 4.
The positive control (`pronoun-control.mjs`) shows the builds disagree on a dash in a rendering.

#### Cache accounts

No cache version moves for these sites.
The unwrapped-link and neutral pronoun floors give the same verdict on every replayed slice,
the page-name and lookup lines ride in the identity context,
the gloss and title passes move nothing on the settled pages,
and every per-entry cache is stamped with the build's digest.
Prevention:
`mistake-prevention.md`,
"Words inside words".

### B24: straight against curly quotes (B21, family three)

Status:
fixed,
2026-09-29,
site by site with each site's exposure measured;
the sites the pinned corpus cannot reach are recorded as unexposed and left as written.
A comparison of text that one side writes with curly quotation marks
and the other with straight ones,
or with corner brackets where the other writes English quotes,
failed wherever it compared bytes.

#### Two folds, for two questions

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

#### Evidence sites

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

#### Typography sites

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

#### Guillemets and the editor sheet's marker

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

#### Measured and left as written

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

#### Mutants and caches

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

### B25: the attestation checked a reference quote against every reference at once

Status:
fixed,
2026-09-29.
Found while fixing the attestation's quote fold (B24):
`verifiedAttestations` looked for an item's reference quote anywhere in the reference block,
while the sheet told voices an entry is discarded unless the quote is found "in the named reference".
So an item kept the number it answered even when that page does not state it,
the `- attested:` line every sheet carries then credited the wrong page,
and a quote running from the end of one reference line into the next verified,
since `compacted` removes the line break between them.
Only verified items were logged,
so a lost vote left no trace in a run log.

Measured with `~/temp/agent/audit-glossary-fix/b25-named-reference.mjs`,
which rebuilds each entry's reference lines from the lookup cache with `referenceLineOf`
and reads every `ATTESTED item` line of every run log:
106 verified items are logged,
25 could not be rebuilt from the cache,
and all 81 of the rest quote the reference they name.
The positive control names the next reference instead
and moves all 49 of the checked items on entries with two or more references.
So no stored result moves.

The fix reads the block one line per reference.
`reference-line-head.ts` owns the head both ways:
`referenceLineHead` writes it at both lookup sites,
and `numberedReferenceLines` reads the number back
and throws `ReferenceLineHeadError` on a line without one,
naming where the line sits and never what it says.
`reference-attest-verdict.ts` gives each item a verdict:
verified under the named reference,
relabelled to the first reference whose line states the quote,
or dropped with the side not found;
the stage logs every verdict.
Relabelling rather than dropping is a quality call under the owner's standing directive,
open to veto:
the quote was found word for word,
a lost vote can cost the detail its quorum,
and a detail that misses its quorum reaches no sheet,
which is the Mio20 loss the cited-reference rule was written against;
the confirmation round still asks the bench about every candidate.
The lookup now folds the endpoint's failure tag onto its line too,
so the block stays one line per reference.
The refusal found a fixture drift on its first run:
`reference-attest-confirm.unit.test.ts` wrote its reference as `REFERENCE 1 <url>`,
a form the lookup never writes.
The sheet's consequence clause now says what is kept
(word for word,
spacing and quotation-mark style aside,
the reference quote within one reference's line),
and its instructions stay strict.
Red `44e02fcda`,
fix `5bf2388ff`,
sheet `f2ddc237c`.

Left open,
and closed by B104:
a reference quote is looked for in the whole line,
head included,
so a quote of a page's address or title verifies as if the page stated it.
The body cannot be cut from the line reliably while a title may itself contain the separator,
so this waits on a line format that marks where the body starts.
B104 reads the title as the page's own,
as B28 already did,
so only the address needs cutting,
and an address holds no space.

### B26: wordings that differ from what stands only in layout (B21, family four)

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

#### What the page shows

The site renders a soft line break as a space.
The data repository compiles every page with `remark-math` and nothing that turns a newline into a break
(one-among-us/data `scripts/mdx.ts`),
and the front end sets no `white-space` rule on the page container
(one-among-us/web).
So a proposal that is the archive with its soft breaks elsewhere publishes the page the archive already publishes.

#### Measured before the fix

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

#### The fix

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

#### Read and left as written

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

#### What the fix moves over the stored runs

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

#### Mutants and caches

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
