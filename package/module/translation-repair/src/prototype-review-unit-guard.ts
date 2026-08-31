// PROTOTYPE ONLY: Candidate K parsed response guard with privacy-safe category.

import { isJsonRecord, } from './json-guard.ts';
import {
  REVIEW_UNIT_DEFECT_CLASSES,
  REVIEW_UNIT_FINDING_CAP,
  type ReviewUnitCandidate,
  type ReviewUnitDiagnosis,
  type ReviewUnitFindingScope,
  type ReviewUnitGuardFailure,
  type ReviewUnitResponse,
} from './prototype-review-unit-model.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';

/** Sentinel for finding passing structural guard. */
const FINDING_VALID: unique symbol = Symbol('review unit finding valid',);

/** Whether object has exact keys regardless of member order. */
function hasExactKeys({
  value,
  expected,
}: {
  readonly value: Readonly<Record<string, unknown>>;
  readonly expected: readonly string[];
}): boolean {
  return JSON.stringify(Object.keys(value,).toSorted(),)
    === JSON.stringify([...expected,].toSorted(),);
}

/** Whether parsed target anchor has exact primitive shape. */
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

/** Whether value is array of integer positions inside exclusive limit. */
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
      return Number.isInteger(item,) && (item >= 0) && (item < limit);
    },);
}

/** Exclusive subject bound for one finding scope. */
function subjectCount({
  scope,
  reviewPlan,
}: {
  readonly scope: ReviewUnitFindingScope;
  readonly reviewPlan: ReviewUnitPlan;
}): number {
  if (scope === 'fm')
    return reviewPlan.frontMatterSubjects.length;
  if (scope === 'c')
    return reviewPlan.clauses.length;
  if (scope === 'r')
    return reviewPlan.relations.length;
  if (scope === 'sl')
    return reviewPlan.slotGroups.length;
  return reviewPlan.globalCriteria.length;
}

/** Privacy-safe category for one finding shape failure. */
function findingFailure({
  value,
  reviewPlan,
  pictureCount,
}: {
  readonly value: unknown;
  readonly reviewPlan: ReviewUnitPlan;
  readonly pictureCount: number;
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
      limit: reviewPlan.sourceEvidence.length,
      maxItems: 4,
    },))
    || (!isIndexArray({
      value: value.imageEvidenceIndexes,
      limit: pictureCount,
      maxItems: pictureCount,
    },))
    || (!Array.isArray(value.targetAnchors,)))
    return 'finding-shape';
  if ((value.subjectIndex < 0)
    || (value.subjectIndex >= subjectCount({ scope: value.scope, reviewPlan, }))
    || (value.defectClassIndex < 0)
    || (value.defectClassIndex >= REVIEW_UNIT_DEFECT_CLASSES.length)
    || (value.targetAnchors.length > 4))
    return 'finding-shape';
  return value.targetAnchors.every(isTargetAnchor,) ? FINDING_VALID : 'anchor';
}

/** Whether every UTF-16 unit belongs to bounded ASCII alphabet. */
function statusAlphabetMatches({
  statuses,
  cleanCode,
}: {
  readonly statuses: string;
  readonly cleanCode: 'c' | 'p';
}): boolean {
  /** UTF-16 cursor is exact because allowed codes are ASCII. */
  let index = 0;
  while (index < statuses.length) {
    /** Current compact status code. */
    const code = statuses[index];
    if ((code !== cleanCode) && (code !== 'd'))
      return false;
    index += 1;
  }
  return true;
}

/** Whether nested clause strings exactly match plan grouping. */
function clauseStatusesMatch({
  value,
  reviewPlan,
}: {
  readonly value: unknown;
  readonly reviewPlan: ReviewUnitPlan;
}): boolean {
  return Array.isArray(value,)
    && (value.length === reviewPlan.slotGroups.length)
    && value.every(function status(statuses, groupIndex,) {
      const group = reviewPlan.slotGroups[groupIndex];
      return (typeof statuses === 'string')
        && (statuses.length === group?.clauseSubjectIndexes.length)
        && statusAlphabetMatches({ statuses, cleanCode: 'p', });
    },);
}

/** Classifies first deterministic parsed-response guard failure. */
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
    return { kind: 'rejected', failure: 'key-set', };
  if ((value.candidateId !== candidate.candidateId)
    || (value.candidateDigest !== candidate.candidateDigest)
    || (value.reviewPlanDigest !== reviewPlan.reviewPlanDigest)
    || (value.deterministicProofDigest !== candidate.deterministicProofDigest))
    return { kind: 'rejected', failure: 'candidate-binding', };
  if (((typeof value.frontMatterStatuses) !== 'string')
    || (value.frontMatterStatuses.length !== reviewPlan.frontMatterSubjects.length)
    || (!clauseStatusesMatch({ value: value.clauseStatusesBySlot, reviewPlan, }))
    || ((typeof value.relationStatuses) !== 'string')
    || ((typeof value.slotLanguageStatuses) !== 'string')
    || ((typeof value.globalStatuses) !== 'string')
    || (value.relationStatuses.length !== reviewPlan.relations.length)
    || (value.slotLanguageStatuses.length !== reviewPlan.slotGroups.length)
    || (value.globalStatuses.length !== reviewPlan.globalCriteria.length))
    return { kind: 'rejected', failure: 'status-length', };
  if ((!statusAlphabetMatches({ statuses: value.frontMatterStatuses, cleanCode: 'p', }))
    || (!statusAlphabetMatches({ statuses: value.relationStatuses, cleanCode: 'p', }))
    || (!statusAlphabetMatches({ statuses: value.slotLanguageStatuses, cleanCode: 'c', }))
    || (!statusAlphabetMatches({ statuses: value.globalStatuses, cleanCode: 'c', })))
    return { kind: 'rejected', failure: 'status-alphabet', };
  if ((typeof value.overflow) !== 'boolean')
    return { kind: 'rejected', failure: 'overflow', };
  if ((!Array.isArray(value.findings,))
    || (value.findings.length > REVIEW_UNIT_FINDING_CAP))
    return { kind: 'rejected', failure: 'finding-shape', };
  /** First finding failure or valid sentinel. */
  const findingResult = value.findings.reduce<ReviewUnitGuardFailure | typeof FINDING_VALID>(
    function firstFailure(found, finding,) {
      return (typeof found) === 'symbol'
        ? findingFailure({ value: finding, reviewPlan, pictureCount, })
        : found;
    },
    FINDING_VALID,
  );
  return (typeof findingResult) === 'symbol'
    ? { kind: 'accepted', }
    : { kind: 'rejected', failure: findingResult, };
}

/** Builds type guard bound to exact candidate and review plan. */
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
    return diagnoseReviewUnitResponse({ value, reviewPlan, candidate, pictureCount, }).kind === 'accepted';
  };
}
