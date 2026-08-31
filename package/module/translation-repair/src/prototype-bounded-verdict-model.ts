// PROTOTYPE ONLY: Candidate H compact closed-world verdict vocabulary.

import type { RosterModelId, } from './roster-id.ts';
import type {
  RealizationCandidatePlan,
  RealizationObligationLedger,
  RealizationProviderSelection,
  RealizationTargetAnchor,
} from './prototype-realization-model.ts';

/** Maximum concrete defect certificates retained for one candidate row. */
export const BOUNDED_VERDICT_FINDING_CAP = 8;

/** Maximum provider payloads in fixed four-author, three-verifier graph. */
export const MAX_BOUNDED_PAYLOAD_COUNT = 7;

/** Compact obligation outcome in manifest order. */
export type BoundedObligationCode = 'p' | 'd';

/** Compact global-criterion outcome in canonical order. */
export type BoundedGlobalCode = 'c' | 'd';

/** Candidate H immutable plan and protocol binding. */
export type BoundedVerdictManifest = {
  readonly version: 2;
  readonly shellDigest: string;
  readonly ledgerDigest: string;
  readonly candidatePlan: readonly RealizationCandidatePlan[];
  readonly verifierModelIds: readonly RosterModelId[];
  readonly providerSelection: RealizationProviderSelection;
  readonly authorProtocolDigest: string;
  readonly authorSchemaDigest: string;
  readonly verifierProtocolDigest: string;
  readonly findingCap: typeof BOUNDED_VERDICT_FINDING_CAP;
  readonly sourcePictures: readonly {
    readonly assetName: string;
    readonly digest: string;
  }[];
  readonly payloadCountCeiling: number;
  readonly dependencyWaves: 2;
  readonly manifestDigest: string;
};

/** Runtime-owned whole immutable-shell author candidate. */
export type BoundedCandidate = {
  readonly candidateId: string;
  readonly candidateOrdinal: number;
  readonly manifestDigest: string;
  readonly modelId: RosterModelId;
  readonly priority: number;
  readonly document: string;
  readonly documentDigest: string;
  readonly slotDigest: string;
  readonly candidateDigest: string;
  readonly slots: Readonly<Record<string, string>>;
};

/** Located bounded certificate linked by manifest index. */
export type BoundedFinding = {
  readonly scope: 'o' | 'g';
  readonly manifestIndex: number;
  readonly defectClassIndex: number;
  readonly targetAnchors: readonly RealizationTargetAnchor[];
};

/** Complete compact matrix row for one anonymous candidate. */
export type BoundedCandidateVerification = {
  readonly candidateId: string;
  readonly candidateDigest: string;
  readonly obligationStatuses: readonly BoundedObligationCode[];
  readonly globalStatuses: readonly BoundedGlobalCode[];
  readonly overflow: boolean;
  readonly findings: readonly BoundedFinding[];
};

/** Atomic all-candidate verifier response. */
export type BoundedVerifierResponse = {
  readonly candidates: readonly BoundedCandidateVerification[];
};

/** Runtime-owned verifier identity around admitted atomic response. */
export type BoundedVerifierBallot = {
  readonly verifierModelId: RosterModelId;
  readonly manifestDigest: string;
  readonly response: BoundedVerifierResponse;
};

/** Complete terminal row for every manifested author plan. */
export type BoundedAuthorSettlementRow = {
  readonly ordinal: number;
  readonly modelId: RosterModelId;
  readonly priority: number;
  readonly state: 'completed' | 'spent-unusable';
  readonly nodeRecordDigest: string;
  readonly candidate?: BoundedCandidate;
};

/** Runtime-owned total author-wave settlement. */
export type BoundedAuthorSettlement = {
  readonly version: 1;
  readonly manifestDigest: string;
  readonly rows: readonly BoundedAuthorSettlementRow[];
  readonly settlementDigest: string;
};

/** Private Candidate H selection and evidence classification. */
export type BoundedSelection = {
  readonly candidate: BoundedCandidate;
  readonly cleanVerifierModelIds: readonly RosterModelId[];
  readonly evidenceFloorMet: boolean;
  readonly productionEligible: boolean;
  readonly independenceScope: 'distinct-author-and-verifier-model-families';
  readonly dissentingVerifierModelIds: readonly RosterModelId[];
  readonly abstainingVerifierModelIds: readonly RosterModelId[];
};

/** Candidate H fixture input shared by manifest and verifier logic. */
export type BoundedVerdictContext = {
  readonly manifest: BoundedVerdictManifest;
  readonly ledger: RealizationObligationLedger;
};
