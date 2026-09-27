import type { ChunkPair, } from '../chunk-document.ts';
import { isInsertionChunk, } from '../chunk-placement.ts';

//region Carried passage neighbours
// WHICH PAIRED SLICES STAND NEXT TO A POSITION. The fold (class one hundred
// ten) looks for the carrier among the paired slices on either side of a
// carried passage; the shift (class one hundred seventy-nine) looks for the
// paired slice on the carrier's far side. Both look past insertions, so a
// carried passage beside another carried passage (mikaela14) still finds the
// paired slice beyond it; the abutting check refuses a fold or a shift across
// a source nobody has absorbed.

/**
 Nearest paired slice on one side of a position, looking past insertions.

 @param slices - prepared slices

 @param position - where the looking starts

 @param step - direction: -1 for earlier, 1 for later

 @returns Position of that slice, none where only insertions lie that way

 @example
 ```ts
 const earlier = pairedNeighbourToward({ slices, position: 3, step: -1, },);
 ```
 */
export function pairedNeighbourToward(
  {
    slices,
    position,
    step,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly position: number;
    readonly step: number;
  },
): readonly number[] {
  /**
   Positions on that side, nearest first.
   */
  const thatWay = slices
    .map(function positionOf(
      _slice,
      index,
    ): number {
      return index;
    },)
    .filter(function onSide(index,): boolean {
      return (step < 0) ? (index < position) : (index > position);
    },)
    .toSorted(function nearestFirst(
      a,
      b,
    ): number {
      return Math.abs(a - position,) - Math.abs(b - position,);
    },);
  /**
   The nearest paired one.
   */
  const nearest = thatWay.find(function isPaired(index,): boolean {
    /**
     Slice at that position.
     */
    const slice = slices[index];
    return (slice !== undefined) && (!isInsertionChunk(slice.target,));
  },);
  return (nearest === undefined) ? [] : [nearest,];
}

/**
 Nearest paired slices on either side of a carried passage, earlier first.
 A carried passage next to another carried passage looks past it: on
 mikaela14 (2026-09-24) slice 12 folded into slice 13 and slice 11, whose
 evidence sat in slice 13's span too, was refused for having a folded
 insertion between; the abutting check still refuses a fold across a source
 the carrier has not absorbed.

 @param slices - prepared slices

 @param position - where the carried slice stands

 @returns The paired neighbours found, earlier first

 @example
 ```ts
 const neighbours = pairedNeighbours({ slices, position: 2, },);
 ```
 */
export function pairedNeighbours(
  {
    slices,
    position,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly position: number;
  },
): readonly number[] {
  return [
    ...pairedNeighbourToward({
      slices,
      position,
      step: -1,
    },),
    ...pairedNeighbourToward({
      slices,
      position,
      step: 1,
    },),
  ];
}

//endregion Carried passage neighbours
