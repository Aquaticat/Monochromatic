/**
 * Fail-closed direct-check private fact preparation.
 *
 * @module
 */
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

import { resolveGit, } from '../resolve-git.ts';
import {
  ADD_POLICY_FACTS_NOT_APPLICABLE,
  type AddPolicyFactsScope,
  createAddPolicyFacts,
} from './add-policy-facts.ts';
import { initialTransactionFailure, } from './commit-transaction-results.ts';
import type { PolicyEngineResult, } from './types.ts';

/**
 * Prepared direct-check facts.
 */
type PreparedDirectCheck = Readonly<{
  /**
   * Stable preparation discriminator.
   */
  kind: 'prepared';
  /**
   * Disposable private worktree projection.
   */
  scope: AddPolicyFactsScope;
}>;

/**
 * Failed direct-check preparation.
 */
type FailedDirectCheck = Readonly<{
  /**
   * Stable preparation discriminator.
   */
  kind: 'failed';
  /**
   * Machine-readable direct-check failure.
   */
  result: PolicyEngineResult;
}>;

/**
 * Direct-check preparation outcome.
 */
export type DirectCheckFactsResult = PreparedDirectCheck | FailedDirectCheck;

/**
 * Creates exact direct-check facts or stable transaction failure.
 *
 * @param args - management command arguments
 *
 * @param gitGlobalArgs - global Git location options
 *
 * @param pathspecs - exact direct-check scope
 *
 * @returns prepared facts or machine-readable failure
 *
 * @example
 * ```ts
 * await prepareDirectCheckFacts({ args: ['check'], gitGlobalArgs: [], pathspecs: [':/'] });
 * ```
 */
export async function prepareDirectCheckFacts({
  args,
  gitGlobalArgs,
  pathspecs,
}: Readonly<{
  args: readonly string[];
  gitGlobalArgs: readonly string[];
  pathspecs: readonly string[];
}>,): Promise<DirectCheckFactsResult> {
  try {
    /**
     * Exact private worktree/index projection for direct checks.
     */
    const facts = await createAddPolicyFacts({
      args: [
        ...gitGlobalArgs,
        'add',
        '--all',
        '--',
        ...pathspecs,
      ],
      gitPath: await resolveGit(),
      candidatePathspecs: pathspecs,
    },);
    if ((typeof facts) === 'symbol') {
      if (facts !== ADD_POLICY_FACTS_NOT_APPLICABLE)
        throw new TypeError('Unknown direct policy facts state.',);
      throw new TypeError('Direct check requires a Git worktree.',);
    }
    return {
      kind: 'prepared',
      scope: facts,
    };
  }
  catch (error: unknown) {
    return {
      kind: 'failed',
      result: initialTransactionFailure({
        args,
        code: 'transaction-failed',
        message: caughtValueText(error,),
        trigger: 'direct-check',
      },),
    };
  }
}
