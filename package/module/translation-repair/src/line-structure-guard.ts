//region Line structure guard
// WHY THIS IS NOT IN `translate-validate.ts`, where it was first written and
// where the obvious tidying would put it back: that file compares BLOCKS and
// ATOMS, and adding a third comparison took it past its line budget. Splitting
// at this seam rather than raising the budget keeps each file answering one
// question, and this one already had a family: `line-structure.ts` decides
// whether a slice is governed, `line-structure-inherit.ts` decides which
// slices inherit that from their chunk, and this refuses a rendering that
// merged the lines the rule protects.
/**
 * Counts lines of one passage that carry content.
 *
 * BLANK LINES ARE NOT COUNTED. They separate blocks rather than carry text,
 * and a rendering that writes a different number of them has not merged
 * anything.
 *
 * @param text - passage to count
 *
 * @returns How many lines carry content
 *
 * @example
 * ```ts
 * const lines = contentLineCount({ text: candidateText, },);
 * ```
 */
function contentLineCount({ text, }: { readonly text: string; },): number {
  return text
    .split('\n',)
    .filter(function carriesContent(line,): boolean {
    return line.trim() !== '';
  },)
    .length;
}

/**
 * Names a governed rendering that merged lines its original kept apart.
 *
 * AGAINST THE ORIGINAL, NEVER THE PAGE. A governed slice's page may itself be
 * flat, since 50 of 64 archive incumbents already violate the line rule, and
 * flooring on it would fault the producer that correctly unmerges: exactly the
 * repair the rule demands.
 *
 * FEWER LINES ONLY, never an equality check. Measured over the 211
 * line-structured slices of the pinned corpus, the archive's own English
 * matches its Chinese line for line on 115 and differs on 96, and 80 of those
 * carry MORE lines than the Chinese, because an English rendering of Chinese
 * verse legitimately expands. Requiring equality would send back nearly half of
 * every governed rendering, so only a shortfall is named.
 *
 * ONE BLIND SPOT, NAMED RATHER THAN CLOSED. The count is over the whole slice,
 * so a rendering merging two lines in one block while splitting one in another
 * nets to the same total and passes here. Closing that needs per-block
 * alignment, a larger instrument than the flattening this was built to catch,
 * and the blocks themselves are compared separately either way.
 *
 * @param lineStructured - whether the line-structure rule governs this slice,
 * decided upstream over the slice and its enclosing chunk together
 *
 * @param sourceText - original slice, whose lines the rendering owes
 *
 * @param candidateText - proposed translation of it
 *
 * @returns One finding where lines were merged, none otherwise
 *
 * @example
 * ```ts
 * const found = compareLineCounts({ lineStructured, sourceText, candidateText, },);
 * ```
 */
export function compareLineCounts(
  {
    lineStructured,
    sourceText,
    candidateText,
  }: {
    readonly lineStructured: boolean;
    readonly sourceText: string;
    readonly candidateText: string;
  },
): readonly string[] {
  if (!lineStructured)
    return [];

  /**
   * Lines the original keeps apart.
   */
  const owed = contentLineCount({ text: sourceText, },);

  /**
   * Lines the rendering carries.
   */
  const carried = contentLineCount({ text: candidateText, },);

  if (carried >= owed)
    return [];

  return [
    `This slice is LINE-STRUCTURED: every line stands as its own unit, so your `
      + `rendering owes one line per line of the ORIGINAL and may never merge two `
      + `into one. Yours carries ${String(carried,)} lines of content where the `
      + `ORIGINAL has ${String(owed,)}. Put back the line breaks you merged, keeping `
      + `the wording you chose.`,
  ];
}
//endregion Line structure guard
