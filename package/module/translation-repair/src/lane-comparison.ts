import type { LaneSliceText, } from './lane-slice-text.ts';

//region Lane comparison
// What the two lanes did to the SAME slice, which is the question running both
// of them over one preparation exists to answer.
//
// Computed here rather than in the combined driver on purpose. The driver
// returns both documents and arbitrates nothing, and that property is what its
// tests pin; a comparison is not arbitration, but a driver that computed one
// would be the obvious place to later put a winner. Anyone who wants the
// comparison asks for it.
//
// SHIPPED IS READ OFF THE INDEX SETS, never off a per-slice record. A lane's
// record says what that slice decided; the assembly guard decides what the
// document carries, and the two disagree exactly where this comparison is most
// worth reading.

/**
 * What the two lanes did to one slice.
 *
 * @example
 * ```ts
 * const verdict: SliceLaneVerdict = 'both-differ';
 * ```
 */
export type SliceLaneVerdict =
  /**
   * Neither document carries a change: the archive's own English stands in
   * both, whether because both lanes left it alone or because the assembly
   * guard took both replacements back.
   */
  | 'archive-stands'
  /**
   * Repair's document changed this slice and translate's did not.
   */
  | 'repair-only'
  /**
   * Translate's document changed this slice and repair's did not.
   */
  | 'translate-only'
  /**
   * Both documents changed this slice to the SAME wording, character for
   * character.
   */
  | 'both-agree'
  /**
   * Both documents changed this slice and the two wordings differ, which is the
   * case a human has to read.
   */
  | 'both-differ';

/**
 * One slice as both lanes left it.
 *
 * @example
 * ```ts
 * const row: SliceLaneComparison = { chunkIndex: 3, verdict: 'both-differ', ... };
 * ```
 */
export type SliceLaneComparison = {
  /**
   * Global slice index both lanes name it by.
   */
  readonly chunkIndex: number;

  /**
   * Archive's own English for this slice.
   */
  readonly incumbentText: string;

  /**
   * Wording the repair document CARRIES, which is the incumbent wherever that
   * lane changed nothing or had its change withdrawn.
   */
  readonly repairText: string;

  /**
   * Wording the translate document CARRIES, on the same rule.
   */
  readonly translateText: string;

  /**
   * How the two documents relate on this slice.
   */
  readonly verdict: SliceLaneVerdict;

  /**
   * Whether the repair lane examined this slice at all.
   *
   * False only where that lane stopped early by design, which its
   * whole-document non-translation block does from inside the slice loop.
   * Separate from the verdict because both documents carrying the archive
   * wording says nothing about whether anyone looked, and "examined and left
   * alone" is a different fact from "never reached".
   */
  readonly repairEvaluated: boolean;

  /**
   * Whether the translate lane examined this slice at all.
   */
  readonly translateEvaluated: boolean;
};

/**
 * Raised when two lane results cannot be compared because they do not describe
 * the same preparation.
 *
 * @example
 * ```ts
 * throw new LaneComparisonError({ message: 'slice 4 differs', },);
 * ```
 */
export class LaneComparisonError extends Error {
  /**
   * Builds the error with a message naming what disagreed.
   *
   * @param message - which slice disagreed and how
   *
   * @example
   * ```ts
   * throw new LaneComparisonError({ message: 'slice 4 differs', },);
   * ```
   */
  constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'LaneComparisonError';
  }
}

/**
 * Wording one lane's document carries for a slice.
 *
 * @param wording - what that lane decided for it
 *
 * @param shipped - whether the returned document carries that decision
 *
 * @returns Decided wording when it shipped, archive wording otherwise
 *
 * @example
 * ```ts
 * const carried = carriedText({ wording, shipped, },);
 * ```
 */
function carriedText(
  {
    wording,
    shipped,
  }: {
    readonly wording: LaneSliceText;
    readonly shipped: boolean;
  },
): string {
  // A slice the lane never reached carries the archive wording whatever the
  // index sets say, and there is no accepted wording to fall back on.
  return (shipped && (wording.acceptedText !== null))
    ? wording.acceptedText
    : wording.incumbentText;
}

