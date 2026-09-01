// PROTOTYPE ONLY: Candidate M version-three finite graph manifest.

import { hashContent, } from './document-node.ts';
import { LEAN_FRONT_MATTER_AUTHORITY_DIGEST, } from './prototype-lean-realization-front-matter-contract.ts';
import type { ReviewUnitVerifierPlan, } from './prototype-review-unit-model.ts';
import {
  createReviewUnitManifest,
} from './prototype-review-unit-manifest.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import { CANDIDATE_M_AUTHOR_PROTOCOL_DIGEST, } from './prototype-risk-challenger-author-prompt.ts';
import {
  CANDIDATE_M_RISK_ATTESTATION_DIGEST,
  CANDIDATE_M_RISK_POLICY_DIGEST,
  riskAttestedAuthorResponseFormat,
} from './prototype-risk-challenger-author-wire.ts';
import {
  CANDIDATE_M_CHALLENGER_PROTOCOL_DIGEST,
} from './prototype-risk-challenger-prompt.ts';
import { CANDIDATE_M_CHALLENGER_RULE_DIGEST, } from './prototype-risk-challenger-rules.ts';
import {
  CANDIDATE_M_ARCHITECTURE,
  CANDIDATE_M_AUTHOR_COUNT,
  CANDIDATE_M_AUTHOR_TIMEOUT_MS,
  CANDIDATE_M_CHALLENGER_ROLES,
  CANDIDATE_M_CHALLENGER_TIMEOUT_MS,
  CANDIDATE_M_MANIFEST_VERSION,
  MAX_CANDIDATE_M_PAYLOAD_COUNT,
} from './prototype-risk-challenger-model.ts';
import type { CandidateMManifest, } from './prototype-risk-challenger-manifest-model.ts';
import type {
  RealizationCandidatePlan,
  RealizationObligationLedger,
} from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/**
 * Candidate M self digest excluding self member.
 *
 * @param value - Manifest identity before self digest
 *
 * @returns SHA-256 manifest identity
 */
function manifestDigest(value: Omit<CandidateMManifest, 'manifestDigest'>,): string {
  return hashContent({ content: JSON.stringify(value,), });
}

/**
 * Creates exact Candidate M manifest from validated Candidate L-compatible shell evidence.
 *
 * @returns Version-three risk-challenger manifest
 *
 * @example
 * ```ts
 * const manifest = createCandidateMManifest({ ledger, shell, sourceText, sourceBody, archiveBody, reviewPlan, candidatePlan, verifierPlan, providerSelection: 'hyper-only', sourcePictures, });
 * ```
 */
export function createCandidateMManifest({
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
}: {
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly sourceBody: string;
  readonly archiveBody: string;
  readonly reviewPlan: ReviewUnitPlan;
  readonly candidatePlan: readonly RealizationCandidatePlan[];
  readonly verifierPlan: readonly ReviewUnitVerifierPlan[];
  readonly providerSelection: CandidateMManifest['providerSelection'];
  readonly sourcePictures: CandidateMManifest['sourcePictures'];
}): CandidateMManifest {
  if (candidatePlan.length !== CANDIDATE_M_AUTHOR_COUNT)
    throw new Error('Candidate M author count differs');
  /**
   * Validated two-author shell, plan, image, roster, and route base.
   */
  const base = createReviewUnitManifest({
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
    authorMode: 'lean-realization',
  },);
  if (base.providerRoutes
    .some(function deadline(route,) {
    return route.requestTimeoutMs !== CANDIDATE_M_CHALLENGER_TIMEOUT_MS;
  },))
    throw new Error('Candidate M route default and challenger deadline differ');
  /**
   * Candidate M identity before self digest.
   */
  const identity: Omit<CandidateMManifest, 'manifestDigest'> = {
    version: CANDIDATE_M_MANIFEST_VERSION,
    architecture: CANDIDATE_M_ARCHITECTURE,
    authorMode: 'risk-challenger',
    frontMatterAuthorityDigest: LEAN_FRONT_MATTER_AUTHORITY_DIGEST,
    riskPolicyDigest: CANDIDATE_M_RISK_POLICY_DIGEST,
    riskAttestationDigest: CANDIDATE_M_RISK_ATTESTATION_DIGEST,
    challengerRoles: CANDIDATE_M_CHALLENGER_ROLES,
    authorTimeoutMs: CANDIDATE_M_AUTHOR_TIMEOUT_MS,
    challengerTimeoutMs: CANDIDATE_M_CHALLENGER_TIMEOUT_MS,
    shellDigest: base.shellDigest,
    ledgerDigest: base.ledgerDigest,
    targetBoundaries: base.targetBoundaries,
    reviewPlanDigest: base.reviewPlanDigest,
    candidatePlan: base.candidatePlan,
    verifierPlan: base.verifierPlan,
    providerSelection: base.providerSelection,
    providerRoutes: base.providerRoutes,
    providerRouteDigest: base.providerRouteDigest,
    authorProtocolDigest: CANDIDATE_M_AUTHOR_PROTOCOL_DIGEST,
    authorSchemaDigest: hashContent({ content: JSON.stringify(
      riskAttestedAuthorResponseFormat({
        shell,
        reviewPlan,
      }),
    ), }),
    verifierProtocolDigest: CANDIDATE_M_CHALLENGER_PROTOCOL_DIGEST,
    verifierRuleDigest: CANDIDATE_M_CHALLENGER_RULE_DIGEST,
    findingCap: 1,
    sourcePictures: base.sourcePictures,
    payloadCountCeiling: MAX_CANDIDATE_M_PAYLOAD_COUNT,
    dependencyWaves: 2,
  };
  return {
    ...identity,
    manifestDigest: manifestDigest(identity,),
  };
}

/**
 * Refuses stale version, architecture, shell, plan, roster, route, or protocol identity.
 *
 * @example
 * ```ts
 * assertCandidateMManifest({ manifest, ledger, shell, sourceText, sourceBody, archiveBody, reviewPlan, expectedManifestDigest, });
 * ```
 */
export function assertCandidateMManifest({
  manifest,
  ledger,
  shell,
  sourceText,
  sourceBody,
  archiveBody,
  reviewPlan,
  expectedManifestDigest,
}: {
  readonly manifest: CandidateMManifest;
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly sourceBody: string;
  readonly archiveBody: string;
  readonly reviewPlan: ReviewUnitPlan;
  readonly expectedManifestDigest: string;
}): void {
  /**
   * Manifest recomputed from exact runtime dependencies.
   */
  const expected = createCandidateMManifest({
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
  },);
  if ((manifest.version !== CANDIDATE_M_MANIFEST_VERSION)
    || (manifest.architecture !== CANDIDATE_M_ARCHITECTURE)
    || (manifest.authorMode !== 'risk-challenger')
    || (manifest.manifestDigest !== expectedManifestDigest)
    || (JSON.stringify(manifest,) !== JSON.stringify(expected,)))
    throw new Error('Candidate M manifest identity differs');
}

/**
 * Resolves Candidate M role-specific local deadline over shared route default.
 *
 * @returns Manifest-bound author override or challenger route deadline
 *
 * @example
 * ```ts
 * const timeoutMs = candidateMNodeTimeout({ manifest, nodeRole: 'author', });
 * ```
 */
export function candidateMNodeTimeout({
  manifest,
  nodeRole,
}: {
  readonly manifest: CandidateMManifest;
  readonly nodeRole: 'author' | 'challenger';
}): number {
  return nodeRole === 'author'
    ? manifest.authorTimeoutMs
    : manifest.challengerTimeoutMs;
}
