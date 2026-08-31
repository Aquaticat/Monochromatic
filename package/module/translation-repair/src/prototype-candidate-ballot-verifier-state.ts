// PROTOTYPE ONLY: Candidate I verifier terminal state and ballot persistence.

import { join, } from 'node:path';

import type { CandidateScopedBallot, } from './prototype-candidate-ballot-model.ts';
import type { CandidateBallotNodeRecord, } from './prototype-candidate-ballot-node-record.ts';
import { persistRealizationImmutableJson, } from './prototype-realization-persistence.ts';

/**
 * Complete or abstaining terminal verifier state.
 */
export type CandidateBallotVerifierState = {
  /**
   * Durable node record.
   */
  readonly record: CandidateBallotNodeRecord;
  /**
   * Runtime-owned admitted scoped ballot.
   */
  readonly ballot?: CandidateScopedBallot;
};

/**
 * Persists runtime-owned admitted scoped ballot.
 *
 * @returns Terminal verifier state after immutable persistence
 *
 * @example
 * ```ts
 * await persistCandidateScopedBallot({ outputDir, id, state, });
 * ```
 */
export async function persistCandidateScopedBallot({
  outputDir,
  id,
  state,
}: {
  readonly outputDir: string;
  readonly id: string;
  readonly state: CandidateBallotVerifierState & { readonly ballot: CandidateScopedBallot };
}): Promise<CandidateBallotVerifierState> {
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
