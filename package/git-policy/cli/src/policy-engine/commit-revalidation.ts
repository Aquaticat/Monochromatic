/**
 Revalidation after a clean replay, outside both landing locks.

 The replayed tree gets its own private index,
 the shadow `HEAD` moves to the replay parent,
 cli-git policies re-run against it under the ordinary convergence rules,
 and `pre-commit` re-runs whenever the tree differs from the one it last approved.
 An unrestricted policy always re-runs;
 a policy that declares its inputs keeps a recorded result while its context reads and declared inputs are unchanged.
 A hook's staged changes are kept,
 as in native preparation.

 @module
 */
import { mkdir, } from 'node:fs/promises';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { runShadowGit, } from '../shadow-repository/shadow-refs.ts';
import {
  describeHookChanges,
  type HookChanges,
  NO_HOOK_CHANGES,
} from './commit-hook-changes.ts';
import { rerunPreCommit, } from './commit-replay-hook.ts';
import {
  createAddedPathTracker,
  settleAddedPathRecords,
} from './commit-transaction-added-path-tracker.ts';
import type { AddedPathRecord, } from './commit-transaction-added-paths.ts';
import { writeCandidateSnapshot, } from './commit-transaction-candidate-snapshot.ts';
import { createPrivateIndexFacts, } from './commit-transaction-candidates.ts';
import type { InvocationCapture, } from './commit-transaction-capture.ts';
import { convergeCommitPolicies, } from './commit-transaction-convergence.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import { writePrivateTree, } from './commit-transaction-index.ts';
import { listChangedIndexPaths, } from './commit-transaction-index-paths.ts';
import type { CommitTransactionPolicyOptions, } from './commit-transaction-types.ts';
import type { CommitTransactionWorkspace, } from './commit-transaction-workspace.ts';
import { withPolicyReadTracking, } from './commit-transaction-read-tracking.ts';
import { runPolicyEngine, } from './engine.ts';
import type { PolicyEngineResult, } from './types.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Private directory mode.
 */
const PRIVATE_DIRECTORY_MODE = 0o700;

/**
 Invocation facts revalidation repeats policies and hooks with.
 */
export type RevalidationContext = Readonly<{
  /**
   Real Git executable.
   */
  gitPath: string;
  /**
   Effective invocation directory.
   */
  cwd: string;
  /**
   Invocation capture.
   */
  capture: InvocationCapture;
  /**
   Transaction workspace.
   */
  workspace: CommitTransactionWorkspace;
  /**
   Exact wrapper arguments the policies see.
   */
  args: readonly string[];
  /**
   Trusted policy options.
   */
  policyOptions: CommitTransactionPolicyOptions;
  /**
   Whether interactive or include selection forbids automatic patches.
   */
  readOnlySelection: boolean;
  /**
   Canonical worktree root.
   */
  repositoryRoot: string;
  /**
   Caller's kept global options.
   */
  globalArgs: readonly string[];
  /**
   Whether the invocation bypassed `pre-commit` with `--no-verify`.
   */
  noVerify: boolean;
}>;

/**
 Revalidation result.
 */
export type Revalidation =
  | Readonly<{
    /**
     The replayed commit may land.
     */
    kind: 'revalidated';
    /**
     Tree to commit, with policy and hook changes.
     */
    treeOid: string;
    /**
     Private index holding that tree.
     */
    indexPath: string;
    /**
     Settled policy pass.
     */
    pass: PolicyEngineResult;
    /**
     Changed policy passes.
     */
    changedPasses: number;
    /**
     Paths the passes changed.
     */
    changedPaths: readonly string[];
    /**
     Paths the replayed commit changes, with policy-added paths.
     */
    committedPaths: readonly string[];
    /**
     Policy-added paths of this revalidation.
     */
    addedPaths: readonly AddedPathRecord[];
    /**
     What the re-run `pre-commit` staged.
     */
    hookChanges: HookChanges;
  }>
  | Readonly<{
    /**
     A policy blocked the replayed commit.
     */
    kind: 'blocked';
    /**
     Blocking result.
     */
    result: PolicyEngineResult;
  }>;

/**
 Points the shadow `HEAD` at the replay parent, so policies and hooks see the parent the commit will have.

 @param context - revalidation context

 @param onto - replay parent
 */
async function moveShadowHead({
  context,
  onto,
}: Readonly<{
  context: RevalidationContext;
  onto: string;
}>,): Promise<void> {
  await runShadowGit({
    gitPath: context.gitPath,
    shadowPath: context.workspace
      .shadowPath,
    args: [
      'update-ref',
      ...(context.capture
        .symbolicHead
        .kind
        === 'detached' ? ['--no-deref',] : []),
      context.capture
        .targetRef,
      onto,
    ],
  },);
}

/**
 Revalidates a replayed tree.

 @param context - revalidation context

 @param replay - replay number naming the private directory

 @param mergedTree - tree `git merge-tree` produced

 @param onto - replay parent

 @param approvedTree - tree `pre-commit` last approved

 @returns revalidated tree or blocking result

 @throws {@link ReplayedPreCommitRejectedError} when the re-run `pre-commit` rejects

 @example
 ```ts
 await revalidateReplay({ context, replay: 1, mergedTree, onto, approvedTree });
 ```
 */
