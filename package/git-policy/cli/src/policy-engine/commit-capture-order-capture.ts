/**
 A commit transaction's capture under capture order:
 the capture runs under the per-worktree capture lock with the next sequence number,
 then the paths it read from the worktree are listed and `captured.json` is written.

 Worktree-captured paths are those whose committed bytes the capture read from the shared disk:

 - explicit-path commits:
   every path the private index changes relative to the preparation base,
   which only the selected worktree paths do;
 - index commits that stage worktree content at capture
   (`commit -a`, or `--include` with paths):
   every path whose private index entry differs from the captured real index;
 - other index commits:
   none,
   because their bytes were staged at an unknown earlier time,
   so a later capture of the index does not mean later disk bytes.

 A path whose staged entry already equals the disk is left out,
 which only sends it through subsumption instead of capture order.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { writeCapturedRecord, } from './commit-capture-order-journal.ts';
import { captureInOrder, } from './commit-capture-order-store.ts';
import { decodeLatin1, } from './commit-replay-patch.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import {
  JOURNAL_SCHEMA_VERSION,
  type TransactionMode,
} from './commit-transaction-journal-states.ts';
import type { CommitTransactionWorkspace, } from './commit-transaction-workspace.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Splits NUL-terminated output into its nonempty records.

 @param output - Latin-1 decoded output

 @returns records
 */
function nulRecords(output: string,): readonly string[] {
  return output.split('\0',)
    .filter(function nonempty(record,): boolean {
      return record !== '';
    },);
}

/**
 Reads an index's entries as `<mode> <object> <stage>` per path, stages joined.

 @param gitPath - real Git executable

 @param cwd - worktree root, so the listing covers the whole index

 @param indexPath - index file

 @returns entries by Latin-1 decoded path
 */
async function stagedEntries({
  gitPath,
  cwd,
  indexPath,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
}>,): Promise<ReadonlyMap<string, string>> {
  /**
   `<mode> <object> <stage>\t<path>` records.
   */
  const records = nulRecords(decodeLatin1((await runTransactionGit({
    gitPath,
    cwd,
    indexPath,
    args: [
      'ls-files',
      '--stage',
      '-z',
    ],
  },)).stdout,),);
  return records.reduce(
    function collect(
      entries,
      record,
    ) {
      /**
       Tab between the entry and the path.
       */
      const tab = record.indexOf('\t',);
      /**
       Record path.
       */
      const path = record.slice(tab + 1,);
      return entries.set(
        path,
        `${entries.get(path,) ?? ''}${record.slice(
          0,
          tab,
        )};`,
      );
    },
    new Map<string, string>(),
  );
}

/**
 Lists the paths a capture read from the worktree.

 @param gitPath - real Git executable

 @param cwd - worktree root

 @param workspace - transaction workspace holding the captured and private indexes

 @param mode - commit selection mode

 @param stagesWorktree - whether an index commit staged worktree content at capture

 @param baseRevision - preparation base commit, or the empty tree when unborn

 @returns Latin-1 decoded paths in Git order

 @example
 ```ts
 await listWorktreeCapturedPaths({ gitPath: '/usr/bin/git', cwd: '/repo', workspace, mode: 'explicit-path', stagesWorktree: false, baseRevision });
 ```
 */
export async function listWorktreeCapturedPaths({
  gitPath,
  cwd,
  workspace,
  mode,
  stagesWorktree,
  baseRevision,
}: Readonly<{
  gitPath: string;
  cwd: string;
  workspace: Pick<CommitTransactionWorkspace, 'capturedIndexPath' | 'commitIndexPath' | 'objectDirectory'>;
  mode: TransactionMode;
  stagesWorktree: boolean;
  baseRevision: string;
}>,): Promise<readonly string[]> {
  if (mode === 'explicit-path')
    return nulRecords(decodeLatin1((await runTransactionGit({
      gitPath,
      cwd,
      indexPath: workspace.commitIndexPath,
      objectDirectory: workspace.objectDirectory,
      args: [
        'diff-index',
        '--cached',
        '--name-only',
        '-z',
        '--no-renames',
        baseRevision,
      ],
    },)).stdout,),);
  if (!stagesWorktree)
    return [];
  /**
   Entries before and after staging.
   */
  const [before, after,] = await Promise.all([
    workspace.capturedIndexPath,
    workspace.commitIndexPath,
  ].map(async function entriesOf(indexPath,) {
    return await stagedEntries({
      gitPath,
      cwd,
      indexPath,
    },);
  },),);
  /**
   Every path of either index.
   */
  const paths = [
    ...new Set([
      ...(before ?? new Map<string, string>()).keys(),
      ...(after ?? new Map<string, string>()).keys(),
    ],),
  ];
  return paths
    .filter(function changedByStaging(path,): boolean {
      return before?.get(path,) !== after?.get(path,);
    },)
    .toSorted(function gitOrder(
      left,
      right,
    ): number {
      return Buffer.compare(
        Buffer.from(
          left,
          'latin1',
        ),
        Buffer.from(
          right,
          'latin1',
        ),
      );
    },);
}

/**
 Runs the capture under capture order and journals it.

 @param gitPath - real Git executable

 @param cwd - worktree root

 @param gitDir - absolute Git directory of the owning worktree

 @param workspace - transaction workspace

 @param mode - commit selection mode

 @param stagesWorktree - whether an index commit stages worktree content at capture

 @param baseRevision - preparation base commit, or the empty tree when unborn

 @param nextSequenceBeforeBase - next capture sequence number read before the preparation base

 @param capture - builds the private index from the worktree or the real index

 @example
 ```ts
 await captureCommitContent({ gitPath, cwd, gitDir, workspace, mode, stagesWorktree: false, baseRevision, nextSequenceBeforeBase, capture });
 ```
 */
export async function captureCommitContent({
  gitPath,
  cwd,
  gitDir,
  workspace,
  mode,
  stagesWorktree,
  baseRevision,
  nextSequenceBeforeBase,
  capture,
}: Readonly<{
  gitPath: string;
  cwd: string;
  gitDir: string;
  workspace: Pick<CommitTransactionWorkspace, 'directory' | 'capturedIndexPath' | 'commitIndexPath' | 'objectDirectory'>;
  mode: TransactionMode;
  stagesWorktree: boolean;
  baseRevision: string;
  nextSequenceBeforeBase: number;
  capture: () => Promise<void>;
}>,): Promise<void> {
  /**
   Capture stamp.
   */
  const { stamp, } = await captureInOrder({
    gitDir,
    capture,
  },);
  /**
   Paths read from the worktree.
   */
  const worktreePaths = await listWorktreeCapturedPaths({
    gitPath,
    cwd,
    workspace,
    mode,
    stagesWorktree,
    baseRevision,
  },);
  await writeCapturedRecord({
    directory: workspace.directory,
    record: {
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      state: 'captured',
      worktreeId: stamp.worktreeId,
      sequence: stamp.sequence,
      nextSequenceBeforeBase,
      worktreePaths,
    },
  },);
  l.debug(`capture ${String(stamp.sequence,)} read ${String(worktreePaths.length,)} paths from the worktree`,);
}
