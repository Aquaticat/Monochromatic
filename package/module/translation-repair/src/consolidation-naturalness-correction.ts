import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  type AbsoluteNaturalnessReviewOutcome,
  reviewAbsoluteNaturalness,
} from './absolute-naturalness-review-stage.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import type { SliceSyntax, } from './chunk-document.ts';
import type {
  ConsolidationNaturalnessCorrectionAudit,
  ConsolidationPolishConfig,
} from './consolidation-polish-model.ts';
import {
  finalPolishParagraphs,
  type ConsolidationPolishRoundResult,
  runConsolidationPolishRound,
} from './consolidation-polish-round.ts';
import { hashContent, } from './document-node.ts';

//region One absolute-naturalness correction transition

/**
 * One required correction and, when gated text changed, its exact review.
 *
 * @example
 * ```ts
 * const step: NaturalnessCorrectionStep = { kind: 'no-correction', correction, };
 * ```
 */
export type NaturalnessCorrectionStep =
  | {
    /**
     * Generation, selection, structure, or fidelity retained rejected input.
     */
    readonly kind: 'no-correction';

    /**
     * Auditable attempted correction round.
     */
    readonly correction: ConsolidationPolishRoundResult;
  }
  | {
    /**
     * Gated changed text reached exact absolute review.
     */
    readonly kind: 'reviewed';

    /**
     * Auditable selected and gated correction round.
     */
    readonly correction: ConsolidationPolishRoundResult;

    /**
     * Absolute review over exact gated correction text.
     */
    readonly review: AbsoluteNaturalnessReviewOutcome;

    /**
     * Digest chain from rejected input through findings to gated text.
     */
    readonly audit: ConsolidationNaturalnessCorrectionAudit;
  };

/**
 * Hashes structured findings in reviewer-derived canonical order.
 *
 * @param review - exact review whose findings correction receives
 *
 * @returns Digest binding correction input to structured review evidence
 *
 * @example
 * ```ts
 * const digest = naturalnessFindingsDigest({ review, });
 * ```
 */
export function naturalnessFindingsDigest(
  { review, }: { readonly review: AbsoluteNaturalnessReviewOutcome; },
): string {
  return hashContent({ content: JSON.stringify(review.findings,), },);
}

/**
 * Runs one correction from exact rejected text through fidelity and next review.
 *
 * @param client - provider client
 *
 * @param sourceText - Chinese fidelity anchor
 *
 * @param archiveText - archived English evidence
 *
 * @param rejectedText - exact text latest review rejected
 *
 * @param rejection - latest exact candidate-bound absolute review
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
 * @returns No-correction terminal result or reviewed digest-bound transition
 *
 * @example
 * ```ts
 * const step = await runNaturalnessCorrection({ client, sourceText, archiveText, rejectedText, rejection, lineStructured, sliceIndex, config, signal, perCallTimeoutMs, l, });
 * ```
 */
export async function runNaturalnessCorrection(
  {
    client,
    sourceText,
    archiveText,
    rejectedText,
    rejection,
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
    readonly rejectedText: string;
    readonly rejection: AbsoluteNaturalnessReviewOutcome;
    readonly syntax?: SliceSyntax;
    readonly lineStructured: boolean;
    readonly identityContext?: string;
    readonly sliceIndex: number;
    readonly config: ConsolidationPolishConfig;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<NaturalnessCorrectionStep> {
  /**
   * Required generation, selection, structure, and fidelity outcome.
   */
  const correction = await runConsolidationPolishRound({
    client,
    sourceText,
    archiveText,
    baseText: rejectedText,
    ...((syntax === undefined) ? {} : { syntax, }),
    lineStructured,
    ...((identityContext === undefined) ? {} : { identityContext, }),
    mode: {
      kind: 'required-naturalness-correction',
      findings: rejection.findings,
    },
    sliceIndex,
    config,
    signal,
    perCallTimeoutMs,
    l,
  },);
  if (correction.disposition === 'no-correction') {
    return {
      kind: 'no-correction',
      correction,
    };
  }
  /**
   * Absolute review of exact post-fidelity-gate correction.
   */
  const review = await reviewAbsoluteNaturalness({
    client,
    modelIds: config.gateModelIds,
    subject: {
      sourceText,
      candidateText: correction.text,
      paragraphs: finalPolishParagraphs({ text: correction.text, }),
      ...((identityContext === undefined) ? {} : { identityContext, }),
    },
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    l,
  },);
  return {
    kind: 'reviewed',
    correction,
    review,
    audit: {
      inputDigest: rejection.candidateDigest,
      findingsDigest: naturalnessFindingsDigest({ review: rejection, },),
      gatedTextDigest: review.candidateDigest,
    },
  };
}

//endregion One absolute-naturalness correction transition
