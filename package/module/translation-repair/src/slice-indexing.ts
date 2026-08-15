import type { ChunkPair, } from './chunk-document.ts';

//region Slice indexing
// The one property every splice, every lane result and every cross-lane
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
 * Stamps one slice pair with the index it holds in the finished preparation.
 *
 * THE LAST WORD ON WHAT A SLICE IS CALLED. Subdivision is handed a base index
 * and adds its own offset, which is right only while every earlier section
 * contributed exactly the slices the base counted. That is true today and
 * `#100` breaks it deliberately: an insertion slice for an untranslated section
 * is a slice the base index never saw coming. Restamping here means the
 * preparation never has to trust the arithmetic it handed out, and both sides
 * of a pair are stamped from one value rather than twice from the same
 * expression.
 *
 * @param slice - pair as subdivision produced it
 *
 * @param sliceIndex - position this pair holds in the whole preparation
 *
 * @returns Same pair with both sides carrying that index
 *
 * @example
 * ```ts
 * const stamped = reindexSlicePair({ slice, sliceIndex: 4, },);
 * ```
 */
export function reindexSlicePair(
  {
    slice,
    sliceIndex,
  }: {
    readonly slice: ChunkPair;
    readonly sliceIndex: number;
  },
): ChunkPair {
  return {
    source: {
      ...slice.source,
      chunkIndex: sliceIndex,
    },
    target: {
      ...slice.target,
      chunkIndex: sliceIndex,
    },
  };
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
 * -   INDICES ARE POSITIONS. The lane results name slices by the index, and
 *     assembly maps replacements back through it, so a duplicate would let one
 *     slice's text be spliced over another's span while a gap would make a
 *     range check pass while naming a slice that does not exist. The cache key
 *     no longer carries it, since version 26 and translate version 2, which is
 *     why a resumed record is stamped with the index it was asked under.
 * -   ORDER IS DOCUMENT ORDER, which is the same statement read forwards: it is
 *     what lets a reader compare two lanes slice by slice without carrying
 *     offsets around.
 *
 * AN ASSERTION BESIDE A CONSTRUCTION, since `prepareDocumentPair` now restamps
 * every slice with {@link reindexSlicePair} rather than trusting the base index
 * it handed to subdivision. From that path this cannot fail, which is the
 * point: it fails if the restamp is changed or removed, and it is the only
 * check any OTHER producer of slice pairs has. The probes, the benches and the
 * census each subdivide with a base index of their own.
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
        }, and every splice, lane result and comparison reads that index as the position`,
      },);
    }
  }
}

//endregion Slice indexing
