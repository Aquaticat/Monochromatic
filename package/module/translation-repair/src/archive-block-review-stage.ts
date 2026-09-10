import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  isArchiveSourceQuoteAnchored,
  isVerifiableEditorialArchiveBlock,
} from './archive-block-evidence.ts';
import { recordArchiveBlockNaturalness, } from './archive-block-naturalness.ts';
import {
  archiveBlockSelectionEvidence,
  withArchiveOriginal,
} from './archive-block-selection-evidence.ts';
import {
  type ArchiveBlockReviewWire,
  ARCHIVE_BLOCK_REVIEW_RESPONSE_FORMAT,
  buildArchiveBlockReviewMessages,
  isArchiveBlockReviewWire,
} from './archive-block-review-wire.ts';
import {
  type Candidate,
  mergeProducers,
} from './candidate-select-model.ts';
import { decideBestCandidate, } from './candidate-select.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { archiveContributorNameForms, } from './contributor-name-authority.ts';
import { findDroppedDeclaredNames, } from './declared-name-survival.ts';
import { rosterQuorumSize, } from './roster-quorum-size.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import { TranslationRepairInterruptedError, } from './translation-repair-interrupted-error.ts';

//region Archive block review stage

/**
 * Evidence marker assigning distinct prior-decline selection responsibility.
 */
const PRIOR_CORRECTION_DECLINE = 'archive correction slate declined';

/**
 * Settled review of one unclaimed archive block.
 */
export type ArchiveBlockReviewOutcome = {
  /**
   * Whether exact archived text stands or a different replacement was selected.
   */
  readonly kind: 'retained' | 'revised';
  /**
   * Original or selected replacement text.
   */
  readonly text: string;
  /**
   * Review and selection evidence.
   */
  readonly findings: readonly string[];
};

/**
 * Collapses byte-identical replacement proposals while preserving authorship.
 *
 * @param voices - review replies eligible to revise
 *
 * @returns Distinct replacement candidates
 */
function replacementCandidates(
  {
    voices,
    blockText,
  }: {
    readonly voices: readonly {
      readonly modelId: RosterModelId;
      readonly value: ArchiveBlockReviewWire
    }[];
    readonly blockText: string;
  },
): readonly Candidate<string>[] {
  /**
   * Contributor identities current block makes authoritative.
   */
  const contributorNames = archiveContributorNameForms({ text: blockText, });
  /**
   * Distinct candidates accumulated in roster order.
   */
  const candidates: Candidate<string>[] = [];
  for (const voice of voices) {
    if (voice.value
      .disposition
      !== 'revise')
      continue;
    if (findDroppedDeclaredNames({
      forms: contributorNames,
      baseText: blockText,
      candidateText: voice.value
        .replacementText,
    },)
      .length
      > 0)
      continue;
    /**
     * Earlier byte-identical correction.
     */
    const existing = candidates.find(function sameReplacement(candidate,): boolean {
      return candidate.value
        === voice.value
        .replacementText;
    },);
    if (existing === undefined) {
      candidates.push({
        producer: {
          kind: 'model',
          modelId: voice.modelId,
        },
        value: voice.value
          .replacementText,
        rendered: voice.value
          .replacementText
          === ''
          ? '[REMOVE BLOCK]'
          : voice.value
            .replacementText,
      },);
      continue;
    }
    candidates.splice(
      candidates.indexOf(existing,),
      1,
      {
      ...existing,
      producer: mergeProducers({
        left: existing.producer,
        right: {
          kind: 'model',
          modelId: voice.modelId,
        },
      },),
    },
    );
  }
  return candidates;
}

/**
 * Reviews one archive-only block once and selects a correction when any voice rejects it.
 *
 * SINGLE ROUND BY DESIGN: a declined correction slate or an empty one retains
 * the original block with the decline recorded as a finding, because archive
 * wording is the shipping default and reviewer indecision must not withhold
 * the entry (doc/planning/translation-repair-no-loop-design.md).
 *
 * @param client - provider client
 *
 * @param modelIds - reviewers and correction judges
 *
 * @param sourceText - whole source searched for support
 *
 * @param targetText - whole archive supplying context
 *
 * @param blockText - exact block under review
 *
 * @param priorFindings - latest failed-strategy evidence
 *
 * @param signal - caller cancellation
 *
 * @param exchangeTimeoutMs - per-call bound
 *
 * @param l - stage logger
 *
 * @returns Retained original or independently selected replacement
 *
 * @example
 * ```ts
 * const result = await runArchiveBlockReviewStage({ ...input, priorFindings: [], });
 * ```
 */
