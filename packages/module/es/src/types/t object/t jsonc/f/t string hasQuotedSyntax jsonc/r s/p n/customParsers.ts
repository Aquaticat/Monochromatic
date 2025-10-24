/*
  Custom JSONC parsers for arrays and objects.
  These are the careful, comment-preserving "service road" paths that handle comments, whitespace,
  and trailing commas when the fast-path cannot use JSON.parse safely.
  Region markers outline imports, function phases, and known pitfalls to aid maintainability.
*/

//region Imports and helpers -- Core types, utilities, and comment skipper used by the parsers
import * as Jsonc from '../../../../t/index.ts';
import { mergeComments, } from './mergeComments.ts';
import { scanQuotedString, } from './scanQuotedString.ts';

import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import { startsWithComment, } from './startsWithComment.ts';
const f = Object.freeze;
//endregion Imports and helpers

//region Value tokenizers -- Pure helpers for literals and numbers with explicit contracts
/**
 * Sentinel indicating no JSON literal was matched at the current start position.
 *
 * @remarks
 * Compare by identity to detect non-match results from {@link parseLiteralToken}.
 *
 * @example
 * ```ts
 * const out = parseLiteralToken({ value: 'x' as FragmentStringJsonc });
 * if (out === NO_LITERAL) {
 *   // handle non-literal branch
 * }
 * ```
 */
export const NO_LITERAL: symbol = Symbol('jsonc:parseLiteralToken:no-match',);
/**
 * Parse JSON literal at the current position.
 * Supports: `null`, `true`, `false`.
 *
 * @param value - Input fragment to parse from the start
 * @returns Parsed literal token with remaining fragment, or {@link NO_LITERAL} when no literal matched
 * @example
 * ```ts
 * parseLiteralToken({ value: 'null,1' as FragmentStringJsonc })
 * // → { consumed: 'null', parsed: { value: null }, remaining: ',1' }
 * ```
 */
export function parseLiteralToken(
  { value, }: { value: FragmentStringJsonc | StringJsonc; },
):
  | { consumed: FragmentStringJsonc; parsed: Jsonc.Boolean | Jsonc.Null;
    remaining: FragmentStringJsonc; }
  | typeof NO_LITERAL
{
  if (value.startsWith('null',)) {
    return { consumed: 'null' as FragmentStringJsonc, parsed: { value: null, },
      remaining: value.slice(4,) as FragmentStringJsonc, };
  }
  if (value.startsWith('true',)) {
    return { consumed: 'true' as FragmentStringJsonc, parsed: { value: true, },
      remaining: value.slice(4,) as FragmentStringJsonc, };
  }
  if (value.startsWith('false',)) {
    return { consumed: 'false' as FragmentStringJsonc, parsed: { value: false, },
      remaining: value.slice(5,) as FragmentStringJsonc, };
  }
  return NO_LITERAL;
}

/**
 * Parse a JSON number token from the start using a single-pass regex and JSON numeric semantics.
 * The regex matches the JSON number grammar and returns the longest valid numeric prefix.
 *
 * @param value - Input fragment starting at a potential number token
 * @returns Consumed span, parsed number node, and remaining fragment after the number
 * @throws Error - When the start does not match a valid JSON number grammar
 * @example
 * ```ts
 * parseNumberToken({ value: '-12.3e+4, x' as FragmentStringJsonc })
 * // → { consumed: '-12.3e+4', parsed: { value: -123000 }, remaining: ', x' }
 * ```
 */
export function parseNumberToken(
  { value, }: { value: FragmentStringJsonc | StringJsonc; },
): { consumed: FragmentStringJsonc; parsed: Jsonc.Number;
  remaining: FragmentStringJsonc; }
{
  // JSON number grammar (no leading +, leading 0 rules, optional fraction and exponent)
  const NUMBER_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[Ee][+-]?\d+)?/;
  const match = NUMBER_RE.exec(value,);
  if (!match || match.index !== 0)
    throw new Error('malformed jsonc, non-number after number marker',);
  const consumed = match[0] as FragmentStringJsonc;
  // Using JSON.parse for exact numeric semantics, no intermediate mutation.
  const parsedValue = JSON.parse(consumed,) as number;
  return { consumed, parsed: { value: parsedValue, },
    remaining: value.slice(consumed.length,) as FragmentStringJsonc, };
}
//endregion Value tokenizers

