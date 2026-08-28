import type { SliceSyntax, } from './chunk-document.ts';
import {
  type LaneContestOutcome,
  settleLaneContestBallots,
} from './lane-contest-stage.ts';
import type {
  LaneChoice,
  LaneContestBallot,
} from './lane-contest-wire.ts';
import { validateTranslatedSlice, } from './translate-validate.ts';

//region Lane contest publication eligibility

/**
 * Deterministic publication eligibility of syntax-bearing contest candidates.
 *
 * Source text is retained so artifact reader can recompute these claims rather
 * than trusting stored booleans.
 *
 * @example
 * ```ts
 * const eligibility: LaneContestEligibility = { syntax: 'front-matter', sourceText, archive: 'ineligible', repair: 'ineligible', translate: 'eligible', };
 * ```
 */
export type LaneContestEligibility = {
  /**
   * Syntax policy producing these readings.
   */
  readonly syntax: 'front-matter';

  /**
   * Original syntax-bearing slice governing identity relationships.
   */
  readonly sourceText: string;

  /**
   * Whether archive can cross final publication boundary.
   */
  readonly archive: 'eligible' | 'ineligible';

  /**
   * Whether repair candidate can cross final publication boundary.
   */
  readonly repair: 'eligible' | 'ineligible';

  /**
   * Whether translate candidate can cross final publication boundary.
   */
  readonly translate: 'eligible' | 'ineligible';
};

/**
 * Stable finding marking raw choices excluded by deterministic admission.
 */
export const LANE_CONTEST_ELIGIBILITY_FLOOR_FINDING = 'lane-contest-eligibility-floor (inadmissible choices excluded)';

/**
 * Reads one candidate against syntax-bearing publication invariants.
 *
 * @param sourceText - original syntax-bearing slice
 *
 * @param incumbentText - archive metadata defining compatible shape
 *
 * @param candidateText - candidate under deterministic admission
 *
 * @returns Eligibility status
 *
 * @example
 * ```ts
 * const status = candidateEligibility({ sourceText, incumbentText, candidateText, });
 * ```
 */
function candidateEligibility(
  {
    sourceText,
    incumbentText,
    candidateText,
  }: {
    readonly sourceText: string;
    readonly incumbentText: string;
    readonly candidateText: string;
  },
): LaneContestEligibility['archive'] {
  /**
   * Structural result under final syntax policy.
   */
  const validation = validateTranslatedSlice({
    sourceText,
    candidateText,
    pageText: incumbentText,
    syntax: 'front-matter',
  },);
  return validation.kind === 'valid' ? 'eligible' : 'ineligible';
}

/**
 * Computes deterministic eligibility for every front matter candidate.
 *
 * @param sourceText - original metadata
 *
 * @param incumbentText - archive metadata
 *
 * @param repairText - repair lane candidate
 *
 * @param translateText - translate lane candidate
 *
 * @returns Source-backed candidate eligibility record
 *
 * @example
 * ```ts
 * const eligibility = frontMatterContestEligibility({ sourceText, incumbentText, repairText, translateText, });
 * ```
 */
export function frontMatterContestEligibility(
  {
    sourceText,
    incumbentText,
    repairText,
    translateText,
  }: {
    readonly sourceText: string;
    readonly incumbentText: string;
    readonly repairText: string;
    readonly translateText: string;
  },
): LaneContestEligibility {
  return {
    syntax: 'front-matter',
    sourceText,
    archive: candidateEligibility({
      sourceText,
      incumbentText,
      candidateText: incumbentText,
    },),
    repair: candidateEligibility({
      sourceText,
      incumbentText,
      candidateText: repairText,
    },),
    translate: candidateEligibility({
      sourceText,
      incumbentText,
      candidateText: translateText,
    },),
  };
}

/**
 * Reads contest winner after deterministically inadmissible votes are excluded.
 *
 * Raw ballots remain unchanged for audit. A vote for invalid lane contributes
 * to neither lane; it is never redirected into vote for valid alternative.
 *
 * @param ballots - raw usable ballots
 *
 * @param eligibility - source-backed candidate admission
 *
 * @returns Eligible lane with normal quorum and strict lead, or neither
 *
 * @example
 * ```ts
 * const choice = settleEligibleLaneContestBallots({ ballots, eligibility, });
 * ```
 */
