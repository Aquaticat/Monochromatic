# Half of shipped replacements flatten the line structure they replaced

Measured 2026-08-18 over `~/translation-repair-runs-flagged-20260818/artifacts`,
every `replacement-shipped` row in either lane whose `incumbentKind` is `present`,
64 rows.
Script: `~/temp/agent/wrap-census.mjs`.

## The measurement

```text
shipped replacements with an incumbent                         64

paragraph breaks (blank lines), structural
  fewer after the edit                                          9
  more  after the edit                                          4
  unchanged                                                    51

soft wrapping (single newlines), the MD1 convention
  fewer after the edit                                         33
  more  after the edit                                          5
  unchanged                                                    26
  multi-line incumbent flattened to a SINGLE line              17

edits that are a rewrap and nothing else                        2
byte-identical edits                                            0
```

The nine paragraph-losing rows,
written as `entry/lane#slice: before -> after`:

```text
GLaDOSister/repair#3      2 -> 1
GLaDOSister/translate#3   2 -> 1
dogesir_/translate#3      6 -> 4
dogesir_/translate#9      4 -> 2
saurikissa/repair#3       2 -> 1
saurikissa/repair#4       3 -> 1
saurikissa/translate#3    2 -> 1
saurikissa/translate#9    3 -> 2
wangzihao980/translate#4  4 -> 2
```

## Two different losses, and only one of them is damage

THE TWO ARE COUNTED APART because they want opposite responses.

A LOST PARAGRAPH BREAK CHANGES THE DOCUMENT.
`dogesir_/translate#3` shipped four paragraphs where the archive had six,
so two divisions the author made are gone from the rendered page.
Nothing downstream can put them back,
since nothing downstream knows where they were.
This is damage and a human should be asked about it.

A LOST SOFT WRAP CHANGES ONLY THE SOURCE FILE.
Markdown renders `a\nb` and `a b` identically,
so a flattened passage reads the same to a visitor
and differs only to whoever opens the file next.
It is still a defect,
because this repository holds semantic line breaks to be paramount for maintainability,
but it is a defect with a deterministic mechanical fix
and it must not consume a human grader's attention.

## The fix already exists in this repository

`package/cli/markdown-lint` carries a `semantic-line-breaks` rule that is `fixable: true`,
and its fix is ADD-ONLY:
it inserts a newline plus the block's continuation prefix
after a break-point character that ends a written word,
and it converges in a single pass
because insertions at distinct points never overlap.
Break points are `,` `.` `;` `:` `?` `!`,
each required to be followed by a word separator,
with an abbreviation list and a closing-delimiter rule
recorded in `package/cli/markdown-lint/src/semantic-break-points.ts`.

Add-only matters here.
The wrapper cannot destroy a break the model got right,
so running every shipped passage through it is safe on the 26 rows that lost nothing
and repairs the 33 that did.
It also cannot restore a lost paragraph break,
which is the reason the two counts above are kept apart.

WHAT IS OWED:
the pipeline ships whatever line structure the model emitted.
Passing shipped text through this wrapper before it is spliced
would settle 33 of the 64 rows without asking anyone anything.
The nine paragraph losses would remain,
and they are the ones worth a human's time.

## What this changed about the grading sheet

The first sheet showed both texts verbatim,
so a rewrap dominated every item it touched.
The grader said so directly at items 6 and 7:
"Semantic wrapping is paramount even when original Chinese text didn't, for maintainability.
And I don't see an issue with the original translated text."
Two of the pool's 64 rows are a rewrap and NOTHING ELSE,
`dogesir_/translate#5` and `dogesir_/translate#8`,
so a sheet that includes them asks a human to grade a difference that carries no wording change at all.

The second sheet joins single newlines within a paragraph for display,
keeps blank lines,
drops the rewrap-only rows,
and says in its preamble that wrapping is tracked separately.

## The wrapper was run over every shipped passage before any of it was wired in

Measured 2026-08-18,
zero quota,
`~/temp/agent/wrap-probe-2.mjs`,
calling `fixSource` from the built `@monochromatic-dev/cli-markdown-lint` with exactly one rule.

The first attempt asked the wrong question.
"Does the passage carry fewer line breaks than the incumbent" is not the rule's question,
because a shorter passage legitimately carries fewer breaks.
The rule's own question is whether the passage still reports a finding,
and that is what settles it:

```text
rows                                              64

archive incumbents violating MD1                  50 of 64
shipped text violating                            58 of 64,  326 findings
shipped text violating AFTER the fix               0 of 64,    0 findings

non-newline characters, grew                      10
non-newline characters, unchanged                 54
non-newline characters, SHRANK                     0
second application changes nothing                64 of 64
```

THREE THINGS ARE NOW MEASURED RATHER THAN ASSUMED.
The fix clears every finding in this pool.
It is add-only in fact and not only in intent,
since no passage lost a non-newline character
and the ten that grew did so by continuation prefixes inside blockquotes and lists.
It is idempotent,
so applying it on a cache replay cannot drift.

FRAGMENT SAFETY IS SETTLED THE SAME WAY.
The concern was that a slice might be a piece of a block
and parse as something else on its own.
Every slice in the pool was passed through alone
and none lost a character,
so whatever the parser made of them, it removed nothing.

## The archive is not innocent either

50 of 64 incumbents already violate the rule,
so this is a corpus-wide condition rather than something the pipeline invented.
The pipeline still makes it worse,
58 passages against 50 and 326 findings,
and the grader saw the difference at the slices where a wrapped incumbent became an unwrapped replacement.

THE RETAINED TEXT IS DELIBERATELY LEFT ALONE.
A retention is not an edit,
and wrapping one would manufacture a change out of a decision to change nothing,
which both the delivery coherence check and the assembly assertion refuse by design.
Bringing the archive itself up to the rule is a one-time `markdown-lint --fix` run over the corpus,
not a job for a translation pass.

## Re-measured on output settled after the wrapper landed

The measurement above was taken on a pool settled BEFORE `semantic-wrap.ts` was wired in.
The check it asked for was the same census over a pool settled after,
and `wangzihao980` settling on 2026-08-19 provides one.

Nine shipped replacements with an incumbent present:

```text
MD1 VIOLATIONS
  archive incumbents violating          5 of 9
  shipped text violating                0 of 9,  0 findings
  shipped text violating AFTER the fix  0 of 9,  0 findings

ADD-ONLY, non-newline character count
  grew 0   unchanged 9   shrank 0

PARAGRAPH BREAKS (blank lines)
  fewer after the edit 0   more 0   same 9

SOFT WRAPPING (single newlines)
  fewer after the edit 0   more 9   same 0
  multi-line incumbent flattened to one line: 0
```

WHAT CHANGED, read against the earlier pool of 64:
shipped text used to violate in 58 of 64 rows carrying 326 findings,
and 17 incumbents were flattened to a single line.
Both are now zero, and the "after the fix" column is zero for the same reason as the column
before it rather than for a different one:
the text ships already wrapped, so there is nothing left for a fix to do.

THE INCUMBENTS ARE UNTOUCHED, deliberately: 5 of these 9 violate MD1 in the archive and still do.
A retention keeps the archive's bytes, and wrapping one would report a change nobody decided on.
That remains a one-time `markdown-lint --fix` over the corpus rather than a job for a translation pass.

READ THE SIZE OF THIS HONESTLY. Nine rows from one entry is a small pool,
and it confirms a direction rather than establishing a rate.
What makes it worth recording is that the earlier pool's failure mode was not marginal:
58 of 64 with 326 findings does not become 0 of 9 by luck.
The corpus-wide confirmation rides the end-to-end pass whenever that runs.
