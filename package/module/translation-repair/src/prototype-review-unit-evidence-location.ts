// PROTOTYPE ONLY: Candidate K finding source, image, and target evidence.

import { hashContent, } from './document-node.ts';
import { refuseReviewUnit, } from './prototype-review-unit-admission-error.ts';
import {
  REVIEW_UNIT_DEFECT_CLASSES,
  type ReviewUnitCandidate,
  type ReviewUnitFinding,
} from './prototype-review-unit-model.ts';
import {
  REVIEW_UNIT_GLOBAL_IMAGE_INDEX,
  type ReviewUnitPlan,
} from './prototype-review-unit-plan.ts';
import { reviewUnitFindingTargetSlots, } from './prototype-review-unit-evidence-target.ts';
import {
  assertReviewUnitRuleCardinality,
  reviewUnitAllowedDefectClassIndexes,
  reviewUnitFindingRule,
} from './prototype-review-unit-rules.ts';
import type { RealizationTargetAnchor, } from './prototype-realization-model.ts';

/**
 * Refuses stale or out-of-scope UTF-16 target location.
 */
function assertAnchor({
  anchor,
  candidate,
  allowedSlotKeys,
}: {
  readonly anchor: RealizationTargetAnchor;
  readonly candidate: ReviewUnitCandidate;
  readonly allowedSlotKeys: readonly string[];
}): void {
  /**
   * Candidate slot cited by target anchor.
   */
  const text = candidate.slots[anchor.slotKey];
  /**
   * Half-open anchor width.
   */
  const length = anchor.endOffset - anchor.startOffset;
  if ((text === undefined)
    || (!allowedSlotKeys.includes(anchor.slotKey,))
    || (!Number.isInteger(anchor.startOffset,))
    || (!Number.isInteger(anchor.endOffset,))
    || (anchor.startOffset < 0)
    || (length <= 0)
    || (anchor.endOffset > text.length)
    || (anchor.digest !== hashContent({
      content: text.slice(
        anchor.startOffset,
        anchor.endOffset,
      ),
    },)))
    refuseReviewUnit({
      failureCategory: 'anchor',
      message: 'review unit target anchor differs',
    });
}

/**
 * Refuses repeated or overlapping anchors inside one finding.
 */
function assertDisjointAnchors({
  anchors,
}: {
  readonly anchors: readonly RealizationTargetAnchor[];
}): void {
  /**
   * Anchors ordered by slot and offsets.
   */
  const ordered = anchors.toSorted(function location(
    left,
    right,
  ) {
    return left.slotKey
      .localeCompare(right.slotKey,)
      || (left.startOffset - right.startOffset)
      || (left.endOffset - right.endOffset);
  },);
  ordered.forEach(function overlap(
    anchor,
    index,
  ) {
    /**
     * Prior anchor constraining current start.
     */
    const previous = ordered[index - 1];
    if ((previous !== undefined)
      && (previous.slotKey === anchor.slotKey)
      && (previous.endOffset > anchor.startOffset))
      refuseReviewUnit({
        failureCategory: 'anchor',
        message: 'review unit target anchors overlap',
      });
  },);
}

/**
 * Refuses duplicate evidence positions.
 */
function assertUniqueIndexes({
  values,
}: {
  readonly values: readonly number[];
}): void {
  if (new Set(values,).size !== values.length)
    refuseReviewUnit({
      failureCategory: 'finding-shape',
      message: 'review unit evidence indexes repeat',
    });
}

/**
 * Refuses evidence list not exactly expected list.
 */
function assertExactIndexes({
  actual,
  expected,
}: {
  readonly actual: readonly number[];
  readonly expected: readonly number[];
}): void {
  if (JSON.stringify(actual,) !== JSON.stringify(expected,))
    refuseReviewUnit({
      failureCategory: 'finding-shape',
      message: 'review unit source evidence differs',
    });
}

/**
 * Refuses source or image evidence indexes outside exact catalogs.
 */
function assertEvidenceIndexes({
  finding,
  reviewPlan,
  pictureCount,
}: {
  readonly finding: ReviewUnitFinding;
  readonly reviewPlan: ReviewUnitPlan;
  readonly pictureCount: number;
}): void {
  assertUniqueIndexes({ values: finding.sourceEvidenceIndexes, });
  assertUniqueIndexes({ values: finding.imageEvidenceIndexes, });
  if (finding.sourceEvidenceIndexes
    .some(function out(index,) {
    return reviewPlan.sourceEvidence[index] === undefined;
  },)
    || finding.imageEvidenceIndexes
    .some(function out(index,) {
    return (index < 0) || (index >= pictureCount);
  },))
    refuseReviewUnit({
      failureCategory: 'finding-shape',
      message: 'review unit evidence index differs',
    });
}

/**
 * Refuses scope-dependent finding evidence or anchor cardinality.
 */
