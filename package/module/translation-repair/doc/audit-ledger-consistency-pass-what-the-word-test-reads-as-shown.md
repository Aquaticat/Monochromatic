# Audit ledger: the consistency pass, what the word test reads as shown

The word test at a span edge decides whether a quote ends inside a word that a reader sees.
It reads the shown text:
what the page shows after the parse,
with the units that show nothing stepped over.
This file holds the findings of the review of n159 about what that reading stepped over wrongly,
or failed to step over:
a hidden stretch whose units were read one by one (B616),
markup that separates or annotates and was read as invisible (B617),
and inline code beside a text place (B618).
It also holds the rows of the twin check that stay open (B619).
The first three are fixed by n161 and landed on 2026-10-15 with the tests `5fe3173cc5` and the code `277145a862`.

The principle itself,
and the rounds that built it,
are filed in
[Audit ledger: the consistency pass, span edges as whole units](audit-ledger-consistency-pass-span-edges-as-whole-units.md)
(B597 and B598)
and in
[Audit ledger: the consistency pass, elisions, quoted numbers and pairing](audit-ledger-consistency-pass-elisions-quoted-numbers-and-pairing.md)
(B605).
The other findings of the same review are filed in
[Audit ledger: the consistency pass, definitions inside containers, fragment landings and the mask memory](audit-ledger-consistency-pass-definitions-landings-and-the-mask-memory.md)
(B620 to B622),
in
[Audit ledger: files a later run reads back](audit-ledger-files-a-later-run-reads-back.md)
(B624),
in
[Audit ledger: comments, TSDoc and source text](audit-ledger-comments-tsdoc-and-source-text.md)
(B625)
and in
[Audit ledger: test cases that cannot fail](audit-ledger-test-cases-that-cannot-fail.md)
(B626).

Written on 2026-10-15 (UTC) from the review of n159 (`s231/review.md`),
the hand-backs of n159 (`s230/handback-n159.md`) and n161 (`s232/handback-n161.md`)
and the lead's notes of that day.
The labels Y1,
Y2 and Y4 are the review's own and are no ledger ids.
The labels of probe scenarios,
the names of probes and the names of logs are the sources' own too.
A path that starts with `src/` is under `package/module/translation-repair/`.
Every function,
type and constant of the package named here was found declared in non-test source of the tree `w153`
at `277145a862`
by one search of declarations on the day of writing.
The names that only a review or a hand-back gives
(test names,
guard names,
the names of probes and the names of logs)
were not searched.
No line numbers are cited,
since the tree is still changing.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## B616: a reference, an escape or an astral character inside a hidden stretch was read as shown

Found on 2026-10-15 by the review of n159
(n160,
finding Y1).

Outcome written on 2026-10-15.
Fixed by n161;
red `5fe3173cc5`,
fixed in `277145a862`.

What a reader of the page would have seen:
a half word in one group of inputs,
and a repeated phrase left in its old wording in the other.
An emoji inside a hidden title or comment was kept as a shown character that is no word character,
so no cut was seen and the splice ran:
`The [kit](u "🐱")tens ate` and `The kit<!-- 🐱 -->tens ate` with `kit` shipped
`The [dogs](u "🐱")tens ate.` and `The dogs<!-- 🐱 -->tens ate.` with the outcome `replaced`,
which reads `dogstens`.
A reference or an astral letter inside a hidden destination,
title or attribute was read as shown,
so a whole word beside it was refused:
`foo [kit](u "a&#116;b") ate`,
`foo <a href="x&#116;y">kit</a> ate`,
`The [kit](u "𝓠") ate`,
`The [kit](https://x.example/𝓠𝓾𝓪𝓷) ate` and `The <a title="𝓠">kit</a> ate`,
each with `kit`,
gave `none` where the old build gave `once`,
and at page level `[kit](https://x.example/𝓠)` stayed `kit` with the place `unlocated`.
The ASCII controls (`[kit](u "x")tens` and `[kit](https://x.example/Q)`) behaved as the ruling says.
The twin check,
which compares the text with the invisible delimiters against the same text without them,
found 864 to 862 sequences per group (a reference in a destination,
a title or a tag attribute) that decide `once` in the twin and `none` with the hidden part.

The cause:
`cutsShownWord` in `src/consistency-shown-edge.ts` kept a unit unless it was one unit wide and hidden at its start,
so a reference or an escape (several units)
and an astral character (two units) inside a hidden stretch survived the filter.
`transparentUnitsOf` in `src/consistency-unread-units.ts` already flagged every unit of those stretches.
The header of `src/consistency-unread-units.ts` said that a character reference "is not here",
which only the filter could make true (B625).

Reach on the corpus:
none by the review.
It found no reference inside a destination,
a title or a tag,
and no astral character inside a destination,
a tag or a comment
(astral characters stand on 4 pages,
none in those places),
and each search was run against a control page holding a known hit for the pattern.
n161's corpus measure moved no decision on any of the 92 pages.