export async function runArchiveBlockReviewStage(
  {
    client,
    modelIds,
    sourceText,
    targetText,
    blockText,
    priorFindings,
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
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<ArchiveBlockReviewOutcome> {
  /**
   * Stage boundary for review and independent-selection diagnostics.
   */
  const reviewLog = tagged({
    l,
    tag: runArchiveBlockReviewStage.name,
  },);
  /**
   * Quorum-bounded review voices.
   */
  const gather = await gatherStageVoices<ArchiveBlockReviewWire>({
    client,
    modelIds,
    messages: buildArchiveBlockReviewMessages({
      sourceText,
      targetText,
      blockText,
      priorFindings,
    },),
    signal,
    exchangeTimeoutMs,
    responseFormat: ARCHIVE_BLOCK_REVIEW_RESPONSE_FORMAT,
    validate: isArchiveBlockReviewWire,
    stage: 'archive-block-review',
    l: reviewLog,
  },);
  /**
   * Replies whose claimed source support exists verbatim.
   */
  const anchoredVoices = gather.voices
    .filter(function supportIsAnchored(voice,): boolean {
    if (voice.value
      .disposition
      === 'source-supported') {
      return isArchiveSourceQuoteAnchored({
        sourceContext: sourceText,
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
   * Evidence carried into selection and later strategies.
   */
  const findings = [...new Set([
    ...priorFindings,
    ...gather.findings,
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
  if (!gather.quorumMet) {
    throw new TranslationRepairInterruptedError({
      reason: 'provider-unavailable',
      findings,
    },);
  }
  /**
   * Participation required after unsupported anchors are removed.
   */
  const requiredParticipation = rosterQuorumSize({ rosterSize: modelIds.length, });
  /**
   * Replies heard at all, anchored or not.
   */
  const heardCount = gather.voices
    .length;
  /**
   * Revisions earn publication through the independent selector, not through
   * other reviewers' retention anchors. The initial review quorum still holds.
   */
  const revisions = replacementCandidates({
    voices: anchoredVoices,
    blockText,
  },);
  if ((anchoredVoices.length < requiredParticipation) && (revisions.length === 0)) {
    return {
      kind: 'retained',
      text: blockText,
      findings: [
        ...findings,
        `archive review left the block unresolved: ${String(anchoredVoices.length,)} of ${
          String(heardCount,)
        } replies supplied eligible review evidence, below the ${
          String(requiredParticipation,)
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
     * Independent wording review after provenance acceptance.
     */
    const naturalnessFindings = await recordArchiveBlockNaturalness({
      client,
      modelIds,
      sourceText,
      blockText,
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
   * Existing wording is an explicit choice, never an automatically approved one.
   */
  const candidates = withArchiveOriginal({
    revisions,
    blockText,
  },);
  reviewLog.info(
    `archive review: comparing ${String(revisions.length,)} admissible revisions in ${String(candidates.length,)} candidates; ${String(anchoredVoices.length,)} eligible assessments from ${String(heardCount,)} heard reviews`,
  );
  /**
   * Independently judged correction slate under the unchanged selector quorum.
   */
  const selection = await decideBestCandidate({
    client,
    candidates,
    judgeModelIds: modelIds,
    sourceText,
    task: 'Choose whether to retain or correct one unclaimed English archive block for publication.',
    criteria: [
      'Remove every factual claim not supported by the original document.',
      'Retain source-supported meaning and verifiable editorial apparatus.',
      'Preserve valid Markdown and contributor identities.',
      'Prefer clear natural English without adding information.',
    ],
    evidence: archiveBlockSelectionEvidence({
      sourceText,
      targetText,
      blockText,
      voices: anchoredVoices,
      candidates,
      priorFindings,
    },),
    declineConsequence: 'The original archive block ships unchanged, with this decline recorded as a finding.',
    signal,
    perCallTimeoutMs: exchangeTimeoutMs,
    l: reviewLog,
  },);
  /**
   * Review plus candidate-selection evidence.
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
