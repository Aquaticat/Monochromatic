/**
 * Parameters for {@link lineAt}.
 */
export type LineAtParams = {
  /**
   * Full file source text.
   */
  readonly sourceText: string;
  /**
   * Byte offset into source text.
   */
  readonly offset: number;
};

/**
 * Resolves the 1-indexed line number for a byte offset.
 *
 * Counts newline characters from the start of the source text up to
 * the given offset.
 *
 * @returns 1-indexed line number
 *
 * @example
 * ```ts
 * lineAt({ sourceText: 'abc\ndef', offset: 4 }) // → 2
 * ```
 */
export function lineAt({
  sourceText,
  offset,
}: LineAtParams,): number {
  /**
   * Accumulator initialised to 1 because callers expect 1-indexed line numbers.
   */
  let line = 1;
  for (let i = 0; i < offset; i++) {
    if (sourceText[i]
      === '\n')
      line++;
  }
  return line;
}
