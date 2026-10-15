# Audit ledger: the consistency pass, definitions inside containers, fragment landings and the mask memory

The readers that parse a slice alone take the page's definitions with them (B609 and B615),
read an edit-region fragment where it lands in its slice (B610)
and share one memory of the prose masks they built (B611).
This file holds the three findings of the review of n159 about those readers:
the definitions that the shared reader still misses (B620),
a fragment landing outside its slice (B621)
and a text that could read another text's mask (B622).
B620 is open.
B621 and B622 are fixed by n161 and landed on 2026-10-15 with the tests `5fe3173cc5` and the code `277145a862`.

The findings that built those readers,
and the cache versions that n159 and n161 moved (B623),
are filed in
[Audit ledger: the consistency pass, the prose mask and slices parsed alone](audit-ledger-consistency-pass-the-prose-mask-and-slices-parsed-alone.md).
The other findings of the same review are filed in
[Audit ledger: the consistency pass, what the word test reads as shown](audit-ledger-consistency-pass-what-the-word-test-reads-as-shown.md)
(B616 to B619),
[Audit ledger: files a later run reads back](audit-ledger-files-a-later-run-reads-back.md)
(B624),
[Audit ledger: comments, TSDoc and source text](audit-ledger-comments-tsdoc-and-source-text.md)
(B625)
and
[Audit ledger: test cases that cannot fail](audit-ledger-test-cases-that-cannot-fail.md)
(B626).

Written on 2026-10-15 (UTC) from the review of n159 (`s231/review.md`),
the hand-backs of n159 (`s230/handback-n159.md`) and n161 (`s232/handback-n161.md`)
and the lead's notes of that day.
The labels Y5,
Y7 and Y9 are the review's own and are no ledger ids.
The labels of probe scenarios,
the names of probes and the names of logs are the sources' own too.
A path that starts with `src/` is under `package/module/translation-repair/`.
The functions,
types and constants of the package named here
(`pageDefinitionsOf`,
`collectDefinitions`,
`fragmentProseMask`,
`restoreTypography`,
`readingForRestoration`,
`proseMaskReading`,
`FragmentLandingError` and `assertLandingInside`)
were found declared in non-test source of the tree `w153` at `277145a862`
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

## B620: the page's definitions miss every container and stop at a single newline

Found on 2026-10-15 by the review of n159
(n160,
finding Y5).

Open.
The lead ruled on 2026-10-15 that it is an open item with zero corpus reach,
and n161 did not touch it.

The page's definitions are the link and footnote definitions that B609 hands to every reader of a slice.
The reader of them misses two kinds of definition.
Each row of the review's probe compares a block read with the definitions
against the same block inside the whole-page parse,
by mask,
visible flags and transparent flags.
- A definition inside a container:
  `- [x]: u` (a list item),
  `> [x]: u` (a blockquote),
  `<div>` then a blank line,
  `[x]: u`,
  a blank line and `</div>` (an HTML block),
  and `1. [x]: u` then a blank line and an indented text.
  `pageDefinitionsOf` returns `''` for each,
  and the paragraph `See [dogs' bowl][x] and 'a'.` then differs from the whole-page parse
  in 5 mask units and 5 transparent units.
- A link definition after a footnote definition with a blank line between them,
  and a footnote of several paragraphs:
  `collectDefinitions` in `src/refine-envelope.ts` joins the definitions with a single newline,
  which turns the link definition into a continuation of the footnote paragraph,
  and 5 units differ.
  The author's account of n159 names this limit.

What a reader of the page would see:
the doubled mark or the half-curled label of B609 and B615,
for a definition that sits in a container or after a footnote.
The page-level shape was not run for these inputs.

The review found no invented definition:
a definition-shaped line inside a fence,
an HTML comment,
an indented code block or an unterminated fence,
and a title with marks,
gave `''` or the right definitions.
Appending the definitions after the slice shifts no offset.

The cause:
`collectDefinitions` in `src/refine-envelope.ts` reads top-level nodes only and joins them with one newline,
and `pageDefinitionsOf` in `src/page-definitions.ts` uses it.

