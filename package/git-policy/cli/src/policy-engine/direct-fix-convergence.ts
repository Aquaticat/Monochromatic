/**
 * Direct-fix private-index policy convergence.
 *
 * @module
 */
import { Buffer, } from 'node:buffer';
import { join, } from 'node:path';
import type { CandidateFile, } from '../api/policy-types.ts';
import { applyPolicyPatches, } from './apply-policy-patches.ts';
import {
  containsExactCandidateSnapshot,
  writeCandidateSnapshot,
} from './commit-transaction-candidate-snapshot.ts';
import { createPrivateIndexFacts, } from './commit-transaction-candidates.ts';
import {
  fixCycleFailure,
  fixPassLimitFailure,
} from './commit-transaction-results.ts';
import { runPolicyEngine, } from './engine.ts';
import type { AddPolicyFactsScope, } from './add-policy-facts.ts';
import type {
  PolicyEngineResult,
  RunPolicyEngineOptions,
} from './types.ts';

/**
 * Maximum private candidate changes before direct-fix failure.
 */
const MAXIMUM_CHANGED_PASSES = 8;

/**
 * Direct-fix engine options stable across every candidate pass.
 */
export type DirectFixPolicyOptions = Omit<
  RunPolicyEngineOptions,
  'args' | 'trigger' | 'gitFacts' | 'candidateVersion' | 'repositoryRoot'
>;

/**
 * Stable converged direct-fix result.
 */
export type DirectFixConvergenceResult = Readonly<{
  /**
   * Final policy decision.
   */
  policyResult: PolicyEngineResult;
  /**
   * Paths whose private blob identity changed.
   */
  changedPaths: readonly string[];
  /**
   * Number of private candidate changes before stability.
   */
  passes: number;
}>;

/**
 * Maps candidate path to immutable blob identity.
 *
 * @param candidates - exact private-index candidates
 *
 * @returns path-to-revision map
 */
function candidateRevisions(candidates: readonly CandidateFile[],): ReadonlyMap<string, CandidateFile['revision']> {
  return new Map(candidates.map(function revisionEntry(candidate,) {
    return [
      candidate.path,
      candidate.revision,
    ] as const;
  },),);
}

/**
 * Applies policy patches to private direct-fix index until stable.
 *
 * @param args - management command arguments
 *
 * @param gitPath - resolved real Git executable
 *
 * @param scope - private direct candidate state
 *
 * @param policyOptions - trusted policy registry and settings
 *
 * @returns final decision and changed paths
 *
 * @example
 * ```ts
 * await convergeDirectFix({ args: [], gitPath: '/usr/bin/git', scope, policyOptions: {} });
 * ```
 */
export async function convergeDirectFix({
  args,
  gitPath,
  scope,
  policyOptions,
}: Readonly<{
  args: readonly string[];
  gitPath: string;
  scope: AddPolicyFactsScope;
  policyOptions: DirectFixPolicyOptions;
}>,): Promise<DirectFixConvergenceResult> {
  /**
   * Initial candidates before policy corrections.
   */
  const initialCandidates = await scope.gitFacts
    .candidates();
  /**
   * Initial revision identity by path.
   */
  const initialRevisions = candidateRevisions(initialCandidates,);
  /**
   * Initial exact path, mode, and content snapshot.
   */
  const initialSnapshotPath = join(
    scope.directory,
    'candidate-0.state',
  );
  await writeCandidateSnapshot({
    gitFacts: scope.gitFacts,
    snapshotPath: initialSnapshotPath,
  },);
  /**
   * Ordered private snapshots retained for bounded exact cycle comparison.
   */
  const visited = [initialSnapshotPath,];
  /**
   * Latest policy pass.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- Bounded convergence replaces current result after each private-index change.
  let pass = await runPolicyEngine({
    ...policyOptions,
    args,
    trigger: 'direct-fix',
    gitFacts: scope.gitFacts,
    candidateVersion: 0,
    canApplyPatches: true,
    repositoryRoot: scope.repositoryRoot,
  },);
  /**
   * Number of changed private states.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- Bounded convergence tracks changed passes for hard limit.
  let changedPasses = 0;
  while (pass.patches
    .length
    > 0) {
    if (pass.exitCode === 2)
      return {
        policyResult: pass,
        changedPaths: [],
        passes: changedPasses,
      };
    if (changedPasses >= MAXIMUM_CHANGED_PASSES) {
      return {
        policyResult: fixPassLimitFailure({
          previous: pass,
          trigger: 'direct-fix',
        },),
        changedPaths: [],
        passes: changedPasses,
      };
    }
    /**
     * Pass-start candidates binding patch target identities.
     */
    // oxlint-disable-next-line no-await-in-loop -- Each changed pass binds proposals to its current private state.
    const candidates = await createPrivateIndexFacts({
      gitPath,
      cwd: scope.repositoryRoot,
      indexPath: scope.indexPath,
      paths: scope.paths,
    },)
      .candidates();
    /**
     * Ordered private patch application for current provisional pass.
     */
    // oxlint-disable-next-line no-await-in-loop -- Each changed pass applies its exact ordered proposals before restart.
    const applied = await applyPolicyPatches({
      workspace: {
        directory: scope.directory,
        commitIndexPath: scope.indexPath,
      },
      gitPath,
      cwd: scope.repositoryRoot,
      pass,
      candidates,
      trigger: 'direct-fix',
    },);
    if (applied.kind === 'failed') {
      return {
        policyResult: applied.result,
        changedPaths: [],
        passes: changedPasses,
      };
    }
    changedPasses += 1;
    /**
     * Current private facts after ordered patches.
     */
    const currentFacts = createPrivateIndexFacts({
      gitPath,
      cwd: scope.repositoryRoot,
      indexPath: scope.indexPath,
      paths: scope.paths,
    },);
    /**
     * Private exact snapshot for current changed pass.
     */
    const snapshotPath = join(
      scope.directory,
      `candidate-${String(changedPasses,)}.state`,
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
    },)) {
      return {
        policyResult: fixCycleFailure({
          previous: pass,
          trigger: 'direct-fix',
          message: 'Policy patches entered a repeated candidate-state cycle.',
        },),
        changedPaths: [],
        passes: changedPasses,
      };
    }
    visited.push(snapshotPath,);
    // oxlint-disable-next-line no-await-in-loop -- Next policy pass must observe prior pass output.
    pass = await runPolicyEngine({
      ...policyOptions,
      args,
      trigger: 'direct-fix',
      gitFacts: currentFacts,
      candidateVersion: changedPasses,
      canApplyPatches: true,
      repositoryRoot: scope.repositoryRoot,
    },);
  }
  /**
   * Final candidates after stable pass.
   */
  const finalCandidates = await scope.gitFacts
    .candidates();
  /**
   * Paths whose immutable blob identity changed.
   */
  const changedPaths = finalCandidates
    .filter(function changedCandidate(candidate,) {
      return initialRevisions.get(candidate.path,) !== candidate.revision;
    },)
    .toSorted(function comparePathBytes(
      left,
      right,
    ) {
      return Buffer.compare(
        Buffer.from(left.path,),
        Buffer.from(right.path,),
      );
    },)
    .map(function changedPath(candidate,) { return candidate.path; });
  return {
    policyResult: pass,
    changedPaths,
    passes: changedPasses,
  };
}
