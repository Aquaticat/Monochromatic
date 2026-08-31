// PROTOTYPE ONLY: Candidate I candidate-scoped compact-ballot vocabulary.

import type { RosterModelId, } from './roster-id.ts';
import type { CandidateBallotHyperModel, } from './prototype-candidate-ballot-hyper.ts';
import type {
  RealizationCandidatePlan,
  RealizationObligationLedger,
  RealizationProviderSelection,
  RealizationTargetAnchor,
} from './prototype-realization-model.ts';
import type {
  CandidateTargetBoundary,
  ResolvedCandidateTargetBoundary,
} from './prototype-target-boundary.ts';

/**
 * Fixed number of whole-document authors.
 */
export const CANDIDATE_BALLOT_AUTHOR_COUNT = 2;

/**
 * Fixed number of independent verifier families per admitted candidate.
 */
export const CANDIDATE_BALLOT_VERIFIER_COUNT = 3;

/**
 * Maximum provider payloads in two-author candidate-scoped graph.
 */
export const MAX_CANDIDATE_BALLOT_PAYLOAD_COUNT = 8;

/**
 * Maximum concrete defect certificates retained for one ballot.
 */
export const CANDIDATE_BALLOT_FINDING_CAP = 8;

/**
 * Exact verifier node authorization independent of candidate availability.
 */
export type CandidateBallotVerifierPlan = {
  /**
   * Contiguous stable verifier position.
   */
  readonly ordinal: number;
  /**
   * Canonical cross-provider model identity.
   */
  readonly modelId: RosterModelId;
};

/**
 * Candidate I immutable graph and protocol binding.
 */
export type CandidateBallotManifest = {
  /**
   * Manifest schema version.
   */
  readonly version: 1;
  /**
   * Immutable shell identity.
   */
  readonly shellDigest: string;
  /**
   * Closed-world obligation identity.
   */
  readonly ledgerDigest: string;
  /**
   * Runtime-owned target-language syntax relations.
   */
  readonly targetBoundaries: readonly CandidateTargetBoundary[];
  /**
   * Hidden whole-document author authority.
   */
  readonly candidatePlan: readonly RealizationCandidatePlan[];
  /**
   * Fixed verifier positions crossed with each author ordinal.
   */
  readonly verifierPlan: readonly CandidateBallotVerifierPlan[];
  /**
   * Single provider selected before any node executes.
   */
  readonly providerSelection: RealizationProviderSelection;
  /**
   * Exact canonical-to-wire routes and output caps.
   */
  readonly providerRoutes: readonly CandidateBallotHyperModel[];
  /**
   * Digest binding provider route table into every node manifest identity.
   */
  readonly providerRouteDigest: string;
  /**
   * Canonical substantive author protocol identity.
   */
  readonly authorProtocolDigest: string;
  /**
   * Immutable author schema identity.
   */
  readonly authorSchemaDigest: string;
  /**
   * Canonical candidate-scoped verifier protocol identity.
   */
  readonly verifierProtocolDigest: string;
  /**
   * Bound finding capacity.
   */
  readonly findingCap: typeof CANDIDATE_BALLOT_FINDING_CAP;
  /**
   * Page-referenced images reaching every node.
   */
  readonly sourcePictures: readonly {
    /**
     * Repository-relative image name.
     */
    readonly assetName: string;
    /**
     * Image byte digest.
     */
    readonly digest: string;
  }[];
  /**
   * Statically finite graph width.
   */
  readonly payloadCountCeiling: typeof MAX_CANDIDATE_BALLOT_PAYLOAD_COUNT;
  /**
   * Author wave followed by candidate-scoped verifier wave.
   */
  readonly dependencyWaves: 2;
  /**
   * Self digest over every prior member.
   */
  readonly manifestDigest: string;
};

/**
 * Runtime-owned complete immutable-shell author candidate.
 */
export type CandidateBallotCandidate = {
  /**
   * Opaque manifest and ordinal alias.
   */
  readonly candidateId: string;
  /**
   * Non-priority author ordinal.
   */
  readonly candidateOrdinal: number;
  /**
   * Manifest binding.
   */
  readonly manifestDigest: string;
  /**
   * Hidden author model identity.
   */
  readonly modelId: RosterModelId;
  /**
   * Hidden fixed fallback priority.
   */
  readonly priority: number;
  /**
   * Post-boundary complete document.
   */
  readonly document: string;
  /**
   * Complete document digest.
   */
  readonly documentDigest: string;
  /**
   * Canonically ordered compiled anchor-slot digest.
   */
  readonly slotDigest: string;
  /**
   * Canonically ordered raw author-slot digest.
   */
  readonly rawSlotDigest: string;
  /**
   * Runtime-owned full candidate identity digest.
   */
  readonly candidateDigest: string;
  /**
   * Runtime-owned compiled slot segments used by verifier anchors.
   */
  readonly slots: Readonly<Record<string, string>>;
  /**
   * Raw model slot values retained for deterministic revalidation only.
   */
  readonly rawSlots: Readonly<Record<string, string>>;
  /**
   * Candidate-specific exact separator decisions.
   */
  readonly resolvedBoundaries: readonly ResolvedCandidateTargetBoundary[];
};

/**
 * Located bounded defect certificate linked by manifest index.
 */
