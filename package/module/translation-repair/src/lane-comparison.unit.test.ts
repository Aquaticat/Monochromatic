/**
 * Tests for the slice-by-slice comparison of the two lanes.
 *
 * The comparison exists to answer one question, whether repair and translate
 * produce the same English where both touch a slice, and it has one hard
 * requirement: it must read what each DOCUMENT carries rather than what each
 * lane chose. A slice whose replacement the assembly guard withdrew chose one
 * thing and shipped another, and a comparison that read the choice would report
 * a rewrite no reader ever saw.
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
  compareDocumentLanes,
  LaneComparisonError,
} from '../dist/final/node/index.mjs';

/**
 * Archive wording of the one slice most cases here use.
 */
const ARCHIVE_NAP = 'The cat sleeps on the sill.';

/**
 * Builds one lane's side of a comparison over a single slice.
 *
 * @param acceptedText - wording that lane decided on
 *
 * @param shipped - whether the returned document carries it
 *
 * @returns Lane side shaped as a lane result carries it
 *
 * @example
 * ```ts
 * const lane = laneOf({ acceptedText: 'The cat naps.', shipped: true, },);
 * ```
 */
function laneOf(
  {
    acceptedText,
    shipped,
  }: {
    readonly acceptedText: string;
    readonly shipped: boolean;
  },
): {
  readonly sliceTexts: readonly {
    readonly chunkIndex: number;
    readonly incumbentText: string;
    readonly acceptedText: string;
  }[];
  readonly shippedChunkIndices: readonly number[];
} {
  return {
    sliceTexts: [{
      chunkIndex: 0,
      incumbentText: ARCHIVE_NAP,
      acceptedText,
    },],
    shippedChunkIndices: shipped ? [0,] : [],
  };
}

await describe({
  name: compareDocumentLanes.name,
  children: [
    it({
      name:
        'names the four ways two documents can differ on a slice: neither moved, one moved, '
        + 'both moved to the same wording, and both moved apart, which is the only one a human has to read',
      fn: async () => {
        /**
         * Both lanes left the archive wording standing.
         */
        const kept = compareDocumentLanes({
          repair: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
          translate: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
        },);
        expect(kept[0]?.verdict,).toBe('archive-stands',);

        /**
         * Only repair changed the slice.
         */
        const repairOnly = compareDocumentLanes({
          repair: laneOf({ acceptedText: 'The cat is asleep on the windowsill.', shipped: true, },),
          translate: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
        },);
        expect(repairOnly[0]?.verdict,).toBe('repair-only',);

        /**
         * Only translate changed it.
         */
        const translateOnly = compareDocumentLanes({
          repair: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
          translate: laneOf({ acceptedText: 'A cat dozes in the window.', shipped: true, },),
        },);
        expect(translateOnly[0]?.verdict,).toBe('translate-only',);

        /**
         * Both changed it the same way, character for character.
         */
        const agreed = compareDocumentLanes({
          repair: laneOf({ acceptedText: 'A cat dozes in the window.', shipped: true, },),
          translate: laneOf({ acceptedText: 'A cat dozes in the window.', shipped: true, },),
        },);
        expect(agreed[0]?.verdict,).toBe('both-agree',);

        /**
         * Both changed it, differently.
         */
        const apart = compareDocumentLanes({
          repair: laneOf({ acceptedText: 'The cat is asleep on the windowsill.', shipped: true, },),
          translate: laneOf({ acceptedText: 'A cat dozes in the window.', shipped: true, },),
        },);
        expect(apart[0]?.verdict,).toBe('both-differ',);
        expect(apart[0]?.repairText,).toBe('The cat is asleep on the windowsill.',);
        expect(apart[0]?.translateText,).toBe('A cat dozes in the window.',);
      },
    },),
    it({
      name:
        'reads what the DOCUMENT carries rather than what the lane chose: a slice whose replacement '
        + 'the assembly guard withdrew compares as the archive wording, even though its record names a rewrite, '
        + 'because reporting the rewrite would credit a lane with English no reader ever saw',
      fn: async () => {
        /**
         * Repair chose a rewrite the guard took back; translate shipped one.
         */
        const rows = compareDocumentLanes({
          repair: laneOf({ acceptedText: 'The cat is asleep on the windowsill.', shipped: false, },),
          translate: laneOf({ acceptedText: 'A cat dozes in the window.', shipped: true, },),
        },);
        expect(rows[0]?.verdict,).toBe('translate-only',);

        // The withdrawn wording is nowhere in the row: what repair CARRIES is
        // the archive text, and that is the only repair-side text a comparison
        // may state.
        expect(rows[0]?.repairText,).toBe(ARCHIVE_NAP,);
      },
    },),
    it({
      name:
        'REFUSES two results whose slice counts differ, since a shorter list means the lanes ran over '
        + 'different preparations and every row after the first gap compares two different passages',
      fn: async () => {
        /**
         * Failure the comparison raised.
         */
        let caught: unknown;
        try {
          compareDocumentLanes({
            repair: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
            translate: {
              sliceTexts: [],
              shippedChunkIndices: [],
            },
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(LaneComparisonError,);
      },
    },),
    it({
      name:
        'REFUSES two results that disagree about a slice`s archive wording, which is the same defect '
        + 'arriving with matching counts and is otherwise undetectable downstream',
      fn: async () => {
        /**
         * Failure the comparison raised.
         */
        let caught: unknown;
        try {
          compareDocumentLanes({
            repair: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
            translate: {
              sliceTexts: [{
                chunkIndex: 0,
                incumbentText: 'A different archive sentence entirely.',
                acceptedText: 'A cat dozes in the window.',
              },],
              shippedChunkIndices: [0,],
            },
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(LaneComparisonError,);
      },
    },),
    it({
      name:
        'separates a lane that LOOKED and kept the archive wording from one that never reached the slice, '
        + 'which the repair lane`s whole-document block produces: both documents carry the archive text either way, '
        + 'and only one of them means anybody examined it',
      fn: async () => {
        /**
         * Repair stopped before this slice; translate looked and kept it.
         */
        const rows = compareDocumentLanes({
          repair: {
            sliceTexts: [{
              chunkIndex: 0,
              incumbentText: ARCHIVE_NAP,
              acceptedText: null,
            },],
            shippedChunkIndices: [],
          },
          translate: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
        },);
        expect(rows[0]?.verdict,).toBe('archive-stands',);
        expect(rows[0]?.repairEvaluated,).toBe(false,);
        expect(rows[0]?.translateEvaluated,).toBe(true,);
        expect(rows[0]?.repairText,).toBe(ARCHIVE_NAP,);
      },
    },),
    it({
      name: 'REFUSES a slice the other lane does not report at all, even when both lists are the same length',
      fn: async () => {
        /**
         * Failure the comparison raised.
         */
        let caught: unknown;
        try {
          compareDocumentLanes({
            repair: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
            translate: {
              sliceTexts: [{
                chunkIndex: 4,
                incumbentText: ARCHIVE_NAP,
                acceptedText: ARCHIVE_NAP,
              },],
              shippedChunkIndices: [],
            },
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(LaneComparisonError,);
      },
    },),
  ],
},);
