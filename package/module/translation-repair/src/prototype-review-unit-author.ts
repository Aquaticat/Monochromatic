// PROTOTYPE ONLY: Candidate K complete author admission with runtime boundaries.

import { hashContent, } from './document-node.ts';
import { assertReviewUnitsAuthorized, } from './prototype-review-unit-manifest.ts';
import type {
  ReviewUnitCandidate,
  ReviewUnitManifest,
} from './prototype-review-unit-model.ts';
import { realizationCandidateAlias, } from './prototype-realization-author.ts';
import { validateSerialCandidate, } from './prototype-serial-producer-plan.ts';
import type { RealizationCandidatePlan, } from './prototype-realization-model.ts';
import type {
  ImmutableShell,
  SlotDocumentResponse,
} from './prototype-slot-model.ts';
import { validateSlotCandidate, } from './prototype-slot-wire.ts';
import { compileReviewUnitCandidate, } from './prototype-target-boundary-compile.ts';

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
  plan,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly response: SlotDocumentResponse;
  readonly shell: ImmutableShell;
  readonly manifest: ReviewUnitManifest;
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
  const compilation = compileReviewUnitCandidate({
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
   * Runtime-owned candidate members participating in self digest.
   */
  const identity = {
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
    slotDigest: hashContent({ content: JSON.stringify(compilation.slots,), }),
    rawSlotDigest: hashContent({ content: JSON.stringify(rawSlots,), }),
    slots: compilation.slots,
    rawSlots,
    resolvedBoundaries: compilation.resolvedBoundaries,
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
  shell,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly candidate: ReviewUnitCandidate;
  readonly manifest: ReviewUnitManifest;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): void {
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
    plan: {
      ordinal: candidate.candidateOrdinal,
      modelId: candidate.modelId,
      priority: candidate.priority,
    },
    sourceText,
    archiveText,
    sourcePictures,
  },);
  if (JSON.stringify(candidate,) !== JSON.stringify(expected,))
    throw new Error('review unit candidate binding differs');
}
