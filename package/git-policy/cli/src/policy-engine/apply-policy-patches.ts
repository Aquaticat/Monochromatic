/**
 Ordered private-index policy patch application.
 
 @module
 */
import type {
  CandidateFile,
  PolicyTrigger,
} from '../api/policy-types.ts';
import {
  AddedPathPreconditionError,
  type AddedPathRecord,
  assertAddablePath,
  parseTrackedTargetId,
} from './commit-transaction-added-paths.ts';
import {
  applyPrivatePatch,
  type PrivatePatchWorkspace,
} from './commit-transaction-git.ts';
import {
  patchApplicationFailure,
  patchTargetFailure,
  transactionFailure,
} from './commit-transaction-results.ts';
import type { PolicyEngineResult, } from './types.ts';

/**
 Successful ordered patch application.
 */
type AppliedPolicyPatches = Readonly<{
  /**
   Stable result discriminator.
   */
  kind: 'applied';
  /**
   Patch paths in proposal order.
   */
  paths: readonly string[];
  /**
   Tracked paths this pass added to the commit, before their intended blobs are known.
   */
  addedPaths: readonly Omit<AddedPathRecord, 'intendedOid'>[];
}>;

/**
 State that lets a patch add a tracked path outside the candidate set.
 */
export type AddedPathContext = Readonly<{
  /**
   Worktree root whose copy of an added path must match `HEAD`.
   */
  repositoryRoot: string;
  /**
   Snapshot of the real index whose entry for an added path must match `HEAD`.
   */
  realIndexPath: string;
}>;

/**
 Failed ordered patch application.
 */
type FailedPolicyPatches = Readonly<{
  /**
   Stable result discriminator.
   */
  kind: 'failed';
  /**
   Classified policy-engine failure.
   */
  result: PolicyEngineResult;
}>;

/**
 Ordered private patch application outcome.
 */
export type ApplyPolicyPatchesResult = AppliedPolicyPatches | FailedPolicyPatches;

/**
 Outcome of matching one patch to a candidate or an addable tracked file.
 */
type ResolvedPatchTarget =
  | Readonly<{
    /**
     Discriminator for an acceptable target.
     */
    kind: 'revision';
    /**
     Blob revision the patch applies against.
     */
    revision: string;
  }>
  | Readonly<{
    /**
     Discriminator for a stale, undeclared, or non-ordinary target.
     */
    kind: 'stale';
  }>
  | Readonly<{
    /**
     Discriminator for a tracked path whose local changes block adding it.
     */
    kind: 'conflict';
    /**
     Diagnostic naming the path and remedies.
     */
    message: string;
  }>;

/**
 Matches a patch to a candidate, or verifies and records the unchanged tracked path it adds.
 
 @param workspace - private patch workspace
 
 @param gitPath - resolved real Git executable
 
 @param cwd - repository directory
 
 @param patch - policy patch proposal
 
 @param candidates - exact pass-start candidates
 
 @param addedPaths - tracked paths added earlier in this pass, extended when this patch adds one
 
 @param addedPathContext - present when tracked paths may be added
 
 @returns revision to apply against, or the reason the patch cannot apply
 
 @mutates addedPaths - records a newly verified added path.
 */
