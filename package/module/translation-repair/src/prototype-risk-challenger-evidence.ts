// PROTOTYPE ONLY: Candidate M role and located-evidence diagnosis.

import { hashContent, } from './document-node.ts';
import { isJsonRecord, } from './json-guard.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import {
  CANDIDATE_M_DEFECT_CLASSES,
  type CandidateMChallengeDiagnosis,
  type CandidateMChallengerRole,
  type CandidateMCandidate,
  type CandidateMDefectClass,
} from './prototype-risk-challenger-model.ts';
import {
  candidateMEvidenceCardinality,
  candidateMRoleAllows,
  candidateMSourceScopeAllows,
} from './prototype-risk-challenger-rules.ts';

/**
 * Whether unknown value belongs to closed Candidate M defect vocabulary.
 *
 * @param value - Untrusted defect class
 *
 * @returns Exact defect-class narrowing
 */
function isCandidateMDefectClass(value: unknown,): value is CandidateMDefectClass {
  return ((typeof value) === 'string')
    && CANDIDATE_M_DEFECT_CLASSES.some(function same(defectClass,) {
      return defectClass === value;
    },);
}

/**
 * Whether namespaced source evidence binds exact review subject and class.
 *
 * @returns Scope and class authorization
 */
function sourceEvidenceValid({
  evidence,
  defectClass,
  reviewPlan,
}: {
  readonly evidence: unknown;
  readonly defectClass: CandidateMDefectClass;
  readonly reviewPlan: ReviewUnitPlan;
}): boolean {
  if ((!isJsonRecord(evidence,))
    || (JSON.stringify(Object.keys(evidence,)
      .toSorted(),) !== JSON.stringify([
      'scope',
      'subjectIndex',
    ],))
    || ((evidence.scope !== 'front-matter')
      && (evidence.scope !== 'clause')
      && (evidence.scope !== 'relation'))
    || ((typeof evidence.subjectIndex) !== 'number')
    || (!Number.isInteger(evidence.subjectIndex,))
    || (evidence.subjectIndex < 0)
    || (!candidateMSourceScopeAllows({
      scope: evidence.scope,
      defectClass,
    },)))
    return false;
  if (evidence.scope === 'front-matter')
    return evidence.subjectIndex
      < reviewPlan.frontMatterSubjects
      .length;
  if (evidence.scope === 'clause')
    return evidence.subjectIndex
      < reviewPlan.clauses
      .length;
  return evidence.subjectIndex
    < reviewPlan.relations
    .length;
}

/**
 * Whether exact target anchor binds one candidate substring.
 *
 * @returns Anchor shape, offsets, and substring digest validity
 */
function targetAnchorValid({
  anchor,
  candidate,
}: {
  readonly anchor: unknown;
  readonly candidate: CandidateMCandidate;
}): boolean {
  if ((!isJsonRecord(anchor,))
    || (JSON.stringify(Object.keys(anchor,)
      .toSorted(),) !== JSON.stringify([
      'digest',
      'endOffset',
      'slotKey',
      'startOffset',
    ],))
    || ((typeof anchor.slotKey) !== 'string')
    || ((typeof anchor.startOffset) !== 'number')
    || ((typeof anchor.endOffset) !== 'number')
    || (!Number.isInteger(anchor.startOffset,))
    || (!Number.isInteger(anchor.endOffset,))
    || ((typeof anchor.digest) !== 'string'))
    return false;
  /**
   * Candidate slot text under exact anchor key.
   */
  const text = candidate.slots[anchor.slotKey];
  /**
   * Untrusted exact start after numeric proof.
   */
  const { startOffset, } = anchor;
  /**
   * Untrusted exact end after numeric proof.
   */
  const { endOffset, } = anchor;
  if ((text === undefined)
    || (startOffset < 0)
    || (endOffset <= startOffset)
    || (endOffset > text.length))
    return false;
  return hashContent({ content: text.slice(
    startOffset,
    endOffset,
  ), }) === anchor.digest;
}

/**
 * Diagnoses one bounded finding by role, shape, scope, and anchor layers.
 *
 * @returns Exact neutral failure category or acceptance
 *
 * @example
 * ```ts
 * const diagnosis = diagnoseRiskFinding({ finding, role, candidate, reviewPlan, pictureCount: 1, });
 * ```
 */
export function diagnoseRiskFinding({
  finding,
  role,
  candidate,
  reviewPlan,
  pictureCount,
}: {
  readonly finding: unknown;
  readonly role: CandidateMChallengerRole;
  readonly candidate: CandidateMCandidate;
  readonly reviewPlan: ReviewUnitPlan;
  readonly pictureCount: number;
}): CandidateMChallengeDiagnosis {
  if ((!isJsonRecord(finding,))
    || (JSON.stringify(Object.keys(finding,)
      .toSorted(),) !== JSON.stringify([
      'defectClass',
      'imageEvidenceIndexes',
      'sourceEvidence',
      'targetAnchors',
    ],))
    || (!isCandidateMDefectClass(finding.defectClass,))
    || (!Array.isArray(finding.sourceEvidence,))
    || (!Array.isArray(finding.targetAnchors,))
    || (!Array.isArray(finding.imageEvidenceIndexes,)))
    return {
      kind: 'rejected',
      failure: 'finding-shape',
    };
  /**
   * Closed class after membership proof.
   */
  const { defectClass, } = finding;
  if (!candidateMRoleAllows({
    role,
    defectClass,
  }))
    return {
      kind: 'rejected',
      failure: 'role',
    };
  /**
   * Exact model-facing and runtime-consumed evidence rule.
   */
  const cardinality = candidateMEvidenceCardinality(defectClass,);
  if ((finding.sourceEvidence
    .length
    < cardinality.sourceMinimum)
    || (finding.sourceEvidence
      .length
      > cardinality.sourceMaximum)
    || (finding.targetAnchors
      .length
      < cardinality.targetMinimum)
    || (finding.targetAnchors
      .length
      > cardinality.targetMaximum)
    || (cardinality.imageMode === 'required'
      ? (finding.imageEvidenceIndexes
        .length
        === 0)
        || (finding.imageEvidenceIndexes
          .length
          > pictureCount)
      : finding.imageEvidenceIndexes
        .length
        > 0))
    return {
      kind: 'rejected',
      failure: 'finding-shape',
    };
  if (finding.sourceEvidence
    .some(function invalid(evidence,) {
    return !sourceEvidenceValid({
      evidence,
      defectClass,
      reviewPlan,
    });
  },))
    return {
      kind: 'rejected',
      failure: 'source-scope',
    };
  if (finding.targetAnchors
    .some(function invalid(anchor,) {
    return !targetAnchorValid({
      anchor,
      candidate,
    });
  },))
    return {
      kind: 'rejected',
      failure: 'anchor',
    };
  if (finding.imageEvidenceIndexes
    .some(function invalid(index,) {
    return (!Number.isInteger(index,))
      || (index < 0)
      || (index >= pictureCount);
  },)
    || (new Set(finding.sourceEvidence
      .map(function key(evidence,) {
      return JSON.stringify(evidence,);
    },)).size
      !== finding.sourceEvidence
      .length)
    || (new Set(finding.imageEvidenceIndexes,).size
      !== finding.imageEvidenceIndexes
      .length)
    || (new Set(finding.targetAnchors
      .map(function key(anchor,) {
      return JSON.stringify(anchor,);
    },)).size
      !== finding.targetAnchors
      .length))
    return {
      kind: 'rejected',
      failure: 'finding-shape',
    };
  return { kind: 'accepted', };
}
