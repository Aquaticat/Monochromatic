// PROTOTYPE ONLY: Candidate K candidate-scoped compact-ballot vocabulary.

import type { RosterModelId, } from './roster-id.ts';
import type { ReviewUnitHyperModel, } from './prototype-review-unit-hyper.ts';
import type {
  RealizationCandidatePlan,
  RealizationObligationLedger,
  RealizationProviderSelection,
  RealizationTargetAnchor,
} from './prototype-realization-model.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import type {
  CandidateTargetBoundary,
  ResolvedCandidateTargetBoundary,
} from './prototype-target-boundary.ts';

/**
 * Fixed number of whole-document authors.
 */
export const REVIEW_UNIT_AUTHOR_COUNT = 3;

/**
 * Fixed number of independent verifier families per admitted candidate.
 */
export const REVIEW_UNIT_VERIFIER_COUNT = 3;

/**
 * Maximum provider payloads in three-author candidate-scoped graph.
 */
export const MAX_REVIEW_UNIT_PAYLOAD_COUNT = 12;

/**
 * Fixed number of lean whole-document authors.
 */
export const LEAN_REALIZATION_AUTHOR_COUNT = 2;

/**
 * Maximum provider payloads in two-author candidate-scoped graph.
 */
export const MAX_LEAN_REALIZATION_PAYLOAD_COUNT = 8;

/**
 * Maximum concrete defect certificates retained for one ballot.
 */
export const REVIEW_UNIT_FINDING_CAP = 64;

/**
 * Maximum exact target anchors retained by one finding.
 */
export const REVIEW_UNIT_MAX_TARGET_ANCHORS = 4;

/**
 * Closed defect vocabulary shared by Candidate K ballot scopes.
 */
export const REVIEW_UNIT_DEFECT_CLASSES = [
  'wrong-meaning',
  'omission',
  'unsupported-addition',
  'identity-attribution',
  'actor-reference',
  'chronology',
  'technical-legal-term',
  'grammar-usage',
  'tense',
  'register',
  'source-language-calque',
  'paragraph-relation',
  'image-relation',
] as const;

/**
 * One Candidate K defect classification.
 */
export type ReviewUnitDefectClass = typeof REVIEW_UNIT_DEFECT_CLASSES[number];

/**
 * Exact verifier node authorization independent of candidate availability.
 */
