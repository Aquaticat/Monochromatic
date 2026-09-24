import type { ChunkPair, } from '../chunk-document.ts';
import { isInsertionChunk, } from '../chunk-placement.ts';
import type { CarriedInsertion, } from '../insertion-admission.ts';
import type { AnchorTarget, } from '../validate-issue.ts';
import {
  abutting,
  type AnchorHolder,
  anchorRegion,
} from './insertion-carried-anchor.ts';

//region Carried insertion fold decision
// WHICH NEIGHBOUR CARRIES A PASSAGE. The rule is in the fold's own region
// comment (insertion-carried-fold.ts): every evidence block placed in a
// paired slice next to the carried one, the carrier the neighbour holding the
// larger share of the quoted text (the earlier on a tie), the two sources
// abutting across blank space alone. Every stand-aside names its reason.

/**
 One carried passage's fold decision.
 */
export type FoldDecision =
  | {
    readonly kind: 'fold';
    readonly carrierPosition: number;
  }
  | {
    readonly kind: 'aside';

    /**
     Why the passage stays carried.
     */
    readonly reason: string;
  };

/**
 The neighbour holding the larger share of the anchored text, the earlier on
 a tie.

 @param holders - every block's holder with its share

 @param neighbours - positions next to the carried slice, earlier first

 @returns Position of the carrier

 @example
 ```ts
 const carrier = carrierAmong({ holders, neighbours: [1, 3,], },);
 ```
 */
function carrierAmong(
  {
    holders,
    neighbours,
  }: {
    readonly holders: readonly AnchorHolder[];
    readonly neighbours: readonly number[];
  },
): number {
  /**
   Each neighbour's share of the quoted text.
   */
  const shares = neighbours.map(function shareOf(position,): AnchorHolder {
    return {
      position,
      codePoints: holders
        .filter(function held(holder,): boolean {
          return holder.position === position;
        },)
        .reduce(function sum(
          total,
          holder,
        ): number {
          return total + holder.codePoints;
        },
        0,
        ),
    };
  },);
  /**
   The largest share, the earlier neighbour kept on a tie.
   */
  const largest = shares.reduce(function larger(
    best,
    next,
  ): AnchorHolder {
    return (next.codePoints > best.codePoints) ? next : best;
  },);
  return largest.position;
}

/**
 Decides whether one carried passage folds into a neighbour.

 @param slices - prepared slices as they stand

 @param sourceText - whole original

 @param target - archive parsed for anchoring

 @param candidate - carried passage under decision

 @returns Fold into the carrier, or standing aside with the reason

 @example
 ```ts
 const decision = decideFold({ slices, sourceText, target, candidate, },);
 ```
 */
export function decideFold(
  {
    slices,
    sourceText,
    target,
    candidate,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly sourceText: string;
    readonly target: AnchorTarget;
    readonly candidate: CarriedInsertion;
  },
): FoldDecision {
  /**
   Distinct regions the voices anchored.
   */
  const regions = [...new Set(candidate.evidence,),];
  if (regions.length === 0) {
    return {
      kind: 'aside',
      reason: 'no evidence region',
    };
  }
  /**
   Where each region sits, block by block.
   */
  const anchorings = regions.map(function anchorOne(region,) {
    return anchorRegion({
      slices,
      target,
      region,
    },);
  },);
  /**
   The first region the anchoring could not place, if any.
   */
  const unplaced = anchorings.find(function isUnplaced(anchoring,): boolean {
    return !anchoring.anchored;
  },);
  if ((unplaced !== undefined) && (!unplaced.anchored)) {
    return {
      kind: 'aside',
      reason: `evidence ${unplaced.reason}`,
    };
  }
  /**
   Every block's holder across every region.
   */
  const holders = anchorings.flatMap(function holdersOf(anchoring,): readonly AnchorHolder[] {
    return anchoring.anchored ? anchoring.holders : [];
  },);
  /**
   Positions next to the carried slice, earlier first.
   */
  const neighbours = [
    candidate.position - 1,
    candidate.position + 1,
  ];
  /**
   A block held by a slice that is not a neighbour, if any.
   */
  const stray = holders.find(function isStray(holder,): boolean {
    return !neighbours.includes(holder.position,);
  },);
  if (stray !== undefined) {
    return {
      kind: 'aside',
      reason: `evidence sits in slice at position ${String(stray.position,)}, not a neighbour`,
    };
  }
  /**
   The neighbour holding most of the evidence.
   */
  const carrierPosition = carrierAmong({
    holders,
    neighbours,
  },);
  /**
   The carried slice as prepared.
   */
  const carriedSlice = slices[candidate.position];
  /**
   The carrier as prepared.
   */
  const carrier = slices[carrierPosition];
  if ((carriedSlice === undefined) || (carrier === undefined)) {
    return {
      kind: 'aside',
      reason: 'carrier or carried slice missing from the slicing',
    };
  }
  /**
   Stable index the carried slice reports under.
   */
  const carriedSliceIndex = carriedSlice.target
    .sliceIndex;
  if ((!isInsertionChunk(carriedSlice.target,)) || (carriedSliceIndex !== candidate.sliceIndex)) {
    return {
      kind: 'aside',
      reason: 'the carried position is not the recorded insertion',
    };
  }
  /**
   Whether the two sources abut across blank space alone, in either order.
   */
  const touching = (carrierPosition < candidate.position)
    ? abutting({
      sourceText,
      first: carrier.source,
      second: carriedSlice.source,
    },)
    : abutting({
      sourceText,
      first: carriedSlice.source,
      second: carrier.source,
    },);
  /**
   Stable index the carrier reports under.
   */
  const carrierIndex = carrier.target
    .sliceIndex;
  if (!touching) {
    return {
      kind: 'aside',
      reason: `the original writes more than blank space between the carried source and slice ${String(carrierIndex,)}`,
    };
  }
  return {
    kind: 'fold',
    carrierPosition,
  };
}

//endregion Carried insertion fold decision