export type CandidateBallotFinding = {
  /**
   * Compact obligation or global scope.
   */
  readonly scope: 'o' | 'g';
  /**
   * Subject index in relevant manifest sequence.
   */
  readonly manifestIndex: number;
  /**
   * Canonical defect vocabulary index.
   */
  readonly defectClassIndex: number;
  /**
   * Exact target evidence after deterministic boundary insertion.
   */
  readonly targetAnchors: readonly RealizationTargetAnchor[];
};

/**
 * Complete compact response for exactly one anonymous candidate.
 */
export type CandidateBallotResponse = {
  /**
   * Candidate alias copied from prompt.
   */
  readonly candidateId: string;
  /**
   * Candidate digest copied from prompt.
   */
  readonly candidateDigest: string;
  /**
   * One `p` or `d` code per obligation manifest row.
   */
  readonly obligationStatuses: string;
  /**
   * One `c` or `d` code per global criterion.
   */
  readonly globalStatuses: string;
  /**
   * Whether defects exceed retained finding capacity.
   */
  readonly overflow: boolean;
  /**
   * Bounded located defect certificates.
   */
  readonly findings: readonly CandidateBallotFinding[];
};

/**
 * Runtime-expanded manifest-indexed status row.
 */
export type CandidateBallotStatusRow = {
  /**
   * Obligation or global manifest sequence.
   */
  readonly scope: 'o' | 'g';
  /**
   * Index in relevant manifest sequence.
   */
  readonly manifestIndex: number;
  /**
   * Compact status copied from provider response.
   */
  readonly status: 'p' | 'c' | 'd';
};

/**
 * Runtime-owned verifier identity around one admitted candidate ballot.
 */
export type CandidateScopedBallot = {
  /**
   * Verifier model identity.
   */
  readonly verifierModelId: RosterModelId;
  /**
   * Candidate ordinal included in substantive prompt identity.
   */
  readonly candidateOrdinal: number;
  /**
   * Manifest binding.
   */
  readonly manifestDigest: string;
  /**
   * Complete candidate-scoped response.
   */
  readonly response: CandidateBallotResponse;
  /**
   * Runtime-expanded durable rows in obligation then global order.
   */
  readonly statusRows: readonly CandidateBallotStatusRow[];
};

/**
 * Complete terminal row for every manifested author.
 */
export type CandidateBallotAuthorSettlementRow = {
  /**
   * Author ordinal.
   */
  readonly ordinal: number;
  /**
   * Author model identity.
   */
  readonly modelId: RosterModelId;
  /**
   * Hidden fallback priority.
   */
  readonly priority: number;
  /**
   * Durable terminal state.
   */
  readonly state: 'completed' | 'spent-unusable';
  /**
   * Node-record digest.
   */
  readonly nodeRecordDigest: string;
  /**
   * Complete candidate only when admitted.
   */
  readonly candidate?: CandidateBallotCandidate;
};

/**
 * Runtime-owned total author settlement.
 */
export type CandidateBallotAuthorSettlement = {
  /**
   * Settlement schema version.
   */
  readonly version: 1;
  /**
   * Manifest binding.
   */
  readonly manifestDigest: string;
  /**
   * One row per author plan.
   */
  readonly rows: readonly CandidateBallotAuthorSettlementRow[];
  /**
   * Self digest over settlement identity.
   */
  readonly settlementDigest: string;
};

/**
 * Privacy-safe caller-guard rejection category.
 */
export type CandidateBallotGuardFailure =
  | 'anchor'
  | 'candidate-binding'
  | 'finding-shape'
  | 'json-syntax'
  | 'key-set'
  | 'overflow'
  | 'raw-duplicate'
  | 'status-alphabet'
  | 'status-length';

/**
 * Parsed response diagnosis without nullish absence sentinel.
 */
export type CandidateBallotDiagnosis =
  | { readonly kind: 'accepted' }
  | {
    /**
     * Rejected guard category.
     */
    readonly failure: CandidateBallotGuardFailure;
    readonly kind: 'rejected';
  };

/**
 * Private selection and evidence classification.
 */
export type CandidateBallotSelection = {
  /**
   * Selected complete candidate.
   */
  readonly candidate: CandidateBallotCandidate;
  /**
   * Distinct nonself clean verifier identities.
   */
  readonly cleanVerifierModelIds: readonly RosterModelId[];
  /**
   * Whether two nonself clean model families support selection.
   */
  readonly evidenceFloorMet: boolean;
  /**
   * Whether candidate reaches publication evidence with no dissent.
   */
  readonly productionEligible: boolean;
  /**
   * Exact independence claim.
   */
  readonly independenceScope: 'distinct-author-and-verifier-model-families';
  /**
   * Admitted verifier identities finding any defect.
   */
  readonly dissentingVerifierModelIds: readonly RosterModelId[];
  /**
   * Planned verifier identities without admitted ballot for selected candidate.
   */
  readonly abstainingVerifierModelIds: readonly RosterModelId[];
};

/**
 * Candidate I fixture input shared by manifest and verifier logic.
 */
export type CandidateBallotContext = {
  /**
   * Immutable graph manifest.
   */
  readonly manifest: CandidateBallotManifest;
  /**
   * Closed-world obligation ledger.
   */
  readonly ledger: RealizationObligationLedger;
};
