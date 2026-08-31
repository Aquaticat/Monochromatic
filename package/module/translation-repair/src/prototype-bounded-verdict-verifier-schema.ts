// PROTOTYPE ONLY: Candidate H compact complete verifier schema.

import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import { CONDITIONAL_DEFECT_CLASSES, } from './prototype-conditional-audit-model.ts';
import {
  BOUNDED_VERDICT_FINDING_CAP,
  type BoundedCandidate,
} from './prototype-bounded-verdict-model.ts';
import {
  MAX_REALIZATION_CANDIDATES,
  MAX_REALIZATION_FINDING_ANCHORS,
  MAX_REALIZATION_OBLIGATIONS,
  REALIZATION_GLOBAL_CRITERIA,
  type RealizationObligationLedger,
} from './prototype-realization-model.ts';

/**
 * Strict schema shared by exact UTF-16 target anchors.
 */
const BOUNDED_TARGET_ANCHOR_SCHEMA = {
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
 * Builds strict all-candidate status and bounded-finding schema.
 *
 * @returns Schema whose dimensions bind exact candidate and ledger sets
 *
 * @example
 * ```ts
 * const format = boundedVerifierResponseFormat({ ledger, candidates, });
 * ```
 */
export function boundedVerifierResponseFormat({
  ledger,
  candidates,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly candidates: readonly BoundedCandidate[];
}): JsonSchemaResponseFormat {
  if ((candidates.length === 0)
    || (candidates.length > MAX_REALIZATION_CANDIDATES)
    || (ledger.obligations
      .length
      === 0)
    || (ledger.obligations
      .length
      > MAX_REALIZATION_OBLIGATIONS))
    throw new Error('bounded verifier schema dimensions are outside finite bound');

  /**
   * Anonymous aliases authorized in each complete matrix.
   */
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
                candidateId: {
                  type: 'string',
                  enum: candidateIds,
                },
                candidateDigest: {
                  type: 'string',
                  minLength: 64,
                  maxLength: 64,
                },
                obligationStatuses: {
                  type: 'array',
                  minItems: ledger.obligations
                    .length,
                  maxItems: ledger.obligations
                    .length,
                  items: {
                    type: 'string',
                    enum: [
                      'p',
                      'd',
                    ],
                  },
                },
                globalStatuses: {
                  type: 'array',
                  minItems: REALIZATION_GLOBAL_CRITERIA.length,
                  maxItems: REALIZATION_GLOBAL_CRITERIA.length,
                  items: {
                    type: 'string',
                    enum: [
                      'c',
                      'd',
                    ],
                  },
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
