// PROTOTYPE ONLY: Candidate G verifier matrix structural guards.

import {
  CONDITIONAL_DEFECT_CLASSES,
  type ConditionalDefectClass,
} from './prototype-conditional-audit-model.ts';
import {
  MAX_REALIZATION_CANDIDATES,
  MAX_REALIZATION_FINDING_ANCHORS,
  MAX_REALIZATION_FINDINGS,
  MAX_REALIZATION_OBLIGATIONS,
  MAX_REALIZATION_TARGET_ANCHORS,
  REALIZATION_GLOBAL_CRITERIA,
  type RealizationCandidateVerification,
  type RealizationFinding,
  type RealizationGlobalCriterion,
  type RealizationGlobalFinding,
  type RealizationGlobalStatus,
  type RealizationObligationFinding,
  type RealizationObligationLedger,
  type RealizationObligationStatus,
  type RealizationTargetAnchor,
  type RealizationVerifierResponse,
  type RealizedCandidate,
} from './prototype-realization-model.ts';


//region Primitive guards

/** Sentinel distinguishing non-record verifier values without nullish union. */
const VERIFIER_RECORD_ABSENT: unique symbol = Symbol('realization verifier record absent',);

/**
 * Reads unknown object without unsafe property access.
 */
function asRecord(
  value: unknown,
): Readonly<Record<string, unknown>> | typeof VERIFIER_RECORD_ABSENT {
  if (((typeof value) !== 'object') || (value === null))
    return VERIFIER_RECORD_ABSENT;
  return Object.fromEntries(Object.entries(value,),);
}

/**
 * Checks exact own keys regardless of provider object ordering.
 */
function exactKeys({
  value,
  expected,
}: {
  readonly value: Readonly<Record<string, unknown>>;
  readonly expected: readonly string[];
}): boolean {
  const actual = Object.keys(value,);
  return (actual.length === expected.length) && expected.every(function present(key,) { return actual.includes(key,); });
}

/**
 * Checks known fixed defect class.
 */
function isDefectClass(value: unknown,): value is ConditionalDefectClass {
  return ((typeof value) === 'string') && CONDITIONAL_DEFECT_CLASSES.includes(value as ConditionalDefectClass,);
}

/**
 * Checks known fixed candidate-global criterion.
 */
function isGlobalCriterion(value: unknown,): value is RealizationGlobalCriterion {
  return ((typeof value) === 'string') && REALIZATION_GLOBAL_CRITERIA.includes(value as RealizationGlobalCriterion,);
}

/**
 * Checks exact target range primitive shape.
 */
function isTargetAnchor(value: unknown,): value is RealizationTargetAnchor {
  const record = asRecord(value,);
  return (record !== VERIFIER_RECORD_ABSENT)
    && exactKeys({
      value: record,
      expected: [
        'slotKey',
        'startOffset',
        'endOffset',
        'digest',
      ],
    })
    && ((typeof record.slotKey) === 'string')
    && Number.isInteger(record.startOffset,)
    && Number.isInteger(record.endOffset,)
    && ((typeof record.digest) === 'string')
    && (record.digest
      .length
      === 64);
}

/**
 * Checks duplicate-detectable obligation matrix row.
 */
function isObligationStatus(value: unknown,): value is RealizationObligationStatus {
  const record = asRecord(value,);
  return (record !== VERIFIER_RECORD_ABSENT)
    && exactKeys({
      value: record,
      expected: [
        'obligationId',
        'obligationEvidenceDigest',
        'status',
        'verifiedTargetAnchors',
      ],
    })
    && ((typeof record.obligationId) === 'string')
    && ((typeof record.obligationEvidenceDigest) === 'string')
    && (record.obligationEvidenceDigest
      .length
      === 64)
    && ((record.status === 'preserved') || (record.status === 'defect'))
    && Array.isArray(record.verifiedTargetAnchors,)
    && (record.verifiedTargetAnchors
      .length
      <= MAX_REALIZATION_TARGET_ANCHORS)
    && record.verifiedTargetAnchors
    .every(isTargetAnchor,);
}

/**
 * Checks duplicate-detectable global matrix row.
 */
function isGlobalStatus(value: unknown,): value is RealizationGlobalStatus {
  const record = asRecord(value,);
  return (record !== VERIFIER_RECORD_ABSENT)
    && exactKeys({
      value: record,
      expected: [
        'criterion',
        'status',
      ],
    })
    && isGlobalCriterion(record.criterion,)
    && ((record.status === 'clean') || (record.status === 'defect'));
}

/**
 * Checks obligation-linked finding shape.
 */
function isObligationFinding(value: Readonly<Record<string, unknown>>,): value is RealizationObligationFinding {
  return exactKeys({
    value,
    expected: [
      'scope',
      'obligationId',
      'defectClass',
      'targetAnchors',
    ],
  })
    && (value.scope === 'obligation')
    && ((typeof value.obligationId) === 'string')
    && isDefectClass(value.defectClass,)
    && Array.isArray(value.targetAnchors,)
    && (value.targetAnchors
      .length
      <= MAX_REALIZATION_FINDING_ANCHORS)
    && value.targetAnchors
    .every(isTargetAnchor,);
}

