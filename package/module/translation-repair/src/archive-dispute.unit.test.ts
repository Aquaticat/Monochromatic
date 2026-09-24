/**
 Guards class one hundred seven (owner answer 2026-09-24, "Not eligible;
 fall back to the repair text"): CuspariaKLSY10 slice 3's archive rendering
 named a suicide method the original never states, the repair lane's
 adjudicators accepted the `accuracy/addition` claims against it and removed
 the detail, the translate slate backed nobody, and the archive stood because
 an eligible standing keeps its single round. The reading here names such a
 slice a dispute and hands the repair lane's text over as the archive's
 stand-in. Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  archiveDisputesOf,
  describeArchiveDispute,
  type AdjudicatedIssue,
  type IssueClaim,
} from '../dist/final/node/index.mjs';

/**
 Claim the critics filed against the archive rendering.
 */
function claimOf(
  {
    category,
    summary,
  }: {
    readonly category: IssueClaim['category'];
    readonly summary: string;
  },
): IssueClaim {
  return {
    category,
    severity: 'major',
    summary,
    spans: [],
  };
}

/**
 Adjudicated issue over one claim.
 */
function issueOf(
  {
    status,
    claim,
  }: {
    readonly status: AdjudicatedIssue['status'];
    readonly claim: IssueClaim;
  },
): AdjudicatedIssue {
  return {
    issueId: `adjudicated/${claim.summary}`,
    status,
    severity: 'major',
    claims: [{ claimId: `issue/${claim.summary}`, claim, },],
    tallies: {},
  };
}

/**
 Claim that the archive invented how the cat got onto the roof.
 */
const INVENTED = claimOf({
  category: 'accuracy/addition',
  summary: 'The translation adds that the cat climbed the drainpipe, which the original never states.',
},);

/**
 Claim that the archive rendered the wrong colour.
 */
const WRONG_COLOUR = claimOf({
  category: 'accuracy/mistranslation',
  summary: 'The translation says the cat was grey where the original says black.',
},);

/**
 Repair lane's text for the disputed slice, the invented detail removed.
 */
const REPAIRED = 'The cat sat on the roof.';

await describe({
  name: archiveDisputesOf.name,
  children: [
    it({
      name: 'NAMES A DISPUTE where an accepted accuracy/addition claim stands against the archive, handing the repair text over as the stand-in',
      fn: async () => {
        const disputes = archiveDisputesOf({
          chunks: [
            {
              sliceIndex: 3,
              repairedText: REPAIRED,
              issues: [
                issueOf({ status: 'accepted', claim: INVENTED, },),
                issueOf({ status: 'accepted', claim: WRONG_COLOUR, },),
                issueOf({ status: 'rejected', claim: INVENTED, },),
              ],
            },
          ],
        },);
        expect([...disputes.keys(),],).toEqual([3,],);
        expect(disputes.get(3,),).toEqual({
          sliceIndex: 3,
          standIn: REPAIRED,
          acceptedAdditions: 1,
        },);
      },
    },),
    it({
      name: 'STANDS ASIDE where the addition claim was rejected or left to a human, where only other categories were accepted, and where nothing was filed',
      fn: async () => {
        const disputes = archiveDisputesOf({
          chunks: [
            {
              sliceIndex: 0,
              repairedText: REPAIRED,
              issues: [issueOf({ status: 'rejected', claim: INVENTED, },),],
            },
            {
              sliceIndex: 1,
              repairedText: REPAIRED,
              issues: [issueOf({ status: 'needs-human', claim: INVENTED, },),],
            },
            {
              sliceIndex: 2,
              repairedText: REPAIRED,
              issues: [issueOf({ status: 'accepted', claim: WRONG_COLOUR, },),],
            },
            {
              sliceIndex: 4,
              repairedText: REPAIRED,
              issues: [],
            },
          ],
        },);
        expect(disputes.size,).toBe(0,);
      },
    },),
    it({
      name: 'DESCRIBES the dispute as a finding naming the slice and the accepted claims',
      fn: async () => {
        expect(describeArchiveDispute({
          dispute: {
            sliceIndex: 3,
            standIn: REPAIRED,
            acceptedAdditions: 2,
          },
        },),).toBe(
          'translate-archive-disputed (slice 3): the repair lane\'s adjudicators accepted 2 accuracy/addition '
            + 'claim(s) against the archive rendering, so the repair lane\'s text stands in for it (class one hundred seven)',
        );
      },
    },),
  ],
},);
