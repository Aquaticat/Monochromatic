/*
  Custom JSONC parsers for arrays and objects - MUTUAL RECURSION CORE.
  These functions form a recursive cycle and must stay together to avoid circular imports.
  Region markers outline imports, function phases, and known pitfalls to aid maintainability.
*/

//region Imports and helpers -- Core types, utilities, and helpers from child modules
import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import type * as Jsonc from '../../../../t/index.ts';
import {
  expectArraySeparatorOrEnd,
  parseArrayHeader,
} from './customParsers.arrayHelpers.ts';
import {
  expectColonAfterKey,
  expectRecordSeparatorOrEnd,
  parseRecordHeader,
  parseRecordKey,
} from './customParsers.recordHelpers.ts';
import { scanQuotedString, } from './customParsers.scanQuotedString.ts';
import { mergeComments, } from './customParsers.startsWithComment.mergeComments.ts';
import { startsWithComment, } from './customParsers.startsWithComment.ts';
import {
  NO_LITERAL,
  parseLiteralToken,
  parseNumberToken,
} from './customParsers.tokenizers.ts';
/**
 * Alias for intrinsic freeze to emphasize immutability when capturing values.
 * @remarks Present for parity with modules that capture intrinsics; avoids repeated lookups.
 */
const f = Object.freeze;
//endregion Imports and helpers

//region Value dispatcher -- Single entry to parse one value from the start (MUTUALLY RECURSIVE)
/**
 * Parse a single JSONC value from the current position, delegating to container parsers and propagating `context.comment`.
 *
 * @remarks
 * Follows category-first symbol narrowing for results of {@link parseLiteralToken}; propagates `context.comment` onto produced nodes.
 * MUTUALLY RECURSIVE with customParserForArray and customParserForRecord.
 *
 * @param value - Input fragment to parse from the start
 * @param context - Optional value base whose `comment` is attached to the produced node
 * @returns Parsed value node and remaining fragment starting at the next token
 * @throws Error - When no valid JSONC value start token is present
 * @example
 * ```ts
 * parseValueFromStart({ value: '"x" ,', }) // → parsed string, remaining ' ,'
 * parseValueFromStart({ value: '[1]', }) // → parsed array, remaining ''
 * ```
 */
export function parseValueFromStart(
  { value, context, }: { value: FragmentStringJsonc | StringJsonc;
    context?: Jsonc.ValueBase; },
): { parsed: Jsonc.Value; remaining: FragmentStringJsonc; } {
  if (value.startsWith('"',)) {
    /** Result of scanning the leading quoted string, with parsed node and tail. */
    const out = scanQuotedString({ value, },);
    /** Final value node for string branch after optional comment propagation. */
    const parsed: Jsonc.Value = context?.comment
      ? { ...out.parsed, comment: context.comment, }
      : out.parsed;
    return { parsed, remaining: out.remaining, };
  }

  const literal = parseLiteralToken({ value, },);
  if (typeof literal !== 'symbol') {
    /** Matched literal node and remaining fragment extracted from tokenizer result. */
    const { parsed: litParsed, remaining, } = literal;
    /** Final value node for literal branch with optional comment propagation. */
    const parsed: Jsonc.Value = context?.comment
      ? { ...litParsed, comment: context.comment, }
      : litParsed;
    return { parsed, remaining, };
  }

  if (value.startsWith('[',)) {
    /** Delegated array parse preserving comments; context provides array-level comment. */
    const out = context
      ? customParserForArray({ value, context, },)
      : customParserForArray({ value, },);
    /** Strip `remainingContent` to produce standard Value shape for the caller. */
    const { remainingContent, ...parsed } = out;
    return { parsed: parsed as Jsonc.Value, remaining: remainingContent, };
  }

  if (value.startsWith('{',)) {
    /** Delegated object parse preserving comments; context comment applies to record node. */
    const out = context
      ? customParserForRecord({ value, context, },)
      : customParserForRecord({ value, },);
    /** Strip `remainingContent` to produce standard Value shape for the caller. */
    const { remainingContent, ...parsed } = out;
    return { parsed: parsed as Jsonc.Value, remaining: remainingContent, };
  }

  if (['-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',].some(m =>
    value.startsWith(m,)
  )) {
    /** Delegated number token parse; ensures JSON numeric semantics. */
    const out = parseNumberToken({ value, },);
    /** Final value node for number branch with optional comment propagation. */
    const parsed: Jsonc.Value = context?.comment
      ? { ...out.parsed, comment: context.comment, }
      : out.parsed;
    return { parsed, remaining: out.remaining, };
  }

  throw new Error('invalid jsonc value start',);
}
//endregion Value dispatcher

