import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AbsoluteNaturalnessReviewOutcome, } from './absolute-naturalness-review-stage.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import type { SliceSyntax, } from './chunk-document.ts';
import {
  runNaturalnessCorrection,
  type NaturalnessCorrectionStep,
} from './consolidation-naturalness-correction.ts';
import type {
  ConsolidationNaturalnessAudit,
  ConsolidationNaturalnessCorrectionAudit,
  ConsolidationPolish,
  ConsolidationPolishConfig,
} from './consolidation-polish-model.ts';
import type { ConsolidationPolishRoundResult, } from './consolidation-polish-round.ts';
import type { RepairJudgedRound, } from './repair-round-record.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Bounded absolute-naturalness settlement

/**
 * Accumulated evidence after initial generation and zero or more corrections.
 */
type CorrectionState = {
  /**
   * Latest exact reviewed round.
   */
  readonly current: ConsolidationPolishRoundResult;

  /**
   * Latest exact absolute review.
   */
  readonly currentReview: AbsoluteNaturalnessReviewOutcome;

  /**
   * Dedicated correction generations consumed.
   */
  readonly correctionCount: 0 | 1 | 2;

  /**
   * Usable rewriters across generations.
   */
  readonly refinersHeard: readonly RosterModelId[];

  /**
   * Credits carried by selected wording.
   */
  readonly contributors: readonly RosterModelId[];

  /**
   * Candidate selection rounds across generations.
   */
  readonly rounds: readonly RepairJudgedRound[];

  /**
   * Stable generation and review telemetry.
   */
  readonly findings: readonly string[];

  /**
   * Exact absolute reviews in execution order.
   */
  readonly reviewRounds: readonly AbsoluteNaturalnessReviewOutcome[];

  /**
   * Digest-bound successful correction transitions.
   */
  readonly corrections: readonly ConsolidationNaturalnessCorrectionAudit[];
};

/**
 * Deduplicates model credits while preserving first occurrence.
 *
 * @param modelIds - credits across bounded generations
 *
 * @returns Stable unique model ids
 *
 * @example
 * ```ts
 * const unique = uniqueRosterModelIds({ modelIds, });
 * ```
 */
function uniqueRosterModelIds(
  { modelIds, }: { readonly modelIds: readonly RosterModelId[]; },
): readonly RosterModelId[] {
  return [...new Set(modelIds,),];
}

/**
 * Renders latest structured findings for stage telemetry.
 *
 * @param review - exact rejected review feeding correction
 *
 * @returns Paragraph-located descriptions
 *
 * @example
 * ```ts
 * const findings = describeReviewFindings({ review, });
 * ```
 */
function describeReviewFindings(
  { review, }: { readonly review: AbsoluteNaturalnessReviewOutcome; },
): readonly string[] {
  return review.findings
    .map(function describe(finding,): string {
      return `Paragraph ${String(finding.paragraph,)}: ${finding.problem}`;
    },);
}

/**
 * Combines one attempted correction with prior bounded state.
 *
 * @param state - evidence before attempt
 *
 * @param correction - attempted generation and gate
 *
 * @param correctionCount - one-based bounded attempt count
 *
 * @returns State carrying attempt telemetry before next review
 *
 * @example
 * ```ts
 * const attempted = incorporateAttempt({ state, correction, correctionCount: 1, });
 * ```
 */
function incorporateAttempt(
  {
    state,
    correction,
    correctionCount,
  }: {
    readonly state: CorrectionState;
    readonly correction: ConsolidationPolishRoundResult;
    readonly correctionCount: 1 | 2;
  },
): CorrectionState {
  return {
    ...state,
    current: correction,
    correctionCount,
    refinersHeard: uniqueRosterModelIds({
      modelIds: [
        ...state.refinersHeard,
        ...correction.refinersHeard,
      ],
    },),
    contributors: uniqueRosterModelIds({
      modelIds: [
        ...state.contributors,
        ...correction.contributors,
      ],
    },),
    rounds: [
      ...state.rounds,
      ...correction.rounds,
    ],
    findings: [
      ...state.findings,
      ...describeReviewFindings({ review: state.currentReview, },),
      ...correction.findings,
    ],
  };
}

