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
import type * as Jsonc from '../../../../t/index.ts';
import {
  customParserForArray,
  customParserForRecord,
  startsWithComment,
} from './customParsers.ts';
import {
  tryArrayFastPath,
  tryObjectFastPath,
  parseWithFallback,
} from './fastPath.ts';
//endregion Imports and aliases

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
      return parseWithFallback({
        value: value as unknown as FragmentStringJsonc,
        context: outStartsComment,
        containerType: 'array',
        tryFastPathFn: tryArrayFastPath,
        customParserFn: customParserForArray,
      },);
    }
    else if (value.startsWith('{',)) {
      return parseWithFallback({
        value: value as unknown as FragmentStringJsonc,
        context: outStartsComment,
        containerType: 'object',
        tryFastPathFn: tryObjectFastPath,
        customParserFn: customParserForRecord,
      },);
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

//region Re-exports -- Surface helpers for testing and external use
export * from './customParsers.ts';
export * from './fastPath.ts';
//endregion Re-exports
