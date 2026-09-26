/**
 Private commit-index initialization and intended tree.
 
 @module
 */
import type { GitObjectId, } from '../api/policy-types.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import { copyIndexFile, } from './index-file-timestamps.ts';
import type { CommitTransactionWorkspace, } from './commit-transaction-workspace.ts';

/**
 Strict Git object decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Builds Git-native path selection arguments.
 
 @param pathspecs - direct pathspec tokens
 
 @param pathspecFile - optional file source
 
 @param pathspecFileNul - whether source uses NUL delimiters
 
 @returns exact git add selection arguments
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
 Copies or builds private commit index and snapshots original index.
 
 @param workspace - owned transaction workspace
 
 @param gitPath - resolved Git executable
 
 @param cwd - effective repository directory
 
 @param mode - commit selection semantics
 
 @param pathspecs - engine-selected explicit paths
 
 @param pathspecFile - optional pathspec source file
 
 @param pathspecFileNul - whether source uses NUL delimiters
 
 @param stageIntoIndex - whether copied index receives selected worktree state
 
 @param stageTrackedChanges - whether copied index receives every tracked modification and deletion, as `commit -a` does
 
 @param baseRevision - recorded base commit, or the empty tree for an unborn base
 
 @example
 ```ts
 await initializeCommitIndex({ workspace, gitPath: '/usr/bin/git', cwd: '/repo', mode: 'index', pathspecs: [], pathspecFileNul: false, baseRevision });
 ```
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
  stageTrackedChanges = false,
  baseRevision,
}: Readonly<{
  workspace: Pick<CommitTransactionWorkspace, 'realIndexPath' | 'capturedIndexPath' | 'commitIndexPath'>;
  gitPath: string;
  cwd: string;
  mode: 'explicit-path' | 'index';
  pathspecs: readonly string[];
  pathspecFile?: string;
  pathspecFileNul: boolean;
  stageIntoIndex?: boolean;
  stageTrackedChanges?: boolean;
  baseRevision: string;
}>,): Promise<void> {
  await copyIndexFile({
    sourcePath: workspace.realIndexPath,
    destinationPath: workspace.capturedIndexPath,
  },);
  if (mode === 'index') {
    await copyIndexFile({
      sourcePath: workspace.capturedIndexPath,
      destinationPath: workspace.commitIndexPath,
    },);
    if (stageTrackedChanges)
      // Whole-tree update of tracked paths, exactly what `commit -a` stages, captured once at invocation.
      await runTransactionGit({
        gitPath,
        cwd,
        indexPath: workspace.commitIndexPath,
        args: [
          'add',
          '--update',
          '--',
          ':/',
        ],
      },);
    if (!stageIntoIndex)
      return;
  }
  else
    // The recorded base, never live `HEAD`: another landing may have moved it since invocation.
    await runTransactionGit({
      gitPath,
      cwd,
      indexPath: workspace.commitIndexPath,
      args: [
        'read-tree',
        baseRevision,
      ],
    },);
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
 Writes exact intended tree from private commit index.
 
 @param workspace - transaction workspace
 
 @param gitPath - resolved Git executable
 
 @param cwd - repository directory
 
 @returns intended Git tree OID
 
 @example
 ```ts
 await writePrivateTree({ workspace, gitPath: '/usr/bin/git', cwd: '/repo' });
 ```
 */
export async function writePrivateTree({
  workspace,
  gitPath,
  cwd,
}: Readonly<{
  workspace: Pick<CommitTransactionWorkspace, 'commitIndexPath'>;
  gitPath: string;
  cwd: string;
}>,): Promise<GitObjectId> {
  /**
   Git tree object written from private index.
   */
  const output = await runTransactionGit({
    gitPath,
    cwd,
    indexPath: workspace.commitIndexPath,
    args: ['write-tree',],
  },);
  /**
   Exact intended tree OID.
   */
  const oid = DECODER.decode(output.stdout,)
    .trim();
  if (oid.length === 0)
    throw new TypeError('Git returned empty private tree identity.',);
  return oid;
}