//region Array elements -- Recursive, immutable element parsing for arrays (MUTUALLY RECURSIVE)
/**
 * Parse one or more array elements starting from a tail, returning accumulated items and the tail after ']'.
 *
 * @param tail - Input tail positioned at the start of the next element or closing bracket
 * @param items - Collected items so far; treated immutably during recursion
 * @returns Items parsed up to ']' and the remaining tail after the closing bracket
 */
export function parseArrayElements(
  tail: FragmentStringJsonc,
  items: readonly Jsonc.Value[] = [],
): { items: readonly Jsonc.Value[]; tail: FragmentStringJsonc; } {
  /** Leading comments at element start; carries per-element comment. */
  const lead = startsWithComment({ value: tail, },);
  /** Start positioned at element value or closing bracket. */
  const start = lead.remainingContent;

  if (start.startsWith(']',))
    return { items, tail: start.slice(1,) as FragmentStringJsonc, };

  /** Parsed value from current element with propagated comment. */
  const { parsed, remaining, } = parseValueFromStart({ value: start, context: lead, },);
  /** Separator decision following the element. */
  const decision = expectArraySeparatorOrEnd(remaining,);
  if (decision.kind === 'end')
    return { items: [...items, parsed,], tail: decision.tail, };
  return parseArrayElements(decision.tailStart, [...items, parsed,],);
}
//endregion Array elements

/**
 * Parse a JSONC array fragment starting at '[' while preserving comments and returning the unconsumed tail.
 *
 * Why: Global regex edits are unsafe in the presence of quotes and comments; advancing token-by-token preserves intent.
 *
 * @param value - Input fragment beginning with '['
 * @param context - Optional value base whose `comment` becomes the array-level comment
 * @returns Parsed array node and `remainingContent` positioned after the closing ']'
 * @example
 * ```ts
 * customParserForArray({ value: '[1, /* c *\/ 2]X' as FragmentStringJsonc })
 * // → { value: [{value:1},{value:2}], remainingContent: 'X' as FragmentStringJsonc }
 * ```
 */
export function customParserForArray(
  { value, context, }: { value: FragmentStringJsonc | StringJsonc;
    context?: Jsonc.ValueBase; },
): Jsonc.Array & { remainingContent: FragmentStringJsonc; } {
  //region Entry and comment skip -- Drop the opening '[' then consume leading comments/space
  /** Tail after stripping the opening '[' to keep pointer immutable. */
  const woOpening = value.slice('['.length,) as FragmentStringJsonc;
  /** Array-level comment from context and header tail inside brackets. */
  const { arrayComment, tail: headerTail, } = parseArrayHeader(woOpening, context,);
  //endregion Entry and comment skip

  //region Empty array fast-exit -- Handle immediate closing bracket
  /** Leading comments/spaces directly inside '[' before first element or ']'. */
  const insideLead = startsWithComment({ value: headerTail, },);
  if (insideLead.remainingContent.startsWith(']',)) {
    /** Combined array-level comment when header and inside comments are present. */
    const finalComment = arrayComment && insideLead.comment
      ? mergeComments({ value: arrayComment, value2: insideLead.comment, },)
      : arrayComment ?? insideLead.comment;
    return {
      value: [] as Jsonc.Value[],
      ...(finalComment ? { comment: finalComment, } : {}),
      remainingContent: insideLead.remainingContent.slice(
        ']'.length,
      ) as FragmentStringJsonc,
    };
  }
  //endregion Empty array fast-exit

  //region Element recursion -- Delegate to exported pure helper
  /** Parsed items and tail after the terminating ']'. */
  const { items, tail, } = parseArrayElements(headerTail, [],);
  return {
    value: items as Jsonc.Value[],
    ...(arrayComment ? { comment: arrayComment, } : {}),
    remainingContent: tail,
  };
  //endregion Element recursion
}

//region Record value parsing -- Parse value with leading comment after colon (MUTUALLY RECURSIVE)
/**
 * Parse a record value with its leading comment after the colon.
 *
 * @param tail - Tail after the ':' token
 * @returns Value node with optional comment, and remaining tail after the value
 */
export function parseRecordValue(
  tail: FragmentStringJsonc,
): { valueNode: Jsonc.Value; remaining: FragmentStringJsonc; } {
  /** Comments/whitespace after colon before the value. */
  const valueLead = startsWithComment({ value: tail, },);
  /** Parsed value node with propagated comment and the remaining tail. */
  const { parsed: valueNode, remaining, } = parseValueFromStart(
    valueLead.comment
      ? { value: valueLead.remainingContent, context: { comment: valueLead.comment, }, }
      : { value: valueLead.remainingContent, },
  );
  return { valueNode, remaining, };
}
//endregion Record value parsing

