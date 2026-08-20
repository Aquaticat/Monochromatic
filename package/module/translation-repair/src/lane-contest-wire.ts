import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import { selectFence, } from './prompt-fence.ts';

//region Lane contest wire
// ASKS THE QUESTION THAT ACTUALLY SEPARATES THE TWO LANES, rather than which
// candidate reads better.
//
// WHY THAT DISTINCTION IS THE WHOLE DESIGN. Eight entries read complete against
// the Chinese, in `doc/audit/eight-entries-read-against-the-original.md`, found
// the lanes failing in opposite directions rather than at different points on
// one scale. The repair lane edits the archive, so an invention no critic
// flagged ships untouched. The translate lane owes the archive nothing, so
// accurate detail the archive knew and the source does not carry is lost, and
// where content lives only in pictures it has nothing to translate at all.
//
// A judge asked "which is better?" is being asked to weigh those against each
// other with nothing to weigh them WITH, which is consistent with the 82%
// decline rate the scratch lane-contest instrument measured. So this asks for
// the two findings that decide it, per candidate:
//
//   UNSUPPORTED: does this candidate say something the original does not?
//   DROPPED: does this candidate omit something the original does say?
//
// and takes the choice as a consequence of those, with the candidate's own
// index named so a caller can act on it.
//
// THE ORIGINAL IS THE STANDARD, per `doc/decision/translation-repair-output-goal.md`.
// The archive rendering is shown as EVIDENCE about what the original says and a
// starting point worth keeping where it is right, never as the thing a
// candidate is scored against. Accurate detail the archive adds is kept rather
// than stripped, which is the one place a candidate may exceed the original.

/**
 * Which candidate a judge chose, or that it could not choose.
 *
 * DECLINING IS A VERDICT, not a failure to answer. Two candidates that differ
 * only in wording have no better one, and a judge forced to pick would be
 * inventing a preference the evidence does not carry.
 */
export type LaneChoice = 'repair' | 'translate' | 'neither';

/**
 * One judge's reading of one contested slice.
 *
 * @example
 * ```ts
 * const ballot: LaneContestBallot = { choice: 'repair', unsupported: [], dropped: [], reason: 'x', };
 * ```
 */
export type LaneContestBallot = {
  /**
   * Candidate this judge would ship.
   */
  readonly choice: LaneChoice;

  /**
   * Candidates saying something the original does not support.
   */
  readonly unsupported: readonly LaneChoice[];

  /**
   * Candidates omitting something the original says.
   */
  readonly dropped: readonly LaneChoice[];

  /**
   * Why, for the audit trail rather than for validity.
   */
  readonly reason: string;
};

/**
 * Reply shape a judge is asked for, before it is read.
 */
export type LaneContestWire = {
  readonly choice: string;
  readonly unsupported: readonly string[];
  readonly dropped: readonly string[];
  readonly reason: string;
};

/**
 * Candidate names a judge may use, which are the lanes plus the refusal.
 */
const CHOICES: ReadonlySet<string> = new Set([
  'repair',
  'translate',
  'neither',
],);

/**
 * Whether a value is one of the names a judge may use.
 *
 * @param value - candidate name from a reply
 *
 * @returns Whether it names a lane or the refusal
 *
 * @example
 * ```ts
 * const named = isLaneChoice('repair',);
 * ```
 */
function isLaneChoice(value: unknown,): value is LaneChoice {
  return ((typeof value) === 'string') && CHOICES.has(value,);
}

/**
 * Whether every member of a list names a candidate.
 *
 * @param value - list from a reply
 *
 * @returns Whether it is a list of candidate names
 *
 * @example
 * ```ts
 * const named = isChoiceList(['repair',],);
 * ```
 */
function isChoiceList(value: unknown,): value is readonly string[] {
  return Array.isArray(value,) && value.every(isLaneChoice,);
}

/**
 * Whether a reply carries the shape a ballot is read from.
 *
 * SHAPE ONLY. Whether the findings are consistent with the choice is the
 * reader's question, because an inconsistent ballot is still a ballot that was
 * cast and is worth recording as one.
 *
 * @param value - parsed reply
 *
 * @returns Whether it can be read as a ballot
 *
 * @example
 * ```ts
 * const usable = isLaneContestWire(reply,);
 * ```
 */
