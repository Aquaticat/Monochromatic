// PROTOTYPE ONLY: Candidate K complete author admission with runtime boundaries.

import { hashContent, } from './document-node.ts';
import { assertLeanRealizationBinding, } from './prototype-lean-realization-author.ts';
import { assertReviewUnitsAuthorized, } from './prototype-review-unit-manifest.ts';
import type {
  ReviewUnitCandidate,
  ReviewUnitManifest,
} from './prototype-review-unit-model.ts';
import { realizationCandidateAlias, } from './prototype-realization-author.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import {
  assertReviewUnitProof,
  reviewUnitProofDigest,
  type ReviewUnitProofInput,
} from './prototype-review-unit-proof.ts';
import { validateSerialCandidate, } from './prototype-serial-producer-plan.ts';
import type { RealizationCandidatePlan, } from './prototype-realization-model.ts';
import type {
  ImmutableShell,
  SlotDocumentResponse,
} from './prototype-slot-model.ts';
import { validateSlotCandidate, } from './prototype-slot-wire.ts';
import { compileCandidateBallotCandidate, } from './prototype-target-boundary-compile.ts';

/**
 * Runtime-owned candidate digest excluding self reference.
 *
 * @param candidate - Identity before self digest attaches
 *
 * @returns Digest binding every candidate member
 */
function candidateDigest(
  candidate: Omit<ReviewUnitCandidate, 'candidateDigest'>,
): string {
  return hashContent({ content: JSON.stringify(candidate,), });
}

/**
 * Admits one complete slot map and inserts manifested separators before hashing.
 *
 * @returns Runtime-bound complete candidate
 *
 * @example
 * ```ts
 * const candidate = admitReviewUnitAuthorResponse({
 *   response,
 *   shell,
 *   manifest,
 *   plan,
 *   sourceText,
 *   archiveText,
 *   sourcePictures,
 * });
 * ```
 */
