/*
  Custom JSONC parsers for arrays and objects.
  These are the careful, comment-preserving "service road" paths that handle comments, whitespace,
  and trailing commas when the fast-path cannot use JSON.parse safely.
  Region markers outline imports, function phases, and known pitfalls to aid maintainability.
*/

//region Imports and helpers -- Core types, utilities, and comment skipper used by the parsers
import * as Jsonc from '../../../../t/index.ts';
import {
  getArrayInts,
  getLengthsToTestFirst,
  numberLengthsToTestFirst,
} from './utilities.ts';

import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import { startsWithComment, } from './startsWithComment.ts';
const f = Object.freeze;
//endregion Imports and helpers

//region Local helpers -- Escape-aware quoted-string scanner without regex; returns consumed slice and remaining tail
function scanQuotedString(
  { value, }: { value: FragmentStringJsonc | StringJsonc },
): { consumed: FragmentStringJsonc; parsed: Jsonc.Value; remaining: FragmentStringJsonc } {
  if (!value.startsWith('"',))
    throw new Error('expected a double quote to start a JSON string',);

  let index = 1; // start after the opening quote
  const length = value.length;

  while (index < length) {
    const ch = value.charCodeAt(index,);
    // '"'
    if (ch === 34) {
      // Count consecutive backslashes immediately before this quote
      let backslashCount = 0;
      let k = index - 1;
      while (k >= 0 && value.charCodeAt(k,) === 92) { // '\\'
        backslashCount++;
        k--;
      }
      const isUnescaped = (backslashCount & 1) === 0;
      if (isUnescaped) {
        const consumed = value.slice(0, index + 1,) as FragmentStringJsonc;
        const remaining = value.slice(index + 1,) as FragmentStringJsonc;
        return { consumed, parsed: { value: consumed, }, remaining, };
      }
    }
    index++;
  }

  throw new Error('malformed jsonc, unterminated string',);
}
//endregion Local helpers

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
  const outStartsComment = startsWithComment({ value: woOpening, },);
  //endregion Entry and comment skip

  // Must start with an array item, another array, or another record.
  // Or if the array is empty, closingSquareBracket.
  const { remainingContent, } = outStartsComment;

  //region Empty array fast-exit -- Handle immediate closing bracket
  if (remainingContent.startsWith(']',)) {
    return { ...outStartsComment, value: [], remainingContent: remainingContent
      .slice(']'.length,) as FragmentStringJsonc, };
  }
  //endregion Empty array fast-exit

  //region Nested structure detection -- Delegate when next token starts another container
  if (remainingContent.startsWith('[',)) {
    const firstItem = { ...outStartsComment,
      ...(customParserForArray({ value: remainingContent, },)), };
  }

  if (remainingContent.startsWith('{',)) {
    const firstItem = { ...outStartsComment,
      ...(customParserForRecord({ value: remainingContent, },)), };
  }
  //endregion Nested structure detection

  // Must start with a primitive array item
  // read until encountering (unquoted comma) or newline or (unquoted whitespace) or (unquoted comment start marker slashStar only) or closingSquareBracket.
  //
  // Why are we not considering unquoted comment start marker slashSlash?
  // Because slashSlash comments out current line, which means
  // `1//` cannot be valid no matter what follows.
  // And we'd already handled the case where `1,//` in "encountering comma".
  // And we'd already handled the case where `1\n//\n,` in "encountering newline".
  //region Primitive parsing -- Strings, null/true/false, and number boundary probing
  const { parsed, remaining, } = (function getUntil(
    { value, },
  ): { consumed: string; parsed: Jsonc.Value; remaining: string; } {
    if (value.startsWith('"',)) {
      const out = scanQuotedString({ value: value as FragmentStringJsonc, },);
      return { consumed: out.consumed, parsed: out.parsed, remaining: out.remaining, };
    }
    else if (value.startsWith('null',)) {
      const valueExceptStartingNull = value.slice('null'.length,);
      return { consumed: 'null', parsed: { value: null, },
        remaining: valueExceptStartingNull, };
    }
    else if (value.startsWith('true',)) {
      const valueExceptStartingTrue = value.slice('true'.length,);
      return { consumed: 'true', parsed: { value: true, },
        remaining: valueExceptStartingTrue, };
    }
    else if (value.startsWith('false',)) {
      const valueExceptStartingFalse = value.slice('false'.length,);
      return { consumed: 'false', parsed: { value: false, },
        remaining: valueExceptStartingFalse, };
    }
    else if (['-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',].some(
      function startsWithNumberMarker(numberMarker,) {
        return value.startsWith(numberMarker,);
      },
    )) {
      const lengthsToTestFirst = getLengthsToTestFirst({ lengthUpperBound: value.length,
        lengths: numberLengthsToTestFirst, },);

      const lastTested: { longestKnownSuccess?: { length: number; result: number; };
        shortestKnownFail?: { length: number; }; } = {};
      for (const lengthToTestFirst of lengthsToTestFirst) {
        const sliced = value.slice(0, lengthToTestFirst,);
        try {
          const potentialNumber = JSON.parse(sliced,) as unknown;
          if (typeof potentialNumber === 'number') {
            lastTested.longestKnownSuccess = f({ length: lengthToTestFirst, success: true,
              result: potentialNumber, },);
            // continue to the bigger length, if there's no bigger length, we're done.
          }
          else {
            throw new Error('malformed jsonc, non-number after number marker',);
          }
        }
        catch (error: any) {
          console.error(`${sliced} ${(error as Error).message}`,);
          lastTested.shortestKnownFail = { length: lengthToTestFirst, };

          break;
        }
      }
      if (lastTested.longestKnownSuccess) {
        if (lastTested.shortestKnownFail) {
          const lengthsToTest = getArrayInts({
            startExclusive: lastTested.longestKnownSuccess.length,
            endExclusive: lastTested.shortestKnownFail.length,
          },);
          // TODO: Also test lengthsToTest
          // Test each intermediate length to find the exact boundary
          for (const lengthToTest of lengthsToTest) {
            const sliced = value.slice(0, lengthToTest,);
            try {
              const potentialNumber = JSON.parse(sliced,) as unknown;
              if (typeof potentialNumber === 'number') {
                lastTested.longestKnownSuccess = f({ length: lengthToTest, success: true,
                  result: potentialNumber, },);
              }
              else {
                throw new Error('malformed jsonc, non-number after number marker',);
              }
            }
            catch (error: any) {
              console.error(`${sliced} ${(error as Error).message}`,);
              lastTested.shortestKnownFail = { length: lengthToTest, };
              break;
            }
          }
          // now we have the canon longestKnownSuccess
          const { result, length, } = lastTested.longestKnownSuccess;
          return { consumed: value.slice(0, length,), parsed: { value: result, },
            remaining: value.slice(length,), };
        }
        else {
          // longestKnownSuccess exists but shortestKnownFail doesn't, which means the entire string is a number.
          const { result, } = lastTested.longestKnownSuccess;
          return { consumed: value, parsed: { value: result, }, remaining: '', };
        }
      }
      else {
        throw new Error('malformed jsonc, non-number after dash',);
      }
    }
    else {
      throw new Error('invalid jsonc primitive array item',);
    }
  })({ value: remainingContent, },);
  //endregion Primitive parsing
  // TODO: Okay, that's just the start. And?
  // trimmed must start with either a comma or comments.
  //region Separator handling -- After first item, expect a comma for multi-item arrays (comments/whitespace allowed)
  const afterFirstItemTrimmed = remaining.trimStart() as FragmentStringJsonc;
  const afterFirstItemOutStartsComment = startsWithComment({
    value: afterFirstItemTrimmed,
  },);
  const { remainingContent: afterFirstItemRemainingContent, } =
    afterFirstItemOutStartsComment;
  // afterFirstItemRemainingContent must start with a comma if the array has more than 1 item.
  // TODO: must start with a closingSquareBracket or a comma + comments/whitespace + closingSquareBracket if the array has only 1 item.
  if (!afterFirstItemRemainingContent.startsWith(',',)) {
    throw new Error(
      `afterFirstItemRemainingContent must start with a comma ${afterFirstItemRemainingContent}`,
    );
  }
  const afterFirstCommaTrimmed = afterFirstItemRemainingContent
    .slice(','.length,)
    .trimStart() as FragmentStringJsonc;
  const afterFirstCommaOutStartsComment = startsWithComment({
    value: afterFirstCommaTrimmed,
  },);
  const { remainingContent: afterFirstCommaRemainingContent, } =
    afterFirstCommaOutStartsComment;
  // afterFirstCommaRemainingContent is the start of the 2nd item.
  //endregion Separator handling
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
