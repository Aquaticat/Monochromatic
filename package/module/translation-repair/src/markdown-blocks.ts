//region Markdown blocks
// TOP-LEVEL BLOCKS OF A PASSAGE, split the one way several guards need to agree
// on.
//
// SHARED RATHER THAN COPIED because two guards read the same structure and a
// divergence between them is invisible: one would protect a passage the other
// then reported as deleted. The split is deliberately shallow, blank-line
// separated rather than parsed, since every caller asks a question about how
// many blocks there are and what they start with, not about their contents.
//
// CARRIAGE RETURNS ARE FOLDED FIRST, and that is a measured requirement rather
// than defensiveness. Of the 184 markdown files in the pinned corpus, one uses
// CRLF throughout: `people/gqt/page.md`. A splitter looking for the two-byte
// sequence `\n\n` never finds a boundary in that file, so the whole document
// reads as ONE block and every count taken from it is zero. That is worse than
// an error, because a guard counting zero quotes reports nothing wrong.

/**
 * Separator between top-level blocks, which is a blank line.
 */
const BLOCK_SEPARATOR = '\n\n';

/**
 * Marker opening a blockquote.
 */
const QUOTE_MARKER = '>';

/**
 * Splits a passage into its top-level blocks, keeping no empty ones.
 *
 * @param text - passage to split
 *
 * @returns Its blocks, in order, each trimmed
 *
 * @example
 * ```ts
 * const blocks = topLevelBlocks({ text: 'One.\n\nTwo.', },);
 * ```
 */
export function topLevelBlocks({ text, }: { readonly text: string; },): readonly string[] {
  return text
    .split('\r\n',)
    .join('\n',)
    .split(BLOCK_SEPARATOR,)
    .map(function trimmed(block,): string {
      return block.trim();
    },)
    .filter(function present(block,): boolean {
      return block !== '';
    },);
}

/**
 * How many top-level blocks of a passage are blockquotes.
 *
 * COUNTED AS BLOCKS RATHER THAN LINES, because a lane may legitimately reflow a
 * quotation and change its line count while keeping every word. What no lane may
 * do is leave the document with fewer quoted passages than the archive had.
 *
 * @param text - passage to count
 *
 * @returns Number of blockquote blocks
 *
 * @example
 * ```ts
 * const quotes = quoteBlockCount({ text: '> She said so.', },);
 * ```
 */
export function quoteBlockCount({ text, }: { readonly text: string; },): number {
  /**
   * Blocks that open with a quote marker.
   */
  const quotes = topLevelBlocks({ text, },)
    .filter(function isQuote(block,): boolean {
      return block.startsWith(QUOTE_MARKER,);
    },);
  return quotes.length;
}

//endregion Markdown blocks
