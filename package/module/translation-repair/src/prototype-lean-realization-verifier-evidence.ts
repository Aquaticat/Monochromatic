// PROTOTYPE ONLY: Candidate L model-facing front-matter evidence projection.

import { hashContent, } from './document-node.ts';
import {
  leanFrontMatterContract,
  type LeanFrontMatterAuthority,
} from './prototype-lean-realization-front-matter.ts';
import type { ReviewUnitCandidate, } from './prototype-review-unit-model.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';

/**
 * Model-facing source subject without archive target wording.
 */
type SourceFrontMatterSubject = {
  readonly subjectIndex: number;
  readonly path: readonly string[];
  readonly targetSlotKey: string;
  readonly sourceText: string;
  readonly sourceDigest: string;
  readonly authority: LeanFrontMatterAuthority;
};

/**
 * Candidate-bound front-matter comparison subject.
 */
type CandidateFrontMatterSubject = SourceFrontMatterSubject & {
  readonly candidateText: string;
  readonly candidateDigest: string;
  readonly sourceAliasMembers: readonly string[];
  readonly protectedCasedMembers: readonly string[];
};

/**
 * Whether text contains one cased identity letter.
 *
 * @param text - Source alias member
 *
 * @returns Whether exact member receives deterministic protection
 */
function hasCasedLetter(text: string,): boolean {
  return text.toLocaleLowerCase('en-US',) !== text.toLocaleUpperCase('en-US',);
}

/**
 * Builds source-only and candidate-bound front-matter verifier evidence.
 *
 * @returns Projection with no archive-derived target field
 *
 * @example
 * ```ts
 * const evidence = leanVerifierEvidence({ reviewPlan, candidate, });
 * ```
 */
export function leanVerifierEvidence({
  reviewPlan,
  candidate,
}: {
  readonly reviewPlan: ReviewUnitPlan;
  readonly candidate: ReviewUnitCandidate;
}): {
  readonly sourceReviewPlan: Omit<ReviewUnitPlan, 'frontMatterSubjects' | 'reviewPlanDigest'> & {
    readonly frontMatterSubjects: readonly SourceFrontMatterSubject[];
  };
  readonly sourceReviewPlanDigest: string;
  readonly admissionReviewPlanDigest: string;
  readonly candidateFrontMatterSubjects: readonly CandidateFrontMatterSubject[];
} {
  /**
   * Source-only subjects with archive target wording removed.
   */
  const sourceSubjects = reviewPlan.frontMatterSubjects
    .map(function source(subject,) {
    return {
      subjectIndex: subject.subjectIndex,
      path: subject.path,
      targetSlotKey: subject.targetSlotKey,
      sourceText: subject.sourceText,
      sourceDigest: subject.sourceDigest,
      authority: leanFrontMatterContract({ path: subject.path, })
        .authority,
    };
  },);
  /**
   * Review plan shown to model without archive target values or digests.
   */
  const sourceReviewPlan = {
    version: reviewPlan.version,
    shellDigest: reviewPlan.shellDigest,
    ledgerDigest: reviewPlan.ledgerDigest,
    frontMatterSubjects: sourceSubjects,
    frontMatterStructureDigest: reviewPlan.frontMatterStructureDigest,
    frontMatterScalarDigest: reviewPlan.frontMatterScalarDigest,
    sourceEvidence: reviewPlan.sourceEvidence,
    clauses: reviewPlan.clauses,
    slotGroups: reviewPlan.slotGroups,
    relations: reviewPlan.relations,
    globalCriteria: reviewPlan.globalCriteria,
    priorGlobalOwnership: reviewPlan.priorGlobalOwnership,
  };
  /**
   * Candidate-bound subjects carrying exact current target values.
   */
  const candidateFrontMatterSubjects = sourceSubjects.map(function target(subject,) {
    /**
     * Candidate text under exact synthetic target slot.
     */
    const candidateText = candidate.slots[subject.targetSlotKey];
    if (candidateText === undefined)
      throw new Error('lean verifier candidate front matter is absent');
    /**
     * Ordered source alias members only for alias identity subject.
     */
    const sourceAliasMembers = leanFrontMatterContract({ path: subject.path, })
      .kind
      === 'alias'
      ? subject.sourceText
        .split(',')
        .map(function trim(value,) { return value.trim(); })
      : [];
    return {
      ...subject,
      candidateText,
      candidateDigest: hashContent({ content: candidateText, }),
      sourceAliasMembers,
      protectedCasedMembers: sourceAliasMembers.filter(hasCasedLetter,),
    };
  },);
  return {
    sourceReviewPlan,
    sourceReviewPlanDigest: hashContent({ content: JSON.stringify(sourceReviewPlan,), }),
    admissionReviewPlanDigest: reviewPlan.reviewPlanDigest,
    candidateFrontMatterSubjects,
  };
}
