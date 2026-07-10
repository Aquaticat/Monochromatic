/**
 * Stable policy results for transaction-specific failures.
 *
 * @module
 */
import { createEngineFailureEvent, } from './events.ts';
import type { PolicyEngineResult, } from './types.ts';

/**
 * Produces transaction failure before policy pass exists.
 *
 * @param args - exact wrapper arguments
 *
 * @param message - failure description
 *
 * @returns blocking engine result
 *
 * @example
 * ```ts
 * initialTransactionFailure({ args: ['commit'], message: 'blocked' });
 * ```
 */
export function initialTransactionFailure({
  args,
  message,
}: Readonly<{
  args: readonly string[];
  message: string;
}>,): PolicyEngineResult {
  return {
    args,
    escapedPolicyIds: new Set(),
    events: [createEngineFailureEvent({
      sequence: 0,
      code: 'content-unavailable',
      message,
      trigger: 'pre-forward',
    },),],
    patches: [],
    exitCode: 2,
    shouldForward: false,
  };
}

/**
 * Produces failure retaining transformed command facts.
 *
 * @param previous - latest policy pass
 *
 * @param message - transaction failure description
 *
 * @returns blocking engine result
 *
 * @example
 * ```ts
 * transactionFailure({ previous, message: 'blocked' });
 * ```
 */
export function transactionFailure({
  previous,
  message,
}: Readonly<{
  previous: PolicyEngineResult;
  message: string;
}>,): PolicyEngineResult {
  return {
    args: previous.args,
    escapedPolicyIds: previous.escapedPolicyIds,
    events: [createEngineFailureEvent({
      sequence: 0,
      code: 'content-unavailable',
      message,
      trigger: 'pre-forward',
    },),],
    patches: [],
    exitCode: 2,
    shouldForward: false,
  };
}
