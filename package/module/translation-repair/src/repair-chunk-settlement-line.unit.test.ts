/**
 * Tests for the line an operator watches a repair run by.
 *
 * WHAT THESE PIN is that the summary cannot drift from the settlement it
 * summarises. Every number in the line is a count of something the verdict
 * decided, and they arrive as four separate arguments in one sentence, so a
 * transposition renders perfectly and reads as an ordinary run. The subject's
 * own note says what that costs: a run reads as healthy while shipping
 * something else.
 *
 * The line is emitted at `info` and never returned, so nothing downstream can
 * catch a wrong one; this file is where it is read.
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

import { describeChunkSettlement, } from '../dist/final/node/index.mjs';

/**
 * Slice these lines report.
 *
 * Not zero, so a line that lost the index reads differently from one that kept
 * it.
 */
const SLICE_INDEX = 7;

/**
 * Four counts, each distinct, so any pair swapped in the template changes the
 * line. Equal counts would render the same either way round.
 */
const COUNTS = {
  resolvedCount: 1,
  creditableCount: 2,
  acceptedCount: 3,
  unenvelopedCount: 4,
} as const;

await describe({
  name: describeChunkSettlement.name,
  children: [
    it({
      name:
        'PLACES ALL FOUR COUNTS where the sentence says they are, which is what stops a summary '
        + 'drifting from the settlement it summarises: served-and-resolved reads as a fraction, and '
        + 'accepted and unenveloped ride in the parenthesis, so a transposed pair still renders',
      fn: async () => {
        expect(describeChunkSettlement({
          sliceIndex: SLICE_INDEX,
          changed: true,
          ...COUNTS,
        },),).toBe(
          'chunk 7: repaired, 1/2 served accepted issues resolved (3 accepted, 4 unenveloped)',
        );
      },
    },),
    it({
      name:
        'SAYS UNCHANGED where the wording that ships is the archive`s own, since the counts either '
        + 'side of that word can be identical in both cases: a slice whose accepted issues were all '
        + 'resolved by an envelope that wrote no byte reads exactly like one that was rewritten',
      fn: async () => {
        expect(describeChunkSettlement({
          sliceIndex: SLICE_INDEX,
          changed: false,
          ...COUNTS,
        },),).toBe(
          'chunk 7: unchanged, 1/2 served accepted issues resolved (3 accepted, 4 unenveloped)',
        );
      },
    },),
  ],
},);
