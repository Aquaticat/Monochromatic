/**
 * Convergent private-index commit autofix transaction.
 *
 * @module
 */
import {
  copyFile,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { parseCommitRegion, } from '../parsers/commit.ts';
import { createEngineFailureEvent, } from './events.ts';
import {
  applyPrivatePatch,
  createPrivateIndexFacts,
  listChangedIndexPaths,
  runTransactionGit,
} from './commit-transaction-git.ts';
import {
  initializeCommitIndex,
  installExplicitPostIndex,
} from './commit-transaction-index.ts';
import { containsExactSnapshot, } from './commit-transaction-snapshots.ts';
import { createCommitTransactionWorkspace, } from './commit-transaction-workspace.ts';
import { runPolicyEngine, } from './engine.ts';
import { resolveLandedCommitOid, } from './post-commit-facts.ts';
import type {
  PolicyEngineResult,
  RunPolicyEngineOptions,
} from './types.ts';

/**
 * Transaction does not apply to current invocation.
 */
export const COMMIT_TRANSACTION_NOT_APPLICABLE: unique symbol = Symbol('commit transaction not applicable',);
/**
 * Maximum changed passes before convergence failure.
 */
const MAXIMUM_CHANGED_PASSES = 8;
/**
 * Internal and explicit only-mode tokens removed for private explicit index.
 */
const ONLY_MODE_TOKENS: ReadonlySet<string> = new Set([
  '-o',
  '--only',
],);

/**
 * Transaction result before shared post-commit lifecycle.
 */
export type CommitTransactionResult = Readonly<{
  /**
   * Final stable policy result.
   */
  policyResult: PolicyEngineResult;
  /**
   * Whether transaction executed real commit.
   */
  committed: boolean;
}>;

/**
 * Policy options supplied identically on every convergence pass.
 */
export type CommitTransactionPolicyOptions = Omit<
  RunPolicyEngineOptions,
  'args' | 'trigger' | 'gitFacts' | 'candidateVersion' | 'repositoryRoot'
>;

/**
 * Produces engine failure retaining transformed command facts.
 *
 * @param previous - latest policy pass
 *
 * @param message - transaction failure description
 *
 * @returns blocking engine result
 */
function transactionFailure({
  previous,
  message,
}: Readonly<{
  previous: PolicyEngineResult;
  message: string;
}>,): PolicyEngineResult {
  return {
    args: previous.args,
    escapedPolicyIds: previous.escapedPolicyIds,
    events: [createEngineFailureEvent({
      sequence: 0,
      code: 'content-unavailable',
      message,
      trigger: 'pre-forward',
    },),],
    patches: [],
    exitCode: 2,
    shouldForward: false,
  };
}

/**
 * Removes selected pathspecs and only flag after private explicit tree exists.
 *
 * @param args - transformed Git arguments
 *
 * @param pathspecs - parsed selected paths
 *
 * @returns private-index commit arguments
 */
function privateExplicitCommitArgs({
  args,
  pathspecs,
}: Readonly<{
  args: readonly string[];
  pathspecs: readonly string[];
}>,): readonly string[] {
  /**
   * Mutable local command copy used only to remove known token positions.
   */
  const retained = [...args,];
  for (const pathspec of [...pathspecs,].toReversed()) {
    /**
     * Last matching token, where ordinary commit pathspecs occur after option values.
     */
    const index = retained.lastIndexOf(pathspec,);
    if (index !== (-1))
      retained.splice(
        index,
        1,
      );
  }
  return retained.filter(function retainToken(token,) {
    return (token !== '--') && (!ONLY_MODE_TOKENS.has(token,));
  },);
}

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Trusted runtime registry contains callback declarations; transaction reads but never mutates them. */
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
    || region.hasAllFlag
    || region.hasIncludeFlag
    || region.hasPathspecFromFile
    || region.hasAmendFlag)
    return COMMIT_TRANSACTION_NOT_APPLICABLE;
  /**
   * Supported private-index mode.
   */
  const mode = region.hasNoOnlyFlag ? 'index' : 'explicit-path';
  if ((mode === 'explicit-path') && (region.pathspecs
    .length
    === 0))
    return COMMIT_TRANSACTION_NOT_APPLICABLE;

  /**
   * Locked disposable private-index workspace.
   */
  await using workspace = await createCommitTransactionWorkspace({
    gitPath,
    cwd: layout.effectiveCwd,
  },);
  await initializeCommitIndex({
    workspace,
    gitPath,
    cwd: layout.effectiveCwd,
    mode,
    pathspecs: region.pathspecs,
  },);
  /**
   * Candidate paths selected by commit semantics.
   */
  const candidatePaths = mode === 'explicit-path'
    ? region.pathspecs
    : await listChangedIndexPaths({
      gitPath,
      cwd: layout.effectiveCwd,
      indexPath: workspace.commitIndexPath,
    },);
  /**
   * Initial exact private candidate-state snapshot.
   */
  const initialSnapshot = join(
    workspace.directory,
    'candidate-0.index',
  );
  await copyFile(
    workspace.commitIndexPath,
    initialSnapshot,
  );
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
    gitFacts: createPrivateIndexFacts({
      gitPath,
      cwd: layout.effectiveCwd,
      indexPath: workspace.commitIndexPath,
      paths: candidatePaths,
    },),
    candidateVersion: 0,
    repositoryRoot: layout.effectiveCwd,
  },);
  /**
   * Number of passes that changed private candidate bytes.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- Bounded sequential convergence counts exact candidate changes.
  let changedPasses = 0;
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
        policyResult: transactionFailure({
          previous: pass,
          message: 'Policy patches did not converge within eight changed passes.',
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
    for (const [ordinal, patch,] of pass.patches
      .entries()) {
      if (!candidates.some(function matches(candidate,) {
        return (candidate.targetId === patch.targetId) && (candidate.path === patch.path);
      },))
        return {
          policyResult: transactionFailure({
            previous: pass,
            message: `Patch target is stale or undeclared: ${patch.path}`,
          },),
          committed: false,
        };
      try {
        // oxlint-disable-next-line no-await-in-loop -- Ordered patches intentionally compose through one private index.
        await applyPrivatePatch({
          workspace,
          gitPath,
          cwd: layout.effectiveCwd,
          patch,
          ordinal,
        },);
      }
      catch (error: unknown) {
        return {
          policyResult: transactionFailure({
            previous: pass,
            message: Error.isError(error,) ? error.message : String(error,),
          },),
          committed: false,
        };
      }
    }
    /**
     * Exact state after current ordered patches.
     */
    // oxlint-disable-next-line no-await-in-loop -- Exact state is captured after each bounded changed pass.
    const current = new Uint8Array(await readFile(workspace.commitIndexPath,),);
    // oxlint-disable-next-line no-await-in-loop -- Cycle detection streams prior exact snapshots after each bounded change.
    if (await containsExactSnapshot({
      snapshotPaths: visited,
      current,
    },))
      return {
        policyResult: transactionFailure({
          previous: pass,
          message: 'Policy patches repeated an exact prior candidate state.',
        },),
        committed: false,
      };
    /**
     * Private exact snapshot for current changed pass.
     */
    const snapshotPath = join(
      workspace.directory,
      `candidate-${String(changedPasses + 1,)}.index`,
    );
    // oxlint-disable-next-line no-await-in-loop -- Each bounded changed pass persists one exact comparison snapshot.
    await copyFile(
      workspace.commitIndexPath,
      snapshotPath,
    );
    visited.push(snapshotPath,);
    changedPasses += 1;
    // oxlint-disable-next-line no-await-in-loop -- Whole ordered engine restarts after each bounded exact change.
    pass = await runPolicyEngine({
      ...policyOptions,
      args,
      trigger: 'pre-forward',
      gitFacts: createPrivateIndexFacts({
        gitPath,
        cwd: layout.effectiveCwd,
        indexPath: workspace.commitIndexPath,
        paths: candidatePaths,
      },),
      candidateVersion: changedPasses,
      repositoryRoot: layout.effectiveCwd,
    },);
  }
  if ((!pass.shouldForward) || (changedPasses === 0))
    return {
      policyResult: pass,
      committed: false,
    };
  /**
   * Real Git arguments against complete private intended index.
   */
  const commitArgs = mode === 'explicit-path'
    ? privateExplicitCommitArgs({
      args: pass.args,
      pathspecs: region.pathspecs,
    },)
    : pass.args;
  await runTransactionGit({
    gitPath,
    cwd: process.cwd(),
    indexPath: workspace.commitIndexPath,
    args: commitArgs,
    stdio: 'inherit',
  },);
  /**
   * Exact landed commit after successful private-index Git.
   */
  const landedOid = await resolveLandedCommitOid({
    gitPath,
    cwd: layout.effectiveCwd,
  },);
  await (mode === 'explicit-path'
    ? installExplicitPostIndex({
      workspace,
      gitPath,
      cwd: layout.effectiveCwd,
      pathspecs: region.pathspecs,
      landedOid,
    },)
    : workspace.installIndex(workspace.commitIndexPath,));
  return {
    policyResult: pass,
    committed: true,
  };
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
