# monochromatic-jsonc-edit

Comment-preserving JSONC parse,
 immutable edit and canonical emit for Rust.

This crate is the native sibling of the TypeScript package
`@monochromatic-dev/module-jsonc-edit`.
 Both implement the same supported behavior:
 a JSONC document is an object or array root,
 `//` and `/* */` comments are data rather than discarded trivia,
 trailing commas are accepted,
 JSON5-only forms are rejected,
 and output is canonical rather than byte-preserving.

## Model

- Every object key and every value carries at most one attached,
   normalized comment.
   Stacked comments merge in source order into a single `mixed` comment.
- Edits are immutable:
   each operation returns a new state and leaves the previous state usable.
- Numbers compare by exact mathematical value,
   so `1`,
   `1.0` and `1e0` are equal,
   while an unedited literal keeps the spelling it was written with.
- Escaped unpaired UTF-16 surrogates survive as code units,
   with a fallible conversion to Rust `String` for values that UTF-8 cannot express.
- Container nesting is bounded:
   512 open containers are accepted and a 513th is rejected before deeper state is built.
- Line comments terminate at CR,
   LF or CRLF.

## Dependencies

None.
 The standard library is the only dependency,
 and the crate contains no `unsafe` block.
 `doc/decision/jsonc-edit-rust-foundation.md` records why the parser,
 emitter and exact-number identity are owned here rather than delegated to a published crate,
 and
 `doc/audit/tech-jsonc-edit-rust-parser-foundation-vet-2026-09-24-63342231.md` plus
 `doc/audit/tech-jsonc-edit-rust-exact-number-foundation-vet-2026-09-24-e8e0034a.md`
 hold the selection evidence.

## Status

Version 0.1.0 is being built out in this package.
 The public API and its usage examples land with the ported modules;
 this README grows as each surface is added rather than documenting items that do not exist yet.

## License

LGPL-3.0-or-later.
 The license texts are in `LICENSES/`.
