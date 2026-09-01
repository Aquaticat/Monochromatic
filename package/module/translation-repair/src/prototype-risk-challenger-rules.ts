// PROTOTYPE ONLY: Candidate M closed role, defect, and evidence policy.

import { hashContent, } from './document-node.ts';
import {
  CANDIDATE_M_DEFECT_CLASSES,
  CANDIDATE_M_MAX_FINDING_EVIDENCE,
  type CandidateMChallengerRole,
  type CandidateMDefectClass,
  type CandidateMSourceScope,
} from './prototype-risk-challenger-model.ts';

/**
 * Fidelity-only defect classes.
 */
export const CANDIDATE_M_FIDELITY_DEFECT_CLASSES: readonly CandidateMDefectClass[] = [
  'wrong-meaning',
  'omission',
  'unsupported-addition',
  'identity-attribution',
  'chronology',
  'technical-legal-term',
  'image-relation',
];

/**
 * Publication-language-only defect classes.
 */
export const CANDIDATE_M_LANGUAGE_DEFECT_CLASSES: readonly CandidateMDefectClass[] = [
  'grammar-usage',
  'tense',
  'register',
  'source-language-calque',
  'paragraph-coherence',
  'contributor-voice',
];

/**
 * Shared cross-role veto classes.
 */
export const CANDIDATE_M_SHARED_DEFECT_CLASSES: readonly CandidateMDefectClass[] = [
  'actor-reference',
  'event-ownership',
  'reference-attachment',
];

/**
 * Front-matter source classes.
 */
const FRONT_MATTER_CLASSES: readonly CandidateMDefectClass[] = [
  'wrong-meaning',
  'omission',
  'unsupported-addition',
  'identity-attribution',
  'actor-reference',
  'reference-attachment',
  'grammar-usage',
  'tense',
  'register',
  'source-language-calque',
  'contributor-voice',
];

/**
 * Relation source classes.
 */
const RELATION_CLASSES: readonly CandidateMDefectClass[] = [
  'wrong-meaning',
  'omission',
  'unsupported-addition',
  'actor-reference',
  'event-ownership',
  'reference-attachment',
  'chronology',
  'paragraph-coherence',
  'image-relation',
];

/**
 * Executable model-facing Candidate M rule packet.
 */
export type CandidateMEvidenceCardinalityRule = {
  readonly defectClass: CandidateMDefectClass;
  readonly sourceMinimum: number;
  readonly sourceMaximum: number;
  readonly targetMinimum: number;
  readonly targetMaximum: number;
  readonly imageMode: 'none' | 'required';
};

/**
 * Manifest-order class-specific evidence cardinality.
 */
const EVIDENCE_CARDINALITY: readonly CandidateMEvidenceCardinalityRule[] = CANDIDATE_M_DEFECT_CLASSES
  .map(function rule(defectClass,): CandidateMEvidenceCardinalityRule {
  /**
   * Whether class belongs to publication-language-only role.
   */
  const language = CANDIDATE_M_LANGUAGE_DEFECT_CLASSES.includes(defectClass,);
  /**
   * Whether class owns manifested image evidence.
   */
  const image = defectClass === 'image-relation';
  /**
   * Whether absence permits no exact target substring.
   */
  const omission = defectClass === 'omission';
  return {
    defectClass,
    sourceMinimum: language || image ? 0 : 1,
    sourceMaximum: language ? 1 : image ? 0 : CANDIDATE_M_MAX_FINDING_EVIDENCE,
    targetMinimum: omission ? 0 : 1,
    targetMaximum: omission ? 1 : CANDIDATE_M_MAX_FINDING_EVIDENCE,
    imageMode: image ? 'required' : 'none',
  };
},);

/**
 * Executable model-facing Candidate M rule packet.
 */
export type CandidateMChallengerRules = {
  readonly defectClasses: readonly CandidateMDefectClass[];
  readonly evidenceCardinality: readonly CandidateMEvidenceCardinalityRule[];
  readonly fidelity: readonly CandidateMDefectClass[];
  readonly language: readonly CandidateMDefectClass[];
  readonly shared: readonly CandidateMDefectClass[];
  readonly sourceScopes: {
    readonly frontMatter: readonly CandidateMDefectClass[];
    readonly clause: readonly CandidateMDefectClass[];
    readonly relation: readonly CandidateMDefectClass[];
  };
  readonly verdictCardinality: {
    readonly clean: 0;
    readonly defect: 1;
  };
};

/**
 * Complete executable challenger rules sent to every role.
 */
export const CANDIDATE_M_CHALLENGER_RULES: CandidateMChallengerRules = {
  defectClasses: CANDIDATE_M_DEFECT_CLASSES,
  evidenceCardinality: EVIDENCE_CARDINALITY,
  fidelity: CANDIDATE_M_FIDELITY_DEFECT_CLASSES,
  language: CANDIDATE_M_LANGUAGE_DEFECT_CLASSES,
  shared: CANDIDATE_M_SHARED_DEFECT_CLASSES,
  sourceScopes: {
    frontMatter: FRONT_MATTER_CLASSES,
    clause: CANDIDATE_M_DEFECT_CLASSES,
    relation: RELATION_CLASSES,
  },
  verdictCardinality: {
    clean: 0,
    defect: 1,
  },
};

