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
        'REFUSES a document identical to the archive while slices are named as changed, which is the shape '
        + 'a no-op replacement produces after it survives the footnote guard',
      fn: async () => {
        /**
         * Failure the check raised.
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
        expect(caught,).toBeInstanceOf(AssemblyContractError,);
        expect(String(caught,),).toContain('equals the archive',);
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
