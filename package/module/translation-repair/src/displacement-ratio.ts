//region Displacement ratio
// Size primitives the displacement classifier reads: per-slice ratios, a
// document's own expansion, and the corpus expansion to fall back on.
//
// WHY SIZE IS WORTH READING AT ALL. Every judge in the translate lane sees one
// slice pair and nothing else. Where a translator carried a passage into a
// neighbouring section, the archive looks like it invented content on one slice
// and dropped content on the next, and a per-slice roster condemns it at both
// ends while preferring a fresh rendering that says only what its own slice's
// original says. Found on `Dethelly/0` by `#84`'s alteration arm and confirmed
// by hand: the English `Description` carries four sentences whose Chinese sits
// in the NEXT slice.
//
// WHY A DOCUMENT'S OWN MEDIAN IS NOT THE STATISTIC, which the first version of
// this file got wrong. Density does vary by register, so comparing a document
// to itself is the right instinct. But a median over slices is CONTAMINATED BY
// THE THING IT IS MEANT TO DETECT: `shi_Yumiaoya` carries three untranslated
// sections whose near-zero ratios pull its median to 0.76, which drops the
// threshold to 1.51, which then flags two perfectly ordinary translations. A
// document aggregate over slices that are plausibly translated does not have
// that failure.
//
// THE AGGREGATE IS NOT FULLY INVARIANT UNDER RELOCATION EITHER, and an earlier
// version of this comment claimed it was. A total over ALL slices would be:
// moving text between slices leaves both document totals alone. The aggregate
// this file computes is taken over ELIGIBLE slices, and relocation can move text
// across that boundary. `Dethelly` is the case: its 35-character recipient is
// excluded by the length floor while its 129-character donor is included, so the
// baseline is lower than it would otherwise be. Measured, the ratio of deficit to
// surplus reads 0.41 under this baseline, 0.44 leaving the pair out, and 0.51
// over all slices. THE CONCLUSION SURVIVES ALL THREE, since the deficit is the
// smaller side under every one, but the estimator is endogenous and the honest
// fix is a baseline computed per adjacency with that pair excluded. Recorded on
// `#432` with those measurements rather than changed at the same time as the
// numbers that depend on it.

/**
 * Expansion the corpus works at, used when a document cannot speak for itself.
 *
 * MEASURED, not assumed. Over the pinned commit's 92 complete pairs, the 91 that
 * carry any original text at all give a median per-document aggregate of 2.86,
 * with a p10 to p90 span of 1.95 to 3.47. An earlier draft of this instrument
 * said "roughly threefold" from recall; the measurement moved it.
 *
 * NINETY-ONE RATHER THAN NINETY-TWO because `XIEPT2` has both files and no
 * source text, so it can carry no aggregate. Elsewhere this instrument counts
 * 92, which is complete PAIRS; the two numbers measure different things.
 */
export const CORPUS_REFERENCE_EXPANSION = 2.86;

/**
 * Lowest document aggregate still worth believing as a baseline.
 *
 * Below this a document is not translating at a plausible density: it is
 * partly untranslated, or mostly markup, or carries long verbatim blocks. Set
 * just under the measured p10 of 1.95 so an ordinary low-density document keeps
 * its own baseline and a contaminated one does not.
 */
export const PLAUSIBLE_BASELINE_MIN = 1.9;

/**
 * Highest document aggregate still worth believing as a baseline.
 *
 * Above this the translation carries substantially more than the original says,
 * which is a document-scale version of the source-absent class rather than a
 * density. Measured p90 is 3.47, so this leaves generous room before refusing.
 */
export const PLAUSIBLE_BASELINE_MAX = 4.5;

/**
 * Shortest original worth a ratio.
 *
 * RAISED FROM TWENTY, which was far too low: `noname3031`'s flagged slice was
 * TWENTY-THREE original characters, one over the old floor, and its ratio was
 * arithmetic rather than evidence. At eighty a slice has to carry a sentence or
 * two before its ratio is read at all.
 */
export const MIN_RATIO_SOURCE_CHARS = 80;

/**
 * One slice's size reading.
 *
 * @example
 * ```ts
 * const size: SliceSize = { sourceChars: 129, targetChars: 268, };
 * ```
 */
export type SliceSize = {
  /**
   * Characters of original.
   */
  readonly sourceChars: number;

  /**
   * Characters of translation.
   */
  readonly targetChars: number;
};

