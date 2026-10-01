import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  isArchiveReferenceQuoteAnchored,
  isArchiveSourceQuoteAnchored,
  isVerifiableEditorialArchiveBlock,
} from './archive-block-evidence.ts';
import { recordArchiveBlockNaturalness, } from './archive-block-naturalness.ts';
import { replacementCandidates, } from './archive-replacement-candidates.ts';
import {
  archiveBlockSelectionEvidence,
  withArchiveOriginal,
} from './archive-block-selection-evidence.ts';
import {
  type ArchiveBlockReviewWire,
  ARCHIVE_BLOCK_DECLINE_CONSEQUENCE,
  ARCHIVE_BLOCK_REVIEW_RESPONSE_FORMAT,
  ARCHIVE_BLOCK_SELECTION_CRITERIA,
  ARCHIVE_BLOCK_SELECTION_TASK,
  buildArchiveBlockReviewMessages,
  isArchiveBlockReviewWire,
} from './archive-block-review-wire.ts';
import { decideBestCandidate, } from './candidate-select.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import { reachableQuorum, } from './stage-reachable-quorum.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import { TranslationRepairInterruptedError, } from './translation-repair-interrupted-error.ts';

//region Archive block review stage

/**
 Evidence marker assigning distinct prior-decline selection responsibility.
 */
const PRIOR_CORRECTION_DECLINE = 'archive correction slate declined';

/**
 Settled review of one unclaimed archive block.
 */
export type ArchiveBlockReviewOutcome = {
  /**
   Whether exact archived text stands or a different replacement was selected.
   */
  readonly kind: 'retained' | 'revised';
  /**
   Original or selected replacement text.
   */
  readonly text: string;
  /**
   Review and selection evidence.
   */
  readonly findings: readonly string[];
};


/**
 Reviews one archive-only block once and selects a correction when any voice rejects it.
 
 SINGLE ROUND BY DESIGN: a declined correction slate or an empty one retains
 the original block with the decline recorded as a finding, because archive
 wording is the shipping default and reviewer indecision must not withhold
 the entry (doc/planning/translation-repair-no-loop-design.md).
 
 @param client - provider client
 
 @param modelIds - reviewers and correction judges
 
 @param sourceText - whole source searched for support
 
 @param targetText - whole archive supplying context
 
 @param blockText - exact block under review
 
 @param priorFindings - latest failed-strategy evidence
 
 @param identityContext - declared names preparation holds, for the
 reviewers, the correction selectors and the naturalness read (ledger B28)
 
 @param referenceContext - what the pages the original links say, with the
 attested lines under them; a retention may anchor in one page's text
 
 @param signal - caller cancellation
 
 @param exchangeTimeoutMs - per-call bound
 
 @param l - stage logger
 
 @returns Retained original or independently selected replacement
 
 @throws TranslationRepairInterruptedError when fewer seats answered at all
 than the quorum on the reachable bench needs
 
 @throws BlockOutsideArchiveError when the archive does not carry the block,
 which a revision's footnote check reads it in
 
 @example
 ```ts
 const result = await runArchiveBlockReviewStage({ ...input, priorFindings: [], });
 ```
 */
