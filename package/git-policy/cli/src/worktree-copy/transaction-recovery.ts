/**
 Recovery of worktree-copy transactions whose owner did not finish them.

 Every pending journal reaches an end:
 resumed and completed,
 ended after a failed resumption,
 or discarded when its destination is no longer a registered worktree or its private stage is gone.
 Only unsafe or corrupt journal state stays pending,
 so it can be inspected.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  destinationRegistration,
  validateJournalStage,
} from './journal-filesystem.ts';
import {
  type PendingWorktreeCopyJournal,
  readPendingWorktreeCopyJournals,
  removeWorktreeCopyJournal,
} from './journal.ts';
import {
  completeJournal,
  snapshotFromJournal,
} from './transaction-install.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 What one recovery pass did.

 @example
 ```ts
 const report: RecoveryReport = { recovered: 1, notices: [] };
 ```
 */
export type RecoveryReport = Readonly<{
  /**
   Transactions completed, including cleanups of completed ones.
   */
  recovered: number;
  /**
   One stderr line for every transaction ended without completing.
   */
  notices: readonly string[];
}>;

/**
 End of one pending transaction.
 */
type RecoveryStep = Readonly<{
  /**
   Whether the transaction completed.
   */
  recovered: boolean;
  /**
   Line explaining a transaction that ended without completing.
   */
  notice?: string;
}>;

/**
 Brings one pending transaction to an end.

 @param commonDir - canonical common Git directory

 @param journal - pending durable transaction

 @returns whether it completed, or why it ended otherwise

 @throws {@link WorktreeCopyError} when journal or stage state is unsafe

 @example
 ```ts
 await recoverTransaction({ commonDir: '/repo/.git', journal });
 ```
 */
async function recoverTransaction({
  commonDir,
  journal,
}: Readonly<{
  commonDir: string;
  journal: PendingWorktreeCopyJournal;
}>,): Promise<RecoveryStep> {
  /**
   Tagged recovery logger.
   */
  const rl = tagged({ tag: recoverTransaction.name, l, },);
  /**
   Quoted destination for diagnostics.
   */
  const destination = JSON.stringify(journal.record.destinationRoot,);
  /**
   Whether the destination is still a linked worktree of this repository.
   */
  const registration = await destinationRegistration({
    commonDir,
    destinationRoot: journal.record.destinationRoot,
  },);
  /**
   Whether the validated private stage still exists.
   */
  const stage = await validateJournalStage(journal.record,);
  if (registration === 'unregistered') {
    rl.debug(`destination ${destination} is no longer registered; discarding its private stage`,);
    await removeWorktreeCopyJournal(journal,);
    return {
      recovered: false,
      notice: `cli-git: discarded an interrupted ignored-state copy for ${destination}, which is no longer a registered worktree.`,
    };
  }
  if (journal.record.phase === 'complete') {
    await removeWorktreeCopyJournal(journal,);
    return { recovered: true, };
  }
  if (stage === 'stage-missing') {
    rl.debug(`private stage of ${destination} is missing; discarding its journal`,);
    await removeWorktreeCopyJournal(journal,);
    return {
      recovered: false,
      notice: `cli-git: discarded an interrupted ignored-state copy into ${destination} because its private stage is missing; ignored files there may be incomplete.`,
    };
  }
  /**
   Resumed installation outcome.
   */
  const outcome = await completeJournal({
    pending: journal,
    snapshot: async function recordedSnapshot(intendedEntries,) {
      return snapshotFromJournal({
        journal,
        intendedEntries,
      },);
    },
  },);
  if (outcome.kind === 'ended') {
    return {
      recovered: false,
      notice: `cli-git: ended an interrupted ignored-state copy into ${destination} without finishing it. ${outcome.failure.message}`,
    };
  }
  return { recovered: true, };
}

/**
 Recovers every durable interrupted worktree-copy transaction.

 @param commonDir - canonical common Git directory

 @returns completed count and one notice per transaction ended otherwise

 @throws {@link WorktreeCopyError} while retaining unsafe or corrupt evidence

 @example
 ```ts
 await recoverWorktreeCopyTransactions('/repo/.git');
 ```
 */
export async function recoverWorktreeCopyTransactions(
  commonDir: string,
): Promise<RecoveryReport> {
  /**
   Pending journals read while caller holds repository settlement lease.
   */
  const pending = await readPendingWorktreeCopyJournals(commonDir,);
  /**
   Ends of every pending transaction, in journal order.
   */
  const steps: RecoveryStep[] = [];
  for (const journal of pending) {
    // oxlint-disable-next-line no-await-in-loop -- one journal must settle before a later one uses the same destinations
    steps.push(await recoverTransaction({
      commonDir,
      journal,
    },),);
  }
  return {
    recovered: steps.filter(function completed(step,): boolean {
      return step.recovered;
    },).length,
    notices: steps.flatMap(function noticeOf(step,): readonly string[] {
      return step.notice === undefined ? [] : [step.notice,];
    },),
  };
}
