// PROTOTYPE ONLY: Candidate I static verifier Cartesian plan settlement.

import { hashContent, } from './document-node.ts';
import type {
  CandidateBallotAuthorSettlement,
  CandidateBallotCandidate,
  CandidateBallotManifest,
} from './prototype-candidate-ballot-model.ts';
import { candidateBallotResponseFormat, } from './prototype-candidate-ballot-schema.ts';
import type { RealizationObligationLedger, } from './prototype-realization-model.ts';

/**
 * One of six statically manifested candidate and verifier nodes.
 */
export type CandidateBallotVerifierNodePlan = {
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
  readonly verifierModelId: CandidateBallotManifest['verifierPlan'][number]['modelId'];
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
export type CandidateBallotVerifierWavePlan = {
  /**
   * Manifest binding.
   */
  readonly manifestDigest: string;
  /**
   * Total author settlement binding.
   */
  readonly authorSettlementDigest: string;
  /**
   * Six statically finite node rows.
   */
  readonly nodes: readonly CandidateBallotVerifierNodePlan[];
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
 * Builds six-row verifier plan before dispatching any verifier.
 *
 * @returns Immutable static second-wave plan
 *
 * @example
 * ```ts
 * const plan = createCandidateBallotVerifierWavePlan({
 *   manifest,
 *   authorSettlement,
 *   candidates,
 *   ledger,
 * });
 * ```
 */
export function createCandidateBallotVerifierWavePlan({
  manifest,
  authorSettlement,
  candidates,
  ledger,
}: {
  readonly manifest: CandidateBallotManifest;
  readonly authorSettlement: CandidateBallotAuthorSettlement;
  readonly candidates: readonly CandidateBallotCandidate[];
  readonly ledger: RealizationObligationLedger;
}): CandidateBallotVerifierWavePlan {
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
        verifierSchemaDigest: hashContent({
          content: JSON.stringify(candidateBallotResponseFormat({
            ledger,
            candidate,
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
    verifierProtocolDigest: manifest.verifierProtocolDigest,
    findingCap: manifest.findingCap,
  };
  return {
    ...identity,
    verifierPlanDigest: hashContent({ content: JSON.stringify(identity,), }),
  };
}
