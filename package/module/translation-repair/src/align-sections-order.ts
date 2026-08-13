import { headingAffinity, } from './heading-affinity.ts';

//region Order-preserving section alignment
// PROTOTYPE for `#71`. Nothing in the pipeline calls this yet.
//
// Replaces "distribute proportionally by character fraction" with an
// order-preserving alignment that may leave a section UNPAIRED.
//
// Proportional distribution cannot express absence. Given fifteen source
// sections and thirteen target sections it must place all fifteen somewhere, so
// two sections missing from the END of a translation slid every earlier pairing
// by two, and `XingZ60` had 其六：Mikä judged against a section headed Ann.
//
// Sequence alignment expresses absence directly: a gap costs a fixed penalty
// once, and the sections either side of it stay where they belong. That is the
// whole difference. A translation is order-preserving with respect to its
// original, so the classic dynamic program is the right shape, and the score it
// maximises is heading affinity.

/**
 * Cost of leaving one section unpaired.
 *
 * Set below the value of a confident match and above a zero-affinity pairing,
 * so the program prefers a gap to pairing two sections that share no evidence.
 * That preference is the point: a wrong pairing manufactures issues against
 * unrelated text, where an unpaired section merely goes unjudged.
 */
const GAP_PENALTY = 0.35;

/**
 * One aligned pair, by index, with either side possibly absent.
 *
 * @example
 * ```ts
 * const step: AlignmentStep = { sourceIndex: 3, targetIndex: 5, affinity: 1, };
 * ```
 */
export type AlignmentStep = {
  /**
   * Source section index, or -1 when the translation carries a section the
   * original does not.
   */
  readonly sourceIndex: number;

  /**
   * Target section index, or -1 when the original carries a section the
   * translation does not.
   */
  readonly targetIndex: number;

  /**
   * Affinity of the pairing, zero for a gap.
   */
  readonly affinity: number;
};

/**
 * Aligns two heading sequences in order, allowing gaps on either side.
 *
 * @param sourceHeadings - original-side headings in document order
 *
 * @param targetHeadings - translation-side headings in document order
 *
 * @returns Steps in document order
 *
 * @example
 * ```ts
 * const steps = alignHeadings({ sourceHeadings, targetHeadings, },);
 * ```
 */
export function alignHeadings(
  {
    sourceHeadings,
    targetHeadings,
  }: {
    readonly sourceHeadings: readonly string[];
    readonly targetHeadings: readonly string[];
  },
): readonly AlignmentStep[] {
  return (function align(): readonly AlignmentStep[] {
    /**
     * Rows and columns of the score table, one more than each sequence.
     */
    const rows = sourceHeadings.length + 1;

    /**
     * Columns of the score table.
     */
    const columns = targetHeadings.length + 1;

    /**
     * Best score reachable at each cell, row-major.
     */
    const scores: number[] = Array.from(
      { length: rows * columns, },
      function toZero() {
        return 0;
      },
    );
    for (let row = 1; row < rows; row += 1)
      scores[row * columns] = (-GAP_PENALTY) * row;

    for (let column = 1; column < columns; column += 1)
      scores[column] = (-GAP_PENALTY) * column;

    for (let row = 1; row < rows; row += 1) {
      for (let column = 1; column < columns; column += 1) {
        /**
         * Score of pairing these two headings.
         */
        const paired = (scores[((row - 1) * columns) + (column - 1)] ?? 0)
          + headingAffinity({
            source: sourceHeadings[row - 1] ?? '',
            target: targetHeadings[column - 1] ?? '',
          },);

        /**
         * Score of leaving this source heading unpaired.
         */
        const sourceGap = (scores[((row - 1) * columns) + column] ?? 0)
          - GAP_PENALTY;

        /**
         * Score of leaving this target heading unpaired.
         */
        const targetGap = (scores[(row * columns) + (column - 1)] ?? 0)
          - GAP_PENALTY;
        scores[(row * columns) + column] = Math.max(
          paired,
          Math.max(
            sourceGap,
            targetGap,
          ),
        );
      }
    }

    /**
     * Steps recovered by walking the table backwards.
     */
    const steps: AlignmentStep[] = [];

    /**
     * Cursor into the table.
     */
    let row = rows - 1;

    /**
     * Column cursor.
     */
    let column = columns - 1;
    while ((row > 0) || (column > 0)) {
      /**
       * Affinity of pairing the headings at this cell.
       */
      const affinity = ((row > 0) && (column > 0))
        ? headingAffinity({
          source: sourceHeadings[row - 1] ?? '',
          target: targetHeadings[column - 1] ?? '',
        },)
        : 0;
      /**
       * Whether both cursors can still step diagonally.
       */
      const canPair = (row > 0) && (column > 0);

      /**
       * Score standing at this cell.
       */
      const here = scores[(row * columns) + column] ?? 0;

      /**
       * Score the diagonal predecessor would have to carry for a pairing.
       */
      const fromPaired = (scores[((row - 1) * columns) + (column - 1)] ?? 0)
        + affinity;
      if (canPair && (here === fromPaired)) {
        steps.push({
          sourceIndex: row - 1,
          targetIndex: column - 1,
          affinity,
        },);
        row -= 1;
        column -= 1;
        continue;
      }
      /**
       * Score the upper predecessor would have to carry for a source gap.
       */
      const fromSourceGap = (scores[((row - 1) * columns) + column] ?? 0)
        - GAP_PENALTY;
      if ((row > 0) && (here === fromSourceGap)) {
        steps.push({
          sourceIndex: row - 1,
          targetIndex: (-1),
          affinity: 0,
        },);
        row -= 1;
        continue;
      }
      steps.push({
        sourceIndex: (-1),
        targetIndex: column - 1,
        affinity: 0,
      },);
      column -= 1;
    }

    return steps.toReversed();
  })();
}

//endregion Order-preserving section alignment
