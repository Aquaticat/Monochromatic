// PROTOTYPE ONLY: Candidate M exact risk-attested author boundary.

import { hashContent, } from './document-node.ts';
import { isJsonRecord, } from './json-guard.ts';
import { leanRealizationGuard, } from './prototype-lean-realization-wire.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import {
  CANDIDATE_M_RISK_CODE,
  CANDIDATE_M_RISK_KEYS,
  type CandidateMAuthorResponse,
  type CandidateMGuardFailure,
  type CandidateMRiskAttestations,
} from './prototype-risk-challenger-model.ts';
import {
  MAX_SLOT_CHARACTERS,
  type ImmutableShell,
} from './prototype-slot-model.ts';
import type { JsonSchemaResponseFormat, } from './chat-contract.ts';

/**
 * Candidate M exact attestation-policy identity.
 */
export const CANDIDATE_M_RISK_POLICY_DIGEST: string = hashContent({
  content: JSON.stringify({
    keys: CANDIDATE_M_RISK_KEYS,
    code: CANDIDATE_M_RISK_CODE,
    order: 'exact-object-key-order',
    selectionEffect: 'none',
  },),
});

/**
 * Creates exact six-key risk-attestation object.
 *
 * @returns Manifest-order fixture and runtime policy object
 *
 * @example
 * ```ts
 * const attestations = candidateMRiskAttestations();
 * ```
 */
export function candidateMRiskAttestations(): CandidateMRiskAttestations {
  return {
    actorAttribution: CANDIDATE_M_RISK_CODE,
    eventOwnershipSequence: CANDIDATE_M_RISK_CODE,
    temporalPronominalReference: CANDIDATE_M_RISK_CODE,
    unsupportedEmphasis: CANDIDATE_M_RISK_CODE,
    sourceImageRelation: CANDIDATE_M_RISK_CODE,
    memorialRegisterContributorVoice: CANDIDATE_M_RISK_CODE,
  };
}

/**
 * Exact canonical six-key attestation object identity.
 */
export const CANDIDATE_M_RISK_ATTESTATION_DIGEST: string = hashContent({
  content: JSON.stringify(candidateMRiskAttestations(),),
});

/**
 * Builds strict Candidate M author response schema.
 *
 * @returns Exact 27-value plus six-attestation response format
 *
 * @example
 * ```ts
 * const format = riskAttestedAuthorResponseFormat({ shell, reviewPlan, });
 * ```
 */
export function riskAttestedAuthorResponseFormat({
  shell,
  reviewPlan,
}: {
  readonly shell: ImmutableShell;
  readonly reviewPlan: ReviewUnitPlan;
}): JsonSchemaResponseFormat {
  /**
   * Exact mutable publication keys.
   */
  const mutableKeys = [
    ...reviewPlan.frontMatterSubjects
      .map(function key(subject,) {
      return subject.targetSlotKey;
    },),
    ...shell.slots
      .map(function key(slot,) { return slot.key; }),
  ];
  /**
   * Exact string schema for every publication value.
   */
  const slotProperties = Object.fromEntries(mutableKeys.map(function property(key,) {
    return [
      key,
      {
        type: 'string',
        minLength: 1,
        maxLength: MAX_SLOT_CHARACTERS,
      },
    ];
  },),);
  /**
   * Sole-code schema in manifest key order.
   */
  const attestationProperties = Object.fromEntries(CANDIDATE_M_RISK_KEYS.map(function property(key,) {
    return [
      key,
      {
        type: 'string',
        enum: [CANDIDATE_M_RISK_CODE,],
      },
    ];
  },),);
  return {
    type: 'json_schema',
    json_schema: {
      name: 'risk_attested_realization',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: [
          'slots',
          'riskAttestations',
        ],
        properties: {
          slots: {
            type: 'object',
            additionalProperties: false,
            required: mutableKeys,
            properties: slotProperties,
          },
          riskAttestations: {
            type: 'object',
            additionalProperties: false,
            required: CANDIDATE_M_RISK_KEYS,
            properties: attestationProperties,
          },
        },
      },
    },
  };
}

/**
 * Diagnoses exact Candidate M author caller boundary.
 *
 * @returns Privacy-safe guard failure or explicit acceptance
 *
 * @example
 * ```ts
 * const diagnosis = diagnoseRiskAttestedAuthorResponse({ value, shell, reviewPlan, });
 * ```
 */
export function diagnoseRiskAttestedAuthorResponse({
  value,
  shell,
  reviewPlan,
}: {
  readonly value: unknown;
  readonly shell: ImmutableShell;
  readonly reviewPlan: ReviewUnitPlan;
}): { readonly kind: 'accepted' } | {
  readonly kind: 'rejected';
  readonly failure: CandidateMGuardFailure;
} {
  if ((!isJsonRecord(value,))
    || (JSON.stringify(Object.keys(value,)
      .toSorted(),) !== JSON.stringify([
      'riskAttestations',
      'slots',
    ],)))
    return {
      kind: 'rejected',
      failure: 'key-set',
    };
  if (!leanRealizationGuard({
    shell,
    reviewPlan,
  })({ slots: value.slots, },))
    return {
      kind: 'rejected',
      failure: 'key-set',
    };
  /**
   * Untrusted risk-attestation object after outer key proof.
   */
  const { riskAttestations, } = value;
  if (!isJsonRecord(riskAttestations,))
    return {
      kind: 'rejected',
      failure: 'attestation-key-order',
    };
  if (JSON.stringify(Object.keys(riskAttestations,),)
    !== JSON.stringify(CANDIDATE_M_RISK_KEYS,))
    return {
      kind: 'rejected',
      failure: 'attestation-key-order',
    };
  if (CANDIDATE_M_RISK_KEYS.some(function differs(key,) {
    return riskAttestations[key] !== CANDIDATE_M_RISK_CODE;
  },))
    return {
      kind: 'rejected',
      failure: 'attestation-code',
    };
  return { kind: 'accepted', };
}

/**
 * Captures exact Candidate M author response guard.
 *
 * @returns Type guard bound to shell and review plan
 *
 * @example
 * ```ts
 * const valid = riskAttestedAuthorGuard({ shell, reviewPlan, })(value);
 * ```
 */
export function riskAttestedAuthorGuard({
  shell,
  reviewPlan,
}: {
  readonly shell: ImmutableShell;
  readonly reviewPlan: ReviewUnitPlan;
}): (value: unknown) => value is CandidateMAuthorResponse {
  return function valid(value: unknown): value is CandidateMAuthorResponse {
    return diagnoseRiskAttestedAuthorResponse({
      value,
      shell,
      reviewPlan,
    })
      .kind
      === 'accepted';
  };
}
