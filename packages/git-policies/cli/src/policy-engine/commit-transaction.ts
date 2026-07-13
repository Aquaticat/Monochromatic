/**
 * Convergent private-index commit autofix transaction.
 *
 * @module
 */
import { join, } from 'node:path';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { parseCommitRegion, } from '../parsers/commit.ts';
import { applyPolicyPatches, } from './apply-policy-patches.ts';
import {
  containsExactCandidateSnapshot,
  writeCandidateSnapshot,
} from './commit-transaction-candidate-snapshot.ts';
import {
  createPrivateIndexFacts,
  listChangedIndexPaths,
  listUnmergedIndexPaths,
} from './commit-transaction-candidates.ts';
import {
  initializeCommitIndex,
  preparePostIndex,
  writePrivateTree,
} from './commit-transaction-index.ts';
import { executePreparedCommit, } from './commit-transaction-finalize.ts';
import { prepareTransactionJournal, } from './commit-transaction-journal.ts';
import {
  fixCycleFailure,
  fixPassLimitFailure,
  initialTransactionFailure,
} from './commit-transaction-results.ts';
import {
  hasSequencerConclusion,
  materializePathspecFile,
  prepareInteractiveSelection,
  resolvePrivateCommitArgs,
} from './commit-transaction-selection.ts';
import { createCommitTransactionWorkspace, } from './commit-transaction-workspace.ts';
import { runPolicyEngine, } from './engine.ts';
import { withFixSummary, } from './fix-summary.ts';
import type {
  CommitTransactionPolicyOptions,
  CommitTransactionResult,
} from './commit-transaction-types.ts';

/**
 * Transaction does not apply to current invocation.
 */
export const COMMIT_TRANSACTION_NOT_APPLICABLE: unique symbol = Symbol('commit transaction not applicable',);
/**
 * Maximum changed passes before convergence failure.
 */
const MAXIMUM_CHANGED_PASSES = 8;

/**
 * Runs supported commit through convergent private-index patch transaction.
 *
 * @param args - exact wrapper arguments
 *
 * @param gitPath - resolved real Git executable
 *
 * @param policyOptions - trusted registry and severity options
 *
 * @returns absence sentinel for unsupported command, otherwise transaction decision
 *
 * @example
 * ```ts
 * await runCommitTransaction({ args: ['commit', '--no-only', '-m', 'x'], gitPath: '/usr/bin/git', policyOptions: {} });
 * ```
 */
