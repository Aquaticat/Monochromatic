// PROTOTYPE ONLY: Candidate K target-slot authorization.

import type {
  ReviewUnitCandidate,
  ReviewUnitFinding,
} from './prototype-review-unit-model.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';

/**
 * Returns exact target slots authorized for one finding subject.
 *
 * @returns Exact authorized target slot keys
 *
 * @example
 * ```ts
 * const slots = reviewUnitFindingTargetSlots({ finding, reviewPlan, candidate, });
 * ```
 */
export function reviewUnitFindingTargetSlots({
  finding,
  reviewPlan,
  candidate,
}: {
  readonly finding: ReviewUnitFinding;
  readonly reviewPlan: ReviewUnitPlan;
  readonly candidate: ReviewUnitCandidate;
}): readonly string[] {
  if (finding.scope === 'fm') {
    /**
     * Synthetic front-matter target slot.
     */
    const targetSlotKey = reviewPlan.frontMatterSubjects[finding.subjectIndex]
      ?.targetSlotKey;
    return targetSlotKey === undefined ? [] : [targetSlotKey,];
  }
  if (finding.scope === 'c')
    return reviewPlan.clauses[finding.subjectIndex]
      ?.allowedTargetSlotKeys
      ?? [];
  if (finding.scope === 'r')
    return reviewPlan.relations[finding.subjectIndex]
      ?.allowedTargetSlotKeys
      ?? [];
  if (finding.scope === 'sl') {
    /**
     * Body slot assigned to language subject.
     */
    const slotKey = reviewPlan.slotGroups[finding.subjectIndex]
      ?.slotKey;
    return slotKey === undefined ? [] : [slotKey,];
  }
  return Object.keys(candidate.slots,);
}
