// PROTOTYPE ONLY: Candidate H compact complete verifier schema and guard.

import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import { isJsonRecord, } from './json-guard.ts';
import { CONDITIONAL_DEFECT_CLASSES, } from './prototype-conditional-audit-model.ts';
import {
  BOUNDED_VERDICT_FINDING_CAP,
  type BoundedCandidate,
  type BoundedVerifierResponse,
} from './prototype-bounded-verdict-model.ts';
import {
  MAX_REALIZATION_CANDIDATES,
  MAX_REALIZATION_FINDING_ANCHORS,
  MAX_REALIZATION_OBLIGATIONS,
  REALIZATION_GLOBAL_CRITERIA,
  type RealizationObligationLedger,
  type RealizationTargetAnchor,
} from './prototype-realization-model.ts';

/** Whether parsed object has exactly expected keys and no hidden fields. */
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

/** Strict schema shared by exact UTF-16 target anchors. */
const BOUNDED_TARGET_ANCHOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['slotKey', 'startOffset', 'endOffset', 'digest',],
  properties: {
    slotKey: { type: 'string', minLength: 1, maxLength: 32, },
    startOffset: { type: 'integer', minimum: 0, maximum: 20_000, },
    endOffset: { type: 'integer', minimum: 1, maximum: 20_000, },
    digest: { type: 'string', minLength: 64, maxLength: 64, },
  },
} as const;