export function isLaneContestWire(value: unknown,): value is LaneContestWire {
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
  return isLaneChoice(value.choice,)
    && isChoiceList(value.unsupported,)
    && isChoiceList(value.dropped,)
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
 * const ballot = readLaneContestBallot({ wire, },);
 * ```
 */
export function readLaneContestBallot(
  { wire, }: { readonly wire: LaneContestWire; },
): LaneContestBallot {
  return {
    choice: isLaneChoice(wire.choice,)
      ? wire.choice
      : 'neither',
    unsupported: wire.unsupported
      .filter(isLaneChoice,),
    dropped: wire.dropped
      .filter(isLaneChoice,),
    reason: wire.reason,
  };
}

/**
 * What a judge is shown for one contested slice.
 */
export type LaneContestSubject = {
  /**
   * Original passage, which is the standard.
   */
  readonly sourceText: string;

  /**
   * Archive rendering, as evidence rather than as the standard.
   */
  readonly incumbentText: string;

  /**
   * What the repair lane would ship.
   */
  readonly repairText: string;

  /**
   * What the translate lane would ship.
   */
  readonly translateText: string;
};

/**
 * What the judge is told its job is.
 */
const POLICY = [
  'You are choosing which of two English renderings of a Chinese passage should be published.',
  '',
  'THE ORIGINAL IS THE STANDARD. Judge each candidate against the Chinese, never against the archive rendering.',
  'The archive rendering is shown only as evidence about what the original says, and as wording worth keeping where it is right.',
  '',
  'Answer two questions about each candidate first, and let the choice follow from them.',
  '',
  'UNSUPPORTED: does the candidate state something the Chinese does not say?',
  'An invented time period, an invented characterisation, a strengthened claim: all unsupported.',
  'A detail the archive supplies that the Chinese does not contradict, such as a name or a spelled-out referent, is NOT unsupported: keeping it is correct.',
  '',
  'DROPPED: does the candidate omit something the Chinese does say?',
  'A clause, a qualifier, a named object, a speaker aside: all dropped.',
  '',
  'THEN CHOOSE. Prefer the candidate with no unsupported statements. If both are clean, prefer the one that drops nothing.',
  'Answer "neither" when they differ only in wording and neither is more faithful, which is a real verdict rather than a failure to answer.',
  'Answer "neither" also when both are equally unfaithful.',
].join('\n',);

/**
 * Builds the exchange asking one judge to settle one contested slice.
 *
 * @param subject - passage, archive rendering and both candidates
 *
 * @returns Messages for one exchange
 *
 * @example
 * ```ts
 * const messages = buildLaneContestMessages({ subject, },);
 * ```
 */
export function buildLaneContestMessages(
  { subject, }: { readonly subject: LaneContestSubject; },
): readonly ChatMessage[] {
  /**
   * Fence long enough to enclose every text without one closing early.
   */
  const fence = selectFence({
    texts: [
      subject.sourceText,
      subject.incumbentText,
      subject.repairText,
      subject.translateText,
    ],
  },);
  return [
    {
      role: 'system',
      content: POLICY,
    },
    {
      role: 'user',
      content: [
        'ORIGINAL (Chinese), the standard:',
        `${fence}\n${subject.sourceText}\n${fence}`,
        '',
        'ARCHIVE RENDERING, evidence only:',
        `${fence}\n${subject.incumbentText}\n${fence}`,
        '',
        'CANDIDATE "repair":',
        `${fence}\n${subject.repairText}\n${fence}`,
        '',
        'CANDIDATE "translate":',
        `${fence}\n${subject.translateText}\n${fence}`,
        '',
        'Return JSON: choice one of "repair", "translate", "neither";',
        'unsupported and dropped each a list naming any of "repair", "translate";',
        'reason one sentence.',
      ].join('\n',),
    },
  ];
}

//endregion Lane contest wire
