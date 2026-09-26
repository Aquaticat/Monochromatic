/**
 Ordered policy convergence over the private commit index.

 Each changed pass applies its exact ordered proposals,
 then the whole ordered engine restarts,
 until a pass proposes nothing,
 the pass limit is reached,
 or an exact prior candidate state repeats.

 @module
 */
import { join, } from 'node:path';
import { applyPolicyPatches, } from './apply-policy-patches.ts';
import type { AddedPathTracker, } from './commit-transaction-added-path-tracker.ts';
import {
  containsExactCandidateSnapshot,
  writeCandidateSnapshot,
} from './commit-transaction-candidate-snapshot.ts';
import { createPrivateIndexFacts, } from './commit-transaction-candidates.ts';
import {
  fixCycleFailure,
  fixPassLimitFailure,
} from './commit-transaction-results.ts';
import type { CommitTransactionPolicyOptions, } from './commit-transaction-types.ts';
import type { CommitTransactionWorkspace, } from './commit-transaction-workspace.ts';
import { runPolicyEngine, } from './engine.ts';
import type { PolicyEngineResult, } from './types.ts';

/**
 Maximum changed passes before convergence failure.
 */
const MAXIMUM_CHANGED_PASSES = 8;

/**
 Workspace fields convergence reads and writes:
 its directory for snapshots and patch files,
 the private index it patches,
 the invocation-time real index for added-path checks,
 and the shadow store receiving patched blobs.
 */
export type ConvergenceWorkspace = Pick<CommitTransactionWorkspace, 'directory' | 'commitIndexPath' | 'capturedIndexPath' | 'objectDirectory'>;

/**
 Converged policy state, or the blocking result that stopped convergence.
 */
export type CommitConvergence =
  | Readonly<{
    /**
     Convergence finished with a settled pass.
     */
    kind: 'settled';
    /**
     Final unchanged pass.
     */
    pass: PolicyEngineResult;
    /**
     Number of passes that changed candidate bytes.
     */
    changedPasses: number;
    /**
     Paths changed by at least one pass.
     */
    changedPaths: readonly string[];
    /**
     Selected paths the core final-newline policy corrected.
     */
    newlinePaths: ReadonlySet<string>;
  }>
  | Readonly<{
    /**
     Convergence stopped with a blocking result.
     */
    kind: 'blocked';
    /**
     Blocking result.
     */
    result: PolicyEngineResult;
  }>;

/**
 Runs ordered policy passes over the private index until they settle.

 @param args - exact wrapper arguments

 @param gitPath - real Git executable

 @param cwd - effective repository directory

 @param workspace - transaction workspace

 @param policyOptions - trusted policy options

 @param baseRevision - recorded base commit, or the empty tree for an unborn base

 @param repositoryRoot - canonical worktree root

 @param addedPaths - selected and policy-added path tracker

 @param firstPass - initial pass already run against the initial candidates

 @param firstSnapshot - exact initial candidate snapshot

 @returns settled or blocked convergence

 @example
 ```ts
 await convergeCommitPolicies({ args, gitPath, cwd, workspace, policyOptions: {}, baseRevision, repositoryRoot, addedPaths, firstPass, firstSnapshot });
 ```
 */
