/**
 * Returns true when `c` is ASCII whitespace per regex `\s` semantics
 * (space, tab, newline, carriage return, form feed, vertical tab).
 *
 * @param c - candidate character
 *
 * @returns whether the character is whitespace
 */
function isWhitespaceChar(c: string,): boolean {
  return (c === ' ')
    || (c === '\t')
    || (c === '\n')
    || (c === '\r')
    || (c === '\f')
    || (c === '\v');
}

/**
 * Returns the leading run of ASCII whitespace from `s`.
 *
 * Linear scan: walks character by character until the first non-whitespace
 * position, then slices once. Replaces the prior `/^(\s*)/.exec` capture
 * with a strictly O(n) implementation suitable for hot lint paths.
 *
 * @param s - input string
 *
 * @returns prefix of `s` consisting solely of whitespace characters
 *
 * @example
 * ```ts
 * leadingWhitespace('  foo'); // '  '
 * leadingWhitespace('bar'); // ''
 * ```
 */
export function leadingWhitespace(s: string,): string {
  /**
   * Recursive walker advancing while the cursor sits on whitespace.
   *
   * @param idx - cursor into `s`
   *
   * @returns first non-whitespace position (or `s.length`)
   */
  function scan(idx: number,): number {
    if (idx >= s.length)
      return s.length;
    if (!isWhitespaceChar(s.charAt(idx,),))
      return idx;
    return scan(idx + 1,);
  }
  return s.slice(
    0,
    scan(0,),
  );
}

/**
 * Parameters for {@link baseIndentAt}.
 */
export type BaseIndentAtParams = {
  /** Full file source text. */
  readonly sourceText: string;
  /** Byte offset on the line whose indentation is wanted. */
  readonly offset: number;
};

/**
 * Returns the whitespace prefix of the line containing `offset`.
 *
 * Used to derive the indentation level when emitting multi-line autofix
 * replacements so the inserted content lines up with the surrounding code.
 *
 * @returns leading whitespace of the line, or `''` if the line has none
 *
 * @example
 * ```ts
 * baseIndentAt({ sourceText: '  foo(a, b);', offset: 6 }) // -> '  '
 * ```
 */
export function baseIndentAt({
  sourceText,
  offset,
}: BaseIndentAtParams,): string {
  /** Byte offset of the first character on the line containing `offset`. */
  const lineStart = sourceText.lastIndexOf(
    '\n',
    offset - 1,
  ) + 1;
  /** Substring from line start to `offset`; the helper returns just its leading whitespace. */
  const linePrefix = sourceText.slice(
    lineStart,
    offset,
  );
  return leadingWhitespace(linePrefix,);
}
