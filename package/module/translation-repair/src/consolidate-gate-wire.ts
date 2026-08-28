import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { SliceSyntax, } from './chunk-document.ts';
import {
  CONTEST_POLICY,
  CONTEST_REFUSAL,
  isStringList,
  namesOneOf,
  readCandidateNames,
} from './contest-ballot-wire.ts';
import { contestSizeNote, } from './contest-size-note.ts';
import { FRONT_MATTER_DECISION_RULE, } from './front-matter-translation.ts';
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

  /**
   * Findings against the consolidation, a list of strings when the model
   * followed the schema and whatever it wrote otherwise; the reader narrows.
   */
  readonly unsupported: unknown;

  /**
   * Findings of dropped content, read the same way.
   */
  readonly dropped: unknown;
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
  // THE LISTS ARE NOT CHECKED HERE. `contest-ballot-wire.ts` records that no
  // wording of a finding may cost a voice; a wrong TYPE, a `null` from a model
  // that ignored the schema, used to cost the whole ballot, choice included.
  // The reader takes a non-list as an empty list and keeps the choice.
  return isGateChoice(value.choice,)
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
  /**
   * Findings against the consolidation, empty where the model wrote no list.
   */
  const unsupported = isStringList(wire.unsupported,) ? wire.unsupported : [];

  /**
   * Findings of dropped content, read the same way.
   */
  const dropped = isStringList(wire.dropped,) ? wire.dropped : [];

  return {
    choice: isGateChoice(wire.choice,)
      ? wire.choice
      : CONTEST_REFUSAL,
    unsupported: readCandidateNames({
      findings: unsupported,
      names: GATE_NAMES,
    },),
    unsupportedRaw: unsupported,
    dropped: readCandidateNames({
      findings: dropped,
      names: GATE_NAMES,
    },),
    droppedRaw: dropped,
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
   * Syntax role requiring dedicated gate policy.
   */
  readonly syntax?: SliceSyntax;

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
  /**
   * Size evidence, or nothing when every rendering is in proportion.
   */
  const sizeNote = contestSizeNote({
    sourceText: subject.sourceText,
    renderings: [
      {
        label: 'ARCHIVE RENDERING',
        text: subject.incumbentText,
      },
      {
        label: 'CANDIDATE "consolidated"',
        text: subject.consolidatedText,
      },
      {
        label: 'CANDIDATE "standing"',
        text: subject.standingText,
      },
    ],
  },);

  /**
   * Size note and its separating blank line, or nothing at all.
   *
   * PLACED AFTER THE PASSAGES so a judge reads the texts before their
   * sizes, rather than being handed a number to confirm.
   */
  const sizeBlock = (sizeNote.length === 0)
    ? []
    : [
      sizeNote,
      '',
    ];

  /**
   * Policy extended for syntax-bearing visible metadata.
   */
  const policy = (subject.syntax === 'front-matter')
    ? `${CONTEST_POLICY}\n\n${FRONT_MATTER_DECISION_RULE}`
    : CONTEST_POLICY;

  return [
    {
      role: 'system',
      content: policy,
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
        ...sizeBlock,
        `Return JSON: choice one of "consolidated", "standing", "${CONTEST_REFUSAL}";`,
        'unsupported and dropped each a list naming any of "consolidated", "standing";',
        'reason one sentence.',
      ].join('\n',),
    },
  ];
}

//endregion Consolidate gate wire
