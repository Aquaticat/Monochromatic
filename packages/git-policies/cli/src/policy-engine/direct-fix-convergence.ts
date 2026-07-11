/**
 * Direct-fix private-index policy convergence.
 *
 * @module
 */
import type { CandidateFile, } from '../api/policy-types.ts';
import { createPrivateIndexFacts, } from './commit-transaction-candidates.ts';
import { applyPrivatePatch, } from './commit-transaction-git.ts';
import { transactionFailure, } from './commit-transaction-results.ts';
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
 * Serializes exact candidate identity for cycle detection.
 *
 * @param candidates - current private-index candidates
 *
 * @returns deterministic state identity
 */
function candidateState(candidates: readonly CandidateFile[],): string {
  return JSON.stringify(candidates.map(function candidateIdentity(candidate,) {
    return [
      candidate.path,
      candidate.targetId,
      candidate.revision,
      candidate.mode,
      candidate.change,
    ];
  },),);
}

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

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Trusted runtime registry contains callback declarations; convergence reads but never mutates them. */
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
   * Visited exact candidate states.
   */
  const visited = new Set([candidateState(initialCandidates,),],);
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
        policyResult: transactionFailure({
          previous: pass,
          message: 'Policy patches did not converge within eight changed passes.',
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
    for (const [ordinal, patch,] of pass.patches
      .entries()) {
      /**
       * Exact candidate selected by opaque target and path.
       */
      const target = candidates.find(function matchingTarget(candidate,) {
        return (candidate.targetId === patch.targetId) && (candidate.path === patch.path);
      },);
      if ((target === undefined) || ((typeof target.revision) === 'symbol')
        || ((target.mode !== 'regular') && (target.mode !== 'executable'))) {
        return {
          policyResult: transactionFailure({
            previous: pass,
            message: `Patch target is stale, undeclared, or mutable: ${patch.path}`,
          },),
          changedPaths: [],
          passes: changedPasses,
        };
      }
      try {
        // oxlint-disable-next-line no-await-in-loop -- Ordered policy patches intentionally compose through one private index.
        await applyPrivatePatch({
          workspace: {
            directory: scope.directory,
            commitIndexPath: scope.indexPath,
          },
          gitPath,
          cwd: scope.repositoryRoot,
          patch,
          candidateRevision: target.revision,
          ordinal,
        },);
      }
      catch (error: unknown) {
        return {
          policyResult: transactionFailure({
            previous: pass,
            message: Error.isError(error,) ? error.message : String(error,),
          },),
          changedPaths: [],
          passes: changedPasses,
        };
      }
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
    /** Current exact candidates used for cycle identity. */
    // oxlint-disable-next-line no-await-in-loop -- Cycle detection observes exact state after each sequential pass.
    const currentCandidates = await currentFacts.candidates();
    /**
     * Exact current state identity.
     */
    const state = candidateState(currentCandidates,);
    if (visited.has(state,)) {
      return {
        policyResult: transactionFailure({
          previous: pass,
          message: 'Policy patches entered a repeated candidate-state cycle.',
        },),
        changedPaths: [],
        passes: changedPasses,
      };
    }
    visited.add(state,);
    // oxlint-disable-next-line no-await-in-loop -- Next policy pass must observe prior pass output.
    pass = await runPolicyEngine({
      ...policyOptions,
      args,
      trigger: 'direct-fix',
      gitFacts: currentFacts,
      candidateVersion: changedPasses,
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
    .map(function changedPath(candidate,) { return candidate.path; });
  return {
    policyResult: pass,
    changedPaths,
    passes: changedPasses,
  };
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