The lead ruled on 2026-10-15:
fix it,
and filter by the flag of the first unit for every unit of a hidden stretch.

Fixed by n161:
a unit is hidden by the kind of its first character,
whatever its width,
so a reference,
an escape or an astral character inside a link destination,
a title,
a tag attribute or a comment is hidden whole.
Tests:
`src/consistency-shown-edge-markup.unit.test.ts` (new,
with rows for B616,
B617 and B618);
the rows of this entry were 7 red on the build made before any source edit.
The guard that restores the width-one rule fails 9 rows.
Rerun of the review's probes on the final build:
`foo [kit](u "a&#116;b") ate` and `foo <a href="x&#116;y">kit</a> ate` with `kit` went from `none` to `once`,
the page-level row for a math letter in a destination went from `unlocated` to `replaced`,
and the rows for an emoji in a title or in a comment with half a word to the right went from `replaced` to `unlocated`,
as the ASCII rows already were.

## B617: tags and markup that separate or annotate were read as invisible, so words across them were one word

Found on 2026-10-15 by the review of n159
(n160,
finding Y2).

Outcome written on 2026-10-15.
Fixed by n161;
red `5fe3173cc5`,
fixed in `277145a862`.

The review framed it as a gap in the ruling and not as a slip of the author:
the ruling of B597 lists tags among the transparent units,
so stepping over a tag is what the ruling says,
and it did not tell a tag that wraps text from a tag that separates blocks or annotates text.
The harm was a repeated phrase left uncarried at those places,
never a half word.

What a reader of the page would have seen:
separate lines,
cells,
blocks,
or a ruby base with its annotation,
where the word test read one word.
`cats<br/>dogs` with `dogs`,
`cats<br />dogs` with `cats`,
`cats![pic](u)dogs`,
`<ruby>kan<rt>ji</rt></ruby>`,
`| cats | dogs |` (the cell pipes and the padding are hidden units),
`<p>The kit</p><p>tens ate</p>`,
`<ul><li>cats</li><li>dogs</li></ul>`,
a table of `<td>` cells and `<details><summary>The kit</summary>tens ate</details>`
gave `none` where the old build located the word.
`cats<br>dogs` with no slash still located,
so one line break was read two ways.
At page level `The dogs bowl.<br/>kit<br/>A cat naps.` left `kit` (`unlocated`),
and so did a table cell `kit`.

The cause:
`transparentUnitsOf` in `src/consistency-unread-units.ts` set the hidden flag
for every unit outside a text node except line breaks,
which took in the cell pipes,
the padding inside a table row,
every tag and the `![](u)` of an image,
and `cutsShownWord` then stepped over all of them.

Reach on the corpus:
one page.
The ruby annotation `<ruby>reload a save file<rt>OVERLOAD</rt></ruby>` on `windward0032`,
slice 24,
put `file` and `OVERLOAD` among the 23 word-test decisions that n159 changed (B597),
though the author's account called all 23 "each now cutting like its plain-text equivalent".
Every other tag of the corpus
(`p`,
`br`,
`details`,
`summary`,
`h3`,
`div`,
`blockquote` and components)
never has a letter or a digit on both sides;
the only run of tags with a word character on both sides in 92 pages is the `<rt>` one.
The corpus holds no table and no image,
and `<br/>` touches a letter on one side twice on `XingZ60` and never on both.

The lead ruled on 2026-10-15:
fix it.
Separating and annotating markup is a word boundary and not transparent:
`<br/>` with or without the slash alike,
block tags,
table pipes and padding,
images and `<rt>`.
The ruling changes 2 decisions on `windward0032`.

Fixed by n161:
- `src/consistency-shown-kinds.ts` (new) holds `unitKindsOf`,
  `UnitKind` and `BOUNDARY_TAG_NAMES`.
  A break with or without a slash,
  the CommonMark block tag names,
  `hr`,
  `img`,
  `rt`,
  `rp`,
  images and table rows (pipes and padding) read as a space.
  Inline wrappers (`b`,
  `i`,
  `em`,
  `strong`,
  `span`,
  `a`,
  `u`,
  `s`,
  `sub`,
  `sup`,
  `ruby`,
  `mark`,
  `small` and `code`) stay transparent.
- `src/consistency-markup-ranges.ts` (new) holds `markupRangesOf` and `NO_MARKUP_RANGES`.
  `ProseView` in `src/consistency-prose-text.ts` gained `images`,
  `tableRows` and `codeContents`,
  and `src/consistency-reading-barrel.ts` exports `BOUNDARY_TAG_NAMES` and `unitKindsOf`.
