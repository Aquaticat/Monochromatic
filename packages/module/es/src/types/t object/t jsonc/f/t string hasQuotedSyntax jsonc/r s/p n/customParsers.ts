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
/**
 * Parse JSON literals starting at the current position.
 * Supports: null, true, false.
 *
 * @example
 * ```ts
 * parseLiteralToken({ value: 'null,1' }) // -> { consumed: 'null', parsed: { value: null }, remaining: ',1' }
 * ```
 */
function parseLiteralToken(
  { value, }: { value: FragmentStringJsonc | StringJsonc; },
): { consumed: FragmentStringJsonc; parsed: Jsonc.Value; remaining: FragmentStringJsonc; }
  | undefined
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
  return undefined;
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
function parseNumberToken(
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
function parseValueFromStart(
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
  if (literal) {
    const parsed: Jsonc.Value = context?.comment
      ? { ...literal.parsed, comment: context.comment, }
      : literal.parsed;
    return { parsed, remaining: literal.remaining, };
  }

  if (value.startsWith('[',)) {
    const out = customParserForArray({ value, context, },);
    const { remainingContent, ...parsed } =
      out as unknown as (Jsonc.Value & { remainingContent: FragmentStringJsonc; });
    return { parsed: parsed as Jsonc.Value, remaining: remainingContent, };
  }

  if (value.startsWith('{',)) {
    const out = customParserForRecord({ value, context, },);
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
  const arrayLead = startsWithComment({ value: woOpening, context, },);
  //endregion Entry and comment skip

  //region Empty array fast-exit -- Handle immediate closing bracket
  if (arrayLead.remainingContent.startsWith(']',)) {
    return {
      value: [],
      comment: arrayLead.comment,
      remainingContent: arrayLead.remainingContent.slice(
        ']'.length,
      ) as FragmentStringJsonc,
    };
  }
  //endregion Empty array fast-exit

  //region Element recursion -- Parse one element, then decide on separator and continue
  const parseElements = (
    tail: FragmentStringJsonc,
    items: readonly Jsonc.Value[],
  ): { items: readonly Jsonc.Value[]; tail: FragmentStringJsonc; } => {
    const lead = startsWithComment({ value: tail, },);
    const start = lead.remainingContent;

    // If we encounter a closing bracket before an element, finalize
    if (start.startsWith(']',))
      return { items, tail: start.slice(']'.length,) as FragmentStringJsonc, };

    const { parsed, remaining, } = parseValueFromStart({ value: start, context: lead, },);
    const after = startsWithComment({ value: remaining as FragmentStringJsonc, },);
    const rc = (after.remainingContent.trimStart() as FragmentStringJsonc);

    // Case: end of array immediately after element
    if (rc.startsWith(']',)) {
      return { items: [...items, parsed,], tail: rc
        .slice(']'.length,) as FragmentStringJsonc, };
    }

    // Case: comma-separated next element
    if (rc.startsWith(',',)) {
      const afterComma = rc.slice(','.length,) as FragmentStringJsonc;
      const nextStart = startsWithComment({ value: afterComma, },);
      const nextToken = (nextStart.remainingContent.trimStart() as FragmentStringJsonc);

      // Trailing comma allowed: comma + comments/whitespace + ']'
      if (nextToken.startsWith(']',)) {
        return { items: [...items, parsed,], tail: nextToken.slice(']'.length,) as FragmentStringJsonc, };
      }

      return parseElements(nextToken, [...items, parsed,],);
    }

    // Error: expected separator or closing bracket
    const preview = rc.slice(0, 32,);
    throw new Error(`malformed jsonc array: expected ',' or ']' near: ${preview}`,);
  };

  const { items, tail, } = parseElements(arrayLead.remainingContent, [],);
  return { value: items as Jsonc.Value[], comment: arrayLead.comment,
    remainingContent: tail, };
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
}
