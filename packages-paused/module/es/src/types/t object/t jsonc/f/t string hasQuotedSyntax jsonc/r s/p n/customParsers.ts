/**
 * Custom JSONC parsers: barrel re-exports from split modules.
 *
 * The value dispatcher, array core, and record core form a mutual recursion cycle.
 * A dispatch module breaks the cycle: array/record cores call through the dispatch
 * indirection, and the parseValue module registers itself at load time.
 *
 * Import order matters: parseValue must load after arrayCore/recordCore
 * so dispatch registration happens after the core modules are available.
 */

//region Re-exports from core parsers
export {
  customParserForArray,
  parseArrayElements,
} from './customParsers.arrayCore.ts';
export { parseValueFromStart, } from './customParsers.parseValue.ts';
export {
  customParserForRecord,
  parseOneRecordMember,
  parseRecordMembers,
  parseRecordValue,
} from './customParsers.recordCore.ts';
//endregion Re-exports from core parsers

//region Re-exports from child modules
export * from './customParsers.arrayHelpers.ts';
export * from './customParsers.recordHelpers.ts';
export * from './customParsers.scanQuotedString.ts';
export * from './customParsers.startsWithComment.mergeComments.ts';
export * from './customParsers.startsWithComment.ts';
export * from './customParsers.tokenizers.ts';
//endregion Re-exports from child modules
