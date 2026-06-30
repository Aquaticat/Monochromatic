/**
 * Comment-preserving JSONC read, edit, and write.
 *
 * A free-function edit API over an immutable `JsoncEditState`, with a canonical
 * serializer that treats comments as first-class, queryable data. Sibling of
 * `@monochromatic-dev/module-toml-edit`; see
 * `docs/decisions/jsonc-edit-parser-foundation.md` for why this package keeps a
 * hand-written parser rather than wrapping a library.
 *
 * @packageDocumentation
 */

//region Types: the parsed value model surfaced to callers
export type { JsoncComment, } from './comment.ts';
export type {
  FragmentStringJsonc,
  StringJsonc,
} from './brand.ts';
export type {
  JsoncArray,
  JsoncBoolean,
  JsoncKey,
  JsoncNull,
  JsoncNumber,
  JsoncPlainJson,
  JsoncRecord,
  JsoncRecordEntry,
  JsoncString,
  JsoncValue,
} from './value.ts';
//endregion Types
