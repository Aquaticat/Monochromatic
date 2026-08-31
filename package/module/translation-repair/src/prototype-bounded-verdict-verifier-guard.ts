// PROTOTYPE ONLY: Candidate H parsed verifier response guard.

import { isJsonRecord, } from './json-guard.ts';
import { CONDITIONAL_DEFECT_CLASSES, } from './prototype-conditional-audit-model.ts';
import {
  BOUNDED_VERDICT_FINDING_CAP,
  type BoundedCandidate,
  type BoundedVerifierResponse,
} from './prototype-bounded-verdict-model.ts';
import {
  MAX_REALIZATION_FINDING_ANCHORS,
  REALIZATION_GLOBAL_CRITERIA,
  type RealizationObligationLedger,
  type RealizationTargetAnchor,
} from './prototype-realization-model.ts';

/**
 * Whether parsed object has exactly expected keys and no hidden fields.
 *
 * @returns Whether key sets are equal regardless of member order
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
 * Guards exact target-anchor wire shape before semantic admission.
 *
 * @param value - untrusted parsed target anchor
 *
 * @returns Whether every exact target-anchor member has expected primitive shape
 */
function isTargetAnchor(value: unknown,): value is RealizationTargetAnchor {
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
 * Guards compact finding shape and bounded indexes.
 *
 * @returns Whether finding carries exact fields and in-range subject indexes
 */
function isFinding({
  value,
  obligationCount,
}: {
  readonly value: unknown;
  readonly obligationCount: number;
}): boolean {
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
    return false;

  /**
   * Exclusive upper bound selected by finding scope.
   */
  const indexLimit = value.scope === 'o'
    ? obligationCount
    : REALIZATION_GLOBAL_CRITERIA.length;
  return (value.manifestIndex >= 0)
    && (value.manifestIndex < indexLimit)
    && (value.defectClassIndex >= 0)
    && (value.defectClassIndex < CONDITIONAL_DEFECT_CLASSES.length)
    && (value.targetAnchors
      .length
      <= MAX_REALIZATION_FINDING_ANCHORS)
    && value.targetAnchors
    .every(isTargetAnchor,);
}

/**
 * Builds guard for exact candidate set and complete status dimensions.
 *
 * @returns Guard binding response to supplied candidate and obligation counts
 *
 * @example
 * ```ts
 * const guard = boundedVerifierResponseGuard({ ledger, candidates, });
 * ```
 */
export function boundedVerifierResponseGuard({
  ledger,
  candidates,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly candidates: readonly BoundedCandidate[];
}): (value: unknown) => value is BoundedVerifierResponse {
  /**
   * Candidate authorization by opaque alias.
   */
  const byId = new Map(candidates.map(function candidate(value,) {
    return [
      value.candidateId,
      value,
    ] as const;
  },),);

  return function isBoundedVerifierResponse(
    value: unknown,
  ): value is BoundedVerifierResponse {
    if ((!isJsonRecord(value,))
      || (!hasExactKeys({
        value,
        expected: ['candidates',],
      },))
      || (!Array.isArray(value.candidates,))
      || (value.candidates
        .length
        !== candidates.length))
      return false;

    /**
     * Aliases already observed in atomic matrix.
     */
    const seen = new Set<string>();
    return value.candidates
      .every(function row(item,) {
      if ((!isJsonRecord(item,))
        || (!hasExactKeys({
          value: item,
          expected: [
            'candidateId',
            'candidateDigest',
            'obligationStatuses',
            'globalStatuses',
            'overflow',
            'findings',
          ],
        },))
        || ((typeof item.candidateId) !== 'string')
        || ((typeof item.candidateDigest) !== 'string')
        || (!Array.isArray(item.obligationStatuses,))
        || (!Array.isArray(item.globalStatuses,))
        || ((typeof item.overflow) !== 'boolean')
        || (!Array.isArray(item.findings,)))
        return false;

      /**
       * Candidate whose digest must match row binding.
       */
      const candidate = byId.get(item.candidateId,);
      if ((candidate === undefined)
        || seen.has(item.candidateId,)
        || (item.candidateDigest !== candidate.candidateDigest))
        return false;
      seen.add(item.candidateId,);

      return (item.obligationStatuses
        .length
        === ledger.obligations
        .length)
        && item.obligationStatuses
        .every(function status(code,) {
          return (code === 'p') || (code === 'd');
        },)
        && (item.globalStatuses
          .length
          === REALIZATION_GLOBAL_CRITERIA.length)
        && item.globalStatuses
        .every(function status(code,) {
          return (code === 'c') || (code === 'd');
        },)
        && (item.findings
          .length
          <= BOUNDED_VERDICT_FINDING_CAP)
        && item.findings
        .every(function itemFinding(finding,) {
          return isFinding({
            value: finding,
            obligationCount: ledger.obligations
              .length,
          },);
        },);
    },);
  };
}
