import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import {
  CONTEST_REFUSAL,
  isStringList,
  namesOneOf,
  readCandidateNames,
} from './contest-ballot-wire.ts';
import { selectFence, } from './prompt-fence.ts';
import type { RefineStageMode, } from './refine-selection-context.ts';

//region Consolidation polish gate wire

/**
 * Choice one naturalness judge may make.
 */
export type PolishChoice = 'polished' | 'base' | typeof CONTEST_REFUSAL;

/**
 * Names accepted in polish ballot.
 */
const POLISH_NAMES: readonly PolishChoice[] = [
  'polished',
  'base',
  CONTEST_REFUSAL,
];

/**
 * Fidelity-first policy when approved base remains available.
 */
const COMPARATIVE_POLISH_POLICY = `You are deciding whether a polished English memorial passage may replace its already-approved base.

THE ORIGINAL CHINESE IS THE FIDELITY STANDARD. First check both candidates for unsupported statements and dropped content. Naturalness can never compensate for either fault.

Only if both candidates are equally faithful, judge natural English. Reject literal Chinese collocations, calqued verb-object combinations, stiff emotional descriptions, and grammar that a careful native editor would rewrite. Prefer polished only when it is clearly more idiomatic without changing meaning, detail, tone, names, links, Markdown structure, or line structure. Otherwise choose base. Answer neither when no clear naturalness improvement exists.`;

/**
 * Fidelity-first policy when absolute review already rejected base.
 */
const REQUIRED_CORRECTION_POLISH_POLICY = `You are deciding whether a proposed correction may replace an English memorial passage that already failed absolute naturalness review.

THE ORIGINAL CHINESE IS THE FIDELITY STANDARD. First check both candidates for unsupported statements and dropped content. Naturalness can never compensate for either fault.

The base already failed absolute naturalness review. It is evidence for preserving exact meaning, not an approved fallback, and must not win merely because improvement is unclear. Choose polished only when it remains equally faithful, resolves every REQUIRED FINDING, and reads as publication-quality natural English. Choose base only when polished adds, drops, softens, sharpens, or reattributes meaning; the caller will then refuse publication rather than ship base. Answer neither when polished preserves fidelity but fails a REQUIRED FINDING or remains unnatural.`;

/**
 * Subject shown to naturalness gate.
 *
 * @example
 * ```ts
 * const subject: ConsolidationPolishGateSubject = { sourceText: '猫睡了。', archiveText: 'The cat slept.', baseText: 'The cat slept.', polishedText: 'The cat was asleep.', mode: { kind: 'comparative' } };
 * ```
 */
export type ConsolidationPolishGateSubject = {
  /**
   * Original Chinese passage.
   */
  readonly sourceText: string;

  /**
   * Archive wording as supporting evidence.
   */
  readonly archiveText: string;

  /**
   * Standing wording, approved only in comparative mode.
   */
  readonly baseText: string;

  /**
   * Naturalness rewrite seeking to replace base.
   */
  readonly polishedText: string;

  /**
   * Whether base remains available or is rejected correction evidence.
   */
  readonly mode: RefineStageMode;

  /**
   * Declared names and handles, when documents provide them.
   */
  readonly identityContext?: string;
};

/**
 * Raw reply shape before candidate names are narrowed.
 */
export type ConsolidationPolishGateWire = {
  readonly choice: string;
  readonly unsupported: unknown;
  readonly dropped: unknown;
  readonly reason: string;
};

/**
 * Read naturalness ballot.
 */
export type ConsolidationPolishBallot = {
  readonly choice: PolishChoice;
  readonly unsupported: readonly PolishChoice[];
  readonly unsupportedRaw: readonly string[];
  readonly dropped: readonly PolishChoice[];
  readonly droppedRaw: readonly string[];
  readonly reason: string;
};

/**
 * Narrows candidate name.
 *
 * @param value - reply candidate name
 *
 * @returns Whether value names polish candidate or refusal
 *
 * @example
 * ```ts
 * if (isPolishChoice(value)) use(value);
 * ```
 */
function isPolishChoice(value: unknown,): value is PolishChoice {
  return namesOneOf({
    value,
    names: POLISH_NAMES,
  },);
}

/**
 * Checks shape of polish gate reply.
 *
 * @param value - parsed provider value
 *
 * @returns Whether reply can be read as ballot
 *
 * @example
 * ```ts
 * const usable = isConsolidationPolishGateWire(value);
 * ```
 */
export function isConsolidationPolishGateWire(
  value: unknown,
): value is ConsolidationPolishGateWire {
  if (((typeof value) !== 'object') || (value === null))
    return false;
  if (!('choice' in value))
    return false;
  if (!('unsupported' in value))
    return false;
  if (!('dropped' in value))
    return false;
  if (!('reason' in value))
    return false;
  return isPolishChoice(value.choice) && ((typeof value.reason) === 'string');
}

