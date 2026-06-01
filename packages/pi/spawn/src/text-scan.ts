/**
 * Regex-free text scanning helpers for spawn-pi.
 *
 * @module
 */

//region Character predicates

/**
 * Detects JavaScript whitespace characters in one-character strings.
 *
 * @param c - character to inspect.
 *
 * @returns whether character is whitespace.
 *
 * @example
 * ```typescript
 * isWhitespace(' '); // true
 * ```
 */
function isWhitespace(c: string,): boolean {
  return (c === ' ')
    || (c === '\t')
    || (c === '\n')
    || (c === '\r')
    || (c === '\f')
    || (c === '\v');
}

//endregion Character predicates

//region Splitting

/**
 * Splits text into non-empty whitespace-delimited tokens without regex.
 *
 * @param s - text to split.
 *
 * @returns ordered tokens with empty spans removed.
 *
 * @example
 * ```typescript
 * splitWhitespace(' --model x  --thinking high ');
 * // ['--model', 'x', '--thinking', 'high']
 * ```
 */
function splitWhitespace(s: string,): string[] {
  /**
   * Tokens sliced from input text.
   */
  const tokens: string[] = [];

  for (let cursorIndex = 0; cursorIndex < s.length;) {
    if (isWhitespace(s.charAt(cursorIndex,),)) {
      cursorIndex += 1;
      continue;
    }

    /**
     * Inclusive token start offset.
     */
    const start = cursorIndex;
    /**
     * Exclusive token end offset.
     */
    let end = cursorIndex + 1;
    while ((end < s.length) && (!isWhitespace(s.charAt(end,),)))
      end += 1;

    tokens.push(s.slice(
      start,
      end,
    ),);
    cursorIndex = end;
  }

  return tokens;
}

//endregion Splitting

export {
  isWhitespace,
  splitWhitespace,
};
