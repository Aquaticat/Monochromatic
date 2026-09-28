/**
 Tests that a disputed slice's stand-in is never the archive's own wording,
 and that the dispute line says why a stand-in is refused (ledger L12).

 WHY. The line said "the checkers confirmed no repair of it" for every
 refused stand-in, and a slice the assembly withdrew is refused with every
 disputing issue confirmed, so the line misstated it. And eligibility asked
 only that the checkers confirmed every disputing issue resolved, never that
 the repair lane's text differs from the archive's: a patch that won and
 wrote nothing, with its issues confirmed, would stand in with the disputed
 wording itself, and the translate lane would keep it as the incumbent. That
 was never seen (0 of 1,132 fully resolved disputes over every artifact), and
 now cannot happen.

 Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type AdjudicatedIssue,
  archiveDisputesOf,
  describeArchiveDispute,
  hashContent,
} from '../dist/final/node/index.mjs';

/**
 Archive wording that adds a purr the original never states.
 */
const ARCHIVE = 'The cat slept by the window, purring.';

/**
 Repair lane's text without the purr.
 */
const REPAIRED = 'The cat slept by the window.';

/**
 Accepted addition disputing the archive.
 */
const ADDITION: AdjudicatedIssue = {
  issueId: 'issue/purr',
  status: 'accepted',
  severity: 'minor',
  claims: [
    {
      claimId: 'claim/purr',
      claim: {
        category: 'accuracy/addition',
        severity: 'minor',
        summary: 'The purr is not in the original.',
        spans: [
          {
            side: 'target',
            nodeId: 'block/1',
            nodeHash: hashContent({ content: ARCHIVE, },),
            startOffset: ARCHIVE.indexOf('purring',),
            endOffset: ARCHIVE.indexOf('purring',) + 'purring'.length,
            quotedText: 'purring',
          },
        ],
      },
    },
  ],
  tallies: {},
};

/**
 The dispute line for one settled chunk.

 @param repairedText - what the repair lane settled on

 @param changed - whether that differs from the archive

 @param resolved - whether the checkers confirmed the addition removed

 @param withdrawn - whether the assembly withdrew the slice

 @returns Eligibility and the line

 @example
 ```ts
 const { eligible, line, } = disputeFor({ repairedText: REPAIRED, changed: true, resolved: true, withdrawn: false, },);
 ```
 */
function disputeFor(
  {
    repairedText,
    changed,
    resolved,
    withdrawn,
  }: {
    readonly repairedText: string;
    readonly changed: boolean;
    readonly resolved: boolean;
    readonly withdrawn: boolean;
  },
): { readonly eligible: boolean; readonly line: string; } {
  /**
   The one dispute read off the chunk.
   */
  const dispute = archiveDisputesOf({
    chunks: [
      {
        sliceIndex: 0,
        repairedText,
        changed,
        issues: [ADDITION,],
        resolvedIssueIds: resolved ? [ADDITION.issueId,] : [],
      },
    ],
    withdrawnSliceIndices: withdrawn ? [0,] : [],
  },).get(0,);
  if (dispute === undefined)
    throw new Error('the addition did not dispute the archive',);
  return {
    eligible: dispute.standInEligible,
    line: describeArchiveDispute({ dispute, },),
  };
}

await describe({
  name: 'the dispute line says why a stand-in is refused (ledger L12)',
  children: [
    it({
      name: 'a resolved repair whose text differs STANDS IN',
      fn: async () => {
        /**
         Dispute of a slice the repair fixed.
         */
        const { eligible, line, } = disputeFor({ repairedText: REPAIRED, changed: true, resolved: true, withdrawn: false, },);
        expect({ eligible, standsIn: line.includes('so the repair lane\'s text stands in for it',), },).toEqual({
          eligible: true,
          standsIn: true,
        },);
      },
    },),
    it({
      name: 'a repair text identical to the archive NEVER stands in, however the checkers voted, and the line says so',
      fn: async () => {
        /**
         Dispute of a slice whose patch won and wrote nothing.
         */
        const { eligible, line, } = disputeFor({ repairedText: ARCHIVE, changed: false, resolved: true, withdrawn: false, },);
        expect({ eligible, says: line.includes('the repair lane\'s text is the archive\'s own wording',), },).toEqual({
          eligible: false,
          says: true,
        },);
      },
    },),
    it({
      name: 'a withdrawn slice is refused, and the line names the withdrawal rather than the checkers',
      fn: async () => {
        /**
         Dispute of a slice the assembly withdrew.
         */
        const { eligible, line, } = disputeFor({ repairedText: REPAIRED, changed: true, resolved: true, withdrawn: true, },);
        expect({
          eligible,
          says: line.includes('the assembly withdrew the repair lane\'s text',),
          blamesCheckers: line.includes('checkers',),
        },).toEqual({
          eligible: false,
          says: true,
          blamesCheckers: false,
        },);
      },
    },),
    it({
      name: 'an unresolved dispute is refused, and the line names the checkers',
      fn: async () => {
        /**
         Dispute of a slice the checkers did not confirm fixed.
         */
        const { eligible, line, } = disputeFor({ repairedText: REPAIRED, changed: true, resolved: false, withdrawn: false, },);
        expect({ eligible, says: line.includes('the checkers did not confirm every disputing issue resolved',), },).toEqual({
          eligible: false,
          says: true,
        },);
      },
    },),
  ],
},);