export async function convergeCommitPolicies({
  args,
  gitPath,
  cwd,
  workspace,
  policyOptions,
  baseRevision,
  repositoryRoot,
  addedPaths,
  firstPass,
  firstSnapshot,
}: Readonly<{
  args: readonly string[];
  gitPath: string;
  cwd: string;
  workspace: ConvergenceWorkspace;
  policyOptions: CommitTransactionPolicyOptions;
  baseRevision: string;
  repositoryRoot: string;
  addedPaths: AddedPathTracker;
  firstPass: PolicyEngineResult;
  firstSnapshot: string;
}>,): Promise<CommitConvergence> {
  /**
   Ordered private paths for previously visited exact states.
   */
  const visited: string[] = [firstSnapshot,];
  /**
   Paths changed by at least one provisional patch.
   */
  const changedPaths = new Set<string>();
  /**
   Selected paths actually corrected by the core final-newline policy.
   */
  const newlinePaths = new Set<string>();
  /**
   Latest pass and changed-pass count, evolved once per bounded changed pass.
   */
  const state = {
    pass: firstPass,
    changedPasses: 0,
  };
  while (state.pass
    .patches
    .length
    > 0) {
    for (const event of state.pass
      .events) {
      if ((event.type === 'finding')
        && (event.policyId === 'final-newline')
        && (event.fix === 'available')
        && (event.path !== undefined))
        newlinePaths.add(event.path,);
    }
    if (state.pass
      .exitCode
      === 2)
      return {
        kind: 'blocked',
        result: state.pass,
      };
    if (state.changedPasses >= MAXIMUM_CHANGED_PASSES)
      return {
        kind: 'blocked',
        result: fixPassLimitFailure({
          previous: state.pass,
          trigger: 'pre-forward',
        },),
      };
    /**
     Pass-start candidates bind all proposals to one exact state.
     */
    // oxlint-disable-next-line no-await-in-loop -- Each changed pass binds proposals to its exact current candidate state.
    const candidates = await createPrivateIndexFacts({
      gitPath,
      cwd,
      indexPath: workspace.commitIndexPath,
      paths: addedPaths.candidatePaths(),
      baseRevision,
      objectDirectory: workspace.objectDirectory,
    },)
      .candidates();
    /**
     Ordered private patch application for current provisional pass.
     */
    // oxlint-disable-next-line no-await-in-loop -- Each changed pass applies its exact ordered proposals before restart.
    const applied = await applyPolicyPatches({
      workspace,
      gitPath,
      cwd,
      pass: state.pass,
      candidates,
      trigger: 'pre-forward',
      addedPathContext: {
        repositoryRoot,
        realIndexPath: workspace.capturedIndexPath,
        lifecycle: 'commit',
        baseRevision,
      },
    },);
    if (applied.kind === 'failed')
      return {
        kind: 'blocked',
        result: applied.result,
      };
    applied.paths
      .forEach(function recordChangedPath(path,) {
        changedPaths.add(path,);
      },);
    addedPaths.record(applied.addedPaths,);
    /**
     Current private-index candidate facts after ordered patches.
     */
    const currentFacts = createPrivateIndexFacts({
      gitPath,
      cwd,
      indexPath: workspace.commitIndexPath,
      paths: addedPaths.candidatePaths(),
      baseRevision,
      objectDirectory: workspace.objectDirectory,
    },);
    /**
     Private exact snapshot for current changed pass.
     */
    const snapshotPath = join(
      workspace.directory,
      `candidate-${String(state.changedPasses + 1,)}.state`,
    );
    // oxlint-disable-next-line no-await-in-loop -- Each bounded pass streams one exact candidate-state snapshot.
    await writeCandidateSnapshot({
      gitFacts: currentFacts,
      snapshotPath,
    },);
    // oxlint-disable-next-line no-await-in-loop -- Cycle detection streams prior exact snapshots after each bounded change.
    if (await containsExactCandidateSnapshot({
      snapshotPaths: visited,
      currentPath: snapshotPath,
    },))
      return {
        kind: 'blocked',
        result: fixCycleFailure({
          previous: state.pass,
          trigger: 'pre-forward',
          message: 'Policy patches repeated an exact prior candidate state.',
        },),
      };
    visited.push(snapshotPath,);
    state.changedPasses += 1;
    // oxlint-disable-next-line no-await-in-loop -- Whole ordered engine restarts after each bounded exact change.
    state.pass = await runPolicyEngine({
      ...policyOptions,
      args,
      trigger: 'pre-forward',
      gitFacts: currentFacts,
      candidateVersion: state.changedPasses,
      canApplyPatches: true,
      repositoryRoot: cwd,
    },);
  }
  return {
    kind: 'settled',
    pass: state.pass,
    changedPasses: state.changedPasses,
    changedPaths: [...changedPaths,],
    newlinePaths,
  };
}
