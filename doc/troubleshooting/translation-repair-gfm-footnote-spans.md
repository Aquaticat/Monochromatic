# Raw translation-repair scans disagree with GFM footnote 2.1.0 syntax

## Symptom

The archive relabeler at `895843508` changed marker-shaped strings in metadata,
code,
comments,
escaped prose,
link destinations and JSX attributes.
It left case-equivalent references unchanged when their spelling differed from the mapped definition.
It also truncated an identifier containing an escaped closing bracket.

These are consumer defects,
not observed defects in `micromark-extension-gfm-footnote`.
The old collision refusal and its corpus input are recorded in
[the footnote work record][work].

## Root cause

The old application scanned the complete input instead of syntax-authorized regions.
At `895843508`,
`package/module/translation-repair/src/archive-footnote-relabel.ts:506`
passed the whole document to the literal scanner:

```ts
// package/module/translation-repair/src/archive-footnote-relabel.ts at 895843508
const walked = scanGfmReferenceLiterals({ slice: text, },)
```

Its lookup at line 515 compared raw strings:

```ts
// package/module/translation-repair/src/archive-footnote-relabel.ts at 895843508
const to = lookup.get(hit.identifier,);
```

Its cursor at line 527 derived an endpoint from the scanner's identifier rather than the positioned token:

```ts
// package/module/translation-repair/src/archive-footnote-relabel.ts at 895843508
cursor: hit.localOffset + markerLength({ identifier: hit.identifier, },),
```

The installed tokenizer has different rules.
The read-only upstream clone is tagged `2.1.0`,
commit `df527f58c1cc92f2b212d02e1fe967e02d881ca9`,
at `~/temp/agent/gfm-footnote-2.1.0-20260911`.
Its `dev/lib/syntax.js:266` rejects empty,
overlength,
whitespace-containing and unescaped-opening-bracket labels:

```js
// micromark-extension-gfm-footnote/dev/lib/syntax.js:266 at tag 2.1.0
if (
  size > constants.linkReferenceSizeMax ||
  (code === codes.rightSquareBracket && !data) ||
  code === codes.eof ||
  code === codes.leftSquareBracket ||
  markdownLineEndingOrSpace(code)
) {
  return nok(code)
}
```

The installed `micromark-util-symbol/lib/constants.js:37` sets
`linkReferenceSizeMax: 999`.
The call escape state at `dev/lib/syntax.js:314` consumes an escaped bracket or backslash as label content:

```js
// micromark-extension-gfm-footnote/dev/lib/syntax.js:314 at tag 2.1.0
if (
  code === codes.leftSquareBracket ||
  code === codes.backslash ||
  code === codes.rightSquareBracket
) {
  effects.consume(code)
  size++
  return callData
}
```

The call path at `dev/lib/syntax.js:282` compares normalized serialized identifiers
against defined notes:

```js
// micromark-extension-gfm-footnote/dev/lib/syntax.js:282 at tag 2.1.0
if (!defined.includes(normalizeIdentifier(self.sliceSerialize(token)))) {
  return nok(code)
}
```

A literal left in a text node can therefore be an unresolved reference.
It is not evidence that every matching substring elsewhere in the document is a reference.

The consumer replacement uses strict parsing at
`package/module/translation-repair/src/active-footnote-markers.ts:142`:

```ts
// package/module/translation-repair/src/active-footnote-markers.ts:142
const root = parseMdxBody({ body: parsedText, },);
```

The text-node branch at line 165 confines unresolved-reference scanning to parser-authorized text:

```ts
// package/module/translation-repair/src/active-footnote-markers.ts:165
if (node.type === 'text') {
```

The marker positions retain encoded label spelling separately from normalized identity.
`package/module/translation-repair/src/apply-footnote-relabel.ts:99`
reparses the candidate before returning it:

```ts
// package/module/translation-repair/src/apply-footnote-relabel.ts:99
const after = activeFootnoteMarkers({ text: rewritten, },);
```

The following guard compares occurrence counts,
roles and intended normalized destinations.
This checks actual output,
not merely the planned substitutions.

## Verification

The source trace uses tokenizer `2.1.0` and the release commit named in `Root cause`.
The owned boundary tests were run from built translation-repair artifacts:

