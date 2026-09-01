// PROTOTYPE ONLY: Candidate K and L static roster validation.

import { boundedModelFamily, } from './prototype-bounded-verdict-family.ts';
import { reviewUnitHyperModel, } from './prototype-review-unit-hyper.ts';
import {
  LEAN_REALIZATION_AUTHOR_COUNT,
  MAX_LEAN_REALIZATION_PAYLOAD_COUNT,
  MAX_REVIEW_UNIT_PAYLOAD_COUNT,
  REVIEW_UNIT_AUTHOR_COUNT,
  REVIEW_UNIT_VERIFIER_COUNT,
  type ReviewUnitManifest,
  type ReviewUnitVerifierPlan,
} from './prototype-review-unit-model.ts';
import type { RealizationCandidatePlan, } from './prototype-realization-model.ts';

/**
 * Refuses one provider model without current image route.
 *
 * @param modelId - Canonical model identity requiring Hyper vision
 */
function assertModelReach(modelId: RealizationCandidatePlan['modelId'],): void {
  reviewUnitHyperModel({ modelId, });
}

/**
 * Refuses duplicate, noncontiguous, or family-insufficient graph roster.
 *
 * @example
 * ```ts
 * assertReviewUnitRoster({ candidatePlan, verifierPlan, authorMode, });
 * ```
 */
export function assertReviewUnitRoster({
  candidatePlan,
  verifierPlan,
  authorMode,
}: {
  readonly candidatePlan: readonly RealizationCandidatePlan[];
  readonly verifierPlan: readonly ReviewUnitVerifierPlan[];
  readonly authorMode?: ReviewUnitManifest['authorMode'];
}): void {
  /**
   * Architecture-specific author cardinality.
   */
  const expectedAuthors = authorMode === 'lean-realization'
    ? LEAN_REALIZATION_AUTHOR_COUNT
    : REVIEW_UNIT_AUTHOR_COUNT;
  /**
   * Architecture-specific static payload cardinality.
   */
  const expectedPayloads = authorMode === 'lean-realization'
    ? MAX_LEAN_REALIZATION_PAYLOAD_COUNT
    : MAX_REVIEW_UNIT_PAYLOAD_COUNT;
  if ((candidatePlan.length !== expectedAuthors)
    || (verifierPlan.length !== REVIEW_UNIT_VERIFIER_COUNT)
    || ((candidatePlan.length * (verifierPlan.length + 1)) !== expectedPayloads))
    throw new Error('review unit roster count differs from fixed graph');
  /**
   * Author plans normalized by public ordinal.
   */
  const authors = candidatePlan.toSorted(function ordinal(
    left,
    right,
  ) {
    return left.ordinal - right.ordinal;
  },);
  /**
   * Verifier plans normalized by public ordinal.
   */
  const verifiers = verifierPlan.toSorted(function ordinal(
    left,
    right,
  ) {
    return left.ordinal - right.ordinal;
  },);
  /**
   * Hidden author priorities.
   */
  const priorities = authors.map(function priority(plan,) {
    return plan.priority;
  });
  /**
   * Author canonical identities.
   */
  const authorIds = authors.map(function model(plan,) {
    return plan.modelId;
  });
  /**
   * Verifier canonical identities.
   */
  const verifierIds = verifiers.map(function model(plan,) {
    return plan.modelId;
  });
  /**
   * Conservative author families.
   */
  const authorFamilies = new Set(authorIds.map(function family(modelId,) {
    return boundedModelFamily({ modelId, });
  },));
  /**
   * Conservative verifier families.
   */
  const verifierFamilies = new Set(verifierIds.map(function family(modelId,) {
    return boundedModelFamily({ modelId, });
  },));
  [
    ...authorIds,
    ...verifierIds,
  ].forEach(assertModelReach,);
  if ((new Set(authorIds,).size !== authorIds.length)
    || (new Set(verifierIds,).size !== verifierIds.length)
    || (new Set(priorities,).size !== priorities.length)
    || (authorFamilies.size !== expectedAuthors)
    || (verifierFamilies.size !== REVIEW_UNIT_VERIFIER_COUNT)
    || [...authorFamilies,].some(function absent(family,) {
      return !verifierFamilies.has(family,);
    },)
    || authors.some(function noncontiguous(
      plan,
      index,
    ) { return plan.ordinal !== index; })
    || verifiers.some(function noncontiguous(
      plan,
      index,
    ) { return plan.ordinal !== index; })
    || priorities.some(function invalid(priority,) {
      return (!Number.isInteger(priority,)) || (priority < 0);
    },))
    throw new Error('review unit roster identity or family differs');
}