export function settleEligibleLaneContestBallots(
  {
    ballots,
    eligibility,
  }: {
    readonly ballots: readonly LaneContestBallot[];
    readonly eligibility?: LaneContestEligibility;
  },
): LaneChoice {
  if (eligibility === undefined)
    return settleLaneContestBallots({ ballots, },);
  /**
   * Raw ballots whose chosen lane may cross publication boundary.
   */
  const effectiveBallots = ballots.filter(function choseEligible(ballot,): boolean {
    if (ballot.choice === 'neither')
      return true;
    return eligibility[ballot.choice] === 'eligible';
  },);
  return settleLaneContestBallots({ ballots: effectiveBallots, },);
}

/**
 * Applies deterministic eligibility floor to raw contest outcome.
 *
 * @param outcome - raw roster outcome
 *
 * @param eligibility - source-backed candidate admission
 *
 * @returns Same raw ballots with effective eligible choice
 *
 * @example
 * ```ts
 * const admitted = applyLaneContestEligibility({ outcome, eligibility, });
 * ```
 */
export function applyLaneContestEligibility(
  {
    outcome,
    eligibility,
  }: {
    readonly outcome: LaneContestOutcome;
    readonly eligibility?: LaneContestEligibility;
  },
): LaneContestOutcome {
  /**
   * Effective choice after candidate admission.
   */
  const choice = settleEligibleLaneContestBallots({
    ballots: outcome.ballots,
    ...((eligibility === undefined) ? {} : { eligibility, }),
  },);
  /**
   * Whether raw roster spent any ballot on deterministically invalid lane.
   */
  /**
   * Raw ballots retained without candidate redirection.
   */
  const { ballots, } = outcome;
  /**
   * Whether any raw choice named candidate publication guard rejects.
   */
  const excluded = (eligibility === undefined)
    ? false
    : ballots
      .some(function choseInvalid(ballot,): boolean {
        return (ballot.choice !== 'neither')
          && (eligibility[ballot.choice] === 'ineligible');
      },);
  if (!excluded)
    return outcome;
  return {
    ...outcome,
    choice,
    findings: [
      ...outcome.findings,
      LANE_CONTEST_ELIGIBILITY_FLOOR_FINDING,
    ],
  };
}

/**
 * Reports whether contest winner can cross final publication boundary.
 *
 * ORDINARY PROSE KEEPS ROSTER VERDICT. Front matter is syntax-bearing and has
 * deterministic identity invariants, so a lane that violates them cannot
 * become warm-run terminal evidence merely because enough ballots selected it.
 * A declined contest remains retryable through consolidation and therefore has
 * no selected lane to reject here.
 *
 * @param outcome - contest result whose selected lane is checked
 *
 * @param sourceText - original metadata
 *
 * @param incumbentText - archive metadata defining compatible YAML shape
 *
 * @param repairText - repair lane candidate
 *
 * @param translateText - translate lane candidate
 *
 * @param syntax - explicit syntax role, absent for ordinary prose
 *
 * @returns Whether selected lane is structurally publishable
 *
 * @example
 * ```ts
 * const mayShip = laneContestChoiceMayShip({ outcome, sourceText, incumbentText, repairText, translateText, syntax: 'front-matter', });
 * ```
 */
export function laneContestChoiceMayShip(
  {
    outcome,
    sourceText,
    incumbentText,
    repairText,
    translateText,
    syntax,
  }: {
    readonly outcome: LaneContestOutcome;
    readonly sourceText: string;
    readonly incumbentText: string;
    readonly repairText: string;
    readonly translateText: string;
    readonly syntax?: SliceSyntax;
  },
): boolean {
  if (syntax === undefined)
    return true;
  if (outcome.choice === 'neither') {
    /**
     * Findings distinguishing genuine decline from no safe eligible winner.
     */
    const { findings, } = outcome;
    return !findings.includes(LANE_CONTEST_ELIGIBILITY_FLOOR_FINDING,);
  }
  /**
   * Candidate statuses under source-backed syntax policy.
   */
  const eligibility = frontMatterContestEligibility({
    sourceText,
    incumbentText,
    repairText,
    translateText,
  },);
  return eligibility[outcome.choice] === 'eligible';
}

//endregion Lane contest publication eligibility
