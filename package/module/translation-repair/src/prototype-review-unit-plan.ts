// PROTOTYPE ONLY: Candidate K readable verifier evidence plan.

import { hashContent, } from './document-node.ts';
import { splitFrontMatter, } from './front-matter.ts';
import {
  MAX_REALIZATION_OBLIGATIONS,
  REALIZATION_GLOBAL_CRITERIA,
  type RealizationGlobalCriterion,
  type RealizationObligationLedger,
  type RealizationSourceSpan,
} from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/** Maximum translatable slot groups in one Candidate K plan. */
export const MAX_REVIEW_UNIT_SLOT_GROUPS = 192;

/** Maximum semantic front-matter string subjects. */
export const MAX_REVIEW_UNIT_FRONT_MATTER_SUBJECTS = 32;

/** Maximum readable clause subjects in one Candidate K plan. */
export const MAX_REVIEW_UNIT_CLAUSES: number = MAX_REALIZATION_OBLIGATIONS;

/** Maximum ordered inter-slot relation subjects in one Candidate K plan. */
export const MAX_REVIEW_UNIT_RELATIONS = 191;

/** Closed page-level subjects retaining cross-unit quality ownership. */
export const REVIEW_UNIT_GLOBAL_CRITERIA = [
  'cross-slot-actor-identity-coreference',
  'cross-slot-chronology-semantic-relation',
  'technical-legal-terminology-consistency',
  'document-grammar-tense-register-coherence',
  'contributor-voice-authority',
  'source-image-target-relation',
] as const;

/** One Candidate K page-level global criterion. */
export type ReviewUnitGlobalCriterion = typeof REVIEW_UNIT_GLOBAL_CRITERIA[number];

/** One semantic string leaf from source and target front matter. */
export type ReviewUnitFrontMatterSubject = {
  /** Canonical front-matter subject position. */
  readonly subjectIndex: number;
  /** YAML object path identifying semantic field. */
  readonly path: readonly string[];
  /** Synthetic candidate slot used by exact target anchors. */
  readonly targetSlotKey: string;
  /** Source-authority value, empty only for unsupported target field. */
  readonly sourceText: string;
  /** Candidate front-matter value, empty only for omitted field. */
  readonly targetText: string;
  /** Exact source semantic value digest. */
  readonly sourceDigest: string;
  /** Exact target semantic value digest. */
  readonly targetDigest: string;
};

/** Readable source evidence bound to canonical UTF-16 range. */
export type ReviewUnitSourceEvidence = RealizationSourceSpan & {
  /** Exact source or archive substring at bound range. */
  readonly text: string;
};

/** One clause obligation retaining individual verifier status. */
export type ReviewUnitClauseSubject = {
  /** Canonical flat clause position. */
  readonly subjectIndex: number;
  /** Original obligation identity. */
  readonly obligationId: string;
  /** Immutable shell slot receiving target wording. */
  readonly slotKey: string;
  /** Readable source evidence positions. */
  readonly sourceEvidenceIndexes: readonly number[];
  /** Authority controlling semantic comparison. */
  readonly authority: 'archive-allowed' | 'shell-locked' | 'source';
  /** Candidate slots authorized for target findings. */
  readonly allowedTargetSlotKeys: readonly string[];
  /** Original obligation evidence identity. */
  readonly evidenceDigest: string;
};

/** Readable group for clauses sharing one immutable target slot. */
export type ReviewUnitSlotGroup = {
  /** Canonical slot-group position. */
  readonly groupIndex: number;
  /** Immutable shell slot key. */
  readonly slotKey: string;
  /** Complete source wording assigned to slot. */
  readonly sourceText: string;
  /** Complete source-slot digest. */
  readonly sourceDigest: string;
  /** Ordered flat clause positions carried by group. */
  readonly clauseSubjectIndexes: readonly number[];
};

