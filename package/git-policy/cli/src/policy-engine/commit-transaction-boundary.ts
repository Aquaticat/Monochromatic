/**
 Fail-closed wrapper boundary for commit transaction setup errors.
 
 @module
 */
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

import { IndexLockUnprovenOwnerError, } from '../index-lock/index-lock-wait.ts';
import type { ConcurrencyConfig, } from '../trust/config-validation-concurrency.ts';
import { runCommitTransaction, } from './commit-transaction.ts';
import type { CommitTransactionPolicyOptions, } from './commit-transaction-types.ts';
import { CommitTransactionGitError, } from './commit-transaction-git.ts';
import { initialTransactionFailure, } from './commit-transaction-results.ts';
import { NativeCommitFailedError, } from './commit-preparation-native.ts';

/**
 Runs commit transaction and converts setup/filesystem exceptions to engine result.
 
 @param args - exact wrapper arguments
 
 @param gitPath - resolved real Git executable
 
 @param policyOptions - trusted policy configuration
 
 @param concurrency - trusted concurrency tuning; defaults when config is absent
 
 @returns transaction result or not-applicable sentinel
 
 @example
 ```ts
 await runCommitTransactionBoundary({ args: ['commit'], gitPath: '/usr/bin/git', policyOptions: {} });
 ```
 */
export async function runCommitTransactionBoundary({
  args,
  gitPath,
  policyOptions,
  concurrency,
}: Readonly<{
  args: readonly string[];
  gitPath: string;
  policyOptions: CommitTransactionPolicyOptions;
  concurrency?: ConcurrencyConfig;
}>,): Promise<Awaited<ReturnType<typeof runCommitTransaction>>> {
  try {
    return await runCommitTransaction({
      args,
      gitPath,
      policyOptions,
      ...(concurrency === undefined ? {} : { concurrency, }),
    },);
  }
  catch (error: unknown) {
    if ((error instanceof CommitTransactionGitError) || (error instanceof NativeCommitFailedError))
      throw error;
    return {
      policyResult: initialTransactionFailure({
        args,
        message: caughtValueText(error,),
        code: error instanceof IndexLockUnprovenOwnerError ? 'index-lock-unproven-owner' : 'transaction-failed',
      },),
      committed: false,
    };
  }
}
