// PROTOTYPE ONLY: Candidate I parsed response guard with privacy-safe category.

import { isJsonRecord, } from './json-guard.ts';
import { CONDITIONAL_DEFECT_CLASSES, } from './prototype-conditional-audit-model.ts';
import {
  CANDIDATE_BALLOT_FINDING_CAP,
  type CandidateBallotCandidate,
  type CandidateBallotDiagnosis,
  type CandidateBallotGuardFailure,
  type CandidateBallotResponse,
} from './prototype-candidate-ballot-model.ts';
import {
  MAX_REALIZATION_FINDING_ANCHORS,
  REALIZATION_GLOBAL_CRITERIA,
  type RealizationObligationLedger,
} from './prototype-realization-model.ts';

/**
 * Sentinel for finding passing structural guard.
 */
const FINDING_VALID: unique symbol = Symbol('candidate ballot finding valid',);

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
 * @param value - Untrusted target anchor
 *
 * @returns Whether value carries exact anchor primitives
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
 * Privacy-safe category for one finding shape failure.
 *
 * @returns Guard category or valid sentinel
 */
function findingFailure({
  value,
  obligationCount,
}: {
  readonly value: unknown;
  readonly obligationCount: number;
}): CandidateBallotGuardFailure | typeof FINDING_VALID {
  if ((!isJsonRecord(value,))
    || (!hasExactKeys({
      value,
      expected: [
        'scope',
        'manifestIndex',
        'defectClassIndex',
        'targetAnchors',
      ],
    },))
    || ((value.scope !== 'o') && (value.scope !== 'g'))
    || ((typeof value.manifestIndex) !== 'number')
    || (!Number.isInteger(value.manifestIndex,))
    || ((typeof value.defectClassIndex) !== 'number')
    || (!Number.isInteger(value.defectClassIndex,))
    || (!Array.isArray(value.targetAnchors,)))
    return 'finding-shape';
  /**
   * Exclusive subject index bound selected by scope.
   */
  const indexLimit = value.scope === 'o'
    ? obligationCount
    : REALIZATION_GLOBAL_CRITERIA.length;
  if ((value.manifestIndex < 0)
    || (value.manifestIndex >= indexLimit)
    || (value.defectClassIndex < 0)
    || (value.defectClassIndex >= CONDITIONAL_DEFECT_CLASSES.length)
    || (value.targetAnchors
      .length
      > MAX_REALIZATION_FINDING_ANCHORS))
    return 'finding-shape';
  return value.targetAnchors
    .every(isTargetAnchor,) ? FINDING_VALID : 'anchor';
}

/**
 * Whether every UTF-16 unit belongs to bounded ASCII alphabet.
 *
 * @returns Whether status string contains only clean code or defect code
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
 * Classifies first deterministic parsed-response guard failure.
 *
 * @returns Accepted diagnosis or first privacy-safe failure
 *
 * @example
 * ```ts
 * const diagnosis = diagnoseCandidateBallotResponse({ value, ledger, candidate, });
 * ```
 */
export function diagnoseCandidateBallotResponse({
  value,
  ledger,
  candidate,
}: {
  readonly value: unknown;
  readonly ledger: RealizationObligationLedger;
  readonly candidate: CandidateBallotCandidate;
}): CandidateBallotDiagnosis {
  if ((!isJsonRecord(value,))
    || (!hasExactKeys({
      value,
      expected: [
        'candidateId',
        'candidateDigest',
        'obligationStatuses',
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
    || (value.candidateDigest !== candidate.candidateDigest))
    return {
      kind: 'rejected',
      failure: 'candidate-binding',
    };
  if (((typeof value.obligationStatuses) !== 'string')
    || ((typeof value.globalStatuses) !== 'string')
    || (value.obligationStatuses
      .length
      !== ledger.obligations
      .length)
    || (value.globalStatuses
      .length
      !== REALIZATION_GLOBAL_CRITERIA.length))
    return {
      kind: 'rejected',
      failure: 'status-length',
    };
  if ((!statusAlphabetMatches({
    statuses: value.obligationStatuses,
    cleanCode: 'p',
  },)) || (!statusAlphabetMatches({
    statuses: value.globalStatuses,
    cleanCode: 'c',
  },)))
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
      > CANDIDATE_BALLOT_FINDING_CAP))
    return {
      kind: 'rejected',
      failure: 'finding-shape',
    };
  /**
   * First finding failure or valid sentinel.
   */
  const findingResult = value.findings
    .reduce<CandidateBallotGuardFailure | typeof FINDING_VALID>(
    function firstFailure(
      found,
      finding,
    ) {
      return (typeof found) === 'symbol'
        ? findingFailure({
          value: finding,
          obligationCount: ledger.obligations
            .length,
        })
        : found;
    },
    FINDING_VALID,
  );
  return (typeof findingResult) === 'symbol'
    ? { kind: 'accepted', }
    : {
      kind: 'rejected',
      failure: findingResult,
    };
}

/**
 * Builds type guard bound to exact candidate and obligation counts.
 *
 * @returns Guard for one candidate-scoped response
 *
 * @example
 * ```ts
 * const guard = candidateBallotResponseGuard({ ledger, candidate, });
 * ```
 */
export function candidateBallotResponseGuard({
  ledger,
  candidate,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly candidate: CandidateBallotCandidate;
}): (value: unknown) => value is CandidateBallotResponse {
  return function isCandidateBallotResponse(
    value: unknown,
  ): value is CandidateBallotResponse {
    return diagnoseCandidateBallotResponse({
      value,
      ledger,
      candidate,
    })
      .kind
      === 'accepted';
  };
}
