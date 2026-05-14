/**
 * Parameters for {@link baseIndentAt}.
 */
export type BaseIndentAtParams = {
  /** Full file source text. */
  sourceText: string;
  /** Byte offset on the line whose indentation is wanted. */
  offset: number;
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
 * baseIndentAt({ sourceText: '  foo(a, b);', offset: 6 }) // → '  '
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
  /** Substring from line start to `offset`; the regex pulls only its leading whitespace. */
  const linePrefix = sourceText.slice(
    lineStart,
    offset,
  );
  return /^(\s*)/.exec(linePrefix,)?.[1] ?? '';
}
