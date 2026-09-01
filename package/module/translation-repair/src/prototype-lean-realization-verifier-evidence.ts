// PROTOTYPE ONLY: Candidate L model-facing front-matter evidence projection.

import { hashContent, } from './document-node.ts';
import {
  leanFrontMatterContract,
  type LeanFrontMatterAuthority,
  type LeanFrontMatterContract,
} from './prototype-lean-realization-front-matter-contract.ts';
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
  readonly kind: LeanFrontMatterContract['kind'];
  readonly grammar: LeanFrontMatterContract['grammar'];
};

/**
 * One immutable model-facing alias position.
 */
type AliasMemberPair = {
  readonly index: number;
  readonly sourceMember: string;
  readonly candidateMember: string;
  readonly protectedCased: boolean;
};

/**
 * Candidate-bound front-matter comparison subject.
 */
type CandidateFrontMatterSubject = SourceFrontMatterSubject & {
  readonly candidateText: string;
  readonly candidateDigest: string;
  readonly sourceAliasMembers: readonly string[];
  readonly candidateAliasMembers: readonly string[];
  readonly aliasMemberPairs: readonly AliasMemberPair[];
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
    /**
     * Canonical executable path contract.
     */
    const contract = leanFrontMatterContract({ path: subject.path, });
    return {
      subjectIndex: subject.subjectIndex,
      path: subject.path,
      targetSlotKey: subject.targetSlotKey,
      sourceText: subject.sourceText,
      sourceDigest: subject.sourceDigest,
      authority: contract.authority,
      kind: contract.kind,
      grammar: contract.grammar,
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
     * Canonical executable path contract.
     */
    const contract = leanFrontMatterContract({ path: subject.path, });
    /**
     * Ordered source alias members only for alias identity subject.
     */
    const sourceAliasMembers = contract.kind === 'alias'
      ? subject.sourceText
        .split(contract.grammar
          .sourceDelimiter,)
        .map(function trim(value,) { return value.trim(); })
      : [];
    /**
     * Candidate alias members under executable target delimiter policy.
     */
    const candidateAliasMembers = contract.kind === 'alias'
      ? candidateText.split(contract.grammar
        .targetDelimiter,)
      : [];
    /**
     * Positional source-to-candidate evidence executing member-order policy.
     */
    const aliasMemberPairs = (contract.kind === 'alias')
      && (contract.grammar
        .memberOrder
        === 'source-exact')
      ? sourceAliasMembers.map(function pair(
        sourceMember,
        index,
      ): AliasMemberPair {
        return {
          index,
          sourceMember,
          candidateMember: candidateAliasMembers[index] ?? '',
          protectedCased: (contract.grammar
            .protectedCasedMember
            === 'exact-at-position')
            && hasCasedLetter(sourceMember,),
        };
      },)
      : [];
    return {
      ...subject,
      candidateText,
      candidateDigest: hashContent({ content: candidateText, }),
      sourceAliasMembers,
      candidateAliasMembers,
      aliasMemberPairs,
      protectedCasedMembers: aliasMemberPairs
        .filter(function protectedMember(pair,) { return pair.protectedCased; })
        .map(function source(pair,) { return pair.sourceMember; }),
    };
  },);
  return {
    sourceReviewPlan,
    sourceReviewPlanDigest: hashContent({ content: JSON.stringify(sourceReviewPlan,), }),
    admissionReviewPlanDigest: reviewPlan.reviewPlanDigest,
    candidateFrontMatterSubjects,
  };
}
