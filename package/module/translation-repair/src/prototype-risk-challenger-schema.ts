// PROTOTYPE ONLY: Candidate M bounded first-defect response schema.

import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import {
  CANDIDATE_M_MAX_FINDING_EVIDENCE,
  type CandidateMChallengerRole,
  type CandidateMCandidate,
} from './prototype-risk-challenger-model.ts';
import { candidateMDefectClassesForRole, } from './prototype-risk-challenger-rules.ts';

/**
 * Exact UTF-16 candidate substring anchor schema.
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
      maxLength: 64,
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
 * Builds Candidate M clean-or-one-defect schema.
 *
 * Broad evidence arrays remain schema-bounded while executable per-class cardinality travels in prompt rules and caller guard.
 *
 * @returns Exact candidate and role-bound forced-tool response format
 *
 * @example
 * ```ts
 * const format = riskChallengeResponseFormat({ candidate, reviewPlan, role, pictureCount: 1, });
 * ```
 */
export function riskChallengeResponseFormat({
  candidate,
  reviewPlan,
  role,
  sourceReviewPlanDigest,
  pictureCount,
}: {
  readonly candidate: CandidateMCandidate;
  readonly reviewPlan: ReviewUnitPlan;
  readonly role: CandidateMChallengerRole;
  readonly sourceReviewPlanDigest: string;
  readonly pictureCount: number;
}): JsonSchemaResponseFormat {
  if ((!Number.isInteger(pictureCount,)) || (pictureCount < 0))
    throw new Error('risk challenger picture count differs');
  /**
   * Highest source subject index admitted before scope-specific guard.
   */
  const maxSourceIndex = Math.max(
    reviewPlan.frontMatterSubjects
      .length,
    reviewPlan.clauses
      .length,
    reviewPlan.relations
      .length,
  ) - 1;
  /**
   * Highest manifested image index.
   */
  const maxImageIndex = Math.max(
    0,
    pictureCount - 1,
  );
  return {
    type: 'json_schema',
    json_schema: {
      name: `risk_challenge_${role === 'fidelity' ? 'fidelity' : 'language'}`,
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: [
          'candidateId',
          'candidateDigest',
          'deterministicProofDigest',
          'sourceReviewPlanDigest',
          'role',
          'verdict',
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
          deterministicProofDigest: {
            type: 'string',
            enum: [candidate.deterministicProofDigest,],
          },
          sourceReviewPlanDigest: {
            type: 'string',
            enum: [sourceReviewPlanDigest,],
          },
          role: {
            type: 'string',
            enum: [role,],
          },
          verdict: {
            type: 'string',
            enum: [
              'clean',
              'defect',
            ],
          },
          findings: {
            type: 'array',
            minItems: 0,
            maxItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'defectClass',
                'sourceEvidence',
                'targetAnchors',
                'imageEvidenceIndexes',
              ],
              properties: {
                defectClass: {
                  type: 'string',
                  enum: candidateMDefectClassesForRole(role,),
                },
                sourceEvidence: {
                  type: 'array',
                  minItems: 0,
                  maxItems: CANDIDATE_M_MAX_FINDING_EVIDENCE,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: [
                      'scope',
                      'subjectIndex',
                    ],
                    properties: {
                      scope: {
                        type: 'string',
                        enum: [
                          'front-matter',
                          'clause',
                          'relation',
                        ],
                      },
                      subjectIndex: {
                        type: 'integer',
                        minimum: 0,
                        maximum: Math.max(
                          0,
                          maxSourceIndex,
                        ),
                      },
                    },
                  },
                },
                targetAnchors: {
                  type: 'array',
                  minItems: 0,
                  maxItems: CANDIDATE_M_MAX_FINDING_EVIDENCE,
                  items: TARGET_ANCHOR_SCHEMA,
                },
                imageEvidenceIndexes: {
                  type: 'array',
                  minItems: 0,
                  maxItems: Math.max(
                    1,
                    pictureCount,
                  ),
                  items: {
                    type: 'integer',
                    minimum: 0,
                    maximum: maxImageIndex,
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
