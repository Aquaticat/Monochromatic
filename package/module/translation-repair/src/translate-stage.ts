import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  type CandidateProducer,
  type CandidateWeight,
  describeProducer,
  type SelectionBallot,
  type SelectionTally,
} from './candidate-select-model.ts';
import { selectBestCandidate, } from './candidate-select.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { assertJudgeableProducerRoster, } from './repair-contract.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';
import {
  buildTranslateCandidates,
  type TranslateCandidateValue,
  type TranslateOrigin,
} from './translate-candidates.ts';
import { repairInvalidCandidates, } from './translate-repair.ts';
import {
  describeSlate,
  NOT_ON_SLATE,
  positionOf,
  rotateCandidates,
  type TranslateSlateEntry,
} from './translate-slate.ts';
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
// A fresh candidate whose Markdown structure, footnote markers, links or
// inline code do not match the ORIGINAL is not dropped: it goes back to the
// model that wrote it with the findings, and that model revises, declines, or
// says the finding is a fact about the passage rather than about its work. See
// `translate-repair.ts`. The apply gate cannot serve here at all, since every
// policy in it is anchored to an edit bounded by an envelope some accepted
// issue named, and a whole-slice replacement has none.
//
// WHAT THIS STAGE STILL DOES NOT DO: check declared names, which needs the
// identity block parsed rather than passed through, and check anything that
// crosses a slice boundary, which is `#92`.

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

  /**
   * Candidates in the order the judges saw them, which is what makes a stored
   * ballot readable: ballots name a position, and the slate is rotated per
   * slice.
   *
   * The ASSEMBLED rotated order, whether or not judges were called. A slice
   * with one distinct proposal ships it without a round and still records the
   * slate, because what was on the ballot is the same question either way and
   * `decision` already says whether anyone voted. Empty only when the slice had
   * no candidates at all.
   */
  readonly slate: readonly TranslateSlateEntry[];

  /**
   * Position the judges chose, or {@link NOT_ON_SLATE} when they chose nothing.
   */
  readonly selectedIndex: number;

  /**
   * Position of the text that actually shipped, which differs from the
   * selection on every fallback and is {@link NOT_ON_SLATE} when the shipped
   * text was never a candidate, as a blank incumbent never is.
   */
  readonly shippedIndex: number;

  /**
   * What each position drew, so a decline says by how much and against what.
   */
  readonly perCandidate: readonly CandidateWeight[];
};

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
 * roster could not select anything: repeats on either side, no translator, or
 * judges too few to reach the minimum weight
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
    l: tl,
  },);

  /**
   * Candidates after structural validation, with anything that failed handed
   * back to its own author.
   *
   * The INCUMBENT is not among these and is never validated into or out of
   * the slate. It is the fallback and the text being defended, so a check
   * that could drop it would be a check that could delete the archive.
   */
  const repaired = await repairInvalidCandidates({
    client,
    voices: gather.voices,
    sourceText,
    incumbentText,
    priorMessages: plan.messages,
    signal,
    perCallTimeoutMs,
    l: tl,
  },);

  /**
   * Slate of distinct proposals with the incumbent among them.
   */
  const built = buildTranslateCandidates({
    voices: repaired.voices,
    translatorModelIds,
    incumbentText,
  },);

  /**
   * Findings shared by every exit after the fan-out.
   */
  const stageFindings = [
    ...gather.findings,
    ...repaired.findings,
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
  const rotated = rotateCandidates({
    candidates: built.candidates,
    sourceText,
  },);

  /**
   * That slate as a record, so a ballot naming a position can be read later.
   *
   * Derived from the SAME array the judges are shown rather than by rotating a
   * second time. Two rotations agree today because the rotation is a pure
   * function of the slice; they would stop agreeing the moment either call site
   * changed, and the failure would be silent, since a ballot index is a valid
   * index either way.
   */
  const slate = describeSlate({ candidates: rotated, },);

  /**
   * The incumbent as it stands on the ballot, carrying every model that
   * reproduced it exactly.
   *
   * Read off the slate rather than written fresh. Writing `matched: []` here
   * erased the collapse on precisely the declined rounds where knowing that
   * three models independently produced the archive's wording is the whole
   * evidence that keeping it was right.
   */
  const incumbentOnSlate = slate.find(function isIncumbent(entry,): boolean {
    return entry.origin === 'incumbent';
  },);

  /**
   * Shipping the slice exactly as it stands, which every failure path returns.
   */
  const keepIncumbent: Omit<TranslateStageResult, 'decision' | 'findings'> = {
    text: incumbentText,
    origin: 'incumbent',
    producer: incumbentOnSlate?.producer
      ?? {
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
    slate,
    selectedIndex: NOT_ON_SLATE,
    shippedIndex: positionOf({
      slate,
      text: incumbentText,
    },),
    perCandidate: [],
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
    candidates: rotated,
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
    l: tl,
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
      slate,
      selectedIndex: outcome.selectedIndex,
      shippedIndex: outcome.selectedIndex,
      perCandidate: outcome.perCandidate,
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
    perCandidate: outcome.perCandidate,
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
