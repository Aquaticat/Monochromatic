import type { ChunkPair, } from './chunk-document.ts';
import { isInsertionChunk, } from './chunk-placement.ts';
import {
  buildLaneSliceTexts,
  type LaneSliceText,
  type UndecidedSlicePolicy,
} from './lane-slice-text.ts';

//region Repair lane wordings
// The repair lane's settled outcomes turned into the shared per-slice wording
// shape, with each slice's outcome named rather than inferred.
//
// The mirror of `translate-lane-wordings.ts`, and it exists for the same reason
// that one does: the translation from a lane's own vocabulary into the shared
// one is not mechanical, and doing it inline let a silence pass as a choice.
//
// Here the silence is structural. This lane mends existing English, so at a
// passage the archive never translated there is nothing for it to work on: it
// logs that, records an outcome carrying the empty string, and moves on. Handed
// straight to the builder, every one of those became `decided` with an empty
// wording, and a lane comparison then reported the two lanes choosing DIFFERENT
// wordings wherever the translate lane filled the passage. The repair lane had
// no opinion there at all.

/**
 * Builds the repair lane's per-slice wordings from its settled outcomes.
 *
 * @param slices - preparation the lane ran over, which supplies every incumbent
 * and says which slices the archive never translated
 *
 * @param outcomes - what the lane settled, anchors included, in any order
 *
 * @param undecided - what an unnamed gap means; `refuse` after assembly, where
 * every slice was visited, and `not-evaluated` at the blocked exit, which stops
 * partway through by design
 *
 * @returns One wording per prepared slice, in document order
 *
 * @throws {@link LaneSliceCoverageError} when the outcomes do not cover the
 * preparation as the policy requires
 *
 * @example
 * ```ts
 * const wordings = repairLaneWordings({ slices, outcomes, undecided: 'refuse', },);
 * ```
 */
export function repairLaneWordings(
  {
    slices,
    outcomes,
    undecided,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly outcomes: readonly {
      readonly chunkIndex: number;
      readonly repairedText: string;
    }[];
    readonly undecided: UndecidedSlicePolicy;
  },
): readonly LaneSliceText[] {
  /**
   * Slices the archive never translated, which this lane cannot work on.
   */
  const anchored = new Set(slices
    .filter(function hasNoWording(slice,): boolean {
      return isInsertionChunk(slice.target,);
    },)
    .map(function toIndex(slice,): number {
      return slice.target
        .chunkIndex;
    },),);

  // INTERSECTED WITH WHAT THE LANE REACHED, rather than taken from the
  // preparation whole. The blocked exit settles a prefix and stops, so an
  // anchor after the crossing was never reached and is `not-evaluated`; naming
  // every anchor here would report the lane as having visited slices it never
  // got to.
  return buildLaneSliceTexts({
    slices,
    undecided,
    notApplicableChunkIndices: outcomes
      .filter(function atAnAnchor(outcome,): boolean {
        return anchored.has(outcome.chunkIndex,);
      },)
      .map(function toIndex(outcome,): number {
        return outcome.chunkIndex;
      },),
    decided: outcomes
      .filter(function hadSomethingToRepair(outcome,): boolean {
        return !anchored.has(outcome.chunkIndex,);
      },)
      .map(function toDecision(outcome,): {
        readonly chunkIndex: number;
        readonly text: string;
      } {
        return {
          chunkIndex: outcome.chunkIndex,
          text: outcome.repairedText,
        };
      },),
  },);
}

//endregion Repair lane wordings
