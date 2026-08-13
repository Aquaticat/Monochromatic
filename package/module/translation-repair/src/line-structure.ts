//region Line structure
// Whether a slice is line-structured, meaning each block is a unit rather than
// a paragraph: verse, chat transcripts, lists of short statements.
//
// COMPUTED RATHER THAN JUDGED. The editor prompt previously asked the model to
// recognize this itself, and an attempt to write the same rule as a heuristic
// failed its positive control outright, ranking the one entry known to be verse
// 42nd of 54. A number the pipeline computes and hands over as a fact removes
// that guess from both sides.
//
// MEASURED over every corpus chunk: 49 of 275 trip, across 31 entries, and
// `Toka_ls`, whose editor fabricated three lines, trips at median 22 while its
// two prose chunks sit at 49 and 86. A threshold of 20 would have missed it,
// which is why the control was run before the threshold was chosen.
//
// The counts were 55 of 286 across 34 entries when first taken. Nothing about
// this predicate changed; the ALIGNER did, in `#71`, and chunk boundaries are
// its output. Re-measured through the shipped predicate on the forced aligner.

/**
 * Blocks a slice needs before its shape means anything.
 *
 * Under this, a slice is too small to tell a stanza from a short paragraph.
 */
const MIN_BLOCKS = 5;

/**
 * Longest median block a line-structured slice may have.
 *
 * 30 rather than 20: `Toka_ls`'s verse has a median of 22, and its prose
 * chunks sit at 49 and 87, so the gap is wide and the threshold sits inside it.
 */
const MAX_MEDIAN_LENGTH = 30;

/**
 * Reports whether a slice is line-structured.
 *
 * @param text - full text of one slice
 *
 * @returns True when each block reads as a unit rather than a paragraph
 *
 * @example
 * ```ts
 * const lineStructured = isLineStructured({ text: targetText, },);
 * ```
 */
export function isLineStructured(
  {
    text,
  }: {
    readonly text: string;
  },
): boolean {
  /**
   * Blank-line-separated blocks carrying content.
   */
  const blocks = text
    .split('\n\n',)
    .map(function trim(block,): string {
    return block.trim();
  },)
    .filter(function isContent(block,): boolean {
    return block !== '';
  },);

  if (blocks.length < MIN_BLOCKS)
    return false;

  /**
   * Block lengths in ascending order.
   */
  const lengths = blocks
    .map(function toLength(block,): number {
    return block.length;
  },)
    .toSorted(function ascending(
      left,
      right,
    ): number {
    return left - right;
  },);

  return (lengths[Math.floor(lengths.length / 2,)] ?? 0) <= MAX_MEDIAN_LENGTH;
}

//endregion Line structure