export async function revalidateReplay({
  context,
  replay,
  mergedTree,
  onto,
  approvedTree,
}: Readonly<{
  context: RevalidationContext;
  replay: number;
  mergedTree: string;
  onto: string;
  approvedTree: string;
}>,): Promise<Revalidation> {
  /**
   Tagged revalidation logger.
   */
  const rl = tagged({
    tag: revalidateReplay.name,
    l,
  },);
  /**
   Invocation facts.
   */
  const {
    gitPath,
    cwd,
    workspace,
  } = context;
  /**
   Private directory of this replay.
   */
  const directory = join(
    workspace.directory,
    `replay-${String(replay,)}`,
  );
  await mkdir(
    directory,
    { mode: PRIVATE_DIRECTORY_MODE, },
  );
  /**
   Private index of the replayed tree.
   */
  const indexPath = join(
    directory,
    'commit.index',
  );
  await runTransactionGit({
    gitPath,
    cwd,
    indexPath,
    args: [
      'read-tree',
      mergedTree,
    ],
    objectDirectory: workspace.objectDirectory,
  },);
  await moveShadowHead({
    context,
    onto,
  },);
  /**
   Policy options reusing preparation's recorded runs, with inputs fingerprinted at the replay parent.
   */
  const policyOptions = await withPolicyReadTracking({
    policyOptions: context.policyOptions,
    location: {
      gitPath,
      repositoryRoot: context.repositoryRoot,
      shadowPath: workspace.shadowPath,
      environment: process.env,
    },
  },);
  /**
   Paths the replayed commit changes relative to its new parent.
   */
  const candidatePaths = await listChangedIndexPaths({
    gitPath,
    cwd,
    indexPath,
    baseRevision: onto,
    objectDirectory: workspace.objectDirectory,
  },);
  /**
   Replayed paths plus policy-added paths.
   */
  const addedPaths = createAddedPathTracker(candidatePaths,);
  /**
   Candidate facts of the replayed tree.
   */
  const facts = createPrivateIndexFacts({
    gitPath,
    cwd,
    indexPath,
    paths: candidatePaths,
    baseRevision: onto,
    objectDirectory: workspace.objectDirectory,
  },);
  /**
   Snapshot the convergence cycle check starts from.
   */
  const firstSnapshot = join(
    directory,
    'candidate-0.state',
  );
  await writeCandidateSnapshot({
    gitFacts: facts,
    snapshotPath: firstSnapshot,
  },);
  /**
   First pass over the replayed candidates.
   */
  const firstPass = await runPolicyEngine({
    ...policyOptions,
    args: context.args,
    trigger: 'pre-forward',
    gitFacts: facts,
    candidateVersion: 0,
    canApplyPatches: !context.readOnlySelection,
    repositoryRoot: cwd,
  },);
  /**
   Settled policies; read-only selection keeps the exact replayed candidate.
   */
  const convergence = context.readOnlySelection
    ? {
      kind: 'settled' as const,
      pass: firstPass,
      changedPasses: 0,
      changedPaths: [],
    }
    : await convergeCommitPolicies({
      args: context.args,
      gitPath,
      cwd,
      workspace: {
        directory,
        commitIndexPath: indexPath,
        capturedIndexPath: workspace.capturedIndexPath,
        objectDirectory: workspace.objectDirectory,
      },
      policyOptions,
      baseRevision: onto,
      repositoryRoot: context.repositoryRoot,
      addedPaths,
      firstPass,
      firstSnapshot,
    },);
  if (convergence.kind === 'blocked')
    return {
      kind: 'blocked',
      result: convergence.result,
    };
  if (!convergence.pass
    .shouldForward)
    return {
      kind: 'blocked',
      result: convergence.pass,
    };
  /**
   Tree after policy patches.
   */
  const policyTree = await writePrivateTree({
    workspace,
    gitPath,
    cwd,
    indexPath,
  },);
  /**
   Whether `pre-commit` must see this tree.
   */
  const rerun = (!context.noVerify) && (policyTree !== approvedTree);
  if (rerun)
    await rerunPreCommit({
      gitPath,
      worktreeRoot: context.repositoryRoot,
      globalArgs: context.globalArgs,
      shadowPath: workspace.shadowPath,
      hooksDirectory: workspace.hooksDirectory,
      indexPath,
    },);
  /**
   Tree after the hook, which the commit keeps.
   */
  const treeOid = rerun
    ? await writePrivateTree({
      workspace,
      gitPath,
      cwd,
      indexPath,
    },)
    : policyTree;
  rl.debug(`revalidated replay ${String(replay,)} onto ${onto}: tree ${treeOid}${rerun ? ' after pre-commit' : ''}`,);
  return {
    kind: 'revalidated',
    treeOid,
    indexPath,
    pass: convergence.pass,
    changedPasses: convergence.changedPasses,
    changedPaths: convergence.changedPaths,
    committedPaths: addedPaths.candidatePaths(),
    addedPaths: await settleAddedPathRecords({
      gitPath,
      cwd,
      indexPath,
      pending: addedPaths.pending(),
    },),
    hookChanges: rerun
      ? await describeHookChanges({
        gitPath,
        cwd,
        objectDirectory: workspace.objectDirectory,
        fromTree: policyTree,
        toTree: treeOid,
      },)
      : NO_HOOK_CHANGES,
  };
}
