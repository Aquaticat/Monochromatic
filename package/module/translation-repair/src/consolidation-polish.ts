import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { confirmAbsoluteNaturalness, } from './absolute-naturalness-confirmation.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import type { SliceSyntax, } from './chunk-document.ts';
import { settleNaturalnessCorrections, } from './consolidation-naturalness-settle.ts';
import type {
  ConsolidationPolish,
  ConsolidationPolishConfig,
} from './consolidation-polish-model.ts';
import {
  finalPolishParagraphs,
  runConsolidationPolishRound,
} from './consolidation-polish-round.ts';

export type {
  ConsolidationNaturalnessAudit,
  ConsolidationNaturalnessCorrectionAudit,
  ConsolidationPolish,
  ConsolidationPolishConfig,
} from './consolidation-polish-model.ts';

//region Consolidation naturalness polish

/**
 * Polishes final body text and lets fidelity-first roster approve replacement.
 *
 * @param client - shared provider client
 *
 * @param sourceText - original passage anchoring fidelity
 *
 * @param archiveText - archive wording shown as supporting evidence
 *
 * @param baseText - wording already approved by consolidation gate
 *
 * @param syntax - explicit syntax role; front matter is never polished
 *
 * @param lineStructured - whether source line boundaries must survive
 *
 * @param identityContext - names and handles prompts preserve
 *
 * @param sliceIndex - prepared slice position
 *
 * @param config - model roles and document-wide guard facts
 *
 * @param eligible - whether approved base may cross publication boundary
 *
 * @param signal - caller cancellation
 *
 * @param perCallTimeoutMs - per-exchange ceiling
 *
 * @param l - stage logger
 *
 * @returns Auditable polish decision and final text
 *
 * @example
 * ```ts
 * const polish = await polishConsolidation({ client, sourceText, archiveText, baseText, lineStructured: false, sliceIndex: 0, config, signal, perCallTimeoutMs, l, });
 * ```
 */
export async function polishConsolidation(
  {
    client,
    sourceText,
    archiveText,
    baseText,
    syntax,
    lineStructured,
    identityContext,
    sliceIndex,
    config,
    eligible = true,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly sourceText: string;
    readonly archiveText: string;
    readonly baseText: string;
    readonly syntax?: SliceSyntax;
    readonly lineStructured: boolean;
    readonly identityContext?: string;
    readonly sliceIndex: number;
    readonly config?: ConsolidationPolishConfig;
    readonly eligible?: boolean;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<ConsolidationPolish> {
  if (syntax === 'front-matter') {
    return {
      kind: 'not-run',
      reason: 'front-matter',
    };
  }
  if (!eligible) {
    return {
      kind: 'not-run',
      reason: 'unsafe-baseline',
    };
  }
  if (config === undefined) {
    return {
      kind: 'not-run',
      reason: 'not-configured',
    };
  }
  /**
   * Initial exploratory generation, selection and comparative fidelity gate.
   */
  const initial = await runConsolidationPolishRound({
    client,
    sourceText,
    archiveText,
    baseText,
    ...((syntax === undefined) ? {} : { syntax, }),
    lineStructured,
    ...((identityContext === undefined) ? {} : { identityContext, }),
    mode: { kind: 'comparative', },
    sliceIndex,
    config,
    signal,
    perCallTimeoutMs,
    l,
  },);
  /**
   * Independent absolute review of exact initial would-ship text.
   */
  const initialConfirmed = await confirmAbsoluteNaturalness({
    client,
    modelIds: config.gateModelIds,
    subject: {
      sourceText,
      candidateText: initial.text,
      paragraphs: finalPolishParagraphs({ text: initial.text, }),
      ...((identityContext === undefined) ? {} : { identityContext, }),
    },
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    l,
  },);
  /**
   * Decisive initial review after optional acceptance confirmation.
   */
  const { review: initialReview, } = initialConfirmed;
  if (initialReview.verdict === 'acceptable') {
    return {
      kind: 'settled',
      baseText,
      proposedText: initial.proposedText,
      text: initial.text,
      changed: initial.text !== baseText,
      refinersHeard: initial.refinersHeard,
      contributors: initial.contributors,
      rounds: initial.rounds,
      ...((initial.gate === undefined) ? {} : { gate: initial.gate, }),
      review: {
        correctionCount: 0,
        corrections: [],
        rounds: [initialReview,],
        confirmations: initialConfirmed.confirmations,
      },
      findings: initial.findings,
    };
  }
  if (initialReview.verdict === 'quorum-not-met') {
    return {
      kind: 'unsettled',
      baseText,
      proposedText: initial.proposedText,
      refinersHeard: initial.refinersHeard,
      contributors: initial.contributors,
      rounds: initial.rounds,
      ...((initial.gate === undefined) ? {} : { gate: initial.gate, }),
      review: {
        correctionCount: 0,
        corrections: [],
        rounds: [initialReview,],
        confirmations: initialConfirmed.confirmations,
      },
      findings: [
        ...initial.findings,
        'absolute-naturalness-review quorum not met',
      ],
    };
  }
  return settleNaturalnessCorrections({
    client,
    sourceText,
    archiveText,
    baseText,
    initial,
    initialReview,
    initialConfirmations: initialConfirmed.confirmations,
    ...((syntax === undefined) ? {} : { syntax, }),
    lineStructured,
    ...((identityContext === undefined) ? {} : { identityContext, }),
    sliceIndex,
    config,
    signal,
    perCallTimeoutMs,
    l,
  },);
}

//endregion Consolidation naturalness polish
