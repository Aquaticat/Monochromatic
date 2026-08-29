import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import type { SliceSyntax, } from './chunk-document.ts';
import type { ConsolidationPolishConfig, } from './consolidation-polish-model.ts';
import {
  type ConsolidationPolishGateOutcome,
  gateConsolidationPolish,
} from './consolidation-polish-gate-stage.ts';
import { parseDocument, } from './parse-document.ts';
import { deriveRefinableEnvelopes, } from './refine-envelope.ts';
import type { RepairJudgedRound, } from './repair-round-record.ts';
import type { RefineStageMode, } from './refine-selection-context.ts';
import { runRefineStage, } from './refine-stage.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import { validateTranslatedSlice, } from './translate-validate.ts';

//region One bounded consolidation polish round

/**
 * Final polish reviews every structurally eligible body paragraph.
 */
const FINAL_POLISH_MINIMUM_CHARS = 0;

/**
 * Result of one generation, selection, structural check and fidelity gate.
 *
 * @example
 * ```ts
 * const result: ConsolidationPolishRoundResult = { disposition: 'fallback', text: 'The cat slept.', proposedText: 'The cat slept.', changed: false, refinersHeard: [], contributors: [], rounds: [], findings: [] };
 * ```
 */
export type ConsolidationPolishRoundResult = {
  /**
   * Whether round selected text, retained admissible fallback, or found no correction.
   */
  readonly disposition:
    | 'selected'
    | 'fallback'
    | 'no-correction';

  /**
   * Exact text selected after fidelity gate.
   */
  readonly text: string;

  /**
   * Selected refinement before structural and fidelity gates.
   */
  readonly proposedText: string;

  /**
   * Whether round replaced its input base.
   */
  readonly changed: boolean;

  /**
   * Rewriters returning usable structured reply.
   */
  readonly refinersHeard: readonly RosterModelId[];

  /**
   * Models whose work selected text carries.
   */
  readonly contributors: readonly RosterModelId[];

  /**
   * Candidate-selection round, when candidates reached judges.
   */
  readonly rounds: readonly RepairJudgedRound[];

  /**
   * Fidelity-first comparative gate, when selected proposal passed structure.
   */
  readonly gate?: ConsolidationPolishGateOutcome;

  /**
   * Stable generation, selection and gate findings.
   */
  readonly findings: readonly string[];
};

/**
 * Reads exact structurally correctable body paragraphs in display order.
 *
 * @param text - would-ship Markdown slice
 *
 * @returns Paragraph texts reviewer numbers and correction stage envelopes
 *
 * @example
 * ```ts
 * const paragraphs = finalPolishParagraphs({ text: 'The cat slept.' });
 * ```
 */
export function finalPolishParagraphs(
  { text, }: { readonly text: string; },
): readonly string[] {
  return deriveRefinableEnvelopes({
    document: parseDocument({ text, },),
    minimumChars: FINAL_POLISH_MINIMUM_CHARS,
  },)
    .envelopes
    .map(function baseTextOf(envelope,): string {
      return envelope.baseText;
    },);
}

/**
 * Runs exactly one final-polish generation and its existing deterministic gates.
 *
 * @param client - provider client
 *
 * @param sourceText - Chinese fidelity anchor
 *
 * @param archiveText - archived English evidence
 *
 * @param baseText - exact would-ship input to this round
 *
 * @param syntax - syntax role, absent for body prose
 *
 * @param lineStructured - source line-boundary policy
 *
 * @param identityContext - declared identities and contributor forms
 *
 * @param mode - comparative polish or required correction findings
 *
 * @param sliceIndex - prepared slice position
 *
 * @param config - model roles and document-wide definitions
 *
 * @param signal - caller cancellation
 *
 * @param perCallTimeoutMs - per-exchange deadline
 *
 * @param l - stage logger
 *
 * @returns One bounded proposal round after structure and fidelity selection
 *
 * @example
 * ```ts
 * const round = await runConsolidationPolishRound({ client, sourceText, archiveText, baseText, mode: { kind: 'comparative' }, lineStructured: false, sliceIndex: 1, config, signal, perCallTimeoutMs, l, });
 * ```
 */