export type ReviewUnitVerifierPlan = {
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
 * Candidate K immutable graph and protocol binding.
 */
export type ReviewUnitManifest = {
  /**
   * Manifest schema version.
   */
  readonly version: 1 | 2;
  /**
   * Candidate L author protocol marker, absent from Candidate K.
   */
  readonly authorMode?: 'lean-realization';
  /**
   * Candidate L path-specific front-matter authority, absent from Candidate K.
   */
  readonly frontMatterAuthorityDigest?: string;
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
   * Readable candidate-independent review plan identity.
   */
  readonly reviewPlanDigest: string;
  /**
   * Hidden whole-document author authority.
   */
  readonly candidatePlan: readonly RealizationCandidatePlan[];
  /**
   * Fixed verifier positions crossed with each author ordinal.
   */
  readonly verifierPlan: readonly ReviewUnitVerifierPlan[];
  /**
   * Single provider selected before any node executes.
   */
  readonly providerSelection: RealizationProviderSelection;
  /**
   * Exact canonical-to-wire routes and output caps.
   */
  readonly providerRoutes: readonly ReviewUnitHyperModel[];
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
   * Model-facing scope and evidence-rule identity.
   */
  readonly verifierRuleDigest: string;
  /**
   * Bound finding capacity.
   */
  readonly findingCap: typeof REVIEW_UNIT_FINDING_CAP;
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
  readonly payloadCountCeiling:
    | typeof MAX_LEAN_REALIZATION_PAYLOAD_COUNT
    | typeof MAX_REVIEW_UNIT_PAYLOAD_COUNT;
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
export type ReviewUnitCandidate = {
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
   * Ordered mutable target slots, present for Candidate L.
   */
  readonly mutableSlotKeys?: readonly string[];
  /**
   * Runtime-authored front-matter serialization digest, present for Candidate L.
   */
  readonly frontMatterDigest?: string;
  /**
   * Candidate-specific exact separator decisions.
   */
  readonly resolvedBoundaries: readonly ResolvedCandidateTargetBoundary[];
  /**
   * Runtime-owned proof over mechanically decidable admission.
   */
  readonly deterministicProofDigest: string;
};

/**
 * Candidate K defect subject scope.
 */
export type ReviewUnitFindingScope = 'c' | 'fm' | 'g' | 'r' | 'sl';

/**
 * Located bounded defect witness linked by review subject.
 */
export type ReviewUnitFinding = {
  /**
   * Clause, relation, slot-language, or global scope.
   */
  readonly scope: ReviewUnitFindingScope;
  /**
   * Subject index in relevant review-plan sequence.
   */
  readonly subjectIndex: number;
  /**
   * Canonical defect vocabulary index.
   */
  readonly defectClassIndex: number;
  /**
   * Readable source evidence positions supporting witness.
   */
  readonly sourceEvidenceIndexes: readonly number[];
  /**
   * Manifest page-image positions supporting witness.
   */
  readonly imageEvidenceIndexes: readonly number[];
  /**
   * Exact target evidence after deterministic boundary insertion.
   */
  readonly targetAnchors: readonly RealizationTargetAnchor[];
};

/**
 * Complete compact response for exactly one anonymous candidate.
 */
export type ReviewUnitResponse = {
  /**
   * Candidate alias copied from prompt.
   */
  readonly candidateId: string;
  /**
   * Candidate digest copied from prompt.
   */
  readonly candidateDigest: string;
  /**
   * Readable review plan identity copied from prompt.
   */
  readonly reviewPlanDigest: string;
  /**
   * Deterministic admission proof copied from prompt.
   */
  readonly deterministicProofDigest: string;
  /**
   * One `p` or `d` code per semantic front-matter string.
   */
  readonly frontMatterStatuses: string;
  /**
   * One clause-status string per slot group.
   */
  readonly clauseStatusesBySlot: readonly string[];
  /**
   * One `p` or `d` code per relation subject.
   */
  readonly relationStatuses: string;
  /**
   * One `c` or `d` code per translatable slot.
   */
  readonly slotLanguageStatuses: string;
  /**
   * One `c` or `d` code per page-level global criterion.
   */
  readonly globalStatuses: string;
  /**
   * Whether defective subjects exceed retained finding capacity.
   */
  readonly overflow: boolean;
  /**
   * Bounded located defect witnesses.
   */
  readonly findings: readonly ReviewUnitFinding[];
};

/**
 * Runtime-expanded manifest-indexed status row.
 */
export type ReviewUnitStatusRow = {
  /**
   * Clause, relation, slot-language, or global scope.
   */
  readonly scope: ReviewUnitFindingScope;
  /**
   * Index in relevant review-plan sequence.
   */
  readonly subjectIndex: number;
  /**
   * Compact status copied from provider response.
   */
  readonly status: 'p' | 'c' | 'd';
};

/**
 * Runtime-owned verifier identity around one admitted review unit.
 */
export type ReviewUnitBallot = {
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
  readonly response: ReviewUnitResponse;
  /**
   * Runtime-expanded durable rows in obligation then global order.
   */
  readonly statusRows: readonly ReviewUnitStatusRow[];
};

/**
 * Complete terminal row for every manifested author.
 */
export type ReviewUnitAuthorSettlementRow = {
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
  readonly candidate?: ReviewUnitCandidate;
};

/**
 * Runtime-owned total author settlement.
 */
export type ReviewUnitAuthorSettlement = {
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
  readonly rows: readonly ReviewUnitAuthorSettlementRow[];
  /**
   * Self digest over settlement identity.
   */
  readonly settlementDigest: string;
};

/**
 * Privacy-safe caller-guard rejection categories.
 */
export const REVIEW_UNIT_GUARD_FAILURES = [
  'anchor',
  'candidate-binding',
  'finding-shape',
  'json-syntax',
  'key-set',
  'overflow',
  'raw-duplicate',
  'status-alphabet',
  'status-length',
] as const;

/**
 * One privacy-safe caller-guard rejection category.
 */
export type ReviewUnitGuardFailure = typeof REVIEW_UNIT_GUARD_FAILURES[number];

/**
 * Parsed response diagnosis without nullish absence sentinel.
 */
export type ReviewUnitDiagnosis =
  | { readonly kind: 'accepted' }
  | {
    /**
     * Rejected guard category.
     */
    readonly failure: ReviewUnitGuardFailure;
    readonly kind: 'rejected';
  };

/**
 * Private selection and evidence classification.
 */
export type ReviewUnitSelection = {
  /**
   * Selected complete candidate.
   */
  readonly candidate: ReviewUnitCandidate;
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
 * Candidate K fixture input shared by manifest and verifier logic.
 */
export type ReviewUnitContext = {
  /**
   * Immutable graph manifest.
   */
  readonly manifest: ReviewUnitManifest;
  /**
   * Closed-world obligation ledger.
   */
  readonly ledger: RealizationObligationLedger;
  /**
   * Readable review plan fixed before provider contact.
   */
  readonly reviewPlan: ReviewUnitPlan;
};