//region One record member -- Compose key + colon + value for a single member (MUTUALLY RECURSIVE)
/**
 * Parse one complete record member (key:value pair) from the current position.
 *
 * @param tail - Tail at the start of a member (may have leading comment)
 * @returns Entry tuple [key, value] and remaining tail after the value
 */
export function parseOneRecordMember(
  tail: FragmentStringJsonc,
): { entry: [Jsonc.RecordKey, Jsonc.Value,]; remaining: FragmentStringJsonc; } {
  const { keyNode, remaining: afterKey, } = parseRecordKey(tail,);
  const afterColon = expectColonAfterKey(afterKey,);
  const { valueNode, remaining, } = parseRecordValue(afterColon,);
  return { entry: [keyNode, valueNode,], remaining, };
}
//endregion One record member

//region Record members -- Recursive, immutable member parsing for records (MUTUALLY RECURSIVE)
/**
 * Parse key:value members immutably, propagating comments on keys/values, and return tail after '}'.
 *
 * @param tail - Input positioned at the next member or closing brace
 * @param entries - Accumulated entries; treated immutably during recursion
 * @returns Entries parsed up to '}' and the remaining tail after the closing brace
 */
export function parseRecordMembers(
  tail: FragmentStringJsonc,
  entries: readonly [Jsonc.RecordKey, Jsonc.Value,][] = [],
): { entries: readonly [Jsonc.RecordKey, Jsonc.Value,][]; tail: FragmentStringJsonc; } {
  /** Leading comments at member start; check for closing brace. */
  const lead = startsWithComment({ value: tail, },);
  /** Start positioned at quoted key or closing brace. */
  const start = lead.remainingContent;

  if (start.startsWith('}',))
    return { entries, tail: start.slice('}'.length,) as FragmentStringJsonc, };

  /** Parse one member from current position. */
  const { entry, remaining, } = parseOneRecordMember(tail,);
  /** Separator/end decision for subsequent member parsing. */
  const decision = expectRecordSeparatorOrEnd(remaining,);
  /** Immutable accumulation of parsed entries. */
  const nextEntries = [...entries, entry,];
  return decision.kind === 'end'
    ? { entries: nextEntries, tail: decision.tail, }
    : parseRecordMembers(decision.tailStart, nextEntries,);
}
//endregion Record members

/**
 * Parse a JSONC object fragment starting at '{' while preserving comments.
 *
 * Parses quoted keys and their values with comments tolerated around keys, colons, and values.
 * Accepts a trailing comma before the closing '}' and returns `remainingContent` after the '}'.
 *
 * @param value - Input fragment beginning with '{'
 * @param context - Optional value base used for comment propagation
 * @returns Parsed record node and `remainingContent` after the closing '}'
 */
export function customParserForRecord(
  { value, context, }: { value: FragmentStringJsonc | StringJsonc;
    context?: Jsonc.ValueBase; },
): Jsonc.Record & { remainingContent: FragmentStringJsonc; } {
  //region Entry and empty-object fast-exit
  /** Tail after stripping the opening '{' to keep pointer immutable. */
  const woOpening = value.slice('{'.length,) as FragmentStringJsonc;
  /** Leading comments/spaces directly inside '{' before first member or '}'. */
  const insideLead = startsWithComment({ value: woOpening, },);
  if (insideLead.remainingContent.startsWith('}',)) {
    /** Combined record-level comment when context and inside comments are present. */
    let finalComment: Jsonc.Comment | undefined;
    if (context?.comment && insideLead.comment) {
      finalComment = mergeComments({ value: context.comment, value2: insideLead
        .comment, },);
    }
    else if (context?.comment)
      finalComment = mergeComments({ value: context.comment, },);
    else if (insideLead.comment)
      finalComment = mergeComments({ value2: insideLead.comment, },);

    return {
      value: new Map(),
      ...(finalComment ? { comment: finalComment, } : {}),
      remainingContent: insideLead.remainingContent.slice(
        '}'.length,
      ) as FragmentStringJsonc,
    };
  }
  //endregion Entry and empty-object fast-exit

  //region Members recursion
  /** Parsed entries and tail after the terminating '}'. */
  const { entries, tail, } = parseRecordMembers(woOpening, [],);
  return {
    value: new Map(entries,),
    ...(context?.comment ? { comment: context.comment, } : {}),
    remainingContent: tail,
  };
  //endregion Members recursion
}

//region Re-exports from child modules
export * from './customParsers.arrayHelpers.ts';
export * from './customParsers.recordHelpers.ts';
export * from './customParsers.scanQuotedString.ts';
export * from './customParsers.startsWithComment.mergeComments.ts';
export * from './customParsers.startsWithComment.ts';
export * from './customParsers.tokenizers.ts';
//endregion Re-exports from child modules
