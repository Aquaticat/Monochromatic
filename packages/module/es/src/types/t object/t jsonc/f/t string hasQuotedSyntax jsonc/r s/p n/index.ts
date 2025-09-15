import type {
  $ as StringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import type { UnknownRecord, } from 'type-fest';
import { z, } from 'zod/v4-mini';

const f = Object.freeze;

//region Type Definitions -- Define all TypeScript types for the parsed JSONC structure

/**
 * Comment attached to a JSONC value
 */
export type JsoncComment = {
  /** Type of comment */
  type: 'inline' | 'block' | 'mixed';
  /** Comment content without delimiters */
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
export type JsoncString = JsoncValueBase & {
  type: 'string';
  value: string;
};

/**
 * Parsed JSONC number value
 */
export type JsoncNumber = JsoncValueBase & {
  type: 'number';
  value: number;
};

/**
 * Parsed JSONC boolean value
 */
export type JsoncBoolean = JsoncValueBase & {
  type: 'boolean';
  value: boolean;
};

/**
 * Parsed JSONC null value
 */
export type JsoncNull = JsoncValueBase & {
  type: 'null';
  value: null;
};

/**
 * Parsed JSONC array value
 */
export type JsoncArray = JsoncValueBase & {
  type: 'array';
  value: JsoncValue[];
};

/**
 * Record entry in a parsed JSONC object
 */
export type JsoncRecordEntry = {
  recordKey: JsoncString;
  recordValue: JsoncValue;
};

/**
 * Parsed JSONC object/record value
 */
export type JsoncRecord = JsoncValueBase & {
  type: 'record';
  value: JsoncRecordEntry[];
};

/**
 * Union of all possible parsed JSONC values
 */
export type JsoncValue = JsoncString | JsoncNumber | JsoncBoolean | JsoncNull | JsoncArray
  | JsoncRecord | { json: UnknownRecord; } & JsoncValueBase;

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
 * - Type-safe parsing with Zod validation for primitives
 * - Detailed error messages with position information
 * - Memory-efficient parsing with comment extraction
 */
export function $({ value, }: { value: StringJsonc; },): JsoncValue {
  try {
    return { json: JSON.parse(value,) as UnknownRecord, };
  }
  catch (error) {
    // TODO: Swap to logger
    console.log(error,);

    try {
      const outStartsComment = startsWithComment({ value, },);
      return {
        ...outStartsComment,
        json: JSON.parse(outStartsComment.remainingContent,) as UnknownRecord,
      };
    }
    catch (errorNotBecauseOfStartsComment) {
      console.log(errorNotBecauseOfStartsComment,);
    }
  }
}

export function startsWithComment(
  { value, context, }: { value: StringJsonc; context?: JsoncValueBase; },
): { remainingContent: StringJsonc; } & JsoncValueBase {
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
      .trim() as StringJsonc;

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
      .trim() as StringJsonc;

    // Recursively parse the remaining content
    return startsWithComment({ value: remainingContent, context: {
      comment: mergedComments,
    }, },);
  }

  return { ...context, remainingContent: value, };
}

/**
 * Parse JSONC string from the end to extract trailing comments.
 *
 * This function works similarly to startsWithComment but processes comments from the end of the string.
 * It handles both inline comments (//) and block comments (/* *\/) that appear at the end of JSONC content.
 * The function preserves comment information and supports recursive parsing for multiple trailing comments.
 *
 * @param value - JSONC string to parse for trailing comments
 * @param context - Optional context containing existing comment information for merging
 * @returns Object containing the content before the comment and any extracted comment information
 *
 * @example
 * Basic inline comment at the end:
 * ```ts
 * const result = endsWithComment({ value: 'some json // trailing comment' });
 * console.log(result.precedingContent); // 'some json'
 * console.log(result.comment); // { type: 'inline', commentValue: ' trailing comment' }
 * ```
 *
 * @example
 * Block comment at the end:
 * ```ts
 * const result = endsWithComment({ value: 'json content /* block comment *\/' });
 * console.log(result.precedingContent); // 'json content'
 * console.log(result.comment); // { type: 'block', commentValue: ' block comment ' }
 * ```
 *
 * @example
 * Multiple trailing comments:
 * ```ts
 * const result = endsWithComment({ value: 'data // first\n/* second * /' });
 * // Recursively processes both comments and merges them
 * ```
 *
 * @example
 * No trailing comments:
 * ```ts
 * const result = endsWithComment({ value: 'clean json' });
 * console.log(result.precedingContent); // 'clean json'
 * console.log(result.comment); // undefined
 * ```
 *
 * Features:
 * - Handles inline comments (//) at the end of content
 * - Handles block comments (/* *\/) at the end of content
 * - Supports comment merging for multiple trailing comments
 * - Preserves whitespace handling consistent with startsWithComment
 * - Returns content before the comment(s) and comment information
 */
export function endsWithComment(
  { value, context, }: { value: StringJsonc; context?: JsoncValueBase; },
): { precedingContent: StringJsonc; } & JsoncValueBase {
  // TODO: I'm starting to think we should completely forgo endsWithComment and write our own tolerant JSON parser that doesn't throw once it encounters something invalid and instead spits out what it has already eaten.

  // Eliminate leading and trailing whitespace, including space and newline characters.
  const trimmed = value.trim();

  if (trimmed.endsWith('*/',)) {
    const blockStartPosition = function findBlockStartPosition(
      { value, }: { value: string; },
    ) {
      const trimmed = value.trim();

      // Get content before the starSlash to find the matching slashStar
      const lastLinefeedIndex = trimmed.lastIndexOf('\n',);
      const lastLineStartIndex = lastLinefeedIndex === -1 ? 0 : lastLinefeedIndex + 1;
      const lastLine = trimmed.slice(lastLineStartIndex,);
      // FIXME: Wrong, because unlike startsWithComment,
      //        No recognized start slashStar means no finish slashStar.
      const lastLineMatch = lastLine.match(/\/\*.*\*\//,);
      if (lastLineMatch)
        return lastLineMatch.index;
      if (lastLinefeedIndex === -1) {
        throw new Error(
          "only one line, but ending starSlash isn't matched by a slashStar before it.",
        );
      }
    }({ value: trimmed, },);

    // TODO: Finish full fix/refactor
  }

  // Find the last occurrence of // (inline comment at the end)
  const inlineCommentMatches = Array.from(trimmed.matchAll(/\n\s*\/\//,),);
  const lastInlineCommentMatch = inlineCommentMatches.at(-1,);
  if (lastInlineCommentMatch) {
    const contentAfterInline = trimmed.slice(
      lastInlineCommentMatch.index + lastInlineCommentMatch[0].length,
    );

    if (contentAfterInline.includes('\n',)) {
      // Not really a inline comment, we're done with inline comments.
      // Continue with finding block comments.
      // We don't need this gymnastics in startsWithComment because startsWithComment ensures both types are mutually exclusive via one string.startsWith test.
      return { ...context, precedingContent: value, };
    }

    const commentPart: JsoncComment = {
      type: 'inline',
      commentValue: contentAfterInline,
    };

    const mergedComments = mergeComments({ value: context?.comment,
      value2: commentPart, },);

    // Get content before the inline comment
    const precedingContent = trimmed
      .slice(0, lastInlineCommentMatch.index,)
      .trimEnd() as StringJsonc;

    // Recursively parse the preceding content
    return endsWithComment({ value: precedingContent, context: {
      comment: mergedComments,
    }, },);
  }
  else {
    // No inline comment found, we're done with inline comments.
    // Continue with finding block comments.

    // Find the last occurrence of /* (block comment end)
    const lastBlockCommentEndIndex = trimmed.lastIndexOf('*/',);

    if (lastBlockCommentEndIndex !== -1) {
      // Find the matching /* that corresponds to this */
      const blockStartPosition = function findBlockStartPosition(
        { value, }: { value: string; },
      ) {
        const trimmed = value.trim();

        // Get content before the */ to find the matching /*
        const contentBeforeBlockEnd = trimmed.slice(0, lastBlockCommentEndIndex,);
        const lastBlockStartIndex = contentBeforeBlockEnd.lastIndexOf('/*',);

        if (lastBlockStartIndex === -1) {
          // No matching /* found - this is an incomplete block comment
          throw new Error(`incomplete block comment is not jsonc, {
          comment: {
            type: 'block',
            commentValue: ${trimmed.slice(lastBlockCommentEndIndex,)},
          },
        }`,);
        }

        // Validate that this is a proper block comment
        const blockContent = trimmed.slice(lastBlockStartIndex + '/*'.length,
          lastBlockCommentEndIndex,);

        // Check if there are any other comments or strings that might interfere
        // For now, we'll assume valid JSONC as per the project philosophy

        return lastBlockStartIndex;
      }({ value: trimmed, },);

      // Extract the comment and the content before the block comment
      const commentPart: JsoncComment = {
        type: 'block',
        commentValue: trimmed.slice(blockStartPosition + '/*'.length,
          lastBlockCommentEndIndex,),
      };
      const mergedComments = mergeComments({ value: context?.comment,
        value2: commentPart, },);

      // Get content before the block comment
      const precedingContent = trimmed
        .slice(0, blockStartPosition,)
        .trimEnd() as StringJsonc;

      if (!mergedComments) {
        // no new comments to merge, we're done.
        return { precedingContent, };
      }

      // Recursively parse the preceding content
      return endsWithComment({ value: precedingContent, context: {
        comment: mergedComments,
      }, },);
    }
  }

  return { ...context, precedingContent: value, };
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
