/**
 Recovery of interrupted ignored-state copies for forwarded commands that hold no settlement lock.

 A command that neither creates nor moves worktrees checks for pending journals without the settlement lock
 and takes it only to recover when a journal exists,
 so concurrent Git commands in linked worktrees never contend on it.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { readPendingWorktreeCopyJournals, } from './journal.ts';
import { acquireWorktreeCopyLock, } from './journal-lock.ts';
import { recoverWorktreeCopyTransactions, } from './transaction.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Writes the recovery summary line when any copy was recovered.

 @param recovered - recovered destination count

 @example
 ```ts
 reportRecoveredWorktreeCopies(1);
 ```
 */
export function reportRecoveredWorktreeCopies(recovered: number,): void {
  if (recovered > 0) {
    process.stderr
      .write(
      `cli-git: recovered ignored-state copies for ${String(recovered,)} worktree transaction${recovered === 1 ? '' : 's'}.\n`,
    );
  }
}

/**
 Recovers pending worktree-copy journals, taking the settlement lock only when one exists.

 @param commonDir - canonical common Git directory

 @throws {@link WorktreeCopyError} when a journal is malformed or conflicting

 @example
 ```ts
 await recoverPendingWorktreeCopies('/repo/.git');
 ```
 */
export async function recoverPendingWorktreeCopies(commonDir: string,): Promise<void> {
  /**
   Tagged recovery logger.
   */
  const rl = tagged({
    tag: recoverPendingWorktreeCopies.name,
    l,
  },);
  if ((await readPendingWorktreeCopyJournals(commonDir,)).length === 0) {
    rl.debug('no pending worktree-copy journal; forwarding without the settlement lock',);
    return;
  }
  /**
   Settlement lock held only for recovery.
   */
  await using _settlementLock = await acquireWorktreeCopyLock(commonDir,);
  reportRecoveredWorktreeCopies(await recoverWorktreeCopyTransactions(commonDir,),);
}
