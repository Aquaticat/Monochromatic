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
import * as Jsonc from '../../../../t/index.ts';
import { startsWithComment, } from './startsWithComment.ts';

const f = Object.freeze;
//endregion Imports and aliases

// TODO: Add whatever's already parsed in error messages.

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
export function $({ value, }: { value: StringJsonc; },): Jsonc.Value {
  //region Pre-scan for comments -- Strip/record leading comments to decide how to dispatch
  const outStartsComment = startsWithComment({ value, },);
  //endregion Pre-scan for comments

  //region Top-level dispatch and heuristics -- Select array/object path; attempt simple trailing-comma fix, else fallback
  const result = (function getResult({ outStartsComment, },): Jsonc.Value {
    const { remainingContent: value, } = outStartsComment;
    if (value.startsWith('[',)) {
      //region Array branch fast-path heuristic -- If the only invalidity is a single trailing comma at the very end, try to repair and JSON.parse
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
      //endregion Array branch fast-path heuristic
      // Something is at the end.
      // Probably comments.
      // Defer to custom parser.
      // TODO: Avoid returning undefined.
      return undefined;
    }
    else if (value.startsWith('{',)) {
      //region Object branch fast-path heuristic -- Same boundary-only trailing-comma attempt; otherwise defer
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
      //endregion Object branch fast-path heuristic
      // Something is at the end.
      // Probably comments.
      // Defer to custom parser.
      // TODO: Avoid returning undefined.
      return undefined;
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
//endregion Re-exports
