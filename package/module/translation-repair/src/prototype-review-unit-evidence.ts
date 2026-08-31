// PROTOTYPE ONLY: Candidate K located finding and canonical overflow admission.

import { hashContent, } from './document-node.ts';
import {
  REVIEW_UNIT_DEFECT_CLASSES,
  REVIEW_UNIT_FINDING_CAP,
  type ReviewUnitCandidate,
  type ReviewUnitDefectClass,
  type ReviewUnitFinding,
  type ReviewUnitFindingScope,
  type ReviewUnitGuardFailure,
  type ReviewUnitResponse,
} from './prototype-review-unit-model.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import type { RealizationTargetAnchor, } from './prototype-realization-model.ts';

/** Closed allowed defect classes per review scope. */
const DEFECT_CLASSES_BY_SCOPE: Readonly<Record<ReviewUnitFindingScope, ReadonlySet<ReviewUnitDefectClass>>> = {
  fm: new Set([
    'wrong-meaning',
    'omission',
    'unsupported-addition',
    'identity-attribution',
    'actor-reference',
    'technical-legal-term',
    'grammar-usage',
    'source-language-calque',
  ]),
  c: new Set(REVIEW_UNIT_DEFECT_CLASSES.filter(function clause(value,) {
    return (value !== 'paragraph-relation') && (value !== 'image-relation');
  },)),
  r: new Set([
    'wrong-meaning',
    'actor-reference',
    'chronology',
    'technical-legal-term',
    'paragraph-relation',
  ]),
  sl: new Set([
    'actor-reference',
    'technical-legal-term',
    'grammar-usage',
    'tense',
    'register',
    'source-language-calque',
  ]),
  g: new Set(REVIEW_UNIT_DEFECT_CLASSES.filter(function global(value,) {
    return value !== 'omission';
  },)),
};

/** Deterministic semantic admission error carrying privacy-safe category. */
export class ReviewUnitAdmissionError extends Error {
  /** Privacy-safe category persisted with spent node. */
  public readonly failureCategory: ReviewUnitGuardFailure;

  /** Creates categorized semantic admission failure. */
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

/** Throws categorized semantic admission failure. */
function refuse({
  failureCategory,
  message,
}: {
  readonly failureCategory: ReviewUnitGuardFailure;
  readonly message: string;
}): never {
  throw new ReviewUnitAdmissionError({ failureCategory, message, });
}

/** Stable finding subject key independent of target evidence. */
function findingKey({ finding, }: { readonly finding: ReviewUnitFinding; }): string {
  return `${finding.scope}\u0000${String(finding.subjectIndex,)}`;
}

/** Collects indexed defect subjects from one compact status string. */
function statusDefectKeys({
  statuses,
  scope,
  subjectIndexes,
}: {
  readonly statuses: string;
  readonly scope: ReviewUnitFindingScope;
  readonly subjectIndexes: readonly number[];
}): readonly string[] {
  return subjectIndexes.flatMap(function defect(subjectIndex, position,) {
    return statuses[position] === 'd' ? [`${scope}\u0000${String(subjectIndex,)}`,] : [];
  },);
}

/** Every explicit defect subject in canonical plan order. */
function defectKeys({
  response,
  reviewPlan,
}: {
  readonly response: ReviewUnitResponse;
  readonly reviewPlan: ReviewUnitPlan;
}): readonly string[] {
  /** Front-matter defects in semantic field order. */
  const frontMatter = statusDefectKeys({
    statuses: response.frontMatterStatuses,
    scope: 'fm',
    subjectIndexes: reviewPlan.frontMatterSubjects.map(function index(value,) { return value.subjectIndex; }),
  });
  /** Clause defects flattened by slot-group and member order. */
  const clauses = reviewPlan.slotGroups.flatMap(function group(value, groupIndex,) {
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
      subjectIndexes: reviewPlan.relations.map(function index(value,) { return value.subjectIndex; }),
    }),
    ...statusDefectKeys({
      statuses: response.slotLanguageStatuses,
      scope: 'sl',
      subjectIndexes: reviewPlan.slotGroups.map(function index(value,) { return value.groupIndex; }),
    }),
    ...statusDefectKeys({
      statuses: response.globalStatuses,
      scope: 'g',
      subjectIndexes: reviewPlan.globalCriteria.map(function index(_value, position,) { return position; }),
    }),
  ];
}

