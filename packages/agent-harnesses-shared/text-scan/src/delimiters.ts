/**
 * Regex-free delimiter and line stripping helpers.
 *
 * @module
 */

//region Delimiter stripping

/**
 * Removes substrings bounded by matching open and close delimiters from `text`.
 *
 * Iterates left to right. For each open delimiter found, removes through the
 * next close delimiter. Unmatched openers are left in place.
 * When `disallowedInside` is provided, any disallowed character inside the
 * delimiter span cancels stripping for that occurrence.
 *
 * @param text - input text
 *
 * @param openDelim - opening delimiter literal
 *
 * @param closeDelim - closing delimiter literal
 *
 * @param disallowedInside - optional character that aborts stripping when present inside candidate span
 *
 * @returns text with each matched delimiter span removed
 *
 * @example
 * ```ts
 * stripBetweenDelims({ text: 'a `code` b', openDelim: '`', closeDelim: '`' });
 * // => 'a  b'
 * ```
 */
function stripBetweenDelims(
  {
    text,
    openDelim,
    closeDelim,
    disallowedInside,
  }: {
    readonly text: string;
    readonly openDelim: string;
    readonly closeDelim: string;
    readonly disallowedInside?: string;
  },
): string {
  /**
   * Output segments, joined once so the accumulator is never recopied per span.
   */
  const parts: string[] = [];
  /**
   * Cursor that advances monotonically past each emitted or stripped span.
   */
  let cursorIndex = 0;

  for (
    let openIndex = text.indexOf(
      openDelim,
      0,
    );
    openIndex !== (-1);
    openIndex = text.indexOf(
      openDelim,
      cursorIndex,
    )
  ) {
    /**
     * Search start for matching close delimiter after the entire opener.
     */
    const closeSearchStart = openIndex + openDelim.length;
    /**
     * Index of closing delimiter, or `-1` when opener is unmatched.
     */
    const closeIndex = text.indexOf(
      closeDelim,
      closeSearchStart,
    );
    if (closeIndex === (-1))
      break;

    /**
     * Span between delimiters, exclusive of both delimiters.
     */
    const inside = text.slice(
      closeSearchStart,
      closeIndex,
    );
    if ((disallowedInside !== undefined) && inside.includes(disallowedInside,)) {
      parts.push(text.slice(
        cursorIndex,
        closeSearchStart,
      ),);
      cursorIndex = closeSearchStart;
    }
    else {
      parts.push(text.slice(
        cursorIndex,
        openIndex,
      ),);
      cursorIndex = closeIndex + closeDelim.length;
    }
  }

  parts.push(text.slice(cursorIndex,),);
  /**
   * Joined output from retained parts.
   */
  const result = parts.join('',);
  return result;
}

/**
 * Removes lines whose first non-whitespace character starts with `prefix`.
 *
 * Lines that do not match remain unchanged, including their trailing newlines.
 * This matches stripping Markdown blockquote lines without regular expressions.
 *
 * @param text - input text containing one or more newline-separated lines
 *
 * @param prefix - prefix literal that flags a line for removal
 *
 * @returns text with matching lines removed
 *
 * @example
 * ```ts
 * stripLinesStartingWith({ text: 'a\n> quote\nb', prefix: '>' });
 * // => 'a\nb'
 * ```
 */
function stripLinesStartingWith(
  {
    text,
    prefix,
  }: {
    readonly text: string;
    readonly prefix: string;
  },
): string {
  return text
    .split('\n',)
    .filter(function keepLine(line,): boolean {
      return !line.trimStart()
        .startsWith(prefix,);
    },)
    .join('\n',);
}

//endregion Delimiter stripping

export {
  stripBetweenDelims,
  stripLinesStartingWith,
};
