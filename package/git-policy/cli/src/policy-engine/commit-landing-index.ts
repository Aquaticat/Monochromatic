/**
 Real index computed at landing against the then-current real index,
 never against the invocation-time copy,
 so a landing never erases another invocation's staging
 and never stages a revert of landed content.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { snapshotFilesEqual, } from './commit-transaction-candidate-snapshot.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import type { TransactionMode, } from './commit-transaction-journal-states.ts';
import { copyIndexFile, } from './index-file-timestamps.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Strict Git output decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 UTF-8 encoder for index-info input.
 */
const ENCODER = new TextEncoder();

/**
 Keeps pathspec magic active, so `:(top,literal)` names concrete paths even when the caller disabled magic.
 */
const MAGIC_PATHSPECS = { GIT_LITERAL_PATHSPECS: '0', } as const;

/**
 Splits NUL-terminated records.

 @param bytes - Git output

 @returns nonempty records
 */
function records(bytes: Uint8Array,): readonly string[] {
  return DECODER.decode(bytes,)
    .split('\0',)
    .filter(function nonempty(record,): boolean {
      return record.length > 0;
    },);
}

/**
 Groups `ls-files --stage` records by path.

 @param stageRecords - `mode oid stage<TAB>path` records

 @returns records per path, in stage order
 */
function stagesByPath(stageRecords: readonly string[],): ReadonlyMap<string, readonly string[]> {
  /**
   Records per path.
   */
  const grouped = new Map<string, string[]>();
  for (const record of stageRecords) {
    /**
     Metadata and path separator.
     */
    const tab = record.indexOf('\t',);
    /**
     Record path.
     */
    const path = record.slice(tab + 1,);
    grouped.set(
      path,
      [
        ...(grouped.get(path,) ?? []),
        record,
      ],
    );
  }
  return grouped;
}

/**
 Lists stage records of one index for concrete paths.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param indexPath - index to read

 @param paths - concrete paths

 @returns stage records grouped by path
 */
async function listStages({
  gitPath,
  cwd,
  indexPath,
  paths,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
  paths: readonly string[];
}>,): Promise<ReadonlyMap<string, readonly string[]>> {
  if (paths.length === 0)
    return new Map();
  return stagesByPath(records((await runTransactionGit({
    gitPath,
    cwd,
    indexPath,
    args: [
      'ls-files',
      '--stage',
      '-z',
      '--full-name',
      '--',
      ...paths.map(function fromRoot(path,): string {
        return `:(top,literal)${path}`;
      },),
    ],
    environment: MAGIC_PATHSPECS,
  },)).stdout,),);
}

/**
 Lists paths two tree-ishes differ in.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param from - first tree-ish

 @param to - second tree-ish

 @returns changed paths without rename pairing
 */
async function changedPaths({
  gitPath,
  cwd,
  from,
  to,
}: Readonly<{
  gitPath: string;
  cwd: string;
  from: string;
  to: string;
}>,): Promise<readonly string[]> {
  return records((await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'diff-tree',
      '-r',
      '--no-renames',
      '--name-only',
      '-z',
      from,
      to,
    ],
  },)).stdout,);
}

/**
 Lists paths the landed tree changes relative to what was staged at invocation;
 nothing when the invocation-time index cannot form a tree.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param capturedIndexPath - invocation-time index copy

 @param landedTreeOid - landed tree

 @returns changed paths
 */
async function changedSinceCaptured({
  gitPath,
  cwd,
  capturedIndexPath,
  landedTreeOid,
}: Readonly<{
  gitPath: string;
  cwd: string;
  capturedIndexPath: string;
  landedTreeOid: string;
}>,): Promise<readonly string[]> {
  /**
   Tree write that fails on unmerged entries.
   */
  const result = await runTransactionGit({
    gitPath,
    cwd,
    indexPath: capturedIndexPath,
    args: ['write-tree',],
    allowFailure: true,
  },);
  if (result.exitCode !== 0)
    return [];
  return changedPaths({
    gitPath,
    cwd,
    from: DECODER.decode(result.stdout,)
      .trim(),
    to: landedTreeOid,
  },);
}

/**
 Index-mode post-index: landed entries only for paths whose current entry still equals the captured one.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param capturedIndexPath - invocation-time index copy

 @param landedIndexPath - private index the commit was made from

 @param postIndexPath - post-index being written, already a copy of the current real index

 @param changed - paths the commit changed

 @param zeroOid - all-zero object ID of the repository's hash
 */
