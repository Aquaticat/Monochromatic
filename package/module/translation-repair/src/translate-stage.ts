import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { describeProducer, } from './candidate-select-model.ts';
import { selectBestCandidate, } from './candidate-select.ts';
import {
  KEEPS_TRUSTED_TEXT,
  LEAVES_PASSAGE_UNTRANSLATED,
} from './candidate-select-wire.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { assertJudgeableProducerRoster, } from './repair-contract.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';
import {
  blankAgainst,
  BlankSelectionError,
  type IncumbentKind,
  TranslateAbsenceError,
} from './translate-absence.ts';
import {
  buildTranslateCandidates,
  type TranslateCandidateValue,
} from './translate-candidates.ts';
import { repairInvalidCandidates, } from './translate-repair.ts';
import {
  describeSlate,
  NOT_ON_SLATE,
  positionOf,
  rotateCandidates,
} from './translate-slate.ts';
import {
  EMPTY_TALLY,
  type TranslateStageResult,
} from './translate-stage-result.ts';
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
 * @param incumbentKind - whether there is a translation to fall back on,
 * decided by the caller from the target chunk rather than from the text being
 * blank: a content span holding only whitespace is the archive's own wording,
 * and an anchor is a place where a rendering belongs and none exists
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
 * @throws {@link import('./repair-contract.ts').ProducerRosterError} when the
 * roster could not select anything: repeats on either side, no translator, or
 * judges too few to reach the minimum weight
 *
 * @throws {@link TranslateAbsenceError} when a slice with no incumbent produced
 * nothing to write, which every fallback here would otherwise report as a
 * settled slice carrying the archive's own wording, of which there is none
 *
 * @throws {@link BlankSelectionError} when selection chose text that says
 * nothing for a source that says something, in EITHER mode, since that is a
 * deletion rather than an outcome
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
    incumbentKind,
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
    readonly incumbentKind: IncumbentKind;
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
   * Not an error while the archive HAS a translation here: leaving one as it
   * stands is the state the run started in, while shipping text no judge could
   * vet is a new claim about the archive. Where the archive has none, every
   * path that would return this object refuses instead, since keeping nothing
   * is not keeping anything.
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
    // THE FALLBACK IS NOT A PHANTOM, and what it means is worth stating because
    // it reads like one. An incumbent that says something is always on the
    // slate, so the fallback is reached only where the incumbent says nothing
    // and could not be offered as a candidate. In `present` mode that is a
    // content span holding only whitespace, and the archive's own wording there
    // IS the blank: it stands, and no model matched it. In `absent` mode this
    // object is never returned at all, since every exit that would reach it
    // refuses instead.
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
    /**
     * Findings this exit reports either way, so the refusal carries the same
     * evidence the returned result would have.
     */
    const noCandidateFindings = [
      ...stageFindings,
      'translate-no-candidate',
    ];
    // NOTHING TO KEEP. With a translation in the archive, silence means it
    // stands and the slice is genuinely settled. With none, the same fallback
    // ships the empty string and reports a settled slice, so the run claims a
    // rendering it never produced for a passage that still has none.
    if (incumbentKind === 'absent') {
      throw new TranslateAbsenceError({
        reason: 'no-candidate',
        findings: noCandidateFindings,
      },);
    }
    tl.warn('translate stage: nothing proposed; slice unchanged',);
    return {
      ...keepIncumbent,
      decision: 'no-candidate',
      findings: noCandidateFindings,
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
    // WHAT A DECLINE ACTUALLY COSTS HERE, which is not what the shared sheet
    // says by default. Judges are told declining is safe because the caller
    // keeps text it already trusts; at an anchor there is no such text, so that
    // sentence asks for caution by promising a fallback that does not exist and
    // buys a missing passage with it.
    declineConsequence: (incumbentKind === 'absent')
      ? LEAVES_PASSAGE_UNTRANSLATED
      : KEEPS_TRUSTED_TEXT,
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
    // UNREACHABLE while the slate is built the way it is, and here because the
    // day it becomes reachable is the day a slice ships a deletion. Blank
    // proposals never become candidates and a blank incumbent never joins the
    // slate, so a winner always says something; this states that dependency
    // rather than relying on a reader of `candidate-select.ts` noticing it.
    if (blankAgainst({
      winner: outcome.value
        .text,
      sourceText,
    },)) {
      // ITS OWN FAULT, not an absence. A slice whose archive wording exists is
      // not unfilled just because selection returned a deletion, and reporting
      // it as one would record a translated passage as one nobody ever
      // translated. This is a defect in the slate rather than an outcome, in
      // either mode.
      throw new BlankSelectionError({
        findings: [
          ...stageFindings,
          ...outcome.findings,
        ],
      },);
    }
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
  /**
   * Findings the decline reports, whichever way this exit goes.
   */
  const declineFindings = [
    ...stageFindings,
    ...outcome.findings,
    `translate-declined (${outcome.disposition})`,
  ];

  /**
   * Which decline this was, in the vocabulary both exits use.
   */
  const declined = (outcome.disposition === 'indecision')
    ? 'declined-indecision'
    : 'declined-rejection';
  // A DECLINE IS NOT A KEEP when there is nothing to keep. Judges who could not
  // agree have said nothing about the archive's wording, which is why keeping it
  // is right; where the archive has no wording, the same silence would ship the
  // empty string as though the judges had chosen it.
  if (incumbentKind === 'absent') {
    throw new TranslateAbsenceError({
      reason: declined,
      findings: declineFindings,
    },);
  }
  tl.info(`translate stage: ${outcome.reason}; keeping the incumbent`,);
  return {
    ...keepIncumbent,
    tally: outcome.tally,
    ballots: outcome.ballots,
    perCandidate: outcome.perCandidate,
    decision: declined,
    findings: declineFindings,
  };
}

//endregion Translate stage
