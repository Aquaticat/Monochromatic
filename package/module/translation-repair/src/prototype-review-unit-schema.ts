// PROTOTYPE ONLY: Candidate K one-candidate compact-string schema.

import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import { CONDITIONAL_DEFECT_CLASSES, } from './prototype-conditional-audit-model.ts';
import {
  REVIEW_UNIT_FINDING_CAP,
  type ReviewUnitCandidate,
} from './prototype-review-unit-model.ts';
import {
  MAX_REALIZATION_FINDING_ANCHORS,
  MAX_REALIZATION_OBLIGATIONS,
  REALIZATION_GLOBAL_CRITERIA,
  type RealizationObligationLedger,
} from './prototype-realization-model.ts';

/**
 * Strict schema for exact UTF-16 target anchors.
 */
const TARGET_ANCHOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'slotKey',
    'startOffset',
    'endOffset',
    'digest',
  ],
  properties: {
    slotKey: {
      type: 'string',
      minLength: 1,
      maxLength: 32,
    },
    startOffset: {
      type: 'integer',
      minimum: 0,
      maximum: 20_000,
    },
    endOffset: {
      type: 'integer',
      minimum: 1,
      maximum: 20_000,
    },
    digest: {
      type: 'string',
      minLength: 64,
      maxLength: 64,
    },
  },
} as const;

/**
 * Builds strict candidate-scoped status-string and bounded-finding schema.
 *
 * @returns Schema binding exact candidate and ledger dimensions
 *
 * @example
 * ```ts
 * const format = reviewUnitResponseFormat({ ledger, candidate, });
 * ```
 */
export function reviewUnitResponseFormat({
  ledger,
  candidate,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly candidate: ReviewUnitCandidate;
}): JsonSchemaResponseFormat {
  if ((ledger.obligations
    .length
    === 0)
    || (ledger.obligations
      .length
      > MAX_REALIZATION_OBLIGATIONS))
    throw new Error('review unit schema dimensions are outside finite bound');
  return {
    type: 'json_schema',
    json_schema: {
      name: 'candidate_review_unit_ballot',
      strict: true,
      schema: {
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
          candidateId: {
            type: 'string',
            enum: [candidate.candidateId,],
          },
          candidateDigest: {
            type: 'string',
            enum: [candidate.candidateDigest,],
          },
          obligationStatuses: {
            type: 'string',
            minLength: ledger.obligations
              .length,
            maxLength: ledger.obligations
              .length,
          },
          globalStatuses: {
            type: 'string',
            minLength: REALIZATION_GLOBAL_CRITERIA.length,
            maxLength: REALIZATION_GLOBAL_CRITERIA.length,
          },
          overflow: { type: 'boolean', },
          findings: {
            type: 'array',
            minItems: 0,
            maxItems: REVIEW_UNIT_FINDING_CAP,
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
                scope: {
                  type: 'string',
                  enum: [
                    'o',
                    'g',
                  ],
                },
                manifestIndex: {
                  type: 'integer',
                  minimum: 0,
                  maximum: Math.max(
                    ledger.obligations
                      .length,
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
                  items: TARGET_ANCHOR_SCHEMA,
                },
              },
            },
          },
        },
      },
    },
  };
}
