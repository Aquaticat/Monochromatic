// PROTOTYPE ONLY: Candidate K privacy-safe semantic admission error.

import type { ReviewUnitGuardFailure, } from './prototype-review-unit-model.ts';

/**
 * Deterministic semantic admission error carrying privacy-safe category.
 */
export class ReviewUnitAdmissionError extends Error {
  /**
   * Privacy-safe category persisted with spent node.
   */
  public readonly failureCategory: ReviewUnitGuardFailure;

  /**
   * Creates categorized semantic admission failure.
   */
  public constructor({
    failureCategory,
    message,
  }: {
    readonly failureCategory: ReviewUnitGuardFailure;
    readonly message: string;
  }) {
    super(message,);
    this.name = 'ReviewUnitAdmissionError';
    this.failureCategory = failureCategory;
  }
}

/**
 * Throws categorized semantic admission failure.
 *
 * @example
 * ```ts
 * refuseReviewUnit({ failureCategory: 'anchor', message: 'bad anchor', });
 * ```
 */
export function refuseReviewUnit({
  failureCategory,
  message,
}: {
  readonly failureCategory: ReviewUnitGuardFailure;
  readonly message: string;
}): never {
  throw new ReviewUnitAdmissionError({
    failureCategory,
    message,
  });
}
