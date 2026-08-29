import type { AbsoluteNaturalnessFinding, } from './absolute-naturalness-review-wire.ts';
import type { SelectEvidence, } from './candidate-select-wire.ts';

//region Refinement selection context
// Keeps exploratory refinement and required correction from asking selectors
// contradictory questions about whether current wording may remain.

/**
 * Why refinement is running and whether unchanged text remains admissible.
 *
 * @example
 * ```ts
 * const mode: RefineStageMode = { kind: 'comparative', };
 * ```
 */
export type RefineStageMode =
  | {
    /**
     * Exploratory improvement where accepted input remains fallback.
     */
    readonly kind: 'comparative';
  }
  | {
    /**
     * Mandatory correction because absolute review rejected input.
     */
    readonly kind: 'required-naturalness-correction';

    /**
     * Material defects candidate must resolve together.
     */
    readonly findings: readonly AbsoluteNaturalnessFinding[];
  };

/**
 * Inputs candidate selector receives after refinement generation.
 *
 * @example
 * ```ts
 * const context = buildRefineSelectionContext({ mode, sourceText, repairedText, });
 * ```
 */
export type RefineSelectionContext = {
  /**
   * One-sentence candidate task.
   */
  readonly task: string;

  /**
   * Ordered candidate ranking rules.
   */
  readonly criteria: readonly string[];

  /**
   * Fenced source, baseline and review data.
   */
  readonly evidence: readonly SelectEvidence[];

  /**
   * Refusal consequence when accepted fallback is unavailable.
   */
  readonly declineConsequence?: string;
};

/**
 * Builds selector question matching refinement mode.
 *
 * @param mode - comparative exploration or required correction
 *
 * @param sourceText - original Chinese fidelity anchor
 *
 * @param repairedText - exact current English wording
 *
 * @returns Candidate-ranking context with review findings fenced as evidence
 *
 * @example
 * ```ts
 * const context = buildRefineSelectionContext({ mode: { kind: 'comparative' }, sourceText, repairedText, });
 * ```
 */
export function buildRefineSelectionContext(
  {
    mode,
    sourceText,
    repairedText,
  }: {
    readonly mode: RefineStageMode;
    readonly sourceText: string;
    readonly repairedText: string;
  },
): RefineSelectionContext {
  if (mode.kind === 'comparative') {
    return {
      task: 'Each candidate is a revision of the CURRENT English translation below, meant to read more naturally without changing what it says.',
      criteria: [
        'Says exactly what the CURRENT text says: nothing added, dropped, softened, sharpened, or reattributed.',
        'Faithful to the Chinese ORIGINAL.',
        'Reads more naturally than the CURRENT text by a clear margin.',
      ],
      evidence: [
        {
          label: 'ORIGINAL (Chinese)',
          text: sourceText,
        },
        {
          label: 'CURRENT English translation, which ships unchanged unless a candidate clearly beats it',
          text: repairedText,
        },
      ],
    };
  }
  /**
   * Structured findings rendered only at selector evidence boundary.
   */
  const selectionFindings = mode.findings
    .map(function renderFinding(finding,): string {
      return `Paragraph ${String(finding.paragraph,)}: ${finding.problem}`;
    },)
    .join('\n',);
  return {
    task: 'The CURRENT English translation failed an independent absolute-quality review. Choose a faithful correction that resolves every REQUIRED FINDING. Decline every candidate when each one still contains any material naturalness defect.',
    criteria: [
      'Hard eligibility floor, not a ranking preference: a candidate must preserve exact meaning, resolve every REQUIRED FINDING, and contain no material naturalness defect a careful native editor would change.',
      'Before comparing candidates, assess each candidate in isolation against absolute publication quality. Improvement over CURRENT or another candidate is irrelevant to eligibility.',
      'For each candidate, scan every sentence for grammar, collocation, word order, and reference defects, then reread complete affected paragraphs for flow, register, repetition, and defects introduced outside REQUIRED FINDINGS.',
      'Says exactly what the CURRENT text says: nothing added, dropped, softened, sharpened, or reattributed.',
      'Faithful to the Chinese ORIGINAL.',
      'Resolves every REQUIRED FINDING across each affected paragraph.',
      'Treats findings as a minimum, not an edit whitelist: reward additional material naturalness fixes that preserve exact meaning.',
      'After checking required findings, reread every affected paragraph sentence by sentence and decline any candidate that is merely the least awkward option.',
      'Reads as publication-quality natural English when considered as a whole.',
    ],
    evidence: [
      {
        label: 'ORIGINAL (Chinese)',
        text: sourceText,
      },
      {
        label: 'CURRENT English translation, which cannot ship unchanged',
        text: repairedText,
      },
      {
        label: 'REQUIRED FINDINGS from independent absolute-quality review',
        text: selectionFindings,
      },
    ],
    declineConsequence: 'the caller refuses publication because CURRENT already failed absolute review',
  };
}

//endregion Refinement selection context
