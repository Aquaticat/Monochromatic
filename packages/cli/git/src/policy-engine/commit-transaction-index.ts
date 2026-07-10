/**
 * Private commit-index initialization and installation.
 *
 * @module
 */
import {
  copyFile,
  readFile,
} from 'node:fs/promises';
import { runTransactionGit, } from './commit-transaction-git.ts';
import type { CommitTransactionWorkspace, } from './commit-transaction-workspace.ts';

/**
 * Copies or builds private commit index.
 *
 * @param workspace - owned transaction workspace
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param mode - commit selection semantics
 *
 * @param pathspecs - engine-selected explicit paths
 *
 * @returns original index bytes
 *
 * @example
 * ```ts
 * await initializeCommitIndex({ workspace, gitPath: '/usr/bin/git', cwd: '/repo', mode: 'index', pathspecs: [] });
 * ```
 */
export async function initializeCommitIndex({
  workspace,
  gitPath,
  cwd,
  mode,
  pathspecs,
}: Readonly<{
  workspace: CommitTransactionWorkspace;
  gitPath: string;
  cwd: string;
  mode: 'explicit-path' | 'index';
  pathspecs: readonly string[];
}>,): Promise<Uint8Array> {
  /**
   * Exact pre-transaction real index bytes.
   */
  const original = new Uint8Array(await readFile(workspace.realIndexPath,),);
  if (mode === 'index') {
    await copyFile(
      workspace.realIndexPath,
      workspace.commitIndexPath,
    );
    return original;
  }
  /**
   * Optional parent tree for unborn-repository compatibility.
   */
  const head = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--verify',
      'HEAD^{tree}',
    ],
    allowFailure: true,
  },);
  await runTransactionGit({
    gitPath,
    cwd,
    indexPath: workspace.commitIndexPath,
    args: head.exitCode === 0
      ? [
        'read-tree',
        new TextDecoder(
          'utf-8',
          { fatal: true, },
        ).decode(head.stdout,)
          .trim(),
      ]
      : [
        'read-tree',
        '--empty',
      ],
  },);
  await runTransactionGit({
    gitPath,
    cwd,
    indexPath: workspace.commitIndexPath,
    args: [
      'add',
      '--',
      ...pathspecs,
    ],
  },);
  return original;
}

/**
 * Reconciles explicit selected entries from landed commit and installs index.
 *
 * @param workspace - transaction workspace
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - repository directory
 *
 * @param pathspecs - selected paths
 *
 * @param landedOid - exact landed commit
 *
 * @example
 * ```ts
 * await installExplicitPostIndex({ workspace, gitPath: '/usr/bin/git', cwd: '/repo', pathspecs: ['a'], landedOid });
 * ```
 */
export async function installExplicitPostIndex({
  workspace,
  gitPath,
  cwd,
  pathspecs,
  landedOid,
}: Readonly<{
  workspace: CommitTransactionWorkspace;
  gitPath: string;
  cwd: string;
  pathspecs: readonly string[];
  landedOid: string;
}>,): Promise<void> {
  await copyFile(
    workspace.realIndexPath,
    workspace.postIndexPath,
  );
  await runTransactionGit({
    gitPath,
    cwd,
    indexPath: workspace.postIndexPath,
    args: [
      'reset',
      '--quiet',
      landedOid,
      '--',
      ...pathspecs,
    ],
  },);
  await workspace.installIndex(workspace.postIndexPath,);
}
