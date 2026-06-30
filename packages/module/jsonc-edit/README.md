# @monochromatic-dev/module-jsonc-edit

Comment-preserving JSONC (JSON with comments) read, edit, and write.
A free-function edit API over an immutable `JsoncEditState`, with a canonical serializer
that treats comments as first-class, queryable data.

Sibling of `@monochromatic-dev/module-toml-edit`.
Where `toml-edit` wraps a third-party parser and offers byte-identical splice, `jsonc-edit`
keeps a hand-written parser whose distinctive value is a normalized comment model:
every object key and every value carries at most one comment, and stacked `//` or `//region`
lines merge into a single comment.
See `docs/decisions/jsonc-edit-parser-foundation.md` for why no off-the-shelf parser fits.

## Status

Implemented: parser, canonical serializer, immutable edit API, and comment-as-data API,
with unit, property, conformance, and benchmark suites and a coverage gate.
See `docs/handover/jsonc-edit.md` for the build history.

## Why JSONC, and why canonical

- Comments survive read, edit, and write, and are addressable as data by path.
- A native `JSON.parse` fast-path handles clean (comment-free) regions for speed.
- Runs in every modern environment:
  zero runtime dependencies, no WebAssembly.
- Canonical write model:
  unedited values keep their raw scalar text, all comments are preserved, and formatting is
  deterministic.
  This is not byte-identical splice;
  whitespace between tokens is normalized.

## API

```ts
import {
  parseJsoncEdit,
  jsoncStringify,
  jsoncGetValue,
  jsoncHas,
  jsoncKeys,
  jsoncSet,
  jsoncDelete,
  jsoncGetComment,
  jsoncSetComment,
  jsoncGetKeyComment,
  jsoncSetKeyComment,
  COMMENT_ABSENT,
} from '@monochromatic-dev/module-jsonc-edit';

const state = parseJsoncEdit({ source: '{ "host": "localhost" } // cfg' as StringJsonc, },);
const next = jsoncSetComment({ state, path: ['host',], comment: { type: 'inline', text: ' default', }, },);
const text = jsoncStringify({ state: next, },);
```

The lower-level `parseJsonc` (returning a `JsoncValue`) and `emitJsoncValue` are also
exported for callers that do not need the edit state.

## Performance

The `mise run //packages/module/jsonc-edit:bench` task compares parsing against
microsoft `jsonc-parser` and `jsonc-eslint-parser`.
On a representative run (300 entries, 3000 iterations):

- Clean input, where jsonc-edit takes the native `JSON.parse` fast-path: jsonc-edit is
  roughly four times faster than microsoft `jsonc-parser` and roughly twenty times faster
  than `jsonc-eslint-parser`.
- Commented input, where jsonc-edit uses the structured parser: jsonc-edit is competitive
  with microsoft `jsonc-parser` and several times faster than `jsonc-eslint-parser`, while
  also retaining comments as queryable data the other two do not model.

Numbers are machine-dependent; run the task to reproduce them locally.

## Comment model

A parsed JSONC value is a discriminated union covering string, number, boolean, null, array,
record, and a `plainJson` fast-path leaf.
Every node may carry a `comment` of type `inline`, `block`, or `mixed`.
Record keys are themselves comment-bearing, so `{ /* a */ "k": /* b */ "v" }` attaches
`a` to the key and `b` to the value.
Duplicate keys are malformed input: the behavior is undefined and not a supported
contract. Correctly handling malformed JSON or JSONC is not a design goal, so the
structured parser and the `JSON.parse` fast-path may treat duplicate keys differently.
