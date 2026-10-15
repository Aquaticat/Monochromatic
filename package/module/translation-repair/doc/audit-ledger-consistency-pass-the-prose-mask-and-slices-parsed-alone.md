# Audit ledger: the consistency pass, the prose mask and slices parsed alone

Typography may change only what the page parse shows as prose text.
It curls a mark,
restores the ellipsis,
places the guillemets and unifies the quote style of a page.
This file holds the finding of the review of n154 that made it so (W1),
the cache versions that moved with it,
and the findings of the review of n156 about the mask and about the readers that parse a slice alone:
a footnote or reference definition held in another slice,
an edit-region fragment that the grammar refuses alone,
a link whose label is an address,
two untrue sentences,
a refusal of the grammar that no one hears,
and a guillemet floor that stands aside.
W1 is fixed by n156 and X3 is landed by the lead;
X2,
X4,
X5,
X6,
X8,
X10 and X11 are decided and not yet landed.

The findings about span edges are filed in
[Audit ledger: the consistency pass, span edges as whole units](audit-ledger-consistency-pass-span-edges-as-whole-units.md),
those about elisions and pairing in
[Audit ledger: the consistency pass, elisions, quoted numbers and pairing](audit-ledger-consistency-pass-elisions-quoted-numbers-and-pairing.md),
and those about the refusal run in
[Audit ledger: the consistency pass, what the refusal run steps over](audit-ledger-consistency-pass-what-the-refusal-run-steps-over.md).

Written on 2026-10-15 (UTC) from the reviews of n154 and n156
(`s224/review.md` and `s227/review.md`),
the hand-back of n156 (`s225/handback-n156.md`)
and the lead's notes of that day.
The labels W1 and X2 to X11 are the reviews' own and are no ledger ids.
The labels of probe scenarios and the names of probes and logs are the sources' own too.
A path that starts with `src/` is under `package/module/translation-repair/`.
Every function,
type and constant of the package named here was found declared in non-test source of the tree `w158`
by searches of declarations on the day of writing.
The names that only a review or a hand-back gives
(test names,
guard names,
the names of probes and the names of logs)
were not searched.
No line numbers are cited,
since the tree is still changing.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## B606: typography rewrote marks inside link destinations, titles, addresses, expressions, code, math and comments

Found on 2026-10-15 by the review of n154
(n155,
finding W1).

Outcome written on 2026-10-15.
Fixed by n156;
uncommitted at the time of writing;
commit:
pending.

What a reader of the page would have seen:
a link to a wrong address
(`[Peter](https://en.wikipedia.org/wiki/Peter_O'Toole)` became `Peter_O’Toole`),
a lost link title
(`title` went from `"The dogs"` to `null`),
code samples with curly quotes that no longer run,
and math with a curly prime.
The page parse refused some of the curled text
(`{“a”}` and `alt=“d”` after a `>` inside an expression),
and the page-assembly guard would then withdraw the slice
(unverified,
the reviewer did not run the guard on these pages).
The page pass `unifyQuoteStyle` fires where curly prose marks outnumber straight ones,
and in one run it changed 36 marks,
among them the contents of a `~~~js` block.
The direct calls showed the same for an indented block,
double-backtick code,
`$f'(x)$`,
`$$` blocks and `<!-- it's "here" -->`.
Single-backtick code,
backtick fences,
four-backtick fences,
attributes of an ordinary tag and angle autolinks were left alone.

The cause:
the old mask in `src/typography-prose-mask.ts` toggled code per backtick character
(so double-backtick code was prose after the second backtick),
ended a tag at the first `>` (so `ok={a > b}` leaked the rest of the tag),
and masked only a backtick span and a tag.
Link destinations and titles,
fences by tilde,
expressions,
math and addresses were never masked.
The edits reached it through `src/corpus-run/quote-style-unify.ts`,
`src/corpus-run/page-slice-rewrite.ts` (every slice except front matter and sealed spans)
and `src/corpus-run/would-ship-text.ts` (`inArchiveTypography`,
every wording).
The finding predates n154.
The lead had asked for it as a check,
and the author's account of n154 listed only the case of the link destination and declined it,
which was the smallest of the set.

The lead ruled:
typography touches only what the page parse shows as prose text,
and one mask built from the parse is shared by every typography reader.
A raw search of the corpus found 23 pages that hold a link,
an expression or code with a quote mark in it.