async function mergeLandedEntries({
  gitPath,
  cwd,
  capturedIndexPath,
  landedIndexPath,
  postIndexPath,
  changed,
  zeroOid,
}: Readonly<{
  gitPath: string;
  cwd: string;
  capturedIndexPath: string;
  landedIndexPath: string;
  postIndexPath: string;
  changed: readonly string[];
  zeroOid: string;
}>,): Promise<void> {
  /**
   Captured, current, and landed entries for every changed path.
   */
  const [captured, current, landed,] = await Promise.all([
    listStages({
      gitPath,
      cwd,
      indexPath: capturedIndexPath,
      paths: changed,
    },),
    listStages({
      gitPath,
      cwd,
      indexPath: postIndexPath,
      paths: changed,
    },),
    listStages({
      gitPath,
      cwd,
      indexPath: landedIndexPath,
      paths: changed,
    },),
  ],);
  /**
   Paths nobody restaged since invocation.
   */
  const untouched = changed.filter(function stillCaptured(path,): boolean {
    return JSON.stringify(captured.get(path,) ?? [],) === JSON.stringify(current.get(path,) ?? [],);
  },);
  if (untouched.length === 0)
    return;
  /**
   `--index-info` lines: landed entries, or removal of paths the commit deleted.
   */
  const lines = untouched.flatMap(function landedLines(path,): readonly string[] {
    return landed.get(path,) ?? [`0 ${zeroOid}\t${path}`,];
  },);
  await runTransactionGit({
    gitPath,
    cwd,
    indexPath: postIndexPath,
    args: [
      'update-index',
      '-z',
      '--index-info',
    ],
    input: ENCODER.encode(lines
      .map(function terminated(line,): string {
        return `${line}\0`;
      },)
      .join('',),),
  },);
}

/**
 Computes the post-index a landing installs.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param mode - commit selection mode

 @param preLandingIndexPath - exact copy of the current real index

 @param capturedIndexPath - invocation-time index copy

 @param landedIndexPath - private index the commit was made from

 @param postIndexPath - post-index to write

 @param landedTreeOid - tree the landing installs

 @param baseRevision - preparation base commit, or the empty tree when unborn

 @param committedPaths - paths an explicit-path commit carries, including policy-added paths

 @example
 ```ts
 await computeLandingPostIndex({ gitPath: '/usr/bin/git', cwd: '/repo', mode: 'index', preLandingIndexPath, capturedIndexPath, landedIndexPath, postIndexPath, landedTreeOid, baseRevision, committedPaths: [] });
 ```
 */
export async function computeLandingPostIndex({
  gitPath,
  cwd,
  mode,
  preLandingIndexPath,
  capturedIndexPath,
  landedIndexPath,
  postIndexPath,
  landedTreeOid,
  baseRevision,
  committedPaths,
}: Readonly<{
  gitPath: string;
  cwd: string;
  mode: TransactionMode;
  preLandingIndexPath: string;
  capturedIndexPath: string;
  landedIndexPath: string;
  postIndexPath: string;
  landedTreeOid: string;
  baseRevision: string;
  committedPaths: readonly string[];
}>,): Promise<void> {
  /**
   Tagged post-index logger.
   */
  const rl = tagged({
    tag: computeLandingPostIndex.name,
    l,
  },);
  if (mode === 'explicit-path') {
    await copyIndexFile({
      sourcePath: preLandingIndexPath,
      destinationPath: postIndexPath,
    },);
    if (committedPaths.length > 0)
      await runTransactionGit({
        gitPath,
        cwd,
        indexPath: postIndexPath,
        args: [
          'reset',
          '--quiet',
          landedTreeOid,
          '--',
          ...committedPaths.map(function fromRoot(path,): string {
            return `:(top,literal)${path}`;
          },),
        ],
        environment: MAGIC_PATHSPECS,
      },);
    return;
  }
  if (await snapshotFilesEqual({
    leftPath: preLandingIndexPath,
    rightPath: capturedIndexPath,
  },)) {
    // Nothing restaged since invocation: the private index is exactly what native Git would leave.
    await copyIndexFile({
      sourcePath: landedIndexPath,
      destinationPath: postIndexPath,
    },);
    return;
  }
  rl.debug('real index changed since invocation; merging landed entries per path',);
  await copyIndexFile({
    sourcePath: preLandingIndexPath,
    destinationPath: postIndexPath,
  },);
  /**
   Paths the commit changed relative to its base or to what was staged at invocation.
   */
  const changed = [
    ...new Set([
      ...(await changedPaths({
        gitPath,
        cwd,
        from: baseRevision,
        to: landedTreeOid,
      },)),
      ...(await changedSinceCaptured({
        gitPath,
        cwd,
        capturedIndexPath,
        landedTreeOid,
      },)),
    ],),
  ];
  await mergeLandedEntries({
    gitPath,
    cwd,
    capturedIndexPath,
    landedIndexPath,
    postIndexPath,
    changed,
    zeroOid: '0'.repeat(landedTreeOid.length,),
  },);
}
