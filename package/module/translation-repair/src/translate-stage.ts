import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  type CandidateProducer,
  describeProducer,
  type SelectionBallot,
  type SelectionTally,
} from './candidate-select-model.ts';
import { selectBestCandidate, } from './candidate-select.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import { assertJudgeableProducerRoster, } from './repair-contract.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';
import {
  buildTranslateCandidates,
  type TranslateCandidateValue,
  type TranslateOrigin,
} from './translate-candidates.ts';
import {
  buildTranslateMessages,
  isTranslateReportWire,
  TRANSLATE_RESPONSE_FORMAT,
} from './translate-wire.ts';

//region Translate stage
// Every slice is translated from the ORIGINAL by several models independently,
// the translation already in the archive stands as one more candidate, and the
// whole judge roster chooses per slice, with a translator's ballot for its own
// rendering counted at reduced weight.
//
// This is not the editor stage with a different prompt. The editor answers
// "repair these named defects in this region", which cannot reach a passage that
// was never translated and cannot see a slice that is present, fluent and
// mediocre. This asks "render this passage", which reaches both.
//
// WHAT THIS STAGE DOES NOT DO, so a reader does not assume it: it does not
// validate a candidate's Markdown structure, footnote markers or declared names,
// and the deterministic apply gate that enforced those on edits does not apply
// to a whole-slice replacement, which has no envelope to bound. That validator
// is separate work and this stage will call it when it exists.

/**
 * How a slice's shipped text was decided.
 *
 * Kept apart from the origin because "the incumbent shipped" and "the judges
 * chose the incumbent" are different facts, and only the second is evidence
 * about the incumbent. A tie, a lost round or an empty slate all ship the
 * incumbent too, and counting those as wins would report the archive as
 * vindicated by exactly the rounds that examined nothing.
 *
 * @example
 * ```ts
 * const decision: TranslateDecision = 'judged';
 * ```
 */
export type TranslateDecision =
  | 'judged'
  | 'sole-candidate'
  | 'declined-indecision'
  | 'declined-rejection'
  | 'no-candidate';

/**
 * Everything the translate stage decided for one slice.
 *
 * @example
 * ```ts
 * const { text, origin, decision, } = await runTranslateStage({ ... },);
 * ```
 */
