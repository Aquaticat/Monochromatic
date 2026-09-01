// PROTOTYPE ONLY: Candidate K untrusted finding shape guard.

import { isJsonRecord, } from './json-guard.ts';
import {
  REVIEW_UNIT_DEFECT_CLASSES,
  REVIEW_UNIT_MAX_TARGET_ANCHORS,
  type ReviewUnitFindingScope,
  type ReviewUnitGuardFailure,
} from './prototype-review-unit-model.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';

/**
 * Sentinel for finding passing structural guard.
 */
const FINDING_VALID: unique symbol = Symbol('review unit finding valid',);

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
 * Whether parsed target anchor has exact primitive shape.
 *
 * @param value - untrusted target anchor
 *
 * @returns Whether exact primitives are present
 */
function isTargetAnchor(value: unknown,): boolean {
  return isJsonRecord(value,)
    && hasExactKeys({
      value,
      expected: [
        'slotKey',
        'startOffset',
        'endOffset',
        'digest',
      ],
    },)
    && ((typeof value.slotKey) === 'string')
    && Number.isInteger(value.startOffset,)
    && Number.isInteger(value.endOffset,)
    && ((typeof value.digest) === 'string');
}

/**
 * Whether value is array of integer positions inside exclusive limit.
 *
 * @returns Whether every position satisfies bound
 */
function isIndexArray({
  value,
  limit,
  maxItems,
}: {
  readonly value: unknown;
  readonly limit: number;
  readonly maxItems: number;
}): boolean {
  return Array.isArray(value,)
    && (value.length <= maxItems)
    && value.every(function bounded(item,) {
      return Number.isInteger(item,) && (item >= 0)
        && (item < limit);
    },);
}

/**
 * Exclusive subject bound for one finding scope.
 *
 * @returns Subject count for scope
 */
function subjectCount({
  scope,
  reviewPlan,
  languageSubjectCount,
}: {
  readonly scope: ReviewUnitFindingScope;
  readonly reviewPlan: ReviewUnitPlan;
  readonly languageSubjectCount: number;
}): number {
  if (scope === 'fm')
    return reviewPlan.frontMatterSubjects
      .length;
  if (scope === 'c')
    return reviewPlan.clauses
      .length;
  if (scope === 'r')
    return reviewPlan.relations
      .length;
  if (scope === 'sl')
    return languageSubjectCount;
  return reviewPlan.globalCriteria
    .length;
}

/**
 * Privacy-safe category for one finding shape failure.
 *
 * @returns First category or valid sentinel
 */
function findingFailure({
  value,
  reviewPlan,
  pictureCount,
  languageSubjectCount,
}: {
  readonly value: unknown;
  readonly reviewPlan: ReviewUnitPlan;
  readonly pictureCount: number;
  readonly languageSubjectCount: number;
}): ReviewUnitGuardFailure | typeof FINDING_VALID {
  if ((!isJsonRecord(value,))
    || (!hasExactKeys({
      value,
      expected: [
        'scope',
        'subjectIndex',
        'defectClassIndex',
        'sourceEvidenceIndexes',
        'imageEvidenceIndexes',
        'targetAnchors',
      ],
    },))
    || ((value.scope !== 'fm')
      && (value.scope !== 'c')
      && (value.scope !== 'r')
      && (value.scope !== 'sl')
      && (value.scope !== 'g'))
    || ((typeof value.subjectIndex) !== 'number')
    || (!Number.isInteger(value.subjectIndex,))
    || ((typeof value.defectClassIndex) !== 'number')
    || (!Number.isInteger(value.defectClassIndex,))
    || (!isIndexArray({
      value: value.sourceEvidenceIndexes,
      limit: reviewPlan.sourceEvidence
        .length,
      maxItems: REVIEW_UNIT_MAX_TARGET_ANCHORS,
    },))
    || (!isIndexArray({
      value: value.imageEvidenceIndexes,
      limit: pictureCount,
      maxItems: pictureCount,
    },))
    || (!Array.isArray(value.targetAnchors,)))
    return 'finding-shape';
  if ((value.subjectIndex < 0)
    || (value.subjectIndex >= subjectCount({
      scope: value.scope,
      reviewPlan,
      languageSubjectCount,
    }))
    || (value.defectClassIndex < 0)
    || (value.defectClassIndex >= REVIEW_UNIT_DEFECT_CLASSES.length)
    || (value.targetAnchors
      .length
      > REVIEW_UNIT_MAX_TARGET_ANCHORS))
    return 'finding-shape';
  return value.targetAnchors
    .every(isTargetAnchor,) ? FINDING_VALID : 'anchor';
}

/**
 * Returns first structural finding failure or accepted sentinel.
 *
 * @returns First category or valid sentinel
 *
 * @example
 * ```ts
 * const result = diagnoseReviewUnitFindings({ findings, reviewPlan, pictureCount: 1, });
 * ```
 */
export function diagnoseReviewUnitFindings({
  findings,
  reviewPlan,
  pictureCount,
  languageSubjectCount,
}: {
  readonly findings: readonly unknown[];
  readonly reviewPlan: ReviewUnitPlan;
  readonly pictureCount: number;
  readonly languageSubjectCount: number;
}): ReviewUnitGuardFailure | typeof FINDING_VALID {
  return findings.reduce<ReviewUnitGuardFailure | typeof FINDING_VALID>(
    function firstFailure(
      found,
      finding,
    ) {
      return (typeof found) === 'symbol'
        ? findingFailure({
          value: finding,
          reviewPlan,
          pictureCount,
          languageSubjectCount,
        })
        : found;
    },
    FINDING_VALID,
  );
}
