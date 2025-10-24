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

export function customParserForArray(
  { value, context, }: { value: FragmentStringJsonc | StringJsonc;
    context?: Jsonc.ValueBase; },
): Jsonc.Value & { remainingContent: FragmentStringJsonc; } {
  const woOpening = value.slice('['.length,) as FragmentStringJsonc;
  const outStartsComment = startsWithComment({ value: woOpening, },);

  // Must start with an array item, another array, or another record.
  // Or if the array is empty, closingSquareBracket.
  const { remainingContent, } = outStartsComment;

  if (remainingContent.startsWith(']',)) {
    return { ...outStartsComment, value: [], remainingContent: remainingContent
      .slice(']'.length,), };
  }

  if (remainingContent.startsWith('[',)) {
    const firstItem = { ...outStartsComment,
      ...(customParserForArray({ value: remainingContent, },)), };
  }

  if (remainingContent.startsWith('{',)) {
    const firstItem = { ...outStartsComment,
      ...(customParserForRecord({ value: remainingContent, },)), };
  }

  // Must start with a primitive array item
  // read until encountering (unquoted comma) or newline or (unquoted whitespace) or (unquoted comment start marker slashStar only) or closingSquareBracket.
  //
  // Why are we not considering unquoted comment start marker slashSlash?
  // Because slashSlash comments out current line, which means
  // `1//` cannot be valid no matter what follows.
  // And we'd already handled the case where `1,//` in "encountering comma".
  // And we'd already handled the case where `1\n//\n,` in "encountering newline".
  const { parsed, remaining, } = (function getUntil(
    { value, },
  ): { consumed: string; parsed: Jsonc.Value; remaining: string; } {
    if (value.startsWith('"',)) {
      const valueAfterQuote = value.slice('"'.length,);
      const nextQuote = valueAfterQuote.match(/(?<!\\)(?:\\\\)*"/g,);
      if (!nextQuote)
        throw new Error('malformed jsonc',);
      const parsedValue = value.slice(0, nextQuote.index! + 1,);
      // No need to check if nextQuote isn't commented out.
      // We're already in quotes, so all comment markers are unavailable.
      return { consumed: parsedValue, parsed: { value: parsedValue, }, remaining: value
        .slice(nextQuote.index! + 1,), };
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
  // TODO: Okay, that's just the start. And?
  // trimmed must start with either a comma or comments.
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
}

export function customParserForRecord(
  { value, context, }: { value: FragmentStringJsonc | StringJsonc;
    context?: Jsonc.ValueBase; },
): Jsonc.Value {
  const woOpening = value.slice('{'.length,) as FragmentStringJsonc;
  const outStartsComment = startsWithComment({ value: woOpening, },);

  // Must start with a record pair, another array, or another record.
  const { remainingContent, } = outStartsComment;

  if (remainingContent.startsWith('[',)) {
    const allItemsAndPossiblyMore = { ...outStartsComment,
      ...(customParserForArray({ value: remainingContent, },)), };
  }

  if (remainingContent.startsWith('{',)) {
    const allItemsAndPossiblyMore = { ...outStartsComment,
      ...(customParserForRecord({ value: remainingContent, },)), };
  }
}
