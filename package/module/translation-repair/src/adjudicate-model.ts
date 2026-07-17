import type { AggregatedClaim, } from './aggregate-claims.ts';
import type { IssueSeverity, } from './issue-taxonomy.ts';

//region Adjudication model
// Vote vocabulary and result types for the provenance-blind panel. Panelists
// judge each claim strictly on document evidence; they never learn which
// model proposed what, and the electorate is fixed up front (settled
// architecture: a variable electorate of non-proposers shrinks consensus).
// A claim's fate never depends on how many critics proposed it: the
// reference run's sole-proposer seed hit is the standing counterexample.

/**
 * Every vote a panelist may cast on one claim, closed vocabulary.
 * `source-defect` asserts the original text itself is wrong at the claimed
 * spot, which must block "corrections" toward corruption;
 * `abstain` withdraws from the electorate for that claim.
 *
 * @example
 * ```ts
 * PANEL_VOTE_STATES.includes('supported',);
 * ```
 */
export const PANEL_VOTE_STATES = [
  'supported',
  'unsupported',
  'ambiguous',
  'source-defect',
  'abstain',
] as const;

/**
 * One panelist's judgment of one claim.
 *
 * @example
 * ```ts
 * const vote: PanelVoteState = 'supported';
 * ```
 */
export type PanelVoteState = typeof PANEL_VOTE_STATES[number];

/**
 * Guards untrusted vote strings from model JSON.
 *
 * @param value - candidate from unvalidated model output
 *
 * @returns Whether value names one listed vote state
 *
 * @example
 * ```ts
 * isPanelVoteState('supported',);
 * ```
 */
export function isPanelVoteState(value: unknown,): value is PanelVoteState {
  if ((typeof value) !== 'string')
    return false;

  return (PANEL_VOTE_STATES as readonly string[]).includes(value,);
}

/**
 * One resolved verdict inside a ballot:
 * the vote, plus the optional severity re-grade the panel may apply.
 *
 * @example
 * ```ts
 * const verdict: BallotVerdict = { vote: 'supported', severity: 'major', };
 * ```
 */
export type BallotVerdict = {
  /**
   * Vote cast on this claim.
   */
  readonly vote: PanelVoteState;

  /**
   * Re-graded severity, when the panelist disagrees with the claimed one.
   */
  readonly severity?: IssueSeverity;
};

/**
 * One panelist's complete resolved ballot over one chunk's clusters.
 * Missing claims count as abstentions at tally time, so a panelist who
 * answers half the sheet weakens only its own influence.
 *
 * @example
 * ```ts
 * const ballot: PanelBallot = {
 *   verdicts: { 'issue/abc': { vote: 'supported', }, },
 *   mergeOpinions: { 'cluster/def': true, },
 *   findings: [],
 * };
 * ```
 */
export type PanelBallot = {
  /**
   * Verdicts keyed by claim id.
   */
  readonly verdicts: Readonly<Record<string, BallotVerdict>>;

  /**
   * Same-defect opinions keyed by cluster id,
   * only meaningful for multi-member clusters.
   */
  readonly mergeOpinions: Readonly<Record<string, boolean>>;

  /**
   * Wire irregularities in scorecard-stable wording
   * (duplicate verdicts, out-of-range indices, unknown vote strings).
   */
  readonly findings: readonly string[];
};

/**
 * Fate of one adjudicated issue.
 * `source-defect` outranks acceptance because correcting toward a corrupted
 * original is worse than leaving the translation alone.
 *
 * @example
 * ```ts
 * const status: AdjudicationStatus = 'accepted';
 * ```
 */
export type AdjudicationStatus =
  | 'accepted'
  | 'rejected'
  | 'needs-human'
  | 'source-defect';

/**
 * Weighted vote counts over one claim, kept on the issue for calibration
 * and steering; weights default to one per panelist until canary
 * calibration supplies better ones.
 *
 * @example
 * ```ts
 * const tally: VoteTally = {
 *   supported: 3, unsupported: 1, ambiguous: 0, sourceDefect: 0, abstain: 1,
 * };
 * ```
 */
export type VoteTally = {
  /**
   * Weight behind supported votes.
   */
  readonly supported: number;

  /**
   * Weight behind unsupported votes.
   */
  readonly unsupported: number;

  /**
   * Weight behind ambiguous votes.
   */
  readonly ambiguous: number;

  /**
   * Weight behind source-defect votes.
   */
  readonly sourceDefect: number;

  /**
   * Weight behind abstentions, explicit or from missing verdicts.
   */
  readonly abstain: number;
};

/**
 * One issue after the panel spoke.
 * Merged issues carry every member claim so the editor sees the best
 * evidence; per-claim tallies stay attached for calibration.
 *
 * @example
 * ```ts
 * const issue: AdjudicatedIssue = {
 *   issueId: 'adjudicated/abc',
 *   status: 'accepted',
 *   severity: 'major',
 *   claims: [member,],
 *   tallies: { 'issue/abc': tally, },
 * };
 * ```
 */
export type AdjudicatedIssue = {
  /**
   * Deterministic `adjudicated/<hash>` identity over sorted member claim ids.
   */
  readonly issueId: string;

  /**
   * Fate decided by the tally rules.
   */
  readonly status: AdjudicationStatus;

  /**
   * Final severity: upper median over member claim severities plus
   * supported ballots' re-grades.
   */
  readonly severity: IssueSeverity;

  /**
   * Member claims, atomic as proposed.
   */
  readonly claims: readonly AggregatedClaim[];

  /**
   * Per-claim weighted tallies keyed by claim id.
   */
  readonly tallies: Readonly<Record<string, VoteTally>>;
};

/**
 * Tally rules; every knob is calibratable by the scorecard later.
 *
 * @example
 * ```ts
 * const config: AdjudicationConfig = DEFAULT_ADJUDICATION_CONFIG;
 * ```
 */
export type AdjudicationConfig = {
  /**
   * Minimum non-abstain weight before any decision;
   * below it the claim lands needs-human.
   */
  readonly minBallotWeight: number;

  /**
   * Fraction of non-abstain weight supported votes must strictly exceed
   * for acceptance; the same fraction gates rejection symmetrically.
   */
  readonly decisionThreshold: number;

  /**
   * Fraction of non-abstain weight at which source-defect votes block the
   * issue; deliberately lower than the decision threshold because a
   * protective minority suffices against correcting toward corruption.
   */
  readonly sourceDefectThreshold: number;

  /**
   * Vote weight per panelist id; absent panelists weigh one.
   */
  readonly weights?: Readonly<Record<string, number>>;
};

/**
 * Denominator of the protective minority fraction: one third of the
 * electorate flagging a source defect suffices to block, because
 * correcting toward corruption is the costlier mistake.
 */
const SOURCE_DEFECT_BLOCK_DENOMINATOR = 3;

/**
 * Defaults until canary calibration supplies weights:
 * strict majority decides, three ballots minimum, one-third blocks on
 * suspected source defects.
 */
export const DEFAULT_ADJUDICATION_CONFIG: AdjudicationConfig = {
  minBallotWeight: 3,
  decisionThreshold: 1 / 2,
  sourceDefectThreshold: 1 / SOURCE_DEFECT_BLOCK_DENOMINATOR,
};

//endregion Adjudication model
