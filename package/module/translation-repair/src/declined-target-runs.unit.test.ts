/**
 Tests for which translation blocks a pairing declined.

 WHY THIS FILE EXISTS. Grouping and the coverage assertion both ask this
 question, and they must derive the same answer from the same inputs, since a
 disagreement between them reads as a coverage fault at a place neither one
 caused. The answer is built by turning the pairing into alignment steps,
 which needs to be told HOW MANY blocks each side has.

 WHAT WAS MEASURED. On 2026-08-25, swapping those two counts failed no test
 in this package. A swap is silent in the common case, because most pairs
 carry equal counts, and it only shows itself where the two sides differ:
 exactly the entries the pairing exists for.

 THE FIXTURE THEREFORE MAKES THEM DIFFER, two originals against three
 translation blocks. Under the counts as passed, the third translation block
 is declined; under the swap, the walk stops one block early and reports
 nothing declined at all, which would hand grouping a block no slice covers
 while telling the coverage assertion everything was accounted for.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type BlockPair,
  declinedTargetBlocks,
  declinedTargetIdsOfPairing,
  parseDocument,
} from '../dist/final/node/index.mjs';

//region Fixtures

/**
 Original side, two paragraphs.
 */
const SOURCE_PAGE = `Mittens slept on the sill until noon.

Whiskers counted the birds outside.
`;

/**
 Translation side, three paragraphs, of which the last answers to no original.
 */
const TARGET_PAGE = `Mittens slept on the sill until noon.

Whiskers counted the birds outside.

Her brother brought her a feather.
`;

/**
 Correspondences the roster returned, leaving the third block unclaimed.
 */
const PAIRS = [
  {
    source: 0,
    target: 0,
  },
  {
    source: 1,
    target: 1,
  },
] as const satisfies readonly BlockPair[];

//endregion Fixtures

await describe({
  name: declinedTargetIdsOfPairing.name,
  children: [
    it({
      name: 'NAMES the translation block no original claimed, reading each side by its own count, so a '
        + 'page with more blocks than its original does not report everything accounted for',
      fn: async () => {
        /**
         Blocks the pairing left for no slice to cover.
         */
        const declined = declinedTargetIdsOfPairing({
          pairs: [...PAIRS,],
          sourceNodes: parseDocument({ text: SOURCE_PAGE, },).nodes,
          targetNodes: parseDocument({ text: TARGET_PAGE, },).nodes,
        },);

        expect([...declined,],).toEqual(['block/2',],);
      },
    },),

    it({
      name: 'DECLINES NOTHING where the pairing placed nothing at all, so an empty pass reports no block '
        + 'left behind',
      fn: async () => {
        expect([...declinedTargetIdsOfPairing({
          pairs: [],
          sourceNodes: parseDocument({ text: SOURCE_PAGE, },).nodes,
          targetNodes: parseDocument({ text: TARGET_PAGE, },).nodes,
        },),],).toEqual([],);
      },
    },),

    it({
      name: 'DECLINES NOTHING where the source side holds no block at all, so no pairing exists to leave a '
        + 'block unclaimed',
      fn: async () => {
        expect([...declinedTargetIdsOfPairing({
          pairs: [],
          sourceNodes: [],
          targetNodes: parseDocument({ text: 'A cat naps on the mat.', },).nodes,
        },),],).toEqual([],);
      },
    },),

    it({
      name: 'KEEPS a target-only block out of the declined list where a later step continues a pairing, '
        + 'the block sitting inside the rendering the two make',
      fn: async () => {
        const { nodes, } = parseDocument({ text: 'A cat naps.\n\nA dog waits.\n\nA bird sings.', },);
        /**
         Steps where one block is plain target-only and the next continues a
         pairing, so the plain one sits inside the rendering; and the same
         list without the continuation.
         */
        const inside = declinedTargetBlocks({
          steps: [{
            kind: 'paired',
            sourceIndex: 0,
            targetIndex: 0,
          }, {
            kind: 'target-only',
            targetIndex: 1,
          }, {
            kind: 'target-only',
            targetIndex: 2,
            continuesPairing: true,
          },] as unknown as Parameters<typeof declinedTargetBlocks>[0]['steps'],
          targetNodes: nodes,
        },);
        expect(inside,).toEqual([],);

        const alone = declinedTargetBlocks({
          steps: [{
            kind: 'paired',
            sourceIndex: 0,
            targetIndex: 0,
          }, {
            kind: 'target-only',
            targetIndex: 1,
          },] as unknown as Parameters<typeof declinedTargetBlocks>[0]['steps'],
          targetNodes: nodes,
        },);
        expect(alone.length,).toBe(1,);
      },
    },),

    it({
      name: 'SKIPS a source-only step in the claiming walk, since it names no block of the translation',
      fn: async () => {
        const { nodes, } = parseDocument({ text: 'A cat naps.', },);
        const declined = declinedTargetBlocks({
          steps: [{
            kind: 'paired',
            sourceIndex: 0,
            targetIndex: 0,
          }, {
            kind: 'source-only',
            sourceIndex: 1,
            continuesPairing: true,
          },] as unknown as Parameters<typeof declinedTargetBlocks>[0]['steps'],
          targetNodes: nodes,
        },);
        expect(declined,).toEqual([],);
      },
    },),
  ],
},);