Reach on the corpus:
none.
21 pages hold definitions,
all footnote definitions,
and the oracle comparison over every top-level block of the 92 pages found no mismatch with the definitions on.

Not fixed:
the shared reader of the page's definitions still reads no container and still joins with a single newline,
and the lead's ruling leaves it as an open item.

## B621: an out-of-range landing was read as no prose, silently or with a wrong warning

Found on 2026-10-15 by the review of n159
(n160,
finding Y7).

Outcome written on 2026-10-15.
Fixed by n161;
red `5fe3173cc5`,
fixed in `277145a862`.

`fragmentProseMask` with a start past the slice returned a mask of length 0,
where its TSDoc says one flag per unit of the fragment.
With an end before the start it returned `refused: true` and a mask of zeros,
and `restoreTypography` then logged "refused by the page grammar" about a slice that parses.
The reach in production was none:
`src/apply-patch.ts` rejects an envelope whose current text differs from the base text before the landing is built,
so the landing is always in range there.
The two functions are in `src/typography-prose-mask.ts` and `src/restore-typography.ts`.

The lead ruled on 2026-10-15:
throw on an out-of-range landing.
It is unreachable in production,
so a throw states an invariant.

Fixed by n161:
- `src/fragment-landing-error.ts` (new) holds `FragmentLandingError`,
  which is marked `messageNamesOnly` and whose message names the offsets and the slice length only,
  and `assertLandingInside`,
  which throws for a start before 0,
  an end before the start and an end past the slice.
  The throw for an end past the slice is beyond what the brief named,
  since such an end reads the same wrong text;
  the lead accepted it.
- `fragmentProseMask` calls `assertLandingInside` (its TSDoc has `@throws`),
  `readingForRestoration` documents `@throws`,
  and `src/typography-barrel.ts` exports both,
  so `restoreTypography` never logs the grammar line for a bad landing and throws instead.
- `src/message-names-only.unit.test.ts` lists the new class in its inventory,
  with three entries of named parts for the slice,
  the start and the end.
- Tests:
  `src/typography-fragment-landing.unit.test.ts` (8 red on the build made before any source edit)
  and `src/fragment-landing-error.unit.test.ts`.
  The guard that removes the call fails 13 rows.
  The probe rows for a start past the slice,
  an end before the start,
  a negative start,
  an end past the slice,
  and `restoreTypography` with such a landing now end in `FragmentLandingError`,
  and the rows for a good landing and a stale landing are unchanged.

## B622: a text holding a NUL could read another text's mask

Found on 2026-10-15 by the review of n159
(n160,
finding Y9).

Outcome written on 2026-10-15.
Fixed by n161;
red `5fe3173cc5`,
fixed in `277145a862`.

The memory of the masks in `src/typography-prose-mask.ts` keyed a reading by the definitions,
a NUL character and the text.
The text `[x]: u`,
a NUL and `See [dogs' bowl][x]`,
with no definitions,
therefore shared the entry of `See [dogs' bowl][x]` read with the definitions `[x]: u`,
and the probe showed the same object for both.
A reader of the page would see the mask of one text applied to another,
and only a text holding a NUL can do it.
Reach on the corpus:
none.
The 92 pages hold no NUL
(the search over the corpus found no file,
and its control page,
which does hold one,
gave one hit;
the control needed the option that reads files with a NUL,
without which `rg` skips such a file silently).
The inputs are constructed.

The lead ruled on 2026-10-15:
key the memory without a NUL join.

Fixed by n161:
the memory is now a map of maps,
by definitions and then by text,
with a list that keeps the order of forgetting,
and the NUL separator is gone.
Test:
`src/typography-prose-mask-memo.unit.test.ts` (new),
red with a mask of length 24 against 31 on the build made before any source edit,
and 2 rows fail with the guard that reads the memory by text alone.
The probe line `NUL collision` went from `lengths 26 vs 26; same object=true` to `lengths 26 vs 19; same object=false`.
The scan ledger of `src/blank-text-tests.unit.test.ts` lost its entry for `typography-prose-mask.ts#proseMaskReading`,
because the empty-string test that entry listed lived in the NUL-joined key that this fix removed.
