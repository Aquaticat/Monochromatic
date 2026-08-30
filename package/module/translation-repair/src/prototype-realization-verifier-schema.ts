// PROTOTYPE ONLY: Candidate G bounded verifier JSON schema.

import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import { CONDITIONAL_DEFECT_CLASSES, } from './prototype-conditional-audit-model.ts';
import {
  MAX_REALIZATION_CANDIDATES,
  MAX_REALIZATION_FINDING_ANCHORS,
  MAX_REALIZATION_FINDINGS,
  MAX_REALIZATION_OBLIGATIONS,
  MAX_REALIZATION_TARGET_ANCHORS,
  REALIZATION_GLOBAL_CRITERIA,
  type RealizationObligationLedger,
  type RealizedCandidate,
} from './prototype-realization-model.ts';

//region Schema

/**
 * JSON schema for one exact target range cited by verifier.
 */
const VERIFIER_TARGET_ANCHOR_SCHEMA = {
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
 * JSON schema for bounded target ranges in one finding.
 */
const FINDING_TARGET_ANCHORS_SCHEMA = {
  type: 'array',
  minItems: 0,
  maxItems: MAX_REALIZATION_FINDING_ANCHORS,
  items: VERIFIER_TARGET_ANCHOR_SCHEMA,
} as const;

/**
 * Builds strict full-matrix verifier schema from one manifest.
 */
export function realizationVerifierResponseFormat({
  ledger,
  candidates,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly candidates: readonly RealizedCandidate[];
}): JsonSchemaResponseFormat {
  if ((candidates.length === 0) || (candidates.length > MAX_REALIZATION_CANDIDATES))
    throw new Error('realization verifier candidate count is outside finite bound');
  if ((ledger.obligations
    .length
    === 0) || (ledger.obligations
      .length
      > MAX_REALIZATION_OBLIGATIONS))
    throw new Error('realization verifier obligation count is outside finite bound');
  const candidateIds = candidates.map(function id(candidate,) { return candidate.candidateId; },);
  const obligationIds = ledger.obligations
    .map(function id(obligation,) { return obligation.id; },);
  if ((new Set(candidateIds,).size !== candidateIds.length)
    || (new Set(obligationIds,).size !== obligationIds.length))
    throw new Error('realization verifier schema manifest identity repeats');
  return {
    type: 'json_schema',
    json_schema: {
      name: 'verified_realization_ballot',
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
                'obligations',
                'globalChecks',
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
                obligations: {
                  type: 'array',
                  minItems: obligationIds.length,
                  maxItems: obligationIds.length,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: [
                      'obligationId',
                      'obligationEvidenceDigest',
                      'status',
                      'verifiedTargetAnchors',
                    ],
                    properties: {
                      obligationId: {
                        type: 'string',
                        enum: obligationIds,
                      },
                      obligationEvidenceDigest: {
                        type: 'string',
                        minLength: 64,
                        maxLength: 64,
                      },
                      status: {
                        type: 'string',
                        enum: [
                          'preserved',
                          'defect',
                        ],
                      },
                      verifiedTargetAnchors: {
                        type: 'array',
                        minItems: 0,
                        maxItems: MAX_REALIZATION_TARGET_ANCHORS,
                        items: VERIFIER_TARGET_ANCHOR_SCHEMA,
                      },
                    },
                  },
                },
                globalChecks: {
                  type: 'array',
                  minItems: REALIZATION_GLOBAL_CRITERIA.length,
                  maxItems: REALIZATION_GLOBAL_CRITERIA.length,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: [
                      'criterion',
                      'status',
                    ],
                    properties: {
                      criterion: {
                        type: 'string',
                        enum: REALIZATION_GLOBAL_CRITERIA,
                      },
                      status: {
                        type: 'string',
                        enum: [
                          'clean',
                          'defect',
                        ],
                      },
                    },
                  },
                },
                findings: {
                  type: 'array',
                  minItems: 0,
                  maxItems: MAX_REALIZATION_FINDINGS,
                  items: {
                    oneOf: [
                      {
                        type: 'object',
                        additionalProperties: false,
                        required: [
                          'scope',
                          'obligationId',
                          'defectClass',
                          'targetAnchors',
                        ],
                        properties: {
                          scope: { const: 'obligation', },
                          obligationId: {
                            type: 'string',
                            enum: obligationIds,
                          },
                          defectClass: {
                            type: 'string',
                            enum: CONDITIONAL_DEFECT_CLASSES,
                          },
                          targetAnchors: FINDING_TARGET_ANCHORS_SCHEMA,
                        },
                      },
                      {
                        type: 'object',
                        additionalProperties: false,
                        required: [
                          'scope',
                          'criterion',
                          'defectClass',
                          'targetAnchors',
                        ],
                        properties: {
                          scope: { const: 'global', },
                          criterion: {
                            type: 'string',
                            enum: REALIZATION_GLOBAL_CRITERIA,
                          },
                          defectClass: {
                            type: 'string',
                            enum: CONDITIONAL_DEFECT_CLASSES,
                          },
                          targetAnchors: FINDING_TARGET_ANCHORS_SCHEMA,
                        },
                      },
                    ],
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

//endregion Schema
