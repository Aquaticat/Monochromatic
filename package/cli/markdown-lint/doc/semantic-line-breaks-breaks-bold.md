# `semantic-line-breaks --fix` destroyed a bold span whose text ended in a break-point character

Found while editing `doc/planning/prefer-readonly-foreign-proof-cost.md` under task #34,
and fixed under task #37.
Kept because the measurement is the reason the rule is shaped the way it is,
and a later reader who removes `tailThroughDelimiters` will otherwise not know what it was for.

## Landed

`tailThroughDelimiters` in `src/rule/semantic-line-breaks.ts` walks outward from a text node
through any inline span that ends where the text ends,
and the insertion offset is measured from that outermost node rather than from the text.
A break at the end of `**Term.**` therefore lands past the closing delimiter rather than in front of it.
Nesting is walked to the outermost span,
so `**_Term._**` resolves to the strong span.

`src/rule/semantic-line-breaks.unit.test.ts` pins the shape for each of `.`,
`,`,
`;`,
`:`,
`?` and `!`,
in both `strong` and `emphasis`,
and separately pins that a multi-sentence bold run still gets its internal breaks.

Everything below is the original report,
kept as the record of what was measured.

## Symptom

A list item written as

```markdown
- **The in-memory summary cache colliding across scopes.** `summariesByProject` is addressed by key.
```

comes back from `mise run lint:markdown -- --fix <file>` as

```markdown
- **The in-memory summary cache colliding across scopes.
  ** `summariesByProject` is addressed by key.
```

The closing `**` now begins a continuation line.
Rendered through this repository's own pipeline,
the bold is gone and the asterisks are literal text:

```bash
node --input-type=module -e "
const { markdownToHtml } = await import('satteri');
const render = async (source) => (await markdownToHtml(source)).html;
console.log(await render('- **A cache colliding across scopes.** \`x\` is addressed.\n'));
console.log(await render('- **A cache colliding across scopes.\n  ** \`x\` is addressed.\n'));
"
```

```html
<li><strong>A cache colliding across scopes.</strong> <code>x</code> is addressed.</li>
<li>**A cache colliding across scopes. ** <code>x</code> is addressed.</li>
```

So the fix is not add-only in effect,
whatever it is in the source text:
it changes what the document means.

## Cause

`SKIP_ANCESTORS` in `src/rule/semantic-line-breaks.ts` lists the ancestors whose `text` descendants
are left alone.
`strong` and `emphasis` are not among them,
so a `text` node inside `**...**` is ordinary prose to the rule,
and a break-point character at the very end of that text node gets a break inserted after it.
The insertion lands between the final `.` and the closing `**`.

CommonMark then reads that `**` as preceded by a line ending and followed by a space,
which makes it neither left-flanking nor right-flanking,
so it cannot close the span it was written to close.

## Why the obvious fix is the wrong one

Adding `strong` and `emphasis` to `SKIP_ANCESTORS` exempts every sentence inside a bold span from
the rule,
which is a much larger hole than the one being closed.
A bold run can hold several sentences and those breaks are wanted.

The precise condition is positional rather than ancestral:
suppress the break when the break-point character is the last character of a `text` node whose
parent is `strong` or `emphasis` and which is that parent's last child,
because the next thing in the source is the closing delimiter.
That is the same shape as the existing `isParagraphTail` guard,
which already suppresses a break that would land at a paragraph's end.

## Scale

`mise run lint:markdown -- doc/` reports 13197 `semantic-line-breaks` findings on 2026-07-29,
so the rule is failing across the documentation tree already
and `--fix` is the obvious way anyone would try to clear it.
Every bold span ending in a break-point character is a document `--fix` would silently break,
which makes this worth fixing before any bulk cleanup rather than after.

## Done when

`--fix` leaves a bold span whose text ends in `.`,
`,`,
`;`,
`:`,
`?` or `!` rendering as bold,
with a unit test in `src/rule/semantic-line-breaks.unit.test.ts` covering each of those characters
in both `strong` and `emphasis`,
and the multi-sentence bold run still gets its internal breaks.
