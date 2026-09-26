/**
 Concurrent commit transaction: invocation capture,
 private preparation without the real index lock,
 serial landing,
 and post-landing completion.

 Every non-dry-run commit runs through it,
 including clean commits and `commit -a`,
 because native `git commit` keeps `index.lock` on disk through hooks and the editor.

 @module
 */
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { hasValidInheritedLease, } from '../hook-dispatch/preparation-lease.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { parseCommitRegion, } from '../parser/commit.ts';
import { createShadowRepository, } from '../shadow-repository/shadow-repository.ts';
import {
  type ConcurrencyConfig,
  DEFAULT_CONCURRENCY_CONFIG,
} from '../trust/config-validation-concurrency.ts';
import { createAddedPathTracker, } from './commit-transaction-added-path-tracker.ts';
import { writeCandidateSnapshot, } from './commit-transaction-candidate-snapshot.ts';
import { createPrivateIndexFacts, } from './commit-transaction-candidates.ts';
import {
  baseRevision,
  captureInvocation,
} from './commit-transaction-capture.ts';
import { concludeCommitTransaction, } from './commit-transaction-conclusion.ts';
import { convergeCommitPolicies, } from './commit-transaction-convergence.ts';
import { initializeCommitIndex, } from './commit-transaction-index.ts';
import { withPolicyReadTracking, } from './commit-transaction-read-tracking.ts';
import {
  listChangedIndexPaths,
  listUnmergedIndexPaths,
} from './commit-transaction-index-paths.ts';
import {
  JOURNAL_SCHEMA_VERSION,
  PREPARING_FILENAME,
  writeJournalRecord,
} from './commit-transaction-journal-states.ts';
import { initialTransactionFailure, } from './commit-transaction-results.ts';
import {
  materializePathspecFile,
  prepareInteractiveSelection,
} from './commit-transaction-selection.ts';
import { createCommitTransactionWorkspace, } from './commit-transaction-workspace.ts';
import { selectedWorktreeRoot, } from './commit-transaction-selected-worktree.ts';
import { runPolicyEngine, } from './engine.ts';
import type {
  CommitTransactionPolicyOptions,
  CommitTransactionResult,
} from './commit-transaction-types.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Transaction does not apply to current invocation.
 */
export const COMMIT_TRANSACTION_NOT_APPLICABLE: unique symbol = Symbol('commit transaction not applicable',);

/**
 Runs every non-dry-run commit through the concurrent commit transaction.

 @param args - exact wrapper arguments

 @param gitPath - resolved real Git executable

 @param policyOptions - trusted registry and severity options

 @param concurrency - trusted concurrency tuning, defaults when config is absent

 @returns absence sentinel for a non-commit or dry run, otherwise transaction decision

 @example
 ```ts
 await runCommitTransaction({ args: ['commit', '--no-only', '-m', 'x'], gitPath: '/usr/bin/git', policyOptions: {} });
 ```
 */
