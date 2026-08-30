// PROTOTYPE ONLY: Candidate G bounded realization-ledger data model.

import type { ConditionalDefectClass, } from './prototype-conditional-audit-model.ts';
import type { RosterModelId, } from './roster-id.ts';

//region Bounds

/**
 * Maximum source obligations one calibration manifest may carry.
 */
export const MAX_REALIZATION_OBLIGATIONS = 192;

/**
 * Maximum source spans composing one obligation.
 */
export const MAX_REALIZATION_SOURCE_SPANS = 3;

/**
 * Maximum relation endpoints one obligation may join.
 */
export const MAX_REALIZATION_RELATION_ENDPOINTS = 4;

/**
 * Maximum target anchors one source obligation may claim.
 */
export const MAX_REALIZATION_TARGET_ANCHORS = 3;

/**
 * Maximum whole candidates one verifier ballot may cover.
 */
export const MAX_REALIZATION_CANDIDATES = 4;

/**
 * Maximum verifier identities one calibration manifest may carry.
 */
export const MAX_REALIZATION_VERIFIERS = 3;

/**
 * Maximum located findings one verifier may return for one candidate.
 */
export const MAX_REALIZATION_FINDINGS = 64;

/**
 * Maximum target anchors one located finding may cite.
 */
export const MAX_REALIZATION_FINDING_ANCHORS = 3;

/**
 * Maximum UTF-16 code units one manifest source span may cover.
 */
export const MAX_REALIZATION_SOURCE_SPAN_LENGTH = 2_000;

//endregion Bounds

//region Identity and coordinate vocabulary

/**
 * Stable manifest-owned source obligation identity.
 */
export type RealizationObligationId = string;

/**
 * Opaque candidate alias shown to verifiers without model or priority.
 */
export type RealizationCandidateId = string;

/**
 * Half-open UTF-16 source range after LF normalization.
 */
export type RealizationSourceSpan = {
  readonly namespace: 'source-body' | 'archive-body';
  readonly startOffset: number;
  readonly endOffset: number;
  readonly digest: string;
};

/**
 * Manifest-owned translatable source slot range and digest.
 */
export type RealizationSourceSlot = {
  readonly slotKey: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly digest: string;
};

/**
 * Half-open UTF-16 range relative to one compiled immutable-shell slot.
 */
export type RealizationTargetAnchor = {
  readonly slotKey: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly digest: string;
};

//endregion Identity and coordinate vocabulary

//region Manifest obligations

/**
 * Closed set of deterministic obligation roles.
 */
export type RealizationObligationKind =
  | 'clause'
  | 'relation'
  | 'identity'
  | 'link'
  | 'media'
  | 'format'
  | 'archive-authority';

/**
 * Authority controlling whether source, archive, or shell owns wording.
 */
export type RealizationAuthority = 'source' | 'archive-allowed' | 'shell-locked';

/**
 * Cardinality controlling author target-anchor requirement.
 */
export type RealizationTargetCardinality = 'one-or-more' | 'shell-owned';

/**
 * One finite source or shell obligation fixed before provider contact.
 */
export type RealizationObligation = {
  readonly id: RealizationObligationId;
  readonly kind: RealizationObligationKind;
  readonly sourceSpans: readonly RealizationSourceSpan[];
  readonly relationEndpoints: readonly RealizationObligationId[];
  readonly allowedTargetSlotKeys: readonly string[];
  readonly targetCardinality: RealizationTargetCardinality;
  readonly authority: RealizationAuthority;
  readonly evidenceDigest: string;
};

/**
 * Immutable ordered obligation ledger bound into calibration manifest.
 */
export type RealizationObligationLedger = {
  readonly offsetEncoding: 'utf16-code-unit';
  readonly rangeConvention: 'half-open';
  readonly lineEndings: 'lf';
  readonly digestAlgorithm: 'sha256';
  readonly shellDigest: string;
  readonly sourceBodyDigest: string;
  readonly archiveBodyDigest: string;
  readonly sourceSlots: readonly RealizationSourceSlot[];
  readonly obligations: readonly RealizationObligation[];
};

//endregion Manifest obligations

//region Author response and admitted candidate

/**
 * Duplicate-detectable author claim for one manifest obligation.
 */
export type RealizationClaim = {
  readonly obligationId: RealizationObligationId;
  readonly targetAnchors: readonly RealizationTargetAnchor[];
};

/**
 * Raw author wire response before runtime-owned bindings attach.
 */
export type RealizationAuthorResponse = {
  readonly slots: readonly {
    readonly slotKey: string;
    readonly text: string;
  }[];
  readonly realization: readonly RealizationClaim[];
};

