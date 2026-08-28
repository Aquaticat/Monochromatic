import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  type AbsoluteNaturalnessReviewOutcome,
  reviewAbsoluteNaturalness,
} from './absolute-naturalness-review-stage.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import type { SliceSyntax, } from './chunk-document.ts';
import type { ConsolidationPolishGateOutcome, } from './consolidation-polish-gate-stage.ts';
import {
  finalPolishParagraphs,
  runConsolidationPolishRound,
} from './consolidation-polish-round.ts';
import type { RepairJudgedRound, } from './repair-round-record.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Consolidation naturalness polish

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
 * Absolute review rounds binding publication approval to exact final wording.
 *
 * @example
 * ```ts
 * const review: ConsolidationNaturalnessAudit = { correctionCount: 0, rounds: [] };
 * ```
 */
export type ConsolidationNaturalnessAudit = {
  /**
   * Dedicated corrective generations bought after initial rejection.
   */
  readonly correctionCount: 0 | 1;

  /**
   * Absolute whole-passage reviews in execution order.
   */
  readonly rounds: readonly AbsoluteNaturalnessReviewOutcome[];
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
     * Absolute whole-passage approval bound to final text.
     */
    readonly review: ConsolidationNaturalnessAudit;

    /**
     * Findings from proposal, validation, gate and absolute review.
     */
    readonly findings: readonly string[];
  }
  | {
    /**
     * Naturalness work exhausted bounded correction without publishable text.
     */
    readonly kind: 'unsettled';

    /**
     * Approved fidelity baseline that remains unpublishable for naturalness.
     */
    readonly baseText: string;

    /**
     * Last selected correction proposal, whether or not gates accepted it.
     */
    readonly proposedText: string;

    /**
     * Rewriters returning usable answer across bounded rounds.
     */
    readonly refinersHeard: readonly RosterModelId[];

    /**
     * Models whose work last would-ship candidate carries.
     */
    readonly contributors: readonly RosterModelId[];

    /**
     * Candidate-selection rounds from initial and corrective generations.
     */
    readonly rounds: readonly RepairJudgedRound[];

    /**
     * Last comparative fidelity gate, when correction reached it.
     */
    readonly gate?: ConsolidationPolishGateOutcome;

    /**
     * Absolute reviews proving why publication remains refused.
     */
    readonly review: ConsolidationNaturalnessAudit;

    /**
     * Stable bounded-correction and review findings.
     */
    readonly findings: readonly string[];
  };

/**
 * Deduplicates model credits while preserving first-stage order.
 *
 * @param modelIds - credits from bounded rounds
 *
 * @returns Unique model ids in first occurrence order
 *
 * @example
 * ```ts
 * uniqueRosterModelIds({ modelIds: ['hf:zai-org/GLM-5.2', 'hf:zai-org/GLM-5.2'], });
 * ```
 */
function uniqueRosterModelIds(
  { modelIds, }: { readonly modelIds: readonly RosterModelId[]; },
): readonly RosterModelId[] {
  return [...new Set(modelIds,),];
}

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
  const initialReview = await reviewAbsoluteNaturalness({
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
        rounds: [initialReview,],
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
        rounds: [initialReview,],
      },
      findings: [
        ...initial.findings,
        'absolute-naturalness-review quorum not met',
      ],
    };
  }
  /**
   * Paragraph-located findings rendered as fenced correction data.
   */
  const initialReviewFindings = initialReview.findings
    .map(function correctionFinding(finding,): string {
      return `Paragraph ${String(finding.paragraph,)}: ${finding.problem}`;
    },);
  /**
   * Sole dedicated correction over exact rejected would-ship text.
   */
  const correction = await runConsolidationPolishRound({
    client,
    sourceText,
    archiveText,
    baseText: initial.text,
    ...((syntax === undefined) ? {} : { syntax, }),
    lineStructured,
    ...((identityContext === undefined) ? {} : { identityContext, }),
    mode: {
      kind: 'required-naturalness-correction',
      findings: initialReview.findings,
    },
    sliceIndex,
    config,
    signal,
    perCallTimeoutMs,
    l,
  },);
  /**
   * Rewriters heard across both bounded generations.
   */
  const refinersHeard = uniqueRosterModelIds({
    modelIds: [
      ...initial.refinersHeard,
      ...correction.refinersHeard,
    ],
  },);
  /**
   * Credits whose work final corrective candidate carries.
   */
  const contributors = uniqueRosterModelIds({
    modelIds: [
      ...(initial.changed ? initial.contributors : []),
      ...correction.contributors,
    ],
  },);
  /**
   * Candidate-selection records across both bounded generations.
   */
  const rounds = [
    ...initial.rounds,
    ...correction.rounds,
  ];
  /**
   * Stable findings across both bounded generations.
   */
  const correctionFindings = [
    ...initial.findings,
    ...initialReviewFindings,
    ...correction.findings,
  ];
  if (correction.disposition === 'no-correction') {
    return {
      kind: 'unsettled',
      baseText,
      proposedText: correction.proposedText,
      refinersHeard,
      contributors,
      rounds,
      ...((correction.gate === undefined) ? {} : { gate: correction.gate, }),
      review: {
        correctionCount: 1,
        rounds: [initialReview,],
      },
      findings: [
        ...correctionFindings,
        'absolute-naturalness correction made no approved text change',
      ],
    };
  }
  /**
   * Independent absolute review of post-gate corrective text.
   */
  const correctionReview = await reviewAbsoluteNaturalness({
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
  /**
   * Both exact candidate-bound absolute review rounds.
   */
  const review: ConsolidationNaturalnessAudit = {
    correctionCount: 1,
    rounds: [
      initialReview,
      correctionReview,
    ],
  };
  if (correctionReview.verdict !== 'acceptable') {
    /**
     * Final rejection findings rendered for stable stage telemetry.
     */
    const finalReviewFindings = correctionReview.findings
      .map(function describeFinding(finding,): string {
        return `paragraph ${String(finding.paragraph,)}: ${finding.problem}`;
      },);
    return {
      kind: 'unsettled',
      baseText,
      proposedText: correction.proposedText,
      refinersHeard,
      contributors,
      rounds,
      ...((correction.gate === undefined) ? {} : { gate: correction.gate, }),
      review,
      findings: [
        ...correctionFindings,
        ...finalReviewFindings,
        `absolute-naturalness correction remained ${correctionReview.verdict}`,
      ],
    };
  }
  return {
    kind: 'settled',
    baseText,
    proposedText: correction.proposedText,
    text: correction.text,
    changed: correction.text !== baseText,
    refinersHeard,
    contributors,
    rounds,
    ...((correction.gate === undefined) ? {} : { gate: correction.gate, }),
    review,
    findings: correctionFindings,
  };
}

//endregion Consolidation naturalness polish
