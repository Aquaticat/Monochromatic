// PROTOTYPE ONLY: Candidate M risk-bound complete candidate admission.

import { hashContent, } from './document-node.ts';
import {
  admitFrontMatterRealizationResponse,
} from './prototype-lean-realization-author.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import {
  CANDIDATE_M_ARCHITECTURE,
  CANDIDATE_M_MANIFEST_VERSION,
  CANDIDATE_M_RISK_CODE,
  CANDIDATE_M_RISK_KEYS,
  type CandidateMAuthorResponse,
  type CandidateMCandidate,
  type CandidateMRiskAttestations,
} from './prototype-risk-challenger-model.ts';
import type { CandidateMManifest, } from './prototype-risk-challenger-manifest-model.ts';
import type { RealizationCandidatePlan, } from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/**
 * Canonical risk-attestation digest.
 *
 * @param attestations - Exact manifest-order author evidence
 *
 * @returns Digest preserving manifest-owned object order
 */
function riskDigest(attestations: CandidateMRiskAttestations,): string {
  return hashContent({ content: JSON.stringify(attestations,), });
}

/**
 * Candidate M proof binding base mechanical proof to attention evidence.
 *
 * @returns Risk-bound proof digest
 */
function riskProofDigest({
  manifest,
  baseDeterministicProofDigest,
  riskAttestationDigest,
}: {
  readonly manifest: CandidateMManifest;
  readonly baseDeterministicProofDigest: string;
  readonly riskAttestationDigest: string;
}): string {
  return hashContent({ content: JSON.stringify({
    architecture: manifest.architecture,
    manifestVersion: manifest.version,
    manifestDigest: manifest.manifestDigest,
    riskPolicyDigest: manifest.riskPolicyDigest,
    baseDeterministicProofDigest,
    riskAttestationDigest,
  },), });
}

/**
 * Candidate identity excluding self digest.
 *
 * @param candidate - Risk-bound identity before self digest
 *
 * @returns Risk-bound complete candidate digest
 */
function candidateDigest(
  candidate: Omit<CandidateMCandidate, 'candidateDigest'>,
): string {
  return hashContent({ content: JSON.stringify(candidate,), });
}

/**
 * Refuses unordered or noncanonical attestation object after parsing.
 *
 * @param attestations - Exact untrusted author evidence
 */
function assertRiskAttestations(attestations: CandidateMRiskAttestations,): void {
  if ((JSON.stringify(Object.keys(attestations,),)
    !== JSON.stringify(CANDIDATE_M_RISK_KEYS,))
    || CANDIDATE_M_RISK_KEYS.some(function code(key,) {
      return attestations[key] !== CANDIDATE_M_RISK_CODE;
    },))
    throw new Error('risk challenger attestation order or code differs');
}

/**
 * Admits one Candidate M risk-attested author response.
 *
 * @returns Complete immutable-shell candidate with risk-bound identity
 *
 * @example
 * ```ts
 * const candidate = admitRiskAttestedAuthorResponse({ response, shell, manifest, reviewPlan, plan, sourceText, archiveText, sourcePictures, });
 * ```
 */
export function admitRiskAttestedAuthorResponse({
  response,
  shell,
  manifest,
  reviewPlan,
  plan,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly response: CandidateMAuthorResponse;
  readonly shell: ImmutableShell;
  readonly manifest: CandidateMManifest;
  readonly reviewPlan: ReviewUnitPlan;
  readonly plan: RealizationCandidatePlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): CandidateMCandidate {
  if ((manifest.version !== CANDIDATE_M_MANIFEST_VERSION)
    || (manifest.architecture !== CANDIDATE_M_ARCHITECTURE)
    || (manifest.authorMode !== 'risk-challenger'))
    throw new Error('risk challenger manifest identity differs');
  assertRiskAttestations(response.riskAttestations,);
  /**
   * Base deterministic candidate before selection-blind risk binding.
   */
  const base = admitFrontMatterRealizationResponse({
    response: { slots: response.slots, },
    shell,
    manifest,
    reviewPlan,
    plan,
    sourceText,
    archiveText,
    sourcePictures,
  });
  /**
   * Canonical exact risk object digest.
   */
  const riskAttestationDigest = riskDigest(response.riskAttestations,);
  if (riskAttestationDigest !== manifest.riskAttestationDigest)
    throw new Error('risk challenger attestation digest differs');
  /**
   * Risk-bound identity before self digest.
   */
  const identity: Omit<CandidateMCandidate, 'candidateDigest'> = {
    ...base,
    baseCandidateDigest: base.candidateDigest,
    baseDeterministicProofDigest: base.deterministicProofDigest,
    riskAttestations: response.riskAttestations,
    riskAttestationDigest,
    deterministicProofDigest: riskProofDigest({
      manifest,
      baseDeterministicProofDigest: base.deterministicProofDigest,
      riskAttestationDigest,
    }),
  };
  return {
    ...identity,
    candidateDigest: candidateDigest(identity,),
  };
}

/**
 * Revalidates one persisted Candidate M candidate from raw slots and risk evidence.
 *
 * @example
 * ```ts
 * assertRiskAttestedCandidate({ candidate, shell, manifest, reviewPlan, sourceText, archiveText, sourcePictures, });
 * ```
 */
export function assertRiskAttestedCandidate({
  candidate,
  shell,
  manifest,
  reviewPlan,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly candidate: CandidateMCandidate;
  readonly shell: ImmutableShell;
  readonly manifest: CandidateMManifest;
  readonly reviewPlan: ReviewUnitPlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): void {
  /**
   * Candidate recomputed from raw values and risk evidence.
   */
  const expected = admitRiskAttestedAuthorResponse({
    response: {
      slots: candidate.rawSlots,
      riskAttestations: candidate.riskAttestations,
    },
    shell,
    manifest,
    reviewPlan,
    plan: {
      ordinal: candidate.candidateOrdinal,
      modelId: candidate.modelId,
      priority: candidate.priority,
    },
    sourceText,
    archiveText,
    sourcePictures,
  });
  if (JSON.stringify(candidate,) !== JSON.stringify(expected,))
    throw new Error('risk challenger candidate binding differs');
}
