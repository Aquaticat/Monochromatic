/**
 Tests for the stratified draw: how the band quota fills and how ties order.
 Fixtures are cat-themed invention mirroring corpus structure only.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  allocateBandQuota,
  drawStratifiedSample,
  type GradingCandidate,
} from '../dist/final/node/index.mjs';

/**
 One candidate for the draw fixtures.

 @param entryId - entry the issue came from

 @param band - size band of its source

 @param issueId - the issue itself

 @returns Candidate shaped like the grading reader builds

 @example
 ```ts
 const candidate = candidateOf('Alpha', 'small', 'issue-a',);
 ```
 */
function candidateOf(
  entryId: string,
  band: GradingCandidate['band'],
  issueId: string,
): GradingCandidate {
  return {
    entryId,
    band,
    issueId,
    category: 'accuracy/omission',
    severity: 'minor',
    summary: 'A clause the translation dropped.',
    sourceAnchor: 'none',
    sourceQuotes: [],
    targetQuotes: [],
  } as unknown as GradingCandidate;
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: allocateBandQuota.name,
      children: [
        it({
          name: 'FILLS THE BANDS ONE SLOT A PASS up to the size asked, and no further than the bands '
            + 'can collectively hold',
          fn: async () => {
            expect(allocateBandQuota({
              available: {
                small: 2,
                medium: 1,
                large: 1,
              },
              size: 3,
            },),).toEqual({
              small: 1,
              medium: 1,
              large: 1,
            },);
            expect(allocateBandQuota({
              available: {
                small: 3,
                medium: 0,
                large: 0,
              },
              size: 2,
            },),).toEqual({
              small: 2,
              medium: 0,
              large: 0,
            },);
            expect(allocateBandQuota({
              available: {
                small: 1,
                medium: 1,
                large: 1,
              },
              size: 99,
            },),).toEqual({
              small: 1,
              medium: 1,
              large: 1,
            },);
          },
        },),
      ],
    },),

    describe({
      name: drawStratifiedSample.name,
      children: [
        it({
          name: 'BREAKS A CROSS-BAND RANK TIE by the entry shuffle, whatever order the candidates '
            + 'arrived in',
          fn: async () => {
            /**
             Two entries holding one candidate each, one per band, so both
             sit at rank zero in their own bucket.
             */
            const drawn = drawStratifiedSample({
              candidates: [
                candidateOf('Zeta', 'small', 'issue-a',),
                candidateOf('Alpha', 'large', 'issue-b',),
              ],
              size: 2,
              seed: 'seed-two',
            },);
            /**
             The same candidates arriving in the other order.
             */
            const reversed = drawStratifiedSample({
              candidates: [
                candidateOf('Alpha', 'large', 'issue-b',),
                candidateOf('Zeta', 'small', 'issue-a',),
              ],
              size: 2,
              seed: 'seed-two',
            },);
            expect(drawn.map(function entryOf(candidate,) {
              return candidate.entryId;
            },),).toEqual(['Zeta', 'Alpha'],);
            expect(reversed.map(function entryOf(candidate,) {
              return candidate.entryId;
            },),).toEqual(['Zeta', 'Alpha'],);
          },
        },),

        it({
          name: 'BREAKS A SAME-ENTRY RANK TIE by the issue shuffle, whatever order the candidates '
            + 'arrived in',
          fn: async () => {
            /**
             Two candidates of one entry in two bands, so each is rank
             zero in its own bucket and the issue keys settle the order.
             */
            const drawn = drawStratifiedSample({
              candidates: [
                candidateOf('Alpha', 'large', 'issue-b',),
                candidateOf('Alpha', 'small', 'issue-a',),
              ],
              size: 2,
              seed: 'seed-two',
            },);
            expect(drawn.map(function issueOf(candidate,) {
              return candidate.issueId;
            },),).toEqual(['issue-a', 'issue-b'],);
          },
        },),
      ],
    },),
  ],
},);
