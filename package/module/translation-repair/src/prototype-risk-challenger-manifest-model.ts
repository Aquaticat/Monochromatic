// PROTOTYPE ONLY: Candidate M manifest and selection vocabulary.

import type { RosterModelId, } from './roster-id.ts';
import type { ReviewUnitManifest, } from './prototype-review-unit-model.ts';
import type {
  CANDIDATE_M_ARCHITECTURE,
  CANDIDATE_M_AUTHOR_TIMEOUT_MS,
  CANDIDATE_M_CHALLENGER_ROLES,
  CANDIDATE_M_CHALLENGER_TIMEOUT_MS,
  CANDIDATE_M_MANIFEST_VERSION,
  MAX_CANDIDATE_M_PAYLOAD_COUNT,
  CandidateMChallengerRole,
  CandidateMCandidate
} from './prototype-risk-challenger-model.ts';

/**
 * Candidate M version-three manifest identity.
 */
export type CandidateMManifest = Omit<
  ReviewUnitManifest,
  | 'authorMode'
  | 'authorSchemaDigest'
  | 'authorProtocolDigest'
  | 'dependencyWaves'
  | 'findingCap'
  | 'manifestDigest'
  | 'payloadCountCeiling'
  | 'verifierProtocolDigest'
  | 'verifierRuleDigest'
  | 'version'
> & {
  /**
   * Fresh architecture discriminator.
   */
  readonly architecture: typeof CANDIDATE_M_ARCHITECTURE;
  /**
   * Fresh manifest version.
   */
  readonly version: typeof CANDIDATE_M_MANIFEST_VERSION;
  /**
   * Fresh author mode.
   */
  readonly authorMode: 'risk-challenger';
  /**
   * Author protocol identity.
   */
  readonly authorProtocolDigest: string;
  /**
   * Author response schema identity.
   */
  readonly authorSchemaDigest: string;
  /**
   * Manifest-owned risk-attestation policy identity.
   */
  readonly riskPolicyDigest: string;
  /**
   * Exact canonical six-key attestation object identity.
   */
  readonly riskAttestationDigest: string;
  /**
   * Challenger protocol identity.
   */
  readonly verifierProtocolDigest: string;
  /**
   * One retained decisive counterexample.
   */
  readonly findingCap: 1;
  /**
   * Challenger role and evidence-rule identity.
   */
  readonly verifierRuleDigest: string;
  /**
   * Fixed challenger roles.
   */
  readonly challengerRoles: typeof CANDIDATE_M_CHALLENGER_ROLES;
  /**
   * Fixed author request deadline.
   */
  readonly authorTimeoutMs: typeof CANDIDATE_M_AUTHOR_TIMEOUT_MS;
  /**
   * Fixed challenger request deadline.
   */
  readonly challengerTimeoutMs: typeof CANDIDATE_M_CHALLENGER_TIMEOUT_MS;
  /**
   * Static graph width.
   */
  readonly payloadCountCeiling: typeof MAX_CANDIDATE_M_PAYLOAD_COUNT;
  /**
   * Author wave followed by challenger wave.
   */
  readonly dependencyWaves: 2;
  /**
   * Self digest over every prior member.
   */
  readonly manifestDigest: string;
};

/**
 * Candidate M private selection evidence.
 */
export type CandidateMSelection = {
  /**
   * Fixed-priority private fallback candidate.
   */
  readonly candidate: CandidateMCandidate;
  /**
   * Whether both roles met strict nonself family floor.
   */
  readonly evidenceFloorMet: boolean;
  /**
   * Whether candidate can cross production boundary.
   */
  readonly productionEligible: boolean;
  /**
   * Clean nonself families by challenger role.
   */
  readonly cleanFamiliesByRole: Readonly<Record<CandidateMChallengerRole, readonly string[]>>;
  /**
   * Admitted defect challenger model identities.
   */
  readonly dissentingVerifierModelIds: readonly RosterModelId[];
  /**
   * Missing or atomically invalid challenger model identities.
   */
  readonly abstainingVerifierModelIds: readonly RosterModelId[];
};
