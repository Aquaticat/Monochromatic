// PROTOTYPE ONLY: Candidate K canonical defect-subject admission.

import { refuseReviewUnit, } from './prototype-review-unit-admission-error.ts';
import { assertReviewUnitFinding, } from './prototype-review-unit-evidence-location.ts';
import {
  REVIEW_UNIT_FINDING_CAP,
  type ReviewUnitCandidate,
  type ReviewUnitFinding,
  type ReviewUnitFindingScope,
  type ReviewUnitResponse,
} from './prototype-review-unit-model.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';

export { ReviewUnitAdmissionError, } from './prototype-review-unit-admission-error.ts';

/**
 * Stable finding subject key independent of target evidence.
 *
 * @returns Scope and subject identity
 */
function findingKey({ finding, }: { readonly finding: ReviewUnitFinding; }): string {
  return `${finding.scope}\u0000${String(finding.subjectIndex,)}`;
}

/**
 * Collects indexed defect subjects from one compact status string.
 *
 * @returns Defect keys in supplied subject order
 */
function statusDefectKeys({
  statuses,
  scope,
  subjectIndexes,
}: {
  readonly statuses: string;
  readonly scope: ReviewUnitFindingScope;
  readonly subjectIndexes: readonly number[];
}): readonly string[] {
  return subjectIndexes.flatMap(function defect(
    subjectIndex,
    position,
  ) {
    return statuses[position] === 'd'
      ? [`${scope}\u0000${String(subjectIndex,)}`,]
      : [];
  },);
}

/**
 * Every explicit defect subject in canonical plan order.
 *
 * @returns Front matter, clause, relation, language, then global defects
 */
function defectKeys({
  response,
  reviewPlan,
}: {
  readonly response: ReviewUnitResponse;
  readonly reviewPlan: ReviewUnitPlan;
}): readonly string[] {
  /**
   * Front-matter defects in semantic field order.
   */
  const frontMatter = statusDefectKeys({
    statuses: response.frontMatterStatuses,
    scope: 'fm',
    subjectIndexes: reviewPlan.frontMatterSubjects
      .map(function index(value,) { return value.subjectIndex; }),
  },);
  /**
   * Clause defects flattened by slot-group and member order.
   */
  const clauses = reviewPlan.slotGroups
    .flatMap(function group(
      value,
      groupIndex,
    ) {
      return statusDefectKeys({
        statuses: response.clauseStatusesBySlot[groupIndex] ?? '',
        scope: 'c',
        subjectIndexes: value.clauseSubjectIndexes,
      });
    },);
  return [
    ...frontMatter,
    ...clauses,
    ...statusDefectKeys({
      statuses: response.relationStatuses,
      scope: 'r',
      subjectIndexes: reviewPlan.relations
        .map(function index(value,) { return value.subjectIndex; }),
    }),
    ...statusDefectKeys({
      statuses: response.slotLanguageStatuses,
      scope: 'sl',
      subjectIndexes: reviewPlan.slotGroups
        .map(function index(value,) { return value.groupIndex; }),
    }),
    ...statusDefectKeys({
      statuses: response.globalStatuses,
      scope: 'g',
      subjectIndexes: reviewPlan.globalCriteria
        .map(function index(
          _value,
          position,
        ) { return position; }),
    }),
  ];
}

/**
 * Validates exact canonical overflow and finding-to-subject algebra.
 *
 * @example
 * ```ts
 * assertReviewUnitEvidence({ response, candidate, reviewPlan, pictureCount: 1, });
 * ```
 */
export function assertReviewUnitEvidence({
  response,
  candidate,
  reviewPlan,
  pictureCount,
}: {
  readonly response: ReviewUnitResponse;
  readonly candidate: ReviewUnitCandidate;
  readonly reviewPlan: ReviewUnitPlan;
  readonly pictureCount: number;
}): void {
  /**
   * Every explicit defect subject in canonical order.
   */
  const defects = defectKeys({
    response,
    reviewPlan,
  });
  /**
   * Canonical retained defect prefix.
   */
  const retained = defects.slice(
    0,
    REVIEW_UNIT_FINDING_CAP,
  );
  /**
   * Finding logical subject keys in response order.
   */
  const keys = response.findings
    .map(function key(finding,) { return findingKey({ finding, }); });
  if ((response.overflow !== (defects.length > REVIEW_UNIT_FINDING_CAP))
    || (JSON.stringify(keys,) !== JSON.stringify(retained,)))
    refuseReviewUnit({
      failureCategory: 'overflow',
      message: 'review unit overflow or canonical subjects differ',
    });
  response.findings
    .forEach(function finding(value,) {
    assertReviewUnitFinding({
      finding: value,
      candidate,
      reviewPlan,
      pictureCount,
    });
  },);
}