Fixed by n156.
`proseMask` in `src/typography-prose-mask.ts` is rewritten to build the mask from the page parse:
front matter is no prose (a refusal of its split gives an all-false mask),
and the body goes through `parseSliceBody`.
A unit is prose when a text node of the tree covers it and the parser read it as written
(the written character equals the masked one,
so comments,
lone container tag lines and invisible-only lines are subtracted).
A link whose source does not start with `[`,
an autolink or a bare address,
makes its children no prose.
A text that the grammar refuses (`MdxParseError`) has an all-false mask,
so no design decision about prose is made on a page that the pipeline would not ship,
because the page assembly refuses it first (`src/corpus-run/page-assembly-guard.ts`).
The mask is memoised on the text (32 entries).
`src/parse-slice-body.ts` gains the type `InvisibleLinesReading` (`'blank'` or `'text'`),
the parameter `invisibleLines` (default `'blank'`,
the old behaviour) and the returned `masked` text.
`proseMask` is exported from `src/index.ts` so that the test reaches it.
Five readers call `proseMask({`:
`restoreTypography`,
`src/restore-ellipsis.ts`,
`straightenProseQuotes` in `src/quote-normalize.ts`,
`proseGuillemets` in `src/translate-guillemets.ts`
and `src/corpus-run/quote-style-unify.ts`;
a source scan in `typography-prose-mask.unit.test.ts` asserts that each of the five does,
so no reader keeps a scanner of its own.
Their header and TSDoc sentences now say that links,
tilde fences,
expressions,
math,
comments,
addresses and front matter are no prose.

Three places where the parse says something other than the ruling's list,
accepted by the lead:
an indented line is prose,
because the MDX grammar the site compiles has no indented code
(a fenced block of any kind is no prose);
an angle autolink such as `<https://x.example/O'Toole>` is a refusal in MDX,
so that text has no prose at all,
while bare and `www.` addresses are no prose and the marks after them are;
and a backslash-escaped mark in prose (`\'`) is flagged prose but stays as written.

The corpus measure of n156,
on the final build,
over the 92 pages and 1,237 slices (none refused):
`restoreTypography` as a curly page changed 279 characters,
none outside prose;
as a straight page it changed 179,
none outside (50 slices change length,
the ellipsis);
and the real `unifyQuoteStyle` on the page as it is changed 106,
none outside.
The positive control of ten W1 shapes changed 22 characters before,
17 of them outside prose,
and 5 after,
none outside.
So the reach of W1 on the corpus is zero changed characters:
the defect is real for synthetic inputs,
and the tests carry it.
Straight marks outside prose in the corpus:
456 in 53 pages in flow elements,
56 in 7 pages in text elements (already protected by the old tag mask),
and 14 in 2 pages in lines the mask removes.
No corpus page has a quote in a link destination or title,
an address,
code,
math or an expression.
The recount of the elisions moved from 70 to 115 mismatches
(`orig ’ -> out '` from 7 to 48 and `orig ‘ -> out '` new at 4):
the 45 added rows are all marks that the ruling makes no prose,
36 in comments,
12 in front matter and 4 in other non-prose
(an inline code span with a stray backtick and string literals in expressions),
no prose mark among them,
and the one original elision mark (`’round`) is still restored.
One page of the 92 (`ArtsEpiphany`,
120 characters) has no prose at all,
and none is refused for a reason that would hide prose.

The tests were red first:
the new `typography-prose-mask.unit.test.ts`
(8 behavioural failures),
the new `restore-typography-prose.unit.test.ts` (41),
and the page cases of `quote-style-unify.unit.test.ts` (9),
with controls that pass before and after.
The guards failed:
a mask that is all true (12,
53 and 11 failures),
and a reader with a scanner of its own (the test that the mask is the one scanner of prose).

## B607: the cache versions of the three stages that store restored text moved

Found on 2026-10-15 by the author of n156,
as the step "Before a run launches" of `mistake-prevention.md` requires after B606.

Outcome written on 2026-10-15.
Moved by n156;
uncommitted at the time of writing;
commit:
pending.

