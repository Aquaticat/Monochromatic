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

/**
 * Archive wording of the sections either side of one slice.
 *
 * THE OTHER HALF OF THE SAME WINDOW, and the half that carries the signal. A
 * relocation leaves a hole on one side of a boundary and a bulge on the other,
 * and the bulge is in the ARCHIVE rather than in the original: the Chinese says
 * each thing once, in its own place, while the English says it next door.
 * Showing a judge the neighbouring original tells it what the neighbour is
 * ABOUT; showing it the neighbouring archive tells it where the missing English
 * actually went.
 *
 * MEASURED 2026-08-18 over 92 entries and 1260 slices: every relocation pair in
 * the corpus is ADJACENT, and the longest run of flagged slices anywhere is
 * three. So one section each way is not a guess at a useful width, it is the
 * width the phenomenon has.
 *
 * WHY NOT THE SETTLED OUTPUT, which would be the sharper signal for a
 * duplication: it depends on which slices have settled, so the same slice would
 * be judged against different context depending on resume order, and the cache
 * key could not name it. The archive is index-stable and it is where the
 * displacement sits.
 *
 * A DETERMINISTIC GUARD WAS TRIED FIRST AND CANNOT DO THIS. The duplication in
 * `lintong` shares 29 characters between the two passages that say the same
 * thing, against the 60 a shingle guard needs, because the repeat is a
 * paraphrase rather than a copy. Over both settled pools, 162 adjacent pairs,
 * a lexical guard fires zero times including on the pair that is visibly
 * duplicated. Only a reader can see it, so a reader has to be shown it.
 *
 * @param slices - prepared slice pairs of one entry
 *
 * @param sliceIndex - POSITION IN `slices`, never a stamped `chunkIndex`
 *
 * @returns Neighbouring archive text, empty when the slice stands alone
 *
 * @throws {@link RangeError} when `sliceIndex` is not a position in `slices`,
 * for the reason {@link neighbouringSource} throws
 *
 * @example
 * ```ts
 * const besideText = neighbouringIncumbent({ slices, sliceIndex, },);
 * ```
 */
export function neighbouringIncumbent(
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
      `neighbouringIncumbent asked for slice ${String(sliceIndex,)} of `
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
      return beside.target
        .text;
    },)
    .filter(function present(text,): boolean {
      return text !== '';
    },)
    .join('\n\n',);
}

//endregion Fidelity window
