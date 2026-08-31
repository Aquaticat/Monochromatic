// PROTOTYPE ONLY: Candidate K readable verifier evidence plan compiler.

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import { hashContent, } from './document-node.ts';
import { compileReviewUnitFrontMatter, } from './prototype-review-unit-front-matter.ts';
import { reviewUnitGlobalOwnership, } from './prototype-review-unit-global-ownership.ts';
import {
  MAX_REVIEW_UNIT_CLAUSES,
  MAX_REVIEW_UNIT_RELATIONS,
  MAX_REVIEW_UNIT_SLOT_GROUPS,
  REVIEW_UNIT_GLOBAL_CRITERIA,
  type ReviewUnitClauseSubject,
  type ReviewUnitPlan,
  type ReviewUnitRelationSubject,
  type ReviewUnitSlotGroup,
} from './prototype-review-unit-plan-model.ts';
import {
  createReviewUnitSourceEvidence,
  reviewUnitEvidenceIndex,
} from './prototype-review-unit-source-evidence.ts';
import {
  REALIZATION_GLOBAL_CRITERIA,
  type RealizationObligationLedger,
} from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

export {
  MAX_REVIEW_UNIT_CLAUSES,
  MAX_REVIEW_UNIT_FRONT_MATTER_SUBJECTS,
  MAX_REVIEW_UNIT_RELATIONS,
  MAX_REVIEW_UNIT_SLOT_GROUPS,
  REVIEW_UNIT_GLOBAL_ACTOR_INDEX,
  REVIEW_UNIT_GLOBAL_AUTHORITY_INDEX,
  REVIEW_UNIT_GLOBAL_CRITERIA,
  REVIEW_UNIT_GLOBAL_IMAGE_INDEX,
  REVIEW_UNIT_GLOBAL_LANGUAGE_INDEX,
  REVIEW_UNIT_GLOBAL_RELATION_INDEX,
  REVIEW_UNIT_GLOBAL_TERM_INDEX,
  type ReviewUnitClauseSubject,
  type ReviewUnitFrontMatterSubject,
  type ReviewUnitGlobalCriterion,
  type ReviewUnitGlobalOwnership,
  type ReviewUnitPlan,
  type ReviewUnitRelationSubject,
  type ReviewUnitSlotGroup,
  type ReviewUnitSourceEvidence,
} from './prototype-review-unit-plan-model.ts';

