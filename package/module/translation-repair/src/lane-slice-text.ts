import type { ChunkPair, } from './chunk-document.ts';

//region Lane slice text
// What one lane DECIDED for each slice, beside what the archive already said.
//
// Both lanes already report which slices the returned document carries a change
// for. That names the slices and says nothing about the wording, so the question
// the two-lane design exists to answer, whether repair and translate produce the
// SAME English where they both touch a slice, cannot be asked of either result.
//
// Deliberately ACCEPTED-SIDE ONLY. Whether a slice shipped is a fact about one
// document, decided by an assembly guard that reads the whole of it, and the
// same slice can ship in one run and be withdrawn in the next when a
// neighbouring replacement changes. Membership in a result's shipped and
// withdrawn index sets is that fact; repeating it here would put a per-run
// verdict on a per-slice record, which is the defect class this file exists
// downstream of.

/**
 * One slice's wording as a lane left it.
 *
 * @example
 * ```ts
 * const wording: LaneSliceText = { chunkIndex: 3, incumbentText: 'The cat naps.', acceptedText: 'The cat is napping.', };
 * ```
 */
export type LaneSliceText = {
  /**
   * Global slice index, which is what a comparison joins two lanes on.
   */
  readonly chunkIndex: number;

  /**
   * Archive's own English for this slice, before either lane touched it.
   */
  readonly incumbentText: string;

  /**
   * Wording this lane decided on, whether or not the document carries it.
   *
   * Equals {@link LaneSliceText.incumbentText} when the lane left the slice
   * alone, which is a decision rather than an absence and is recorded as one.
   *
   * ABSENT means the lane never reached this slice, which the repair lane's
   * whole-document block produces: it stops at the earliest crossing, so the
   * slices after it were never examined. Supplying the archive wording there
   * would state a decision nobody took, and an empty string would say the lane
   * chose to delete the passage.
   */
  readonly acceptedText?: string;
};

/**
 * What a builder does about a prepared slice the lane never decided.
 *
 * @example
 * ```ts
 * const undecided: UndecidedSlicePolicy = 'refuse';
 * ```
 */
export type UndecidedSlicePolicy =
  /**
   * Treat it as a defect, which is right wherever the lane is meant to visit
   * every slice: a short list is otherwise read by every later count as a
   * smaller document.
   */
  | 'refuse'
  /**
   * Record it as unexamined, which is right only where the lane stopped early
   * BY DESIGN and says so in its status.
   */
  | 'not-evaluated';

/**
 * Raised when a lane reports a decision for a slice its preparation never
 * produced, when it leaves a prepared slice undecided under `refuse`, or when
 * it decides a slice AFTER an undecided one under `not-evaluated`.
 *
 * The first two mean the decision list and the slice list were built from
 * different preparations, which no later reader could detect: a comparison
 * would silently join one lane's slice 4 against the other's slice 4 while the
 * two name different passages.
 *
 * The third is a different defect with the same remedy. `not-evaluated` exists
 * for a lane that stopped early by design, so its undecided slices are a
 * SUFFIX; a decision after a gap means a slice was dropped from the middle,
 * which an early stop cannot produce.
 *
 * @example
 * ```ts
 * throw new LaneSliceCoverageError({ message: 'slice 4 has no decision', },);
 * ```
 */
export class LaneSliceCoverageError extends Error {
  /**
   * Builds the error with a message naming the slice.
   *
   * @param message - what is missing, naming the slice index
   *
   * @example
   * ```ts
   * throw new LaneSliceCoverageError({ message: 'slice 4 has no decision', },);
   * ```
   */
  constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'LaneSliceCoverageError';
  }
}

