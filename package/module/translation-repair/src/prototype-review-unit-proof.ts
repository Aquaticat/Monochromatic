// PROTOTYPE ONLY: Candidate K deterministic admission proof identity.

import { hashContent, } from './document-node.ts';
import type { ReviewUnitManifest, } from './prototype-review-unit-model.ts';
import type { ResolvedCandidateTargetBoundary, } from './prototype-target-boundary.ts';

/**
 * Mechanically decidable candidate identity proven after admission.
 */
export type ReviewUnitProofInput = {
  /**
   * Opaque runtime candidate alias.
   */
  readonly candidateId: string;
  /**
   * Manifest author ordinal.
   */
  readonly candidateOrdinal: number;
  /**
   * Complete compiled document digest.
   */
  readonly documentDigest: string;
  /**
   * Compiled slot-record digest.
   */
  readonly slotDigest: string;
  /**
   * Raw author slot-record digest.
   */
  readonly rawSlotDigest: string;
  /**
   * Candidate-specific runtime boundary resolutions.
   */
  readonly resolvedBoundaries: readonly ResolvedCandidateTargetBoundary[];
  /**
   * Bound page-image names in manifest order.
   */
  readonly sourcePictureNames: readonly string[];
};

/**
 * Digests mechanically admitted candidate and manifest bindings.
 *
 * Semantic fidelity and English quality are intentionally absent.
 *
 * @returns Deterministic proof identity for verifier and selection boundaries
 *
 * @example
 * ```ts
 * const digest = reviewUnitProofDigest({ manifest, input, });
 * ```
 */
export function reviewUnitProofDigest({
  manifest,
  input,
}: {
  readonly manifest: ReviewUnitManifest;
  readonly input: ReviewUnitProofInput;
}): string {
  return hashContent({
    content: JSON.stringify({
      version: 1,
      manifestDigest: manifest.manifestDigest,
      reviewPlanDigest: manifest.reviewPlanDigest,
      shellDigest: manifest.shellDigest,
      ledgerDigest: manifest.ledgerDigest,
      targetBoundaries: manifest.targetBoundaries,
      sourcePictures: manifest.sourcePictures,
      ...input,
    },),
  });
}

/**
 * Refuses candidate deterministic-proof drift.
 *
 * @example
 * ```ts
 * assertReviewUnitProof({ manifest, input, expectedDigest, });
 * ```
 */
export function assertReviewUnitProof({
  manifest,
  input,
  expectedDigest,
}: {
  readonly manifest: ReviewUnitManifest;
  readonly input: ReviewUnitProofInput;
  readonly expectedDigest: string;
}): void {
  if (reviewUnitProofDigest({
    manifest,
    input,
  }) !== expectedDigest)
    throw new Error('review unit deterministic proof differs');
}
