//region Displacement ratio
// Whether a translation MOVED material across a section boundary, read from
// sizes alone and without asking a model anything.
//
// WHY IT IS WORTH READING. Every judge in the translate lane sees one slice pair
// and nothing else. Where a translator carried a passage into a neighbouring
// section, the archive looks like it invented content on one slice and dropped
// content on the next, and a per-slice roster condemns it at both ends while
// preferring a fresh rendering that says only what its own slice's original
// says. Found on `Dethelly/0` by `#84`'s alteration arm and confirmed by hand:
// the English `Description` carries four sentences whose Chinese sits in the
// NEXT slice.
//
// WHAT THE SIGNAL IS. Chinese-to-English expansion is roughly threefold and
// remarkably steady WITHIN one document, because one translator worked at one
// density. A slice far above its own document's median has taken on text from
// somewhere, and a neighbour below it has given text up. The pair is the
// evidence: one anomaly alone is a slice that paraphrases loosely or a heading
// that carries a long English gloss, while a HIGH beside a LOW is a passage that
// moved.
//
// WHY THE DOCUMENT'S OWN MEDIAN RATHER THAN A CONSTANT. Density varies by
// register: a memorial page carrying long quoted messages expands differently
// from one carrying dates and places. Comparing a document to itself removes
// that, and it is what makes a single threshold usable across the corpus.
//
// WHAT IT CANNOT SAY. It sees SIZE, so a slice that swapped a long passage for
// an equally long one reads as ordinary, and a translator who expanded one
// section for reasons of their own reads as displacement. It is a screen that
// says where to look, not a verdict.

/**
 * How far above its document's median a slice must sit to be called high.
 *
 * TWO, which flagged `Dethelly/0` at 3.5 times its document's median while
 * leaving every ordinary slice of that document alone. Loose enough that
 * ordinary variation in paraphrase does not trip it, tight enough that a whole
 * relocated paragraph does.
 */
const HIGH_FACTOR = 2;

/**
 * Shortest source slice worth a ratio.
 *
 * A very short section makes the ratio jump on one added clause, so below this
 * the number says more about arithmetic than about translation. Kept low
 * because a one-sentence introduction is exactly where displacement lands.
 */
const MIN_SOURCE_CHARS = 20;

/**
 * One slice's size reading.
 *
 * @example
 * ```ts
 * const reading: SliceRatio = { sliceIndex: 0, sourceChars: 35, targetChars: 403, ratio: 11.51, };
 * ```
 */
export type SliceRatio = {
  /**
   * Slice this describes.
   */
  readonly sliceIndex: number;

  /**
   * Characters of original.
   */
  readonly sourceChars: number;

  /**
   * Characters of translation.
   */
  readonly targetChars: number;

  /**
   * Translation characters per original character.
   */
  readonly ratio: number;
};

/**
 * One document's reading, with the slices that stand out.
 *
 * @example
 * ```ts
 * const reading: DocumentDisplacement = { median: 3.31, ratios, highIndices: [0,], movedPairs: [{ high: 0, low: 1, },], };
 * ```
 */
export type DocumentDisplacement = {
  /**
   * Median ratio over the slices this document offered.
   */
  readonly median: number;

  /**
   * Every slice long enough to read.
   */
  readonly ratios: readonly SliceRatio[];

  /**
   * Slices at or above {@link HIGH_FACTOR} times the median.
   */
  readonly highIndices: readonly number[];

  /**
   * High slices with a below-median neighbour, which is the shape a moved
   * passage leaves: one slice took text on and the one beside it gave text up.
   */
  readonly movedPairs: readonly {
    /**
     * Slice that took text on.
     */
    readonly high: number;

    /**
     * Neighbour that gave it up.
     */
    readonly low: number;
  }[];
};

/**
 * Middle value of a list of numbers.
 *
 * @param values - numbers to summarize
 *
 * @returns Median, or zero for an empty list
 *
 * @example
 * ```ts
 * const middle = median({ values: [1, 2, 9,], },);
 * ```
 */
export function median({ values, }: { readonly values: readonly number[]; },): number {
  if (values.length === 0)
    return 0;

  /**
   * Values in ascending order.
   */
  const sorted = values.toSorted(function ascending(
    a,
    b,
  ) {
    return a - b;
  },);

  /**
   * Middle position, low side on an even count.
   */
  const middle = Math.floor(sorted.length / 2,);
  return sorted[middle] ?? 0;
}

/**
 * Reads one document pair's slice sizes for the shape a moved passage leaves.
 *
 * @param slices - prepared slice pairs, each with both sides' character counts
 *
 * @returns Median ratio, every readable slice, and the high slices with a
 * below-median neighbour
 *
 * @example
 * ```ts
 * const reading = readDisplacement({ slices, },);
 * ```
 */
export function readDisplacement(
  {
    slices,
  }: {
    readonly slices: readonly {
      readonly sourceChars: number;
      readonly targetChars: number;
    }[];
  },
): DocumentDisplacement {
  /**
   * Slices long enough for a ratio to mean anything.
   */
  const ratios: readonly SliceRatio[] = slices
    .map(function toRatio(
      slice,
      sliceIndex,
    ): SliceRatio {
      return {
        sliceIndex,
        sourceChars: slice.sourceChars,
        targetChars: slice.targetChars,
        ratio: slice.targetChars / Math.max(
          1,
          slice.sourceChars,
        ),
      };
    },)
    .filter(function longEnough(reading,) {
      return reading.sourceChars >= MIN_SOURCE_CHARS;
    },);

  /**
   * This document's own expansion, which every slice is read against.
   */
  const documentMedian = median({
    values: ratios.map(function toValue(reading,) {
      return reading.ratio;
    },),
  },);

  /**
   * Slices that took on more text than this translator's own habit explains.
   */
  const highIndices = ratios
    .filter(function isHigh(reading,) {
      return reading.ratio >= (documentMedian * HIGH_FACTOR);
    },)
    .map(function toIndex(reading,) {
      return reading.sliceIndex;
    },);

  /**
   * Ratio per slice index, for asking about a neighbour.
   */
  const byIndex = new Map(ratios.map(function toEntry(reading,): readonly [
    number,
    number,
  ] {
    return [
      reading.sliceIndex,
      reading.ratio,
    ];
  },),);

  /**
   * High slices whose neighbour sits below the median, which is displacement
   * seen from both ends rather than one slice being unusual by itself.
   */
  const movedPairs = highIndices.flatMap(function toPairs(high,) {
    return [
      high - 1,
      high + 1,
    ]
      .filter(function isBelowMedian(neighbour,) {
        /**
         * That neighbour's ratio, absent when it was too short to read.
         */
        const ratio = byIndex.get(neighbour,);
        if (ratio === undefined)
          return false;
        return ratio < documentMedian;
      },)
      .map(function toPair(low,) {
        return {
          high,
          low,
        };
      },);
  },);
  return {
    median: documentMedian,
    ratios,
    highIndices,
    movedPairs,
  };
}

//endregion Displacement ratio
