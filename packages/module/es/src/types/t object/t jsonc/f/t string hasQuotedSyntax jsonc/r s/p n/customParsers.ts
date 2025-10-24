/*
  Custom JSONC parsers for arrays and objects.
  These are the careful, comment-preserving "service road" paths that handle comments, whitespace,
  and trailing commas when the fast-path cannot use JSON.parse safely.
  Region markers outline imports, function phases, and known pitfalls to aid maintainability.
*/

//region Imports and helpers -- Core types, utilities, and comment skipper used by the parsers
import * as Jsonc from '../../../../t/index.ts';
import { scanQuotedString, } from './scanQuotedString.ts';

import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import { startsWithComment, } from './startsWithComment.ts';
const f = Object.freeze;
//endregion Imports and helpers

//region Value tokenizers -- Pure helpers for literals and numbers with explicit contracts
/** Sentinel returned when no JSON literal is present at the start. */
export const NO_LITERAL: symbol = Symbol('jsonc:parseLiteralToken:no-match',);
/**
 * Parse JSON literals starting at the current position.
 * Supports: null, true, false.
 *
 * @example
 * ```ts
 * parseLiteralToken({ value: 'null,1' }) // -> { consumed: 'null', parsed: { value: null }, remaining: ',1' }
 * ```
 */
export function parseLiteralToken(
  { value, }: { value: FragmentStringJsonc | StringJsonc; },
):
  | { consumed: FragmentStringJsonc; parsed: Jsonc.Value;
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
 * Parse a JSON number token from the start using a grammar regex; avoids speculative mutation-heavy probing.
 * The regex matches the JSON number grammar and returns the longest valid numeric prefix.
 *
 * Note: Regex is used instead of incremental mutation to preserve immutability and readability.
 *
 * @example
 * ```ts
 * parseNumberToken({ value: '-12.3e+4, x' }) // -> { consumed: '-12.3e+4', parsed: { value: -123000 }, remaining: ', x' }
 * ```
 */
export function parseNumberToken(
  { value, }: { value: FragmentStringJsonc | StringJsonc; },
): { consumed: FragmentStringJsonc; parsed: Jsonc.Value;
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
 * Parse a single JSONC value from the current position, delegating containers and attaching optional context comment.
 *
 * @example
 * ```ts
 * parseValueFromStart({ value: '"x" ,', }) // -> parsed string, remaining ' ,'
 * parseValueFromStart({ value: '[1]', }) // -> parsed array, remaining ''
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
  if (literal !== NO_LITERAL) {
    const myLiteral = literal as { consumed: FragmentStringJsonc; parsed: Jsonc.Value;
      remaining: FragmentStringJsonc; };
    const parsed: Jsonc.Value = context?.comment
      ? { ...myLiteral.parsed, comment: context.comment, }
      : myLiteral.parsed;
    return { parsed, remaining: myLiteral.remaining, };
  }

  if (value.startsWith('[',)) {
    const out = context
      ? customParserForArray({ value, context, },)
      : customParserForArray({ value, },);
    const { remainingContent, ...parsed } =
      out as unknown as (Jsonc.Value & { remainingContent: FragmentStringJsonc; });
    return { parsed: parsed as Jsonc.Value, remaining: remainingContent, };
  }

  if (value.startsWith('{',)) {
    const out = context
      ? customParserForRecord({ value, context, },)
      : customParserForRecord({ value, },);
    const { remainingContent, ...parsed } =
      out as unknown as (Jsonc.Value & { remainingContent: FragmentStringJsonc; });
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
 * After '[', return array-level comment (if any) and the tail at the first element or ']'.
 *
 * @example
 * ```ts
 * parseArrayHeader('[ /* c *\/ 1,2]TAIL'.slice(1) as FragmentStringJsonc) // -> { arrayComment, tail: '1,2]TAIL' }
 * ```
 */
export function parseArrayHeader(
  valueAfterBracket: FragmentStringJsonc | StringJsonc,
  context?: Jsonc.ValueBase,
): { arrayComment?: Jsonc.Comment; tail: FragmentStringJsonc; } {
  const lead = context
    ? startsWithComment({ value: valueAfterBracket as FragmentStringJsonc, context, },)
    : startsWithComment({ value: valueAfterBracket as FragmentStringJsonc, },);
  return {
    ...(lead.comment ? { arrayComment: lead.comment, } : {}),
    tail: lead.remainingContent,
  };
}
//endregion Array header

//region Array separators -- Determine end of array or next element start
/**
 * Given the raw tail after an element, consume comments/whitespace once and decide next action.
 * Returns 'end' with tail after ']' or 'next' with the starting point of the next element.
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
 * Parse one or more array elements starting from a tail, returning the collected items and the tail after ']'.
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
 * Why this exists: Global regex edits are unsafe in the presence of quotes and comments. This parser advances
 * token-by-token, allowing comments/whitespace between items and supporting trailing commas.
 *
 * Contract: returns a Jsonc.Value for the parsed array plus `remainingContent` (the substring after the closing ']').
 * Current state: parses the first item and positions at the start of the second; looping/termination are pending.
 */
export function customParserForArray(
  { value, context, }: { value: FragmentStringJsonc | StringJsonc;
    context?: Jsonc.ValueBase; },
): Jsonc.Value & { remainingContent: FragmentStringJsonc; } {
  //region Entry and comment skip -- Drop the opening '[' then consume leading comments/space
  const woOpening = value.slice('['.length,) as FragmentStringJsonc;
  const { arrayComment, tail: headerTail, } = parseArrayHeader(woOpening, context,);
  //endregion Entry and comment skip

  //region Empty array fast-exit -- Handle immediate closing bracket
  if (headerTail.startsWith(']',)) {
    return {
      value: [] as Jsonc.Value[],
      ...(arrayComment ? { comment: arrayComment, } : {}),
      remainingContent: headerTail.slice(
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
 * delegates on nested containers and outlines the control flow.
 */
export function customParserForRecord(
  { value, context, }: { value: FragmentStringJsonc | StringJsonc;
    context?: Jsonc.ValueBase; },
): Jsonc.Value & { remainingContent: FragmentStringJsonc; } {
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
