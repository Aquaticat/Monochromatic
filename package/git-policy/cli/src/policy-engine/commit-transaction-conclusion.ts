//region Settled commit transaction
/**
 Completes a converged private-index commit: private native preparation in the shadow repository,
 serial landing,
 and post-landing completion.

 @module
 */
import { randomUUID, } from 'node:crypto';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { CandidateFile, } from '../api/policy-types.ts';
import { computeHookDispatchPlan, } from '../hook-dispatch/hook-dispatch-plan.ts';
import { writeHookShim, } from '../hook-dispatch/hook-shim-writer.ts';
import { formatPreparationLease, } from '../hook-dispatch/preparation-lease.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { createShadowRepository, } from '../shadow-repository/shadow-repository.ts';
import type { ConcurrencyConfig, } from '../trust/config-validation-concurrency.ts';
import {
  type AddedPathTracker,
  settleAddedPathRecords,
} from './commit-transaction-added-path-tracker.ts';
import { installAddedWorktreeFiles, } from './commit-transaction-added-paths.ts';
import type { InvocationCapture, } from './commit-transaction-capture.ts';
import { writePrivateTree, } from './commit-transaction-index.ts';
import {
  JOURNAL_SCHEMA_VERSION,
  PREPARED_FILENAME,
  type TransactionMode,
  writeJournalRecord,
} from './commit-transaction-journal-states.ts';
import {
  completeNoChangeTransaction,
  NO_CHANGE_NOT_APPLICABLE,
} from './commit-transaction-no-change.ts';
import { transactionFailure, } from './commit-transaction-results.ts';
import { resolvePrivateCommitArgs, } from './commit-transaction-selection.ts';
import { selectedWorktreeRecords, } from './commit-transaction-selected-worktree.ts';
import type { CommitTransactionResult, } from './commit-transaction-types.ts';
import type { CommitTransactionWorkspace, } from './commit-transaction-workspace.ts';
import { landTransaction, } from './commit-landing.ts';
import { landingFindingResult, } from './commit-landing-findings.ts';
import { runPostCommitHook, } from './commit-landing-post-commit-hook.ts';
import {
  readPreparedCommit,
  runNativePreparation,
  splitCommitInvocation,
  withoutAllFlag,
} from './commit-preparation-native.ts';
import { withChangedFixSummary, } from './fix-summary.ts';
import type { PolicyEngineResult, } from './types.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Settled transaction state a conclusion needs.
 */
export type SettledCommitTransaction = Readonly<{
  /**
   Transaction workspace.
   */
  workspace: CommitTransactionWorkspace;
  /**
   Invocation capture.
   */
  capture: InvocationCapture;
  /**
   Real Git executable.
   */
  gitPath: string;
  /**
   Effective repository directory.
   */
  cwd: string;
  /**
   Canonical worktree root.
   */
  repositoryRoot: string;
  /**
   Git selection mode.
   */
  mode: TransactionMode;
  /**
   User explicitly requested amend.
   */
  amend: boolean;
  /**
   User explicitly permits an empty commit.
   */
  allowEmpty: boolean;
  /**
   Merge or sequencer conclusion must reach Git.
   */
  concludesSequencer: boolean;
  /**
   Original parsed selection tokens.
   */
  pathspecs: readonly string[];
  /**
   Interactive or include selection consumed privately.
   */
  readOnlySelection: boolean;
  /**
   Whether `-a` was staged privately and must not reach native Git.
   */
  stagedAll: boolean;
  /**
   Candidates before any policy correction.
   */
  initialCandidates: readonly CandidateFile[];
  /**
   Paths fixed by core final-newline.
   */
  newlinePaths: ReadonlySet<string>;
  /**
   Paths included through the policy-added tracker.
   */
  addedPaths: AddedPathTracker;
  /**
   Settled policy engine result.
   */
  pass: PolicyEngineResult;
  /**
   Number of converged changed passes.
   */
  changedPasses: number;
  /**
   Paths changed by those passes.
   */
  changedPaths: readonly string[];
  /**
   Concurrency tuning.
   */
  concurrency: ConcurrencyConfig;
  /**
   Whether this invocation runs under a valid outer preparation lease.
   */
  inheritedLeaseValid: boolean;
}>;

/**
 Completes a settled policy pass through a landed commit or a normalization-only reconciliation.

 @param settled - settled transaction state

 @returns landed, normalized, or blocked result

 @example
 ```ts
 await concludeCommitTransaction(settled);
 ```
 */
