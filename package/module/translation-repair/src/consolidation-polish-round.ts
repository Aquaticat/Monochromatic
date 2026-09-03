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
import { wrapReplacementText, } from './semantic-wrap.ts';
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
 * Reads every body block of a would-ship slice in display order, which is
 * what the absolute reviewer is shown and may cite.
 *
 * EVERY BODY BLOCK, NOT ONLY THE REFINABLE ONES. The reviewer judges the whole
 * candidate and locates each finding by paragraph number, and the stage
 * refuses a finding that names a paragraph it did not show. Numbering only
 * the refinable paragraphs left a blockquote poem with nothing to cite: on the
 * Toka_ls rerun of 2026-09-02, slice 10 (a 29-line letter in blockquote) had
 * zero refinable paragraphs, so six of nine reviewers who located their
 * findings by stanza were refused as out of range and only the three
 * "acceptable" ballots survived. A block the polish may not edit can still be
 * judged and cited.
 *
 * @param text - would-ship Markdown slice
 *
 * @returns Block texts reviewer numbers, empty for a slice with no body block
 *
 * @example
 * ```ts
 * const paragraphs = reviewParagraphsOf({ text: '> A poem.\n\nA paragraph.' });
 * // => ['> A poem.', 'A paragraph.']
 * ```
 */
export function reviewParagraphsOf(
  { text, }: { readonly text: string; },
): readonly string[] {
  return parseDocument({ text, },)
    .nodes
    .filter(function inBody(node,): boolean {
      return node.zone === 'body';
    },)
    .map(function textOf(node,): string {
      return node.text;
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
   * Refinement as it would ship: wrapped at its semantic boundaries unless the
   * line-structure rule governs the slice, in which case as the refiner wrote
   * it, on the evidence `wrapConsolidation` cites.
   *
   * BEFORE THE GATE, on the rule `wrapConsolidationProposals` states: the
   * deciders judge the bytes that ship. Measured on keyword233, 2026-09-03: the
   * consolidation slate shipped wrapped, this round then handed the refiner's
   * single-line rewrite to the gate beside that wrapped base, a gate judge
   * chose it because it "removes the stilted line breaks", and the page
   * shipped single-line where the 2026-09-02 landing had one clause per line.
   * Wrapped here, the comparison is between two texts written to the same
   * rule, and what the gate approves is what the page carries.
   */
  const polished = lineStructured
    ? refined.refinedText
    : wrapReplacementText({ text: refined.refinedText, },);
  /**
   * Whether the wrap altered what the refiner emitted.
   */
  const rewrapped = polished !== refined.refinedText;
  /**
   * Whether the wrap left nothing between the refinement and the base, which
   * may itself stand unwrapped where it is the archive's own wording.
   */
  const demoted = (polished === baseText)
    || ((!lineStructured) && (polished === wrapReplacementText({ text: baseText, },)));
  if (demoted) {
    l.info('semantic wrap: the polish matched the base once wrapped, so the slice keeps what it had',);
    return {
      disposition: (mode.kind === 'comparative') ? 'fallback' : 'no-correction',
      text: baseText,
      proposedText: polished,
      changed: false,
      refinersHeard: refined.heard,
      contributors: refined.contributors,
      rounds: refined.rounds,
      findings: [
        ...refined.findings,
        'consolidation-polish matched the base once wrapped',
      ],
    };
  }
  if (rewrapped) {
    /**
     * Lines the refiner wrote.
     */
    const emittedLines = refined.refinedText
      .split('\n',)
      .length;
    /**
     * Lines the rule would have it written on.
     */
    const writtenLines = polished
      .split('\n',)
      .length;
    l.info(
      `semantic wrap: rewrapped the polish before its gate, ${String(emittedLines,)} lines as emitted `
        + `against ${String(writtenLines,)} as written`,
    );
  }
  /**
   * Structural validity before semantic comparative gate.
   */
  const validation = validateTranslatedSlice({
    sourceText,
    candidateText: polished,
    pageText: baseText,
    ...((syntax === undefined) ? {} : { syntax, }),
    lineStructured,
  },);
  if (validation.kind !== 'valid') {
    return {
      disposition: (mode.kind === 'comparative') ? 'fallback' : 'no-correction',
      text: baseText,
      proposedText: polished,
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
      polishedText: polished,
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
    ? polished
    : baseText;
  return {
    disposition: (text === baseText)
      ? ((mode.kind === 'comparative') ? 'fallback' : 'no-correction')
      : 'selected',
    text,
    proposedText: polished,
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