/** Refuses stale or out-of-scope UTF-16 target location. */
function assertAnchor({
  anchor,
  candidate,
  allowedSlotKeys,
}: {
  readonly anchor: RealizationTargetAnchor;
  readonly candidate: ReviewUnitCandidate;
  readonly allowedSlotKeys: readonly string[];
}): void {
  /** Candidate slot cited by target anchor. */
  const text = candidate.slots[anchor.slotKey];
  /** Half-open anchor width. */
  const length = anchor.endOffset - anchor.startOffset;
  if ((text === undefined)
    || (!allowedSlotKeys.includes(anchor.slotKey,))
    || (!Number.isInteger(anchor.startOffset,))
    || (!Number.isInteger(anchor.endOffset,))
    || (anchor.startOffset < 0)
    || (length <= 0)
    || (anchor.endOffset > text.length)
    || (anchor.digest !== hashContent({
      content: text.slice(anchor.startOffset, anchor.endOffset,),
    },)))
    refuse({ failureCategory: 'anchor', message: 'review unit target anchor differs', });
}

/** Refuses repeated or overlapping anchors inside one finding. */
function assertDisjointAnchors({
  anchors,
}: {
  readonly anchors: readonly RealizationTargetAnchor[];
}): void {
  /** Anchors ordered by slot and offsets. */
  const ordered = anchors.toSorted(function location(left, right,) {
    return left.slotKey.localeCompare(right.slotKey,)
      || (left.startOffset - right.startOffset)
      || (left.endOffset - right.endOffset);
  },);
  ordered.forEach(function overlap(anchor, index,) {
    /** Prior anchor constraining current start. */
    const previous = ordered[index - 1];
    if ((previous !== undefined)
      && (previous.slotKey === anchor.slotKey)
      && (previous.endOffset > anchor.startOffset))
      refuse({ failureCategory: 'anchor', message: 'review unit target anchors overlap', });
  },);
}

/** Refuses duplicate evidence positions. */
function assertUniqueIndexes({
  values,
}: {
  readonly values: readonly number[];
}): void {
  if (new Set(values,).size !== values.length)
    refuse({ failureCategory: 'finding-shape', message: 'review unit evidence indexes repeat', });
}

/** Refuses evidence list not exactly expected list. */
function assertExactIndexes({
  actual,
  expected,
}: {
  readonly actual: readonly number[];
  readonly expected: readonly number[];
}): void {
  if (JSON.stringify(actual,) !== JSON.stringify(expected,))
    refuse({ failureCategory: 'finding-shape', message: 'review unit source evidence differs', });
}

/** Allowed target slots for one finding subject. */
function targetSlots({
  finding,
  reviewPlan,
  candidate,
}: {
  readonly finding: ReviewUnitFinding;
  readonly reviewPlan: ReviewUnitPlan;
  readonly candidate: ReviewUnitCandidate;
}): readonly string[] {
  if (finding.scope === 'fm') {
    const targetSlotKey = reviewPlan.frontMatterSubjects[finding.subjectIndex]?.targetSlotKey;
    return targetSlotKey === undefined ? [] : [targetSlotKey,];
  }
  if (finding.scope === 'c')
    return reviewPlan.clauses[finding.subjectIndex]?.allowedTargetSlotKeys ?? [];
  if (finding.scope === 'r')
    return reviewPlan.relations[finding.subjectIndex]?.allowedTargetSlotKeys ?? [];
  if (finding.scope === 'sl') {
    const slotKey = reviewPlan.slotGroups[finding.subjectIndex]?.slotKey;
    return slotKey === undefined ? [] : [slotKey,];
  }
  return Object.keys(candidate.slots,);
}

