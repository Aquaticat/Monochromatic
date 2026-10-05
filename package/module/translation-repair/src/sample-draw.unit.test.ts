/**
 Tests for the stratified draw: how the band quota fills and how ties order.
 Fixtures are cat-themed invention mirroring corpus structure only.

 @module
 */

import {
  caught,
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

        it({
          name: 'REFUSES a size that is not a whole number of slots, zero or more, where a fraction '
            + 'once drew a slot from every band on every pass (two and a half slots asked, nine '
            + 'handed out)',
          fn: async () => {
            for (const size of [2.5, -1, Number.NaN, Number.POSITIVE_INFINITY,]) {
              /**
               What the allocation raised, read for its class and its whole
               wording.
               */
              const refusal = caught(function allocate(): unknown {
                return allocateBandQuota({
                  available: {
                    small: 10,
                    medium: 10,
                    large: 10,
                  },
                  size,
                },);
              },);
              expect(refusal,).toBeInstanceOf(RangeError,);
              expect(String(refusal,),).toBe(
                `RangeError: A sample size is a whole number of slots, zero or more; received ${String(size,)}.`,
              );
            }
          },
        },),

        it({
          name: 'HANDS OUT NOTHING for a size of zero',
          fn: async () => {
            expect(allocateBandQuota({
              available: {
                small: 10,
                medium: 10,
                large: 10,
              },
              size: 0,
            },),).toEqual({
              small: 0,
              medium: 0,
              large: 0,
            },);
          },
        },),
      ],
    },),

    describe({
      name: drawStratifiedSample.name,
      children: [
        it({
          name: 'BREAKS A RANK TIE BETWEEN ENTRIES by the entry shuffle, whatever order the candidates '
            + 'arrived in',
          fn: async () => {
            /**
             Two entries holding one candidate each in one band, so both
             sit at rank zero in their own entry.
             */
            const drawn = drawStratifiedSample({
              candidates: [
                candidateOf('Zeta', 'small', 'issue-a',),
                candidateOf('Alpha', 'small', 'issue-b',),
              ],
              size: 2,
              seed: 'meow',
            },);
            /**
             The same candidates arriving in the other order.
             */
            const reversed = drawStratifiedSample({
              candidates: [
                candidateOf('Alpha', 'small', 'issue-b',),
                candidateOf('Zeta', 'small', 'issue-a',),
              ],
              size: 2,
              seed: 'meow',
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
          name: 'ORDERS ONE ENTRY\'S CANDIDATES by the issue shuffle, whatever order they arrived in',
          fn: async () => {
            /**
             Two candidates of one entry in one band, ranked by their
             shuffled issue keys.
             */
            const drawn = drawStratifiedSample({
              candidates: [
                candidateOf('Alpha', 'small', 'issue-b',),
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
