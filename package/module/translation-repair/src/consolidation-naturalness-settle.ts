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
import { hashContent, } from './document-node.ts';
import { NaturalnessRepairInterruptedError, } from './naturalness-repair-interrupted-error.ts';
import type { PriorNaturalnessCorrection, } from './refine-selection-context.ts';
import {
  describeReviewFindings,
  uniqueRosterModelIds,
} from './consolidation-naturalness-state.ts';
import type { RepairJudgedRound, } from './repair-round-record.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Continuous absolute-naturalness settlement

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
  readonly correctionCount: number;

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
   * Earlier acceptable readings before decisive same-candidate reviews.
   */
  readonly confirmationRounds: readonly AbsoluteNaturalnessReviewOutcome[];

  /**
   * Digest-bound successful correction transitions.
   */
  readonly corrections: readonly ConsolidationNaturalnessCorrectionAudit[];

  /**
   * Failed strategies shown to later corrections so prompts remain substantive and unique.
   */
  readonly priorCorrections: readonly PriorNaturalnessCorrection[];
};

/**
 * Combines one reviewed correction with prior continuous state.
 *
 * @param state - evidence before attempt
 *
 * @param correction - attempted generation and gate
 *
 * @param correctionCount - successful digest-bound correction count
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
    readonly correctionCount: number;
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
    confirmationRounds: [
      ...state.confirmationRounds,
      ...step.confirmations,
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
 * @param state - continuous correction state
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
    confirmations: state.confirmationRounds,
  };
}

/**
 * Projects accepted correction state into publishable polish.
 *
 * @param state - latest accepted continuous state
 *
 * @param baseText - original approved fidelity baseline
 *
 * @returns Settled publication carrying complete transition audit
 *
 * @example
 * ```ts
 * const polish = settledPolish({ state, baseText, });
 * ```
 */
function settledPolish(
  {
    state,
    baseText,
  }: {
    readonly state: CorrectionState;
    readonly baseText: string;
  },
): ConsolidationPolish {
  /**
   * Latest exact accepted round projected into terminal settlement.
   */
  const { current, } = state;
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

/**
 * Continues required correction until exact candidate passes or operation pauses.
 *
 * Every correction consumes latest exact rejected text and latest structured findings.
 * No quality rejection returns terminal refusal.
 * No-change and thin-review states pause as operational interruptions because
 * resending same substantive task would violate model-prompt uniqueness.
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
 * @param initialReview - decisive initial absolute rejection
 *
 * @param initialConfirmations - earlier acceptable initial-candidate readings
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
 * @param signal - caller cancellation bounding correction loop
 *
 * @param perCallTimeoutMs - per-exchange deadline
 *
 * @param l - parent logger
 *
 * @returns Settled exact text after strict acceptance
 *
 * @throws {@link NaturalnessRepairInterruptedError} when no unique correction or review task remains
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
    initialConfirmations,
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
    readonly initialConfirmations: readonly AbsoluteNaturalnessReviewOutcome[];
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
  {
    /**
     * Latest exact rejected state feeding next correction.
     */
    let state: CorrectionState = {
      current: initial,
      currentReview: initialReview,
      correctionCount: 0,
      refinersHeard: initial.refinersHeard,
      contributors: initial.contributors,
      rounds: initial.rounds,
      findings: initial.findings,
      reviewRounds: [initialReview,],
      confirmationRounds: initialConfirmations,
      corrections: [],
      priorCorrections: [],
    };
    /**
     * Correction task identities already attempted in this invocation.
     */
    const correctionTasks = new Set<string>();

    while (!signal.aborted) {
      /**
       * Latest exact candidate and review feeding correction.
       */
      const {
        current,
        currentReview,
      } = state;
      /**
       * Exact correction question identity preventing cached deterministic cycle.
       */
      const taskDigest = hashContent({
        content: JSON.stringify({
          rejectedText: current.text,
          findings: currentReview.findings,
          priorCorrections: state.priorCorrections,
        },),
      },);
      if (correctionTasks.has(taskDigest,)) {
        throw new NaturalnessRepairInterruptedError({
          reason: 'correction-cycle',
        },);
      }
      correctionTasks.add(taskDigest,);
      /**
       * One correction from latest rejected text and findings.
       */
      // oxlint-disable-next-line no-await-in-loop -- each rejection supplies next correction's exact input
      const step = await runNaturalnessCorrection({
        client,
        sourceText,
        archiveText,
        rejectedText: current.text,
        rejection: currentReview,
        priorCorrections: state.priorCorrections,
        ...((syntax === undefined) ? {} : { syntax, }),
        lineStructured,
        ...((identityContext === undefined) ? {} : { identityContext, }),
        sliceIndex,
        config,
        signal,
        perCallTimeoutMs,
        l,
      },);
      if (step.kind === 'no-correction') {
        /**
         * Failed correction round retained as next strategy evidence.
         */
        const { correction, } = step;
        /**
         * Failed strategy retained as substantive evidence for different next prompt.
         */
        const failed: PriorNaturalnessCorrection = {
          candidateText: correction.proposedText,
          findings: correction.findings,
        };
        state = {
          ...incorporateAttempt({
            state,
            correction,
            correctionCount: state.correctionCount,
          },),
          priorCorrections: [
            ...state.priorCorrections,
            failed,
          ],
        };
        continue;
      }
      /**
       * Changed correction and exact review for this transition.
       */
      const {
        correction,
        review,
      } = step;
      /**
       * Successful changed transition and exact review added to accumulated audit.
       */
      const reviewed = incorporateReview({
        state: incorporateAttempt({
          state,
          correction,
          correctionCount: state.correctionCount + 1,
        },),
        step,
      },);
      /**
       * Exact corrected candidate verdict.
       */
      const { verdict, } = review;
      if (verdict === 'acceptable') {
        return settledPolish({
          state: reviewed,
          baseText,
        },);
      }
      if (verdict === 'quorum-not-met') {
        throw new NaturalnessRepairInterruptedError({
          reason: 'quorum-not-met',
        },);
      }
      /**
       * Reviewed rejection retained so later strategy cannot cycle without evidence.
       */
      const rejected: PriorNaturalnessCorrection = {
        candidateText: correction.text,
        findings: describeReviewFindings({ review, },),
      };
      state = {
        ...reviewed,
        priorCorrections: [
          ...reviewed.priorCorrections,
          rejected,
        ],
      };
    }
    throw signal.reason;
  }
}

//endregion Continuous absolute-naturalness settlement
