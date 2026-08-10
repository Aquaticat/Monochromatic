/**
 * Tests for the count that separates a naturalness lane nobody asked from one
 * that could not answer.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { summarizeRefineCoverage, } from '../dist/final/node/index.mjs';

await describe({
  name: summarizeRefineCoverage.name,
  children: [
    it({
      name: 'counts a slice where NO refiner answered, which is the reading '
        + 'the refinement audit cannot give. One model refines, so a roster of '
        + 'one has no quorum to lose and its failure moves no other number: '
        + 'the audit simply does not grow, exactly as it does not grow when '
        + 'there was nothing worth rewriting',
      fn: async () => {
        expect(summarizeRefineCoverage({
          entries: [
            {
              findings: [
                'refine-candidates (0/1 heard, 0 proposing)',
                'refine-candidates (1/1 heard, 1 proposing)',
                'refine-selected',
              ],
              hasRewrites: true,
            },
          ],
        },),).toEqual({
          slicesOffered: 2,
          slicesSilent: 1,
          entriesWithRewrites: 1,
        },);
      },
    },),

    it({
      name: 'separates an entry the lane never rewrote from one it could not '
        + 'reach, since both leave the audit at the same number',
      fn: async () => {
        expect(summarizeRefineCoverage({
          entries: [
            {
              // Offered, answered, and nothing was worth changing.
              findings: ['refine-candidates (1/1 heard, 0 proposing)',],
              hasRewrites: false,
            },
            {
              // Offered, and nobody answered.
              findings: ['refine-candidates (0/1 heard, 0 proposing)',],
              hasRewrites: false,
            },
            {
              // Never offered a slice at all.
              findings: ['refine-skip',],
              hasRewrites: false,
            },
          ],
        },),).toEqual({
          slicesOffered: 2,
          slicesSilent: 1,
          entriesWithRewrites: 0,
        },);
      },
    },),

    it({
      name: 'counts nothing for an artifact carrying no refine findings, so a '
        + 'run predating the lane reads as zero offered rather than as a lane '
        + 'that failed everywhere',
      fn: async () => {
        expect(summarizeRefineCoverage({
          entries: [
            {
              findings: [],
              hasRewrites: false,
            },
          ],
        },),).toEqual({
          slicesOffered: 0,
          slicesSilent: 0,
          entriesWithRewrites: 0,
        },);
      },
    },),

    it({
      name: 'does not mistake a two-digit heard count for a silent slice, '
        + 'which a looser prefix would: "10/12 heard" opens with a one and a '
        + 'zero, and counting it as silent would report a healthy roster as a '
        + 'dead one',
      fn: async () => {
        expect(summarizeRefineCoverage({
          entries: [
            {
              findings: [
                'refine-candidates (10/12 heard, 3 proposing)',
                'refine-candidates (0/12 heard, 0 proposing)',
              ],
              hasRewrites: true,
            },
          ],
        },),).toEqual({
          slicesOffered: 2,
          slicesSilent: 1,
          entriesWithRewrites: 1,
        },);
      },
    },),
  ],
},);
