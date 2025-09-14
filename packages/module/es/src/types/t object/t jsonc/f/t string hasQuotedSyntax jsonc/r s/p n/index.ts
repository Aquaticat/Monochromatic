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
      const outStartsLineComment = startsWithLineComment({ value, },);
      return Object.assign(outStartsLineComment, {
        json: JSON.parse(outStartsLineComment.remainingContent,) as UnknownRecord,
      },);
    }
    catch (errorNotBecauseOfStartsLineComment) {
      console.log(errorNotBecauseOfStartsLineComment,);
    }
  }
}

export function startsWithLineComment(
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
    if (!mergedComments) {
      // no new comments to merge, we're done.
      return { remainingContent, };
    }

    // Recursively parse the remaining content
    return startsWithLineComment({ value: remainingContent, context: {
      comment: mergedComments,
    }, },);
  }

  return { remainingContent: value, };
}

export function startsWithBlockComment(
  { value, context, }: { value: StringJsonc; context?: JsoncValueBase; },
): { remainingContent: StringJsonc; } & JsoncValueBase {
  // Eliminate leading and trailing whitespace, including space and newline characters.
  const trimmed = value.trim();

  if (trimmed.startsWith('/*',)) {
    const blockEndPosition = function findBlockEndPosition({ value, },) {
      const trimmed = value.trim();

      // Find the end of the block comment (star slash)
      const starSlashs = f(Array.from(
        trimmed.matchAll(/\*\//g,),
      ),);

      const lastStarSlash = f(starSlashs.at(-1,),);

      if (!lastStarSlash) {
        // No block comment end found, the entire string is an incomplete block comment
        throw new Error(`incomplete block comment is not jsonc, {
          comment: {
            type: 'block',
            commentValue: ${trimmed.slice('/*'.length,)},
            },
          }`,);
      }

      const newlineSlashSlashsBeforeLastStarSlash = f(
        (function getNewlineSlashSlashsBeforeLastStarSlash({ value, lastStarSlash, },) {
          const newlineSlashSlashs = value.matchAll(
            // First char in whole string is guaranteed to be slash star
            // Therefore, line comments must be directly prepended by new line.
            /\n\s*\/\//g,
          );

          const newlineSlashSlashsBeforeLastStarSlash: RegExpExecArray[] = [];

          for (const newlineSlashSlash of newlineSlashSlashs) {
            if (newlineSlashSlash.index < lastStarSlash.index)
              newlineSlashSlashsBeforeLastStarSlash.push(newlineSlashSlash,);
            else
              break;
          }

          return newlineSlashSlashsBeforeLastStarSlash;
        })({ value: trimmed, lastStarSlash, },),
      );

      for (const starSlash of starSlashs) {
        // Ensure our star slash instance isn't commented out by a line comment or inside a JSON string.

        // discard result if star slash is commented out by a line comment.
        // not discard result if star slash isn't commented out by a line comment.
        // How do we know? If there's no newline between slashSlash and starSlash.

        // Find shortcircuits on the first match.
        const commentedOut = newlineSlashSlashsBeforeLastStarSlash.find(
          function inBetweenHasNewline(starts,) {
            const substr = trimmed.slice(starts.index + starts[0].length, starSlash
              .index,);
            return substr.includes('\n',);
          },
        );

        if (commentedOut) {
          // Discard result, next.
          continue;
        }

        // No need to manually ensure starSlash isn't in quotes.
        // Why? Because if the first starSlash is in quotes when we've already found a slashStar at start, it's invalid JSONC.

        return starSlash.index;
      }

      // No block comment end found, the entire string is an incomplete block comment
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
    if (!mergedComments) {
      // no new comments to merge, we're done.
      return { remainingContent, };
    }

    // Recursively parse the remaining content
    return startsWithBlockComment({ value: remainingContent, context: {
      comment: mergedComments,
    }, },);
  }

  return { remainingContent: value, };
}

export function endsWithLineComment(
  { value, context, }: { value: StringJsonc; context?: JsoncValueBase; },
): { remainingContent: StringJsonc; } & JsoncValueBase {
  const trimmed = value.trimEnd();

  // Find the last occurrence of // that's not inside quotes
  let inQuotes = false;
  let quoteChar = '';
  let lastLineCommentPos = -1;

  for (let charIndex = 0; charIndex < trimmed.length; charIndex++) {
    const char = trimmed[charIndex];

    // Handle quote escaping
    if (char === '"' || char === "'") {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      }
      else if (char === quoteChar && trimmed[charIndex - 1] !== '\\') {
        inQuotes = false;
        quoteChar = '';
      }
    }

    // Look for line comment start when not in quotes
    if (!inQuotes && char === '/' && trimmed[charIndex + 1] === '/')
      lastLineCommentPos = charIndex;
  }

  if (lastLineCommentPos === -1)
    return { remainingContent: value, };

  // Extract comment and remaining content
  const commentPart: JsoncComment = {
    type: 'inline',
    commentValue: trimmed.slice(lastLineCommentPos + '//'.length,).trimEnd(),
  };
  const remainingContent = trimmed.slice(0, lastLineCommentPos,).trimEnd() as StringJsonc;

  const mergedComments = mergeComments({ value: context?.comment,
    value2: commentPart, },);

  return { remainingContent, comment: mergedComments, };
}

export function endsWithBlockComment(
  { value, context, }: { value: StringJsonc; context?: JsoncValueBase; },
): { remainingContent: StringJsonc; } & JsoncValueBase {
  const trimmed = value.trimEnd();

  // Find the last occurrence of /* that's not inside quotes
  let inQuotes = false;
  let quoteChar = '';
  let lastBlockCommentStart = -1;
  let blockCommentEnd = -1;

  for (let charIndex = 0; charIndex < trimmed.length - 1; charIndex++) {
    const char = trimmed[charIndex];

    // Handle quote escaping
    if (char === '"' || char === "'") {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      }
      else if (char === quoteChar && trimmed[charIndex - 1] !== '\\') {
        inQuotes = false;
        quoteChar = '';
      }
    }

    // Look for block comment start when not in quotes
    if (!inQuotes && char === '/' && trimmed[charIndex + 1] === '*') {
      lastBlockCommentStart = charIndex;
      // Find the corresponding */
      const searchStart = charIndex + 2;
      for (let searchIndex = searchStart; searchIndex < trimmed.length - 1;
        searchIndex++)
      {
        if (trimmed[searchIndex] === '*' && trimmed[searchIndex + 1] === '/') {
          blockCommentEnd = searchIndex + 2;
          break;
        }
      }
    }
  }

  if (lastBlockCommentStart === -1 || blockCommentEnd === -1)
    return { remainingContent: value, };

  // Extract comment and remaining content
  const commentPart: JsoncComment = {
    type: 'block',
    commentValue: trimmed
      .slice(lastBlockCommentStart + '/*'.length, blockCommentEnd - '*/'.length,)
      .trimEnd(),
  };
  const remainingContent = trimmed
    .slice(0, lastBlockCommentStart,)
    .trimEnd() as StringJsonc;

  const mergedComments = mergeComments({ value: context?.comment,
    value2: commentPart, },);

  return { remainingContent, comment: mergedComments, };
}

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