/**
 * Candidate M closed challenger-rule identity.
 */
export const CANDIDATE_M_CHALLENGER_RULE_DIGEST: string = hashContent({
  content: JSON.stringify(CANDIDATE_M_CHALLENGER_RULES,),
});

/**
 * Defect classes admitted by one challenger role.
 *
 * @param role - Fixed whole-page responsibility
 *
 * @returns Role-exclusive classes followed by shared veto classes
 *
 * @example
 * ```ts
 * const classes = candidateMDefectClassesForRole('fidelity',);
 * ```
 */
export function candidateMDefectClassesForRole(
  role: CandidateMChallengerRole,
): readonly CandidateMDefectClass[] {
  return role === 'fidelity'
    ? [
      ...CANDIDATE_M_FIDELITY_DEFECT_CLASSES,
      ...CANDIDATE_M_SHARED_DEFECT_CLASSES,
    ]
    : [
      ...CANDIDATE_M_LANGUAGE_DEFECT_CLASSES,
      ...CANDIDATE_M_SHARED_DEFECT_CLASSES,
    ];
}

/**
 * Whether role can return defect class without atomic abstention.
 *
 * @returns Exact role authorization
 *
 * @example
 * ```ts
 * const allowed = candidateMRoleAllows({ role: 'fidelity', defectClass: 'wrong-meaning', });
 * ```
 */
export function candidateMRoleAllows({
  role,
  defectClass,
}: {
  readonly role: CandidateMChallengerRole;
  readonly defectClass: CandidateMDefectClass;
}): boolean {
  if (CANDIDATE_M_SHARED_DEFECT_CLASSES.includes(defectClass,))
    return true;
  return role === 'fidelity'
    ? CANDIDATE_M_FIDELITY_DEFECT_CLASSES.includes(defectClass,)
    : CANDIDATE_M_LANGUAGE_DEFECT_CLASSES.includes(defectClass,);
}

/**
 * Whether source namespace permits defect class.
 *
 * @returns Exact class-to-source-scope authorization
 *
 * @example
 * ```ts
 * const allowed = candidateMSourceScopeAllows({ scope: 'relation', defectClass: 'chronology', });
 * ```
 */
export function candidateMSourceScopeAllows({
  scope,
  defectClass,
}: {
  readonly scope: CandidateMSourceScope;
  readonly defectClass: CandidateMDefectClass;
}): boolean {
  if (scope === 'clause')
    return true;
  if (scope === 'front-matter')
    return FRONT_MATTER_CLASSES.includes(defectClass,);
  return RELATION_CLASSES.includes(defectClass,);
}

/**
 * Resolves exact class-specific evidence cardinality.
 *
 * @param defectClass - Closed Candidate M class
 *
 * @returns Manifest-order executable evidence rule
 *
 * @example
 * ```ts
 * const rule = candidateMEvidenceCardinality('omission',);
 * ```
 */
export function candidateMEvidenceCardinality(
  defectClass: CandidateMDefectClass,
): CandidateMEvidenceCardinalityRule {
  /**
   * Exact rule matching closed class.
   */
  const rule = EVIDENCE_CARDINALITY.find(function same(value,) {
    return value.defectClass === defectClass;
  },);
  if (rule === undefined)
    throw new Error(`Candidate M evidence cardinality is absent for ${defectClass}`);
  return rule;
}

/**
 * Whether defect class requires source evidence.
 *
 * @param defectClass - Closed Candidate M class
 *
 * @returns Minimum namespaced source-subject count
 *
 * @example
 * ```ts
 * const count = candidateMMinimumSourceEvidence('wrong-meaning',);
 * ```
 */
export function candidateMMinimumSourceEvidence(defectClass: CandidateMDefectClass,): number {
  return candidateMEvidenceCardinality(defectClass,)
    .sourceMinimum;
}

/**
 * Whether defect class requires target evidence.
 *
 * @param defectClass - Closed Candidate M class
 *
 * @returns Minimum exact target-anchor count
 *
 * @example
 * ```ts
 * const count = candidateMMinimumTargetAnchors('omission',);
 * ```
 */
export function candidateMMinimumTargetAnchors(defectClass: CandidateMDefectClass,): number {
  return candidateMEvidenceCardinality(defectClass,)
    .targetMinimum;
}

/**
 * Whether defect class requires image evidence.
 *
 * @param defectClass - Closed Candidate M class
 *
 * @returns Minimum manifested image-index count
 *
 * @example
 * ```ts
 * const count = candidateMMinimumImageEvidence('image-relation',);
 * ```
 */
export function candidateMMinimumImageEvidence(defectClass: CandidateMDefectClass,): number {
  return candidateMEvidenceCardinality(defectClass,)
    .imageMode
    === 'required' ? 1 : 0;
}
