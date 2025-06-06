/**
 * @module
 *
 * This module provides functionality to strip comments and trailing commas from a JSONC (JSON with Comments) string, producing a valid JSON string.
 */

//region Main
/**
 * Strips comments and trailing commas from a JSONC string.
 * This implementation uses a simple state machine to avoid removing comment-like sequences inside strings.
 *
 * @param jsonc - The JSONC string to clean.
 * @returns A valid JSON string.
 *
 * @example
 *
 * ```ts
 * import { stripJsonc } from './jsonc.strip.ts';
 *
 * const jsonc = `{
 *   // a comment
 *   "foo": "bar", // trailing comma
 * }`;
 *
 * const json = stripJsonc(jsonc);
 *
 * console.log(json);
 * // Output:
 * // {
 * //
 * //   "foo": "bar"
 * // }
 * ```
 */
export function stripJsonc(jsonc: string): string {
  if (jsonc.length === 0) {
    return '';
  }

  const stripped = [];
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < jsonc.length; i++) {
    const char = jsonc[i];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        stripped.push(char);
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && jsonc[i + 1] === '/') {
        inBlockComment = false;
        i++; // skip the '/'
      }
      continue;
    }

    if (inString) {
      // Note: This does not handle escaped backslashes before a quote.
      if (char === '"' && jsonc[i - 1] !== '\\') {
        inString = false;
      }
      stripped.push(char);
      continue;
    }

    if (char === '/' && jsonc[i + 1] === '/') {
      inLineComment = true;
      continue;
    }

    if (char === '/' && jsonc[i + 1] === '*') {
      inBlockComment = true;
      i++; // skip the '*'
      continue;
    }

    if (char === '"') {
      inString = true;
    }

    stripped.push(char);
  }

  const noComments = stripped.join('');

  // Remove trailing commas from objects and arrays.
  // This regex finds one or more commas followed by optional whitespace and then a `}` or `]`.
  return noComments.replace(/(,)+(\s*[}\]])/g, '$2');
}
//endregion Main
