/**
 Tests for how the tally settles a claim the panel grades neutral, the
 severity that asserts no defect (ledger L5).
 Fixtures are cat-themed invention mirroring corpus structure only.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type AggregatedClaim,
  type ClaimCluster,
  hashContent,
  type IssueSeverity,
  type PanelBallot,
  tallyVotes,
} from '../dist/final/node/index.mjs';

/**
 Invented omission claim at a chosen severity.
 */
function member(
  {
    suffix,
    severity,
  }: {
    readonly suffix: string;
    readonly severity: IssueSeverity;
  },
): AggregatedClaim {
  return {
    claimId: `issue/${suffix}`,
    claim: {
      category: 'accuracy/omission',
      severity,
      summary: `The ${suffix} detail about the cat is missing.`,
      spans: [
        {
          side: 'target',
          nodeId: 'block/1',
          nodeHash: hashContent({ content: 'The cat naps.', },),
          startOffset: 10,
          endOffset: 10,
          quotedText: '',
        },
      ],
    },
  };
}

/**
 Ballot supporting one claim, with an optional re-grade.
 */
function supporting(
  {
    claimId,
    severity,
  }: {
    readonly claimId: string;
    readonly severity?: IssueSeverity;
  },
): PanelBallot {
  return {
    verdicts: {
      [claimId]: {
        vote: 'supported',
        ...(severity === undefined ? {} : { severity, }),
      },
    },
    mergeOpinions: {},
    findings: [],
  };
}

/**
 Tally of one solo claim under three supporting ballots.
 */
function tallyThree(
  {
    claimMember,
    regrades,
  }: {
    readonly claimMember: AggregatedClaim;
    readonly regrades: readonly (IssueSeverity | 'silent')[];
  },
): ReturnType<typeof tallyVotes> {
  return tallyVotes({
    configuredPanelists: regrades.length,
    clusters: [
      {
        clusterId: `cluster/${claimMember.claimId}`,
        position: 10,
        members: [claimMember,],
      } satisfies ClaimCluster,
    ],
    ballots: Object.fromEntries(regrades.map(function toBallot(severity, index,) {
      return [
        `panelist-${String(index,)}`,
        supporting({
          claimId: claimMember.claimId,
          ...(severity === 'silent' ? {} : { severity, }),
        },),
      ];
    },),),
  },);
}

await describe({
  name: 'neutral severity at the tally',
  children: [
    it({
      name: 'HOLDS FOR A HUMAN a claim filed neutral that every panelist supports without re-grading, since neutral asserts no defect for the editor to fix',
      fn: async () => {
        /** Claim filed neutral. */
        const claimMember = member({ suffix: 'whisker', severity: 'neutral', },);
        /** Unanimous support, nobody re-grading. */
        const result = tallyThree({ claimMember, regrades: ['silent', 'silent', 'silent',], },);
        expect(result.issues[0]?.status,).toBe('needs-human',);
        expect(result.issues[0]?.severity,).toBe('neutral',);
        expect(result.findings,).toContain(`neutral-held-for-human (${claimMember.claimId})`,);
      },
    },),

    it({
      name: 'HOLDS FOR A HUMAN a claim filed minor that the supporting panel re-grades to neutral',
      fn: async () => {
        /** Claim filed minor. */
        const claimMember = member({ suffix: 'collar', severity: 'minor', },);
        /** Two of three supporters re-grade neutral. */
        const result = tallyThree({ claimMember, regrades: ['neutral', 'neutral', 'silent',], },);
        expect(result.issues[0]?.status,).toBe('needs-human',);
        expect(result.findings,).toContain(`neutral-held-for-human (${claimMember.claimId})`,);
      },
    },),

    it({
      name: 'ACCEPTS a claim filed neutral once a supporter re-grades it to a real defect, because the upper median then leaves neutral',
      fn: async () => {
        /** Claim filed neutral. */
        const claimMember = member({ suffix: 'saucer', severity: 'neutral', },);
        /** One supporter re-grades minor. */
        const result = tallyThree({ claimMember, regrades: ['minor', 'silent', 'silent',], },);
        expect(result.issues[0]?.status,).toBe('accepted',);
        expect(result.issues[0]?.severity,).toBe('minor',);
        expect(result.findings,).toStrictEqual([],);
      },
    },),
  ],
},);