/** Ordered adjacent-source-slot semantic relation. */
export type ReviewUnitRelationSubject = {
  /** Canonical relation position. */
  readonly subjectIndex: number;
  /** Original obligation identity. */
  readonly obligationId: string;
  /** Deterministic relation vocabulary. */
  readonly kind: 'adjacent-source-slot';
  /** Ordered left then right clause positions. */
  readonly endpointClauseSubjectIndexes: readonly number[];
  /** Readable endpoint source evidence positions. */
  readonly sourceEvidenceIndexes: readonly number[];
  /** Authority controlling relation comparison. */
  readonly authority: 'archive-allowed' | 'shell-locked' | 'source';
  /** Candidate slots authorized for relation findings. */
  readonly allowedTargetSlotKeys: readonly string[];
  /** Original obligation evidence identity. */
  readonly evidenceDigest: string;
};

/** Explicit successor owners for one prior global criterion. */
export type ReviewUnitGlobalOwnership = {
  /** Candidate I criterion retained by mapping. */
  readonly priorCriterion: RealizationGlobalCriterion;
  /** Candidate K global subjects owning page-level aspect. */
  readonly globalIndexes: readonly number[];
  /** Whether every clause status also owns aspect. */
  readonly clauseOwned: boolean;
  /** Whether relation statuses also own aspect. */
  readonly relationOwned: boolean;
  /** Whether slot-language statuses also own aspect. */
  readonly languageOwned: boolean;
};

/** Candidate-independent readable review template fixed before provider contact. */
export type ReviewUnitPlan = {
  /** Plan schema version. */
  readonly version: 1;
  /** Immutable shell binding. */
  readonly shellDigest: string;
  /** Closed-world ledger binding. */
  readonly ledgerDigest: string;
  /** Semantic source and target front-matter fields. */
  readonly frontMatterSubjects: readonly ReviewUnitFrontMatterSubject[];
  /** Canonical readable source evidence catalog. */
  readonly sourceEvidence: readonly ReviewUnitSourceEvidence[];
  /** Every clause obligation in ledger order. */
  readonly clauses: readonly ReviewUnitClauseSubject[];
  /** Clause groups in immutable slot order. */
  readonly slotGroups: readonly ReviewUnitSlotGroup[];
  /** Every ordered adjacent-slot relation in ledger order. */
  readonly relations: readonly ReviewUnitRelationSubject[];
  /** Fixed global quality subjects. */
  readonly globalCriteria: typeof REVIEW_UNIT_GLOBAL_CRITERIA;
  /** Coverage of every prior global criterion. */
  readonly priorGlobalOwnership: readonly ReviewUnitGlobalOwnership[];
  /** Self digest over every prior member. */
  readonly reviewPlanDigest: string;
};

/** Internal front-matter string leaf before source and target join. */
type FrontMatterLeaf = {
  /** YAML object path. */
  readonly path: readonly string[];
  /** String value at path. */
  readonly text: string;
};

/** Collects every bounded structural string leaf from parsed YAML. */
function frontMatterLeaves({
  value,
  path = [],
}: {
  readonly value: unknown;
  readonly path?: readonly string[];
}): readonly FrontMatterLeaf[] {
  if (typeof value === 'string')
    return [{ path, text: value, },];
  if (Array.isArray(value,))
    return value.flatMap(function child(item, index,) {
      return frontMatterLeaves({ value: item, path: [...path, String(index,),], });
    },);
  if ((typeof value === 'object') && (value !== null))
    return Object.entries(value,).flatMap(function child([key, item,],) {
      return frontMatterLeaves({ value: item, path: [...path, key,], });
    },);
  return [];
}

/** Stable YAML-path identity. */
function frontMatterPathKey(path: readonly string[],): string {
  return JSON.stringify(path,);
}

