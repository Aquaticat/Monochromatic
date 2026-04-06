// oxlint-disable typescript/no-unsafe-type-assertion -- JSONC parser casts string slices to branded fragment types
/**
 * JSONC array parsing — element recursion and array container parser.
 *
 * MUTUALLY RECURSIVE with {@link parseValueFromStart} via the dispatch module.
 */

import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import type * as Jsonc from '../../../../t/index.ts';
import {
  expectArraySeparatorOrEnd,
  parseArrayHeader,
} from './customParsers.arrayHelpers.ts';
import { callParseValue, } from './customParsers.dispatch.ts';
import { mergeComments, } from './customParsers.startsWithComment.mergeComments.ts';
import { startsWithComment, } from './customParsers.startsWithComment.ts';

//region Array elements -- Recursive, immutable element parsing for arrays (MUTUALLY RECURSIVE)
/**
 * Parse one or more array elements starting from a tail, returning accumulated items and the tail after ']'.
 *
 * @param tail - Input tail positioned at the start of the next element or closing bracket
 *
 * @param items - Collected items so far; treated immutably during recursion
 *
 * @returns Items parsed up to ']' and the remaining tail after the closing bracket
 *
 * @example
 * ```ts
 * const { items, tail } = parseArrayElements('1, 2]rest' as FragmentStringJsonc);
 * // items.length === 2
 * // tail === 'rest'
 * ```
 */
export function parseArrayElements(
  tail: FragmentStringJsonc,
  items: readonly Jsonc.Value[] = [],
): {
  items: readonly Jsonc.Value[];
  tail: FragmentStringJsonc;
} {
  /** Leading comments at element start; carries per-element comment. */
  const lead = startsWithComment({ value: tail, },);
  /** Start positioned at element value or closing bracket. */
  const start = lead.remainingContent;

  if (start.startsWith(']',)) {
    return {
      items,
      tail: start.slice(1,) as FragmentStringJsonc,
    };
  }

  /** Parsed value from current element with propagated comment. */
  const {
    parsed,
    remaining,
  } = callParseValue({
    value: start,
    context: lead,
  },);
  /** Separator decision following the element. */
  const decision = expectArraySeparatorOrEnd(remaining,);
  if (decision.kind === 'end') {
    return {
      items: [
        ...items,
        parsed,
      ],
      tail: decision.tail,
    };
  }
  return parseArrayElements(
    decision.tailStart,
    [
      ...items,
      parsed,
    ],
  );
}
//endregion Array elements

/**
 * Parse a JSONC array fragment starting at '[' while preserving comments and returning the unconsumed tail.
 *
 * Why: Global regex edits are unsafe in the presence of quotes and comments; advancing token-by-token preserves intent.
 *
 * @param value - Input fragment beginning with '['
 *
 * @param context - Optional value base whose `comment` becomes the array-level comment
 *
 * @returns Parsed array node and `remainingContent` positioned after the closing ']'
 *
 * @example
 * ```ts
 * customParserForArray({ value: '[1, /* c *\/ 2]X' as FragmentStringJsonc })
 * // → { value: [{value:1},{value:2}], remainingContent: 'X' as FragmentStringJsonc }
 * ```
 */
export function customParserForArray(
  {
    value,
    context,
  }: {
    value: FragmentStringJsonc | StringJsonc;
    context?: Jsonc.ValueBase;
  },
): Jsonc.Array & { remainingContent: FragmentStringJsonc; } {
  //region Entry and comment skip -- Drop the opening '[' then consume leading comments/space
  /** Tail after stripping the opening '[' to keep pointer immutable. */
  const woOpening = value.slice('['.length,) as FragmentStringJsonc;
  /** Array-level comment from context and header tail inside brackets. */
  const {
    arrayComment,
    tail: headerTail,
  } = parseArrayHeader(
    woOpening,
    context,
  );
  //endregion Entry and comment skip

  //region Empty array fast-exit -- Handle immediate closing bracket
  /** Leading comments/spaces directly inside '[' before first element or ']'. */
  const insideLead = startsWithComment({ value: headerTail, },);
  if (insideLead.remainingContent.startsWith(']',)) {
    /** Combined array-level comment when header and inside comments are present. */
    const finalComment = arrayComment && insideLead.comment
      ? mergeComments({
        value: arrayComment,
        value2: insideLead.comment,
      },)
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
  const {
    items,
    tail,
  } = parseArrayElements(
    headerTail,
    [],
  );
  return {
    value: items as Jsonc.Value[],
    ...(arrayComment ? { comment: arrayComment, } : {}),
    remainingContent: tail,
  };
  //endregion Element recursion
}