/**
 * Canonical digest input excluding self reference.
 *
 * @param value - complete plan identity before self digest
 *
 * @returns SHA-256 plan identity
 */
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
 * const plan = createReviewUnitPlan({
 *   ledger,
 *   shell,
 *   sourceText,
 *   sourceBody,
 *   archiveBody,
 *   ledgerDigest,
 * });
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
  /**
   * Semantic strings and exact non-string scalar proof.
   */
  const frontMatter = compileReviewUnitFrontMatter({
    sourceText,
    targetText: `${shell.frontMatter}${shell.body}`,
  },);
  if (frontMatter.subjects
    .some(function collision(subject,) {
    return shell.slots
      .some(function same(slot,) { return slot.key === subject.targetSlotKey; });
  },))
    throw new Error('review unit front matter target slot collides');
  /**
   * Every source span carried by obligation ledger.
   */
  const spans = ledger.obligations
    .flatMap(function spansFor(obligation,) { return obligation.sourceSpans; });
  /**
   * Canonical first-occurrence readable evidence.
   */
  const sourceEvidence = createReviewUnitSourceEvidence({
    spans,
    sourceBody,
    archiveBody,
  },);
  /**
   * Original clause obligations in ledger order.
   */
  const clauseObligations = ledger.obligations
    .filter(function clause(obligation,) { return obligation.kind === 'clause'; });
  /**
   * Readable clause subjects preserving individual positions.
   */
  const clauses: readonly ReviewUnitClauseSubject[] = clauseObligations
    .map(function clause(
      obligation,
      subjectIndex,
    ) {
      /**
       * Sole target slot required by clause compiler.
       */
      const [slotKey,] = obligation.allowedTargetSlotKeys;
      if ((slotKey === undefined)
        || (obligation.allowedTargetSlotKeys
          .length
          !== 1)
        || (obligation.sourceSpans
          .length
          === 0))
        throw new Error('review unit clause shape differs');
      return {
        subjectIndex,
        obligationId: obligation.id,
        slotKey,
        sourceEvidenceIndexes: obligation.sourceSpans
          .map(function index(span,) {
            return reviewUnitEvidenceIndex({
              span,
              sourceEvidence,
            });
          },),
        authority: obligation.authority,
        allowedTargetSlotKeys: obligation.allowedTargetSlotKeys,
        evidenceDigest: obligation.evidenceDigest,
      };
    },);
  /**
   * Clause groups in immutable slot order.
   */
  const slotGroups: readonly ReviewUnitSlotGroup[] = shell.slots
    .map(function group(
      slot,
      groupIndex,
    ) {
      /**
       * Clause positions assigned to current slot.
       */
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
  /**
   * Clause identity to flat subject position.
   */
  const clauseIndexById = new Map(clauses.map(function entry(clause,) {
    return [
      clause.obligationId,
      clause.subjectIndex,
    ] as const;
  },),);
  /**
   * Readable ordered relation subjects.
   */
  const relations: readonly ReviewUnitRelationSubject[] = ledger.obligations
    .filter(function relation(obligation,) { return obligation.kind === 'relation'; })
    .map(function relation(
      obligation,
      subjectIndex,
    ) {
      /**
       * Ordered endpoint clause positions.
       */
      const endpointClauseSubjectIndexes = obligation.relationEndpoints
        .map(function endpoint(id,) {
          /**
           * Existing clause position for endpoint id.
           */
          const index = nonNullishOrThrow(clauseIndexById.get(id,),);
          return index;
        },);
      if ((endpointClauseSubjectIndexes.length !== 2)
        || (obligation.sourceSpans
          .length
          !== 2))
        throw new Error('review unit relation direction differs');
      return {
        subjectIndex,
        obligationId: obligation.id,
        kind: 'adjacent-source-slot',
        endpointClauseSubjectIndexes,
        sourceEvidenceIndexes: obligation.sourceSpans
          .map(function index(span,) {
            return reviewUnitEvidenceIndex({
              span,
              sourceEvidence,
            });
          },),
        authority: obligation.authority,
        allowedTargetSlotKeys: obligation.allowedTargetSlotKeys,
        evidenceDigest: obligation.evidenceDigest,
      };
    },);
  /**
   * Explicit prior-global coverage in canonical order.
   */
  const priorGlobalOwnership = REALIZATION_GLOBAL_CRITERIA
    .map(function ownership(criterion,) {
      return reviewUnitGlobalOwnership(criterion,);
    },);
  if ((slotGroups.length === 0)
    || (slotGroups.length > MAX_REVIEW_UNIT_SLOT_GROUPS)
    || (clauses.length === 0)
    || (clauses.length > MAX_REVIEW_UNIT_CLAUSES)
    || (relations.length > MAX_REVIEW_UNIT_RELATIONS)
    || (new Set(clauses.map(function id(clause,) {
      return clause.obligationId;
    },),).size !== clauses.length)
    || (new Set(relations.map(function id(relation,) {
      return relation.obligationId;
    },),).size !== relations.length)
    || (priorGlobalOwnership.length !== REALIZATION_GLOBAL_CRITERIA.length))
    throw new Error('review unit plan dimensions differ');
  /**
   * Plan identity before self digest.
   */
  const identity = {
    version: 1,
    shellDigest: shell.shellDigest,
    ledgerDigest,
    frontMatterSubjects: frontMatter.subjects,
    frontMatterScalarDigest: frontMatter.scalarDigest,
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

/**
 * Refuses review plan drift against exact dependencies.
 *
 * @example
 * ```ts
 * assertReviewUnitPlan({
 *   plan,
 *   ledger,
 *   shell,
 *   sourceText,
 *   sourceBody,
 *   archiveBody,
 *   ledgerDigest,
 * });
 * ```
 */
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
  /**
   * Recompiled canonical plan.
   */
  const expected = createReviewUnitPlan({
    ledger,
    shell,
    sourceText,
    sourceBody,
    archiveBody,
    ledgerDigest,
  },);
  if (JSON.stringify(plan,) !== JSON.stringify(expected,))
    throw new Error('review unit plan identity differs');
}
