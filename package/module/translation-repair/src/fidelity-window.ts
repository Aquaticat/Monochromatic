import type { ChunkPair, } from './chunk-document.ts';

//region Fidelity window
// How much of the ORIGINAL a judge is shown, which `#107` turned into a
// measurable question rather than a design assumption.
//
// WHAT `#107` MEASURED. 6.4 percent of corpus slices sit in a pair where the
// translator carried a passage across a section boundary. A judge shown one
// slice pair sees the archive inventing content there and dropping it next
// door, and refuses both candidates; that accounts for every miss the
// alteration arm of `#84` recorded, on `Dethelly/0`.
//
// SO THE WINDOW IS A VARIABLE. Running the same trial narrow and wide, with the
// ground truth unchanged, separates "the roster judged badly" from "the roster
// was shown too little".

/**
 * Original of the sections either side of one slice.
 *
 * BOTH NEIGHBOURS AND NOTHING MORE. A whole document would drown the sheet, and
 * would also let a judge find any sentence somewhere, which is not the question:
 * `#107` is about material carried across ONE boundary, so one section each way
 * is the window that would fix it if a window is what is wrong.
 *
 * @param slices - prepared slice pairs of one entry
 *
 * @param sliceIndex - slice being judged
 *
 * @returns Neighbouring source text, empty when the slice stands alone
 *
 * @example
 * ```ts
 * const contextText = neighbouringSource({ slices, sliceIndex, },);
 * ```
 */
export function neighbouringSource(
  {
    slices,
    sliceIndex,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly sliceIndex: number;
  },
): string {
  return [
    sliceIndex - 1,
    sliceIndex + 1,
  ]
    .map(function toText(neighbour,): string {
      /**
       * That slice, absent at either end of the document.
       */
      const beside = slices[neighbour];
      if (beside === undefined)
        return '';
      return beside.source
        .text;
    },)
    .filter(function present(text,): boolean {
      return text !== '';
    },)
    .join('\n\n',);
}

//endregion Fidelity window
