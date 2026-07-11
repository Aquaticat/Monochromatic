/**
 * Stable policy results for transaction-specific failures.
 *
 * @module
 */
import type { PolicyTrigger, } from '../api/policy-types.ts';
import { CommitTransactionGitError, } from './commit-transaction-git.ts';
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

/**
 * Produces stable changed-pass-limit failure.
 *
 * @param previous - latest provisional policy pass
 *
 * @param trigger - fixable lifecycle point
 *
 * @returns blocking pass-limit result
 *
 * @example
 * ```ts
 * fixPassLimitFailure({ previous, trigger: 'direct-fix' });
 * ```
 */
export function fixPassLimitFailure({
  previous,
  trigger,
}: Readonly<{
  previous: PolicyEngineResult;
  trigger: Extract<PolicyTrigger, 'pre-forward' | 'direct-fix'>;
}>,): PolicyEngineResult {
  return transactionFailure({
    previous,
    code: 'fix-pass-limit',
    message: 'Policy patches did not converge within eight changed passes.',
    trigger,
  },);
}

/**
 * Produces stable invalid patch-target failure.
 *
 * @param previous - latest provisional policy pass
 *
 * @param trigger - fixable lifecycle point
 *
 * @param path - stale or mutable patch target
 *
 * @returns blocking invalid-patch result
 *
 * @example
 * ```ts
 * patchTargetFailure({ previous, trigger: 'pre-forward', path: 'a.txt' });
 * ```
 */
export function patchTargetFailure({
  previous,
  trigger,
  path,
}: Readonly<{
  previous: PolicyEngineResult;
  trigger: Extract<PolicyTrigger, 'pre-forward' | 'direct-fix'>;
  path: string;
}>,): PolicyEngineResult {
  return transactionFailure({
    previous,
    code: 'patch-invalid',
    message: `Patch target is stale, undeclared, or mutable: ${path}`,
    trigger,
    path,
  },);
}

/**
 * Classifies private patch validation and Git application failures.
 *
 * @param previous - latest provisional policy pass
 *
 * @param trigger - fixable lifecycle point
 *
 * @param path - declared patch target
 *
 * @param error - validation or Git application failure
 *
 * @returns blocking classified patch result
 *
 * @example
 * ```ts
 * patchApplicationFailure({ previous, trigger: 'direct-fix', path: 'a.txt', error });
 * ```
 */
export function patchApplicationFailure({
  previous,
  trigger,
  path,
  error,
}: Readonly<{
  previous: PolicyEngineResult;
  trigger: Extract<PolicyTrigger, 'pre-forward' | 'direct-fix'>;
  path: string;
  error: unknown;
}>,): PolicyEngineResult {
  return transactionFailure({
    previous,
    code: error instanceof CommitTransactionGitError ? 'patch-conflict' : 'patch-invalid',
    message: Error.isError(error,) ? error.message : String(error,),
    trigger,
    path,
  },);
}

/**
 * Produces stable exact candidate-cycle failure.
 *
 * @param previous - latest provisional policy pass
 *
 * @param trigger - fixable lifecycle point
 *
 * @param message - lifecycle-specific cycle explanation
 *
 * @returns blocking cycle result
 *
 * @example
 * ```ts
 * fixCycleFailure({ previous, trigger: 'pre-forward', message: 'Repeated state.' });
 * ```
 */
export function fixCycleFailure({
  previous,
  trigger,
  message,
}: Readonly<{
  previous: PolicyEngineResult;
  trigger: Extract<PolicyTrigger, 'pre-forward' | 'direct-fix'>;
  message: string;
}>,): PolicyEngineResult {
  return transactionFailure({
    previous,
    code: 'fix-cycle',
    message,
    trigger,
  },);
}