//region Value dispatcher -- Single entry to parse one value from the start
/**
 * Parse a single JSONC value from the current position, delegating to container parsers and propagating `context.comment`.
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
    const out = scanQuotedString({ value, },);
    const parsed: Jsonc.Value = context?.comment
      ? { ...out.parsed, comment: context.comment, }
      : out.parsed;
    return { parsed, remaining: out.remaining, };
  }

  const literal = parseLiteralToken({ value, },);
  if (typeof literal !== 'symbol') {
    const { parsed: litParsed, remaining, } = literal;
    const parsed: Jsonc.Value = context?.comment
      ? { ...litParsed, comment: context.comment, }
      : litParsed;
    return { parsed, remaining, };
  }

  if (value.startsWith('[',)) {
    const out = context
      ? customParserForArray({ value, context, },)
      : customParserForArray({ value, },);
    const { remainingContent, ...parsed } = out;
    return { parsed: parsed as Jsonc.Value, remaining: remainingContent, };
  }

  if (value.startsWith('{',)) {
    const out = context
      ? customParserForRecord({ value, context, },)
      : customParserForRecord({ value, },);
    const { remainingContent, ...parsed } = out;
    return { parsed: parsed as Jsonc.Value, remaining: remainingContent, };
  }

  if (['-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',].some(m =>
    value.startsWith(m,)
  )) {
    const out = parseNumberToken({ value, },);
    const parsed: Jsonc.Value = context?.comment
      ? { ...out.parsed, comment: context.comment, }
      : out.parsed;
    return { parsed, remaining: out.remaining, };
  }

  throw new Error('invalid jsonc value start',);
}
//endregion Value dispatcher

//region Array header -- Consume '[' then leading comments to capture array-level comment
/**
 * After the opening '[', compute the array-level comment (if any) and return the tail at the first element or ']'.
 *
 * @param valueAfterBracket - Substring immediately following '['
 * @param context - Optional value whose `comment` represents the array-level comment
 * @returns Array-level comment (when present) and the unparsed tail within the array
 * @example
 * ```ts
 * parseArrayHeader('[ /* c *\/ 1,2]TAIL'.slice(1) as FragmentStringJsonc)
 * // → { arrayComment: { /* ... *\/ }, tail: ' 1,2]TAIL' as FragmentStringJsonc }
 * ```
 */
export function parseArrayHeader(
  valueAfterBracket: FragmentStringJsonc | StringJsonc,
  context?: Jsonc.ValueBase,
): { arrayComment?: Jsonc.Comment; tail: FragmentStringJsonc; } {
  // Array-level comment comes from outside the '[' via context; do not consume inside comments here.
  return {
    ...(context?.comment ? { arrayComment: context.comment, } : {}),
    tail: valueAfterBracket as FragmentStringJsonc,
  };
}
//endregion Array header

//region Array separators -- Determine end of array or next element start
/**
 * Given the raw tail after an element, consume comments/whitespace once and decide next action.
 *
 * @param value - Tail beginning after an element value
 * @returns Discriminated union: `'end'` with tail after ']' or `'next'` with the next element's start
 * @throws Error - When neither ',' nor ']' is found in a valid position
 */