/**
 * One slice's size reading with the ratio it implies.
 *
 * @example
 * ```ts
 * const reading: SliceRatio = { sliceIndex: 0, sourceChars: 35, targetChars: 403, ratio: 11.51, };
 * ```
 */
export type SliceRatio = SliceSize & {
  /**
   * Slice this describes.
   */
  readonly sliceIndex: number;

  /**
   * Translation characters per original character.
   */
  readonly ratio: number;
};

/**
 * Reads each slice's ratio, in slice order and without dropping any.
 *
 * NOTHING IS FILTERED HERE. The old version discarded every slice under a
 * source-character floor before anything else ran, which threw away the
 * strongest evidence there is: `Zha_Ke`'s slice 1 carries 41 original
 * characters against 3652 translated, a ratio of 89, and a floor on the
 * ORIGINAL side deleted it. Classification decides what a short slice means;
 * this function only measures.
 *
 * @param slices - prepared slice pairs, each with both sides' character counts
 *
 * @returns Ratio per slice, one entry per input in the same order
 *
 * @example
 * ```ts
 * const readings = sliceRatios({ slices, },);
 * ```
 */
export function sliceRatios(
  { slices, }: { readonly slices: readonly SliceSize[]; },
): readonly SliceRatio[] {
  return slices.map(function toRatio(
    slice,
    sliceIndex,
  ): SliceRatio {
    // A SOURCE OF ZERO IS A REAL STATE, not an input to sanitize: a slice can be
    // an insertion anchor with no original at all. Its ratio is the translated
    // length itself, which classification reads as target-only rather than as a
    // density.
    if (slice.sourceChars <= 0) {
      return {
        sliceIndex,
        sourceChars: slice.sourceChars,
        targetChars: slice.targetChars,
        ratio: slice.targetChars,
      };
    }
    return {
      sliceIndex,
      sourceChars: slice.sourceChars,
      targetChars: slice.targetChars,
      ratio: slice.targetChars / slice.sourceChars,
    };
  },);
}

/**
 * Expansion to read a document's slices against.
 *
 * THE AGGREGATE RATHER THAN THE MEDIAN, over slices the caller has already
 * decided are plausibly translated. It weights by length, so a 1300-character
 * section counts for more than an 80-character one, which a median does not, and
 * it is not dragged to nothing by a section nobody translated.
 *
 * IT IS ONLY PARTLY INVARIANT UNDER RELOCATION. Over ALL slices it would be
 * exactly invariant, since moving text between slices leaves both totals alone;
 * over the ELIGIBLE ones it is not, because relocation can carry text across the
 * eligibility boundary. The region comment gives the measured size of that
 * effect and `#432` carries the fix.
 *
 * @param slices - slices believed to be translated
 *
 * @returns Document's own expansion when believable, and the corpus reference
 * otherwise, with which one was used
 *
 * @example
 * ```ts
 * const baseline = documentBaseline({ slices: translated, },);
 * ```
 */
export function documentBaseline(
  { slices, }: { readonly slices: readonly SliceSize[]; },
): {
  readonly expansion: number;
  readonly from: 'document' | 'corpus-reference';
} {
  /**
   * Original characters across those slices.
   */
  const sourceChars = slices.reduce(
    function addSource(
      total,
      slice,
    ) {
      return total + Math.max(
        0,
        slice.sourceChars,
      );
    },
    0,
  );

  /**
   * Translated characters across those slices.
   */
  const targetChars = slices.reduce(
    function addTarget(
      total,
      slice,
    ) {
      return total + Math.max(
        0,
        slice.targetChars,
      );
    },
    0,
  );

  /**
   * Corpus expansion, named once so both refusal paths read alike.
   */
  const fallback = {
    expansion: CORPUS_REFERENCE_EXPANSION,
    from: 'corpus-reference',
  } as const;
  if (sourceChars <= 0)
    return fallback;

  /**
   * This document's own expansion over the slices it offered.
   */
  const expansion = targetChars / sourceChars;
  if (expansion < PLAUSIBLE_BASELINE_MIN)
    return fallback;
  if (expansion > PLAUSIBLE_BASELINE_MAX)
    return fallback;
  return {
    expansion,
    from: 'document',
  };
}

//endregion Displacement ratio
