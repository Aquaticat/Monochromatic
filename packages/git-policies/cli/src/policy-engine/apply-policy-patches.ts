/**
 * Ordered private-index policy patch application.
 *
 * @module
 */
import type {
  CandidateFile,
  PolicyTrigger,
} from '../api/policy-types.ts';
import {
  applyPrivatePatch,
  type PrivatePatchWorkspace,
} from './commit-transaction-git.ts';
import {
  patchApplicationFailure,
  patchTargetFailure,
} from './commit-transaction-results.ts';
import type { PolicyEngineResult, } from './types.ts';

/**
 * Successful ordered patch application.
 */
type AppliedPolicyPatches = Readonly<{
  /**
   * Stable result discriminator.
   */
  kind: 'applied';
  /**
   * Patch paths in proposal order.
   */
  paths: readonly string[];
}>;

/**
 * Failed ordered patch application.
 */
type FailedPolicyPatches = Readonly<{
  /**
   * Stable result discriminator.
   */
  kind: 'failed';
  /**
   * Classified policy-engine failure.
   */
  result: PolicyEngineResult;
}>;

/**
 * Ordered private patch application outcome.
 */
export type ApplyPolicyPatchesResult = AppliedPolicyPatches | FailedPolicyPatches;

/**
 * Applies one provisional pass of ordered patches to private index.
 *
 * @param workspace - private patch workspace
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - repository directory
 *
 * @param pass - provisional policy-engine pass
 *
 * @param candidates - exact pass-start candidates
 *
 * @param trigger - fixable lifecycle point
 *
 * @returns applied paths or classified failure
 *
 * @example
 * ```ts
 * await applyPolicyPatches({ workspace, gitPath, cwd, pass, candidates, trigger: 'direct-fix' });
 * ```
 */
export async function applyPolicyPatches({
  workspace,
  gitPath,
  cwd,
  pass,
  candidates,
  trigger,
}: Readonly<{
  workspace: PrivatePatchWorkspace;
  gitPath: string;
  cwd: string;
  pass: PolicyEngineResult;
  candidates: readonly CandidateFile[];
  trigger: Extract<PolicyTrigger, 'pre-forward' | 'direct-fix'>;
}>,): Promise<ApplyPolicyPatchesResult> {
  /**
   * Successfully applied patch paths in proposal order.
   */
  const paths: string[] = [];
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
        kind: 'failed',
        result: patchTargetFailure({
          previous: pass,
          trigger,
          path: patch.path,
        },),
      };
    }
    try {
      // oxlint-disable-next-line no-await-in-loop -- Ordered policy patches intentionally compose through one private index.
      await applyPrivatePatch({
        workspace,
        gitPath,
        cwd,
        patch,
        candidateRevision: target.revision,
        ordinal,
      },);
      paths.push(patch.path,);
    }
    catch (error: unknown) {
      return {
        kind: 'failed',
        result: patchApplicationFailure({
          previous: pass,
          trigger,
          path: patch.path,
          error,
        },),
      };
    }
  }
  return {
    kind: 'applied',
    paths,
  };
}
