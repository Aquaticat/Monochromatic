/**
 Guards class one hundred six and its two predicates. The run-off trigger
 reads a strict majority of the usable contest ballots (owner answer
 2026-10-11, "Majority flawed yes"), which decides whether a tied slate over an
 eligible standing is run off: zheermao8 slice 9's contest split 2 to 2 with
 every ballot calling the archive flawed, and the archive's wording shipped
 because an eligible standing keeps its single round. The forfeit of an
 eligible standing past an undecided gate still reads every ballot (owner
 answer 2026-09-27, "Slate's choice"). Cat-themed invention throughout; no
 corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  archiveFlagsOf,
  archiveFlawedByEveryBallot,
  archiveFlawedByMajority,
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
  name: 'archive flawed predicates',
  children: [
    it({
      name: 'READS a contest settled on neither with every ballot calling the archive flawed, for the forfeit and for the run-off',
      fn: async () => {
        expect(archiveFlawedByEveryBallot({
          verdict: { kind: 'settled-neither', archive: 'declined', },
          ballots: [
            ballotOf({ archive: 'flawed', },),
            ballotOf({ archive: 'flawed', },),
          ],
        },),).toBe(true,);
        expect(archiveFlawedByMajority({
          verdict: { kind: 'settled-neither', archive: 'declined', },
          ballots: [
            ballotOf({ archive: 'flawed', },),
            ballotOf({ archive: 'flawed', },),
          ],
        },),).toBe(true,);
      },
    },),
    it({
      name: 'READS a contest settled on neither where three of its five usable ballots call the archive flawed and two call it publishable, a strict majority (owner answer 2026-10-11, "Majority flawed yes")',
      fn: async () => {
        expect(archiveFlawedByMajority({
          verdict: { kind: 'settled-neither', archive: 'declined', },
          ballots: [
            ballotOf({ archive: 'flawed', },),
            ballotOf({ archive: 'flawed', },),
            ballotOf({ archive: 'flawed', },),
            ballotOf({ archive: 'publishable', },),
            ballotOf({ archive: 'publishable', },),
          ],
        },),).toBe(true,);
      },
    },),
    it({
      name: 'STANDS ASIDE from the run-off where two of four usable ballots call the archive flawed, since two of four is not a strict majority (owner answer 2026-10-11, "Majority flawed yes")',
      fn: async () => {
        expect(archiveFlawedByMajority({
          verdict: { kind: 'settled-neither', archive: 'declined', },
          ballots: [
            ballotOf({ archive: 'flawed', },),
            ballotOf({ archive: 'flawed', },),
            ballotOf({ archive: 'publishable', },),
            ballotOf({ archive: 'publishable', },),
          ],
        },),).toBe(false,);
      },
    },),
    it({
      name: 'STANDS ASIDE from the forfeit where three of five usable ballots call the archive flawed, since the forfeit still needs every ballot (owner answer 2026-09-27, "Slate\'s choice")',
      fn: async () => {
        expect(archiveFlawedByEveryBallot({
          verdict: { kind: 'settled-neither', archive: 'declined', },
          ballots: [
            ballotOf({ archive: 'flawed', },),
            ballotOf({ archive: 'flawed', },),
            ballotOf({ archive: 'flawed', },),
            ballotOf({ archive: 'publishable', },),
            ballotOf({ archive: 'publishable', },),
          ],
        },),).toBe(false,);
      },
    },),
    it({
      name: 'PAIRS THE RUN-OFF FLAG AND THE FORFEIT FLAG from the same ballots, so three of five flawed gives a run-off without a forfeit',
      fn: async () => {
        expect(archiveFlagsOf({
          verdict: { kind: 'settled-neither', archive: 'declined', },
          ballots: [
            ballotOf({ archive: 'flawed', },),
            ballotOf({ archive: 'flawed', },),
            ballotOf({ archive: 'flawed', },),
            ballotOf({ archive: 'publishable', },),
            ballotOf({ archive: 'publishable', },),
          ],
        },),).toEqual({
          runoffOverStanding: true,
          standingFlawedByAll: false,
        },);
      },
    },),
    it({
      name: 'STANDS ASIDE where one ballot would publish the archive, where one ballot did not say, where the contest chose a lane, and where no ballot was usable',
      fn: async () => {
        expect(archiveFlawedByEveryBallot({
          verdict: { kind: 'settled-neither', },
          ballots: [
            ballotOf({ archive: 'flawed', },),
            ballotOf({ archive: 'publishable', },),
          ],
        },),).toBe(false,);
        expect(archiveFlawedByMajority({
          verdict: { kind: 'settled-neither', },
          ballots: [
            ballotOf({ archive: 'flawed', },),
            ballotOf({ archive: 'publishable', },),
          ],
        },),).toBe(false,);
        expect(archiveFlawedByEveryBallot({
          verdict: { kind: 'settled-neither', archive: 'declined', },
          ballots: [
            ballotOf({ archive: 'flawed', },),
            ballotOf({},),
          ],
        },),).toBe(false,);
        expect(archiveFlawedByMajority({
          verdict: { kind: 'settled-neither', archive: 'declined', },
          ballots: [
            ballotOf({ archive: 'flawed', },),
            ballotOf({},),
          ],
        },),).toBe(false,);
        expect(archiveFlawedByMajority({
          verdict: { kind: 'lane-won', lane: 'repair', },
          ballots: [ballotOf({ archive: 'flawed', },),],
        },),).toBe(false,);
        expect(archiveFlawedByEveryBallot({
          verdict: { kind: 'lane-won', lane: 'repair', },
          ballots: [ballotOf({ archive: 'flawed', },),],
        },),).toBe(false,);
        expect(archiveFlawedByMajority({
          verdict: { kind: 'quorum-not-met', },
          ballots: [ballotOf({ archive: 'flawed', },),],
        },),).toBe(false,);
        expect(archiveFlawedByEveryBallot({
          verdict: { kind: 'quorum-not-met', },
          ballots: [ballotOf({ archive: 'flawed', },),],
        },),).toBe(false,);
        expect(archiveFlawedByMajority({
          verdict: { kind: 'settled-neither', },
          ballots: [],
        },),).toBe(false,);
        expect(archiveFlawedByEveryBallot({
          verdict: { kind: 'settled-neither', },
          ballots: [],
        },),).toBe(false,);
      },
    },),
  ],
},);