/** Compiles union of source and target front-matter semantic strings. */
function frontMatterSubjects({
  sourceText,
  targetText,
}: {
  readonly sourceText: string;
  readonly targetText: string;
}): readonly ReviewUnitFrontMatterSubject[] {
  /** Source string leaves in parser order. */
  const sourceLeaves = frontMatterLeaves({
    value: splitFrontMatter({ text: sourceText, }).frontMatter?.data,
  },);
  /** Target string leaves in parser order. */
  const targetLeaves = frontMatterLeaves({
    value: splitFrontMatter({ text: targetText, }).frontMatter?.data,
  },);
  /** Canonical union of paths preserving source then target first occurrence. */
  const paths = [...sourceLeaves, ...targetLeaves,]
    .map(function path(leaf,) { return leaf.path; })
    .filter(function first(path, index, values,) {
      return values.findIndex(function same(value,) {
        return frontMatterPathKey(value,) === frontMatterPathKey(path,);
      },) === index;
    },);
  if (paths.length > MAX_REVIEW_UNIT_FRONT_MATTER_SUBJECTS)
    throw new Error('review unit front matter exceeds finite bound');
  return paths.map(function subject(path, subjectIndex,) {
    /** Source value at canonical path. */
    const source = sourceLeaves.find(function same(leaf,) {
      return frontMatterPathKey(leaf.path,) === frontMatterPathKey(path,);
    },)?.text ?? '';
    /** Target value at canonical path. */
    const target = targetLeaves.find(function same(leaf,) {
      return frontMatterPathKey(leaf.path,) === frontMatterPathKey(path,);
    },)?.text ?? '';
    return {
      subjectIndex,
      path,
      targetSlotKey: `fm${String(subjectIndex,)}`,
      sourceText: source,
      targetText: target,
      sourceDigest: hashContent({ content: source, }),
      targetDigest: hashContent({ content: target, }),
    };
  },);
}

/** Canonical span identity independent of readable text. */
function spanKey(span: RealizationSourceSpan,): string {
  return JSON.stringify({
    namespace: span.namespace,
    startOffset: span.startOffset,
    endOffset: span.endOffset,
    digest: span.digest,
  },);
}

/** Selects source namespace text for one canonical span. */
function namespaceText({
  span,
  sourceBody,
  archiveBody,
}: {
  readonly span: RealizationSourceSpan;
  readonly sourceBody: string;
  readonly archiveBody: string;
}): string {
  return span.namespace === 'source-body' ? sourceBody : archiveBody;
}

/** Builds readable source evidence and refuses stale range or digest. */
function readableEvidence({
  span,
  sourceBody,
  archiveBody,
}: {
  readonly span: RealizationSourceSpan;
  readonly sourceBody: string;
  readonly archiveBody: string;
}): ReviewUnitSourceEvidence {
  /** Namespace text selected before slicing. */
  const text = namespaceText({ span, sourceBody, archiveBody, });
  /** Exact half-open source substring. */
  const excerpt = text.slice(span.startOffset, span.endOffset,);
  if ((span.startOffset < 0)
    || (span.endOffset <= span.startOffset)
    || (span.endOffset > text.length)
    || (hashContent({ content: excerpt, }) !== span.digest))
    throw new Error('review unit readable source evidence differs');
  return {
    ...span,
    text: excerpt,
  };
}

/** Finds canonical readable evidence position for span. */
function evidenceIndex({
  span,
  sourceEvidence,
}: {
  readonly span: RealizationSourceSpan;
  readonly sourceEvidence: readonly ReviewUnitSourceEvidence[];
}): number {
  /** Canonical span identity sought in catalog. */
  const key = spanKey(span,);
  /** Matching catalog position. */
  const index = sourceEvidence.findIndex(function matching(value,) {
    return spanKey(value,) === key;
  },);
  if (index < 0)
    throw new Error('review unit source evidence position is absent');
  return index;
}

