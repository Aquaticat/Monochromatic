// PROTOTYPE ONLY: Candidate K immutable finite graph manifest.

import { hashContent, } from './document-node.ts';
import { photoReferences, } from './photo-reference.ts';
import { boundedModelFamily, } from './prototype-bounded-verdict-family.ts';
import {
  REVIEW_UNIT_HYPER_MODELS,
  reviewUnitHyperModel,
  reviewUnitHyperRouteDigest,
} from './prototype-review-unit-hyper.ts';
import {
  REVIEW_UNIT_AUTHOR_COUNT,
  REVIEW_UNIT_FINDING_CAP,
  REVIEW_UNIT_VERIFIER_COUNT,
  MAX_REVIEW_UNIT_PAYLOAD_COUNT,
  type ReviewUnitCandidate,
  type ReviewUnitManifest,
  type ReviewUnitVerifierPlan,
} from './prototype-review-unit-model.ts';
import {
  REVIEW_UNIT_AUTHOR_PROTOCOL_DIGEST,
  REVIEW_UNIT_VERIFIER_PROTOCOL_DIGEST,
} from './prototype-review-unit-prompt.ts';
import { realizationCandidateAlias, } from './prototype-realization-author.ts';
import { assertRealizationLedgerBindsShell, } from './prototype-realization-ledger-validation.ts';
import type {
  RealizationCandidatePlan,
  RealizationObligationLedger,
} from './prototype-realization-model.ts';
import { slotResponseFormat, } from './prototype-slot-wire.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import {
  assertTargetBoundariesBindShell,
  targetBoundariesForShell,
} from './prototype-target-boundary.ts';

/**
 * SHA-256 hexadecimal character count.
 */
const SHA256_HEX_LENGTH = 64;

/**
 * Canonical digest of closed-world obligation ledger.
 *
 * @returns Digest binding every immutable ledger member
 *
 * @example
 * ```ts
 * const digest = reviewUnitLedgerDigest({ ledger, });
 * ```
 */
export function reviewUnitLedgerDigest({
  ledger,
}: {
  readonly ledger: RealizationObligationLedger;
}): string {
  return hashContent({ content: JSON.stringify(ledger,), });
}

/**
 * Canonical digest input excluding self reference.
 *
 * @param value - Manifest identity before self digest attaches
 *
 * @returns Digest over canonical manifest identity
 */
function manifestDigest(
  value: Omit<ReviewUnitManifest, 'manifestDigest'>,
): string {
  return hashContent({ content: JSON.stringify(value,), });
}

/**
 * Refuses one provider model without current image route.
 *
 * @param modelId - Canonical model identity requiring Hyper vision
 */
function assertModelReach(modelId: RealizationCandidatePlan['modelId'],): void {
  reviewUnitHyperModel({ modelId, });
}

/**
 * Refuses duplicate, noncontiguous, or family-insufficient graph roster.
 */