/** Manifest-owned author identity and priority authorization. */
export type RealizationCandidatePlan = {
  readonly ordinal: number;
  readonly modelId: RosterModelId;
  readonly priority: number;
};

/** Immutable finite Candidate G plan and canonical identity. */
export type RealizationManifest = {
  readonly version: 1;
  readonly shellDigest: string;
  readonly ledgerDigest: string;
  readonly candidatePlan: readonly RealizationCandidatePlan[];
  readonly verifierModelIds: readonly RosterModelId[];
  readonly payloadCeiling: number;
  readonly dependencyWaves: 2;
  readonly manifestDigest: string;
};

/**
 * Structurally admitted whole candidate with runtime-owned identity.
 */
export type RealizedCandidate = {
  readonly candidateId: RealizationCandidateId;
  readonly candidateOrdinal: number;
  readonly manifestDigest: string;
  readonly modelId: RosterModelId;
  readonly priority: number;
  readonly document: string;
  readonly documentDigest: string;
  readonly slotDigest: string;
  readonly realizationDigest: string;
  readonly candidateDigest: string;
  readonly slots: Readonly<Record<string, string>>;
  readonly realization: Readonly<Record<RealizationObligationId, readonly RealizationTargetAnchor[]>>;
};

//endregion Author response and admitted candidate

//region Verifier response

/**
 * Global criteria requiring explicit clean or defect state per candidate.
 */
export const REALIZATION_GLOBAL_CRITERIA = [
  'unsupported-addition',
  'identity-attribution',
  'actor-reference',
  'chronology',
  'technical-legal-term',
  'grammar-usage',
  'tense',
  'register',
  'paragraph-relation',
  'source-language-calque',
] as const;

/**
 * One verifier-wide candidate quality criterion.
 */
export type RealizationGlobalCriterion = typeof REALIZATION_GLOBAL_CRITERIA[number];

/**
 * Explicit verifier status for one source obligation.
 */
export type RealizationObligationStatus = {
  readonly obligationId: RealizationObligationId;
  readonly obligationEvidenceDigest: string;
  readonly status: 'preserved' | 'defect';
  readonly verifiedTargetAnchors: readonly RealizationTargetAnchor[];
};

/**
 * Explicit verifier status for one global criterion.
 */
export type RealizationGlobalStatus = {
  readonly criterion: RealizationGlobalCriterion;
  readonly status: 'clean' | 'defect';
};

/**
 * Finding linked to exactly one manifest source obligation.
 */
export type RealizationObligationFinding = {
  readonly scope: 'obligation';
  readonly obligationId: RealizationObligationId;
  readonly defectClass: ConditionalDefectClass;
  readonly targetAnchors: readonly RealizationTargetAnchor[];
};

/**
 * Finding linked to one candidate-wide criterion.
 */
export type RealizationGlobalFinding = {
  readonly scope: 'global';
  readonly criterion: RealizationGlobalCriterion;
  readonly defectClass: ConditionalDefectClass;
  readonly targetAnchors: readonly RealizationTargetAnchor[];
};

/**
 * Located verifier evidence without free-form explanation or corpus quote.
 */
export type RealizationFinding = RealizationObligationFinding | RealizationGlobalFinding;

/**
 * One candidate matrix inside verifier wire response.
 */
export type RealizationCandidateVerification = {
  readonly candidateId: RealizationCandidateId;
  readonly candidateDigest: string;
  readonly obligations: readonly RealizationObligationStatus[];
  readonly globalChecks: readonly RealizationGlobalStatus[];
  readonly findings: readonly RealizationFinding[];
};

/**
 * Raw verifier response with duplicate-detectable candidate rows.
 */
export type RealizationVerifierResponse = {
  readonly candidates: readonly RealizationCandidateVerification[];
};

/**
 * Runtime-owned binding around one structurally admitted verifier response.
 */
export type RealizationVerifierBallot = {
  readonly verifierModelId: RosterModelId;
  readonly manifestDigest: string;
  readonly response: RealizationVerifierResponse;
};

/**
 * Calibration selection preserving evidence floor without publishing.
 */
export type RealizationSelection = {
  readonly candidate: RealizedCandidate;
  readonly cleanVerifierModelIds: readonly RosterModelId[];
  readonly evidenceFloorMet: boolean;
  readonly independenceScope: 'distinct-author-and-verifier-model-identities-only';
  readonly dissentingVerifierModelIds: readonly RosterModelId[];
  readonly abstainingVerifierModelIds: readonly RosterModelId[];
};

//endregion Verifier response
