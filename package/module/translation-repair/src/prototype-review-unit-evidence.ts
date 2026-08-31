// PROTOTYPE ONLY: Candidate K located finding and overflow admission.

import { hashContent, } from './document-node.ts';
import { CONDITIONAL_DEFECT_CLASSES, } from './prototype-conditional-audit-model.ts';
import {
  REVIEW_UNIT_FINDING_CAP,
  type ReviewUnitCandidate,
  type ReviewUnitGuardFailure,
  type ReviewUnitFinding,
  type ReviewUnitResponse,
} from './prototype-review-unit-model.ts';
import {
  REALIZATION_GLOBAL_CRITERIA,
  type RealizationObligationLedger,
  type RealizationTargetAnchor,
} from './prototype-realization-model.ts';

/**
 * Deterministic semantic admission error carrying privacy-safe category.
 */
export class ReviewUnitAdmissionError extends Error {
  /**
   * Privacy-safe category persisted with spent node.
   */
  public readonly failureCategory: ReviewUnitGuardFailure;

  /**
   * Creates categorized semantic admission failure.
   */
  public constructor({
    failureCategory,
    message,
  }: {
    readonly failureCategory: ReviewUnitGuardFailure;
    readonly message: string;
  }) {
    super(message,);
    this.name = 'ReviewUnitAdmissionError';
    this.failureCategory = failureCategory;
  }
}

/**
 * Throws categorized semantic admission failure.
 */
function refuse({
  failureCategory,
  message,
}: {
  readonly failureCategory: ReviewUnitGuardFailure;
  readonly message: string;
}): never {
  throw new ReviewUnitAdmissionError({
    failureCategory,
    message,
  });
}

/**
 * Stable finding subject key independent of target evidence.
 *
 * @returns Scope and manifest index logical identity
 */
function findingKey({ finding, }: { readonly finding: ReviewUnitFinding; }): string {
  return `${finding.scope}\u0000${String(finding.manifestIndex,)}`;
}

/**
 * Collects indexed defect subjects from one compact status string.
 *
 * @returns Defect keys in manifest order
 */
function statusDefectKeys({
  statuses,
  scope,
}: {
  readonly statuses: string;
  readonly scope: ReviewUnitFinding['scope'];
}): readonly string[] {
  return (function collect(): readonly string[] {
    /**
     * Defect keys accumulated in status order.
     */
    const keys: string[] = [];
    /**
     * UTF-16 cursor is exact because status alphabet is ASCII.
     */
    let index = 0;
    while (index < statuses.length) {
      if (statuses[index] === 'd')
        keys.push(`${scope}\u0000${String(index,)}`,);
      index += 1;
    }
    return keys;
  })();
}

/**
 * Every explicit defect status as logical subject key.
 *
 * @returns Obligation then global defect subjects
 */
function defectKeys({
  response,
}: {
  readonly response: ReviewUnitResponse;
}): readonly string[] {
  return [
    ...statusDefectKeys({
      statuses: response.obligationStatuses,
      scope: 'o',
    },),
    ...statusDefectKeys({
      statuses: response.globalStatuses,
      scope: 'g',
    },),
  ];
}

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
  readonly allowedSlotKeys?: readonly string[];
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
    || ((allowedSlotKeys !== undefined) && (!allowedSlotKeys.includes(anchor.slotKey,)))
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
    refuse({
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
     * Prior anchor constraining this start.
     */
    const previous = ordered[index - 1];
    if ((previous !== undefined)
      && (previous.slotKey === anchor.slotKey)
      && (previous.endOffset > anchor.startOffset))
      refuse({
        failureCategory: 'anchor',
        message: 'review unit target anchors overlap',
      });
  },);
}

/**
 * Validates one finding against candidate and manifest subject.
 */
function assertFinding({
  finding,
  candidate,
  ledger,
}: {
  readonly finding: ReviewUnitFinding;
  readonly candidate: ReviewUnitCandidate;
  readonly ledger: RealizationObligationLedger;
}): void {
  /**
   * Canonical defect class selected by compact index.
   */
  const defectClass = CONDITIONAL_DEFECT_CLASSES[finding.defectClassIndex];
  if (defectClass === undefined)
    refuse({
      failureCategory: 'finding-shape',
      message: 'review unit defect class differs',
    });
  if ((finding.scope === 'g') && (defectClass === 'omission'))
    refuse({
      failureCategory: 'finding-shape',
      message: 'review unit global omission differs',
    });
  /**
   * Whether source-located omission intentionally carries no target anchor.
   */
  const omission = (finding.scope === 'o') && (defectClass === 'omission');
  if ((omission && (finding.targetAnchors
    .length
    > 0))
    || ((!omission) && (finding.targetAnchors
      .length
      === 0)))
    refuse({
      failureCategory: 'anchor',
      message: 'review unit omission evidence differs',
    });
  /**
   * Source obligation selected by manifest index.
   */
  const obligation = finding.scope === 'o'
    ? ledger.obligations[finding.manifestIndex]
    : undefined;
  if ((finding.scope === 'o') && (obligation === undefined))
    refuse({
      failureCategory: 'finding-shape',
      message: 'review unit obligation index differs',
    });
  if (omission && ((obligation?.sourceSpans
    .length
    ?? 0) === 0))
    refuse({
      failureCategory: 'anchor',
      message: 'review unit omission lacks source location',
    });
  if ((finding.scope === 'g')
    && (REALIZATION_GLOBAL_CRITERIA[finding.manifestIndex] === undefined))
    refuse({
      failureCategory: 'finding-shape',
      message: 'review unit global index differs',
    });
  finding.targetAnchors
    .forEach(function anchor(value,) {
    assertAnchor({
      anchor: value,
      candidate,
      ...(obligation === undefined ? {} : { allowedSlotKeys: obligation.allowedTargetSlotKeys, }),
    },);
  },);
  assertDisjointAnchors({ anchors: finding.targetAnchors, });
}

/**
 * Validates exact overflow and finding-to-defect algebra.
 *
 * @example
 * ```ts
 * assertReviewUnitEvidence({ response, candidate, ledger, });
 * ```
 */
export function assertReviewUnitEvidence({
  response,
  candidate,
  ledger,
}: {
  readonly response: ReviewUnitResponse;
  readonly candidate: ReviewUnitCandidate;
  readonly ledger: RealizationObligationLedger;
}): void {
  /**
   * Every explicit defect subject.
   */
  const defects = defectKeys({ response, });
  /**
   * Overflow derived exclusively from defect count and fixed cap.
   */
  const expectedOverflow = defects.length > REVIEW_UNIT_FINDING_CAP;
  /**
   * Finding logical subject keys.
   */
  const keys = response.findings
    .map(function key(finding,) { return findingKey({ finding, }); });
  if ((response.overflow !== expectedOverflow)
    || (new Set(keys,).size !== keys.length)
    || keys.some(function unrelated(key,) { return !defects.includes(key,); }))
    refuse({
      failureCategory: 'overflow',
      message: 'review unit overflow or subject differs',
    });
  if (expectedOverflow) {
    if (response.findings
      .length
      !== REVIEW_UNIT_FINDING_CAP)
      refuse({
        failureCategory: 'overflow',
        message: 'review unit overflow count differs',
      });
  }
  else if ((response.findings
    .length
    !== defects.length)
    || defects.some(function missing(key,) { return !keys.includes(key,); }))
    refuse({
      failureCategory: 'overflow',
      message: 'review unit finding coverage differs',
    });
  response.findings
    .forEach(function finding(value,) {
    assertFinding({
      finding: value,
      candidate,
      ledger,
    });
  },);
}
