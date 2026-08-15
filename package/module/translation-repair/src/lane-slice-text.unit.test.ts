/**
 * Tests for the per-slice wording both lanes report.
 *
 * This is the join key of every two-lane comparison, so its failure mode is a
 * comparison that reads clean while lining up two different passages. The
 * coverage checks are the whole point: a lane that skipped a slice, or reported
 * one its preparation never produced, must say so rather than produce a shorter
 * list nobody counts.
 *
 * Fixtures are invented. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildLaneSliceTexts,
  LaneSliceCoverageError,
  makeInsertionChunk,
} from '../dist/final/node/index.mjs';

/**
 * Builds one prepared slice pair.
 *
 * @param index - global slice index both sides carry
 *
 * @param source - original text of this slice
 *
 * @param target - archive translation of it
 *
 * @returns Pair shaped as preparation produces
 *
 * @example
 * ```ts
 * const pair = pairOf({ index: 0, source: '猫', target: 'The cat.', },);
 * ```
 */
function pairOf(
  {
    index,
    source,
    target,
  }: {
    readonly index: number;
    readonly source: string;
    readonly target: string;
  },
): {
  readonly source: {
    readonly chunkIndex: number;
    readonly nodes: readonly never[];
    readonly startOffset: number;
    readonly endOffset: number;
    readonly text: string;
  };
  readonly target: {
    readonly chunkIndex: number;
    readonly nodes: readonly never[];
    readonly startOffset: number;
    readonly endOffset: number;
    readonly text: string;
  };
} {
  return {
    source: {
      chunkIndex: index,
      nodes: [],
      startOffset: 0,
      endOffset: source.length,
      text: source,
    },
    target: {
      chunkIndex: index,
      nodes: [],
      startOffset: 0,
      endOffset: target.length,
      text: target,
    },
  };
}

/**
 * Two prepared slices about a cat.
 */
const CAT_SLICES = [
  pairOf({
    index: 0,
    source: 'source of the nap',
    target: 'The cat sleeps on the sill.',
  },),
  pairOf({
    index: 1,
    source: 'source of the bowl',
    target: 'The bowl is full.',
  },),
];

/**
 * The same pair with the second slice a place rather than existing text, which
 * is the only kind of slice a lane may report as unfilled.
 */
const ANCHORED_SLICES = [
  CAT_SLICES[0] ?? pairOf({
    index: 0,
    source: 'source of the nap',
    target: 'The cat sleeps on the sill.',
  },),
  {
    source: {
      chunkIndex: 1,
      nodes: [],
      startOffset: 0,
      endOffset: 0,
      text: 'source of the bowl',
    },
    target: makeInsertionChunk({
      chunkIndex: 1,
      offset: 0,
    },),
  },
];