```bash
# Run from the translation-repair worktree after its package build.
MISE_AUTO_INSTALL=false MISE_TASK_RUN_AUTO_INSTALL=false \
  mise run --no-deps --skip-tools //package/module/translation-repair:test:unit
```

The full run through `75b769026` exited with code zero.
Its log is `~/temp/agent/footnote-full-unit-20260911.out`.
Tests import `dist/final/node/index.mjs`,
not sibling implementation source.

Working catalog:

- Real references and definition openers move together.
- Swaps are simultaneous.
- Case-equivalent and Unicode-folded identifiers match without using normalized string lengths as offsets.
- Escaped closing and opening brackets remain part of valid identifiers.
- A label at the tokenizer's length boundary is accepted.
- Metadata,
  code,
  comments,
  escaped openings,
  URLs and attributes remain unchanged.

Refusal catalog:

- Empty,
  whitespace-containing,
  injected-delimiter and overlength destinations.
- Conflicting normalized source mappings.
- A destination occupied by an unmoved archive identity.
- Malformed whole-document JSX.
- Raw identifier bytes disagreeing with the parser's normalized association.
- A proposed unresolved reference that reparses as JSX instead of a reference.

The first syntax regression run failed with ordinary assertions on the old application.
The protected-byte controls separately showed that the old pass changed declared English originals.
The exact catalogs live in `archive-footnote-syntax.unit.test.ts`,
`footnote-rewrite-boundary.unit.test.ts` and `archive-footnote-protected.unit.test.ts`
beside the implementation.

## Verified consumer remedy

Use the compiled `relabelArchiveFootnotes` boundary with complete correspondence evidence.
It keeps supplied relations,
forced elimination and archive-only displacement distinct.
It validates the composed map,
rewrites only active spans,
protects declared English-original text and its comment anchor,
and requires fresh preparation after changed text.

The pinned `Y1Ran` mechanism control retained every definition and reference,
renamed surplus archive label `1` to `4`,
preserved front matter,
reconstructed target ranges and node coverage,
and compiled the masked MDX body without executing it.
It used a no-network container configured for 2 GiB RAM,
2 CPUs and 512 PIDs.
The driver recorded zero fetch calls.
See `~/temp/agent/footnote-Y1-consumer-r3-20260911.out`.

Tradeoffs:

- Fresh archive-only labels establish no source correspondence or factual authority.
- Strict syntax failure withholds the operation instead of guessing from raw text.
- Definition movement is withheld across non-blank gaps or shared container delimiters.
- This is not approval of the writer calibration population or its correspondence acquisition.

## What does not work

- Whole-document substring scanning changes literal and metadata bytes.
- Raw case-sensitive map lookup leaves references disconnected from renamed definitions.
- Decoded or normalized label lengths do not locate raw closing brackets.
- The slice parser's lone-container mask cannot authorize whole-document edits.
  The malformed-JSX control showed that it could mask an invalid opener and still rename later strings.
  The active inventory now requires document grammar.
- Copying the first definition gap between every reordered block duplicates comments and loses distinct separators.
- Reusing pre-rename offsets after label widths change misidentifies protected ranges.

## Upstream filing decision

Nothing to add upstream:
the deciding defects were in the consumer's scanner and transformation boundaries.

1.  Upstream fault: no observed parser defect.
    The parser's positioned nodes and documented tokenizer states exposed the consumer mismatch.
2.  Upstream fix: no upstream change is needed for this remedy.
3.  Supported use: the extension implements GFM footnote definitions and calls.
    A whole-document raw-text replacement is our operation,
    not its API.
4.  Contribution policy: not assessed for a filing because no upstream change is proposed.
    No claim is made about acceptance of an AI-assisted contribution.
5.  Maintainer position: no stance is inferred from tracker silence.
6.  Prototype: the consumer implementation and its regressions were exercised.
    There is no upstream patch or fileable issue draft.

The `.out-of-scope/` filenames were checked;
none names this parser or footnote class.
Tracker searches for `escaped label` returned no matching issue or pull request.
The broader `footnote` search returned heading-level,
link-title,
README and type-dependency topics,
not this consumer transformation.
No external issue or comment was posted.

[work]: ../planning/translation-repair-archive-footnote-collisions-2026-09-11.md