function assertRoster({
  candidatePlan,
  verifierPlan,
}: {
  readonly candidatePlan: readonly RealizationCandidatePlan[];
  readonly verifierPlan: readonly ReviewUnitVerifierPlan[];
}): void {
  if ((candidatePlan.length !== REVIEW_UNIT_AUTHOR_COUNT)
    || (verifierPlan.length !== REVIEW_UNIT_VERIFIER_COUNT)
    || ((candidatePlan.length * (verifierPlan.length + 1))
      !== MAX_REVIEW_UNIT_PAYLOAD_COUNT))
    throw new Error('review unit roster count differs from fixed graph');
  /**
   * Author plans normalized by public ordinal.
   */
  const authors = candidatePlan.toSorted(function ordinal(
    left,
    right,
  ) {
    return left.ordinal - right.ordinal;
  },);
  /**
   * Verifier plans normalized by public ordinal.
   */
  const verifiers = verifierPlan.toSorted(function ordinal(
    left,
    right,
  ) {
    return left.ordinal - right.ordinal;
  },);
  /**
   * Hidden author priorities.
   */
  const priorities = authors.map(function priority(plan,) {
    return plan.priority;
  },);
  /**
   * Author canonical identities.
   */
  const authorIds = authors.map(function model(plan,) {
    return plan.modelId;
  },);
  /**
   * Verifier canonical identities.
   */
  const verifierIds = verifiers.map(function model(plan,) {
    return plan.modelId;
  },);
  /**
   * Conservative author families.
   */
  const authorFamilies = new Set(authorIds.map(function family(modelId,) {
    return boundedModelFamily({ modelId, });
  },));
  /**
   * Conservative verifier families.
   */
  const verifierFamilies = new Set(verifierIds.map(function family(modelId,) {
    return boundedModelFamily({ modelId, });
  },));
  [
    ...authorIds,
    ...verifierIds,
  ].forEach(assertModelReach,);
  if ((new Set(authorIds,).size !== authorIds.length)
    || (new Set(verifierIds,).size !== verifierIds.length)
    || (new Set(priorities,).size !== priorities.length)
    || (authorFamilies.size !== REVIEW_UNIT_AUTHOR_COUNT)
    || (verifierFamilies.size !== REVIEW_UNIT_VERIFIER_COUNT)
    || [...authorFamilies,].some(function absent(family,) {
      return !verifierFamilies.has(family,);
    },)
    || authors.some(function noncontiguous(
      plan,
      index,
    ) { return plan.ordinal !== index; })
    || verifiers.some(function noncontiguous(
      plan,
      index,
    ) { return plan.ordinal !== index; })
    || priorities.some(function invalid(priority,) {
      return (!Number.isInteger(priority,)) || (priority < 0);
    },))
    throw new Error('review unit roster identity or family differs');
}

/**
 * Refuses source image list not equal to page references.
 */
function assertPictures({
  shell,
  sourcePictures,
}: {
  readonly shell: ImmutableShell;
  readonly sourcePictures: ReviewUnitManifest['sourcePictures'];
}): void {
  /**
   * Manifest image names.
   */
  const names = sourcePictures.map(function name(picture,) {
    return picture.assetName;
  },);
  /**
   * Unique page-referenced names in canonical order.
   */
  const referenced = [...new Set(photoReferences({ text: shell.body, })
    .map(function name(picture,) { return picture.assetName; }),),].toSorted();
  if ((new Set(names,).size !== names.length)
    || (JSON.stringify(names.toSorted(),) !== JSON.stringify(referenced,))
    || sourcePictures.some(function malformed(picture,) {
      return (picture.assetName
        .length
        === 0) || (picture.digest
          .length
          !== SHA256_HEX_LENGTH);
    },))
    throw new Error('review unit picture binding differs');
}

/**
 * Creates Candidate K manifest with exactly two dependency waves.
 *
 * @returns Canonical manifest with self digest attached
 *
 * @example
 * ```ts
 * const manifest = createReviewUnitManifest({
 *   ledger,
 *   shell,
 *   archiveBody,
 *   candidatePlan,
 *   verifierPlan,
 *   providerSelection: 'hyper-only',
 *   sourcePictures,
 * });
 * ```
 */