export async function runArchiveBlockReviewStage(
  {
    client,
    modelIds,
    sourceText,
    targetText,
    blockText,
    priorFindings,
    identityContext,
    referenceContext,
    signal,
    exchangeTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelIds: readonly RosterModelId[];
    readonly sourceText: string;
    readonly targetText: string;
    readonly blockText: string;
    readonly priorFindings: readonly string[];
    readonly identityContext?: string;
    readonly referenceContext?: string;
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<ArchiveBlockReviewOutcome> {
  /**
   Stage boundary for review and independent-selection diagnostics.
   */
  const reviewLog = tagged({
    l,
    tag: runArchiveBlockReviewStage.name,
  },);
  /**
   Declared names and cited pages, passed on only where the page has them,
   to every sheet this stage asks.
   */
  const pageContext = {
    ...((identityContext === undefined) ? {} : { identityContext, }),
    ...((referenceContext === undefined) ? {} : { referenceContext, }),
  };
  /**
   Quorum-bounded review voices.
   */
  const gather = await gatherStageVoices<ArchiveBlockReviewWire>({
    client,
    modelIds,
    messages: buildArchiveBlockReviewMessages({
      sourceText,
      targetText,
      blockText,
      priorFindings,
      ...pageContext,
    },),
    signal,
    exchangeTimeoutMs,
    responseFormat: ARCHIVE_BLOCK_REVIEW_RESPONSE_FORMAT,
    validate: isArchiveBlockReviewWire,
    stage: 'archive-block-review',
    l: reviewLog,
  },);
  /**
   Replies whose claimed source support exists verbatim.
   */
  const anchoredVoices = gather.voices
    .filter(function supportIsAnchored(voice,): boolean {
    if (voice.value
      .disposition
      === 'source-supported') {
      // A CITED PAGE ANCHORS TOO (ledger B28): a detail the page the original
      // links states is the translator's knowledge. Only a page's own text
      // counts, never an attested line, which quotes the archive back.
      return isArchiveSourceQuoteAnchored({
        sourceContext: sourceText,
        sourceQuote: voice.value
          .sourceQuote,
      },)
        || isArchiveReferenceQuoteAnchored({
          referenceContext: referenceContext ?? '',
          sourceQuote: voice.value
            .sourceQuote,
        },);
    }
    if (voice.value
      .disposition
      === 'editorial-context')
      return isVerifiableEditorialArchiveBlock({ blockText, });
    return true;
  },);
  /**
   Revisions earn publication through the independent selector, not through
   other reviewers' retention anchors. The initial review quorum still holds.
   */
  const {
    candidates: revisions,
    withheld,
  } = replacementCandidates({
    voices: anchoredVoices,
    blockText,
    targetText,
  },);
  for (const finding of withheld)
    reviewLog.warn(finding,);
  /**
   Evidence carried into selection and later strategies.
   */
  const findings = [...new Set([
    ...priorFindings,
    ...gather.findings,
    ...withheld,
    ...gather.voices
      .map(function recordFinding(voice,): string {
      return voice.value
        .finding;
    },),
    ...(anchoredVoices.length
      === gather.voices
      .length ? [] : ['archive review discarded uncorroborated retention claim',]),
  ],),];
  // AN UNHEARD ROSTER IS AN OUTAGE; AN UNANCHORED ONE IS A VERDICT. Only the
  // first interrupts. The second used to be thrown as `provider-unavailable`
  // too, and on 2026-09-02 it ended XIEPT2 in 114 seconds with every seat
  // answering every call: the archive is a placeholder page ("(To-Do)" and
  // translation hints), nine reviewers were heard about its one block, and
  // fewer than the exact half anchored their support in the original. The
  // no-loop design says an unresolved block is retained with its findings and
  // reviewer indecision cannot withhold the entry.
  //
  // AN ANSWER NOBODY COULD READ IS NOT SILENCE EITHER (class thirty-one). On
  // 2026-09-16 Mio13 reviewed the first chat translation with every provider
  // wet: seven of twelve seats spent their whole completion cap reasoning
  // and sent no content, one was cut in the grace window, four were heard,
  // and the stage read "4/12" as an outage. The seats the cap cut were
  // reached and answered; only the shape was lost. So the outage test counts
  // them beside the heard voices, and a bench that answered falls through
  // to the same retention an unanchored one gets.
  //
  // ONE QUORUM SIZES BOTH TESTS, on the bench the router could serve (ledger
  // B27). The participation threshold was once the exact half of the whole
  // bench while the outage test beside it already counted refused seats out
  // of reach, so a short bench whose every reachable seat anchored its quote
  // was left unresolved and never bought its naturalness read.
  /**
   Voices the gather needed, and the anchored voices the review needs, on
   the bench the router could serve.
   */
  const { needed, } = reachableQuorum({
    benchSize: modelIds.length,
    unreachable: gather.unreachable
      .size,
  },);
  if (!gather.quorumMet) {
    /**
     Voices read.
     */
    const heard = gather.voices
      .length;
    /**
     Seats that answered in a shape nothing could read.
     */
    const unread = gather.unreadable
      .size;
    if ((heard + unread) < needed) {
      throw new TranslationRepairInterruptedError({
        reason: 'provider-unavailable',
        findings,
      },);
    }
    reviewLog.warn(
      `archive-block-review: ${String(heard,)} heard and ${String(unread,)} answered unreadably of ${
        String(modelIds.length,)
      } seats; the bench answered, so the block is reviewed on what was read`,
    );
  }
  /**
   Replies heard at all, anchored or not.
   */
  const heardCount = gather.voices
    .length;
  // Participation after unsupported anchors are removed is held to the same
  // reachable quorum, since a refused seat can anchor nothing.
  if ((anchoredVoices.length < needed) && (revisions.length === 0)) {
    return {
      kind: 'retained',
      text: blockText,
      findings: [
        ...findings,
        `archive review left the block unresolved: ${String(anchoredVoices.length,)} of ${
          String(heardCount,)
        } replies supplied eligible review evidence, below the ${
          String(needed,)
        } required; the block stands as the archive wrote it`,
      ],
    };
  }
  if (anchoredVoices.every(function retains(voice,): boolean {
    return voice.value
      .disposition
      !== 'revise';
  },)) {
    /**
     Independent wording review after provenance acceptance.
     */
    const naturalnessFindings = await recordArchiveBlockNaturalness({
      client,
      modelIds,
      sourceText,
      blockText,
      ...((identityContext === undefined) ? {} : { identityContext, }),
      signal,
      exchangeTimeoutMs,
      l: reviewLog,
    },);
    return {
      kind: 'retained',
      text: blockText,
      findings: [
        ...findings,
        ...naturalnessFindings,
      ],
    };
  }
  /**
   Existing wording is an explicit choice, never an automatically approved one.
   */
  const candidates = withArchiveOriginal({
    revisions,
    blockText,
  },);
  reviewLog.info(
    `archive review: comparing ${String(revisions.length,)} admissible revisions in ${String(candidates.length,)} candidates; ${String(anchoredVoices.length,)} eligible assessments from ${String(heardCount,)} heard reviews`,
  );
  /**
   Independently judged correction slate under the unchanged selector quorum.
   */
  const selection = await decideBestCandidate({
    client,
    candidates,
    judgeModelIds: modelIds,
    sourceText,
    task: ARCHIVE_BLOCK_SELECTION_TASK,
    criteria: ARCHIVE_BLOCK_SELECTION_CRITERIA,
    evidence: archiveBlockSelectionEvidence({
      sourceText,
      targetText,
      blockText,
      voices: anchoredVoices,
      candidates,
      priorFindings,
      ...pageContext,
    },),
    declineConsequence: ARCHIVE_BLOCK_DECLINE_CONSEQUENCE,
    signal,
    perCallTimeoutMs: exchangeTimeoutMs,
    l: reviewLog,
  },);
  /**
   Review plus candidate-selection evidence.
   */
  const settledFindings = [...new Set([
    ...findings,
    ...selection.findings,
  ],),];
  if (selection.kind === 'selected')
    return {
      kind: selection.value === blockText ? 'retained' : 'revised',
      text: selection.value,
      findings: settledFindings,
    };
  // Archive wording is the shipping default; judge indecision is recorded
  // evidence, never authority to withhold the entry.
  return {
    kind: 'retained',
    text: blockText,
    findings: [...new Set([
      ...settledFindings,
      PRIOR_CORRECTION_DECLINE,
    ],),],
  };
}

//endregion Archive block review stage
