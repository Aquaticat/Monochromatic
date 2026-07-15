/**
 * Ref-advancing and recoverable index-install phase.
 *
 * @module
 */
import {
  type OriginalHead,
  recordIndexInstalled,
  recordRefUpdated,
  resolveCurrentHead,
} from './commit-transaction-journal.ts';
import {
  CommitTransactionRecoveryError,
  headsEqual,
} from './commit-transaction-recovery-validation.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import { resolveLandedCommitOid, } from './post-commit-facts.ts';
import type { CommitTransactionWorkspace, } from './commit-transaction-workspace.ts';

/**
 * Strict landed tree decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 * Runs real Git and installs prepared index with durable phase markers.
 *
 * @param workspace - prepared recoverable workspace
 *
 * @param gitPath - resolved real Git executable
 *
 * @param spawnCwd - caller cwd used with original global arguments
 *
 * @param effectiveCwd - parsed repository cwd
 *
 * @param commitArgs - final real Git commit arguments
 *
 * @param intendedTreeOid - exact policy-settled tree
 *
 * @param originalHead - journaled ref state before Git
 *
 * @example
 * ```ts
 * await executePreparedCommit({ workspace, gitPath: '/usr/bin/git', spawnCwd: '/work', effectiveCwd: '/repo', commitArgs: ['commit'], intendedTreeOid });
 * ```
 */
export async function executePreparedCommit({
  workspace,
  gitPath,
  spawnCwd,
  effectiveCwd,
  commitArgs,
  intendedTreeOid,
  originalHead,
}: Readonly<{
  workspace: CommitTransactionWorkspace;
  gitPath: string;
  spawnCwd: string;
  effectiveCwd: string;
  commitArgs: readonly string[];
  intendedTreeOid: string;
  originalHead: OriginalHead;
}>,): Promise<void> {
  try {
    await runTransactionGit({
      gitPath,
      cwd: spawnCwd,
      indexPath: workspace.commitIndexPath,
      args: commitArgs,
      environment: { GIT_REFLOG_ACTION: workspace.reflogAction, },
      stdio: 'inherit',
    },);
  }
  catch (error: unknown) {
    workspace.preserveForRecovery();
    /**
     * Ref state after failed or interrupted Git process.
     */
    const currentHead = await resolveCurrentHead({
      gitPath,
      cwd: effectiveCwd,
    },);
    if (headsEqual({
      expected: originalHead,
      current: currentHead,
    })) {
      workspace.finishTransaction();
      throw error;
    }
    throw new CommitTransactionRecoveryError(`Real Git ended after advancing HEAD; recovery retained at ${workspace.directory}`,);
  }
  workspace.preserveForRecovery();
  /**
   * Exact landed commit after successful private-index Git.
   */
  const landedOid = await resolveLandedCommitOid({
    gitPath,
    cwd: effectiveCwd,
  },);
  /**
   * Exact landed tree proving hooks did not change predicted content.
   */
  const landedTreeOid = DECODER.decode((await runTransactionGit({
    gitPath,
    cwd: effectiveCwd,
    args: [
      'rev-parse',
      '--verify',
      `${landedOid}^{tree}`,
    ],
  },)).stdout,)
    .trim();
  if (landedTreeOid !== intendedTreeOid)
    throw new TypeError(`Landed tree ${landedTreeOid} differs from prepared tree ${intendedTreeOid}; recovery retained at ${workspace.directory}`,);
  await recordRefUpdated({
    workspace,
    landedOid,
  },);
  await workspace.installIndex(workspace.postIndexPath,);
  await recordIndexInstalled({ workspace, },);
  workspace.finishTransaction();
}