export async function runCommitTransaction({
  args,
  gitPath,
  policyOptions,
  concurrency = DEFAULT_CONCURRENCY_CONFIG,
}: Readonly<{
  args: readonly string[];
  gitPath: string;
  policyOptions: CommitTransactionPolicyOptions;
  concurrency?: ConcurrencyConfig;
}>,): Promise<CommitTransactionResult | typeof COMMIT_TRANSACTION_NOT_APPLICABLE> {
  /**
   Tagged transaction logger.
   */
  const rl = tagged({
    tag: runCommitTransaction.name,
    l,
  },);
  /**
   Raw command layout and effective repository directory.
   */
  const layout = parseGlobalOptions(args,);
  if (args[layout.subcommandIndex] !== 'commit')
    return COMMIT_TRANSACTION_NOT_APPLICABLE;
  /**
   Parsed commit-mode facts.
   */
  const region = parseCommitRegion(args.slice(layout.subcommandIndex + 1,),);
  if (region.isDryRun)
    return COMMIT_TRANSACTION_NOT_APPLICABLE;
  /**
   Facts recorded before any Git mutation.
   */
  const capture = await captureInvocation({
    gitPath,
    cwd: layout.effectiveCwd,
    amend: region.hasAmendFlag,
  },);
  /**
   Recorded baseline every later read uses instead of live `HEAD`.
   */
  const base = baseRevision(capture,);
  /**
   Whether pathless commit concludes a merge, cherry-pick, or revert.
   */
  const concludesSequencer = (capture.conclusion !== 'none') && (capture.conclusion !== 'amend');
  /**
   Whether selection UI remains read-only for automatic fixes.
   */
  const readOnlySelection = region.hasIncludeFlag
    || region.hasInteractiveFlag
    || region.hasPatchFlag;
  /**
   Whether any path was selected.
   */
  const selectsPaths = (region.pathspecs
    .length
    > 0) || region.hasPathspecFromFile;
  /**
   Whether `-a` stages privately; invalid combinations reach native Git unchanged so it rejects them.
   */
  const stagedAll = region.hasAllFlag && (!selectsPaths)
    && (!readOnlySelection)
    && (!region.hasExplicitOnlyFlag);
  /**
   Supported private-index mode.
   */
  const mode = region.hasNoOnlyFlag
    || concludesSequencer
    || readOnlySelection
    || region.hasAllFlag
    || (!selectsPaths)
    ? 'index'
    : 'explicit-path';
  /**
   Disposable private workspace, published before any Git mutation.
   */
  await using workspace = await createCommitTransactionWorkspace({ capture, },);
  await writeJournalRecord({
    directory: workspace.directory,
    filename: PREPARING_FILENAME,
    record: {
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      state: 'preparing',
      transactionId: workspace.transactionId,
      mode,
      base: capture.base,
      symbolicHead: capture.symbolicHead,
      targetRef: capture.targetRef,
      conclusion: capture.conclusion,
      repositoryRoot: capture.repositoryRoot,
      gitDir: capture.gitDir,
      commonDir: capture.commonDir,
      realIndexPath: capture.realIndexPath,
      objectDirectory: capture.objectDirectory,
      refFormat: capture.refFormat,
      emptyTreeOid: capture.emptyTreeOid,
      shadowPath: workspace.shadowPath,
      selectedPathspecs: region.pathspecs,
      invokedAt: capture.invokedAt,
    },
  },);
  // Before the private index exists, so every object preparation writes lands in the shadow store,
  // which a concurrent real `gc --prune=now` never sees.
  await createShadowRepository({
    gitPath,
    cwd: layout.effectiveCwd,
    capture,
    transactionId: workspace.transactionId,
    transactionDirectory: workspace.directory,
  },);
  /**
   Pathspec file materialized once when Git names standard input.
   */
  const pathspecFile = await materializePathspecFile({
    workspace,
    effectiveCwd: layout.effectiveCwd,
    ...(region.pathspecFile === undefined ? {} : { source: region.pathspecFile, }),
  },);
  await initializeCommitIndex({
    workspace,
    gitPath,
    cwd: layout.effectiveCwd,
    mode,
    pathspecs: region.pathspecs,
    ...((typeof pathspecFile) === 'symbol' ? {} : { pathspecFile, }),
    pathspecFileNul: region.hasPathspecFileNul,
    stageIntoIndex: region.hasIncludeFlag,
    stageTrackedChanges: stagedAll,
    baseRevision: base,
    objectDirectory: workspace.objectDirectory,
  },);
  if (region.hasInteractiveFlag || region.hasPatchFlag)
    await prepareInteractiveSelection({
      workspace,
      gitPath,
      cwd: layout.effectiveCwd,
      patch: region.hasPatchFlag,
      pathspecs: region.pathspecs,
      ...((typeof pathspecFile) === 'symbol' ? {} : { pathspecFile, }),
      pathspecFileNul: region.hasPathspecFileNul,
    },);
  /**
   Unmerged paths unsafe for automatic candidate rewriting.
   */
  const unmergedPaths = await listUnmergedIndexPaths({
    gitPath,
    cwd: layout.effectiveCwd,
    indexPath: workspace.commitIndexPath,
  },);
  if (unmergedPaths.length > 0)
    return {
      policyResult: initialTransactionFailure({
        args,
        code: 'content-unavailable',
        message: `Automatic commit fixes do not support unmerged index paths: ${unmergedPaths.join(', ',)}`,
      },),
      committed: false,
    };
  /**
   Candidate paths selected by commit semantics.
   */
  const candidatePaths = await listChangedIndexPaths({
    gitPath,
    cwd: layout.effectiveCwd,
    indexPath: workspace.commitIndexPath,
    baseRevision: base,
    objectDirectory: workspace.objectDirectory,
  },);
  /**
   Selected paths plus tracked paths policies added to the commit.
   */
  const addedPaths = createAddedPathTracker(candidatePaths,);
  /**
   Initial private-index candidate facts.
   */
  const initialFacts = createPrivateIndexFacts({
    gitPath,
    cwd: layout.effectiveCwd,
    indexPath: workspace.commitIndexPath,
    paths: candidatePaths,
    baseRevision: base,
    objectDirectory: workspace.objectDirectory,
  },);
  /**
   Initial exact private candidate-state snapshot.
   */
  const initialSnapshot = join(
    workspace.directory,
    'candidate-0.state',
  );
  await writeCandidateSnapshot({
    gitFacts: initialFacts,
    snapshotPath: initialSnapshot,
  },);
  /**
   Original selected blobs remain bound to the pre-fix private index.
   */
  const initialCandidates = await initialFacts.candidates();
  /**
   Canonical worktree root for safe selected-file completion.
   */
  const repositoryRoot = await selectedWorktreeRoot({
    gitPath,
    cwd: layout.effectiveCwd,
  },);
  /**
   Policy options recording every policy's reads, so a replay can skip policies whose reads still hold.
   */
  const trackedOptions = await withPolicyReadTracking({
    policyOptions,
    location: {
      gitPath,
      repositoryRoot,
      shadowPath: workspace.shadowPath,
      environment: process.env,
    },
  },);
  /**
   First policy pass against the initial candidates.
   */
  const firstPass = await runPolicyEngine({
    ...trackedOptions,
    args,
    trigger: 'pre-forward',
    gitFacts: initialFacts,
    candidateVersion: 0,
    canApplyPatches: !readOnlySelection,
    repositoryRoot: layout.effectiveCwd,
  },);
  /**
   Settled policy state; read-only selection commits the exact chosen candidate without patches.
   */
  const convergence = readOnlySelection
    ? {
      kind: 'settled' as const,
      pass: firstPass,
      changedPasses: 0,
      changedPaths: [],
      newlinePaths: new Set<string>(),
    }
    : await convergeCommitPolicies({
      args,
      gitPath,
      cwd: layout.effectiveCwd,
      workspace,
      policyOptions: trackedOptions,
      baseRevision: base,
      repositoryRoot,
      addedPaths,
      firstPass,
      firstSnapshot: initialSnapshot,
    },);
  if (convergence.kind === 'blocked')
    return {
      policyResult: convergence.result,
      committed: false,
    };
  if (!convergence.pass
    .shouldForward) {
    rl.debug('policies blocked the commit before preparation',);
    return {
      policyResult: convergence.pass,
      committed: false,
    };
  }
  return await concludeCommitTransaction({
    workspace,
    capture,
    gitPath,
    args,
    policyOptions: trackedOptions,
    cwd: layout.effectiveCwd,
    repositoryRoot,
    mode,
    amend: region.hasAmendFlag,
    allowEmpty: region.hasAllowEmptyFlag,
    concludesSequencer,
    pathspecs: region.pathspecs,
    readOnlySelection,
    stagedAll,
    initialCandidates,
    newlinePaths: convergence.newlinePaths,
    addedPaths,
    pass: convergence.pass,
    changedPasses: convergence.changedPasses,
    changedPaths: convergence.changedPaths,
    concurrency,
    inheritedLeaseValid: await hasValidInheritedLease(process.env,),
  },);
}