function assertScopeEvidence({
  finding,
  reviewPlan,
  defectClass,
}: {
  readonly finding: ReviewUnitFinding;
  readonly reviewPlan: ReviewUnitPlan;
  readonly defectClass: typeof REVIEW_UNIT_DEFECT_CLASSES[number];
}): void {
  if (finding.scope === 'fm') {
    if ((reviewPlan.frontMatterSubjects[finding.subjectIndex] === undefined)
      || (finding.sourceEvidenceIndexes
        .length
        > 0)
      || (finding.imageEvidenceIndexes
        .length
        > 0)
      || ((defectClass === 'omission') && (finding.targetAnchors
        .length
        > 0))
      || ((defectClass !== 'omission') && (finding.targetAnchors
        .length
        === 0)))
      refuseReviewUnit({
        failureCategory: 'anchor',
        message: 'review unit front matter evidence differs',
      });
    return;
  }
  if (finding.scope === 'c') {
    /**
     * Clause subject selected by finding.
     */
    const clause = reviewPlan.clauses[finding.subjectIndex];
    if (clause === undefined)
      refuseReviewUnit({
        failureCategory: 'finding-shape',
        message: 'review unit clause index differs',
      });
    assertExactIndexes({
      actual: finding.sourceEvidenceIndexes,
      expected: clause.sourceEvidenceIndexes,
    });
    if ((finding.imageEvidenceIndexes
      .length
      > 0)
      || ((defectClass === 'omission') && (finding.targetAnchors
        .length
        > 0))
      || ((defectClass !== 'omission') && (finding.targetAnchors
        .length
        === 0)))
      refuseReviewUnit({
        failureCategory: 'anchor',
        message: 'review unit clause evidence differs',
      });
    return;
  }
  if (finding.scope === 'r') {
    /**
     * Relation subject selected by finding.
     */
    const relation = reviewPlan.relations[finding.subjectIndex];
    if (relation === undefined)
      refuseReviewUnit({
        failureCategory: 'finding-shape',
        message: 'review unit relation index differs',
      });
    assertExactIndexes({
      actual: finding.sourceEvidenceIndexes,
      expected: relation.sourceEvidenceIndexes,
    });
    if ((finding.imageEvidenceIndexes
      .length
      > 0) || (finding.targetAnchors
        .length
        === 0))
      refuseReviewUnit({
        failureCategory: 'finding-shape',
        message: 'review unit relation evidence differs',
      });
    return;
  }
  if (finding.scope === 'sl') {
    if ((finding.sourceEvidenceIndexes
      .length
      > 0)
      || (finding.imageEvidenceIndexes
        .length
        > 0)
      || (finding.targetAnchors
        .length
        === 0))
      refuseReviewUnit({
        failureCategory: 'finding-shape',
        message: 'review unit language evidence differs',
      });
    return;
  }
  /**
   * Whether global subject is exact source-image-target relation.
   */
  const visual = finding.subjectIndex === REVIEW_UNIT_GLOBAL_IMAGE_INDEX;
  if ((finding.targetAnchors
    .length
    === 0)
    || (visual && ((defectClass !== 'image-relation') || (finding.imageEvidenceIndexes
      .length
      === 0)))
    || ((!visual) && ((defectClass === 'image-relation') || (finding.imageEvidenceIndexes
      .length
      > 0))))
    refuseReviewUnit({
      failureCategory: 'finding-shape',
      message: 'review unit global evidence differs',
    });
}

/**
 * Validates one finding against exact scope rule and evidence catalogs.
 *
 * @example
 * ```ts
 * assertReviewUnitFinding({ finding, candidate, reviewPlan, pictureCount: 1, });
 * ```
 */
export function assertReviewUnitFinding({
  finding,
  candidate,
  reviewPlan,
  pictureCount,
}: {
  readonly finding: ReviewUnitFinding;
  readonly candidate: ReviewUnitCandidate;
  readonly reviewPlan: ReviewUnitPlan;
  readonly pictureCount: number;
}): void {
  /**
   * Canonical defect class selected by compact index.
   */
  const defectClass = REVIEW_UNIT_DEFECT_CLASSES[finding.defectClassIndex];
  /**
   * Digest-bound model-facing rule for current scope.
   */
  const rule = reviewUnitFindingRule({ scope: finding.scope, });
  /**
   * Subject-specific or scope-default defect classes.
   */
  const allowedDefectClassIndexes = reviewUnitAllowedDefectClassIndexes({
    rule,
    subjectIndex: finding.subjectIndex,
  },);
  if ((defectClass === undefined)
    || (!allowedDefectClassIndexes.includes(finding.defectClassIndex,)))
    refuseReviewUnit({
      failureCategory: 'finding-shape',
      message: 'review unit defect class differs',
    });
  assertEvidenceIndexes({
    finding,
    reviewPlan,
    pictureCount,
  });
  assertReviewUnitRuleCardinality({
    finding,
    defectClass,
    rule,
  });
  assertScopeEvidence({
    finding,
    reviewPlan,
    defectClass,
  });
  /**
   * Authorized candidate slots for target evidence.
   */
  const allowedSlotKeys = reviewUnitFindingTargetSlots({
    finding,
    reviewPlan,
    candidate,
  });
  finding.targetAnchors
    .forEach(function anchor(value,) {
    assertAnchor({
      anchor: value,
      candidate,
      allowedSlotKeys,
    });
  },);
  assertDisjointAnchors({ anchors: finding.targetAnchors, });
}
