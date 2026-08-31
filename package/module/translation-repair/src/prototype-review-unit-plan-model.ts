// PROTOTYPE ONLY: Candidate K readable review-plan data model.

import {
  MAX_REALIZATION_OBLIGATIONS,
  type RealizationGlobalCriterion,
  type RealizationSourceSpan,
} from './prototype-realization-model.ts';

/**
 * Maximum translatable slot groups in one Candidate K plan.
 */
export const MAX_REVIEW_UNIT_SLOT_GROUPS = 192;

/**
 * Maximum semantic front-matter string subjects.
 */
export const MAX_REVIEW_UNIT_FRONT_MATTER_SUBJECTS = 32;

/**
 * Maximum readable clause subjects in one Candidate K plan.
 */
export const MAX_REVIEW_UNIT_CLAUSES: number = MAX_REALIZATION_OBLIGATIONS;

/**
 * Maximum ordered inter-slot relation subjects in one Candidate K plan.
 */
export const MAX_REVIEW_UNIT_RELATIONS = 191;

/**
 * Closed page-level subjects retaining cross-unit quality ownership.
 */
export const REVIEW_UNIT_GLOBAL_CRITERIA = [
  'cross-slot-actor-identity-coreference',
  'cross-slot-chronology-semantic-relation',
  'technical-legal-terminology-consistency',
  'document-grammar-tense-register-coherence',
  'contributor-voice-authority',
  'source-image-target-relation',
] as const;

/**
 * Actor and coreference global position.
 */
export const REVIEW_UNIT_GLOBAL_ACTOR_INDEX = 0;

/**
 * Chronology and relation global position.
 */
export const REVIEW_UNIT_GLOBAL_RELATION_INDEX = 1;

/**
 * Terminology consistency global position.
 */
export const REVIEW_UNIT_GLOBAL_TERM_INDEX = 2;

/**
 * Document language coherence global position.
 */
export const REVIEW_UNIT_GLOBAL_LANGUAGE_INDEX = 3;

/**
 * Contributor voice and authority global position.
 */
export const REVIEW_UNIT_GLOBAL_AUTHORITY_INDEX = 4;

/**
 * Source-image-target relation global position.
 */
export const REVIEW_UNIT_GLOBAL_IMAGE_INDEX = 5;

/**
 * One Candidate K page-level global criterion.
 */
export type ReviewUnitGlobalCriterion = typeof REVIEW_UNIT_GLOBAL_CRITERIA[number];

/**
 * One semantic string leaf from source and target front matter.
 */
export type ReviewUnitFrontMatterSubject = {
  /**
   * Canonical front-matter subject position.
   */
  readonly subjectIndex: number;
  /**
   * YAML object path identifying semantic field.
   */
  readonly path: readonly string[];
  /**
   * Synthetic candidate slot used by exact target anchors.
   */
  readonly targetSlotKey: string;
  /**
   * Source-authority value, empty only for unsupported target field.
   */
  readonly sourceText: string;
  /**
   * Candidate front-matter value, empty only for omitted field.
   */
  readonly targetText: string;
  /**
   * Exact source semantic value digest.
   */
  readonly sourceDigest: string;
  /**
   * Exact target semantic value digest.
   */
  readonly targetDigest: string;
};

/**
 * Readable source evidence bound to canonical UTF-16 range.
 */
export type ReviewUnitSourceEvidence = RealizationSourceSpan & {
  /**
   * Exact source or archive substring at bound range.
   */
  readonly text: string;
};

/**
 * One clause obligation retaining individual verifier status.
 */
export type ReviewUnitClauseSubject = {
  /**
   * Canonical flat clause position.
   */
  readonly subjectIndex: number;
  /**
   * Original obligation identity.
   */
  readonly obligationId: string;
  /**
   * Immutable shell slot receiving target wording.
   */
  readonly slotKey: string;
  /**
   * Readable source evidence positions.
   */
  readonly sourceEvidenceIndexes: readonly number[];
  /**
   * Authority controlling semantic comparison.
   */
  readonly authority: 'archive-allowed' | 'shell-locked' | 'source';
  /**
   * Candidate slots authorized for target findings.
   */
  readonly allowedTargetSlotKeys: readonly string[];
  /**
   * Original obligation evidence identity.
   */
  readonly evidenceDigest: string;
};