/** Validates scope-dependent finding evidence and anchor cardinality. */
function assertFinding({
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
  /** Canonical defect class selected by compact index. */
  const defectClass = REVIEW_UNIT_DEFECT_CLASSES[finding.defectClassIndex];
  if ((defectClass === undefined)
    || (!DEFECT_CLASSES_BY_SCOPE[finding.scope].has(defectClass,)))
    refuse({ failureCategory: 'finding-shape', message: 'review unit defect class differs', });
  assertUniqueIndexes({ values: finding.sourceEvidenceIndexes, });
  assertUniqueIndexes({ values: finding.imageEvidenceIndexes, });
  if (finding.sourceEvidenceIndexes.some(function out(index,) {
    return reviewPlan.sourceEvidence[index] === undefined;
  },) || finding.imageEvidenceIndexes.some(function out(index,) {
    return (index < 0) || (index >= pictureCount);
  },))
    refuse({ failureCategory: 'finding-shape', message: 'review unit evidence index differs', });
  if (finding.scope === 'fm') {
    /** Front-matter semantic subject selected by finding. */
    const subject = reviewPlan.frontMatterSubjects[finding.subjectIndex];
    if (subject === undefined)
      refuse({ failureCategory: 'finding-shape', message: 'review unit front matter index differs', });
    if ((finding.sourceEvidenceIndexes.length !== 0)
      || (finding.imageEvidenceIndexes.length !== 0)
      || ((defectClass === 'omission') && (finding.targetAnchors.length !== 0))
      || ((defectClass !== 'omission') && (finding.targetAnchors.length === 0)))
      refuse({ failureCategory: 'anchor', message: 'review unit front matter evidence differs', });
  }
  else if (finding.scope === 'c') {
    /** Clause subject selected by finding. */
    const clause = reviewPlan.clauses[finding.subjectIndex];
    if (clause === undefined)
      refuse({ failureCategory: 'finding-shape', message: 'review unit clause index differs', });
    assertExactIndexes({ actual: finding.sourceEvidenceIndexes, expected: clause.sourceEvidenceIndexes, });
    if ((finding.imageEvidenceIndexes.length !== 0)
      || ((defectClass === 'omission') && (finding.targetAnchors.length !== 0))
      || ((defectClass !== 'omission') && (finding.targetAnchors.length === 0)))
      refuse({ failureCategory: 'anchor', message: 'review unit clause evidence differs', });
  }
  else if (finding.scope === 'r') {
    /** Relation subject selected by finding. */
    const relation = reviewPlan.relations[finding.subjectIndex];
    if (relation === undefined)
      refuse({ failureCategory: 'finding-shape', message: 'review unit relation index differs', });
    assertExactIndexes({ actual: finding.sourceEvidenceIndexes, expected: relation.sourceEvidenceIndexes, });
    if ((finding.imageEvidenceIndexes.length !== 0)
      || (finding.targetAnchors.length === 0)
      || (defectClass === 'omission')
      || (defectClass === 'image-relation'))
      refuse({ failureCategory: 'finding-shape', message: 'review unit relation evidence differs', });
  }
  else if (finding.scope === 'sl') {
    if ((finding.sourceEvidenceIndexes.length !== 0)
      || (finding.imageEvidenceIndexes.length !== 0)
      || (finding.targetAnchors.length === 0)
      || (defectClass === 'omission')
      || (defectClass === 'image-relation'))
      refuse({ failureCategory: 'finding-shape', message: 'review unit language evidence differs', });
  }
  else {
    /** Whether global subject is exact source-image-target relation. */
    const visual = finding.subjectIndex === 5;
    if ((finding.targetAnchors.length === 0)
      || (visual && ((defectClass !== 'image-relation') || (finding.imageEvidenceIndexes.length === 0)))
      || ((!visual) && ((defectClass === 'image-relation') || (finding.imageEvidenceIndexes.length !== 0)))
      || (defectClass === 'omission'))
      refuse({ failureCategory: 'finding-shape', message: 'review unit global evidence differs', });
  }
  /** Authorized candidate slots for target evidence. */
  const allowedSlotKeys = targetSlots({ finding, reviewPlan, candidate, });
  finding.targetAnchors.forEach(function anchor(value,) {
    assertAnchor({ anchor: value, candidate, allowedSlotKeys, });
  },);
  assertDisjointAnchors({ anchors: finding.targetAnchors, });
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
  /** Every explicit defect subject in canonical order. */
  const defects = defectKeys({ response, reviewPlan, });
  /** Canonical retained defect prefix. */
  const retained = defects.slice(0, REVIEW_UNIT_FINDING_CAP,);
  /** Finding logical subject keys in response order. */
  const keys = response.findings.map(function key(finding,) { return findingKey({ finding, }); });
  if ((response.overflow !== (defects.length > REVIEW_UNIT_FINDING_CAP))
    || (JSON.stringify(keys,) !== JSON.stringify(retained,)))
    refuse({ failureCategory: 'overflow', message: 'review unit overflow or canonical subjects differ', });
  response.findings.forEach(function finding(value,) {
    assertFinding({ finding: value, candidate, reviewPlan, pictureCount, });
  },);
}