/**
 * Pairs each prepared slice with the wording a lane decided for it.
 *
 * Built at the DOCUMENT level rather than stored per slice, so neither lane's
 * cache schema has to carry it and a resumed slice cannot serve a stale
 * incumbent from a preparation that has since changed.
 *
 * @param slices - prepared slice pairs, which supply both the denominator and
 * every incumbent
 *
 * @param decided - what the lane accepted, keyed by the same global index
 *
 * @param undecided - what to do about a prepared slice with no decision;
 * `refuse` wherever the lane visits every slice, `not-evaluated` only where it
 * stops early by design
 *
 * @returns One entry per prepared slice, in document order
 *
 * @throws LaneSliceCoverageError when a decision names a slice preparation
 * never produced, or a prepared slice has no decision under `refuse`
 *
 * @example
 * ```ts
 * const wordings = buildLaneSliceTexts({ slices, decided, undecided: 'refuse', },);
 * ```
 */
export function buildLaneSliceTexts(
  {
    slices,
    decided,
    undecided,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly decided: readonly {
      readonly chunkIndex: number;
      readonly text: string;
    }[];
    readonly undecided: UndecidedSlicePolicy;
  },
): readonly LaneSliceText[] {
  /**
   * Wording decided for each slice index.
   */
  const byIndex = new Map(decided.map(function toEntry(one,): [
    number,
    string,
  ] {
    return [
      one.chunkIndex,
      one.text,
    ];
  },),);

  /**
   * Indices preparation actually produced, so a decision naming any other one
   * is caught rather than dropped by a lookup that finds nothing.
   */
  const prepared = new Set(slices.map(function toIndex(slice,): number {
    return slice.target
      .chunkIndex;
  },),);

  // Both maps above would swallow a repeat: the last entry would win and the
  // list would still be the right length, so a decision would be silently
  // reused for one slice and lost for another.
  if (prepared.size !== slices.length)
    throw new LaneSliceCoverageError({
      message: `preparation produced ${
        String(slices.length,)
      } slices under ${String(prepared.size,)} distinct indices`,
    },);
  if (byIndex.size !== decided.length)
    throw new LaneSliceCoverageError({
      message: `lane decided ${String(decided.length,)} times over ${
        String(byIndex.size,)
      } distinct slices`,
    },);
  for (const one of decided) {
    if (!prepared.has(one.chunkIndex,))
      throw new LaneSliceCoverageError({
        message: `lane decided slice ${String(one.chunkIndex,)}, which this preparation never produced`,
      },);
  }

  /**
   * Whether some earlier slice in document order went undecided.
   *
   * `not-evaluated` describes ONE shape and no other: a lane that stopped, so
   * an evaluated prefix followed by an unevaluated suffix. Decisions for slices
   * 0 and 2 with 1 unexamined is not that shape, and accepting it would let a
   * dropped slice pass as an early stop.
   */
  const stopped = { already: false, };

  return slices.map(function toWording(slice,): LaneSliceText {
    /**
     * This slice's global index.
     */
    const { chunkIndex, } = slice.target;

    /**
     * Whether the lane decided this slice at all.
     *
     * Asked of the map rather than read off a lookup, because a decision whose
     * text is missing entirely and one that is present are different facts, and
     * a lookup returns the same thing for both.
     */
    const decidedHere = byIndex.has(chunkIndex,);
    if (!decidedHere) {
      if (undecided === 'refuse')
        throw new LaneSliceCoverageError({
          message: `lane left prepared slice ${String(chunkIndex,)} undecided`,
        },);
      stopped.already = true;
      return {
        chunkIndex,
        incumbentText: slice.target
          .text,
      };
    }
    if (stopped.already)
      throw new LaneSliceCoverageError({
        message: `lane decided slice ${
          String(chunkIndex,)
        } after leaving an earlier one unexamined, which no early stop produces`,
      },);

    /**
     * Wording the lane accepted here.
     */
    const acceptedText = byIndex.get(chunkIndex,);
    if ((typeof acceptedText) !== 'string')
      throw new LaneSliceCoverageError({
        message: `lane decided slice ${String(chunkIndex,)} with no wording`,
      },);

    return {
      chunkIndex,
      incumbentText: slice.target
        .text,
      acceptedText,
    };
  },);
}

//endregion Lane slice text