/** Returns fixed explicit ownership for prior Candidate I global. */
function globalOwnership(
  priorCriterion: RealizationGlobalCriterion,
): ReviewUnitGlobalOwnership {
  if (priorCriterion === 'unsupported-addition')
    return { priorCriterion, globalIndexes: [], clauseOwned: true, relationOwned: false, languageOwned: false, };
  if (priorCriterion === 'identity-attribution')
    return { priorCriterion, globalIndexes: [0, 4,], clauseOwned: true, relationOwned: false, languageOwned: false, };
  if (priorCriterion === 'actor-reference')
    return { priorCriterion, globalIndexes: [0,], clauseOwned: true, relationOwned: true, languageOwned: true, };
  if (priorCriterion === 'chronology')
    return { priorCriterion, globalIndexes: [1,], clauseOwned: true, relationOwned: true, languageOwned: false, };
  if (priorCriterion === 'technical-legal-term')
    return { priorCriterion, globalIndexes: [2,], clauseOwned: true, relationOwned: false, languageOwned: true, };
  if (priorCriterion === 'grammar-usage')
    return { priorCriterion, globalIndexes: [3,], clauseOwned: false, relationOwned: false, languageOwned: true, };
  if (priorCriterion === 'tense')
    return { priorCriterion, globalIndexes: [3,], clauseOwned: false, relationOwned: true, languageOwned: true, };
  if (priorCriterion === 'register')
    return { priorCriterion, globalIndexes: [3, 4,], clauseOwned: false, relationOwned: false, languageOwned: true, };
  if (priorCriterion === 'paragraph-relation')
    return { priorCriterion, globalIndexes: [1,], clauseOwned: false, relationOwned: true, languageOwned: true, };
  if (priorCriterion === 'source-language-calque')
    return { priorCriterion, globalIndexes: [3,], clauseOwned: false, relationOwned: false, languageOwned: true, };
  throw new Error('review unit prior global criterion is unreachable');
}

/** Canonical digest input excluding self reference. */
function planDigest(value: Omit<ReviewUnitPlan, 'reviewPlanDigest'>,): string {
  return hashContent({ content: JSON.stringify(value,), });
}

/**
 * Compiles readable lossless verifier plan from closed-world ledger.
 *
 * @returns Candidate-independent review plan fixed before provider contact
 *
 * @example
 * ```ts
 * const plan = createReviewUnitPlan({ ledger, shell, sourceBody, archiveBody, ledgerDigest, });
 * ```
 */
