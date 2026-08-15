import type { ChunkPair, } from './chunk-document.ts';

//region Slice indexing
// The one property every cache key, every splice and every cross-lane
// comparison rests on: a prepared slice's index is its position in the
// preparation, and both of its sides agree about it.
//
// It is not enforced anywhere else, and it is not obvious from the code that
// produces it. `chunkByHeadings` stamps a SECTION index, `alignDocumentSections`
// pairs sections whose two indices need not match, and only `subdivideChunkPair`
// restamps both sides from a running counter. Three stampings with three
// meanings reach one field called `chunkIndex`, so which one a given chunk
// carries depends on where it came from. `#99` reshapes that; this checks the
// invariant the reshape has to preserve, and would catch the reshape breaking it.

/**
 * Thrown when a preparation's slices are not indexed as the pipeline assumes.
 *
 * @example
 * ```ts
 * throw new SliceIndexingError({ message: 'slice 3 sits at position 4', },);
 * ```
 */
export class SliceIndexingError extends Error {
  /**
   * Builds failure naming what is wrong with the indexing.
   *
   * @param message - what does not hold, in slice terms
   *
   * @example
   * ```ts
   * throw new SliceIndexingError({ message: 'sides disagree', },);
   * ```
   */
  public constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'SliceIndexingError';
  }
}

/**
 * Refuses a slice list whose indices are not their own positions.
 *
 * THREE THINGS ARE CHECKED, and each is assumed somewhere that cannot check it
 * for itself:
 *
 * -   BOTH SIDES AGREE. `settleTranslateSlice` reads the target side's index and
 *     `spliceSlices` keys on it alone, so a source side carrying some other
 *     number is unchecked everywhere it is used. Section pairing can produce
 *     exactly that, since a forced pair joins section 4 to section 6.
 * -   INDICES ARE POSITIONS. The cache key carries the index, the lane results
 *     name slices by it, and assembly maps replacements back through it. A
 *     duplicate would let one cached slice answer for another; a gap would make
 *     a range check pass while naming a slice that does not exist.
 * -   ORDER IS DOCUMENT ORDER, which is the same statement read forwards: it is
 *     what lets a reader compare two lanes slice by slice without carrying
 *     offsets around.
 *
 * WHY AN ASSERTION RATHER THAN A CONSTRUCTION. The construction is already
 * right: `prepareDocumentPair` passes a running count as the base index and
 * `subdivideChunkPair` stamps both sides from it. What is missing is anything
 * that FAILS if that stops being true, and the whole of `#99` is a change to how
 * these indices are assigned.
 *
 * @param slices - prepared slice pairs in document order
 *
 * @throws {@link SliceIndexingError} when the two sides of a slice disagree, or
 * an index is not its own position
 *
 * @example
 * ```ts
 * assertSliceIndexing({ slices, },);
 * ```
 */
export function assertSliceIndexing(
  { slices, }: { readonly slices: readonly ChunkPair[]; },
): void {
  for (const [position, slice,] of slices.entries()) {
    /**
     * Index the original side carries.
     */
    const sourceIndex = slice.source
      .chunkIndex;

    /**
     * Index the translation side carries, which is the one every consumer
     * reads.
     */
    const targetIndex = slice.target
      .chunkIndex;
    if (sourceIndex !== targetIndex) {
      throw new SliceIndexingError({
        message: `slice at position ${String(position,)} carries source index ${
          String(sourceIndex,)
        } against target index ${String(targetIndex,)}, so which one names it depends on who is asking`,
      },);
    }
    if (targetIndex !== position) {
      throw new SliceIndexingError({
        message: `slice at position ${String(position,)} is indexed ${
          String(targetIndex,)
        }, and every cache key, splice and lane comparison reads that index as the position`,
      },);
    }
  }
}

//endregion Slice indexing
