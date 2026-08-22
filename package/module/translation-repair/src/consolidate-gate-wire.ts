import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import {
  CONTEST_POLICY,
  CONTEST_REFUSAL,
  isStringList,
  namesOneOf,
  readCandidateNames,
} from './contest-ballot-wire.ts';
import { selectFence, } from './prompt-fence.ts';

//region Consolidate gate wire
// Asks whether the rendering this run WROTE should replace the one that would
// otherwise ship.
//
// SAME QUESTION AS THE LANE CONTEST, different pair. `CONTEST_POLICY` is shared
// rather than restated, because the lane contest's 10 of 13 against the
// eight-entry reading, where a general-preference control managed 8, is a
// number about that wording.
//
// THE CONSOLIDATION IS NOT TRUSTED BECAUSE IT IS NEWEST. It is a third
// candidate produced by the same kind of instrument that produced the first
// two, and it can be worse. So it is put to the roster like any other.
//
// A TIE KEEPS THE STANDING TEXT, which the counting rule enforces rather than
// this sheet: see `consolidate-gate-stage.ts`. Changing what a reader sees needs
// more evidence than leaving it, and the translate wire already records why,
// that a reader who knows this archive should not see it churn.

/**
 * Which rendering a judge would publish, or that it cannot choose.
 */
export type GateChoice = 'consolidated' | 'standing' | typeof CONTEST_REFUSAL;

/**
 * Names a judge may use, which are the two renderings plus the refusal.
 */
const GATE_NAMES: readonly GateChoice[] = [
  'consolidated',
  'standing',
  CONTEST_REFUSAL,
];

/**
 * Whether a value is one of the names a judge may use.
 *
 * @param value - candidate name from a reply
 *
 * @returns Whether it names a rendering or the refusal
 *
 * @example
 * ```ts
 * const named = isGateChoice('standing',);
 * ```
 */
export function isGateChoice(value: unknown,): value is GateChoice {
  return namesOneOf({
    value,
    names: GATE_NAMES,
  },);
}

/**
 * One judge's reading of the consolidation against the standing text.
 *
 * @example
 * ```ts
 * const ballot: GateBallot = { choice: 'standing', unsupported: [], unsupportedRaw: [], dropped: [], droppedRaw: [], reason: 'x', };
 * ```
 */
export type GateBallot = {
  /**
   * Rendering this judge would publish.
   */
  readonly choice: GateChoice;

  /**
   * Renderings saying something the original does not support.
   */
  readonly unsupported: readonly GateChoice[];

  /**
   * Unsupported findings exactly as this judge wrote them.
   */
  readonly unsupportedRaw: readonly string[];

  /**
   * Renderings omitting something the original says.
   */
  readonly dropped: readonly GateChoice[];

  /**
   * Dropped findings exactly as this judge wrote them.
   */
  readonly droppedRaw: readonly string[];

  /**
   * Why, for the audit trail rather than for validity.
   */
  readonly reason: string;
};

/**
 * Reply shape a judge is asked for, before it is read.
 */
export type GateWire = {
  readonly choice: string;
  readonly unsupported: readonly string[];
  readonly dropped: readonly string[];
  readonly reason: string;
};

/**
 * Whether a reply carries the shape a ballot is read from.
 *
 * SHAPE ONLY, on the lane contest's rule: whether the findings are consistent
 * with the choice is the reader's question, because an inconsistent ballot is
 * still a ballot that was cast.
 *
 * @param value - parsed reply
 *
 * @returns Whether it can be read as a ballot
 *
 * @example
 * ```ts
 * const usable = isConsolidateGateWire(reply,);
 * ```
 */
export function isConsolidateGateWire(value: unknown,): value is GateWire {
  if ((typeof value) !== 'object')
    return false;
  if (value === null)
    return false;
  if (!('choice' in value))
    return false;
  if (!('unsupported' in value))
    return false;
  if (!('dropped' in value))
    return false;
  if (!('reason' in value))
    return false;
  return isGateChoice(value.choice,)
    && isStringList(value.unsupported,)
    && isStringList(value.dropped,)
    && ((typeof value.reason) === 'string');
}