async function resolvePatchTarget({
  workspace,
  gitPath,
  cwd,
  patch,
  candidates,
  addedPaths,
  addedPathContext,
}: Readonly<{
  workspace: PrivatePatchWorkspace;
  gitPath: string;
  cwd: string;
  patch: PolicyEngineResult['patches'][number];
  candidates: readonly CandidateFile[];
  addedPaths: Map<string, Omit<AddedPathRecord, 'intendedOid'>>;
  addedPathContext?: AddedPathContext;
}>,): Promise<ResolvedPatchTarget> {
  /**
   Tracked target identity, when the patch names a tracked file rather than a candidate.
   */
  const [tracked,] = parseTrackedTargetId(patch.targetId,);
  /**
   Candidate named by target ID, or by a tracked target at the candidate's exact revision.
   */
  const target = candidates.find(function matchingTarget(candidate,) {
    return (candidate.path === patch.path)
      && ((candidate.targetId === patch.targetId)
        || ((tracked !== undefined) && (tracked.path === patch.path) && (candidate.revision === tracked.oid)));
  },);
  if (target !== undefined) {
    return ((typeof target.revision) === 'symbol') || ((target.mode !== 'regular') && (target.mode !== 'executable'))
      ? { kind: 'stale', }
      : {
        kind: 'revision',
        revision: String(target.revision,),
      };
  }
  if ((tracked === undefined) || (tracked.path !== patch.path) || (addedPathContext === undefined))
    return { kind: 'stale', };
  if (addedPaths.has(patch.path,))
    return {
      kind: 'revision',
      revision: tracked.oid,
    };
  try {
    /**
     Mode of the verified unchanged ordinary file.
     */
    const gitMode = await assertAddablePath({
      gitPath,
      cwd,
      repositoryRoot: addedPathContext.repositoryRoot,
      realIndexPath: addedPathContext.realIndexPath,
      commitIndexPath: workspace.commitIndexPath,
      path: patch.path,
      oid: tracked.oid,
    },);
    addedPaths.set(
      patch.path,
      {
        path: patch.path,
        gitMode,
        originalOid: tracked.oid,
      },
    );
    return {
      kind: 'revision',
      revision: tracked.oid,
    };
  }
  catch (error: unknown) {
    if (!(error instanceof AddedPathPreconditionError))
      throw error;
    return {
      kind: 'conflict',
      message: error.message,
    };
  }
}

/**
 Applies one provisional pass of ordered patches to private index.
 
 @param workspace - private patch workspace
 
 @param gitPath - resolved real Git executable
 
 @param cwd - repository directory
 
 @param pass - provisional policy-engine pass
 
 @param candidates - exact pass-start candidates
 
 @param trigger - fixable lifecycle point
 
 @param addedPathContext - present when this lifecycle may add unchanged tracked paths; absent rejects tracked targets
 
 @returns applied paths or classified failure
 
 @example
 ```ts
 await applyPolicyPatches({ workspace, gitPath, cwd, pass, candidates, trigger: 'direct-fix' });
 ```
 */
export async function applyPolicyPatches({
  workspace,
  gitPath,
  cwd,
  pass,
  candidates,
  trigger,
  addedPathContext,
}: Readonly<{
  workspace: PrivatePatchWorkspace;
  gitPath: string;
  cwd: string;
  pass: PolicyEngineResult;
  candidates: readonly CandidateFile[];
  trigger: Extract<PolicyTrigger, 'pre-forward' | 'direct-fix'>;
  addedPathContext?: AddedPathContext;
}>,): Promise<ApplyPolicyPatchesResult> {
  /**
   Successfully applied patch paths in proposal order.
   */
  const paths: string[] = [];
  /**
   Tracked paths added by this pass, keyed by path so later patches in the pass compose onto them.
   */
  const addedPaths = new Map<string, Omit<AddedPathRecord, 'intendedOid'>>();
  for (const [ordinal, patch,] of pass.patches
    .entries()) {
    /**
     Revision the patch applies against, or why it cannot apply.
     */
    // oxlint-disable-next-line no-await-in-loop -- An added path is verified before its patch touches the private index.
    const resolved = await resolvePatchTarget({
      workspace,
      gitPath,
      cwd,
      patch,
      candidates,
      addedPaths,
      ...(addedPathContext === undefined ? {} : { addedPathContext, }),
    },);
    if (resolved.kind === 'stale') {
      return {
        kind: 'failed',
        result: patchTargetFailure({
          previous: pass,
          trigger,
          path: patch.path,
        },),
      };
    }
    if (resolved.kind === 'conflict') {
      return {
        kind: 'failed',
        result: transactionFailure({
          previous: pass,
          code: 'patch-conflict',
          message: resolved.message,
          trigger,
          path: patch.path,
        },),
      };
    }
    /**
     Revision the patch was computed against.
     */
    const candidateRevision = resolved.revision;
    try {
      // oxlint-disable-next-line no-await-in-loop -- Ordered policy patches intentionally compose through one private index.
      await applyPrivatePatch({
        workspace,
        gitPath,
        cwd,
        patch,
        candidateRevision,
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
    addedPaths: [...addedPaths.values(),],
  };
}