export function expectArraySeparatorOrEnd(
  value: FragmentStringJsonc,
): { kind: 'end'; tail: FragmentStringJsonc; } | { kind: 'next';
  tailStart: FragmentStringJsonc; }
{
  const after = startsWithComment({ value, },);
  const rc = after.remainingContent.trimStart() as FragmentStringJsonc;

  if (rc.startsWith(']',))
    return { kind: 'end', tail: rc.slice(1,) as FragmentStringJsonc, };

  if (rc.startsWith(',',)) {
    const afterComma = rc.slice(1,) as FragmentStringJsonc;
    const next = startsWithComment({ value: afterComma, },);
    const nextToken = next.remainingContent.trimStart() as FragmentStringJsonc;
    if (nextToken.startsWith(']',))
      return { kind: 'end', tail: nextToken.slice(1,) as FragmentStringJsonc, };
    return { kind: 'next', tailStart: nextToken, };
  }

  const preview = rc.slice(0, 32,);
  throw new Error(`malformed jsonc array: expected ',' or ']' near: ${preview}`,);
}
//endregion Array separators

//region Array elements -- Recursive, immutable element parsing for arrays
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
  const lead = startsWithComment({ value: tail, },);
  const start = lead.remainingContent;

  if (start.startsWith(']',))
    return { items, tail: start.slice(1,) as FragmentStringJsonc, };

  const { parsed, remaining, } = parseValueFromStart({ value: start, context: lead, },);
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
  const woOpening = value.slice('['.length,) as FragmentStringJsonc;
  const { arrayComment, tail: headerTail, } = parseArrayHeader(woOpening, context,);
  //endregion Entry and comment skip

  //region Empty array fast-exit -- Handle immediate closing bracket
  // Peek for closing bracket after consuming only inside-the-bracket comments;
  // if empty, merge inside comments into array-level comment.
  const insideLead = startsWithComment({ value: headerTail, },);
  if (insideLead.remainingContent.startsWith(']',)) {
    let finalComment: Jsonc.Comment | undefined;
    if (arrayComment && insideLead.comment)
      finalComment = mergeComments({ value: arrayComment, value2: insideLead.comment, },);
    else if (arrayComment)
      finalComment = mergeComments({ value: arrayComment, },);
    else if (insideLead.comment)
      finalComment = mergeComments({ value2: insideLead.comment, },);
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
  const { items, tail, } = parseArrayElements(headerTail, [],);
  return {
    value: items as Jsonc.Value[],
    ...(arrayComment ? { comment: arrayComment, } : {}),
    remainingContent: tail,
  };
  //endregion Element recursion
}

/**
 * Parse a JSONC object fragment starting at '{' while preserving comments.
 *
 * Intent: parse key-value pairs with support for comments around keys, colons, and values, including
 * tolerance for a trailing comma before the closing '}'. Current implementation is a skeleton that
 * outlines control flow and delegates on nested containers.
 *
 * @param value - Input fragment beginning with '{'
 * @param context - Optional value base used for comment propagation
 * @returns Parsed record node and `remainingContent` after the closing '}'
 * @throws Error - Not implemented yet
 */
export function customParserForRecord(
  { value, context, }: { value: FragmentStringJsonc | StringJsonc;
    context?: Jsonc.ValueBase; },
): Jsonc.Record & { remainingContent: FragmentStringJsonc; } {
  //region Entry and comment skip -- Drop the opening '{' then consume leading comments/space
  const woOpening = value.slice('{'.length,) as FragmentStringJsonc;
  const outStartsComment = startsWithComment({ value: woOpening, },);
  //endregion Entry and comment skip

  // Must start with a record pair, another array, or another record.
  const { remainingContent, } = outStartsComment;

  //region Nested structure detection -- If first token opens a container, delegate accordingly
  if (remainingContent.startsWith('[',)) {
    const allItemsAndPossiblyMore = { ...outStartsComment,
      ...(customParserForArray({ value: remainingContent, },)), };
  }

  if (remainingContent.startsWith('{',)) {
    const allItemsAndPossiblyMore = { ...outStartsComment,
      ...(customParserForRecord({ value: remainingContent, },)), };
  }
  //endregion Nested structure detection

  // Not implemented yet – keep type soundness
  throw new Error('customParserForRecord not implemented yet',);
}
