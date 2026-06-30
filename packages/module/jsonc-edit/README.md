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

Under construction.
See `docs/handover/jsonc-edit.md` for live progress.

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

## Planned API

```ts
import {
  parseJsoncEdit,
  jsoncGet,
  jsoncGetValue,
  jsoncHas,
  jsoncKeys,
  jsoncSet,
  jsoncDelete,
  jsoncGetComment,
  jsoncSetComment,
  jsoncGetKeyComment,
  jsoncSetKeyComment,
  jsoncStringify,
} from '@monochromatic-dev/module-jsonc-edit';
```

## Comment model

A parsed JSONC value is a discriminated union covering string, number, boolean, null, array,
record, and a `plainJson` fast-path leaf.
Every node may carry a `comment` of type `inline`, `block`, or `mixed`.
Record keys are themselves comment-bearing, so `{ /* a */ "k": /* b */ "v" }` attaches
`a` to the key and `b` to the value.
Duplicate keys are preserved losslessly.
