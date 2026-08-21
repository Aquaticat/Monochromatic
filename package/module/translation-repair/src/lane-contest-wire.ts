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
 * const ballot: LaneContestBallot = { choice: 'repair', unsupported: [], unsupportedRaw: [], dropped: [], droppedRaw: [], reason: 'x', };
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
   * Unsupported findings exactly as this judge wrote them.
   *
   * KEPT BESIDE THE NARROWED LIST rather than instead of it. A judge that
   * answers with the offending phrases rather than with candidate names has
   * still said something, and keeping only the narrowed list would leave an
   * audit trail reading as though that judge had found nothing.
   */
  readonly unsupportedRaw: readonly string[];

  /**
   * Candidates omitting something the original says.
   */
  readonly dropped: readonly LaneChoice[];

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
export type LaneContestWire = {
  readonly choice: string;
  readonly unsupported: readonly string[];
  readonly dropped: readonly string[];
  readonly reason: string;
};

/**
 * Candidate names a judge may use, which are the lanes plus the refusal.
 */
const CANDIDATE_NAMES: readonly LaneChoice[] = [
  'repair',
  'translate',
  'neither',
];

/**
 * Same names as a set, for membership tests.
 */
const CHOICES: ReadonlySet<string> = new Set(CANDIDATE_NAMES,);

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
 * Whether a value is a list of strings, whatever those strings say.
 *
 * SHAPE, NOT VOCABULARY, which is what this guard always claimed to check.
 * An earlier form demanded that every member name a candidate, so a judge that
 * filled the findings with the offending phrases instead lost its whole ballot,
 * choice included. Two of the first sixty calibration voices went that way,
 * both carrying a usable choice. The choice is the thing the contest counts,
 * and no wording of a finding may cost a voice.
 *
 * @param value - list from a reply
 *
 * @returns Whether it is a list of strings
 *
 * @example
 * ```ts
 * const shaped = isStringList(['repair',],);
 * ```
 */
function isStringList(value: unknown,): value is readonly string[] {
  return Array.isArray(value,)
    && value.every(function isText(member: unknown,): boolean {
      return ((typeof member) === 'string');
    },);
}

/**
 * Whether the character at one offset could continue a word.
 *
 * READS PAST THE END SAFELY, because `charAt` answers an empty string beyond
 * the last index and an empty string continues nothing. A candidate name
 * filling a finding entirely therefore needs no separate case.
 *
 * @param text - finding being read
 *
 * @param at - offset just past a candidate name
 *
 * @returns Whether the character there extends that name into a longer word
 *
 * @example
 * ```ts
 * const continues = continuesWord({ text: 'repairing', at: 'repair'.length, },);
 * ```
 */
function continuesWord(
  {
    text,
    at,
  }: {
    readonly text: string;
    readonly at: number;
  },
): boolean {
  /**
   * Case-folded character at that offset, empty past the end.
   */
  const folded = text
    .charAt(at,)
    .toLowerCase();
  return (((folded >= 'a') && (folded <= 'z'))
    || ((folded >= '0') && (folded <= '9')));
}

/**
 * Whether one finding blames one candidate.
 *
 * ANNOTATION IS NOT REFUSAL. Judges write `repair`, and they write
 * `repair (changes the bottle to a can)`, and both name the same candidate.
 * A finding naming a phrase rather than a candidate blames nobody, and says so
 * by matching none of them.
 *
 * @param finding - what a judge wrote
 *
 * @param name - candidate to test for
 *
 * @returns Whether this finding names this candidate
 *
 * @example
 * ```ts
 * const blamed = namesCandidate({ finding: 'repair (adds a season)', name: 'repair', },);
 * ```
 */
function namesCandidate(
  {
    finding,
    name,
  }: {
    readonly finding: string;
    readonly name: LaneChoice;
  },
): boolean {
  /**
   * Finding with surrounding space and case removed.
   */
  const folded = finding
    .trim()
    .toLowerCase();
  return (folded.startsWith(name,)
    && (!continuesWord({
      text: folded,
      at: name.length,
    },)));
}

/**
 * Reads which candidates a list of findings blames.
 *
 * @param findings - findings exactly as a judge wrote them
 *
 * @returns Candidates named, in canonical order and without repeats
 *
 * @example
 * ```ts
 * const blamed = readCandidateNames({ findings: [ 'repair (adds a season)', ], },);
 * ```
 */
function readCandidateNames(
  { findings, }: { readonly findings: readonly string[]; },
): readonly LaneChoice[] {
  return CANDIDATE_NAMES.filter(function blamed(name,): boolean {
    return findings.some(function names(finding,): boolean {
      return namesCandidate({
        finding,
        name,
      },);
    },);
  },);
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
    unsupported: readCandidateNames({ findings: wire.unsupported, },),
    unsupportedRaw: wire.unsupported,
    dropped: readCandidateNames({ findings: wire.dropped, },),
    droppedRaw: wire.dropped,
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

  /**
   * Names and handles both documents' front matter declares, when either does.
   *
   * WITHOUT THIS THE JUDGE CANNOT TELL AN ATTESTED NAME FROM AN INVENTION.
   * Front matter is document-level while this stage sees one slice, so a name
   * the source document declares appears, to a judge shown only the slice, in
   * the archive and in the repair candidate and nowhere in the Chinese. Calling
   * it unsupported is the correct inference from that evidence and the wrong
   * answer about the passage. Measured on `Zha_Ke` slice 0, where the source
   * front matter declares an alias, the archive renders it, the repair lane
   * keeps it, the translate lane drops it, and the contest chose the lane that
   * dropped it.
   *
   * Every other model-facing stage in this package is already given this:
   * critics, refiners, translators, translate judges and the rendering audit.
   * This stage was the only one that was not.
   */
  readonly identityContext?: string;
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
  'DECLARED NAMES ARE ATTESTED FACTS about this person, taken from the documents\' own front matter.',
  'A candidate carrying one is NOT unsupported, even where the passage itself never spells it out.',
  'A candidate omitting one HAS dropped something.',
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
      subject.identityContext ?? '',
    ],
  },);

  /**
   * Declared names as one block, empty when neither side declares any.
   */
  const declared = subject.identityContext ?? '';

  /**
   * Declared names and their fence, or nothing when neither side declares any.
   *
   * PLACED BEFORE THE PASSAGES, as in the critic prompt, so the declarations
   * read as given facts rather than as a footnote to evidence already weighed.
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
      content: POLICY,
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
