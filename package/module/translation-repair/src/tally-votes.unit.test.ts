/**
 * Tests for pure ballot aggregation into adjudicated issues.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
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
  type PanelVoteState,
  tallyVotes,
} from '../dist/final/node/index.mjs';

/**
 * Invented member claim with chosen id suffix and severity.
 */
function member(
  {
    suffix,
    severity = 'major',
  }: {
    readonly suffix: string;
    readonly severity?: IssueSeverity;
  },
): AggregatedClaim {
  return {
    claimId: `issue/${suffix}`,
    claim: {
      category: 'accuracy/omission',
      severity,
      summary: `The ${suffix} sentence about the cat is missing.`,
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
 * Single-member cluster around one claim.
 */
function soloCluster(
  { claimMember, }: { readonly claimMember: AggregatedClaim; },
): ClaimCluster {
  return {
    clusterId: `cluster/${claimMember.claimId}`,
    position: 10,
    members: [claimMember,],
  };
}

/**
 * Ballot voting one state on every listed claim.
 */
function uniformBallot(
  {
    claimIds,
    vote,
    severity,
    mergeOpinions = {},
  }: {
    readonly claimIds: readonly string[];
    readonly vote: PanelVoteState;
    readonly severity?: IssueSeverity;
    readonly mergeOpinions?: Readonly<Record<string, boolean>>;
  },
): PanelBallot {
  return {
    verdicts: Object.fromEntries(claimIds.map(function toVerdict(claimId,) {
      return [
        claimId,
        {
          vote,
          ...(severity === undefined ? {} : { severity, }),
        },
      ];
    },),),
    mergeOpinions,
    findings: [],
  };
}

await describe({
  name: tallyVotes.name,
  children: [
    it({
      name: 'accepts on strict majority and rejects symmetrically',
      fn: async () => {
        /** Claim under vote. */
        const claimMember = member({ suffix: 'window', },);
        /** Cluster wrapping it. */
        const clusters = [soloCluster({ claimMember, },),];
        /** Ids voted on. */
        const claimIds = [claimMember.claimId,];
        /** Three supporters against two dissenters. */
        const accepted = tallyVotes({
          clusters,
          ballots: {
            a: uniformBallot({ claimIds, vote: 'supported', },),
            b: uniformBallot({ claimIds, vote: 'supported', },),
            c: uniformBallot({ claimIds, vote: 'supported', },),
            d: uniformBallot({ claimIds, vote: 'unsupported', },),
            e: uniformBallot({ claimIds, vote: 'unsupported', },),
          },
        },);
        expect(accepted.issues[0]?.status,).toBe('accepted',);
        /** Three dissenters against two supporters. */
        const rejected = tallyVotes({
          clusters,
          ballots: {
            a: uniformBallot({ claimIds, vote: 'unsupported', },),
            b: uniformBallot({ claimIds, vote: 'unsupported', },),
            c: uniformBallot({ claimIds, vote: 'unsupported', },),
            d: uniformBallot({ claimIds, vote: 'supported', },),
            e: uniformBallot({ claimIds, vote: 'supported', },),
          },
        },);
        expect(rejected.issues[0]?.status,).toBe('rejected',);
      },
    },),

    it({
      name: 'lands ties and ambiguous-heavy splits on needs-human',
      fn: async () => {
        /** Claim under vote. */
        const claimMember = member({ suffix: 'stove', },);
        /** Cluster wrapping it. */
        const clusters = [soloCluster({ claimMember, },),];
        /** Ids voted on. */
        const claimIds = [claimMember.claimId,];
        /** Even split between support and dissent. */
        const tied = tallyVotes({
          clusters,
          ballots: {
            a: uniformBallot({ claimIds, vote: 'supported', },),
            b: uniformBallot({ claimIds, vote: 'supported', },),
            c: uniformBallot({ claimIds, vote: 'unsupported', },),
            d: uniformBallot({ claimIds, vote: 'unsupported', },),
          },
        },);
        expect(tied.issues[0]?.status,).toBe('needs-human',);
        /** Ambiguity dominating the electorate. */
        const ambiguous = tallyVotes({
          clusters,
          ballots: {
            a: uniformBallot({ claimIds, vote: 'ambiguous', },),
            b: uniformBallot({ claimIds, vote: 'ambiguous', },),
            c: uniformBallot({ claimIds, vote: 'supported', },),
            d: uniformBallot({ claimIds, vote: 'ambiguous', },),
          },
        },);
        expect(ambiguous.issues[0]?.status,).toBe('needs-human',);
      },
    },),

    it({
      name: 'needs a human below the minimum electorate, counting missing verdicts as abstentions',
      fn: async () => {
        /** Claim under vote. */
        const claimMember = member({ suffix: 'blanket', },);
        /** Cluster wrapping it. */
        const clusters = [soloCluster({ claimMember, },),];
        /** Only two panelists actually vote; the third ballot is empty. */
        const result = tallyVotes({
          clusters,
          ballots: {
            a: uniformBallot({ claimIds: [claimMember.claimId,], vote: 'supported', },),
            b: uniformBallot({ claimIds: [claimMember.claimId,], vote: 'supported', },),
            c: uniformBallot({ claimIds: [], vote: 'supported', },),
          },
        },);
        expect(result.issues[0]?.status,).toBe('needs-human',);
        expect(result.issues[0]?.tallies[claimMember.claimId]?.abstain,).toBe(1,);
      },
    },),

    it({
      name: 'blocks on a protective source-defect minority even against a supported majority',
      fn: async () => {
        /** Claim under vote. */
        const claimMember = member({ suffix: 'poem', },);
        /** Cluster wrapping it. */
        const clusters = [soloCluster({ claimMember, },),];
        /** Ids voted on. */
        const claimIds = [claimMember.claimId,];
        /** Four supporters, two source-defect votes: exactly one third. */
        const result = tallyVotes({
          clusters,
          ballots: {
            a: uniformBallot({ claimIds, vote: 'supported', },),
            b: uniformBallot({ claimIds, vote: 'supported', },),
            c: uniformBallot({ claimIds, vote: 'supported', },),
            d: uniformBallot({ claimIds, vote: 'supported', },),
            e: uniformBallot({ claimIds, vote: 'source-defect', },),
            f: uniformBallot({ claimIds, vote: 'source-defect', },),
          },
        },);
        expect(result.issues[0]?.status,).toBe('source-defect',);
      },
    },),

    it({
      name: 'honors configured panelist weights',
      fn: async () => {
        /** Claim under vote. */
        const claimMember = member({ suffix: 'collar', },);
        /** Cluster wrapping it. */
        const clusters = [soloCluster({ claimMember, },),];
        /** Ids voted on. */
        const claimIds = [claimMember.claimId,];
        /** One heavyweight supporter against two default dissenters. */
        const result = tallyVotes({
          clusters,
          ballots: {
            heavy: uniformBallot({ claimIds, vote: 'supported', },),
            d1: uniformBallot({ claimIds, vote: 'unsupported', },),
            d2: uniformBallot({ claimIds, vote: 'unsupported', },),
          },
          config: {
            minBallotWeight: 3,
            decisionThreshold: 1 / 2,
            sourceDefectThreshold: 1 / 3,
            weights: { heavy: 3, },
          },
        },);
        expect(result.issues[0]?.status,).toBe('accepted',);
      },
    },),

    it({
      name: 'grades severity by upper median over claim and supported re-grades',
      fn: async () => {
        /** Claim graded minor by its proposer. */
        const claimMember = member({ suffix: 'ribbon', severity: 'minor', },);
        /** Cluster wrapping it. */
        const clusters = [soloCluster({ claimMember, },),];
        /** Ids voted on. */
        const claimIds = [claimMember.claimId,];
        /** Supporters re-grade major and critical; dissenter re-grade must not count. */
        const result = tallyVotes({
          clusters,
          ballots: {
            a: uniformBallot({ claimIds, vote: 'supported', severity: 'major', },),
            b: uniformBallot({ claimIds, vote: 'supported', severity: 'critical', },),
            c: uniformBallot({ claimIds, vote: 'supported', },),
            d: uniformBallot({ claimIds, vote: 'unsupported', severity: 'critical', },),
          },
        },);
        // Opinions: minor (claimed), major, critical; the median is major.
        expect(result.issues[0]?.severity,).toBe('major',);
      },
    },),

    it({
      name: 'merges a cluster on majority same-defect opinion with protective status priority',
      fn: async () => {
        /** Accepted member. */
        const strong = member({ suffix: 'aaa-strong', },);
        /** Member the panel rejects. */
        const weak = member({ suffix: 'bbb-weak', },);
        /** Two-member cluster under merge vote. */
        const cluster: ClaimCluster = {
          clusterId: 'cluster/pair',
          position: 10,
          members: [strong, weak,],
        };
        /** Support for strong, dissent on weak, majority sameDefect. */
        const ballots = {
          a: {
            verdicts: {
              [strong.claimId]: { vote: 'supported' as const, },
              [weak.claimId]: { vote: 'unsupported' as const, },
            },
            mergeOpinions: { [cluster.clusterId]: true, },
            findings: [],
          },
          b: {
            verdicts: {
              [strong.claimId]: { vote: 'supported' as const, },
              [weak.claimId]: { vote: 'unsupported' as const, },
            },
            mergeOpinions: { [cluster.clusterId]: true, },
            findings: [],
          },
          c: {
            verdicts: {
              [strong.claimId]: { vote: 'supported' as const, },
              [weak.claimId]: { vote: 'unsupported' as const, },
            },
            mergeOpinions: { [cluster.clusterId]: false, },
            findings: [],
          },
        };
        /** Merged adjudication. */
        const result = tallyVotes({ clusters: [cluster,], ballots, },);
        expect(result.issues,).toHaveLength(1,);
        expect(result.issues[0]?.status,).toBe('accepted',);
        expect(result.issues[0]?.claims,).toHaveLength(2,);
        expect(result.issues[0]?.issueId.startsWith('adjudicated/',),).toBe(true,);
      },
    },),

    it({
      name: 'keeps cluster members distinct on tied or absent merge opinions',
      fn: async () => {
        /** First member. */
        const first = member({ suffix: 'ccc-first', },);
        /** Second member. */
        const second = member({ suffix: 'ddd-second', },);
        /** Two-member cluster with no consensus to merge. */
        const cluster: ClaimCluster = {
          clusterId: 'cluster/tied',
          position: 10,
          members: [first, second,],
        };
        /** Ids voted on. */
        const claimIds = [first.claimId, second.claimId,];
        /** Tied merge opinions, everyone supporting both claims. */
        const result = tallyVotes({
          clusters: [cluster,],
          ballots: {
            a: uniformBallot({
              claimIds,
              vote: 'supported',
              mergeOpinions: { [cluster.clusterId]: true, },
            },),
            b: uniformBallot({
              claimIds,
              vote: 'supported',
              mergeOpinions: { [cluster.clusterId]: false, },
            },),
            c: uniformBallot({ claimIds, vote: 'supported', },),
          },
        },);
        expect(result.issues,).toHaveLength(2,);
      },
    },),

    it({
      name: 'blocks a merged issue when any member lands source-defect',
      fn: async () => {
        /** Member the panel supports. */
        const supported = member({ suffix: 'eee-supported', },);
        /** Member the panel flags as source defect. */
        const defective = member({ suffix: 'fff-defective', },);
        /** Cluster merging both. */
        const cluster: ClaimCluster = {
          clusterId: 'cluster/blocked',
          position: 10,
          members: [supported, defective,],
        };
        /** Unanimous per-claim votes and merge opinions. */
        const ballots = Object.fromEntries(['a', 'b', 'c',].map(function toBallot(panelist,) {
          return [
            panelist,
            {
              verdicts: {
                [supported.claimId]: { vote: 'supported' as const, },
                [defective.claimId]: { vote: 'source-defect' as const, },
              },
              mergeOpinions: { [cluster.clusterId]: true, },
              findings: [],
            },
          ];
        },),);
        /** Merged adjudication. */
        const result = tallyVotes({ clusters: [cluster,], ballots, },);
        expect(result.issues,).toHaveLength(1,);
        expect(result.issues[0]?.status,).toBe('source-defect',);
      },
    },),
  ],
},);
