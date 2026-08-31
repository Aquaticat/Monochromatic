// PROTOTYPE ONLY: Candidate K front-matter synthetic target slots.

import type { ReviewUnitFrontMatterSubject, } from './prototype-review-unit-plan-model.ts';

/**
 * Refuses synthetic front-matter target slot collision.
 *
 * @example
 * ```ts
 * assertReviewUnitFrontMatterSlotKeys({ subjects, bodySlotKeys, });
 * ```
 */
export function assertReviewUnitFrontMatterSlotKeys({
  subjects,
  bodySlotKeys,
}: {
  readonly subjects: readonly ReviewUnitFrontMatterSubject[];
  readonly bodySlotKeys: readonly string[];
}): void {
  if ((new Set(subjects.map(function key(subject,) {
    return subject.targetSlotKey;
  },),).size !== subjects.length)
    || subjects.some(function collision(subject,) {
      return bodySlotKeys.includes(subject.targetSlotKey,);
    },))
    throw new Error('review unit front matter target slot collides');
}