/**
 * Readable group for clauses sharing one immutable target slot.
 */
export type ReviewUnitSlotGroup = {
  /**
   * Canonical slot-group position.
   */
  readonly groupIndex: number;
  /**
   * Immutable shell slot key.
   */
  readonly slotKey: string;
  /**
   * Complete source wording assigned to slot.
   */
  readonly sourceText: string;
  /**
   * Complete source-slot digest.
   */
  readonly sourceDigest: string;
  /**
   * Ordered flat clause positions carried by group.
   */
  readonly clauseSubjectIndexes: readonly number[];
};

/**
 * Ordered adjacent-source-slot semantic relation.
 */
export type ReviewUnitRelationSubject = {
  /**
   * Canonical relation position.
   */
  readonly subjectIndex: number;
  /**
   * Original obligation identity.
   */
  readonly obligationId: string;
  /**
   * Deterministic relation vocabulary.
   */
  readonly kind: 'adjacent-source-slot';
  /**
   * Ordered left then right clause positions.
   */
  readonly endpointClauseSubjectIndexes: readonly number[];
  /**
   * Readable endpoint source evidence positions.
   */
  readonly sourceEvidenceIndexes: readonly number[];
  /**
   * Authority controlling relation comparison.
   */
  readonly authority: 'archive-allowed' | 'shell-locked' | 'source';
  /**
   * Candidate slots authorized for relation findings.
   */
  readonly allowedTargetSlotKeys: readonly string[];
  /**
   * Original obligation evidence identity.
   */
  readonly evidenceDigest: string;
};

/**
 * Explicit successor owners for one prior global criterion.
 */
export type ReviewUnitGlobalOwnership = {
  /**
   * Candidate I criterion retained by mapping.
   */
  readonly priorCriterion: RealizationGlobalCriterion;
  /**
   * Candidate K global subjects owning page-level aspect.
   */
  readonly globalIndexes: readonly number[];
  /**
   * Whether every clause status also owns aspect.
   */
  readonly clauseOwned: boolean;
  /**
   * Whether relation statuses also own aspect.
   */
  readonly relationOwned: boolean;
  /**
   * Whether slot-language statuses also own aspect.
   */
  readonly languageOwned: boolean;
};

/**
 * Candidate-independent readable review template fixed before provider contact.
 */
export type ReviewUnitPlan = {
  /**
   * Plan schema version.
   */
  readonly version: 1;
  /**
   * Immutable shell binding.
   */
  readonly shellDigest: string;
  /**
   * Closed-world ledger binding.
   */
  readonly ledgerDigest: string;
  /**
   * Semantic source and target front-matter fields.
   */
  readonly frontMatterSubjects: readonly ReviewUnitFrontMatterSubject[];
  /**
   * Deterministically equal front-matter key and container identity.
   */
  readonly frontMatterStructureDigest: string;
  /**
   * Deterministically equal non-string front-matter scalar identity.
   */
  readonly frontMatterScalarDigest: string;
  /**
   * Canonical readable source evidence catalog.
   */
  readonly sourceEvidence: readonly ReviewUnitSourceEvidence[];
  /**
   * Every clause obligation in ledger order.
   */
  readonly clauses: readonly ReviewUnitClauseSubject[];
  /**
   * Clause groups in immutable slot order.
   */
  readonly slotGroups: readonly ReviewUnitSlotGroup[];
  /**
   * Every ordered adjacent-slot relation in ledger order.
   */
  readonly relations: readonly ReviewUnitRelationSubject[];
  /**
   * Fixed global quality subjects.
   */
  readonly globalCriteria: typeof REVIEW_UNIT_GLOBAL_CRITERIA;
  /**
   * Coverage of every prior global criterion.
   */
  readonly priorGlobalOwnership: readonly ReviewUnitGlobalOwnership[];
  /**
   * Self digest over every prior member.
   */
  readonly reviewPlanDigest: string;
};
