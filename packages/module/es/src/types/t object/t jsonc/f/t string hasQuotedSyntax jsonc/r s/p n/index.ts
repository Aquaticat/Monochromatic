import type { $ as Int, } from '@_/types/t number/t finite/t int/t/index.ts';
import type {
  $ as StringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import type { UnknownRecord, } from 'type-fest';

const f = Object.freeze;

export type FragmentStringJsonc = string & { __brand: { jsonc: 'fragment'; }; };

//region Type Definitions -- Define all TypeScript types for the parsed JSONC structure

/**
 * Comment attached to a JSONC value
 */
export type JsoncComment = {
  /** Type of comment */
  type: 'inline' | 'block' | 'mixed';
  /** Untrimmed comment content without delimiters */
  commentValue: string;
};

/**
 * Base structure for all parsed JSONC values
 */
export type JsoncValueBase = {
  /** Optional comment attached to this value */
  comment?: JsoncComment;
};

/**
 * Parsed JSONC string value
 */
export type JsoncStringBase = {
  value: string;
};

/**
 * Parsed JSONC number value
 */
export type JsoncNumberBase = {
  value: number;
};

/**
 * Parsed JSONC boolean value
 */
export type JsoncBooleanBase = {
  value: boolean;
};

/**
 * Parsed JSONC null value
 */
export type JsoncNullBase = {
  value: null;
};

/**
 * Parsed JSONC array value
 */
export type JsoncArrayBase = {
  value: JsoncValue[];
};

/**
 * Record key in a parsed JSONC object
 */
export type JsoncRecordKey = JsoncStringBase & JsoncValueBase;

/**
 * Parsed JSONC object/record value
 */
export type JsoncRecordBase = { value: Map<JsoncRecordKey, JsoncValue>; };

export type PlainJsonBase = {
  json: UnknownRecord;
};

/**
 * Union of all possible parsed JSONC values
 */
export type JsoncValue =
  & (
    | JsoncStringBase
    | JsoncNumberBase
    | JsoncBooleanBase
    | JsoncNullBase
    | JsoncArrayBase
    | JsoncRecordBase
    | PlainJsonBase
  )
  & JsoncValueBase;

//endregion Type Definitions

/**
 * Parse JSONC string into structured representation with comment preservation and hierarchical optimization.
 *
 * This advanced parser handles JSONC (JSON with Comments) format, preserving comments alongside data
 * while providing performance optimizations through hierarchical fast-path parsing. Uses native JSON.parse
 * for clean sections and custom parsing only where JSONC-specific features are present.
 *
 * @param input - JSONC string to parse with comment support
 * @returns Parsed JSONC structure with preserved comments and type information
 *
 * @example
 * Basic JSONC parsing with comments:
 * ```ts
 * const jsonc = `{
 *   "name": "example", // This is a name
 *   "version": "1.0.0" /* Version info *\/,
 *   "active": true
 * }`;
 *
 * const result = $(jsonc);
 * console.log(result.type); // 'record'
 * console.log(result.value[0].recordValue.comment); // Comment info
 * ```
 *
 * @example
 * Handling different comment types:
 * ```ts
 * const jsoncWithMixedComments = `{
 *   // Single line comment
 *   "data": [
 *     1, 2, 3 /* Block comment *\/
 *   ],
 *   "config": {
 *     "enabled": true // Another inline comment
 *   }
 * }`;
 *
 * const parsed = $(jsoncWithMixedComments);
 * // Comments are preserved in the structure
 * ```
 *
 * @example
 * Performance optimization with clean JSON:
 * ```ts
 * // Clean JSON without comments gets fast-path treatment
 * const cleanJson = '{"fast": true, "optimized": [1, 2, 3]}';
 * const result = $(cleanJson);
 * // Uses native JSON.parse internally for performance
 * ```
 *
 * @example
 * Trailing comma support:
 * ```ts
 * const jsoncWithTrailingCommas = `{
 *   "items": [
 *     "first",
 *     "second",
 *   ],
 *   "config": {
 *     "debug": true,
 *   },
 * }`;
 *
 * const parsed = $(jsoncWithTrailingCommas);
 * // Trailing commas are handled correctly
 * ```
 *
 * @example
 * Complex nested structures with comments:
 * ```ts
 * const complexJsonc = `{
 *   // Application configuration
 *   "app": {
 *     "name": "MyApp", /* Application name *\/
 *     "settings": {
 *       "theme": "dark", // UI theme
 *       "features": [
 *         "auth", // Authentication
 *         "api"   // API integration
 *       ]
 *     }
 *   }
 * }`;
 *
 * const result = $(complexJsonc);
 * // All comments preserved with proper type information
 * ```
 *
 * Features:
 * - Preserves inline (//) and block (/* *\/) comments
 * - Supports trailing commas in objects and arrays
 * - Hierarchical optimization: uses native JSON.parse for clean sections
 * - Detailed error messages with position information
 * - Memory-efficient parsing with comment extraction
 */
export function $({ value, }: { value: StringJsonc; },): JsoncValue {
  const outStartsComment = startsWithComment({ value, },);
  const result = (function getResult({ outStartsComment, },): JsoncValue {
    const { remainingContent: value, } = outStartsComment;
    if (value.startsWith('[',)) {
      // Can't use this to eliminate all trailing commas, because some might be inside comments, some might be inside quotes.
      const trailingCommaMatches = f(Array.from(value.matchAll(/,\s+]/g,),),);
      const lastTrailingCommaMatch = trailingCommaMatches.at(-1,);
      if (lastTrailingCommaMatch) {
        const closeSquareBracketIndex = lastTrailingCommaMatch.index
          + lastTrailingCommaMatch.length;
        if (closeSquareBracketIndex === value.length) {
          const outerIsJson = `${
            value.slice(0, value.length - lastTrailingCommaMatch.length,)
          }]`;
          try {
            return { ...outStartsComment, json: JSON
              .parse(outerIsJson,) as UnknownRecord, };
          }
          catch (error) {
            console.log(error,);
            // Something is inside.
            // Probably comments and trailing commas.
            // Defer to custom parser.
          }
        }
      }
      // Something is at the end.
      // Probably comments.
      // Defer to custom parser.
      // TODO: Avoid returning undefined.
      return undefined;
    }
    else if (value.startsWith('{',)) {
      // Can't use this to eliminate all trailing commas, because some might be inside comments, some might be inside quotes.
      const trailingCommaMatches = f(Array.from(value.matchAll(/,\s+}/g,),),);
      const lastTrailingCommaMatch = trailingCommaMatches.at(-1,);
      if (lastTrailingCommaMatch) {
        const closeSquigglyBracketIndex = lastTrailingCommaMatch.index
          + lastTrailingCommaMatch.length;
        if (closeSquigglyBracketIndex === value.length) {
          const outerIsJson = `${
            value.slice(0, value.length - lastTrailingCommaMatch.length,)
          }]`;
          try {
            return { ...outStartsComment, json: JSON
              .parse(outerIsJson,) as UnknownRecord, };
          }
          catch (error) {
            console.log(error,);
            // Something is inside.
            // Probably comments and trailing commas.
            // Defer to custom parser.
          }
        }
      }
      // Something is at the end.
      // Probably comments.
      // Defer to custom parser.
      // TODO: Avoid returning undefined.
      return undefined;
    }
    throw new Error(
      'invalid jsonc, after removing comments and trimming, nothing except [ or { shall be at the start',
    );
  })({ outStartsComment, },);

  return result;
}

