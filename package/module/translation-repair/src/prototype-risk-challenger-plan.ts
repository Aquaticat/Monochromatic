// PROTOTYPE ONLY: Candidate M static role-split challenger plan.

import { hashContent, } from './document-node.ts';
import { leanVerifierEvidence, } from './prototype-lean-realization-verifier-evidence.ts';
import type { CandidateMManifest, } from './prototype-risk-challenger-manifest-model.ts';
import type {
  CandidateMChallengerRole,
  CandidateMCandidate,
} from './prototype-risk-challenger-model.ts';
import { riskChallengeResponseFormat, } from './prototype-risk-challenger-schema.ts';
import type { CandidateMAuthorSettlement, } from './prototype-risk-challenger-settlement.ts';
import type { ReviewUnitVerifierPlan, } from './prototype-review-unit-model.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';

/**
 * One static Candidate M candidate, family, and role node.
 */
export type CandidateMChallengerPlanNode = {
  readonly candidateOrdinal: number;
  readonly verifierOrdinal: number;
  readonly verifierModelId: ReviewUnitVerifierPlan['modelId'];
  readonly role: CandidateMChallengerRole;
  readonly state: 'dispatch' | 'skipped-author-unusable';
  readonly sourceReviewPlanDigest?: string;
  readonly schemaDigest?: string;
};

/**
 * Complete static Candidate M challenger wave.
 */
export type CandidateMChallengerPlan = {
  readonly version: 1;
  readonly manifestDigest: string;
  readonly authorSettlementDigest: string;
  readonly nodes: readonly CandidateMChallengerPlanNode[];
  readonly challengerPlanDigest: string;
};

/**
 * Refuses challenger dispatch when independently rebuilt bindings differ.
 *
 * @param node - Persisted static dispatch row
 *
 * @param sourceReviewPlanDigest - Independently rebuilt source projection
 *
 * @param schemaDigest - Independently rebuilt forced-tool schema
 *
 * @throws Error when source projection or schema differs
 *
 * @example
 * ```ts
 * assertCandidateMChallengerBinding({ node, sourceReviewPlanDigest, schemaDigest, });
 * ```
 */
export function assertCandidateMChallengerBinding({
  node,
  sourceReviewPlanDigest,
  schemaDigest,
}: {
  readonly node: CandidateMChallengerPlanNode;
  readonly sourceReviewPlanDigest: string;
  readonly schemaDigest: string;
}): void {
  if ((sourceReviewPlanDigest !== node.sourceReviewPlanDigest)
    || (schemaDigest !== node.schemaDigest))
    throw new Error('Candidate M source plan or schema digest differs');
}

/**
 * Digests challenger plan without self member.
 *
 * @param value - Static second-wave identity before self digest
 *
 * @returns Canonical static second-wave identity
 */
function planDigest(value: Omit<CandidateMChallengerPlan, 'challengerPlanDigest'>,): string {
  return hashContent({ content: JSON.stringify(value,), });
}

/**
 * Creates every candidate, verifier, and role node before second-wave dispatch.
 *
 * @returns Twelve static dispatch or skip rows
 *
 * @example
 * ```ts
 * const plan = createCandidateMChallengerPlan({ manifest, authorSettlement, candidates, reviewPlan, pictureCount: 1, });
 * ```
 */
export function createCandidateMChallengerPlan({
  manifest,
  authorSettlement,
  candidates,
  reviewPlan,
  pictureCount,
}: {
  readonly manifest: CandidateMManifest;
  readonly authorSettlement: CandidateMAuthorSettlement;
  readonly candidates: readonly CandidateMCandidate[];
  readonly reviewPlan: ReviewUnitPlan;
  readonly pictureCount: number;
}): CandidateMChallengerPlan {
  /**
   * Candidate lookup by public ordinal.
   */
  const byOrdinal = new Map(candidates.map(function candidate(value,) {
    return [
      value.candidateOrdinal,
      value,
    ] as const;
  },),);
  /**
   * Twelve static candidate, verifier, and role rows.
   */
  const nodes = manifest.candidatePlan
    .flatMap(function author(authorPlan,) {
    /**
     * Complete candidate satisfying static author dependency.
     */
    const candidate = byOrdinal.get(authorPlan.ordinal,);
    return manifest.verifierPlan
      .flatMap(function verifier(verifierPlan,) {
      return manifest.challengerRoles
        .map(function challengeRole(roleName,): CandidateMChallengerPlanNode {
        if (candidate === undefined) {
          return {
            candidateOrdinal: authorPlan.ordinal,
            verifierOrdinal: verifierPlan.ordinal,
            verifierModelId: verifierPlan.modelId,
            role: roleName,
            state: 'skipped-author-unusable',
          };
        }
        /**
         * Source-only complete review-plan projection.
         */
        const projected = leanVerifierEvidence({
          reviewPlan,
          candidate,
        },);
        /**
         * Exact role and candidate response format.
         */
        const format = riskChallengeResponseFormat({
          candidate,
          reviewPlan,
          role: roleName,
          sourceReviewPlanDigest: projected.sourceReviewPlanDigest,
          pictureCount,
        },);
        return {
          candidateOrdinal: authorPlan.ordinal,
          verifierOrdinal: verifierPlan.ordinal,
          verifierModelId: verifierPlan.modelId,
          role: roleName,
          state: 'dispatch',
          sourceReviewPlanDigest: projected.sourceReviewPlanDigest,
          schemaDigest: hashContent({ content: JSON.stringify(format,), }),
        };
      },);
    },);
  },);
  /**
   * Challenger plan identity before self digest.
   */
  const identity = {
    version: 1,
    manifestDigest: manifest.manifestDigest,
    authorSettlementDigest: authorSettlement.settlementDigest,
    nodes,
  } as const;
  return {
    ...identity,
    challengerPlanDigest: planDigest(identity,),
  };
}
