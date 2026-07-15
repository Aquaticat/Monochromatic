/**
 * Comment-preserving JSONC read, edit, and write.
 *
 * A free-function edit API over an immutable `JsoncEditState`, with a canonical
 * serializer that treats comments as first-class, queryable data. Sibling of
 * `@monochromatic-dev/module-toml-edit`; see
 * `doc/decision/jsonc-edit-parser-foundation.md` for why this package keeps a
 * hand-written parser rather than wrapping a library.
 *
 * @packageDocumentation
 */

//region Parse and serialize
export { parseJsonc, } from './parse-jsonc.ts';
export { emitJsoncValue, } from './stringify.ts';
export {
  jsoncStringify,
  parseJsoncEdit,
} from './edit-state.ts';
export type { JsoncEditState, } from './edit-state.ts';
//endregion Parse and serialize

//region Read API
export {
  jsoncGetValue,
  jsoncHas,
  jsoncKeys,
} from './edit-navigate.ts';
export type { JsoncPath, } from './edit-navigate.ts';
//endregion Read API

//region Edit API
export {
  jsoncDelete,
  jsoncSet,
} from './edit-set.ts';
//endregion Edit API

//region Comment-as-data API
export {
  COMMENT_ABSENT,
  jsoncGetComment,
  jsoncGetKeyComment,
  jsoncSetComment,
  jsoncSetKeyComment,
} from './edit-comment.ts';
export { mergeComments, } from './merge-comments.ts';
//endregion Comment-as-data API

//region Errors
export {
  JsoncParseError,
  JsoncPathNotFoundError,
  JsoncTypeError,
} from './errors.ts';
//endregion Errors

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