- The block tag list is typed by hand from the list in `micromark-util-html-tag-name@2.0.1` (plus `br`,
  `hr`,
  `img`,
  `rt` and `rp`),
  because that package is no declared dependency of this one and adding a dependency was outside the brief.
  `src/consistency-shown-kinds.unit.test.ts` reads the installed parser's list through the `remark-parse` chain
  and fails when a name it holds is missing here.
  The lead accepted the hand-typed list under that test.
- Tests:
  the rows of this entry in `src/consistency-shown-edge-markup.unit.test.ts`
  (21 red on the build made before any source edit),
  `src/consistency-shown-kinds.unit.test.ts` (3 red by missing exports),
  and `src/consistency-markup-ranges.unit.test.ts`.
  The guards that stop a tag,
  an image or a table row from being a boundary fail 19 and 4 rows (tags),
  4 and 3 (images),
  and 4 and 3 (table rows).
  The first guard written for this finding stopped reading a boundary unit as a space and changed nothing a reader sees,
  because a boundary's own characters (`<`,
  `b`,
  `r`) are no word characters either;
  it was replaced by these three before it counted.

Corpus effect:
the two `windward0032` slice 24 decisions are restored,
so the word-test changes of n159 go from 23 on 9 pages to 21 on 8 pages and nothing else moves.
A direct check of the slice (379 units) gives `once[191,195)` for `file` and `once[199,207)` for `OVERLOAD`,
as the build before n159 does.
The twin check's `br` group went from 442 to 2,542 mismatches,
the new 2,100 all `none` to `once`
(`kitkitkit<br/>kit` is now `once` where the text without the delimiter says `none`).
That rise is the change by design:
the twin's definition,
delete the invisible delimiter,
no longer describes a break.

## B618: inline code beside a text place still shipped a half word, and the headers said a floor refused it

Found on 2026-10-15 by the review of n159
(n160,
finding Y4).

Outcome written on 2026-10-15.
Fixed by n161;
red `5fe3173cc5`,
fixed in `277145a862`.

What a reader of the page would have seen:
a code word fused with a text word.
`` The `kit`tens ate. `` with the place `tens` shipped `` The `kit`dogs ate. ``,
and `` The kit`tens` ate. `` with the place `kit` shipped `` The dogs`tens` ate. ``,
both with the outcome `replaced`,
which reads `kitdogs` and `dogstens`.
The build before n159 did the same,
so the shape predates the round.
The author's account and the header of `src/consistency-unread-units.ts`
said that the inline-code floor refuses this by its own rule.
The floor refuses only a place inside the code,
and not a text place beside it.

The cause:
`transparentUnitsOf` in `src/consistency-unread-units.ts` hid the code content with its backticks,
so `src/consistency-shown-edge.ts` saw nothing of the code word.
The typography side reads the code content as shown (`src/typography-shown-view.ts`),
so the two readers disagreed about one unit.

Reach on the corpus:
none.
Backticks occur on 3 pages and no letter or digit touches a code span
(the search found 0 lines,
and its control page gave 2).

The lead ruled on 2026-10-15:
fix it.
A text place beside inline code reads the code word as shown,
in agreement with `src/typography-shown-view.ts`.

Fixed by n161:
`transparentUnitsOf` now shows the code contents of the view,
and its header is rewritten (B625).
The rows of this entry in `src/consistency-shown-edge-markup.unit.test.ts`
were 2 red on the build made before any source edit,
and the guard that removes the code contents fails 4 rows.
Rows 7 and 8 of the `p1-edges` probe went from `once` to `none`,
and the two page-level rows (code before the word and code after it) went from `replaced` to `unlocated`,
with the page unchanged there.

## B619: a hidden reference then an apostrophe before the word still decides differently from the plain text

Found on 2026-10-15 by the rerun of the twin check in n161,
after the fixes of B616 to B618.

Open.
Reported by the author and not fixed;
the lead recorded it as open on 2026-10-15.

The twin check compares each input with the same input without its invisible delimiters,
and reports where the two decide differently.
After B616 the groups for a reference inside a destination and inside a title went from 982 to 144 mismatches,
and the group for a reference inside a tag attribute from 984 to 122.
In each of the two groups,
`link-ref-in-dest` and `link-ref-in-title`,
26 rows of the kind `once` to `none` remain:
the plain-text twin locates the word once,
and the text with the hidden part refuses it.
All 26 have the shape `X[](u&#116;)'kit`,
a hidden reference and then an apostrophe before the word.
They stood inside the 982 before the round,
and the author could not explain them by the changes of the round.

Not known:
whether the refusal is right,
since an apostrophe before the word may be a mark the word test reads,
or a wrong refusal where the twin is right.
No one has traced which of the two it is.

Reach on the corpus:
the inputs are constructed.
The corpus reach is being measured by the review of n161,
and its answer is not filed yet.
This entry stays open until it is.
