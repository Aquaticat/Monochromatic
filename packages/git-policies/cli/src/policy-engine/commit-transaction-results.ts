/**
 * Stable policy results for transaction-specific failures.
 *
 * @module
 */
import type { PolicyTrigger, } from '../api/policy-types.ts';
import {
  createEngineFailureEvent,
  type EngineFailureCode,
} from './events.ts';
import type { PolicyEngineResult, } from './types.ts';

/**
 * Produces transaction failure before policy pass exists.
 *
 * @param args - exact wrapper arguments
 *
 * @param message - failure description
 *
 * @param code - stable transaction failure classification
 *
 * @param trigger - lifecycle point owning failure
 *
 * @param path - optional path owning failure
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
  code = 'transaction-failed',
  trigger = 'pre-forward',
  path,
}: Readonly<{
  args: readonly string[];
  message: string;
  code?: EngineFailureCode;
  trigger?: PolicyTrigger;
  path?: string;
}>,): PolicyEngineResult {
  return {
    args,
    escapedPolicyIds: new Set(),
    events: [createEngineFailureEvent({
      sequence: 0,
      code,
      message,
      trigger,
      ...(path === undefined ? {} : { path, }),
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
 * @param code - stable transaction failure classification
 *
 * @param trigger - lifecycle point owning failure
 *
 * @param path - optional path owning failure
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
  code = 'transaction-failed',
  trigger = 'pre-forward',
  path,
}: Readonly<{
  previous: PolicyEngineResult;
  message: string;
  code?: EngineFailureCode;
  trigger?: PolicyTrigger;
  path?: string;
}>,): PolicyEngineResult {
  return {
    args: previous.args,
    escapedPolicyIds: previous.escapedPolicyIds,
    events: [createEngineFailureEvent({
      sequence: 0,
      code,
      message,
      trigger,
      ...(path === undefined ? {} : { path, }),
    },),],
    patches: [],
    exitCode: 2,
    shouldForward: false,
  };
}
