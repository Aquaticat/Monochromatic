import type { ArchiveBlockReviewWire, } from './archive-block-review-wire.ts';
import type { Candidate, } from './candidate-select-model.ts';
import type { SelectEvidence, } from './candidate-select-wire.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

/**
 * Review reply whose role remains available when preparing selection evidence.
 */
export type ArchiveReviewVoice = {
  readonly modelId: RosterModelId;
  readonly value: ArchiveBlockReviewWire;
};

/**
 * Anonymous assessment preserving what its reason was arguing for.
 * Candidate number links that opinion to text without exposing authorship.
 */
type ArchiveSelectionAssessment = {
  readonly disposition: ArchiveBlockReviewWire['disposition'];
  readonly proposedAction: 'retain' | 'revise';
  readonly candidate: number;
  readonly finding: string;
};

/**
 * Adds the exact unchanged block as a choice only when revisions are available.
 * An actual writer echoing the original already supplies that choice and keeps
 * its authorship; reviewers merely favoring retention are not treated as authors.
 *
 * @param revisions - admissible distinct revision candidates
 * @param blockText - original replacement scope, never surrounding context
 * @returns Comparison slate, or the existing empty-slate path
 *
 * @example
 * ```ts
 * const candidates = withArchiveOriginal({ revisions, blockText });
 * ```
 */
export function withArchiveOriginal(
  {
    revisions,
    blockText,
  }: {
    readonly revisions: readonly Candidate<string>[];
    readonly blockText: string;
  },
): readonly Candidate<string>[] {
  if (revisions.length === 0)
    return revisions;
  if (revisions.some(function alreadyOriginal(candidate,): boolean {
    return candidate.value === blockText;
  },))
    return revisions;
  return [
    ...revisions,
    {
      producer: { kind: 'incumbent', matched: [], },
      value: blockText,
      rendered: blockText,
    },
  ];
}

/**
 * Preserves review action/category and the archive context a selector needs.
 * Only eligible retention assessments enter; inadmissible revision proposals
 * remain in the stage's audit findings rather than becoming candidate evidence.
 *
 * @param sourceText - aligned factual source and corroborated picture support
 * @param targetText - archive context, not factual source authority
 * @param blockText - exact block under replacement consideration
 * @param voices - reviews surviving source-anchor or apparatus verification
 * @param candidates - actual anonymous order shown to selectors
 * @param priorFindings - earlier opinions, kept separate from current assessments
 * @returns Evidence whose reasons retain their proposed meaning
 *
 * @example
 * ```ts
 * const evidence = archiveBlockSelectionEvidence({ sourceText, targetText, blockText, voices, candidates, priorFindings: [] });
 * ```
 */
export function archiveBlockSelectionEvidence(
  {
    sourceText,
    targetText,
    blockText,
    voices,
    candidates,
    priorFindings,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
    readonly blockText: string;
    readonly voices: readonly ArchiveReviewVoice[];
    readonly candidates: readonly Candidate<string>[];
    readonly priorFindings: readonly string[];
  },
): readonly SelectEvidence[] {
  /**
   * Retain/revise intent is data, never a vote deciding the next stage's answer.
   */
  const assessments = voices.flatMap(function toAssessment(
    voice,
  ): readonly ArchiveSelectionAssessment[] {
    /**
     * Actual disposition beside the wording its reviewer proposes.
     */
    const { disposition, replacementText, finding, } = voice.value;
    /**
     * Retention points at original text, not an unused replacement field.
     */
    const proposedText = disposition === 'revise' ? replacementText : blockText;
    /**
     * A proposal excluded by contributor protection is not a candidate.
     */
    const index = candidates.findIndex(function sameValue(candidate,): boolean {
      return candidate.value === proposedText;
    },);
    if (index < 0)
      return [];
    return [{
      disposition,
      proposedAction: disposition === 'revise' ? 'revise' : 'retain',
      candidate: index + 1,
      finding,
    },];
  },);
  return [
    { label: 'EXPECTED ORIGINAL SECTION', text: sourceText, },
    {
      label: 'ENGLISH ARCHIVE, context for the current block’s role and placement only; not source authority or text to rewrite',
      text: targetText,
    },
    { label: 'CURRENT ARCHIVE BLOCK', text: blockText, },
    {
      label: 'PRIOR REVIEW ASSESSMENTS, opinions to check against the documents, not authority or votes deciding your answer',
      text: JSON.stringify(assessments,),
    },
    ...(priorFindings.length === 0 ? [] : [{
      label: 'EARLIER REVIEW FINDINGS, prior opinions only',
      text: JSON.stringify(priorFindings,),
    },]),
  ];
}
