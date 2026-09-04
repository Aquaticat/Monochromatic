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
 * Whether a contest choice may ship, and the deterministic findings when not.
 */
export type LaneContestChoiceVerdict = {
  /**
   * Whether the selected lane passes the publication rules.
   */
  readonly mayShip: boolean;

  /**
   * Findings behind a refusal, empty on a pass.
   */
  readonly findings: readonly string[];
};

/**
 * Verdict on whether the selected lane may cross the publication boundary,
 * with the deterministic findings behind a refusal.
 *
 * THE FINDINGS ARE FOR THE RUN LOG: a refusal the log names is a defect
 * class the next reading finds in one grep, where "fails publication
 * invariants" alone sent the 2026-09-04 luxuanwen3 reading into the slice
 * records to learn that a link destination the archive had rewritten was
 * the cause.
 *
 * @param outcome - contest outcome after eligibility filtering
 *
 * @param sourceText - original slice
 *
 * @param incumbentText - page text being replaced
 *
 * @param repairText - repair lane candidate
 *
 * @param translateText - translate lane candidate
 *
 * @param syntax - explicit syntax role, absent for ordinary prose
 *
 * @returns Whether the choice may ship, and why not when it may not
 *
 * @example
 * ```ts
 * const verdict = laneContestChoiceVerdict({ outcome, sourceText, incumbentText, repairText, translateText, },);
 * ```
 */
export function laneContestChoiceVerdict(
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
): LaneContestChoiceVerdict {
  if (outcome.choice === 'neither') {
    if (syntax === undefined)
      return {
        mayShip: true,
        findings: [],
      };
    /**
     * Findings distinguishing genuine decline from no safe eligible winner.
     */
    const { findings, } = outcome;
    /**
     * Whether the decline stands for an eligible slate that was empty.
     */
    const floored = findings.includes(LANE_CONTEST_ELIGIBILITY_FLOOR_FINDING,);
    return {
      mayShip: !floored,
      findings: floored ? [LANE_CONTEST_ELIGIBILITY_FLOOR_FINDING,] : [],
    };
  }
  /**
   * Exact selected lane candidate.
   */
  const candidateText = (outcome.choice === 'repair')
    ? repairText
    : translateText;
  /**
   * Final deterministic eligibility for syntax and ordinary contributor authority.
   */
  const validation = validateTranslatedSlice({
    sourceText,
    candidateText,
    pageText: incumbentText,
    ...((syntax === undefined) ? {} : { syntax, }),
  },);
  if (validation.kind === 'valid')
    return {
      mayShip: true,
      findings: [],
    };
  if (validation.kind === 'invalid')
    return {
      mayShip: false,
      findings: validation.findings,
    };
  return {
    mayShip: false,
    findings: [`no comparison was possible: ${validation.detail}`,],
  };
}

/**
 * Reports whether contest winner can cross final publication boundary.
 *
 * ORDINARY PROSE KEEPS ROSTER VERDICT only after contributor-authority floor.
 * Front matter is syntax-bearing and has deterministic identity invariants,
 * so a lane that violates them cannot become warm-run terminal evidence merely because enough ballots selected it.
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
  /**
   * Verdict whose findings this boolean form drops.
   */
  const verdict = laneContestChoiceVerdict({
    outcome,
    sourceText,
    incumbentText,
    repairText,
    translateText,
    ...((syntax === undefined) ? {} : { syntax, }),
  },);
  return verdict.mayShip;
}

//endregion Lane contest publication eligibility
