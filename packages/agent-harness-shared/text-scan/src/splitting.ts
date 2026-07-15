/**
 * Regex-free token splitting helpers for agent harness text scans.
 *
 * @module
 */

import { isWhitespace, } from './characters.ts';

//region Splitting

/**
 * Splits a string into non-empty whitespace-separated tokens.
 *
 * Matches `s.split(/\\s+/).filter(Boolean)` behavior without invoking the
 * regular expression engine.
 *
 * @param s - input string to tokenize
 *
 * @returns ordered array of non-empty tokens
 *
 * @example
 * ```ts
 * splitWhitespace('  a\tb\nc  '); // ['a', 'b', 'c']
 * splitWhitespace(''); // []
 * ```
 */
function splitWhitespace(s: string,): string[] {
  /**
   * Emitted tokens; each is sliced out whole so no per-character copy accumulates.
   */
  const tokens: string[] = [];

  for (let cursorIndex = 0; cursorIndex < s.length;) {
    if (isWhitespace(s.charAt(cursorIndex,),)) {
      cursorIndex += 1;
      continue;
    }

    /**
     * Inclusive start of current non-whitespace token.
     */
    const start = cursorIndex;
    /**
     * Exclusive end of current token, advanced to next whitespace or input end.
     */
    let end = cursorIndex + 1;
    while ((end < s.length) && (!isWhitespace(s.charAt(end,),))) {
      end += 1;
    }

    tokens.push(s.slice(
      start,
      end,
    ),);
    cursorIndex = end;
  }

  return tokens;
}

//endregion Splitting

export { splitWhitespace, };
