import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  type AbsoluteNaturalnessReviewOutcome,
  reviewAbsoluteNaturalness,
} from './absolute-naturalness-review-stage.ts';

//region Absolute naturalness confirmation
// Publication approval needs a second exact-half-quorum reading of exact same
// candidate. Rejection remains immediate: it already proves candidate cannot
// ship and its findings should reach correction without confirmation spend.

/**
 * Successful review rounds required after first acceptable reading.
 */
export const ABSOLUTE_NATURALNESS_CONFIRMATIONS_REQUIRED = 1;

/**
 * Decisive review beside earlier acceptable readings of same exact candidate.
 *
 * @example
 * ```ts
 * const confirmed: ConfirmedAbsoluteNaturalness = { review, confirmations: [initial,] };
 * ```
 */
export type ConfirmedAbsoluteNaturalness = {
  /**
   * Final review deciding acceptance or correction.
   */
  readonly review: AbsoluteNaturalnessReviewOutcome;

  /**
   * Earlier acceptable readings bought before decisive review.
   */
  readonly confirmations: readonly AbsoluteNaturalnessReviewOutcome[];
};

/**
 * Requires one repeated exact-half-quorum acceptance of exact candidate before approval.
 *
 * @param request - exact request each independent review receives
 *
 * @returns Decisive review and every earlier acceptable reading
 *
 * @example
 * ```ts
 * const confirmed = await confirmAbsoluteNaturalness({ client, modelIds, subject, signal, exchangeTimeoutMs, l, });
 * ```
 */
export async function confirmAbsoluteNaturalness(
  request: ForeignBorrowed<Parameters<typeof reviewAbsoluteNaturalness>[0]>,
): Promise<ConfirmedAbsoluteNaturalness> {
  /**
   * First approving quorum reading.
   */
  const initial = await reviewAbsoluteNaturalness(request,);
  if (initial.verdict !== 'acceptable') {
    return {
      review: initial,
      confirmations: [],
    };
  }

  /**
   * Independent repeated reading over exact same subject.
   */
  const confirmation = await reviewAbsoluteNaturalness(request,);
  return {
    review: confirmation,
    confirmations: [initial,],
  };
}

//endregion Absolute naturalness confirmation
