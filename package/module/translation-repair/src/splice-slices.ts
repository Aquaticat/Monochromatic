import type { ChunkPair, } from './chunk-document.ts';
import type { ChunkRepairOutcome, } from './repair-contract.ts';

//region Slice splicing
// Rebuilding a whole translation from per-slice outcomes.
//
// Extracted because the driver now assembles TWICE: once to get `T1`, whose
// definitions the naturalness gate needs in order to resolve references, and
// once more to get the text that ships. Two copies of an offset-descending
// splice is exactly the kind of duplication that drifts.

/**
 * Rebuilds the translation with every changed slice spliced in.
 *
 * Changed slices apply in DESCENDING document order, so splicing one never
 * shifts the offsets of those still pending.
 *
 * @param targetText - translation the slices were cut from
 *
 * @param slices - slice pairs in document order, indexed by chunk index
 *
 * @param outcomes - per-slice outcomes in any order
 *
 * @returns Translation with changed slices replaced
 *
 * @throws {@link Error} when an outcome names a slice that does not exist
 *
 * @example
 * ```ts
 * const assembled = spliceSlices({ targetText, slices, outcomes, },);
 * ```
 */
export function spliceSlices(
  {
    targetText,
    slices,
    outcomes,
  }: {
    readonly targetText: string;
    readonly slices: readonly ChunkPair[];
    readonly outcomes: readonly ChunkRepairOutcome[];
  },
): string {
  /**
   * Changed slices in descending document order.
   */
  const changed = outcomes
    .filter(function isChanged(outcome,) {
      return outcome.changed;
    },)
    .toSorted(function byOffsetDescending(
      left,
      right,
    ) {
      /**
       * Target slice of the left outcome, for its offset.
       */
      const leftChunk = slices[left.chunkIndex]
        ?.target;

      /**
       * Right-side slice.
       */
      const rightChunk = slices[right.chunkIndex]
        ?.target;
      return (rightChunk?.startOffset ?? 0) - (leftChunk?.startOffset ?? 0);
    },);
  return changed.reduce(
    function spliceOne(
      text: string,
      outcome,
    ): string {
      /**
       * Target slice being replaced, present by construction.
       */
      const chunk = slices[outcome.chunkIndex]
        ?.target;
      if (chunk === undefined)
        throw new Error(`repair lost slice ${String(outcome.chunkIndex,)}`,);
      return text.slice(
        0,
        chunk.startOffset,
      )
        + outcome.repairedText
        + text.slice(chunk.endOffset,);
    },
    targetText,
  );
}

//endregion Slice splicing
