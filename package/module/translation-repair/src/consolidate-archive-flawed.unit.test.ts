/**
 Guards class one hundred six (owner answer 2026-09-24, "Run-off only when
 every contest ballot called the archive flawed"): zheermao8 slice 9's
 contest split 2 to 2 with every ballot calling the archive flawed, the
 consolidation slate split 1/1/1 with both lane texts on offer, and the
 archive's wording shipped because an eligible standing keeps its single
 round. The predicate here says when that single round becomes a run-off.
 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  archiveFlawedByAll,
  type LaneContestBallot,
} from '../dist/final/node/index.mjs';

/**
 One usable ballot with the archive verdict a case needs.

 @param archive - what this judge made of the archive, absent when it did
 not say

 @returns Ballot naming the repair lane

 @example
 ```ts
 const ballot = ballotOf({ archive: 'flawed', },);
 ```
 */
function ballotOf(
  { archive, }: { readonly archive?: 'publishable' | 'flawed'; },
): LaneContestBallot {
  return {
    choice: 'repair',
    unsupported: [],
    unsupportedRaw: [],
    dropped: [],
    droppedRaw: [],
    reason: 'the cat naps',
    ...((archive === undefined) ? {} : { archive, }),
  };
}

await describe({
  name: archiveFlawedByAll.name,
  children: [
    it({
      name: 'READS a contest settled on neither with every ballot calling the archive flawed',
      fn: async () => {
        expect(archiveFlawedByAll({
          verdict: { kind: 'settled-neither', archive: 'declined', },
          ballots: [
            ballotOf({ archive: 'flawed', },),
            ballotOf({ archive: 'flawed', },),
          ],
        },),).toBe(true,);
      },
    },),
    it({
      name: 'STANDS ASIDE where one ballot would publish the archive, where one ballot did not say, where the contest chose a lane, and where no ballot was usable',
      fn: async () => {
        expect(archiveFlawedByAll({
          verdict: { kind: 'settled-neither', },
          ballots: [
            ballotOf({ archive: 'flawed', },),
            ballotOf({ archive: 'publishable', },),
          ],
        },),).toBe(false,);
        expect(archiveFlawedByAll({
          verdict: { kind: 'settled-neither', archive: 'declined', },
          ballots: [
            ballotOf({ archive: 'flawed', },),
            ballotOf({},),
          ],
        },),).toBe(false,);
        expect(archiveFlawedByAll({
          verdict: { kind: 'lane-won', lane: 'repair', },
          ballots: [ballotOf({ archive: 'flawed', },),],
        },),).toBe(false,);
        expect(archiveFlawedByAll({
          verdict: { kind: 'quorum-not-met', },
          ballots: [ballotOf({ archive: 'flawed', },),],
        },),).toBe(false,);
        expect(archiveFlawedByAll({
          verdict: { kind: 'settled-neither', },
          ballots: [],
        },),).toBe(false,);
      },
    },),
  ],
},);
