import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import type * as Jsonc from '../../../../t/index.ts';
import { startsWithComment, } from './index.customParsers.startsWithComment.ts';

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
  /** Leading comments/whitespace after previous element value. */
  const after = startsWithComment({ value, },);
  /** Tail trimmed to detect ',' or ']' token. */
  const rc = after.remainingContent.trimStart() as FragmentStringJsonc;

  if (rc.startsWith(']',))
    return { kind: 'end', tail: rc.slice(1,) as FragmentStringJsonc, };

  if (rc.startsWith(',',)) {
    /** Tail after the element separator comma. */
    const afterComma = rc.slice(1,) as FragmentStringJsonc;
    /** Comments/whitespace before the next potential element. */
    const next = startsWithComment({ value: afterComma, },);
    /** Start of the next token inside the array. */
    const nextToken = next.remainingContent.trimStart() as FragmentStringJsonc;
    if (nextToken.startsWith(']',))
      return { kind: 'end', tail: nextToken.slice(1,) as FragmentStringJsonc, };
    return { kind: 'next', tailStart: nextToken, };
  }

  /** Preview snippet used for error reporting context. */
  const preview = rc.slice(0, 32,);
  throw new Error(`malformed jsonc array: expected ',' or ']' near: ${preview}`,);
}
//endregion Array separators
