// PROTOTYPE ONLY: Candidate K parsed response guard with privacy-safe category.

import { isJsonRecord, } from './json-guard.ts';
import { diagnoseReviewUnitFindings, } from './prototype-review-unit-guard-finding.ts';
import {
  REVIEW_UNIT_FINDING_CAP,
  type ReviewUnitCandidate,
  type ReviewUnitDiagnosis,
  type ReviewUnitResponse,
} from './prototype-review-unit-model.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';

/**
 * Whether object has exact keys regardless of member order.
 *
 * @returns Whether key sets match exactly
 */
function hasExactKeys({
  value,
  expected,
}: {
  readonly value: Readonly<Record<string, unknown>>;
  readonly expected: readonly string[];
}): boolean {
  return JSON.stringify(Object.keys(value,)
    .toSorted(),)
    === JSON.stringify([...expected,].toSorted(),);
}

/**
 * Whether every UTF-16 unit belongs to bounded ASCII alphabet.
 *
 * @returns Whether status alphabet is exact
 */
function statusAlphabetMatches({
  statuses,
  cleanCode,
}: {
  readonly statuses: string;
  readonly cleanCode: 'c' | 'p';
}): boolean {
  return (function scan(): boolean {
    /**
     * UTF-16 cursor is exact because allowed codes are ASCII.
     */
    let index = 0;
    while (index < statuses.length) {
      /**
       * Current compact status code.
       */
      const code = statuses[index];
      if ((code !== cleanCode) && (code !== 'd'))
        return false;
      index += 1;
    }
    return true;
  })();
}

/**
 * Whether nested clause strings exactly match plan grouping.
 *
 * @returns Whether outer and inner dimensions and alphabets match
 */
function clauseStatusesMatch({
  value,
  reviewPlan,
}: {
  readonly value: unknown;
  readonly reviewPlan: ReviewUnitPlan;
}): boolean {
  return Array.isArray(value,)
    && (value.length
      === reviewPlan.slotGroups
      .length)
    && value.every(function status(
      statuses,
      groupIndex,
    ) {
      /**
       * Plan group controlling current nested length.
       */
      const group = reviewPlan.slotGroups[groupIndex];
      return ((typeof statuses) === 'string')
        && (statuses.length
          === group?.clauseSubjectIndexes
          .length)
        && statusAlphabetMatches({
          statuses,
          cleanCode: 'p',
        });
    },);
}

/**
 * Classifies first deterministic parsed-response guard failure.
 *
 * @returns Accepted diagnosis or first privacy-safe category
 *
 * @example
 * ```ts
 * const diagnosis = diagnoseReviewUnitResponse({ value, reviewPlan, candidate, pictureCount: 1, });
 * ```
 */
export function diagnoseReviewUnitResponse({
  value,
  reviewPlan,
  candidate,
  pictureCount,
}: {
  readonly value: unknown;
  readonly reviewPlan: ReviewUnitPlan;
  readonly candidate: ReviewUnitCandidate;
  readonly pictureCount: number;
}): ReviewUnitDiagnosis {
  if ((!isJsonRecord(value,))
    || (!hasExactKeys({
      value,
      expected: [
        'candidateId',
        'candidateDigest',
        'reviewPlanDigest',
        'deterministicProofDigest',
        'frontMatterStatuses',
        'clauseStatusesBySlot',
        'relationStatuses',
        'slotLanguageStatuses',
        'globalStatuses',
        'overflow',
        'findings',
      ],
    },)))
    return {
      kind: 'rejected',
      failure: 'key-set',
    };
  if ((value.candidateId !== candidate.candidateId)
    || (value.candidateDigest !== candidate.candidateDigest)
    || (value.reviewPlanDigest !== reviewPlan.reviewPlanDigest)
    || (value.deterministicProofDigest !== candidate.deterministicProofDigest))
    return {
      kind: 'rejected',
      failure: 'candidate-binding',
    };
  if (((typeof value.frontMatterStatuses) !== 'string')
    || (value.frontMatterStatuses
      .length
      !== reviewPlan.frontMatterSubjects
      .length)
    || (!clauseStatusesMatch({
      value: value.clauseStatusesBySlot,
      reviewPlan,
    }))
    || ((typeof value.relationStatuses) !== 'string')
    || ((typeof value.slotLanguageStatuses) !== 'string')
    || ((typeof value.globalStatuses) !== 'string')
    || (value.relationStatuses
      .length
      !== reviewPlan.relations
      .length)
    || (value.slotLanguageStatuses
      .length
      !== reviewPlan.slotGroups
      .length)
    || (value.globalStatuses
      .length
      !== reviewPlan.globalCriteria
      .length))
    return {
      kind: 'rejected',
      failure: 'status-length',
    };
  if ((!statusAlphabetMatches({
    statuses: value.frontMatterStatuses,
    cleanCode: 'p',
  }))
    || (!statusAlphabetMatches({
      statuses: value.relationStatuses,
      cleanCode: 'p',
    }))
    || (!statusAlphabetMatches({
      statuses: value.slotLanguageStatuses,
      cleanCode: 'c',
    }))
    || (!statusAlphabetMatches({
      statuses: value.globalStatuses,
      cleanCode: 'c',
    })))
    return {
      kind: 'rejected',
      failure: 'status-alphabet',
    };
  if ((typeof value.overflow) !== 'boolean')
    return {
      kind: 'rejected',
      failure: 'overflow',
    };
  if ((!Array.isArray(value.findings,))
    || (value.findings
      .length
      > REVIEW_UNIT_FINDING_CAP))
    return {
      kind: 'rejected',
      failure: 'finding-shape',
    };
  /**
   * First finding failure or valid sentinel.
   */
  const findingResult = diagnoseReviewUnitFindings({
    findings: value.findings,
    reviewPlan,
    pictureCount,
  },);
  return (typeof findingResult) === 'symbol'
    ? { kind: 'accepted', }
    : {
      kind: 'rejected',
      failure: findingResult,
    };
}

/**
 * Builds type guard bound to exact candidate and review plan.
 *
 * @returns Candidate-bound parsed-response guard
 *
 * @example
 * ```ts
 * const guard = reviewUnitResponseGuard({ reviewPlan, candidate, pictureCount: 1, });
 * ```
 */
export function reviewUnitResponseGuard({
  reviewPlan,
  candidate,
  pictureCount,
}: {
  readonly reviewPlan: ReviewUnitPlan;
  readonly candidate: ReviewUnitCandidate;
  readonly pictureCount: number;
}): (value: unknown) => value is ReviewUnitResponse {
  return function isReviewUnitResponse(value: unknown,): value is ReviewUnitResponse {
    return diagnoseReviewUnitResponse({
      value,
      reviewPlan,
      candidate,
      pictureCount,
    },)
      .kind
      === 'accepted';
  };
}