/**
 * Adds exact review and digest transition after gated changed text.
 *
 * @param state - attempted correction state
 *
 * @param step - reviewed correction transition
 *
 * @returns State bound to latest exact candidate review
 *
 * @example
 * ```ts
 * const reviewed = incorporateReview({ state, step, });
 * ```
 */
function incorporateReview(
  {
    state,
    step,
  }: {
    readonly state: CorrectionState;
    readonly step: Extract<NaturalnessCorrectionStep, { readonly kind: 'reviewed'; }>;
  },
): CorrectionState {
  return {
    ...state,
    currentReview: step.review,
    reviewRounds: [
      ...state.reviewRounds,
      step.review,
    ],
    corrections: [
      ...state.corrections,
      step.audit,
    ],
  };
}

/**
 * Projects accumulated review state into artifact-facing audit.
 *
 * @param state - bounded correction state
 *
 * @returns Exact review rounds and transition chain
 *
 * @example
 * ```ts
 * const audit = reviewAudit({ state, });
 * ```
 */
function reviewAudit(
  { state, }: { readonly state: CorrectionState; },
): ConsolidationNaturalnessAudit {
  return {
    correctionCount: state.correctionCount,
    corrections: state.corrections,
    rounds: state.reviewRounds,
  };
}

/**
 * Returns terminal polish from one correction state.
 *
 * @param state - latest bounded state
 *
 * @param baseText - original approved fidelity baseline
 *
 * @param accepted - whether latest exact absolute review accepted
 *
 * @param reason - terminal refusal telemetry when rejected
 *
 * @returns Settled publication or retryable refusal
 *
 * @example
 * ```ts
 * const polish = terminalPolish({ state, baseText, accepted: true, });
 * ```
 */
function terminalPolish(
  {
    state,
    baseText,
    accepted,
    reason,
  }: {
    readonly state: CorrectionState;
    readonly baseText: string;
    readonly accepted: boolean;
    readonly reason?: string;
  },
): ConsolidationPolish {
  /**
   * Latest exact round projected into terminal settlement.
   */
  const { current, } = state;
  if (accepted) {
    return {
      kind: 'settled',
      baseText,
      proposedText: current.proposedText,
      text: current.text,
      changed: current.text !== baseText,
      refinersHeard: state.refinersHeard,
      contributors: state.contributors,
      rounds: state.rounds,
      ...((current.gate === undefined) ? {} : { gate: current.gate, }),
      review: reviewAudit({ state, },),
      findings: state.findings,
    };
  }
  return {
    kind: 'unsettled',
    baseText,
    proposedText: current.proposedText,
    refinersHeard: state.refinersHeard,
    contributors: state.contributors,
    rounds: state.rounds,
    ...((current.gate === undefined) ? {} : { gate: current.gate, }),
    review: reviewAudit({ state, },),
    findings: [
      ...state.findings,
      ...(reason === undefined ? [] : [reason,]),
    ],
  };
}

/**
 * Runs at most two sequential required corrections after initial rejection.
 *
 * @param client - provider client
 *
 * @param sourceText - Chinese fidelity anchor
 *
 * @param archiveText - archived English evidence
 *
 * @param baseText - original approved fidelity baseline
 *
 * @param initial - initial comparative polish round
 *
 * @param initialReview - exact initial absolute rejection
 *
 * @param syntax - explicit syntax role when present
 *
 * @param lineStructured - source line-boundary policy
 *
 * @param identityContext - declared identities corrections preserve
 *
 * @param sliceIndex - prepared slice position
 *
 * @param config - correction, selection, and gate rosters
 *
 * @param signal - caller cancellation
 *
 * @param perCallTimeoutMs - per-exchange deadline
 *
 * @param l - parent logger
 *
 * @returns Settled exact text or retryable bounded refusal
 *
 * @example
 * ```ts
 * const polish = await settleNaturalnessCorrections({ client, sourceText, archiveText, baseText, initial, initialReview, lineStructured, sliceIndex, config, signal, perCallTimeoutMs, l, });
 * ```
 */
