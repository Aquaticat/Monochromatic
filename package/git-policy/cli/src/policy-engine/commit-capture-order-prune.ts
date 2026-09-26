/**
 Pruning of landed-capture records no published transaction can replay over any more
 (see `commit-capture-order-records.ts` for the rule).

 Pruning runs after every transaction removes its directory and after startup recovery,
 so the last transaction to finish leaves no record behind.
 It reads only files:
 the registry listing,
 each published transaction's `captured.json`,
 and each record.
 A failure is reported and never fails the commit that ran it.

 @module
 */
import { rm, } from 'node:fs/promises';
import { join, } from 'node:path';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  CAPTURED_ABSENT,
  readCapturedRecord,
} from './commit-capture-order-journal.ts';
import {
  LANDED_RECORD_SUFFIX,
  landedRecordDirectory,
  listLandedRecordNames,
  parseLandedCaptureRecord,
  readWorktreeId,
  type WORKTREE_ID_ABSENT,
} from './commit-capture-order-records.ts';
import { readStoreFile, } from './commit-capture-order-store.ts';
import { listTransactionEntries, } from './commit-transaction-registry.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Every published transaction may still need every record.
 */
const KEEP_ALL: unique symbol = Symbol('keep every landed record',);

/**
 Smallest next sequence number any published transaction of this store generation read before its base.

 @param registryRoot - transaction registry of the worktree

 @param worktreeId - current store identity

 @returns bound below which a record's next sequence after landing makes it prunable,
 infinity with no such transaction,
 or {@link KEEP_ALL} while a published transaction has not captured yet
 */
async function pinningBound({
  registryRoot,
  worktreeId,
}: Readonly<{
  registryRoot: string;
  worktreeId: string | typeof WORKTREE_ID_ABSENT;
}>,): Promise<number | typeof KEEP_ALL> {
  /**
   Published transactions; staging directories have read no base yet.
   */
  const published = (await listTransactionEntries(registryRoot,)).filter(function isPublished(entry,): boolean {
    return entry.kind === 'transaction';
  },);
  /**
   Each transaction's capture, or absence.
   */
  const captures = await Promise.all(published.map(async function captureOf(entry,) {
    return await readCapturedRecord(entry.path,);
  },),);
  if (captures.includes(CAPTURED_ABSENT,))
    return KEEP_ALL;
  return Math.min(
    Infinity,
    ...captures.flatMap(function bound(captured,): readonly number[] {
      return (captured === CAPTURED_ABSENT) || (captured.worktreeId !== worktreeId) ? [] : [captured.nextSequenceBeforeBase,];
    },),
  );
}

/**
 Decides whether one record file can go.

 @param directory - landed-record directory

 @param name - record filename

 @param worktreeId - current store identity

 @param bound - smallest next sequence number a published transaction read before its base

 @returns whether the record is prunable
 */
async function prunable({
  directory,
  name,
  worktreeId,
  bound,
}: Readonly<{
  directory: string;
  name: string;
  worktreeId: string | typeof WORKTREE_ID_ABSENT;
  bound: number;
}>,): Promise<boolean> {
  /**
   Record path.
   */
  const path = join(
    directory,
    name,
  );
  if (!name.endsWith(LANDED_RECORD_SUFFIX,))
    return true;
  try {
    /**
     Parsed record.
     */
    const record = parseLandedCaptureRecord({
      text: await readStoreFile(path,),
      name: path,
    },);
    return (record.worktreeId !== worktreeId) || (record.nextSequenceAfterLanding < bound);
  }
  catch (error: unknown) {
    l.warn(`removing unreadable landed-capture record ${path}: ${caughtValueText(error,)}`,);
    return true;
  }
}

/**
 Removes every landed-capture record no published transaction can replay over.
 Never throws:
 a failure is reported,
 and the records stay for the next pruning.

 @param gitDir - absolute Git directory of the owning worktree

 @param registryRoot - transaction registry of the worktree

 @returns number of records removed

 @example
 ```ts
 await pruneLandedCaptures({ gitDir: '/repo/.git', registryRoot: '/repo/.git/cli-git-transactions' });
 ```
 */
export async function pruneLandedCaptures({
  gitDir,
  registryRoot,
}: Readonly<{
  gitDir: string;
  registryRoot: string;
}>,): Promise<number> {
  /**
   Tagged pruning logger.
   */
  const rl = tagged({
    tag: pruneLandedCaptures.name,
    l,
  },);
  try {
    /**
     Record filenames.
     */
    const names = await listLandedRecordNames(gitDir,);
    if (names.length === 0)
      return 0;
    /**
     Current store identity; a record of any other generation is unusable.
     */
    const worktreeId = await readWorktreeId(gitDir,);
    /**
     Pinning bound of the published transactions.
     */
    const bound = await pinningBound({
      registryRoot,
      worktreeId,
    },);
    if (bound === KEEP_ALL) {
      rl.debug('a published transaction has not captured yet; keeping every landed-capture record',);
      return 0;
    }
    /**
     Record directory.
     */
    const directory = landedRecordDirectory(gitDir,);
    /**
     Names to remove.
     */
    const doomed = (await Promise.all(names.map(async function decide(name,): Promise<readonly string[]> {
      return (await prunable({
        directory,
        name,
        worktreeId,
        bound,
      },)) ? [name,] : [];
    },),)).flat();
    await Promise.all(doomed.map(async function remove(name,): Promise<void> {
      await rm(
        join(
          directory,
          name,
        ),
        { force: true, },
      );
    },),);
    rl.debug(`pruned ${String(doomed.length,)} of ${String(names.length,)} landed-capture records`,);
    return doomed.length;
  }
  catch (error: unknown) {
    rl.warn(`could not prune landed-capture records in ${gitDir}; they stay for the next pruning: ${caughtValueText(error,)}`,);
    return 0;
  }
}
