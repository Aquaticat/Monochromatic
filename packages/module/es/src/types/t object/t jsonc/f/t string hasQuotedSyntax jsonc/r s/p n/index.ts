/*
  Hybrid JSONC parsing entrypoint.
  Fast-path tries to treat clean (comment-free) top-level arrays/objects as plain JSON for speed, while
  the fallback delegates to custom parsers that preserve comments and tolerate trailing commas.
  Region markers outline the phases: imports, pre-scan, dispatch/heuristics, and re-exports.
*/

//region Imports and aliases -- External types/helpers and local aliases used by the parser
import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import type { UnknownRecord, } from 'type-fest';
import type * as Jsonc from '../../../../t/index.ts';
import {
  customParserForArray,
  customParserForRecord,
} from './customParsers.ts';
import { startsWithComment, } from './startsWithComment.ts';
//endregion Imports and aliases

//region Minion functions -- Helper functions for fast-path optimization and validation
/**
 * Sentinel indicating fast-path optimization cannot be applied.
 *
 * @remarks
 * Narrow by category first using `typeof result === 'symbol'` before identity comparison to avoid incorrect
 * narrowing with symbol unions.
 *
 * @example
 * ```ts
 * const result = tryArrayFastPath({ value: '[1, 2,]', context });
 * if (typeof result === 'symbol') {
 *   if (result === NO_FAST_PATH) {
 *     // Fast-path failed, use custom parser
 *   } else {
 *     throw new Error('unexpected symbol');
 *   }
 * } else {
 *   // Fast-path succeeded
 * }
 * ```
 */
export const NO_FAST_PATH: symbol = Symbol('jsonc:no-fast-path',);

/**
 * Attempt fast-path optimization for arrays.
 *
 * Tries to parse arrays using native JSON.parse for performance. Handles both clean JSON
 * and arrays with a single trailing comma at the boundary by removing it first.
 * Returns sentinel if optimization cannot be applied (e.g., contains comments).
 *
 * @param value - Array string starting with `[`
 * @param context - Leading comment context from pre-scan
 * @returns Parsed JSONC value on success, or NO_FAST_PATH sentinel when fast-path cannot be used
 *
 * @example
 * Successful fast-path with clean JSON:
 * ```ts
 * const result = tryArrayFastPath({
 *   value: '[1, 2, 3]',
 *   context: { remainingContent: '[1, 2, 3]' }
 * });
 * if (typeof result !== 'symbol') {
 *   console.log(result.json); // [1, 2, 3]
 * }
 * ```
 *
 * @example
 * Successful fast-path with trailing comma:
 * ```ts
 * const result = tryArrayFastPath({
 *   value: '[1, 2, 3, ]',
 *   context: { remainingContent: '[1, 2, 3, ]' }
 * });
 * if (typeof result !== 'symbol') {
 *   console.log(result.json); // [1, 2, 3]
 * }
 * ```
 *
 * @example
 * Fast-path not applicable:
 * ```ts
 * const result = tryArrayFastPath({
 *   value: '[1, /* comment *\/ 2]',
 *   context: { remainingContent: '[1, /* comment *\/ 2]' }
 * });
 * // Returns NO_FAST_PATH - contains comments
 * ```
 */
export function tryArrayFastPath(
  { value, context, }: { value: string; context: ReturnType<typeof startsWithComment>; },
): Jsonc.Value | typeof NO_FAST_PATH {
  const trimmed = value.trimEnd();
  if (!trimmed.endsWith(']',))
    return NO_FAST_PATH;

  // Work backwards from the closing bracket to find trailing comma pattern
  let searchIndex = trimmed.length - ']'.length;
  // Skip whitespace before the bracket
  while (searchIndex > 0 && /\s/.test(trimmed[searchIndex - 1],))
    searchIndex--;

  // Check if there's a comma before the whitespace
  if (searchIndex > 0 && trimmed[searchIndex - 1] === ',') {
    // Found trailing comma pattern like ", ]" or ",]"
    // Check if there's any content between opening bracket and the comma
    const contentBeforeComma = trimmed.slice(1, searchIndex - 1,).trim();
    if (contentBeforeComma.length === 0) {
      // Empty array with trailing comma like "[ , ]" - reject
      return NO_FAST_PATH;
    }

    const repairedJson = trimmed.slice(0, searchIndex - 1,) + ']';
    try {
      return { ...context, json: JSON.parse(repairedJson,) as UnknownRecord, };
    }
    catch {
      // Parse failed - likely has comments, strings with special chars, etc.
      return NO_FAST_PATH;
    }
  }

  // No trailing comma found - try parsing as-is for clean JSON
  try {
    return { ...context, json: JSON.parse(trimmed,) as UnknownRecord, };
  }
  catch {
    // Parse failed - contains JSONC features like comments
    return NO_FAST_PATH;
  }
}

