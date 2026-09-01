// PROTOTYPE ONLY: Candidate K immutable finite graph manifest.

import { hashContent, } from './document-node.ts';
import { photoReferences, } from './photo-reference.ts';
import {
  REVIEW_UNIT_HYPER_MODELS,
  reviewUnitHyperRouteDigest,
} from './prototype-review-unit-hyper.ts';
import {
  MAX_LEAN_REALIZATION_PAYLOAD_COUNT,
  REVIEW_UNIT_FINDING_CAP,
  MAX_REVIEW_UNIT_PAYLOAD_COUNT,
  type ReviewUnitCandidate,
  type ReviewUnitManifest,
  type ReviewUnitVerifierPlan,
} from './prototype-review-unit-model.ts';
import { LEAN_FRONT_MATTER_AUTHORITY_DIGEST, } from './prototype-lean-realization-front-matter-contract.ts';
import {
  LEAN_REALIZATION_AUTHOR_PROTOCOL_DIGEST,
  LEAN_REALIZATION_VERIFIER_PROTOCOL_DIGEST,
} from './prototype-lean-realization-prompt.ts';
import { leanRealizationResponseFormat, } from './prototype-lean-realization-wire.ts';
import {
  REVIEW_UNIT_AUTHOR_PROTOCOL_DIGEST,
  REVIEW_UNIT_VERIFIER_PROTOCOL_DIGEST,
} from './prototype-review-unit-prompt.ts';
import { realizationCandidateAlias, } from './prototype-realization-author.ts';
import { assertReviewUnitRoster, } from './prototype-review-unit-roster.ts';
import { REVIEW_UNIT_FINDING_RULE_DIGEST, } from './prototype-review-unit-rules.ts';
import {
  assertReviewUnitPlan,
  type ReviewUnitPlan,
} from './prototype-review-unit-plan.ts';
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
  sourceText,
  sourceBody,
  archiveBody,
  reviewPlan,
  candidatePlan,
  verifierPlan,
  providerSelection,
  sourcePictures,
  authorMode,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly sourceBody: string;
  readonly archiveBody: string;
  readonly reviewPlan: ReviewUnitPlan;
  readonly candidatePlan: readonly RealizationCandidatePlan[];
  readonly verifierPlan: readonly ReviewUnitVerifierPlan[];
  readonly providerSelection: ReviewUnitManifest['providerSelection'];
  readonly sourcePictures: ReviewUnitManifest['sourcePictures'];
  readonly authorMode?: ReviewUnitManifest['authorMode'];
}): ReviewUnitManifest {
  assertRealizationLedgerBindsShell({
    ledger,
    shell,
    archiveBody,
  });
  /**
   * Closed-world ledger digest shared with readable plan.
   */
  const ledgerDigest = reviewUnitLedgerDigest({ ledger, });
  assertReviewUnitPlan({
    plan: reviewPlan,
    ledger,
    shell,
    sourceText,
    sourceBody,
    archiveBody,
    ledgerDigest,
  });
  assertReviewUnitRoster({
    candidatePlan,
    verifierPlan,
    authorMode,
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
    version: authorMode === 'lean-realization' ? 2 : 1,
    ...(authorMode === undefined
      ? {}
      : {
        authorMode,
        frontMatterAuthorityDigest: LEAN_FRONT_MATTER_AUTHORITY_DIGEST,
      }),
    shellDigest: shell.shellDigest,
    ledgerDigest,
    targetBoundaries,
    reviewPlanDigest: reviewPlan.reviewPlanDigest,
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
    authorProtocolDigest: authorMode === 'lean-realization'
      ? LEAN_REALIZATION_AUTHOR_PROTOCOL_DIGEST
      : REVIEW_UNIT_AUTHOR_PROTOCOL_DIGEST,
    authorSchemaDigest: hashContent({
      content: JSON.stringify(authorMode === 'lean-realization'
        ? leanRealizationResponseFormat({
          shell,
          reviewPlan,
        })
        : slotResponseFormat({ shell, }),),
    },),
    verifierProtocolDigest: authorMode === 'lean-realization'
      ? LEAN_REALIZATION_VERIFIER_PROTOCOL_DIGEST
      : REVIEW_UNIT_VERIFIER_PROTOCOL_DIGEST,
    verifierRuleDigest: REVIEW_UNIT_FINDING_RULE_DIGEST,
    findingCap: REVIEW_UNIT_FINDING_CAP,
    sourcePictures,
    payloadCountCeiling: authorMode === 'lean-realization'
      ? MAX_LEAN_REALIZATION_PAYLOAD_COUNT
      : MAX_REVIEW_UNIT_PAYLOAD_COUNT,
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
  sourceText,
  sourceBody,
  archiveBody,
  reviewPlan,
  expectedManifestDigest,
}: {
  readonly manifest: ReviewUnitManifest;
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly sourceBody: string;
  readonly archiveBody: string;
  readonly reviewPlan: ReviewUnitPlan;
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
    sourceText,
    sourceBody,
    archiveBody,
    reviewPlan,
    candidatePlan: manifest.candidatePlan,
    verifierPlan: manifest.verifierPlan,
    providerSelection: manifest.providerSelection,
    sourcePictures: manifest.sourcePictures,
    ...(manifest.authorMode === undefined ? {} : { authorMode: manifest.authorMode, }),
  },);
  if ((manifest.manifestDigest !== expectedManifestDigest)
    || (JSON.stringify(manifest,) !== JSON.stringify(expected,)))
    throw new Error('review unit manifest identity differs');
}

/**
 * Shared manifest authority required by candidate authorization.
 */
export type ReviewUnitCandidateAuthority = Pick<
  ReviewUnitManifest,
  'candidatePlan' | 'manifestDigest'
>;

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
  readonly manifest: ReviewUnitCandidateAuthority;
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
