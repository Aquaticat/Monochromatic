/**
 Worktree-completion and added-path records carried through a replay.

 @module
 */
import type { RevalidationContext, } from './commit-revalidation.ts';
import type { AddedPathRecord, } from './commit-transaction-added-paths.ts';
import { loadIndexEntries, } from './commit-transaction-candidate-batch.ts';

/**
 Points worktree completions at the blobs a replayed tree holds, dropping paths it no longer holds as ordinary files.

 @param context - invocation facts

 @param indexPath - replayed private index

 @param records - completions before the replay

 @returns completions for the replayed tree

 @example
 ```ts
 await retargetRecords({ context, indexPath, records });
 ```
 */
export async function retargetRecords({
  context,
  indexPath,
  records,
}: Readonly<{
  context: RevalidationContext;
  indexPath: string;
  records: readonly AddedPathRecord[];
}>,): Promise<readonly AddedPathRecord[]> {
  /**
   Replayed entries of every completion path.
   */
  const entries = await loadIndexEntries({
    gitPath: context.gitPath,
    cwd: context.cwd,
    indexPath,
    paths: records.map(function recordPath(record,): string {
      return record.path;
    },),
  },);
  return records.flatMap(function retarget(record,): readonly AddedPathRecord[] {
    /**
     Replayed entry.
     */
    const entry = entries.get(record.path,);
    return (entry === undefined) || (entry.modeText !== record.gitMode)
      || (entry.stage !== '0')
      ? []
      : [{
        ...record,
        intendedOid: entry.oid,
      },];
  },);
}

/**
 Merges added-path records, a later record replacing an earlier one for the same path.

 @param earlier - earlier records

 @param later - later records

 @returns merged records

 @example
 ```ts
 mergeRecords({ earlier: [], later: [] }); // []
 ```
 */
export function mergeRecords({
  earlier,
  later,
}: Readonly<{
  earlier: readonly AddedPathRecord[];
  later: readonly AddedPathRecord[];
}>,): readonly AddedPathRecord[] {
  return [
    ...earlier.filter(function notReplaced(record,): boolean {
      return !later.some(function samePath(replacement,): boolean {
        return replacement.path === record.path;
      },);
    },),
    ...later,
  ];
}
