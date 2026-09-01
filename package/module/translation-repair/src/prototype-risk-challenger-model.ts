// PROTOTYPE ONLY: Candidate M risk-attested author and role-split challenger vocabulary.

import type { RosterModelId, } from './roster-id.ts';
import type { ReviewUnitCandidate, } from './prototype-review-unit-model.ts';
import type { ReviewUnitNodeRecord, } from './prototype-review-unit-node-record.ts';
import type { RealizationTargetAnchor, } from './prototype-realization-model.ts';

//region Static graph identity -- closes Candidate M topology before provider contact.

/**
 * Candidate M manifest architecture discriminator.
 */
export const CANDIDATE_M_ARCHITECTURE = 'candidate-m-risk-challenger' as const;

/* oxlint-disable no-magic-numbers -- Manifest version 3 is externally persisted protocol identity. */
/**
 * Candidate M manifest schema version.
 */
export const CANDIDATE_M_MANIFEST_VERSION = 3 as const;
/* oxlint-enable no-magic-numbers */

/**
 * Fixed Candidate M author count.
 */
export const CANDIDATE_M_AUTHOR_COUNT = 2;

/**
 * Fixed whole-page challenger roles.
 */
export const CANDIDATE_M_CHALLENGER_ROLES = [
  'fidelity',
  'publication-language',
] as const;

/**
 * One whole-page challenger responsibility.
 */
export type CandidateMChallengerRole = typeof CANDIDATE_M_CHALLENGER_ROLES[number];

/* oxlint-disable no-magic-numbers -- Three manifested verifier families are external graph identity. */
/**
 * Fixed Candidate M challenger model-family count.
 */
export const CANDIDATE_M_CHALLENGER_FAMILY_COUNT = 3 as const;
/* oxlint-enable no-magic-numbers */

/**
 * Maximum provider payloads in Candidate M graph.
 */
export const MAX_CANDIDATE_M_PAYLOAD_COUNT = 14;

/**
 * Candidate M author deadline in milliseconds.
 */
export const CANDIDATE_M_AUTHOR_TIMEOUT_MS = 1_800_000;

/**
 * Candidate M challenger deadline in milliseconds.
 */
export const CANDIDATE_M_CHALLENGER_TIMEOUT_MS = 900_000;

//endregion Static graph identity

/**
 * Privacy-safe Candidate M caller-guard categories.
 */
export const CANDIDATE_M_GUARD_FAILURES = [
  'anchor',
  'attestation-code',
  'attestation-key-order',
  'candidate-binding',
  'finding-shape',
  'key-set',
  'raw-duplicate',
  'role',
  'source-scope',
  'verdict-finding-cardinality',
] as const;

/**
 * One privacy-safe Candidate M caller-guard category.
 */
export type CandidateMGuardFailure = typeof CANDIDATE_M_GUARD_FAILURES[number];

//region Risk-attested authors -- attention evidence remains selection-blind.

/**
 * Manifest-owned risk-attestation order.
 */
export const CANDIDATE_M_RISK_KEYS = [
  'actorAttribution',
  'eventOwnershipSequence',
  'temporalPronominalReference',
  'unsupportedEmphasis',
  'sourceImageRelation',
  'memorialRegisterContributorVoice',
] as const;

/**
 * One closed author risk class.
 */
export type CandidateMRiskKey = typeof CANDIDATE_M_RISK_KEYS[number];

/**
 * Sole Candidate M author attestation code.
 */
export const CANDIDATE_M_RISK_CODE = 'checked' as const;

/**
 * Exact manifest-ordered risk-attestation object.
 */
export type CandidateMRiskAttestations = Readonly<Record<
  CandidateMRiskKey,
  typeof CANDIDATE_M_RISK_CODE
>>;

/**
 * Candidate M provider author response.
 */
export type CandidateMAuthorResponse = {
  /**
   * Exact 27 mutable publication values.
   */
  readonly slots: Readonly<Record<string, string>>;
  /**
   * Exact six-key selection-blind attention evidence.
   */
  readonly riskAttestations: CandidateMRiskAttestations;
};

/**
 * Candidate M admitted candidate with risk-bound proof identity.
 */
export type CandidateMCandidate = Omit<
  ReviewUnitCandidate,
  'candidateDigest' | 'deterministicProofDigest'