export async function runCommitTransaction({
  args,
  gitPath,
  policyOptions,
}: Readonly<{
  args: readonly string[];
  gitPath: string;
  policyOptions: CommitTransactionPolicyOptions;
}>,): Promise<CommitTransactionResult | typeof COMMIT_TRANSACTION_NOT_APPLICABLE> {
  /**
   * Raw command layout and effective repository directory.
   */
  const layout = parseGlobalOptions(args,);
  if (args[layout.subcommandIndex] !== 'commit')
    return COMMIT_TRANSACTION_NOT_APPLICABLE;
  /**
   * Parsed commit-mode facts.
   */
  const region = parseCommitRegion(args.slice(layout.subcommandIndex + 1,),);
  if (region.isDryRun
    || region.hasAllFlag)
    return COMMIT_TRANSACTION_NOT_APPLICABLE;
  /**
   * Whether pathless commit concludes repository operation.
   */
  const concludesSequencer = await hasSequencerConclusion({
    gitPath,
    cwd: layout.effectiveCwd,
  },);
  /**
   * Whether selection UI remains read-only for automatic fixes.
   */
  const readOnlySelection = region.hasIncludeFlag
    || region.hasInteractiveFlag
    || region.hasPatchFlag;
  /**
   * Supported private-index mode.
   */
  const mode = region.hasNoOnlyFlag
      || concludesSequencer
    || readOnlySelection
    || ((region.hasAllowEmptyFlag || region.hasAmendFlag) && (!region.hasPathspec))
    ? 'index'
    : 'explicit-path';
  if ((mode === 'explicit-path') && (region.pathspecs
    .length
    === 0)
    && (!region.hasPathspecFromFile))
    return COMMIT_TRANSACTION_NOT_APPLICABLE;

  /**
   * Locked disposable private-index workspace.
   */
  await using workspace = await createCommitTransactionWorkspace({
    gitPath,
    cwd: layout.effectiveCwd,
  },);
  /**
   * Pathspec file materialized once when Git names standard input.
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
   * Unmerged paths unsafe for automatic candidate rewriting.
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
   * Candidate paths selected by commit semantics.
   */
  const candidatePaths = await listChangedIndexPaths({
    gitPath,
    cwd: layout.effectiveCwd,
    indexPath: workspace.commitIndexPath,
  },);
  /**
   * Initial private-index candidate facts.
   */
  const initialFacts = createPrivateIndexFacts({
    gitPath,
    cwd: layout.effectiveCwd,
    indexPath: workspace.commitIndexPath,
    paths: candidatePaths,
  },);
  /**
   * Initial exact private candidate-state snapshot.
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
   * Ordered private paths for previously visited exact states.
   */
  const visited: string[] = [initialSnapshot,];
  /**
   * Latest policy pass, initialized before convergence loop.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- Bounded sequential convergence evolves latest pass after each exact candidate change.
  let pass = await runPolicyEngine({
    ...policyOptions,
    args,
    trigger: 'pre-forward',
    gitFacts: initialFacts,
    candidateVersion: 0,
    repositoryRoot: layout.effectiveCwd,
  },);
  if (readOnlySelection && (pass.patches
    .length
    > 0))
    return {
      policyResult: pass,
      committed: false,
    };
  /**
   * Number of passes that changed private candidate bytes.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- Bounded sequential convergence counts exact candidate changes.
  let changedPasses = 0;
  /**
   * Paths changed by at least one provisional patch.
   */
  const changedPaths = new Set<string>();
  while (pass.patches
    .length
    > 0) {
    if (pass.exitCode === 2)
      return {
        policyResult: pass,
        committed: false,
      };
    if (changedPasses >= MAXIMUM_CHANGED_PASSES)
      return {
        policyResult: fixPassLimitFailure({
          previous: pass,
          trigger: 'pre-forward',
        },),
        committed: false,
      };
    /**
     * Pass-start candidates bind all proposals to one exact state.
     */
    // oxlint-disable-next-line no-await-in-loop -- Each changed pass binds proposals to its exact current candidate state.
    const candidates = await createPrivateIndexFacts({
      gitPath,
      cwd: layout.effectiveCwd,
      indexPath: workspace.commitIndexPath,
      paths: candidatePaths,
    },)
      .candidates();
    /**
     * Ordered private patch application for current provisional pass.
     */
    // oxlint-disable-next-line no-await-in-loop -- Each changed pass applies its exact ordered proposals before restart.
    const applied = await applyPolicyPatches({
      workspace,
      gitPath,
      cwd: layout.effectiveCwd,
      pass,
      candidates,
      trigger: 'pre-forward',
    },);
    if (applied.kind === 'failed')
      return {
        policyResult: applied.result,
        committed: false,
      };
    applied.paths
      .forEach(function recordChangedPath(path,) {
      changedPaths.add(path,);
    },);
    /**
     * Current private-index candidate facts after ordered patches.
     */
    const currentFacts = createPrivateIndexFacts({
      gitPath,
      cwd: layout.effectiveCwd,
      indexPath: workspace.commitIndexPath,
      paths: candidatePaths,
    },);
    /**
     * Private exact snapshot for current changed pass.
     */
    const snapshotPath = join(
      workspace.directory,
      `candidate-${String(changedPasses + 1,)}.state`,
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
        policyResult: fixCycleFailure({
          previous: pass,
          trigger: 'pre-forward',
          message: 'Policy patches repeated an exact prior candidate state.',
        },),
        committed: false,
      };
    visited.push(snapshotPath,);
    changedPasses += 1;
    // oxlint-disable-next-line no-await-in-loop -- Whole ordered engine restarts after each bounded exact change.
    pass = await runPolicyEngine({
      ...policyOptions,
      args,
      trigger: 'pre-forward',
      gitFacts: currentFacts,
      candidateVersion: changedPasses,
      repositoryRoot: layout.effectiveCwd,
    },);
  }
  if ((!pass.shouldForward) || ((changedPasses === 0) && (!readOnlySelection)))
    return {
      policyResult: pass,
      committed: false,
    };
  /**
   * Exact intended tree written from stable private candidate state.
   */
  const intendedTreeOid = await writePrivateTree({
    workspace,
    gitPath,
    cwd: layout.effectiveCwd,
  },);
  await preparePostIndex({
    workspace,
    gitPath,
    cwd: layout.effectiveCwd,
    mode,
    selectedPaths: candidatePaths,
    intendedTreeOid,
  },);
  /**
   * Durable prepared metadata used to detect interrupted ref advancement.
   */
  const journal = await prepareTransactionJournal({
    workspace,
    gitPath,
    cwd: layout.effectiveCwd,
    mode,
    amend: region.hasAmendFlag,
    selectedPaths: candidatePaths,
    intendedTreeOid,
  },);
  /**
   * Real Git arguments against complete private intended index.
   */
  const commitArgs = resolvePrivateCommitArgs({
    args: pass.args,
    pathspecs: region.pathspecs,
    mode,
    selectedPrivately: readOnlySelection,
  },);
  await executePreparedCommit({
    workspace,
    gitPath,
    spawnCwd: process.cwd(),
    effectiveCwd: layout.effectiveCwd,
    commitArgs,
    intendedTreeOid,
    originalHead: journal.originalHead,
  },);
  return {
    policyResult: withFixSummary({
      result: pass,
      trigger: 'pre-forward',
      passes: changedPasses,
      changedPaths: [...changedPaths,],
    },),
    committed: true,
  };
}