export type TranslateStageResult = {
  /**
   * Text that ships for this slice.
   */
  readonly text: string;

  /**
   * Whether that text was already there.
   */
  readonly origin: TranslateOrigin;

  /**
   * Who produced it.
   */
  readonly producer: CandidateProducer;

  /**
   * How it was decided.
   */
  readonly decision: TranslateDecision;

  /**
   * Ballot weight the winner drew, zero when no round decided it. A weight
   * rather than a count because a judge voting for its own work counts for
   * less; see `SELF_VOTE_WEIGHT`.
   */
  readonly voteWeight: number;

  /**
   * What the judging round counted; zeros when none ran.
   */
  readonly tally: SelectionTally;

  /**
   * Every ballot cast, so a replaced human translation carries the reasons it
   * was replaced for rather than leaving them in a log.
   */
  readonly ballots: readonly SelectionBallot[];

  /**
   * Translators whose reply arrived and validated.
   */
  readonly heardTranslators: number;

  /**
   * Distinct proposals the judges saw, incumbent included.
   */
  readonly candidateCount: number;

  /**
   * Voice loss, blank replies, incumbent matches and fallbacks, in
   * scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Hex digits of the slice hash that fix candidate order.
 */
const ROTATION_HEX_DIGITS = 8;

/**
 * Radix of that hash prefix.
 */
const HEX_RADIX = 16;

/**
 * Tally of a stage that never reached the judges.
 */
const EMPTY_TALLY: SelectionTally = {
  judgesAvailable: 0,
  ballots: 0,
  abstentions: 0,
  selfVotes: 0,
};

/**
 * Rotates the candidate slate by a hash of the slice, so the incumbent does not
 * sit in the same ballot position on every slice.
 *
 * Judges receive one caller-fixed order, and the incumbent win rate is the
 * measurement this whole lane exists to produce. Pinning the incumbent to
 * position one would confound that rate with whatever position preference the
 * judges have, and the confound would be invisible: every slice would carry it
 * equally.
 *
 * Rotation rather than shuffling, and keyed on the SOURCE rather than on a
 * random draw, because a slice's candidate order has to be identical between a
 * fresh run and a resumed one. A cached slice replayed under a different order
 * would be a different question asked of the judges.
 *
 * @param candidates - slate in assembly order
 *
 * @param sourceText - slice original, the rotation key
 *
 * @returns Same candidates, rotated
 *
 * @example
 * ```ts
 * const ordered = rotateCandidates({ candidates, sourceText, },);
 * ```
 */
function rotateCandidates<ValueT,>(
  {
    candidates,
    sourceText,
  }: {
    readonly candidates: readonly ValueT[];
    readonly sourceText: string;
  },
): readonly ValueT[] {
  if (candidates.length === 0)
    return candidates;

  /**
   * Positions to rotate left by, derived from the slice itself.
   */
  const offset = Number.parseInt(
    hashContent({ content: sourceText, },)
      .slice(
        0,
        ROTATION_HEX_DIGITS,
      ),
    HEX_RADIX,
  ) % candidates.length;

  return [
    ...candidates.slice(offset,),
    ...candidates.slice(
      0,
      offset,
    ),
  ];
}

/**
 * Translates one slice from its original and returns the text that ships.
 *
 * @param client - injected model client
 *
 * @param translatorModelIds - models rendering the slice independently
 *
 * @param judgeModelIds - whole roster selection seats, translators included;
 * a ballot for the judge's own rendering counts for less
 *
 * @param sourceText - original slice text
 *
 * @param incumbentText - translation as it stands, blank where this slice has
 * none
 *
 * @param identityContext - declared names from both sides' front matter,
 * omitted when neither declares anything
 *
 * @param lineStructured - whether the enclosing CHUNK's original is
 * line-structured, decided by the caller
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Shipped text with how it was decided
 *
 * @throws {@link import('./repair-contract.ts').EditorRosterError} when the
 * translator roster leaves too few disinterested judges
 *
 * @example
 * ```ts
 * const translated = await runTranslateStage({ ... },);
 * ```
 */
export async function runTranslateStage(
  {
    client,
    translatorModelIds,
    judgeModelIds,
    sourceText,
    incumbentText,
    identityContext,
    lineStructured,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly translatorModelIds: readonly SyntheticModelId[];
    readonly judgeModelIds: readonly SyntheticModelId[];
    readonly sourceText: string;
    readonly incumbentText: string;
    readonly identityContext?: string;
    readonly lineStructured: boolean;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<TranslateStageResult> {
  assertJudgeableProducerRoster({
    producerModelIds: translatorModelIds,
    judgeModelIds,
    role: 'translator',
  },);

  /**
   * Logger tagged with this stage.
   */
  const tl = tagged({
    tag: runTranslateStage.name,
    l,
  },);

  /**
   * Translator sheet shared by every translator, so their renderings answer the
   * same question and stay comparable.
   */
  const plan = buildTranslateMessages({
    sourceText,
    existingText: incumbentText,
    ...((identityContext === undefined) ? {} : { identityContext, }),
    lineStructured,
  },);

  /**
   * Translator replies after retry-to-quorum.
   */
  const gather = await gatherStageVoices({
    client,
    modelIds: translatorModelIds,
    messages: plan.messages,
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    responseFormat: TRANSLATE_RESPONSE_FORMAT,
    validate: isTranslateReportWire,
    stage: 'translate',
    l,
  },);

  /**
   * Slate of distinct proposals with the incumbent among them.
   */
  const built = buildTranslateCandidates({
    voices: gather.voices,
    translatorModelIds,
    incumbentText,
  },);

  /**
   * Findings shared by every exit after the fan-out.
   */
  const stageFindings = [
    ...gather.findings,
    ...built.findings,
    `translate-candidates (${String(gather.voices
      .length,)}/${String(translatorModelIds.length,)} heard, ${
      String(built.candidates
        .length,)
    } distinct, ${String(built.collapsed,)} collapsed)`,
  ];

  /**
   * Shipping the slice exactly as it stands, which every failure path returns.
   *
   * Not an error even when the slice has no translation at all: leaving an
   * untranslated passage untranslated is the state the run started in, while
   * shipping text no judge could vet is a new claim about the archive.
   */
  const keepIncumbent: Omit<TranslateStageResult, 'decision' | 'findings'> = {
    text: incumbentText,
    origin: 'incumbent',
    producer: {
      kind: 'incumbent',
      matched: [],
    },
    voteWeight: 0,
    tally: EMPTY_TALLY,
    ballots: [],
    heardTranslators: gather.voices
      .length,
    candidateCount: built.candidates
      .length,
  };
  if (built.candidates
    .length
    === 0) {
    tl.warn('translate stage: nothing proposed and no incumbent; slice unchanged',);
    return {
      ...keepIncumbent,
      decision: 'no-candidate',
      findings: [
        ...stageFindings,
        'translate-no-candidate',
      ],
    };
  }

  /**
   * Sole proposal, when the slate collapsed to one.
   */
  const [only,] = built.candidates;

  /**
   * Whether the only survivor is the text that was already there.
   */
  const soleIncumbent = (only !== undefined)
    && (built.candidates
      .length
      === 1)
    && (only.value
      .origin
      === 'incumbent');

  // Shipping unjudged is safe only when nothing could change: the sole
  // survivor IS the incumbent, so the slice ships as it stands whatever the
  // judges would have said, and a fan-out would buy nothing. A sole FRESH
  // candidate is the opposite case and is judged, because the repair pipeline's
  // later safeguards, the resolution checkers and the unchanged-versus-patched
  // selection, do not exist on this path: nothing else would look at it.
  if (soleIncumbent && (only !== undefined)) {
    tl.info(
      `translate stage: every proposal was the incumbent (${
        describeProducer(only.producer,)
      }); shipping it unjudged`,
    );
    return {
      ...keepIncumbent,
      producer: only.producer,
      decision: 'sole-candidate',
      findings: stageFindings,
    };
  }

  /**
   * Judges' verdict over the whole-slice candidates.
   */
  const outcome = await selectBestCandidate<TranslateCandidateValue>({
    client,
    candidates: rotateCandidates({
      candidates: built.candidates,
      sourceText,
    },),
    judgeModelIds,
    task:
      'Each candidate is a complete English translation of the Chinese ORIGINAL below, for a memorial archive.',
    criteria: [
      'Complete coverage: every proposition of the ORIGINAL is rendered, nothing left out.',
      'Faithfulness: nothing added, and no change to who acts, what is referred to, '
      + 'negation, certainty, time, number, or how things relate.',
      'Declared names, handles and archive terminology used exactly as given.',
      'Markdown structure of the ORIGINAL preserved: block quotes, list markers, '
      + 'headings, footnote markers, links, and the breaks between blocks.',
      'Natural, idiomatic English reading as one coherent passage.',
    ],
    evidence: [
      {
        label: 'ORIGINAL (Chinese)',
        text: sourceText,
      },
      // Declared names travel as evidence rather than as part of a candidate,
      // because a judge cannot check criterion three without them. The existing
      // translation deliberately does NOT travel here: it is on the ballot,
      // anonymously, and showing it twice would tell the judges which candidate
      // is the incumbent.
      ...((identityContext === undefined) || (identityContext === '')
        ? []
        : [
          {
            label: 'DECLARED NAMES',
            text: identityContext,
          },
        ]),
    ],
    signal,
    perCallTimeoutMs,
    l,
  },);
  if (outcome.kind === 'selected') {
    tl.info(
      `translate stage: ${describeProducer(outcome.producer,)} won weight ${
        String(outcome.voteWeight,)
      }`,
    );
    return {
      text: outcome.value
        .text,
      origin: outcome.value
        .origin,
      producer: outcome.producer,
      decision: 'judged',
      voteWeight: outcome.voteWeight,
      tally: outcome.tally,
      ballots: outcome.ballots,
      heardTranslators: gather.voices
        .length,
      candidateCount: built.candidates
        .length,
      findings: [
        ...stageFindings,
        ...outcome.findings,
      ],
    };
  }

  // Both declines keep the text that is already there, which is the difference
  // between this stage and the editor's. There, a decline still shipped the
  // strongest repair, because the panel had already ruled the defects real and
  // dropping them would have lost recall. Here the candidates are whole
  // translations of a passage nobody filed a complaint about, so replacing the
  // archive's own wording needs judges who agreed, not judges who could not.
  tl.info(`translate stage: ${outcome.reason}; keeping the incumbent`,);
  return {
    ...keepIncumbent,
    tally: outcome.tally,
    ballots: outcome.ballots,
    decision: (outcome.disposition === 'indecision')
      ? 'declined-indecision'
      : 'declined-rejection',
    findings: [
      ...stageFindings,
      ...outcome.findings,
      `translate-declined (${outcome.disposition})`,
    ],
  };
}

//endregion Translate stage
