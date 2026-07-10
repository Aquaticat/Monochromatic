/**
 * Private commit-index initialization and prepared installation state.
 *
 * @module
 */
import { copyFile, } from 'node:fs/promises';
import type { GitObjectId, } from '../api/policy-types.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import type { CommitTransactionWorkspace, } from './commit-transaction-workspace.ts';

/**
 * Strict Git object decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 * Builds Git-native path selection arguments.
 *
 * @param pathspecs - direct pathspec tokens
 *
 * @param pathspecFile - optional file source
 *
 * @param pathspecFileNul - whether source uses NUL delimiters
 *
 * @returns exact git add selection arguments
 */
function selectionArguments({
  pathspecs,
  pathspecFile,
  pathspecFileNul,
}: Readonly<{
  pathspecs: readonly string[];
  pathspecFile?: string;
  pathspecFileNul: boolean;
}>,): readonly string[] {
  return pathspecFile === undefined
    ? [
      '--',
      ...pathspecs,
    ]
    : [
      `--pathspec-from-file=${pathspecFile}`,
      ...(pathspecFileNul ? ['--pathspec-file-nul',] : []),
    ];
}

/**
 * Copies or builds private commit index and snapshots original index.
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
 * @param pathspecFile - optional pathspec source file
 *
 * @param pathspecFileNul - whether source uses NUL delimiters
 *
 * @param stageIntoIndex - whether copied index receives selected worktree state
 *
 * @example
 * ```ts
 * await initializeCommitIndex({ workspace, gitPath: '/usr/bin/git', cwd: '/repo', mode: 'index', pathspecs: [], pathspecFileNul: false });
 * ```
 */
export async function initializeCommitIndex({
  workspace,
  gitPath,
  cwd,
  mode,
  pathspecs,
  pathspecFile,
  pathspecFileNul,
  stageIntoIndex = false,
}: Readonly<{
  workspace: CommitTransactionWorkspace;
  gitPath: string;
  cwd: string;
  mode: 'explicit-path' | 'index';
  pathspecs: readonly string[];
  pathspecFile?: string;
  pathspecFileNul: boolean;
  stageIntoIndex?: boolean;
}>,): Promise<void> {
  await copyFile(
    workspace.realIndexPath,
    workspace.originalIndexPath,
  );
  if (mode === 'index') {
    await copyFile(
      workspace.originalIndexPath,
      workspace.commitIndexPath,
    );
    if (!stageIntoIndex)
      return;
  }
  else {
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
          DECODER.decode(head.stdout,)
            .trim(),
        ]
        : [
          'read-tree',
          '--empty',
        ],
    },);
  }
  await runTransactionGit({
    gitPath,
    cwd,
    indexPath: workspace.commitIndexPath,
    args: [
      'add',
      '--all',
      ...selectionArguments({
        pathspecs,
        ...(pathspecFile === undefined ? {} : { pathspecFile, }),
        pathspecFileNul,
      },),
    ],
  },);
}

/**
 * Writes exact intended tree from private commit index.
 *
 * @param workspace - transaction workspace
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - repository directory
 *
 * @returns intended Git tree OID
 *
 * @example
 * ```ts
 * await writePrivateTree({ workspace, gitPath: '/usr/bin/git', cwd: '/repo' });
 * ```
 */
export async function writePrivateTree({
  workspace,
  gitPath,
  cwd,
}: Readonly<{
  workspace: CommitTransactionWorkspace;
  gitPath: string;
  cwd: string;
}>,): Promise<GitObjectId> {
  /**
   * Git tree object written from private index.
   */
  const output = await runTransactionGit({
    gitPath,
    cwd,
    indexPath: workspace.commitIndexPath,
    args: ['write-tree',],
  },);
  /**
   * Exact intended tree OID.
   */
  const oid = DECODER.decode(output.stdout,)
    .trim();
  if (oid.length === 0)
    throw new TypeError('Git returned empty private tree identity.',);
  return oid;
}

/**
 * Prepares exact post-commit index before real Git may advance ref.
 *
 * @param workspace - transaction workspace
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - repository directory
 *
 * @param mode - transaction commit semantics
 *
 * @param selectedPaths - concrete selected paths
 *
 * @param intendedTreeOid - exact prepared commit tree
 *
 * @example
 * ```ts
 * await preparePostIndex({ workspace, gitPath: '/usr/bin/git', cwd: '/repo', mode: 'index', selectedPaths: [], intendedTreeOid });
 * ```
 */
export async function preparePostIndex({
  workspace,
  gitPath,
  cwd,
  mode,
  selectedPaths,
  intendedTreeOid,
}: Readonly<{
  workspace: CommitTransactionWorkspace;
  gitPath: string;
  cwd: string;
  mode: 'explicit-path' | 'index';
  selectedPaths: readonly string[];
  intendedTreeOid: GitObjectId;
}>,): Promise<void> {
  if (mode === 'index') {
    await copyFile(
      workspace.commitIndexPath,
      workspace.postIndexPath,
    );
    return;
  }
  await copyFile(
    workspace.originalIndexPath,
    workspace.postIndexPath,
  );
  await runTransactionGit({
    gitPath,
    cwd,
    indexPath: workspace.postIndexPath,
    args: [
      'reset',
      '--quiet',
      intendedTreeOid,
      '--',
      ...selectedPaths,
    ],
  },);
}