export async function concludeCommitTransaction(settled: SettledCommitTransaction,): Promise<CommitTransactionResult> {
  /**
   Tagged conclusion logger.
   */
  const rl = tagged({
    tag: concludeCommitTransaction.name,
    l,
  },);
  /**
   Settled transaction state.
   */
  const {
    workspace,
    capture,
    gitPath,
    cwd,
    repositoryRoot,
    mode,
    pass,
    changedPasses,
    changedPaths,
    concurrency,
  } = settled;
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
    pending: settled.addedPaths.pending(),
  },);
  /**
   Selected corrected files whose worktree equals their original staged blob.
   */
  const selectedWorktreePaths = await selectedWorktreeRecords({
    gitPath,
    cwd,
    repositoryRoot,
    indexPath: workspace.commitIndexPath,
    initialCandidates: settled.initialCandidates,
    newlinePaths: settled.newlinePaths,
  },);
  /**
   Selected and added paths the commit carries.
   */
  const committedPaths = settled.addedPaths.candidatePaths();
  /**
   Correction can remove every selected difference from the base.
   */
  const noChange = await completeNoChangeTransaction({
    workspace,
    capture,
    gitPath,
    cwd,
    repositoryRoot,
    mode,
    eligible: (settled.newlinePaths.size > 0)
      && (!settled.allowEmpty)
      && (!settled.amend)
      && (!settled.concludesSequencer),
    intendedTreeOid,
    committedPaths,
    addedPaths: addedPathRecords,
    selectedWorktreePaths,
    pass,
    changedPasses,
    changedPaths,
    indexLockTimeoutMs: concurrency.indexLock.unprovenOwnerTimeoutMs,
  },);
  if (noChange !== NO_CHANGE_NOT_APPLICABLE)
    return noChange;
  /**
   Real Git arguments against the complete private intended index.
   */
  const privateArgs = resolvePrivateCommitArgs({
    args: pass.args,
    pathspecs: settled.pathspecs,
    mode,
    selectedPrivately: settled.readOnlySelection,
  },);
  /**
   Kept global options and the commit region.
   */
  const invocation = splitCommitInvocation({
    args: privateArgs,
    subcommandIndex: parseGlobalOptions(privateArgs,).subcommandIndex,
  },);
  /**
   Dispatch plan shared by the preparation shim and the post-landing `post-commit`.
   */
  const plan = await computeHookDispatchPlan({
    gitPath,
    cwd,
    globalArgs: invocation.globalArgs,
    commonDir: capture.commonDir,
    worktreeRoot: repositoryRoot,
    lease: formatPreparationLease({
      directory: workspace.directory,
      token: randomUUID(),
    },),
    concurrentCommits: concurrency.hooks.concurrentCommits,
    inheritedLeaseValid: settled.inheritedLeaseValid,
    environment: process.env,
  },);
  await createShadowRepository({
    gitPath,
    cwd,
    capture,
    transactionId: workspace.transactionId,
    transactionDirectory: workspace.directory,
  },);
  await writeHookShim({
    hooksDirectory: workspace.hooksDirectory,
    plan,
    nodePath: process.execPath,
  },);
  await runNativePreparation({
    gitPath,
    cwd,
    globalArgs: invocation.globalArgs,
    commitArgs: settled.stagedAll ? withoutAllFlag(invocation.commitArgs,) : invocation.commitArgs,
    shadowPath: workspace.shadowPath,
    worktreeRoot: repositoryRoot,
    hooksDirectory: workspace.hooksDirectory,
    commitIndexPath: workspace.commitIndexPath,
  },);
  /**
   Prepared commit in the shadow.
   */
  const prepared = await readPreparedCommit({
    gitPath,
    shadowPath: workspace.shadowPath,
  },);
  if (prepared.treeOid !== intendedTreeOid) {
    rl.debug(`prepared tree ${prepared.treeOid} differs from intended ${intendedTreeOid}`,);
    return {
      policyResult: transactionFailure({
        previous: pass,
        message: `A commit hook changed the prepared tree from ${intendedTreeOid} to ${prepared.treeOid}; nothing landed and the private commit ${prepared.oid} was discarded. Stage the hook's changes and commit again.`,
      },),
      committed: false,
    };
  }
  await writeJournalRecord({
    directory: workspace.directory,
    filename: PREPARED_FILENAME,
    record: {
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      state: 'prepared',
      shadowPath: workspace.shadowPath,
      preparedOid: prepared.oid,
      signed: prepared.signed,
      intendedTreeOid,
      committedPaths,
      addedPaths: addedPathRecords,
      selectedWorktreePaths,
    },
  },);
  /**
   Landing outcome.
   */
  const outcome = await landTransaction({
    gitPath,
    cwd,
    capture,
    workspace,
    mode,
    payload: {
      operation: 'commit',
      newOid: prepared.oid,
      landedTreeOid: prepared.treeOid,
    },
    committedPaths,
    addedPaths: addedPathRecords,
    selectedWorktreePaths,
    indexLockTimeoutMs: concurrency.indexLock.unprovenOwnerTimeoutMs,
    attempt: 1,
  },);
  if (outcome.kind !== 'landed')
    return {
      policyResult: landingFindingResult({
        pass: withChangedFixSummary({
          result: pass,
          trigger: 'pre-forward',
          passes: changedPasses,
          changedPaths,
        },),
        outcome,
        capture,
        preparedOid: prepared.oid,
      },),
      committed: false,
    };
  // Before cleanup, so an interruption here leaves the journal for startup recovery to finish the worktree copies.
  await installAddedWorktreeFiles({
    gitPath,
    cwd,
    repositoryRoot,
    records: [
      ...addedPathRecords,
      ...selectedWorktreePaths,
    ],
  },);
  workspace.finishTransaction();
  await workspace[Symbol.asyncDispose]();
  await runPostCommitHook({
    gitPath,
    cwd: repositoryRoot,
    globalArgs: invocation.globalArgs,
    realIndexPath: capture.realIndexPath,
    landedOid: outcome.oid,
    plan,
  },);
  return {
    policyResult: withChangedFixSummary({
      result: pass,
      trigger: 'pre-forward',
      passes: changedPasses,
      changedPaths,
    },),
    committed: true,
    landedOid: outcome.oid,
  };
}
//endregion Settled commit transaction