export const numberLengthsToTestFirst = [1, 2, 4, 8, 16,] as const;

export function getLengthsToTestFirst(
  { lengthUpperBound, lengths, }: { lengthUpperBound: number;
    lengths: readonly number[]; },
): number[] {
  const result = [lengthUpperBound,];
  for (const length of lengths) {
    if (length > lengthUpperBound)
      break;

    result.push(length,);
  }
  return result;
}

// TODO: Find a better home for this fn.
export function getArrayInts(
  { startExclusive, endExclusive, }: { startExclusive: number; endExclusive: number; },
): Int[] {
  const start = (Math.floor(startExclusive,) + 1) as Int;
  const end = (Math.ceil(endExclusive,) - 1) as Int;
  const result = (start > end
    ? []
    : Array.from({ length: end - start + 1, }, (_, i,) => start + i,)) as Int[];
  return result;
}

export function customParserForArray(
  { value, context, }: { value: FragmentStringJsonc | StringJsonc;
    context?: JsoncValueBase; },
): JsoncValue & { remainingContent: FragmentStringJsonc; } {
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
  ): { consumed: string; parsed: JsoncValue; remaining: string; } {
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

//region numbers in js
const _num2 = 0.0e0;
const _num3 = 0.e0;
const _num4 = 0e0;
const _num8 = 0e01;

// invalid
// const _num5 = e0;
// const _num8 = -e0;
// invalid (by eslint)
// const _num6 = 01;

//endregion numbers in js

// TODO: Express every StringJsonc is FragmentStringJsonc

export function customParserForRecord(
  { value, context, }: { value: FragmentStringJsonc | StringJsonc;
    context?: JsoncValueBase; },
): JsoncValue {
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

export function startsWithComment<const Value extends StringJsonc | FragmentStringJsonc,>(
  { value, context, }: { value: Value; context?: JsoncValueBase; },
): StringJsonc extends Value ? {
    remainingContent: StringJsonc;
  } & JsoncValueBase
  : FragmentStringJsonc extends Value ? {
      remainingContent: FragmentStringJsonc;
    } & JsoncValueBase
  : never
{
  // Eliminate leading and trailing whitespace, including space and newline characters.
  const trimmed = value.trim();

  // trimmed.split('//') would not be faster because it needs to scan the whole string.

  if (trimmed.startsWith('//',)) {
    // Find the end of the line comment (newline character)
    const newlinePosition = trimmed.indexOf('\n', '//'.length,);
    if (newlinePosition === -1) {
      // No newline found, the entire string is a line comment
      // Template works because we're not really using it as a template string, just to communicate the error.
      throw new Error(`line comment is not jsonc, {
        comment: {
          type: 'inline',
          commentValue: ${trimmed.slice('//'.length,)},
        },
      }`,);
    }

    // JSON or JSONC doesn't allow newlines in quoted strings. Special handling skipped.

    // Extract the comment and the rest of the content after newline
    // No trimming needed because we wanna support both `// This is` and `//region`.
    const commentPart: JsoncComment = { type: 'inline', commentValue: trimmed
      .slice('//'.length, newlinePosition,), };
    const mergedComments = mergeComments({ value: context?.comment,
      value2: commentPart, },);

    const remainingContent = trimmed
      .slice(newlinePosition + '\n'.length,)
      .trim() as Value;

    // Recursively parse the remaining content
    return startsWithComment({ value: remainingContent, context: {
      comment: mergedComments,
    }, },);
  }

  if (trimmed.startsWith('/*',)) {
    const blockEndPosition = function findBlockEndPosition({ value, },) {
      // If it's on the first line, we've hit the jackpot.
      //       How do we know if it's on the first line?
      //       /\/\*[^\n]{0,}\*\//
      //
      //       If not, continue grinding.
      //       Use the regexp /\n[^\n]{0,}\*\//g
      //       Then check if the match contains '//'
      //       If so, discard the match.

      const trimmed = value.trim();

      // Check for first-line optimization jackpot case: /*...*/ all on one line
      // This handles the unique case where the entire block comment is on the first line
      const FIRST_LINE_BLOCK_COMMENT_REGEX = /\/\*[^\n]*\*\//;
      const firstLineMatch = FIRST_LINE_BLOCK_COMMENT_REGEX.exec(trimmed,);
      if (firstLineMatch) {
        // Found a complete block comment on the first line - return immediately
        // Doesn't handle `/* a {"b": "*/" } */ {"c": "d"}`
        // Because in all languages, */ upon first found after starting a block comment, auto becomes end marker of block comment.
        return firstLineMatch.index + firstLineMatch[0].length - '*/'.length;
      }

      // If not on first line, use line-based approach
      // This regex specifically finds */ that appear after newlines
      const NEWLINE_STAR_SLASH_REGEX = /\n[^\n]*\*\//g;
      const newlineStarSlashMatches = trimmed.matchAll(NEWLINE_STAR_SLASH_REGEX,);

      // Process each starSlash match and check for line comment interference
      for (const newlineStarSlashMatch of newlineStarSlashMatches) {
        // Check if this starSlash is commented out by a line comment on the same line
        if (newlineStarSlashMatch.includes('//',)) {
          // Discard this match, continue to next starSlash
          continue;
        }

        // No need to manually ensure starSlash isn't in quotes.
        // Why? Because if the first starSlash is in quotes when we've already found a slashStar at start, it's invalid JSONC.
        // And we assume valid JSONC.

        // Valid starSlash found - return its position
        return newlineStarSlashMatch.index
          + newlineStarSlashMatch[0].length
          - '*/'.length;
      }

      // No valid block comment end found
      throw new Error(`incomplete block comment is not  jsonc, {
            comment: {
              type: 'block',
              commentValue: ${trimmed.slice('/*'.length,)},
            },
          }`,);
    }({ value: trimmed, },);

    // Extract the comment and the rest of the content after the closing star slash
    const commentPart: JsoncComment = {
      type: 'block',
      commentValue: trimmed.slice('/*'.length, blockEndPosition,),
    };
    const mergedComments = mergeComments({ value: context?.comment,
      value2: commentPart, },);

    // Get content after the block comment, skipping the star slash delimiter
    const remainingContent = trimmed
      .slice(blockEndPosition + '*/'.length,)
      .trim() as Value;

    // Recursively parse the remaining content
    return startsWithComment({ value: remainingContent, context: {
      comment: mergedComments,
    }, },);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- value is Value is auto narrowed.
  return { ...context, remainingContent: value, } as any;
}

export function mergeComments(
  { value, value2, }: {
    value?: undefined;
    value2?: undefined;
  },
): undefined;
export function mergeComments(
  { value, value2, }: {
    value: JsoncComment;
    value2?: JsoncComment | undefined;
  } | {
    value?: JsoncComment | undefined;
    value2: JsoncComment;
  },
): JsoncComment;
export function mergeComments(
  { value, value2, }: { value?: JsoncComment | undefined;
    value2?: JsoncComment | undefined; },
): JsoncComment | undefined {
  if (value === undefined)
    return value2;
  // value is determined to not be undefined here.
  if (value2 === undefined)
    return value;
  // Both has comment.
  // No trimming needed because we wanna support both `// This is` and `//region`.
  const commentValue = `${value.commentValue}
  ${value2.commentValue}`;
  return value.type === value2.type
    ? { ...value, commentValue, }
    : { ...value, type: 'mixed', commentValue, };
}
