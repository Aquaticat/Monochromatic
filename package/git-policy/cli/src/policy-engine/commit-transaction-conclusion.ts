//region Settled commit transaction
/**
 Prepares and completes a converged private-index commit or no-change correction.

 @module
 */
import type { CandidateFile, } from '../api/policy-types.ts';
import {
  type AddedPathTracker,
  settleAddedPathRecords,
} from './commit-transaction-added-path-tracker.ts';
import { executePreparedCommit, } from './commit-transaction-finalize.ts';
import {
  preparePostIndex,
  writePrivateTree,
} from './commit-transaction-index.ts';
import { prepareTransactionJournal, } from './commit-transaction-journal.ts';
import {
  completeNoChangeTransaction,
  NO_CHANGE_NOT_APPLICABLE,
} from './commit-transaction-no-change.ts';
import { resolvePrivateCommitArgs, } from './commit-transaction-selection.ts';
import { selectedWorktreeRecords, } from './commit-transaction-selected-worktree.ts';
import type { CommitTransactionResult, } from './commit-transaction-types.ts';
import type { CommitTransactionWorkspace, } from './commit-transaction-workspace.ts';
import { withFixSummary, } from './fix-summary.ts';
import type { PolicyEngineResult, } from './types.ts';

/**
 Completes a settled policy pass through a real commit or a normalization-only reconciliation.

 @param workspace - owned transaction workspace

 @param gitPath - real Git executable

 @param cwd - effective repository directory

 @param repositoryRoot - canonical worktree root

 @param mode - Git selection mode

 @param amend - user explicitly requested amend

 @param allowEmpty - user explicitly permits empty commit

 @param concludesSequencer - merge or sequencer conclusion must reach Git

 @param pathspecs - original parsed selection tokens

 @param readOnlySelection - interactive selection mode

 @param initialCandidates - candidates before any policy correction

 @param newlinePaths - paths fixed by core final-newline

 @param addedPaths - paths included through the policy-added tracker

 @param pass - settled policy engine result

 @param changedPasses - number of converged changed passes

 @param changedPaths - paths changed by those passes

 @returns committed or normalization-only result

 @example
 ```ts
 await concludeCommitTransaction({ workspace, gitPath, cwd, repositoryRoot, mode: 'index', amend: false, allowEmpty: false, concludesSequencer: false, pathspecs: [], readOnlySelection: false, initialCandidates: [], newlinePaths: new Set(), addedPaths, pass, changedPasses: 1, changedPaths: [] });
 ```
 */
export async function concludeCommitTransaction({
  workspace,
  gitPath,
  cwd,
  repositoryRoot,
  mode,
  amend,
  allowEmpty,
  concludesSequencer,
  pathspecs,
  readOnlySelection,
  initialCandidates,
  newlinePaths,
  addedPaths,
  pass,
  changedPasses,
  changedPaths,
}: Readonly<{
  workspace: CommitTransactionWorkspace;
  gitPath: string;
  cwd: string;
  repositoryRoot: string;
  mode: 'explicit-path' | 'index';
  amend: boolean;
  allowEmpty: boolean;
  concludesSequencer: boolean;
  pathspecs: readonly string[];
  readOnlySelection: boolean;
  initialCandidates: readonly CandidateFile[];
  newlinePaths: ReadonlySet<string>;
  addedPaths: AddedPathTracker;
  pass: PolicyEngineResult;
  changedPasses: number;
  changedPaths: readonly string[];
}>,): Promise<CommitTransactionResult> {
  /**
   Exact intended tree written from stable private candidate state.
   */
  const intendedTreeOid = await writePrivateTree({
    workspace,
    gitPath,
    cwd,
  },);
  /**
   Added paths with blobs their worktree copies receive after landing.
   */
  const addedPathRecords = await settleAddedPathRecords({
    gitPath,
    cwd,
    indexPath: workspace.commitIndexPath,
    pending: addedPaths.pending(),
  },);
  /**
   Selected corrected files whose worktree equals their original staged blob.
   */
  const selectedWorktreePaths = await selectedWorktreeRecords({
    gitPath,
    cwd,
    repositoryRoot,
    indexPath: workspace.commitIndexPath,
    initialCandidates,
    newlinePaths,
  },);
  /**
   Selected and added paths the commit carries.
   */
  const committedPaths = addedPaths.candidatePaths();
  await preparePostIndex({
    workspace,
    gitPath,
    cwd,
    mode,
    selectedPaths: committedPaths,
    intendedTreeOid,
  },);
  /**
   Correction can remove every selected difference from HEAD.
   */
  const noChange = await completeNoChangeTransaction({
    workspace,
    gitPath,
    cwd,
    repositoryRoot,
    mode,
    eligible: (newlinePaths.size > 0)
      && (!allowEmpty)
      && (!amend)
      && (!concludesSequencer),
    intendedTreeOid,
    selectedPaths: committedPaths,
    addedPaths: addedPathRecords,
    selectedWorktreePaths,
    pass,
    changedPasses,
    changedPaths,
  },);
  if (noChange !== NO_CHANGE_NOT_APPLICABLE)
    return noChange;
  /**
   Durable prepared metadata for interrupted ref advancement.
   */
  const journal = await prepareTransactionJournal({
    workspace,
    gitPath,
    cwd,
    mode,
    amend,
    selectedPaths: committedPaths,
    addedPaths: addedPathRecords,
    selectedWorktreePaths,
    intendedTreeOid,
  },);
  /**
   Real Git arguments against complete private intended index.
   */
  const commitArgs = resolvePrivateCommitArgs({
    args: pass.args,
    pathspecs,
    mode,
    selectedPrivately: readOnlySelection,
  },);
  await executePreparedCommit({
    workspace,
    gitPath,
    spawnCwd: process.cwd(),
    effectiveCwd: cwd,
    commitArgs,
    intendedTreeOid,
    originalHead: journal.originalHead,
    repositoryRoot,
    addedPaths: addedPathRecords,
    selectedWorktreePaths,
  },);
  return {
    policyResult: withFixSummary({
      result: pass,
      trigger: 'pre-forward',
      passes: changedPasses,
      changedPaths,
    },),
    committed: true,
  };
}
//endregion Settled commit transaction
