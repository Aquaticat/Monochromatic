import type { ChunkPair, } from './chunk-document.ts';

//region Fidelity window
// How much of the ORIGINAL a judge is shown, which `#107` turned into a
// measurable question rather than a design assumption.
//
// WHAT `#107` MEASURED, at the strength the screen actually supports. The screen
// names CANDIDATES rather than verdicts: 22 adjacent pairs whose sizes are
// consistent with a passage having been carried across a section boundary, two
// of which a transcription explains equally well. Hand verification has
// confirmed two relocations and two transcriptions, which is four slices rather
// than twenty-two.
//
// AN EARLIER VERSION OF THIS COMMENT read "6.4 percent of corpus slices sit in a
// pair where the translator carried a passage across a section boundary", and
// both halves of that were wrong. The figure is 80 of 1260, 6.3 percent, and it
// is the union of FOUR classes of which relocation is one. Nothing measured says
// that 6.4 percent of slices were carried anywhere.
//
// WHAT IS SOLID is the mechanism, on one hand-verified case. A judge shown one
// slice pair of `Dethelly/0` sees the archive inventing content there and
// dropping it next door, and refuses both candidates. Every miss the alteration
// arm of `#84` recorded fell on that entry, and widening the window turned three
// of those four into correct choices.
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
 * WHY AN OUT-OF-RANGE INDEX THROWS rather than returning nothing. Both indices
 * miss, so the natural answer is the empty string, which is exactly the value
 * that means NO WINDOW. The wide arm would then send the narrow arm's sheet, the
 * comparison would report the window as making no difference, and that null
 * would be indistinguishable from a real one. The risk is live rather than
 * theoretical: `#99` recorded that `chunkIndex` names three different things
 * depending on who stamped it, and a caller passing a stamped index where a
 * slice position belongs is the exact mistake this catches. Empty may therefore
 * mean ONE thing only, a lone slice with no neighbours.
 *
 * @param slices - prepared slice pairs of one entry
 *
 * @param sliceIndex - POSITION IN `slices`, never a stamped `chunkIndex`
 *
 * @returns Neighbouring source text, empty when the slice stands alone
 *
 * @throws {@link RangeError} when `sliceIndex` is not a position in `slices`,
 * since the alternative is a silent empty window
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
  if ((!Number.isInteger(sliceIndex,))
    || (sliceIndex < 0)
    || (sliceIndex >= slices.length)) {
    throw new RangeError(
      `neighbouringSource asked for slice ${String(sliceIndex,)} of `
        + `${String(slices.length,)}: not a position in this entry. An index `
        + `stamped elsewhere would return an empty window here, which reads as `
        + `a slice with no neighbours and would report a measured null.`,
    );
  }

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
