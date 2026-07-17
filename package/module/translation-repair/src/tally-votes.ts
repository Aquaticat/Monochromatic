import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import {
  type AdjudicatedIssue,
  type AdjudicationConfig,
  type AdjudicationStatus,
  DEFAULT_ADJUDICATION_CONFIG,
  type PanelBallot,
  type PanelVoteState,
  type VoteTally,
} from './adjudicate-model.ts';
import type {
  AggregatedClaim,
  ClaimCluster,
} from './aggregate-claims.ts';
import { hashContent, } from './document-node.ts';
import {
  ISSUE_SEVERITIES,
  type IssueSeverity,
} from './issue-taxonomy.ts';

//region Vote tally
// Pure aggregation of panel ballots into adjudicated issues. Decision rules,
// in order per claim: not enough non-abstain weight lands needs-human; a
// protective source-defect minority blocks; a strict majority accepts or
// rejects; everything else needs a human. Merge disposition is majority
// same-defect weight among opining panelists, defaulting to distinct.

/**
 * Everything the panel decided over one chunk's clusters.
 *
 * @example
 * ```ts
 * const result: AdjudicationResult = tallyVotes({ clusters, ballots, },);
 * ```
 */
export type AdjudicationResult = {
  /**
   * Issues in cluster document order;
   * unmerged clusters yield one issue per member claim.
   */
  readonly issues: readonly AdjudicatedIssue[];
};

/**
 * Weight behind one vote state on one claim across every ballot;
 * a missing verdict abstains.
 *
 * @param claimId - claim under tally
 *
 * @param ballots - resolved ballots keyed by panelist id
 *
 * @param config - weight table
 *
 * @param state - vote state whose mass is summed
 *
 * @returns Weighted vote mass for the state
 *
 * @example
 * ```ts
 * const mass = voteWeight({ claimId, ballots, config, state: 'supported', },);
 * ```
 */
function voteWeight(
  {
    claimId,
    ballots,
    config,
    state,
  }: {
    readonly claimId: string;
    readonly ballots: Readonly<Record<string, PanelBallot>>;
    readonly config: AdjudicationConfig;
    readonly state: PanelVoteState;
  },
): number {
  return Object
    .entries(ballots,)
    .reduce(
      function addBallot(
        mass: number,
        [panelistId, ballot,],
      ): number {
        /**
         * Vote cast, with missing verdicts abstaining.
         */
        const vote = ballot.verdicts[claimId]
          ?.vote
          ?? 'abstain';
        if (vote !== state)
          return mass;
        return mass + (config.weights?.[panelistId] ?? 1);
      },
      0,
    );
}

/**
 * Weighted tally of one claim across every ballot.
 *
 * @param claimId - claim under tally
 *
 * @param ballots - resolved ballots keyed by panelist id
 *
 * @param config - weight table and thresholds
 *
 * @returns Weighted counts per vote state
 *
 * @example
 * ```ts
 * const tally = tallyClaim({ claimId, ballots, config, },);
 * ```
 */
function tallyClaim(
  {
    claimId,
    ballots,
    config,
  }: {
    readonly claimId: string;
    readonly ballots: Readonly<Record<string, PanelBallot>>;
    readonly config: AdjudicationConfig;
  },
): VoteTally {
  /**
   * Shared facets of every per-state sum.
   */
  const facets = {
    claimId,
    ballots,
    config,
  };

  return {
    supported: voteWeight({
      ...facets,
      state: 'supported',
    },),
    unsupported: voteWeight({
      ...facets,
      state: 'unsupported',
    },),
    ambiguous: voteWeight({
      ...facets,
      state: 'ambiguous',
    },),
    sourceDefect: voteWeight({
      ...facets,
      state: 'source-defect',
    },),
    abstain: voteWeight({
      ...facets,
      state: 'abstain',
    },),
  };
}

/**
 * Status one tally decides under the config thresholds.
 *
 * @param tally - weighted counts for one claim
 *
 * @param config - thresholds in force
 *
 * @returns Fate of the claim
 *
 * @example
 * ```ts
 * const status = decideStatus({ tally, config, },);
 * ```
 */