export function createReviewUnitPlan({
  ledger,
  shell,
  sourceText,
  sourceBody,
  archiveBody,
  ledgerDigest,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly sourceBody: string;
  readonly archiveBody: string;
  readonly ledgerDigest: string;
}): ReviewUnitPlan {
  /** Semantic front-matter source and target fields. */
  const semanticFrontMatter = frontMatterSubjects({
    sourceText,
    targetText: `${shell.frontMatter}${shell.body}`,
  });
  /** Every span carried by obligation ledger before deduplication. */
  const spans = ledger.obligations.flatMap(function spansFor(obligation,) {
    return obligation.sourceSpans;
  },);
  /** Canonical first-occurrence source evidence catalog. */
  const sourceEvidence = spans
    .filter(function first(span, index, values,) {
      return values.findIndex(function matching(value,) {
        return spanKey(value,) === spanKey(span,);
      },) === index;
    },)
    .map(function readable(span,) {
      return readableEvidence({ span, sourceBody, archiveBody, });
    },);
  /** Original clause obligations in ledger order. */
  const clauseObligations = ledger.obligations.filter(function clause(obligation,) {
    return obligation.kind === 'clause';
  },);
  /** Readable clause subjects preserving individual status positions. */
  const clauses: readonly ReviewUnitClauseSubject[] = clauseObligations.map(function clause(
    obligation,
    subjectIndex,
  ) {
    /** Sole target slot required by deterministic clause compiler. */
    const slotKey = obligation.allowedTargetSlotKeys[0];
    if ((slotKey === undefined)
      || (obligation.allowedTargetSlotKeys.length !== 1)
      || (obligation.sourceSpans.length === 0))
      throw new Error('review unit clause shape differs');
    return {
      subjectIndex,
      obligationId: obligation.id,
      slotKey,
      sourceEvidenceIndexes: obligation.sourceSpans.map(function index(span,) {
        return evidenceIndex({ span, sourceEvidence, });
      },),
      authority: obligation.authority,
      allowedTargetSlotKeys: obligation.allowedTargetSlotKeys,
      evidenceDigest: obligation.evidenceDigest,
    };
  },);
  /** Clause groups in immutable slot order. */
  const slotGroups: readonly ReviewUnitSlotGroup[] = shell.slots.map(function group(
    slot,
    groupIndex,
  ) {
    /** Clause positions assigned to slot. */
    const clauseSubjectIndexes = clauses
      .filter(function assigned(clause,) { return clause.slotKey === slot.key; })
      .map(function index(clause,) { return clause.subjectIndex; });
    if (clauseSubjectIndexes.length === 0)
      throw new Error('review unit slot group has no clause');
    return {
      groupIndex,
      slotKey: slot.key,
      sourceText: slot.source,
      sourceDigest: hashContent({ content: slot.source, }),
      clauseSubjectIndexes,
    };
  },);
  /** Clause identity to flat subject position. */
  const clauseIndexById = new Map(clauses.map(function entry(clause,) {
    return [clause.obligationId, clause.subjectIndex,] as const;
  },),);
  /** Readable ordered relation subjects. */
  const relations: readonly ReviewUnitRelationSubject[] = ledger.obligations
    .filter(function relation(obligation,) { return obligation.kind === 'relation'; })
    .map(function relation(obligation, subjectIndex,) {
      /** Ordered endpoint clause positions. */
      const endpointClauseSubjectIndexes = obligation.relationEndpoints.map(function endpoint(id,) {
        const index = clauseIndexById.get(id,);
        if (index === undefined)
          throw new Error('review unit relation endpoint is absent');
        return index;
      },);
      if ((endpointClauseSubjectIndexes.length !== 2)
        || (obligation.sourceSpans.length !== 2))
        throw new Error('review unit relation direction differs');
      return {
        subjectIndex,
        obligationId: obligation.id,
        kind: 'adjacent-source-slot',
        endpointClauseSubjectIndexes,
        sourceEvidenceIndexes: obligation.sourceSpans.map(function index(span,) {
          return evidenceIndex({ span, sourceEvidence, });
        },),
        authority: obligation.authority,
        allowedTargetSlotKeys: obligation.allowedTargetSlotKeys,
        evidenceDigest: obligation.evidenceDigest,
      };
    },);
  /** Explicit prior-global coverage in canonical order. */
  const priorGlobalOwnership = REALIZATION_GLOBAL_CRITERIA.map(globalOwnership,);
  if ((slotGroups.length === 0)
    || (slotGroups.length > MAX_REVIEW_UNIT_SLOT_GROUPS)
    || (clauses.length === 0)
    || (clauses.length > MAX_REVIEW_UNIT_CLAUSES)
    || (relations.length > MAX_REVIEW_UNIT_RELATIONS)
    || (new Set(clauses.map(function id(clause,) { return clause.obligationId; }),).size !== clauses.length)
    || (new Set(relations.map(function id(relation,) { return relation.obligationId; }),).size !== relations.length)
    || (priorGlobalOwnership.length !== REALIZATION_GLOBAL_CRITERIA.length))
    throw new Error('review unit plan dimensions differ');
  /** Plan identity before self digest. */
  const identity = {
    version: 1,
    shellDigest: shell.shellDigest,
    ledgerDigest,
    frontMatterSubjects: semanticFrontMatter,
    sourceEvidence,
    clauses,
    slotGroups,
    relations,
    globalCriteria: REVIEW_UNIT_GLOBAL_CRITERIA,
    priorGlobalOwnership,
  } as const;
  return {
    ...identity,
    reviewPlanDigest: planDigest(identity,),
  };
}

/** Refuses review plan drift against exact dependencies. */
export function assertReviewUnitPlan({
  plan,
  ledger,
  shell,
  sourceText,
  sourceBody,
  archiveBody,
  ledgerDigest,
}: {
  readonly plan: ReviewUnitPlan;
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly sourceBody: string;
  readonly archiveBody: string;
  readonly ledgerDigest: string;
}): void {
  /** Recompiled canonical plan. */
  const expected = createReviewUnitPlan({ ledger, shell, sourceText, sourceBody, archiveBody, ledgerDigest, });
  if (JSON.stringify(plan,) !== JSON.stringify(expected,))
    throw new Error('review unit plan identity differs');
}