/**
 * Reads validated provider reply as naturalness ballot.
 *
 * @param wire - reply passing shape guard
 *
 * @returns Narrow ballot preserving raw findings
 *
 * @example
 * ```ts
 * const ballot = readConsolidationPolishBallot({ wire, });
 * ```
 */
export function readConsolidationPolishBallot(
  { wire, }: { readonly wire: ConsolidationPolishGateWire; },
): ConsolidationPolishBallot {
  /**
   * Unsupported findings, empty when model wrote another shape.
   */
  const unsupported = isStringList(wire.unsupported,) ? wire.unsupported : [];
  /**
   * Dropped findings, empty when model wrote another shape.
   */
  const dropped = isStringList(wire.dropped,) ? wire.dropped : [];
  return {
    choice: isPolishChoice(wire.choice,) ? wire.choice : CONTEST_REFUSAL,
    unsupported: readCandidateNames({
      findings: unsupported,
      names: POLISH_NAMES,
    },),
    unsupportedRaw: unsupported,
    dropped: readCandidateNames({
      findings: dropped,
      names: POLISH_NAMES,
    },),
    droppedRaw: dropped,
    reason: wire.reason,
  };
}

/**
 * Builds fidelity-first final naturalness question.
 *
 * @param subject - original, archive, base and proposed polish
 *
 * @returns Messages for one polish judge
 *
 * @example
 * ```ts
 * const messages = buildConsolidationPolishGateMessages({ subject, });
 * ```
 */
export function buildConsolidationPolishGateMessages(
  { subject, }: { readonly subject: ConsolidationPolishGateSubject; },
): readonly ChatMessage[] {
  /**
   * Declared identity block or no lines.
   */
  const identity = (subject.identityContext === undefined)
    ? []
    : [
      'DECLARED NAMES:',
      subject.identityContext,
      '',
    ];
  /**
   * Gate mode naming whether base remains available.
   */
  const { mode, } = subject;
  /**
   * Whether this is exploratory comparison against approved base.
   */
  const comparative = mode.kind === 'comparative';
  /**
   * Required findings rendered only at prompt boundary.
   */
  const requiredFindings = comparative
    ? []
    : mode
      .findings
      .map(function renderFinding(finding,): string {
        return `Paragraph ${String(finding.paragraph,)}: ${finding.problem}`;
      },);
  /**
   * Prior failed strategies correction gate must not repeat.
   */
  const priorCorrections = comparative
    ? []
    : (mode.priorCorrections ?? [])
      .map(function renderPrior(
        prior,
        index,
      ): string {
        /**
         * Prior findings rendered in original order.
         */
        const findings = prior.findings
          .join('\n',);
        return `Attempt ${String(index + 1,)} candidate:\n${prior.candidateText}\nFindings:\n${findings}`;
      },);
  /**
   * Fence absent from every enclosed passage and finding.
   */
  const fence = selectFence({
    texts: [
      subject.sourceText,
      subject.archiveText,
      subject.baseText,
      subject.polishedText,
      ...requiredFindings,
      ...priorCorrections,
      ...((subject.identityContext === undefined) ? [] : [subject.identityContext,]),
    ],
  },);
  /**
   * Required findings block, absent while approved base remains available.
   */
  const correctionEvidence = (requiredFindings.length === 0)
    ? []
    : [
      'REQUIRED FINDINGS from independent absolute review:',
      `${fence}\n${requiredFindings.join('\n',)}\n${fence}`,
      '',
    ];
  /**
   * Prior failed strategy block,
   * absent on first correction.
   */
  const priorEvidence = (priorCorrections.length === 0)
    ? []
    : [
      'PRIOR CORRECTION STRATEGIES THAT FAILED:',
      `${fence}\n${priorCorrections.join('\n\n',)}\n${fence}`,
      '',
    ];
  /**
   * Base label matching whether it remains publishable.
   */
  const baseLabel = comparative
    ? 'CANDIDATE "base" (already approved):'
    : 'CANDIDATE "base" (rejected naturalness evidence only):';
  return [
    {
      role: 'system',
      content: comparative
        ? COMPARATIVE_POLISH_POLICY
        : REQUIRED_CORRECTION_POLISH_POLICY,
    },
    {
      role: 'user',
      content: [
        ...identity,
        'ORIGINAL (Chinese):',
        `${fence}\n${subject.sourceText}\n${fence}`,
        '',
        'ARCHIVE RENDERING (evidence only):',
        `${fence}\n${subject.archiveText}\n${fence}`,
        '',
        baseLabel,
        `${fence}\n${subject.baseText}\n${fence}`,
        '',
        'CANDIDATE "polished":',
        `${fence}\n${subject.polishedText}\n${fence}`,
        '',
        ...correctionEvidence,
        ...priorEvidence,
        `Return JSON: choice one of "polished", "base", "${CONTEST_REFUSAL}";`,
        'unsupported and dropped each a list naming any of "polished", "base";',
        'reason one sentence.',
      ].join('\n',),
    },
  ];
}

//endregion Consolidation polish gate wire