/** Builds strict all-candidate status and bounded-finding schema. */
export function boundedVerifierResponseFormat({
  ledger,
  candidates,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly candidates: readonly BoundedCandidate[];
}): JsonSchemaResponseFormat {
  if ((candidates.length === 0)
    || (candidates.length > MAX_REALIZATION_CANDIDATES)
    || (ledger.obligations.length === 0)
    || (ledger.obligations.length > MAX_REALIZATION_OBLIGATIONS))
    throw new Error('bounded verifier schema dimensions are outside finite bound');
  const candidateIds = candidates.map(function id(candidate,) {
    return candidate.candidateId;
  },);
  if (new Set(candidateIds,).size !== candidateIds.length)
    throw new Error('bounded verifier schema candidate alias repeats');
  return {
    type: 'json_schema',
    json_schema: {
      name: 'bounded_verdict_ballot',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['candidates',],
        properties: {
          candidates: {
            type: 'array',
            minItems: candidates.length,
            maxItems: candidates.length,
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'candidateId',
                'candidateDigest',
                'obligationStatuses',
                'globalStatuses',
                'overflow',
                'findings',
              ],
              properties: {
                candidateId: { type: 'string', enum: candidateIds, },
                candidateDigest: {
                  type: 'string',
                  minLength: 64,
                  maxLength: 64,
                },
                obligationStatuses: {
                  type: 'array',
                  minItems: ledger.obligations.length,
                  maxItems: ledger.obligations.length,
                  items: { type: 'string', enum: ['p', 'd',], },
                },
                globalStatuses: {
                  type: 'array',
                  minItems: REALIZATION_GLOBAL_CRITERIA.length,
                  maxItems: REALIZATION_GLOBAL_CRITERIA.length,
                  items: { type: 'string', enum: ['c', 'd',], },
                },
                overflow: { type: 'boolean', },
                findings: {
                  type: 'array',
                  minItems: 0,
                  maxItems: BOUNDED_VERDICT_FINDING_CAP,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: [
                      'scope',
                      'manifestIndex',
                      'defectClassIndex',
                      'targetAnchors',
                    ],
                    properties: {
                      scope: { type: 'string', enum: ['o', 'g',], },
                      manifestIndex: {
                        type: 'integer',
                        minimum: 0,
                        maximum: Math.max(
                          ledger.obligations.length,
                          REALIZATION_GLOBAL_CRITERIA.length,
                        ) - 1,
                      },
                      defectClassIndex: {
                        type: 'integer',
                        minimum: 0,
                        maximum: CONDITIONAL_DEFECT_CLASSES.length - 1,
                      },
                      targetAnchors: {
                        type: 'array',
                        minItems: 0,
                        maxItems: MAX_REALIZATION_FINDING_ANCHORS,
                        items: BOUNDED_TARGET_ANCHOR_SCHEMA,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

/** Guards exact target-anchor wire shape before semantic admission. */
function isTargetAnchor(value: unknown,): value is RealizationTargetAnchor {
  return isJsonRecord(value,)
    && hasExactKeys({
      value,
      expected: ['slotKey', 'startOffset', 'endOffset', 'digest',],
    },)
    && ((typeof value.slotKey) === 'string')
    && Number.isInteger(value.startOffset,)
    && Number.isInteger(value.endOffset,)
    && ((typeof value.digest) === 'string');
}

/** Guards compact finding shape and bounded indexes. */
function isFinding({
  value,
  obligationCount,
}: {
  readonly value: unknown;
  readonly obligationCount: number;
}): boolean {
  if (!isJsonRecord(value,)
    || !hasExactKeys({
      value,
      expected: [
        'scope',
        'manifestIndex',
        'defectClassIndex',
        'targetAnchors',
      ],
    },)
    || ((value.scope !== 'o') && (value.scope !== 'g'))
    || ((typeof value.manifestIndex) !== 'number')
    || !Number.isInteger(value.manifestIndex,)
    || ((typeof value.defectClassIndex) !== 'number')
    || !Number.isInteger(value.defectClassIndex,)
    || !Array.isArray(value.targetAnchors,))
    return false;
  const indexLimit = value.scope === 'o'
    ? obligationCount
    : REALIZATION_GLOBAL_CRITERIA.length;
  return (value.manifestIndex >= 0)
    && (value.manifestIndex < indexLimit)
    && (value.defectClassIndex >= 0)
    && (value.defectClassIndex < CONDITIONAL_DEFECT_CLASSES.length)
    && (value.targetAnchors.length <= MAX_REALIZATION_FINDING_ANCHORS)
    && value.targetAnchors.every(isTargetAnchor,);
}

/** Builds guard for exact candidate set and complete status dimensions. */
export function boundedVerifierResponseGuard({
  ledger,
  candidates,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly candidates: readonly BoundedCandidate[];
}): (value: unknown) => value is BoundedVerifierResponse {
  const byId = new Map(candidates.map(function candidate(value,) {
    return [value.candidateId, value,] as const;
  },),);
  return function isBoundedVerifierResponse(
    value: unknown,
  ): value is BoundedVerifierResponse {
    if (!isJsonRecord(value,)
      || !hasExactKeys({ value, expected: ['candidates',], },)
      || !Array.isArray(value.candidates,)
      || (value.candidates.length !== candidates.length))
      return false;
    const seen = new Set<string>();
    return value.candidates.every(function row(item,) {
      if (!isJsonRecord(item,)
        || !hasExactKeys({
          value: item,
          expected: [
            'candidateId',
            'candidateDigest',
            'obligationStatuses',
            'globalStatuses',
            'overflow',
            'findings',
          ],
        },)
        || ((typeof item.candidateId) !== 'string')
        || ((typeof item.candidateDigest) !== 'string')
        || !Array.isArray(item.obligationStatuses,)
        || !Array.isArray(item.globalStatuses,)
        || ((typeof item.overflow) !== 'boolean')
        || !Array.isArray(item.findings,))
        return false;
      const candidate = byId.get(item.candidateId,);
      if ((candidate === undefined)
        || seen.has(item.candidateId,)
        || (item.candidateDigest !== candidate.candidateDigest))
        return false;
      seen.add(item.candidateId,);
      return (item.obligationStatuses.length === ledger.obligations.length)
        && item.obligationStatuses.every(function status(code,) {
          return (code === 'p') || (code === 'd');
        },)
        && (item.globalStatuses.length === REALIZATION_GLOBAL_CRITERIA.length)
        && item.globalStatuses.every(function status(code,) {
          return (code === 'c') || (code === 'd');
        },)
        && (item.findings.length <= BOUNDED_VERDICT_FINDING_CAP)
        && item.findings.every(function finding(finding,) {
          return isFinding({
            value: finding,
            obligationCount: ledger.obligations.length,
          },);
        },);
    },);
  };
}
