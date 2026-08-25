/**
 * Tests for which translation blocks a pairing declined.
 *
 * WHY THIS FILE EXISTS. Grouping and the coverage assertion both ask this
 * question, and they must derive the same answer from the same inputs, since a
 * disagreement between them reads as a coverage fault at a place neither one
 * caused. The answer is built by turning the pairing into alignment steps,
 * which needs to be told HOW MANY blocks each side has.
 *
 * WHAT WAS MEASURED. On 2026-08-25, swapping those two counts failed no test
 * in this package. A swap is silent in the common case, because most pairs
 * carry equal counts, and it only shows itself where the two sides differ:
 * exactly the entries the pairing exists for.
 *
 * THE FIXTURE THEREFORE MAKES THEM DIFFER, two originals against three
 * translation blocks. Under the counts as passed, the third translation block
 * is declined; under the swap, the walk stops one block early and reports
 * nothing declined at all, which would hand grouping a block no slice covers
 * while telling the coverage assertion everything was accounted for.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type BlockPair,
  declinedTargetIdsOfPairing,
  parseDocument,
} from '../dist/final/node/index.mjs';

//region Fixtures

/**
 * Original side, two paragraphs.
 */
const SOURCE_PAGE = `Mittens slept on the sill until noon.

Whiskers counted the birds outside.
`;

/**
 * Translation side, three paragraphs, of which the last answers to no original.
 */
const TARGET_PAGE = `Mittens slept on the sill until noon.

Whiskers counted the birds outside.

Her brother brought her a feather.
`;

/**
 * Correspondences the roster returned, leaving the third block unclaimed.
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
         * Blocks the pairing left for no slice to cover.
         */
        const declined = declinedTargetIdsOfPairing({
          pairs: [...PAIRS,],
          sourceNodes: parseDocument({ text: SOURCE_PAGE, },).nodes,
          targetNodes: parseDocument({ text: TARGET_PAGE, },).nodes,
        },);

        expect([...declined,],).toEqual(['block/2',],);
      },
    },),
  ],
},);
