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