> & {
  /**
   * Candidate identity before Candidate M risk binding.
   */
  readonly baseCandidateDigest: string;
  /**
   * Deterministic proof before Candidate M risk binding.
   */
  readonly baseDeterministicProofDigest: string;
  /**
   * Exact author attention evidence.
   */
  readonly riskAttestations: CandidateMRiskAttestations;
  /**
   * Canonical risk-attestation object digest.
   */
  readonly riskAttestationDigest: string;
  /**
   * Risk-bound deterministic proof identity.
   */
  readonly deterministicProofDigest: string;
  /**
   * Risk-bound complete candidate identity.
   */
  readonly candidateDigest: string;
};

/**
 * Terminal Candidate M author state.
 */
export type CandidateMAuthorState = {
  /**
   * Durable static author record.
   */
  readonly record: ReviewUnitNodeRecord<CandidateMGuardFailure>;
  /**
   * Complete risk-bound candidate after admission.
   */
  readonly candidate?: CandidateMCandidate;
};

//endregion Risk-attested authors

//region Challenger findings -- one atomic counterexample or clean assertion.

/**
 * Maximum source or target evidence members in one finding.
 */
export const CANDIDATE_M_MAX_FINDING_EVIDENCE = 4;

/**
 * Candidate M closed defect vocabulary.
 */
export const CANDIDATE_M_DEFECT_CLASSES = [
  'wrong-meaning',
  'omission',
  'unsupported-addition',
  'identity-attribution',
  'chronology',
  'technical-legal-term',
  'image-relation',
  'grammar-usage',
  'tense',
  'register',
  'source-language-calque',
  'paragraph-coherence',
  'contributor-voice',
  'actor-reference',
  'event-ownership',
  'reference-attachment',
] as const;

/**
 * One Candidate M publication-blocking defect class.
 */
export type CandidateMDefectClass = typeof CANDIDATE_M_DEFECT_CLASSES[number];

/**
 * Source-review namespace for one exact subject index.
 */
export type CandidateMSourceScope = 'clause' | 'front-matter' | 'relation';

/**
 * One namespaced source-review subject reference.
 */
export type CandidateMSourceEvidence = {
  /**
   * Review-plan sequence selecting index namespace.
   */
  readonly scope: CandidateMSourceScope;
  /**
   * Index inside selected review-plan sequence.
   */
  readonly subjectIndex: number;
};

/**
 * One bounded Candidate M defect witness.
 */
export type CandidateMFinding = {
  /**
   * Closed class subject to exact role and scope policy.
   */
  readonly defectClass: CandidateMDefectClass;
  /**
   * Namespaced source evidence with class-specific cardinality.
   */
  readonly sourceEvidence: readonly CandidateMSourceEvidence[];
  /**
   * Exact candidate substring anchors.
   */
  readonly targetAnchors: readonly RealizationTargetAnchor[];
  /**
   * Manifest page-image positions.
   */
  readonly imageEvidenceIndexes: readonly number[];
};

/**
 * Candidate M atomic whole-role response.
 */
export type CandidateMChallengeResponse = {
  /**
   * Anonymous candidate alias copied exactly from prompt.
   */
  readonly candidateId: string;
  /**
   * Risk-bound candidate digest copied exactly from prompt.
   */
  readonly candidateDigest: string;
  /**
   * Risk-bound deterministic proof copied exactly from prompt.
   */
  readonly deterministicProofDigest: string;
  /**
   * Source-only readable review-plan identity.
   */
  readonly sourceReviewPlanDigest: string;
  /**
   * Fixed challenger responsibility copied exactly from prompt.
   */
  readonly role: CandidateMChallengerRole;
  /**
   * Whole-role clean assertion or one decisive counterexample.
   */
  readonly verdict: 'clean' | 'defect';
  /**
   * Empty for clean and exactly one for defect.
   */
  readonly findings: readonly CandidateMFinding[];
};

/**
 * Admitted Candidate M challenge with verifier identity.
 */
export type CandidateMChallenge = CandidateMChallengeResponse & {
  /**
   * Canonical verifier model identity.
   */
  readonly verifierModelId: RosterModelId;
  /**
   * Manifested verifier ordinal.
   */
  readonly verifierOrdinal: number;
  /**
   * Complete admitted response digest.
   */
  readonly challengeDigest: string;
};

/**
 * Candidate M challenge guard result.
 */
export type CandidateMChallengeDiagnosis =
  | { readonly kind: 'accepted' }
  | {
    readonly kind: 'rejected';
    readonly failure: CandidateMGuardFailure;
  };

/**
 * Terminal Candidate M challenger node state.
 */
export type CandidateMChallengeState = {
  /**
   * Durable static node record.
   */
  readonly record: ReviewUnitNodeRecord<CandidateMGuardFailure>;
  /**
   * Atomic admitted challenge, absent after abstention.
   */
  readonly challenge?: CandidateMChallenge;
};

//endregion Challenger findings