export async function settleNaturalnessCorrections(
  {
    client,
    sourceText,
    archiveText,
    baseText,
    initial,
    initialReview,
    syntax,
    lineStructured,
    identityContext,
    sliceIndex,
    config,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly sourceText: string;
    readonly archiveText: string;
    readonly baseText: string;
    readonly initial: ConsolidationPolishRoundResult;
    readonly initialReview: AbsoluteNaturalnessReviewOutcome;
    readonly syntax?: SliceSyntax;
    readonly lineStructured: boolean;
    readonly identityContext?: string;
    readonly sliceIndex: number;
    readonly config: ConsolidationPolishConfig;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<ConsolidationPolish> {
  /**
   * Rejected starting state before dedicated correction.
   */
  const initialState: CorrectionState = {
    current: initial,
    currentReview: initialReview,
    correctionCount: 0,
    refinersHeard: initial.refinersHeard,
    contributors: initial.contributors,
    rounds: initial.rounds,
    findings: initial.findings,
    reviewRounds: [initialReview,],
    corrections: [],
  };
  /**
   * First required correction transition.
   */
  const firstStep = await runNaturalnessCorrection({
    client,
    sourceText,
    archiveText,
    rejectedText: initial.text,
    rejection: initialReview,
    ...((syntax === undefined) ? {} : { syntax, }),
    lineStructured,
    ...((identityContext === undefined) ? {} : { identityContext, }),
    sliceIndex,
    config,
    signal,
    perCallTimeoutMs,
    l,
  },);
  /**
   * State including first generation and fidelity outcome.
   */
  const firstAttempt = incorporateAttempt({
    state: initialState,
    correction: firstStep.correction,
    correctionCount: 1,
  },);
  if (firstStep.kind === 'no-correction') {
    return terminalPolish({
      state: firstAttempt,
      baseText,
      accepted: false,
      reason: 'absolute-naturalness correction made no approved text change',
    },);
  }
  /**
   * State including exact first corrected-text review.
   */
  const firstReviewed = incorporateReview({
    state: firstAttempt,
    step: firstStep,
  },);
  /**
   * First corrected candidate verdict.
   */
  const { verdict: firstVerdict, } = firstStep.review;
  if (firstVerdict === 'acceptable') {
    return terminalPolish({
      state: firstReviewed,
      baseText,
      accepted: true,
    },);
  }
  if (firstVerdict === 'quorum-not-met') {
    return terminalPolish({
      state: firstReviewed,
      baseText,
      accepted: false,
      reason: 'absolute-naturalness-review quorum not met',
    },);
  }
  /**
   * Exact first correction and review feeding second attempt.
   */
  const {
    correction: firstCorrection,
    review: firstCorrectionReview,
  } = firstStep;
  /**
   * Second and final required correction transition.
   */
  const secondStep = await runNaturalnessCorrection({
    client,
    sourceText,
    archiveText,
    rejectedText: firstCorrection.text,
    rejection: firstCorrectionReview,
    ...((syntax === undefined) ? {} : { syntax, }),
    lineStructured,
    ...((identityContext === undefined) ? {} : { identityContext, }),
    sliceIndex,
    config,
    signal,
    perCallTimeoutMs,
    l,
  },);
  /**
   * State including second generation and fidelity outcome.
   */
  const secondAttempt = incorporateAttempt({
    state: firstReviewed,
    correction: secondStep.correction,
    correctionCount: 2,
  },);
  if (secondStep.kind === 'no-correction') {
    return terminalPolish({
      state: secondAttempt,
      baseText,
      accepted: false,
      reason: 'second absolute-naturalness correction made no approved text change',
    },);
  }
  /**
   * State including exact second corrected-text review.
   */
  const secondReviewed = incorporateReview({
    state: secondAttempt,
    step: secondStep,
  },);
  /**
   * Second corrected candidate verdict.
   */
  const { verdict: secondVerdict, } = secondStep.review;
  if (secondVerdict === 'acceptable') {
    return terminalPolish({
      state: secondReviewed,
      baseText,
      accepted: true,
    },);
  }
  return terminalPolish({
    state: secondReviewed,
    baseText,
    accepted: false,
    reason: (secondVerdict === 'quorum-not-met')
      ? 'absolute-naturalness-review quorum not met'
      : 'absolute-naturalness remained unacceptable after two corrections',
  },);
}

//endregion Bounded absolute-naturalness settlement