/**
 * Attempt fast-path optimization for objects.
 *
 * Tries to parse objects using native JSON.parse for performance. Handles both clean JSON
 * and objects with a single trailing comma at the boundary by removing it first.
 * Returns sentinel if optimization cannot be applied (e.g., contains comments).
 *
 * @param value - Object string starting with `{`
 * @param context - Leading comment context from pre-scan
 * @returns Parsed JSONC value on success, or NO_FAST_PATH sentinel when fast-path cannot be used
 *
 * @example
 * Successful fast-path with clean JSON:
 * ```ts
 * const result = tryObjectFastPath({
 *   value: '{"a": 1, "b": 2}',
 *   context: { remainingContent: '{"a": 1, "b": 2}' }
 * });
 * if (typeof result !== 'symbol') {
 *   console.log(result.json); // {a: 1, b: 2}
 * }
 * ```
 *
 * @example
 * Successful fast-path with trailing comma:
 * ```ts
 * const result = tryObjectFastPath({
 *   value: '{"a": 1, "b": 2, }',
 *   context: { remainingContent: '{"a": 1, "b": 2, }' }
 * });
 * if (typeof result !== 'symbol') {
 *   console.log(result.json); // {a: 1, b: 2}
 * }
 * ```
 *
 * @example
 * Fast-path not applicable:
 * ```ts
 * const result = tryObjectFastPath({
 *   value: '{"a": 1, /* comment *\/ "b": 2}',
 *   context: { remainingContent: '{"a": 1, /* comment *\/ "b": 2}' }
 * });
 * // Returns NO_FAST_PATH - contains comments
 * ```
 */
export function tryObjectFastPath(
  { value, context, }: { value: string; context: ReturnType<typeof startsWithComment>; },
): Jsonc.Value | typeof NO_FAST_PATH {
  const trimmed = value.trimEnd();
  if (!trimmed.endsWith('}',))
    return NO_FAST_PATH;

  // Work backwards from the closing brace to find trailing comma pattern
  let searchIndex = trimmed.length - '}'.length;
  // Skip whitespace before the brace
  while (searchIndex > 0 && /\s/.test(trimmed[searchIndex - 1],))
    searchIndex--;

  // Check if there's a comma before the whitespace
  if (searchIndex > 0 && trimmed[searchIndex - 1] === ',') {
    // Found trailing comma pattern like ", }" or ",}"
    // Check if there's any content between opening brace and the comma
    const contentBeforeComma = trimmed.slice(1, searchIndex - 1,).trim();
    if (contentBeforeComma.length === 0) {
      // Empty object with trailing comma like "{ , }" - reject
      return NO_FAST_PATH;
    }

    const repairedJson = trimmed.slice(0, searchIndex - 1,) + '}';
    try {
      return { ...context, json: JSON.parse(repairedJson,) as UnknownRecord, };
    }
    catch {
      // Parse failed - likely has comments, strings with special chars, etc.
      return NO_FAST_PATH;
    }
  }

  // No trailing comma found - try parsing as-is for clean JSON
  try {
    return { ...context, json: JSON.parse(trimmed,) as UnknownRecord, };
  }
  catch {
    // Parse failed - contains JSONC features like comments
    return NO_FAST_PATH;
  }
}

