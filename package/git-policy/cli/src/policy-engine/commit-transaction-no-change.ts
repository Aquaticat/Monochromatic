//region Normalization-only transaction
/**
 Reconciles a final-newline correction whose complete intended tree equals HEAD.

 @module
 */
import {
  type AddedPathRecord,
  installAddedWorktreeFiles,
} from './commit-transaction-added-paths.ts';
import type { InvocationCapture, } from './commit-transaction-capture.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import type { TransactionMode, } from './commit-transaction-journal-states.ts';
import type { CommitTransactionResult, } from './commit-transaction-types.ts';
import type { CommitTransactionWorkspace, } from './commit-transaction-workspace.ts';
import { landTransaction, } from './commit-landing.ts';
import { landingFindingResult, } from './commit-landing-findings.ts';
import { createCoreFindingEvent, } from './events.ts';
import { withFixSummary, } from './fix-summary.ts';
import type { PolicyEngineResult, } from './types.ts';

/**
 No normalization-only operation was necessary.
 */
export const NO_CHANGE_NOT_APPLICABLE: unique symbol = Symbol('commit still has a change',);
/**
 Strict Git tree decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Completes an index and worktree correction without creating an empty commit.
 The normalization lands through the landing critical section against the recorded base,
 so a base that moved since invocation fails without touching the index.

 @param workspace - transaction workspace

 @param capture - invocation capture

 @param gitPath - real Git executable

 @param cwd - effective repository directory

 @param repositoryRoot - canonical worktree root

 @param mode - original commit selection mode

 @param eligible - false for explicit allow-empty, amend, and sequencer operations

 @param intendedTreeOid - completely settled private tree

 @param committedPaths - concrete original selection including policy additions

 @param addedPaths - paths introduced by policies

 @param selectedWorktreePaths - selected newline files matching their initial bytes

 @param pass - settled engine pass

 @param changedPasses - number of fix iterations

 @param changedPaths - fixed paths for summary

 @param indexLockTimeoutMs - backoff budget for a foreign `index.lock`

 @returns no-commit result or absence when Git still has a commit to make

 @example
 ```ts
 await completeNoChangeTransaction({ workspace, capture, gitPath, cwd, repositoryRoot, mode: 'explicit-path', eligible: true, intendedTreeOid, committedPaths: [], addedPaths: [], selectedWorktreePaths: [], pass, changedPasses: 1, changedPaths: [], indexLockTimeoutMs: 1_000 });
 ```
 */
export async function completeNoChangeTransaction({
  workspace,
  capture,
  gitPath,
  cwd,
  repositoryRoot,
  mode,
  eligible,
  intendedTreeOid,
  committedPaths,
  addedPaths,
  selectedWorktreePaths,
  pass,
  changedPasses,
  changedPaths,
  indexLockTimeoutMs,
}: Readonly<{
  workspace: CommitTransactionWorkspace;
  capture: InvocationCapture;
  gitPath: string;
  cwd: string;
  repositoryRoot: string;
  mode: TransactionMode;
  eligible: boolean;
  intendedTreeOid: string;
  committedPaths: readonly string[];
  addedPaths: readonly AddedPathRecord[];
  selectedWorktreePaths: readonly AddedPathRecord[];
  pass: PolicyEngineResult;
  changedPasses: number;
  changedPaths: readonly string[];
  indexLockTimeoutMs: number;
}>,): Promise<CommitTransactionResult | typeof NO_CHANGE_NOT_APPLICABLE> {
  if ((!eligible) || (capture.base
    .kind
    === 'unborn'))
    return NO_CHANGE_NOT_APPLICABLE;
  /**
   Tree of the recorded base, never a later moving HEAD.
   */
  const baseTreeOid = DECODER.decode((await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--verify',
      `${capture.base
        .oid}^{tree}`,
    ],
  },)).stdout,)
    .trim();
  if (baseTreeOid !== intendedTreeOid)
    return NO_CHANGE_NOT_APPLICABLE;
  /**
   Final stable pass plus accurate fix summary.
   */
  const summary = withFixSummary({
    result: pass,
    trigger: 'pre-forward',
    passes: changedPasses,
    changedPaths,
  },);
  /**
   Landing of the normalization.
   */
  const outcome = await landTransaction({
    gitPath,
    cwd,
    capture,
    workspace,
    mode,
    payload: {
      operation: 'normalize-only',
      landedTreeOid: intendedTreeOid,
    },
    committedPaths,
    addedPaths,
    selectedWorktreePaths,
    indexLockTimeoutMs,
    attempt: 1,
  },);
  if (outcome.kind !== 'landed')
    return {
      committed: false,
      policyResult: landingFindingResult({
        pass: summary,
        outcome,
        capture,
      },),
    };
  /**
   Worktree copies completed or preserved after concurrent edits.
   */
  const completion = await installAddedWorktreeFiles({
    gitPath,
    cwd,
    repositoryRoot,
    records: [
      ...addedPaths,
      ...selectedWorktreePaths,
    ],
    objectDirectory: workspace.objectDirectory,
  },);
  workspace.finishTransaction();
  /**
   Worktree paths whose later edits were retained.
   */
  const { conflicted, } = completion;
  /**
   Whether completion retained later worktree edits.
   */
  const hasConflicts = conflicted.length > 0;
  return {
    committed: false,
    policyResult: {
      ...summary,
      events: [
        ...summary.events,
        createCoreFindingEvent({
          sequence: summary.events
            .length,
          coreId: 'commit-normalization',
          code: 'no-change',
          message: hasConflicts
            ? `No commit created: normalization removed every selected change; index copies were reconciled, but worktree copies changed and were kept: ${JSON.stringify(conflicted,)}. Compare them with HEAD before retrying.`
            : 'No commit created: normalization removed every selected change; matching worktree and index copies were reconciled.',
        },),
      ],
      exitCode: 1,
      shouldForward: false,
    },
  };
}
//endregion Normalization-only transaction
