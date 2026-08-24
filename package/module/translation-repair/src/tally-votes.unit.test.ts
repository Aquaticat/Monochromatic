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
          configuredPanelists: 5,
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
          configuredPanelists: 5,
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
          configuredPanelists: 4,
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
          configuredPanelists: 4,
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
          configuredPanelists: 3,
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
          configuredPanelists: 6,
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
          configuredPanelists: 3,
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
          configuredPanelists: 4,
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
        const result = tallyVotes({ clusters: [cluster,], ballots, configuredPanelists: Object.keys(ballots,).length, },);
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
          configuredPanelists: 3,
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
        const result = tallyVotes({ clusters: [cluster,], ballots, configuredPanelists: Object.keys(ballots,).length, },);
        expect(result.issues,).toHaveLength(1,);
        expect(result.issues[0]?.status,).toBe('source-defect',);
      },
    },),
  ],
},);

await describe({
  name: 'panel reading',
  children: [
    it({
      name: 'RECORDS every ballot beside the tally, naming who voted and what weight it carried, since five weighted numbers cannot say whether an acceptance was unanimous or one vote wide',
      fn: async () => {
        /** Claim under vote. */
        const claimMember = member({ suffix: 'aaa-reading', },);
        /** Its cluster. */
        const clusters = [soloCluster({ claimMember, },),];
        /** Claim ids every ballot votes on. */
        const claimIds = [claimMember.claimId,];

        const result = tallyVotes({
          clusters,
          ballots: {
            a: uniformBallot({ claimIds, vote: 'supported', },),
            b: uniformBallot({ claimIds, vote: 'supported', },),
            c: uniformBallot({ claimIds, vote: 'unsupported', },),
          },
          configuredPanelists: 3,
        },);

        /** What the panel said about this claim. */
        const reading = result.issues[0]?.readings?.[claimMember.claimId];
        expect(reading?.configuredPanelists,).toBe(3,);
        expect(reading?.ballots.length,).toBe(3,);
        expect(reading?.ballots.map(function toPair(ballot,) {
          return `${ballot.panelistId}:${ballot.vote}:${String(ballot.weight,)}`;
        },),).toStrictEqual([
          'a:supported:1',
          'b:supported:1',
          'c:unsupported:1',
        ],);

        // The stored tally is the one the issue carries, not a second sum.
        expect(reading?.tally,).toStrictEqual(result.issues[0]?.tallies[claimMember.claimId],);
      },
    },),

    it({
      name: 'RECORDS AN ABSTENTION AS A BALLOT while a lost voice leaves none, which is the distinction configuredPanelists exists to keep: three of six seated and three of three are very different evidence',
      fn: async () => {
        const claimMember = member({ suffix: 'bbb-abstain', },);
        const clusters = [soloCluster({ claimMember, },),];
        const claimIds = [claimMember.claimId,];

        // Three panelists answered the sheet; `quiet` voted on nothing, and
        // three more were seated and never replied at all.
        const result = tallyVotes({
          clusters,
          ballots: {
            a: uniformBallot({ claimIds, vote: 'supported', },),
            b: uniformBallot({ claimIds, vote: 'supported', },),
            quiet: uniformBallot({ claimIds: [], vote: 'supported', },),
          },
          configuredPanelists: 6,
        },);

        const reading = result.issues[0]?.readings?.[claimMember.claimId];
        expect(reading?.ballots.length,).toBe(3,);
        expect(reading?.configuredPanelists,).toBe(6,);
        expect(reading?.ballots
          .find(function isQuiet(ballot,) {
            return ballot.panelistId === 'quiet';
          },)
          ?.vote,).toBe('abstain',);
      },
    },),

    it({
      name: 'CARRIES the weight the config gave each panelist, without which a run under a non-default weight table could not be re-tallied from its own record',
      fn: async () => {
        const claimMember = member({ suffix: 'ccc-weighted', },);
        const clusters = [soloCluster({ claimMember, },),];
        const claimIds = [claimMember.claimId,];

        const result = tallyVotes({
          clusters,
          ballots: {
            heavy: uniformBallot({ claimIds, vote: 'supported', },),
            d1: uniformBallot({ claimIds, vote: 'unsupported', },),
          },
          configuredPanelists: 2,
          config: {
            minBallotWeight: 3,
            decisionThreshold: 1 / 2,
            sourceDefectThreshold: 1 / 3,
            weights: { heavy: 4, },
          },
        },);

        const reading = result.issues[0]?.readings?.[claimMember.claimId];
        expect(reading?.ballots
          .find(function isHeavy(ballot,) {
            return ballot.panelistId === 'heavy';
          },)
          ?.weight,).toBe(4,);

        // RECOMPUTED FROM THE BALLOTS, which is the property that makes the
        // stored tally checkable rather than merely present.
        expect((reading?.ballots ?? [])
          .filter(function supportedIt(ballot,) {
            return ballot.vote === 'supported';
          },)
          .reduce(function addWeight(mass, ballot,) {
            return mass + ballot.weight;
          }, 0,),).toBe(reading?.tally.supported,);
      },
    },),

    it({
      name: 'KEYS a merged issue by member claim exactly as its tallies are, so a reader joining the two never has to guess which ballot belongs to which claim',
      fn: async () => {
        const first = member({ suffix: 'ddd-first', },);
        const second = member({ suffix: 'eee-second', },);
        /** Cluster the panel merges. */
        const cluster: ClaimCluster = {
          clusterId: 'cluster/merged-reading',
          position: 10,
          members: [first, second,],
        };
        const claimIds = [first.claimId, second.claimId,];

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
              mergeOpinions: { [cluster.clusterId]: true, },
            },),
          },
          configuredPanelists: 2,
        },);

        expect(result.issues,).toHaveLength(1,);
        expect(Object.keys(result.issues[0]?.readings ?? {},).toSorted(),).toStrictEqual(
          Object.keys(result.issues[0]?.tallies ?? {},).toSorted(),
        );
      },
    },),
  ],
},);