export function createReviewUnitManifest({
  ledger,
  shell,
  archiveBody,
  candidatePlan,
  verifierPlan,
  providerSelection,
  sourcePictures,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly archiveBody: string;
  readonly candidatePlan: readonly RealizationCandidatePlan[];
  readonly verifierPlan: readonly ReviewUnitVerifierPlan[];
  readonly providerSelection: ReviewUnitManifest['providerSelection'];
  readonly sourcePictures: ReviewUnitManifest['sourcePictures'];
}): ReviewUnitManifest {
  assertRealizationLedgerBindsShell({
    ledger,
    shell,
    archiveBody,
  });
  assertRoster({
    candidatePlan,
    verifierPlan,
  });
  assertPictures({
    shell,
    sourcePictures,
  });
  if (providerSelection !== 'hyper-only')
    throw new Error('review unit provider selection is not Hyper-only');
  /**
   * Runtime-owned syntax boundaries derived before manifest hashing.
   */
  const targetBoundaries = targetBoundariesForShell({ shell, });
  /**
   * Manifest identity before self digest.
   */
  const identity = {
    version: 1,
    shellDigest: shell.shellDigest,
    ledgerDigest: reviewUnitLedgerDigest({ ledger, }),
    targetBoundaries,
    candidatePlan: candidatePlan.toSorted(function ordinal(
      left,
      right,
    ) {
      return left.ordinal - right.ordinal;
    },),
    verifierPlan: verifierPlan.toSorted(function ordinal(
      left,
      right,
    ) {
      return left.ordinal - right.ordinal;
    },),
    providerSelection,
    providerRoutes: REVIEW_UNIT_HYPER_MODELS,
    providerRouteDigest: reviewUnitHyperRouteDigest({
      routes: REVIEW_UNIT_HYPER_MODELS,
    },),
    authorProtocolDigest: REVIEW_UNIT_AUTHOR_PROTOCOL_DIGEST,
    authorSchemaDigest: hashContent({
      content: JSON.stringify(slotResponseFormat({ shell, }),),
    },),
    verifierProtocolDigest: REVIEW_UNIT_VERIFIER_PROTOCOL_DIGEST,
    findingCap: REVIEW_UNIT_FINDING_CAP,
    sourcePictures,
    payloadCountCeiling: MAX_REVIEW_UNIT_PAYLOAD_COUNT,
    dependencyWaves: 2,
  } as const;
  return {
    ...identity,
    manifestDigest: manifestDigest(identity,),
  };
}

/**
 * Refuses manifest, shell, ledger, media, boundary, or roster substitution.
 *
 * @example
 * ```ts
 * assertReviewUnitManifest({
 *   manifest,
 *   ledger,
 *   shell,
 *   archiveBody,
 *   expectedManifestDigest,
 * });
 * ```
 */
export function assertReviewUnitManifest({
  manifest,
  ledger,
  shell,
  archiveBody,
  expectedManifestDigest,
}: {
  readonly manifest: ReviewUnitManifest;
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly archiveBody: string;
  readonly expectedManifestDigest: string;
}): void {
  assertTargetBoundariesBindShell({
    shell,
    boundaries: manifest.targetBoundaries,
  });
  /**
   * Manifest recomputed from supplied immutable dependencies.
   */
  const expected = createReviewUnitManifest({
    ledger,
    shell,
    archiveBody,
    candidatePlan: manifest.candidatePlan,
    verifierPlan: manifest.verifierPlan,
    providerSelection: manifest.providerSelection,
    sourcePictures: manifest.sourcePictures,
  },);
  if ((manifest.manifestDigest !== expectedManifestDigest)
    || (JSON.stringify(manifest,) !== JSON.stringify(expected,)))
    throw new Error('review unit manifest identity differs');
}

/**
 * Refuses anonymous candidate set outside manifest authorization.
 *
 * @example
 * ```ts
 * assertReviewUnitsAuthorized({ candidates, manifest, });
 * ```
 */
export function assertReviewUnitsAuthorized({
  candidates,
  manifest,
}: {
  readonly candidates: readonly ReviewUnitCandidate[];
  readonly manifest: ReviewUnitManifest;
}): void {
  if ((candidates.length === 0)
    || (candidates.length
      > manifest.candidatePlan
      .length)
    || (new Set(candidates.map(function id(candidate,) {
      return candidate.candidateId;
    },)).size !== candidates.length))
    throw new Error('review unit candidate set length or alias differs');
  candidates.forEach(function candidate(value,) {
    /**
     * Plan whose runtime alias identifies candidate.
     */
    const plan = manifest.candidatePlan
      .find(function authorized(item,) {
      return realizationCandidateAlias({
        manifestDigest: manifest.manifestDigest,
        ordinal: item.ordinal,
      },) === value.candidateId;
    },);
    if ((plan === undefined)
      || (value.manifestDigest !== manifest.manifestDigest)
      || (value.candidateOrdinal !== plan.ordinal)
      || (value.modelId !== plan.modelId)
      || (value.priority !== plan.priority))
      throw new Error('review unit candidate authorization differs');
  },);
}