export async function runConsolidationPolishRound(
  {
    client,
    sourceText,
    archiveText,
    baseText,
    syntax,
    lineStructured,
    identityContext,
    mode,
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
    readonly syntax?: SliceSyntax;
    readonly lineStructured: boolean;
    readonly identityContext?: string;
    readonly mode: RefineStageMode;
    readonly sliceIndex: number;
    readonly config: ConsolidationPolishConfig;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<ConsolidationPolishRoundResult> {
  /**
   * Paragraphs eligible under final-polish zero-length floor.
   */
  const {
    envelopes,
    definitions: baseDefinitions,
  } = deriveRefinableEnvelopes({
    document: parseDocument({ text: baseText, },),
    minimumChars: FINAL_POLISH_MINIMUM_CHARS,
  },);
  /**
   * Archive-wide and current-base definitions visible to structural guards.
   */
  const definitions = [
    config.definitions,
    baseDefinitions,
  ]
    .filter(function present(value,): boolean {
      return value !== '';
    },)
    .join('\n',);
  /**
   * One refinement generation and candidate selection.
   */
  const refined = await runRefineStage({
    client,
    refinerModelIds: config.refinerModelIds,
    judgeModelIds: config.judgeModelIds,
    sourceText,
    repairedText: baseText,
    envelopes,
    definitions,
    ...((identityContext === undefined) ? {} : { identityContext, }),
    declaredNames: config.declaredNames,
    mode,
    sliceIndex,
    signal,
    perCallTimeoutMs,
    l,
  },);
  if (!refined.changed) {
    return {
      disposition: refined.disposition,
      text: baseText,
      proposedText: baseText,
      changed: false,
      refinersHeard: refined.heard,
      contributors: refined.contributors,
      rounds: refined.rounds,
      findings: refined.findings,
    };
  }
  /**
   * Structural validity before semantic comparative gate.
   */
  const validation = validateTranslatedSlice({
    sourceText,
    candidateText: refined.refinedText,
    pageText: baseText,
    ...((syntax === undefined) ? {} : { syntax, }),
    lineStructured,
  },);
  if (validation.kind !== 'valid') {
    return {
      disposition: (mode.kind === 'comparative') ? 'fallback' : 'no-correction',
      text: baseText,
      proposedText: refined.refinedText,
      changed: false,
      refinersHeard: refined.heard,
      contributors: refined.contributors,
      rounds: refined.rounds,
      findings: [
        ...refined.findings,
        ...((validation.kind === 'invalid') ? validation.findings : [validation.detail,]),
        'consolidation-polish structural validation kept approved base',
      ],
    };
  }
  /**
   * Existing fidelity-first comparative panel.
   */
  const gate = await gateConsolidationPolish({
    client,
    modelIds: config.gateModelIds,
    subject: {
      sourceText,
      archiveText,
      baseText,
      polishedText: refined.refinedText,
      mode,
      ...((identityContext === undefined) ? {} : { identityContext, }),
    },
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    l,
  },);
  /**
   * Exact text selected by comparative gate.
   */
  const text = (gate.ships === 'polished')
    ? refined.refinedText
    : baseText;
  return {
    disposition: (text === baseText)
      ? ((mode.kind === 'comparative') ? 'fallback' : 'no-correction')
      : 'selected',
    text,
    proposedText: refined.refinedText,
    changed: text !== baseText,
    refinersHeard: refined.heard,
    contributors: refined.contributors,
    rounds: refined.rounds,
    gate,
    findings: [
      ...refined.findings,
      ...gate.findings,
    ],
  };
}

//endregion One bounded consolidation polish round
