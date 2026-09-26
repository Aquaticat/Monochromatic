/**
 Recovery of interrupted ignored-state copies for forwarded commands that hold no settlement lock.

 A command that neither creates nor moves worktrees checks for pending journals without the settlement lock
 and takes it only to recover when a journal exists.
 While another live process owns the lock,
 that owner is either still writing its own journal or already recovering,
 so the command skips recovery instead of waiting;
 concurrent Git commands in linked worktrees therefore never contend on it.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { readPendingWorktreeCopyJournals, } from './journal.ts';
import {
  tryAcquireWorktreeCopyLock,
  WORKTREE_COPY_LOCK_HELD,
} from './journal-lock.ts';
import {
  recoverWorktreeCopyTransactions,
  type RecoveryReport,
} from './transaction-recovery.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Writes one line per transaction recovery ended without completing, then the recovery summary line.

 @param report - recovery pass result

 @example
 ```ts
 reportRecoveredWorktreeCopies({ recovered: 1, notices: [] });
 ```
 */
export function reportRecoveredWorktreeCopies(report: RecoveryReport,): void {
  report.notices
    .forEach(function writeNotice(notice,): void {
    process.stderr
      .write(`${notice}\n`,);
  },);
  if (report.recovered > 0) {
    process.stderr
      .write(
      `cli-git: recovered ignored-state copies for ${String(report.recovered,)} worktree transaction${report.recovered === 1 ? '' : 's'}.\n`,
    );
  }
}

/**
 Recovers pending worktree-copy journals, taking the settlement lock only when one exists
 and no live process owns it.

 @param commonDir - canonical common Git directory

 @throws {@link WorktreeCopyError} when a journal is malformed or unsafe

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
   Settlement lock held only for recovery, or the held sentinel.
   */
  const lease = await tryAcquireWorktreeCopyLock(commonDir,);
  if (lease === WORKTREE_COPY_LOCK_HELD) {
    rl.debug('a live process owns worktree-copy settlement; forwarding without recovery',);
    return;
  }
  /**
   Lock released when recovery settles.
   */
  await using _settlementLock = lease;
  reportRecoveredWorktreeCopies(await recoverWorktreeCopyTransactions(commonDir,),);
}