The change alters text that a cached outcome stores,
so three versions moved:
`SLICE_CACHE_VERSION` from 34 to 35 (`src/repair-slice-key.ts`:
the outcome of a repair holds the replacement with `restoreTypography` applied in `src/apply-patch.ts`),
`REFINE_CACHE_VERSION` from 5 to 6 (`src/refine-slice-key.ts`:
the rewrite is stored restored),
and `TRANSLATE_SLICE_CACHE_VERSION` from 15 to 16 (`src/translate-document-contract.ts`:
the typography fold in `collapseKey` and the guillemet floor read the same mask).
Each has an account paragraph.
The consistency cache version did not move:
it stores ballots only and counting is not stored.
The two pinned hashes moved with the versions
(`repair-slice-key.unit.test.ts`,
red first,
and `LEGACY_WINDOWLESS_KEY` of `translate-slice-key.unit.test.ts`),
and `own-unit-tests.unit.test.ts` lost `src/typography-prose-mask.ts` from its allowlist,
since the file has a test of its own now.

The exception that the document allows,
that no cache file was written after the change,
could not be proven.
`cache-account-audit` finds no record under the worktree's own runs directory,
and a metadata `find` over the replay runs directory found no slice-cache file newer than the setting of 34,
but its control since January found nothing either,
so it proves no absence.
The author listed that `find` among its breaches (M216).
A bump costs nothing if no record exists and is required if one does.
The lead kept the bumps:
no record can be shown absent,
and the next run uses a fresh runs directory either way.

## B608: two cache versions whose own accounts name the changed readers did not move

Found on 2026-10-15 by the review of n156
(n157,
finding X3).

Outcome written on 2026-10-15.
Landed by the lead;
uncommitted at the time of writing;
commit:
pending.

`CONSOLIDATE_CACHE_VERSION` was 21 (`src/consolidate-key.ts`)
and `LANE_CONTEST_CACHE_VERSION` was 6 (`src/lane-contest-key.ts`).
The account of the first says that the consolidation slate collapses twins through `collapseKey`
and `straightenProseQuotes`
and that its validator refuses prose guillemets,
and the account of the second says that the lane eligibility validator refuses prose guillemets.
n156 changed both readers:
`wordingKey` now keeps apart two renderings that differ only by a curly against a straight mark
in a comment or in a link address
(they collapsed under the old mask),
and `guillemetFindings` returns no finding for a candidate that the grammar refuses.
The reason for moving the three versions of B607 holds for these two equally,
and `mistake-prevention.md` moves the version for "a change that alters what the stage asks or accepts".
What a reader sees:
nothing directly;
a stored slate or contest outcome written under the old reading would be served under the new one.
The lead's reason for not adding more,
that the next run uses a fresh runs directory,
lowers the urgency and not the argument of parity.
The reviewer did not read the lane-contest code that calls the validator,
and the finding rests on the two accounts.

The lead ruled and did it:
`CONSOLIDATE_CACHE_VERSION` from 21 to 22 and `LANE_CONTEST_CACHE_VERSION` from 6 to 7,
each with an account,
in the tree `w158`;
no test pins either version (a search of the tests).
The consistency cache (version 4) stores ballots only and counting is not stored,
so the word test of B596 moves no number.

## B609: a doubled mark ships when the footnote or reference definition is in another slice

Found on 2026-10-15 by the review of n156
(n157,
finding X2).

Decided on 2026-10-15;
not yet landed;
commit:
pending.

What a reader of the page would see:
`dogs’¹’ bowl`,
a mark,
a footnote number and a second mark.
The English of one slice is `The dogs’ bowl is full. The kittens[^1]’ bowl is empty. A cat naps.`
with the definition `[^1]: A note.` in the next section,
the usual layout,
and the chosen words are `dogs’`.
The page ships `The dogs’[^1]’ bowl is empty` (`replaced`),
and so do `kittens[^1] ’`,
`kittens[^1][^1]’` and `kittens[x][r]’` with `[r]: https://x.example/r` in the next section.
The same text with the definition in the same slice is kept (`kept-current`).
The comments of `src/consistency-closing-marks.ts` call exactly `dogs’[^1] ’`
a second mark for the eye that the run must not hide.

The cause,
by the reviewer's best reading,
the deciding function not traced:
`textBlocksOf` in `src/consistency-paragraphs.ts` parses the English of the slice alone,
where a reference without its definition is plain text `[^1]`,
so there are visible characters between the marks.
Only a definition inside the slice makes the label an unread unit.
It has the same root as B615:
a slice parsed alone cannot resolve a label whose definition lives elsewhere.
`src/refine-envelope.ts` states the same limit
("a paragraph parsed alone cannot resolve a reference")
and collects the page's definitions for its gate,
which is the precedent for the fix.
The finding predates n156;
it is the doubled mark that still ships of the fifth item of the review of n154,
in the area that B589 touched.

