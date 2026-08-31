// PROTOTYPE ONLY: Candidate K readable review-unit ballot schema.

import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import {
  REVIEW_UNIT_DEFECT_CLASSES,
  REVIEW_UNIT_FINDING_CAP,
  type ReviewUnitCandidate,
} from './prototype-review-unit-model.ts';
import {
  MAX_REVIEW_UNIT_CLAUSES,
  MAX_REVIEW_UNIT_RELATIONS,
  MAX_REVIEW_UNIT_SLOT_GROUPS,
  type ReviewUnitPlan,
} from './prototype-review-unit-plan.ts';
import { MAX_REALIZATION_FINDING_ANCHORS, } from './prototype-realization-model.ts';

/** Strict schema for exact UTF-16 target anchors. */
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
 * Builds strict candidate-scoped readable review-unit schema.
 *
 * @returns Schema binding exact candidate, proof, and plan dimensions
 *
 * @example
 * ```ts
 * const format = reviewUnitResponseFormat({ reviewPlan, candidate, pictureCount: 1, });
 * ```
 */
export function reviewUnitResponseFormat({
  reviewPlan,
  candidate,
  pictureCount,
}: {
  readonly reviewPlan: ReviewUnitPlan;
  readonly candidate: ReviewUnitCandidate;
  readonly pictureCount: number;
}): JsonSchemaResponseFormat {
  if ((reviewPlan.clauses.length === 0)
    || (reviewPlan.clauses.length > MAX_REVIEW_UNIT_CLAUSES)
    || (reviewPlan.slotGroups.length === 0)
    || (reviewPlan.slotGroups.length > MAX_REVIEW_UNIT_SLOT_GROUPS)
    || (reviewPlan.relations.length > MAX_REVIEW_UNIT_RELATIONS)
    || (!Number.isInteger(pictureCount,))
    || (pictureCount < 0))
    throw new Error('review unit schema dimensions are outside finite bound');
  /** Highest evidence index accepted by integer schema. */
  const maxSourceEvidenceIndex = Math.max(0, reviewPlan.sourceEvidence.length - 1,);
  /** Highest image index accepted by integer schema. */
  const maxImageEvidenceIndex = Math.max(0, pictureCount - 1,);
  /** Highest subject index across review scopes. */
  const maxSubjectIndex = Math.max(
    reviewPlan.frontMatterSubjects.length,
    reviewPlan.clauses.length,
    reviewPlan.relations.length,
    reviewPlan.slotGroups.length,
    reviewPlan.globalCriteria.length,
  ) - 1;
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
          'reviewPlanDigest',
          'deterministicProofDigest',
          'frontMatterStatuses',
          'clauseStatusesBySlot',
          'relationStatuses',
          'slotLanguageStatuses',
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
          reviewPlanDigest: {
            type: 'string',
            enum: [reviewPlan.reviewPlanDigest,],
          },
          deterministicProofDigest: {
            type: 'string',
            enum: [candidate.deterministicProofDigest,],
          },
          frontMatterStatuses: {
            type: 'string',
            minLength: reviewPlan.frontMatterSubjects.length,
            maxLength: reviewPlan.frontMatterSubjects.length,
          },
          clauseStatusesBySlot: {
            type: 'array',
            minItems: reviewPlan.slotGroups.length,
            maxItems: reviewPlan.slotGroups.length,
            items: {
              type: 'string',
              minLength: 1,
              maxLength: MAX_REVIEW_UNIT_CLAUSES,
            },
          },
          relationStatuses: {
            type: 'string',
            minLength: reviewPlan.relations.length,
            maxLength: reviewPlan.relations.length,
          },
          slotLanguageStatuses: {
            type: 'string',
            minLength: reviewPlan.slotGroups.length,
            maxLength: reviewPlan.slotGroups.length,
          },
          globalStatuses: {
            type: 'string',
            minLength: reviewPlan.globalCriteria.length,
            maxLength: reviewPlan.globalCriteria.length,
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
                'subjectIndex',
                'defectClassIndex',
                'sourceEvidenceIndexes',
                'imageEvidenceIndexes',
                'targetAnchors',
              ],
              properties: {
                scope: {
                  type: 'string',
                  enum: [
                    'fm',
                    'c',
                    'r',
                    'sl',
                    'g',
                  ],
                },
                subjectIndex: {
                  type: 'integer',
                  minimum: 0,
                  maximum: maxSubjectIndex,
                },
                defectClassIndex: {
                  type: 'integer',
                  minimum: 0,
                  maximum: REVIEW_UNIT_DEFECT_CLASSES.length - 1,
                },
                sourceEvidenceIndexes: {
                  type: 'array',
                  minItems: 0,
                  maxItems: 4,
                  items: {
                    type: 'integer',
                    minimum: 0,
                    maximum: maxSourceEvidenceIndex,
                  },
                },
                imageEvidenceIndexes: {
                  type: 'array',
                  minItems: 0,
                  maxItems: Math.max(1, pictureCount,),
                  items: {
                    type: 'integer',
                    minimum: 0,
                    maximum: maxImageEvidenceIndex,
                  },
                },
                targetAnchors: {
                  type: 'array',
                  minItems: 0,
                  maxItems: Math.max(4, MAX_REALIZATION_FINDING_ANCHORS,),
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
