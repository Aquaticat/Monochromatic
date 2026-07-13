/**
 * Fail-closed wrapper boundary for commit transaction setup errors.
 *
 * @module
 */
import { runCommitTransaction, } from './commit-transaction.ts';
import type { CommitTransactionPolicyOptions, } from './commit-transaction-types.ts';
import { CommitTransactionGitError, } from './commit-transaction-git.ts';
import { initialTransactionFailure, } from './commit-transaction-results.ts';

/**
 * Runs commit transaction and converts setup/filesystem exceptions to engine result.
 *
 * @param args - exact wrapper arguments
 *
 * @param gitPath - resolved real Git executable
 *
 * @param policyOptions - trusted policy configuration
 *
 * @returns transaction result or not-applicable sentinel
 *
 * @example
 * ```ts
 * await runCommitTransactionBoundary({ args: ['commit'], gitPath: '/usr/bin/git', policyOptions: {} });
 * ```
 */
export async function runCommitTransactionBoundary({
  args,
  gitPath,
  policyOptions,
}: Readonly<{
  args: readonly string[];
  gitPath: string;
  policyOptions: CommitTransactionPolicyOptions;
}>,): Promise<Awaited<ReturnType<typeof runCommitTransaction>>> {
  try {
    return await runCommitTransaction({
      args,
      gitPath,
      policyOptions,
    },);
  }
  catch (error: unknown) {
    if (error instanceof CommitTransactionGitError)
      throw error;
    return {
      policyResult: initialTransactionFailure({
        args,
        message: Error.isError(error,) ? error.message : String(error,),
      },),
      committed: false,
    };
  }
}
