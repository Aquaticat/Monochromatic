import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import type { SliceSyntax, } from './chunk-document.ts';
import {
  type ConsolidationPolishGateOutcome,
  gateConsolidationPolish,
} from './consolidation-polish-gate-stage.ts';
import { parseDocument, } from './parse-document.ts';
import { deriveRefinableEnvelopes, } from './refine-envelope.ts';
import { runRefineStage, } from './refine-stage.ts';
import type { RepairJudgedRound, } from './repair-round-record.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import { validateTranslatedSlice, } from './translate-validate.ts';

//region Consolidation naturalness polish

/**
 * Final pass reviews every structurally eligible body paragraph, including
 * short prose whose awkwardness complete-page reading proved length does not
 * prevent. Repair lane keeps its measured default length window.
 */
const FINAL_POLISH_MINIMUM_CHARS = 0;

/**
 * Model roles and document facts needed by final body polish.
 *
 * @example
 * ```ts
 * const config: ConsolidationPolishConfig = { refinerModelIds, judgeModelIds, gateModelIds, declaredNames: [], definitions: '', };
 * ```
 */
export type ConsolidationPolishConfig = {
  /**
   * Rewriters proposing idiomatic paragraph replacements.
   */
  readonly refinerModelIds: readonly RosterModelId[];

  /**
   * Judges selecting rewrite slate winner.
   */
  readonly judgeModelIds: readonly RosterModelId[];

  /**
   * Fidelity-first roster deciding whether selected rewrite may ship.
   */
  readonly gateModelIds: readonly RosterModelId[];

  /**
   * Declared target name forms protected from deletion.
   */
  readonly declaredNames: readonly string[];

  /**
   * Link and footnote definitions used by rewrite guards.
   */
  readonly definitions: string;
};

/**
 * Auditable final polish decision for one consolidated slice.
 *
 * @example
 * ```ts
 * const polish: ConsolidationPolish = { kind: 'not-run', reason: 'front-matter', };
 * ```
 */
export type ConsolidationPolish =
  | {
    /**
     * No naturalness stage was applicable or configured.
     */
    readonly kind: 'not-run';

    /**
     * Why no body polish was bought.
     */
    readonly reason: 'front-matter' | 'not-configured' | 'unsafe-baseline';
  }
  | {
    /**
     * Naturalness stage examined approved base.
     */
    readonly kind: 'settled';

    /**
     * Already-approved text before naturalness work.
     */
    readonly baseText: string;

    /**
     * Selected rewrite proposal before final fidelity gate.
     */
    readonly proposedText: string;

    /**
     * Final text after conservative gate.
     */
    readonly text: string;

    /**
     * Whether final text differs from approved base.
     */
    readonly changed: boolean;

    /**
     * Rewriters heard with usable answer.
     */
    readonly refinersHeard: readonly RosterModelId[];

    /**
     * Models contributing selected proposal.
     */
    readonly contributors: readonly RosterModelId[];

    /**
     * Naturalness selection rounds retained for audit.
     */
    readonly rounds: readonly RepairJudgedRound[];

    /**
     * Final fidelity and naturalness gate, absent when no rewrite survived.
     */
    readonly gate?: ConsolidationPolishGateOutcome;

    /**
     * Findings from proposal, validation and gate.
     */
    readonly findings: readonly string[];
  };

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
   * Paragraph envelopes eligible for idiomatic rewrite.
   */
  const {
    envelopes,
    definitions: baseDefinitions,
  } = deriveRefinableEnvelopes({
    document: parseDocument({ text: baseText, },),
    minimumChars: FINAL_POLISH_MINIMUM_CHARS,
  },);
  /**
   * Archive-wide definitions plus any changed definitions in approved base.
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
   * Rewriter slate settlement over approved base.
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
    sliceIndex,
    signal,
    perCallTimeoutMs,
    l,
  },);
  if (!refined.changed) {
    return {
      kind: 'settled',
      baseText,
      proposedText: baseText,
      text: baseText,
      changed: false,
      refinersHeard: refined.heard,
      contributors: refined.contributors,
      rounds: refined.rounds,
      findings: refined.findings,
    };
  }
  /**
   * Structural validity of selected rewrite before semantic gate.
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
      kind: 'settled',
      baseText,
      proposedText: refined.refinedText,
      text: baseText,
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
   * Fidelity-first panel deciding whether selected polish may replace base.
   */
  const gate = await gateConsolidationPolish({
    client,
    modelIds: config.gateModelIds,
    subject: {
      sourceText,
      archiveText,
      baseText,
      polishedText: refined.refinedText,
      ...((identityContext === undefined) ? {} : { identityContext, }),
    },
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    l,
  },);
  /**
   * Final text after conservative gate.
   */
  const text = (gate.ships === 'polished')
    ? refined.refinedText
    : baseText;
  return {
    kind: 'settled',
    baseText,
    proposedText: refined.refinedText,
    text,
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

//endregion Consolidation naturalness polish