/**
 * Reads a validated reply as a ballot.
 *
 * @param wire - reply that passed the shape guard
 *
 * @returns Ballot with its findings narrowed
 *
 * @example
 * ```ts
 * const ballot = readConsolidateGateBallot({ wire, },);
 * ```
 */
export function readConsolidateGateBallot(
  { wire, }: { readonly wire: GateWire; },
): GateBallot {
  return {
    choice: isGateChoice(wire.choice,)
      ? wire.choice
      : CONTEST_REFUSAL,
    unsupported: readCandidateNames({
      findings: wire.unsupported,
      names: GATE_NAMES,
    },),
    unsupportedRaw: wire.unsupported,
    dropped: readCandidateNames({
      findings: wire.dropped,
      names: GATE_NAMES,
    },),
    droppedRaw: wire.dropped,
    reason: wire.reason,
  };
}

/**
 * What a judge is shown for one gated slice.
 */
export type ConsolidateGateSubject = {
  /**
   * Original passage, which is the standard.
   */
  readonly sourceText: string;

  /**
   * Archive rendering, as evidence rather than as the standard.
   */
  readonly incumbentText: string;

  /**
   * Rendering this run wrote for this slice.
   */
  readonly consolidatedText: string;

  /**
   * Rendering that ships if the consolidation is refused.
   */
  readonly standingText: string;

  /**
   * Names and handles both documents' front matter declares, when either does.
   *
   * WITHOUT THIS THE JUDGE CANNOT TELL AN ATTESTED NAME FROM AN INVENTION,
   * which is the defect measured on `Zha_Ke` slice 0 and fixed for every other
   * model-facing stage.
   */
  readonly identityContext?: string;
};

/**
 * Builds the exchange asking one judge to gate one consolidation.
 *
 * @param subject - passage, archive rendering and the two renderings
 *
 * @returns Messages for one exchange
 *
 * @example
 * ```ts
 * const messages = buildConsolidateGateMessages({ subject, },);
 * ```
 */
export function buildConsolidateGateMessages(
  { subject, }: { readonly subject: ConsolidateGateSubject; },
): readonly ChatMessage[] {
  /**
   * Fence long enough to enclose every text without one closing early.
   */
  const fence = selectFence({
    texts: [
      subject.sourceText,
      subject.incumbentText,
      subject.consolidatedText,
      subject.standingText,
      subject.identityContext ?? '',
    ],
  },);

  /**
   * Declared names as one block, empty when neither side declares any.
   */
  const declared = subject.identityContext ?? '';

  /**
   * Declared names and their fence, or nothing when neither side declares any.
   */
  const identityBlock = (declared.length === 0)
    ? []
    : [
      `${fence} DECLARED NAMES ${fence}`,
      declared,
      fence,
      '',
    ];
  return [
    {
      role: 'system',
      content: CONTEST_POLICY,
    },
    {
      role: 'user',
      content: [
        ...identityBlock,
        'ORIGINAL (Chinese), the standard:',
        `${fence}\n${subject.sourceText}\n${fence}`,
        '',
        'ARCHIVE RENDERING, evidence only:',
        `${fence}\n${subject.incumbentText}\n${fence}`,
        '',
        'CANDIDATE "consolidated":',
        `${fence}\n${subject.consolidatedText}\n${fence}`,
        '',
        'CANDIDATE "standing":',
        `${fence}\n${subject.standingText}\n${fence}`,
        '',
        `Return JSON: choice one of "consolidated", "standing", "${CONTEST_REFUSAL}";`,
        'unsupported and dropped each a list naming any of "consolidated", "standing";',
        'reason one sentence.',
      ].join('\n',),
    },
  ];
}

//endregion Consolidate gate wire
