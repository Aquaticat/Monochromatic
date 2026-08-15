/**
 * Tests for the two checks both lanes run around assembly.
 *
 * Both exist because a slice CACHE is trusted on its index alone. A record
 * claiming a change while carrying the archive's own wording survives the
 * footnote guard untouched and lands in the shipped index set beside a document
 * nobody changed, which every later rate then reads as a repair that happened.
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
  assertDocumentChangeAgrees,
  assertReplacementsChange,
  AssemblyContractError,
  orderedChangeSets,
} from '../dist/final/node/index.mjs';

/**
 * Archive wording of the one slice these cases use.
 */
const ARCHIVE_NAP = 'The cat sleeps on the sill.';

/**
 * One prepared slice pair carrying that wording.
 */
const CAT_SLICES = [{
  source: {
    chunkIndex: 0,
    nodes: [],
    startOffset: 0,
    endOffset: 3,
    text: 'source of the nap',
  },
  target: {
    chunkIndex: 0,
    nodes: [],
    startOffset: 0,
    endOffset: ARCHIVE_NAP.length,
    text: ARCHIVE_NAP,
  },
},];

await describe({
  name: assertReplacementsChange.name,
  children: [
    it({
      name: 'passes a replacement that actually differs from the archive wording',
      fn: async () => {
        /**
         * Failure the check raised, if any.
         */
        let caught: unknown;
        try {
          assertReplacementsChange({
            slices: CAT_SLICES,
            replacements: [{ chunkIndex: 0, replacementText: 'A cat dozes in the window.', },],
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBe(undefined,);
      },
    },),
    it({
      name:
        'REFUSES a replacement that repeats its incumbent verbatim, which a truncated or stale cache file '
        + 'produces and which would otherwise be counted as a slice this lane changed while changing no byte',
      fn: async () => {
        /**
         * Failure the check raised.
         */
        let caught: unknown;
        try {
          assertReplacementsChange({
            slices: CAT_SLICES,
            replacements: [{ chunkIndex: 0, replacementText: ARCHIVE_NAP, },],
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(AssemblyContractError,);
        expect(String(caught,),).toContain('archive wording',);
      },
    },),
    it({
      name: 'REFUSES a replacement naming a slice this preparation never produced',
      fn: async () => {
        /**
         * Failure the check raised.
         */
        let caught: unknown;
        try {
          assertReplacementsChange({
            slices: CAT_SLICES,
            replacements: [{ chunkIndex: 5, replacementText: 'A cat dozes in the window.', },],
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(AssemblyContractError,);
      },
    },),
  ],
},);

await describe({
  name: assertDocumentChangeAgrees.name,
  children: [
    it({
      name:
        'accepts both agreeing states: a document that moved and names a changed slice, '
        + 'and one that did not move and names none',
      fn: async () => {
        /**
         * Failure either agreeing state raised, if any.
         */
        let caught: unknown;
        try {
          assertDocumentChangeAgrees({
            incumbentText: ARCHIVE_NAP,
            assembledText: 'A cat dozes in the window.',
            shippedChunkIndices: [0,],
          },);
          assertDocumentChangeAgrees({
            incumbentText: ARCHIVE_NAP,
            assembledText: ARCHIVE_NAP,
            shippedChunkIndices: [],
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBe(undefined,);
      },
    },),
    it({
      name:
        'ACCEPTS a document identical to the archive while slices are named as changed, because two adjacent '
        + 'replacements can each differ from their own incumbent and concatenate back to the archive text, '
        + 'say by moving a line break across the join: refusing that would crash a run the models got right, '
        + 'and the defect it would catch is already refused per slice',
      fn: async () => {
        /**
         * Failure the net-no-op case raised, if any.
         */
        let caught: unknown;
        try {
          assertDocumentChangeAgrees({
            incumbentText: ARCHIVE_NAP,
            assembledText: ARCHIVE_NAP,
            shippedChunkIndices: [0,],
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBe(undefined,);
      },
    },),
    it({
      name:
        'REFUSES a document that moved while no slice is named, which is the same contradiction from the other '
        + 'side and would hide a rewrite from every per-slice reader',
      fn: async () => {
        /**
         * Failure the check raised.
         */
        let caught: unknown;
        try {
          assertDocumentChangeAgrees({
            incumbentText: ARCHIVE_NAP,
            assembledText: 'A cat dozes in the window.',
            shippedChunkIndices: [],
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(AssemblyContractError,);
        expect(String(caught,),).toContain('no slice',);
      },
    },),
  ],
},);

/**
 * Runs one change-set case and returns whatever it raised.
 *
 * @param sliceCount - prepared slices bounding both sets
 *
 * @param shipped - slices said to carry a change
 *
 * @param withdrawn - slices said to have had one taken back
 *
 * @returns Failure raised, or undefined when the case was accepted
 *
 * @example
 * ```ts
 * const caught = changeSetFailure({ sliceCount: 2, shipped: [0,], withdrawn: [0,], },);
 * ```
 */
function changeSetFailure(
  {
    sliceCount,
    shipped,
    withdrawn,
  }: {
    readonly sliceCount: number;
    readonly shipped: readonly number[];
    readonly withdrawn: readonly number[];
  },
): unknown {
  try {
    orderedChangeSets({
      sliceCount,
      shipped,
      withdrawn,
    },);
  }
  catch (error) {
    return error;
  }
  return undefined;
}

await describe({
  name: orderedChangeSets.name,
  children: [
    it({
      name:
        'puts BOTH sets in document order, which the withdrawn one never was: the guard returns it in the order '
        + 'it took slices back, so two lanes compared slice by slice were being read from lists ordered by '
        + 'different rules',
      fn: async () => {
        /**
         * Sets given in the order a guard would produce them.
         */
        const ordered = orderedChangeSets({
          sliceCount: 6,
          shipped: [4, 0, 2,],
          withdrawn: [5, 1,],
        },);
        expect(ordered.shipped,).toEqual([0, 2, 4,],);
        expect(ordered.withdrawn,).toEqual([1, 5,],);
      },
    },),
    it({
      name: 'REFUSES an index outside the prepared slices, in either direction',
      fn: async () => {
        expect(changeSetFailure({
          sliceCount: 2,
          shipped: [2,],
          withdrawn: [],
        },),).toBeInstanceOf(AssemblyContractError,);
        expect(changeSetFailure({
          sliceCount: 2,
          shipped: [],
          withdrawn: [-1,],
        },),).toBeInstanceOf(AssemblyContractError,);
      },
    },),
    it({
      name: 'REFUSES an index that is not a whole number, which no slice can be',
      fn: async () => {
        expect(changeSetFailure({
          sliceCount: 4,
          shipped: [1.5,],
          withdrawn: [],
        },),).toBeInstanceOf(AssemblyContractError,);
      },
    },),
    it({
      name: 'REFUSES a repeat within either set, which would double-count one slice in every rate built on it',
      fn: async () => {
        expect(changeSetFailure({
          sliceCount: 4,
          shipped: [1, 1,],
          withdrawn: [],
        },),).toBeInstanceOf(AssemblyContractError,);
        expect(changeSetFailure({
          sliceCount: 4,
          shipped: [],
          withdrawn: [2, 2,],
        },),).toBeInstanceOf(AssemblyContractError,);
      },
    },),
    it({
      name:
        'REFUSES a slice named as both shipped and withdrawn, which both lane contracts call impossible '
        + 'by construction and neither checked',
      fn: async () => {
        /**
         * Failure the overlap raised.
         */
        const caught = changeSetFailure({
          sliceCount: 4,
          shipped: [1, 3,],
          withdrawn: [3,],
        },);
        expect(caught,).toBeInstanceOf(AssemblyContractError,);
        expect(String(caught,),).toContain('both shipped and withdrawn',);
      },
    },),
  ],
},);