The lead ruled:
every reader that parses a slice
(the paragraphs and units of the run,
the prose mask)
parses it with the page's definitions,
as `src/refine-envelope.ts` collects them,
through one shared reader of the page's definitions.

Reach,
measured by the lead:
none on the corpus.
No definition label holds a mark and no reference is followed by a mark,
and the search reached all 92 pages.

Not landed.
The plan is that it is built after the launch and landed as its own commit.

## B610: typography goes silent on an edit-region fragment that the grammar refuses alone

Found on 2026-10-15 by the review of n156
(n157,
finding X4).

Decided on 2026-10-15;
not yet landed;
commit:
pending.

What a reader of the page would see:
a region that the editor rewrote keeps straight marks on a curly page
when the region cuts an inline element.
`restoreTypography` with the fragment `He said <b>it's here` (an unclosed inline tag),
`it's here</b> and 'x'`,
`<Note>It's here`,
`It's here</Note>`,
`It's {here`,
`It's a<b and 'x'`,
`It's <3 and 'x'` or `<A><B>It's</B>`
gets an all-false mask and ships unchanged,
where the old scanner curled the prose marks (`<b>It’s here`).
The other direction has the same cause:
a fragment that parses alone but begins inside markup is read as prose,
and `{a} b="it's" /> It's` ships `{a} b=“it’s” /> It’s`,
a mark changed outside prose.
That direction was true of the old scanner as well,
so it is no regression.

The cause:
`src/apply-patch.ts` passes the replacement of one envelope,
`operation.newText`,
and the envelopes are merged intervals of the spans that accepted issues claim
(`deriveEditableEnvelopes` in `src/patch-model.ts`).
The reviewer found no snapping of an interval to a block or word edge in the part it read,
and the author's own text says that the regions run to a median of 75 characters,
so a region that cuts an inline element is plausible;
there is no corpus count of it.
The header claim of `src/typography-prose-mask.ts` that a replacement the grammar refuses
"is refused by the lane before it ships" has no cited support:
the page-assembly guard speaks of a slice that the lanes chose and not of an envelope fragment
or an archive slice that no lane touched (unverified for both).

The lead ruled:
an edit-region fragment gets its mask from the slice it lands in,
with the fragment in place,
and never from the fragment alone.
This fixes the straight marks after `<b>It's here` and the curled attribute tail.

Reach:
the lead measured it at run time only.
Not landed.
The plan is that it is built after the launch and landed as its own commit.

## B611: two sentences of the mask file are not true, and the page pass parses each slice about twice

Found on 2026-10-15 by the review of n156
(n157,
finding X5).

Decided on 2026-10-15;
not yet landed;
commit:
pending.

The header of `src/typography-prose-mask.ts` says that the memory of 32 texts answers nearly every question
because the page pass reads each slice twice,
for its tally and its rewrite.
The tally walks every slice before the rewrite starts (`src/corpus-run/quote-style-unify.ts`),
so the rewrite of slice N finds the memory holding only the last 32 slices.
Measured by the reviewer:
`unifyQuoteStyle` costs about 2.2 parses per slice
(16,000 slices of four paragraphs:
the mask pass alone 9,687 ms,
the whole pass 21,792 ms;
1,000 slices of one paragraph:
the new mask 228 ms against 1 ms for the old scanner).
The memory serves only the repeated reads inside one slice.
The example in the TSDoc of `proseMask` and of `buildMask`,
`proseMask({ text: 'a <b c="d"> e' })`,
is refused by the grammar (an unclosed `<b>`),
so the result is all false,
including the `a` and the `e` that the description calls prose.

The lead ruled:
the page pass reads each slice's mask once and hands it to its tally and its rewrite,
and the memo sentence and the two refused TSDoc examples become true.

Not landed.
The plan is that it is built after the launch and landed as its own commit.

## B612: a link whose label is an address has its label curled

Found on 2026-10-15 by the review of n156
(n157,
finding X6).

Decided on 2026-10-15;
not yet landed;
commit:
pending.

