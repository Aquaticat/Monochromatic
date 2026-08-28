import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import {
  CONTEST_REFUSAL,
  isStringList,
  namesOneOf,
  readCandidateNames,
} from './contest-ballot-wire.ts';
import { selectFence, } from './prompt-fence.ts';

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
 * Fidelity-first naturalness policy for final body polish.
 */
const POLISH_POLICY = `You are deciding whether a polished English memorial passage may replace its already-approved base.

THE ORIGINAL CHINESE IS THE FIDELITY STANDARD. First check both candidates for unsupported statements and dropped content. Naturalness can never compensate for either fault.

Only if both candidates are equally faithful, judge natural English. Reject literal Chinese collocations, calqued verb-object combinations, stiff emotional descriptions, and grammar that a careful native editor would rewrite. Prefer polished only when it is clearly more idiomatic without changing meaning, detail, tone, names, links, Markdown structure, or line structure. Otherwise choose base. Answer neither when no clear naturalness improvement exists.`;

/**
 * Subject shown to naturalness gate.
 *
 * @example
 * ```ts
 * const subject: ConsolidationPolishGateSubject = { sourceText: '猫睡了。', archiveText: 'The cat slept.', baseText: 'The cat slept.', polishedText: 'The cat was asleep.', };
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
   * Already-approved wording that wins every non-clear outcome.
   */
  readonly baseText: string;

  /**
   * Naturalness rewrite seeking to replace base.
   */
  readonly polishedText: string;

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
   * Fence absent from every enclosed passage.
   */
  const fence = selectFence({
    texts: [
      subject.sourceText,
      subject.archiveText,
      subject.baseText,
      subject.polishedText,
      ...((subject.identityContext === undefined) ? [] : [subject.identityContext,]),
    ],
  },);
  return [
    {
      role: 'system',
      content: POLISH_POLICY,
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
        'CANDIDATE "base" (already approved):',
        `${fence}\n${subject.baseText}\n${fence}`,
        '',
        'CANDIDATE "polished":',
        `${fence}\n${subject.polishedText}\n${fence}`,
        '',
        `Return JSON: choice one of "polished", "base", "${CONTEST_REFUSAL}";`,
        'unsupported and dropped each a list naming any of "polished", "base";',
        'reason one sentence.',
      ].join('\n',),
    },
  ];
}

//endregion Consolidation polish gate wire