export function admitReviewUnitAuthorResponse({
  response,
  shell,
  manifest,
  reviewPlan,
  plan,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly response: SlotDocumentResponse;
  readonly shell: ImmutableShell;
  readonly manifest: ReviewUnitManifest;
  readonly reviewPlan: ReviewUnitPlan;
  readonly plan: RealizationCandidatePlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): ReviewUnitCandidate {
  /**
   * Exact author plan authorized for supplied ordinal.
   */
  const authorized = manifest.candidatePlan
    .find(function ordinal(value,) {
    return value.ordinal === plan.ordinal;
  },);
  if ((authorized === undefined)
    || (JSON.stringify(authorized,) !== JSON.stringify(plan,)))
    throw new Error('review unit author plan is not manifest-authorized');
  /**
   * Raw slot document proving model text satisfies immutable validation.
   */
  const rawDocument = validateSlotCandidate({
    shell,
    response,
    sourceText,
    archiveText,
    sourcePictures,
  },);
  /**
   * Complete post-boundary candidate compiled before hashing.
   */
  const compilation = compileCandidateBallotCandidate({
    shell,
    response,
    boundaries: manifest.targetBoundaries,
  },);
  if (rawDocument.length === 0)
    throw new Error('review unit raw validation document is absent');
  validateSerialCandidate({
    sourceText,
    archiveText,
    sourcePictures,
    candidate: compilation.document,
  },);
  if (reviewPlan.reviewPlanDigest !== manifest.reviewPlanDigest)
    throw new Error('review unit author review plan differs');
  /**
   * Slot record normalized into immutable shell order.
   */
  const rawSlots = Object.fromEntries(shell.slots
    .map(function slot(item,) {
    /**
     * Exact raw author text assigned to shell slot.
     */
    const text = response.slots[item.key];
    if (text === undefined)
      throw new Error(`review unit author slot ${item.key} is absent`);
    return [
      item.key,
      text,
    ];
  },),);
  /**
   * Synthetic exact-anchor slots for immutable target front matter.
   */
  const frontMatterSlots = Object.fromEntries(reviewPlan.frontMatterSubjects
    .map(function entry(subject,) {
    return [
      subject.targetSlotKey,
      subject.targetText,
    ];
  },),);
  /**
   * Body and front-matter target records used by verifier anchors.
   */
  const candidateSlots = {
    ...frontMatterSlots,
    ...compilation.slots,
  };
  /**
   * Runtime-owned candidate members before deterministic proof attaches.
   */
  const admittedIdentity = {
    candidateId: realizationCandidateAlias({
      manifestDigest: manifest.manifestDigest,
      ordinal: plan.ordinal,
    },),
    candidateOrdinal: plan.ordinal,
    manifestDigest: manifest.manifestDigest,
    modelId: plan.modelId,
    priority: plan.priority,
    document: compilation.document,
    documentDigest: hashContent({ content: compilation.document, }),
    slotDigest: hashContent({ content: JSON.stringify(candidateSlots,), }),
    rawSlotDigest: hashContent({ content: JSON.stringify(rawSlots,), }),
    slots: candidateSlots,
    rawSlots,
    resolvedBoundaries: compilation.resolvedBoundaries,
  };
  /**
   * Mechanically decidable proof input excluding semantic claims.
   */
  const proofInput: ReviewUnitProofInput = {
    candidateId: admittedIdentity.candidateId,
    candidateOrdinal: admittedIdentity.candidateOrdinal,
    documentDigest: admittedIdentity.documentDigest,
    slotDigest: admittedIdentity.slotDigest,
    rawSlotDigest: admittedIdentity.rawSlotDigest,
    resolvedBoundaries: admittedIdentity.resolvedBoundaries,
    sourcePictureNames: sourcePictures.map(function name(picture,) { return picture.assetName; }),
  };
  /**
   * Candidate identity including runtime-owned admission proof.
   */
  const identity = {
    ...admittedIdentity,
    deterministicProofDigest: reviewUnitProofDigest({
      manifest,
      input: proofInput,
    },),
  };
  return {
    ...identity,
    candidateDigest: candidateDigest(identity,),
  };
}

/**
 * Revalidates persisted candidate against source and immutable bindings.
 *
 * @example
 * ```ts
 * assertReviewUnitBinding({
 *   candidate,
 *   manifest,
 *   shell,
 *   sourceText,
 *   archiveText,
 *   sourcePictures,
 * });
 * ```
 */
export function assertReviewUnitBinding({
  candidate,
  manifest,
  reviewPlan,
  shell,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly candidate: ReviewUnitCandidate;
  readonly manifest: ReviewUnitManifest;
  readonly reviewPlan: ReviewUnitPlan;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): void {
  if (manifest.authorMode === 'lean-realization') {
    assertLeanRealizationBinding({
      candidate,
      manifest,
      reviewPlan,
      shell,
      sourceText,
      archiveText,
      sourcePictures,
    });
    return;
  }
  assertReviewUnitsAuthorized({
    candidates: [candidate,],
    manifest,
  });
  /**
   * Candidate recomputed from raw slots and runtime authority.
   */
  const expected = admitReviewUnitAuthorResponse({
    response: { slots: candidate.rawSlots, },
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
  },);
  assertReviewUnitProof({
    manifest,
    input: {
      candidateId: candidate.candidateId,
      candidateOrdinal: candidate.candidateOrdinal,
      documentDigest: candidate.documentDigest,
      slotDigest: candidate.slotDigest,
      rawSlotDigest: candidate.rawSlotDigest,
      resolvedBoundaries: candidate.resolvedBoundaries,
      sourcePictureNames: sourcePictures.map(function name(picture,) { return picture.assetName; }),
    },
    expectedDigest: candidate.deterministicProofDigest,
  });
  if (JSON.stringify(candidate,) !== JSON.stringify(expected,))
    throw new Error('review unit candidate binding differs');
}
