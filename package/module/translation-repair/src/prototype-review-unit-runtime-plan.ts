// PROTOTYPE ONLY: Candidate K static verifier Cartesian plan settlement.

import { hashContent, } from './document-node.ts';
import type {
  ReviewUnitAuthorSettlement,
  ReviewUnitCandidate,
  ReviewUnitManifest,
} from './prototype-review-unit-model.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import { reviewUnitResponseFormat, } from './prototype-review-unit-schema.ts';

/**
 * One of nine statically manifested candidate and verifier nodes.
 */
export type ReviewUnitVerifierNodePlan = {
  /**
   * Author ordinal owning candidate dependency.
   */
  readonly candidateOrdinal: number;
  /**
   * Verifier ordinal owning model identity.
   */
  readonly verifierOrdinal: number;
  /**
   * Canonical verifier identity.
   */
  readonly verifierModelId: ReviewUnitManifest['verifierPlan'][number]['modelId'];
} & (
  | {
    /**
     * Node dispatches because complete candidate exists.
     */
    readonly state: 'dispatch';
    /**
     * Admitted candidate alias.
     */
    readonly candidateId: string;
    /**
     * Admitted candidate digest.
     */
    readonly candidateDigest: string;
    /**
     * Candidate deterministic-proof identity.
     */
    readonly deterministicProofDigest: string;
    /**
     * Exact candidate-scoped schema digest.
     */
    readonly verifierSchemaDigest: string;
  }
  | {
    /**
     * Node has no effect because author dependency is unusable.
     */
    readonly state: 'skipped-author-unusable';
  }
);

/**
 * Immutable second-wave plan with all potential nodes.
 */
export type ReviewUnitVerifierWavePlan = {
  /**
   * Manifest binding.
   */
  readonly manifestDigest: string;
  /**
   * Total author settlement binding.
   */
  readonly authorSettlementDigest: string;
  /**
   * Nine statically finite node rows.
   */
  readonly nodes: readonly ReviewUnitVerifierNodePlan[];
  /**
   * Readable review-plan binding.
   */
  readonly reviewPlanDigest: string;
  /**
   * Verifier protocol binding.
   */
  readonly verifierProtocolDigest: string;
  /**
   * Finding capacity binding.
   */
  readonly findingCap: number;
  /**
   * Self digest.
   */
  readonly verifierPlanDigest: string;
};

/**
 * Builds nine-row verifier plan before dispatching any verifier.
 *
 * @returns Immutable static second-wave plan
 *
 * @example
 * ```ts
 * const plan = createReviewUnitVerifierWavePlan({
 *   manifest,
 *   authorSettlement,
 *   candidates,
 *   reviewPlan,
 * });
 * ```
 */
export function createReviewUnitVerifierWavePlan({
  manifest,
  authorSettlement,
  candidates,
  reviewPlan,
}: {
  readonly manifest: ReviewUnitManifest;
  readonly authorSettlement: ReviewUnitAuthorSettlement;
  readonly candidates: readonly ReviewUnitCandidate[];
  readonly reviewPlan: ReviewUnitPlan;
}): ReviewUnitVerifierWavePlan {
  /**
   * Candidate lookup by manifested author ordinal.
   */
  const byOrdinal = new Map(candidates.map(function candidate(value,) {
    return [
      value.candidateOrdinal,
      value,
    ] as const;
  },),);
  /**
   * Every potential Cartesian verifier node in stable author-major order.
   */
  const nodes = manifest.candidatePlan
    .flatMap(function candidateNodes(authorPlan,) {
    /**
     * Admitted candidate satisfying this author dependency.
     */
    const candidate = byOrdinal.get(authorPlan.ordinal,);
    return manifest.verifierPlan
      .map(function verifierNode(verifierPlan,) {
      if (candidate === undefined) {
        return {
          candidateOrdinal: authorPlan.ordinal,
          verifierOrdinal: verifierPlan.ordinal,
          verifierModelId: verifierPlan.modelId,
          state: 'skipped-author-unusable' as const,
        };
      }
      return {
        candidateOrdinal: authorPlan.ordinal,
        verifierOrdinal: verifierPlan.ordinal,
        verifierModelId: verifierPlan.modelId,
        state: 'dispatch' as const,
        candidateId: candidate.candidateId,
        candidateDigest: candidate.candidateDigest,
        deterministicProofDigest: candidate.deterministicProofDigest,
        verifierSchemaDigest: hashContent({
          content: JSON.stringify(reviewUnitResponseFormat({
            reviewPlan,
            candidate,
            pictureCount: manifest.sourcePictures.length,
          }),),
        },),
      };
    },);
  },);
  /**
   * Plan identity before self digest.
   */
  const identity = {
    manifestDigest: manifest.manifestDigest,
    authorSettlementDigest: authorSettlement.settlementDigest,
    nodes,
    reviewPlanDigest: reviewPlan.reviewPlanDigest,
    verifierProtocolDigest: manifest.verifierProtocolDigest,
    findingCap: manifest.findingCap,
  };
  return {
    ...identity,
    verifierPlanDigest: hashContent({ content: JSON.stringify(identity,), }),
  };
}