/**
 * Validate no unexpected trailing content remains after parsing.
 *
 * Strips comments and whitespace from remaining content and throws if non-empty content is found.
 * Prevents silent acceptance of malformed JSONC with extra data after the main structure.
 *
 * @param remainingContent - Content after parsing the main structure
 * @param containerType - Type of container that was parsed ('array' or 'object')
 * @throws Error when non-whitespace/non-comment content remains
 *
 * @example
 * Valid cases (no error):
 * ```ts
 * validateNoTrailingContent({ remainingContent: '', containerType: 'array' });
 * validateNoTrailingContent({ remainingContent: '   ', containerType: 'object' });
 * validateNoTrailingContent({ remainingContent: '// comment', containerType: 'array' });
 * ```
 *
 * @example
 * Invalid case (throws):
 * ```ts
 * validateNoTrailingContent({
 *   remainingContent: 'extra data',
 *   containerType: 'array'
 * });
 * // Throws: "unexpected trailing content after array: extra data"
 * ```
 */
export function validateNoTrailingContent(
  { remainingContent, containerType, }: { remainingContent: string;
    containerType: 'array' | 'object'; },
): void {
  const tail = startsWithComment({ value: remainingContent as FragmentStringJsonc, },)
    .remainingContent
    .trim();
  if (tail.length > 0) {
    throw new Error(
      `unexpected trailing content after ${containerType}: ${tail.slice(0, 48,)}`,
    );
  }
}
//endregion Minion functions

/**
 * Parse JSONC string into structured representation with comment preservation and hierarchical optimization.
 *
 * This advanced parser handles JSONC (JSON with Comments) format, preserving comments alongside data
 * while providing performance optimizations through hierarchical fast-path parsing. Uses native JSON.parse
 * for clean sections and custom parsing only where JSONC-specific features are present.
 *
 * commentEnd (starSlash) markers are escaped to *\/ in comments because they would be prematurely ending the comment block otherwise.
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
export function $({ value, }: { value: StringJsonc; },): Jsonc.Value {
  //region Pre-scan for comments -- Strip/record leading comments to decide how to dispatch
  const outStartsComment = startsWithComment({ value, },);
  //endregion Pre-scan for comments

  //region Top-level dispatch and heuristics -- Select array/object path; attempt simple trailing-comma fix, else fallback
  const result = (function getResult({ outStartsComment, },): Jsonc.Value {
    const { remainingContent: value, } = outStartsComment;
    if (value.startsWith('[',)) {
      //region Array branch fast-path heuristic -- Try fast-path optimization before custom parser
      const fastPathResult = tryArrayFastPath({ value, context: outStartsComment, },);
      if (typeof fastPathResult !== 'symbol')
        return fastPathResult;
      //endregion Array branch fast-path heuristic
      // Defer to custom parser for full JSONC array parsing with comments/trailing commas
      const out = customParserForArray({ value, context: outStartsComment, },);
      // Validate no unexpected trailing content at top-level
      validateNoTrailingContent({ remainingContent: out.remainingContent,
        containerType: 'array', },);
      const { remainingContent: _rc, ...parsed } = out;
      return parsed as Jsonc.Value;
    }
    else if (value.startsWith('{',)) {
      //region Object branch fast-path heuristic -- Try fast-path optimization before custom parser
      const fastPathResult = tryObjectFastPath({ value, context: outStartsComment, },);
      if (typeof fastPathResult !== 'symbol')
        return fastPathResult;
      //endregion Object branch fast-path heuristic
      // Defer to custom parser for full JSONC record parsing with comments/trailing commas
      const out = customParserForRecord({ value, context: outStartsComment, },);
      // Validate no unexpected trailing content at top-level
      validateNoTrailingContent({ remainingContent: out.remainingContent,
        containerType: 'object', },);
      const { remainingContent: _rc, ...parsed } = out;
      return parsed as Jsonc.Value;
    }
    //region Error handling -- Only arrays or objects are valid after trimming leading comments
    throw new Error(
      'invalid jsonc, after removing comments and trimming, nothing except [ or { shall be at the start',
    );
    //endregion Error handling
  })({ outStartsComment, },);

  //endregion Top-level dispatch and heuristics

  return result;
}

//region Re-exports -- Surface helpers for testing
export * from './mergeComments.ts';

export * from './startsWithComment.ts';

export * from './customParsers.ts';

export * from './lengthSelection.ts';

export * from './scanQuotedString.ts';
//endregion Re-exports
