/**
 Direct worktree policy-fix lifecycle.
 
 @module
 */
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

import { resolveRealGit as resolveGit, } from '@monochromatic-dev/git-executable/ts';
import {
  ADD_POLICY_FACTS_NOT_APPLICABLE,
  type AddPolicyFactsScope,
  createAddPolicyFacts,
} from './add-policy-facts.ts';
import {
  convergeDirectFix,
  type DirectFixPolicyOptions,
} from './direct-fix-convergence.ts';
import { loadBlobBatch, } from './blob-batch.ts';
import { CommitTransactionGitError, } from './commit-transaction-git.ts';
import { initialTransactionFailure, } from './commit-transaction-results.ts';
import { withFixSummary, } from './fix-summary.ts';
import {
  captureDirectFixOriginalBytes,
  installDirectFix,
} from './direct-fix-install.ts';
import type { PolicyEngineResult, } from './types.ts';

/**
 Creates the private-state error for failed or malformed blob output while reading added-path originals.
 
 @param message - safe failure explanation
 
 @returns private-state failure
 */
function addedOriginalError(message: string,): Error {
  return new CommitTransactionGitError(message,);
}

/**
 Settled direct-fix operation.
 */
export type DirectFixResult = Readonly<{
  /**
   Final policy decision.
   */
  policyResult: PolicyEngineResult;
  /**
   Worktree paths changed after stable convergence.
   */
  changedPaths: readonly string[];
}>;

/**
 Prepared private direct-fix state.
 */
type PreparedDirectFix = Readonly<{
  /**
   Real Git executable resolved beyond wrapper shadow.
   */
  gitPath: string;
  /**
   Exact private worktree projection.
   */
  scope: AddPolicyFactsScope;
}>;

/**
 Creates private worktree projection for direct-fix convergence.
 
 @param gitGlobalArgs - global Git location options
 
 @param pathspecs - exact direct-fix scope
 
 @returns resolved Git and disposable private facts
 
 @throws Error when direct fix lacks a Git worktree or setup fails
 */
async function prepareDirectFix({
  gitGlobalArgs,
  pathspecs,
}: Readonly<{
  gitGlobalArgs: readonly string[];
  pathspecs: readonly string[];
}>,): Promise<PreparedDirectFix> {
  /**
   Real Git executable resolved beyond wrapper shadow.
   */
  const gitPath = await resolveGit();
  /**
   Exact private worktree projection.
   */
  const facts = await createAddPolicyFacts({
    args: [
      ...gitGlobalArgs,
      'add',
      '--all',
      '--',
      ...pathspecs,
    ],
    gitPath,
    candidatePathspecs: pathspecs,
  },);
  if ((typeof facts) === 'symbol') {
    if (facts !== ADD_POLICY_FACTS_NOT_APPLICABLE)
      throw new TypeError('Unknown direct policy facts state.',);
    throw new TypeError('Direct fix requires a Git worktree.',);
  }
  return {
    gitPath,
    scope: facts,
  };
}

/**
 Runs convergence and installation against prepared private state.
 
 @param gitGlobalArgs - global Git location options
 
 @param policyOptions - trusted policy settings and registry
 
 @param prepared - resolved Git and disposable private facts
 
 @returns final policy decision and installed paths
 */
async function runPreparedDirectFix({
  gitGlobalArgs,
  policyOptions,
  prepared,
}: Readonly<{
  gitGlobalArgs: readonly string[];
  policyOptions: DirectFixPolicyOptions;
  prepared: PreparedDirectFix;
}>,): Promise<DirectFixResult> {
  /**
   Disposable private direct-fix scope.
   */
  await using scope = prepared.scope;
  /**
   Exact initial candidates before private policy changes.
   */
  const initialCandidates = await scope.gitFacts
    .candidates();
  /**
   Exact initial worktree bytes used for concurrency checks.
   */
  const originals = await captureDirectFixOriginalBytes(initialCandidates,);
  /**
   Stable or failed private convergence result.
   */
  const convergence = await convergeDirectFix({
    args: gitGlobalArgs,
    gitPath: prepared.gitPath,
    scope,
    policyOptions,
  },);
  if (convergence.policyResult
    .exitCode
    !== 0) {
    return {
      policyResult: convergence.policyResult,
      changedPaths: [],
    };
  }
  /**
   `HEAD` bytes of added paths, which convergence verified their worktree copies held.
   */
  const addedOriginals = await loadBlobBatch({
    gitPath: prepared.gitPath,
    cwd: scope.repositoryRoot,
    oids: convergence.addedPaths
      .map(function originalOid(added,) {
      return added.originalOid;
    },),
    createError: addedOriginalError,
  },);
  await installDirectFix({
    scope,
    changedPaths: convergence.changedPaths,
    finalCandidates: convergence.finalCandidates,
    originals: new Map([
      ...originals,
      ...convergence.addedPaths
        .flatMap(function addedOriginal(added,): readonly (readonly [
          string,
          Uint8Array,
        ])[] {
        /**
         Verified `HEAD` bytes for this added path.
         */
        const bytes = addedOriginals.get(added.originalOid,);
        return bytes === undefined ? [] : [[
          added.path,
          bytes,
        ],];
      },),
    ],),
  },);
  if (convergence.changedPaths
    .length
    === 0)
    return convergence;
  return {
    policyResult: withFixSummary({
      result: convergence.policyResult,
      trigger: 'direct-fix',
      passes: convergence.passes,
      changedPaths: convergence.changedPaths,
    },),
    changedPaths: convergence.changedPaths,
  };
}

/**
 Runs convergent policy fixes against selected worktree paths.
 
 @param gitGlobalArgs - global Git location options
 
 @param pathspecs - exact direct-fix scope
 
 @param policyOptions - trusted policy settings and registry
 
 @returns final policy decision and installed paths
 
 @example
 ```ts
 await runDirectFix({ gitGlobalArgs: [], pathspecs: [':/'], policyOptions: {} });
 ```
 */
export async function runDirectFix({
  gitGlobalArgs,
  pathspecs,
  policyOptions,
}: Readonly<{
  gitGlobalArgs: readonly string[];
  pathspecs: readonly string[];
  policyOptions: DirectFixPolicyOptions;
}>,): Promise<DirectFixResult> {
  try {
    /**
     Private direct-fix state prepared before policy execution.
     */
    const prepared = await prepareDirectFix({
      gitGlobalArgs,
      pathspecs,
    },);
    return await runPreparedDirectFix({
      gitGlobalArgs,
      policyOptions,
      prepared,
    },);
  }
  catch (error: unknown) {
    return {
      policyResult: initialTransactionFailure({
        args: gitGlobalArgs,
        code: 'transaction-failed',
        message: caughtValueText(error,),
        trigger: 'direct-fix',
      },),
      changedPaths: [],
    };
  }
}