function decideStatus(
  {
    tally,
    config,
  }: {
    readonly tally: VoteTally;
    readonly config: AdjudicationConfig;
  },
): AdjudicationStatus {
  /**
   * Non-abstain weight forming the electorate for this claim.
   */
  const electorate = tally.supported + tally.unsupported
    + tally.ambiguous
    + tally.sourceDefect;
  if (electorate < config.minBallotWeight)
    return 'needs-human';
  if ((tally.sourceDefect / electorate) >= config.sourceDefectThreshold)
    return 'source-defect';
  if ((tally.supported / electorate) > config.decisionThreshold)
    return 'accepted';
  if ((tally.unsupported / electorate) > config.decisionThreshold)
    return 'rejected';
  return 'needs-human';
}

/**
 * Upper median of severities under the taxonomy's least-to-most order,
 * so an even split rounds toward the more severe grade;
 * conservative repair prefers over-grading to under-grading.
 *
 * @param severities - non-empty severity opinions
 *
 * @returns Upper-median severity
 *
 * @example
 * ```ts
 * severityUpperMedian({ severities: ['minor', 'major',], },);
 * ```
 */
function severityUpperMedian(
  { severities, }: { readonly severities: readonly IssueSeverity[]; },
): IssueSeverity {
  /**
   * Opinions sorted least to most severe.
   */
  const sorted = [...severities,].toSorted(function bySeverityRank(
    left,
    right,
  ) {
    return ISSUE_SEVERITIES.indexOf(left,) - ISSUE_SEVERITIES.indexOf(right,);
  },);

  return nonNullishOrThrow(sorted[Math.floor(sorted.length / 2,)],);
}

/**
 * Final severity of one claim:
 * upper median over the claimed severity plus supported ballots' re-grades.
 *
 * @param member - claim under grading
 *
 * @param ballots - resolved ballots keyed by panelist id
 *
 * @returns Final severity for the issue record
 *
 * @example
 * ```ts
 * const severity = finalSeverity({ member, ballots, },);
 * ```
 */
function finalSeverity(
  {
    member,
    ballots,
  }: {
    readonly member: AggregatedClaim;
    readonly ballots: Readonly<Record<string, PanelBallot>>;
  },
): IssueSeverity {
  /**
   * Re-grades from panelists who supported this claim and offered one.
   */
  const regrades = Object
    .values(ballots,)
    .flatMap(function toRegrade(ballot,): readonly IssueSeverity[] {
      /**
       * This panelist's verdict on the claim, when cast.
       */
      const verdict = ballot.verdicts[member.claimId];
      if ((verdict === undefined) || (verdict.vote !== 'supported')
        || (verdict.severity === undefined))
        return [];
      return [verdict.severity,];
    },);

  return severityUpperMedian({ severities: [
    member.claim
      .severity,
    ...regrades,
  ], },);
}

/**
 * Whether one multi-member cluster merges:
 * same-defect weight must strictly exceed distinct weight among opining
 * panelists; silence and ties keep claims distinct because a wrong merge
 * hides a defect while a wrong split only duplicates work.
 *
 * @param cluster - cluster under disposition
 *
 * @param ballots - resolved ballots keyed by panelist id
 *
 * @param config - weight table
 *
 * @returns Whether members become one issue
 *
 * @example
 * ```ts
 * const merged = disposeMerge({ cluster, ballots, config, },);
 * ```
 */
function disposeMerge(
  {
    cluster,
    ballots,
    config,
  }: {
    readonly cluster: ClaimCluster;
    readonly ballots: Readonly<Record<string, PanelBallot>>;
    readonly config: AdjudicationConfig;
  },
): boolean {
  if (cluster.members
    .length
    < 2)
    return false;

  /**
   * Weighted same-defect and distinct opinion masses.
   */
  const {
    same,
    distinct,
  } = Object
    .entries(ballots,)
    .reduce(
      function addOpinion(
        masses: {
          readonly same: number;
          readonly distinct: number
        },
        [panelistId, ballot,],
      ) {
        /**
         * This panelist's opinion on the cluster, when given.
         */
        const opinion = ballot.mergeOpinions[cluster.clusterId];
        if (opinion === undefined)
          return masses;

        /**
         * Weight of this panelist's opinion.
         */
        const weight = config.weights?.[panelistId] ?? 1;
        return opinion
          ? {
            same: masses.same + weight,
            distinct: masses.distinct,
          }
          : {
            same: masses.same,
            distinct: masses.distinct + weight,
          };
      },
      {
        same: 0,
        distinct: 0,
      },
    );

  return same > distinct;
}

/**
 * Deterministic issue identity over member claim ids.
 *
 * @param members - claims forming the issue
 *
 * @returns `adjudicated/<hash>` identifier
 *
 * @example
 * ```ts
 * const issueId = computeIssueId({ members, },);
 * ```
 */