await describe({
  name: buildLaneSliceTexts.name,
  children: [
    it({
      name:
        'pairs every prepared slice with the archive wording it was judged against, '
        + 'including a slice the lane left alone, because a rate needs its denominator '
        + 'and leaving a slice alone is a decision rather than an absence',
      fn: async () => {
        /**
         * Wordings for a lane that changed the first slice only.
         */
        const wordings = buildLaneSliceTexts({
          slices: CAT_SLICES,
          undecided: 'refuse',
          decided: [
            { chunkIndex: 0, text: 'The cat is asleep on the windowsill.', },
            { chunkIndex: 1, text: 'The bowl is full.', },
          ],
        },);
        expect(wordings,).toHaveLength(2,);
        expect(wordings[0]?.incumbentText,).toBe('The cat sleeps on the sill.',);
        expect(wordings[0]?.acceptedText,).toBe('The cat is asleep on the windowsill.',);

        // The untouched slice is still reported, and its accepted wording is the
        // archive's own rather than an empty string standing for "nothing".
        expect(wordings[1]?.acceptedText,).toBe('The bowl is full.',);
        expect(wordings[1]?.incumbentText,).toBe('The bowl is full.',);
      },
    },),
    it({
      name:
        'keeps document order and the global index, which is what a comparison joins two lanes on, '
        + 'rather than the position within this list',
      fn: async () => {
        /**
         * Wordings built from decisions given out of order.
         */
        const wordings = buildLaneSliceTexts({
          slices: CAT_SLICES,
          undecided: 'refuse',
          decided: [
            { chunkIndex: 1, text: 'The bowl is full.', },
            { chunkIndex: 0, text: 'The cat sleeps on the sill.', },
          ],
        },);
        expect(wordings.map(function toIndex(one,): number {
          return one.chunkIndex;
        },),).toEqual([0, 1,],);
      },
    },),
    it({
      name:
        'REFUSES a lane that left a prepared slice undecided, because the alternative is a shorter list '
        + 'that every later count silently reads as a smaller document',
      fn: async () => {
        /**
         * Failure the builder raised.
         */
        let caught: unknown;
        try {
          buildLaneSliceTexts({
            slices: CAT_SLICES,
            undecided: 'refuse',
            decided: [{ chunkIndex: 0, text: 'The cat is asleep.', },],
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(LaneSliceCoverageError,);
        expect(String(caught,),).toContain('1',);
      },
    },),
    it({
      name:
        'REFUSES a decision naming a slice this preparation never produced, which is how two different '
        + 'preparations of one entry would otherwise be joined without anything noticing',
      fn: async () => {
        /**
         * Failure the builder raised.
         */
        let caught: unknown;
        try {
          buildLaneSliceTexts({
            slices: CAT_SLICES,
            undecided: 'refuse',
            decided: [
              { chunkIndex: 0, text: 'The cat is asleep.', },
              { chunkIndex: 1, text: 'The bowl is full.', },
              { chunkIndex: 7, text: 'A slice from another slicing entirely.', },
            ],
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(LaneSliceCoverageError,);
        expect(String(caught,),).toContain('7',);
      },
    },),
    it({
      name:
        'records a slice the lane never reached as UNEXAMINED rather than as agreeing with the archive, '
        + 'which is what the repair lane`s whole-document block needs: it returns from inside the slice loop, '
        + 'so the slices after the crossing were never looked at and reporting the archive wording as their '
        + 'decision would state a choice nobody took',
      fn: async () => {
        /**
         * Wordings for a lane that stopped after the first slice.
         */
        const wordings = buildLaneSliceTexts({
          slices: CAT_SLICES,
          undecided: 'not-evaluated',
          decided: [{ chunkIndex: 0, text: 'The cat is asleep on the windowsill.', },],
        },);
        expect(wordings,).toHaveLength(2,);
        expect(wordings[0]?.acceptedText,).toBe('The cat is asleep on the windowsill.',);
        expect(wordings[1]?.acceptedText,).toBe(undefined,);
        // ABSENT rather than present-and-undefined, which is a different value
        // under exactOptionalPropertyTypes and the only one that survives a
        // round trip through the cache as "nobody looked".
        expect(Object.hasOwn(
          wordings[1] ?? {},
          'acceptedText',
        ),).toBe(false,);

        // The archive wording is still reported for the unexamined slice, since
        // that is what the returned document carries there.
        expect(wordings[1]?.incumbentText,).toBe('The bowl is full.',);
      },
    },),
    it({
      name:
        'REFUSES a decision that comes AFTER an unexamined slice, since `not-evaluated` describes '
        + 'one shape and no other: a lane that stopped, so an evaluated prefix and an unevaluated '
        + 'suffix. Decisions for slices 0 and 2 with 1 unexamined is a slice that was DROPPED, and '
        + 'accepting it would let that pass as an early stop',
      fn: async () => {
        /**
         * Failure the builder raised.
         */
        let caught: unknown;
        try {
          buildLaneSliceTexts({
            slices: CAT_SLICES,
            undecided: 'not-evaluated',
            decided: [{ chunkIndex: 1, text: 'The bowl is empty.', },],
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(LaneSliceCoverageError,);
        expect(String(caught,),).toContain('after leaving an earlier one unexamined',);
      },
    },),
    it({
      name:
        'still REFUSES a decision naming an unknown slice under the not-evaluated policy, because that policy '
        + 'forgives a lane that stopped early and not one that describes another slicing',
      fn: async () => {
        /**
         * Failure the builder raised.
         */
        let caught: unknown;
        try {
          buildLaneSliceTexts({
            slices: CAT_SLICES,
            undecided: 'not-evaluated',
            decided: [{ chunkIndex: 9, text: 'A slice from another slicing entirely.', },],
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(LaneSliceCoverageError,);
        expect(String(caught,),).toContain('9',);
      },
    },),
    it({
      name:
        'accepts a NAMED unfilled slice under `refuse` and still refuses every other gap, which is the '
        + 'difference between a lane that examined a passage and could not fill it and a lane that lost '
        + 'one: the first can say which slices, the second cannot',
      fn: async () => {
        /**
         * Wordings where the lane decided the first slice and could not fill
         * the second.
         */
        const wordings = buildLaneSliceTexts({
          slices: ANCHORED_SLICES,
          undecided: 'refuse',
          decided: [{ chunkIndex: 0, text: 'The cat naps on the sill.', },],
          unfilledChunkIndices: [1,],
        },);
        expect(wordings,).toHaveLength(2,);
        expect(wordings[1]?.acceptedText,).toBe(undefined,);
        expect(wordings[1]?.incumbentText,).toBe('',);

        /**
         * Failure the same gap raises when nothing names it.
         */
        let caught: unknown;
        try {
          buildLaneSliceTexts({
            slices: ANCHORED_SLICES,
            undecided: 'refuse',
            decided: [{ chunkIndex: 0, text: 'The cat naps on the sill.', },],
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(LaneSliceCoverageError,);
      },
    },),
    it({
      name:
        'REFUSES a slice reported as unfilled AND decided, since what the lane accepted there would be '
        + 'unstated, and refuses one this preparation never produced, the same way it refuses a '
        + 'decision naming a foreign slice',
      fn: async () => {
        /**
         * Failure raised by a slice claimed twice.
         */
        let both: unknown;
        try {
          buildLaneSliceTexts({
            slices: ANCHORED_SLICES,
            undecided: 'refuse',
            decided: [
              { chunkIndex: 0, text: 'The cat naps on the sill.', },
              { chunkIndex: 1, text: '', },
            ],
            unfilledChunkIndices: [1,],
          },);
        }
        catch (error) {
          both = error;
        }
        expect(both,).toBeInstanceOf(LaneSliceCoverageError,);

        /**
         * Failure raised by an unfilled index from another slicing.
         */
        let foreign: unknown;
        try {
          buildLaneSliceTexts({
            slices: ANCHORED_SLICES,
            undecided: 'refuse',
            decided: [
              { chunkIndex: 0, text: 'The cat naps on the sill.', },
              { chunkIndex: 1, text: '', },
            ],
            unfilledChunkIndices: [7,],
          },);
        }
        catch (error) {
          foreign = error;
        }
        expect(foreign,).toBeInstanceOf(LaneSliceCoverageError,);
        expect(String(foreign,),).toContain('7',);
      },
    },),
  ],
},);