What a reader of the page would see:
the address shown on the page is not the address that opens.
`See [https://x.example/O'Toole](https://x.example/O'Toole) now.` ships the label `O’Toole`
and the destination `O'Toole`,
and `Mail [a'b@c.example](mailto:a'b@c.example) now.` ships `a’b@c.example` over `a'b@c.example`.
A reader who copies the label gets a different address.
The label is a text node of a bracketed link,
so `writesLabel` in `src/typography-prose-mask.ts` says prose.
The review called it small and a decision for a ruling.

The lead ruled:
the text of a link whose label is itself an address is no prose,
where the reading of autolink literals finds an address that spans the label.

Not landed.
The plan is that it is built after the launch and landed as its own commit.

## B613: a refusal of the grammar for a bound is silent for typography

Found on 2026-10-15 by the review of n156
(n157,
finding X8).

Decided on 2026-10-15;
not yet landed;
commit:
pending.

The grammar refuses a block with more than 1,024 emphasis delimiters or more than 256 levels of nesting
(`src/nesting-vocabulary.ts`).
A paragraph of ordinary prose of 13,890 characters with 400 repeats of `*bowl* ... **full**` is refused,
and so are 400 unmatched `[`.
The mask is then all false,
so `unifyQuoteStyle` skips the slice and says nothing.
The pipeline's own parse refuses the same texts,
so for the output of a lane the page is withdrawn first;
whether anything withdraws an archive slice that no lane replaced is unverified.

The lead ruled:
a typography reader that gets an all-false mask from a refusal logs a finding that names the slice.

Reach:
none on the corpus,
since the 1,237 slices of the author's measure all parse;
this is exposure.
Not landed.
The plan is that it is built after the launch and landed as its own commit.

## B614: the guillemet floor stands aside for a candidate that the grammar refuses

Found on 2026-10-15 by the review of n156
(n157,
finding X10).

Decided on 2026-10-15;
not yet landed;
commit:
pending.

`guillemetFindings({ candidateText: 'The cat said «I am hungry.» and {' })` returns no finding,
and with the grammar satisfied it returns one
(`src/translate-guillemets.ts`).
That is safe only if another floor refuses an unparseable candidate before the shipping gate,
and the reviewer did not trace the order of the floors.

The lead ruled:
trace which floor refuses an unparseable candidate before the guillemet floor stands aside,
and if none does,
the guillemet floor refuses it.
To check,
and to fix if needed.

Not landed.
The plan is that it is built after the launch and landed as its own commit.

## B615: a reference label with a straight mark is curled at the reference and left straight at its definition

Found on 2026-10-15 by the review of n156
(n157,
finding X11).

Decided on 2026-10-15;
not yet landed;
commit:
pending.

What a reader of the page would see:
the reference `[b’s]` no longer matches the definition `[b's]`,
so the link shows as the literal text `[the dogs][b’s]`,
and a footnote reference `[^o’k]` has no definition
(whether the assembly guard catches the footnote was not run).
Slice one reads `See [the dogs][b's] and it's.`
and another slice,
in the usual layout with the definitions at the end,
holds `[b's]: https://x.example/b`.
The same holds for `See [dogs' bowl] and it's.` with `[dogs' bowl]: https://x.example/d`,
and for `See the note[^o'k] and it's.` with `[^o'k]: A note.`
The slice parsed alone has no definition,
so `[b's]` is plain text and the mask says prose:
the output is `See [the dogs][b’s] and it’s.`
The slice that holds the definition parses alone as a definition,
whose label is no prose,
and keeps `[b's]:` straight.
Parsed together,
the label is no prose at all,
which is what the page is.
The old scanner curled both ends,
so they still matched.
The review ranked it between B609 and B608,
as a link or footnote that stops working.

The cause:
`src/typography-prose-mask.ts` builds the mask from one text alone,
and its callers hand it one slice or one fragment
(`src/corpus-run/quote-style-unify.ts` and `src/apply-patch.ts`).
It has the same root as B609,
and `src/refine-envelope.ts` is again the precedent.

The lead ruled:
the rule of B609,
one shared reader of the page's definitions for every reader that parses a slice.

Reach,
measured by the lead:
none on the corpus (0 pages;
no definition label holds a mark;
the search reached 92 pages).
The author's own corpus measure had not counted labels with a mark.
Labels are mostly numeric.

Not landed.
The plan is that it is built after the launch and landed as its own commit.
