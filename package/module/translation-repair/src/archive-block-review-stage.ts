import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  isArchiveSourceQuoteAnchored,
  isVerifiableEditorialArchiveBlock,
} from './archive-block-evidence.ts';
import { recordArchiveBlockNaturalness, } from './archive-block-naturalness.ts';
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
   * Whether original block is licensed or replaced.
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
    l,
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
  /**
   * Participation required after unsupported anchors are removed.
   */
  const requiredParticipation = rosterQuorumSize({ rosterSize: modelIds.length, });
  if ((!gather.quorumMet) || (anchoredVoices.length < requiredParticipation)) {
    throw new TranslationRepairInterruptedError({
      reason: 'provider-unavailable',
      findings,
    },);
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
      l,
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
   * Independently judged correction slate.
   */
  const selection = await decideBestCandidate({
    client,
    candidates: replacementCandidates({
      voices: anchoredVoices,
      blockText,
    },),
    judgeModelIds: modelIds,
    task: 'Choose a publishable correction for one unsupported archive-only block.',
    criteria: [
      'Remove every factual claim not supported by the original document.',
      'Retain source-supported meaning and verifiable editorial apparatus.',
      'Preserve valid Markdown and contributor identities.',
      'Prefer clear natural English without adding information.',
    ],
    evidence: [
      {
        label: 'EXPECTED ORIGINAL SECTION',
        text: sourceText,
      },
      {
        label: 'CURRENT ARCHIVE BLOCK',
        text: blockText,
      },
      {
        label: 'LATEST REVIEW FINDINGS',
        text: JSON.stringify(findings,),
      },
    ],
    declineConsequence: 'The original archive block ships unchanged, with this decline recorded as a finding.',
    signal,
    perCallTimeoutMs: exchangeTimeoutMs,
    l,
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
      kind: 'revised',
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