function computeIssueId(
  { members, }: { readonly members: readonly AggregatedClaim[]; },
): string {
  /**
   * Member claim ids sorted for identity stability.
   */
  const ids = members
    .map(function toId(member,) {
      return member.claimId;
    },)
    .toSorted();

  return `adjudicated/${hashContent({ content: JSON.stringify(ids,), },)}`;
}

/**
 * Status of a merged issue from its members' statuses, most protective
 * first: any source-defect blocks the whole issue, any acceptance carries
 * it, any needs-human keeps it open, and only all-rejected rejects.
 *
 * @param statuses - member statuses in member order
 *
 * @returns Merged issue status
 *
 * @example
 * ```ts
 * mergedStatus({ statuses: ['accepted', 'rejected',], },);
 * ```
 */
function mergedStatus(
  { statuses, }: { readonly statuses: readonly AdjudicationStatus[]; },
): AdjudicationStatus {
  if (statuses.includes('source-defect',))
    return 'source-defect';
  if (statuses.includes('accepted',))
    return 'accepted';
  if (statuses.includes('needs-human',))
    return 'needs-human';
  return 'rejected';
}

/**
 * Aggregates panel ballots over one chunk's clusters into adjudicated
 * issues. Pure: same clusters, ballots, and config always produce the same
 * issues, so checkpoints can replay adjudication without model calls.
 *
 * @param clusters - aggregation output, in document order
 *
 * @param ballots - resolved ballots keyed by panelist id; the shell owns
 *   panelist identity, claims never carry it
 *
 * @param config - thresholds and weights; defaults to
 *   {@link DEFAULT_ADJUDICATION_CONFIG}
 *
 * @returns Adjudicated issues in cluster document order
 *
 * @example
 * ```ts
 * const { issues, } = tallyVotes({ clusters, ballots, },);
 * ```
 */
export function tallyVotes(
  {
    clusters,
    ballots,
    config = DEFAULT_ADJUDICATION_CONFIG,
  }: {
    readonly clusters: readonly ClaimCluster[];
    readonly ballots: Readonly<Record<string, PanelBallot>>;
    readonly config?: AdjudicationConfig;
  },
): AdjudicationResult {
  /**
   * One member claim after grading, before issue assembly.
   */
  type GradedMember = {
    readonly member: AggregatedClaim;
    readonly tally: VoteTally;
    readonly status: AdjudicationStatus;
    readonly severity: IssueSeverity;
  };

  /**
   * Issues accumulated in cluster document order.
   */
  const issues = clusters.flatMap(function toIssues(cluster,): readonly AdjudicatedIssue[] {
    /**
     * Per-member tallies, statuses, and severities in member order.
     */
    const graded = cluster.members
      .map(function gradeMember(member,): GradedMember {
      /**
       * Weighted tally for this member claim.
       */
      const tally = tallyClaim({
        claimId: member.claimId,
        ballots,
        config,
      },);

      return {
        member,
        tally,
        status: decideStatus({
          tally,
          config,
        },),
        severity: finalSeverity({
          member,
          ballots,
        },),
      };
    },);

    if (disposeMerge({
      cluster,
      ballots,
      config,
    },)) {
      /**
       * Members whose acceptance drives the merged issue's severity;
       * when none is accepted every member weighs in.
       */
      const severityCarriers = graded.filter(function isAccepted(entry,) {
        return entry.status === 'accepted';
      },);

      return [{
        issueId: computeIssueId({ members: cluster.members, },),
        status: mergedStatus({
          statuses: graded.map(function toStatus(entry,) {
            return entry.status;
          },),
        },),
        severity: severityUpperMedian({
          severities: (severityCarriers.length > 0 ? severityCarriers : graded)
            .map(function toSeverity(entry,) {
              return entry.severity;
            },),
        },),
        claims: cluster.members,
        tallies: Object.fromEntries(graded.map(function toEntry(entry,) {
          return [
            entry.member
              .claimId,
            entry.tally,
          ];
        },),),
      },];
    }

    return graded.map(function toIssue(entry,): AdjudicatedIssue {
      return {
        issueId: computeIssueId({ members: [entry.member,], },),
        status: entry.status,
        severity: entry.severity,
        claims: [entry.member,],
        tallies: { [entry.member
          .claimId]: entry.tally, },
      };
    },);
  },);

  return { issues, };
}

//endregion Vote tally
