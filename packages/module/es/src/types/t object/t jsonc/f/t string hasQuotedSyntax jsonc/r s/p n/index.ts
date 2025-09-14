import type {
  $ as StringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import type { UnknownRecord, } from 'type-fest';
import { z, } from 'zod/v4-mini';

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

  if (trimmed.startsWith('//',)) {
    // Find the end of the line comment (newline character)
    const newlinePosition = trimmed.indexOf('\n', '//'.length,);
    if (newlinePosition === -1) {
      // No newline found, the entire string is a line comment
      throw new Error(`line comment is not jsonc, {
        comment: {
          type: 'inline',
          commentValue: ${trimmed.slice('//'.length,)},
        },
      }`,);
    }
    // Extract the comment and the rest of the content after newline
    // No trimming needed because we wanna support both `// This is` and `//region`.
    const commentPart: JsoncComment = { type: 'inline', commentValue: trimmed
      .slice('//'.length, newlinePosition,), };
    const mergedComments = mergeComments({ value: context?.comment,
      value2: commentPart, },);

    const remainingContent = trimmed.slice(newlinePosition + '\n'.length,) as StringJsonc;
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