/**
 * Checks global-linked finding shape.
 */
function isGlobalFinding(value: Readonly<Record<string, unknown>>,): value is RealizationGlobalFinding {
  return exactKeys({
    value,
    expected: [
      'scope',
      'criterion',
      'defectClass',
      'targetAnchors',
    ],
  })
    && (value.scope === 'global')
    && isGlobalCriterion(value.criterion,)
    && isDefectClass(value.defectClass,)
    && Array.isArray(value.targetAnchors,)
    && (value.targetAnchors
      .length
      <= MAX_REALIZATION_FINDING_ANCHORS)
    && value.targetAnchors
    .every(isTargetAnchor,);
}

/**
 * Checks finding discriminant and exact variant keys.
 */
function isFinding(value: unknown,): value is RealizationFinding {
  const record = asRecord(value,);
  return (record !== VERIFIER_RECORD_ABSENT) && (isObligationFinding(record,) || isGlobalFinding(record,));
}

/**
 * Checks one candidate matrix primitive wire shape.
 */
function isCandidateVerification(value: unknown,): value is RealizationCandidateVerification {
  const record = asRecord(value,);
  return (record !== VERIFIER_RECORD_ABSENT)
    && exactKeys({
      value: record,
      expected: [
        'candidateId',
        'candidateDigest',
        'obligations',
        'globalChecks',
        'findings',
      ],
    })
    && ((typeof record.candidateId) === 'string')
    && ((typeof record.candidateDigest) === 'string')
    && (record.candidateDigest
      .length
      === 64)
    && Array.isArray(record.obligations,)
    && record.obligations
    .every(isObligationStatus,)
    && Array.isArray(record.globalChecks,)
    && record.globalChecks
    .every(isGlobalStatus,)
    && Array.isArray(record.findings,)
    && (record.findings
      .length
      <= MAX_REALIZATION_FINDINGS)
    && record.findings
    .every(isFinding,);
}

//endregion Primitive guards

//region Structural response guard

/**
 * Builds verifier type guard for exact ledger and opaque candidate aliases.
 */
export function realizationVerifierResponseGuard({
  ledger,
  candidates,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly candidates: readonly RealizedCandidate[];
}): (value: unknown) => value is RealizationVerifierResponse {
  if ((candidates.length === 0) || (candidates.length > MAX_REALIZATION_CANDIDATES))
    throw new Error('realization verifier guard candidate count is outside finite bound');
  if ((ledger.obligations
    .length
    === 0) || (ledger.obligations
      .length
      > MAX_REALIZATION_OBLIGATIONS))
    throw new Error('realization verifier guard obligation count is outside finite bound');
  const candidateIds = candidates.map(function id(candidate,) { return candidate.candidateId; },);
  const obligationIds = ledger.obligations
    .map(function id(obligation,) { return obligation.id; },);
  if ((new Set(candidateIds,).size !== candidateIds.length)
    || (new Set(obligationIds,).size !== obligationIds.length))
    throw new Error('realization verifier guard manifest identity repeats');
  return function isRealizationVerifierResponse(value: unknown,): value is RealizationVerifierResponse {
    const record = asRecord(value,);
    if ((record === VERIFIER_RECORD_ABSENT)
      || (!exactKeys({
        value: record,
        expected: ['candidates',],
      }))
      || (!Array.isArray(record.candidates,))
      || (record.candidates
        .length
        !== candidateIds.length)
      || (!record.candidates
        .every(isCandidateVerification,)))
      return false;
    const responseCandidates = record.candidates;
    const actualCandidates = responseCandidates.map(function id(candidate,) { return candidate.candidateId; },);
    if ((new Set(actualCandidates,).size !== actualCandidates.length)
      || candidateIds.some(function missing(id,) { return !actualCandidates.includes(id,); }))
      return false;
    return responseCandidates.every(function complete(candidate,) {
      const actualObligations = candidate.obligations
        .map(function id(status,) { return status.obligationId; },);
      const actualGlobals = candidate.globalChecks
        .map(function criterion(status,) { return status.criterion; },);
      return (actualObligations.length === obligationIds.length)
        && (new Set(actualObligations,).size === actualObligations.length)
        && obligationIds.every(function missing(id,) { return actualObligations.includes(id,); })
        && (actualGlobals.length === REALIZATION_GLOBAL_CRITERIA.length)
        && (new Set(actualGlobals,).size === actualGlobals.length)
        && REALIZATION_GLOBAL_CRITERIA.every(function missing(criterion,) {
          return actualGlobals.includes(criterion,);
        },);
    },);
  };
}

//endregion Structural response guard
