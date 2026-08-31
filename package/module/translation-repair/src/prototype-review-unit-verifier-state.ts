// PROTOTYPE ONLY: Candidate K verifier terminal state and ballot persistence.

import { join, } from 'node:path';

import type { ReviewUnitBallot, } from './prototype-review-unit-model.ts';
import type { ReviewUnitNodeRecord, } from './prototype-review-unit-node-record.ts';
import { persistRealizationImmutableJson, } from './prototype-realization-persistence.ts';

/**
 * Complete or abstaining terminal verifier state.
 */
export type ReviewUnitVerifierState = {
  /**
   * Durable node record.
   */
  readonly record: ReviewUnitNodeRecord;
  /**
   * Runtime-owned admitted scoped ballot.
   */
  readonly ballot?: ReviewUnitBallot;
};

/**
 * Persists runtime-owned admitted scoped ballot.
 *
 * @returns Terminal verifier state after immutable persistence
 *
 * @example
 * ```ts
 * await persistReviewUnitBallot({ outputDir, id, state, });
 * ```
 */
export async function persistReviewUnitBallot({
  outputDir,
  id,
  state,
}: {
  readonly outputDir: string;
  readonly id: string;
  readonly state: ReviewUnitVerifierState & { readonly ballot: ReviewUnitBallot };
}): Promise<ReviewUnitVerifierState> {
  await persistRealizationImmutableJson({
    path: join(
      outputDir,
      `ballot-${id}.json`,
    ),
    value: state.ballot,
    label: 'candidate scoped ballot',
  },);
  return state;
}
