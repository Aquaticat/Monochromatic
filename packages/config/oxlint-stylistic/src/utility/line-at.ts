/**
 * Resolves the 1-indexed line number for a byte offset.
 *
 * Counts newline characters from the start of the source text up to
 * the given offset.
 *
 * @param sourceText - full file source text
 *
 * @param offset - byte offset into source text
 *
 * @returns 1-indexed line number
 */
export function lineAt(
  sourceText: string,
  offset: number,
): number {
  let line = 1;
  for (let i = 0; i < offset; i++) {
    if (sourceText[i] === '\n')
      line++;
  }
  return line;
}