/**
 * Names how one slice's two carried wordings relate.
 *
 * @param repairText - wording the repair document carries
 *
 * @param translateText - wording the translate document carries
 *
 * @param incumbentText - archive wording both fall back to
 *
 * @returns Verdict for this slice
 *
 * @example
 * ```ts
 * const verdict = judgeSlice({ repairText, translateText, incumbentText, },);
 * ```
 */
function judgeSlice(
  {
    repairText,
    translateText,
    incumbentText,
  }: {
    readonly repairText: string;
    readonly translateText: string;
    readonly incumbentText: string;
  },
): SliceLaneVerdict {
  /**
   * Whether the repair document moved off the archive wording.
   */
  const repairMoved = repairText !== incumbentText;

  /**
   * Whether the translate document did.
   */
  const translateMoved = translateText !== incumbentText;
  if (repairMoved && translateMoved)
    return (repairText === translateText) ? 'both-agree' : 'both-differ';
  if (repairMoved)
    return 'repair-only';
  if (translateMoved)
    return 'translate-only';
  return 'archive-stands';
}

/**
 * Compares what two lanes' documents carry, slice by slice.
 *
 * @param repair - repair lane's per-slice wordings and shipped indices
 *
 * @param translate - translate lane's, over the SAME preparation
 *
 * @returns One row per slice, in document order
 *
 * @throws LaneComparisonError when the two results describe different
 * preparations, which makes every row a comparison of two different passages
 *
 * @example
 * ```ts
 * const rows = compareDocumentLanes({ repair, translate, },);
 * ```
 */
export function compareDocumentLanes(
  {
    repair,
    translate,
  }: {
    readonly repair: {
      readonly sliceTexts: readonly LaneSliceText[];
      readonly shippedChunkIndices: readonly number[];
    };
    readonly translate: {
      readonly sliceTexts: readonly LaneSliceText[];
      readonly shippedChunkIndices: readonly number[];
    };
  },
): readonly SliceLaneComparison[] {
  if (repair.sliceTexts.length !== translate.sliceTexts.length)
    throw new LaneComparisonError({
      message: `lanes report ${String(repair.sliceTexts.length,)} and `
        + `${String(translate.sliceTexts.length,)} slices, so they ran over different preparations`,
    },);

  /**
   * Translate wording for each slice index.
   */
  const translateByIndex = new Map(
    translate.sliceTexts.map(function toEntry(wording,): [number, LaneSliceText,] {
      return [
        wording.chunkIndex,
        wording,
      ];
    },),
  );

  /**
   * Slices the repair document carries a change for.
   */
  const repairShipped = new Set(repair.shippedChunkIndices,);

  /**
   * Slices the translate document carries a replacement for.
   */
  const translateShipped = new Set(translate.shippedChunkIndices,);

  return repair.sliceTexts.map(function toRow(mine,): SliceLaneComparison {
    /**
     * Same slice as the other lane left it.
     */
    const theirs = translateByIndex.get(mine.chunkIndex,);
    if (theirs === undefined)
      throw new LaneComparisonError({
        message: `slice ${String(mine.chunkIndex,)} is missing from the translate lane`,
      },);
    if (theirs.incumbentText !== mine.incumbentText)
      throw new LaneComparisonError({
        message: `slice ${String(mine.chunkIndex,)} carries a different incumbent in each lane, `
          + 'so the two results describe different preparations',
      },);

    /**
     * Wording the repair document carries here.
     */
    const repairText = carriedText({
      wording: mine,
      shipped: repairShipped.has(mine.chunkIndex,),
    },);

    /**
     * Wording the translate document carries here.
     */
    const translateText = carriedText({
      wording: theirs,
      shipped: translateShipped.has(theirs.chunkIndex,),
    },);

    return {
      chunkIndex: mine.chunkIndex,
      incumbentText: mine.incumbentText,
      repairText,
      translateText,
      repairEvaluated: mine.acceptedText !== null,
      translateEvaluated: theirs.acceptedText !== null,
      verdict: judgeSlice({
        repairText,
        translateText,
        incumbentText: mine.incumbentText,
      },),
    };
  },);
}

//endregion Lane comparison
