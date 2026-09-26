/**
 Startup recovery across every per-transaction directory of one worktree.

 Live owners are skipped;
 dead owners are recovered oldest first,
 because a later transaction was prepared against the state an earlier one left.

 @module
 */
import { rm, } from 'node:fs/promises';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { isMissingPath, } from '../trust/registry-io.ts';
import type { PreparedTransactionJournal, } from './commit-transaction-journal.ts';
import {
  classifyTransactionOwner,
  parseTransactionOwner,
  type TransactionOwnerLiveness,
  type TransactionOwnerRecord,
} from './commit-transaction-owner.ts';
import {
  listTransactionEntries,
  OWNER_FILENAME,
  removeTransactionDirectory,
  type TransactionRegistryEntry,
} from './commit-transaction-registry.ts';
import {
  readRegularRecoveryFile,
  recoveryPathExists,
  releaseOwnedLock,
} from './commit-transaction-recovery-files.ts';
import {
  JOURNAL_FILENAME,
  loadTransactionJournal,
  recoverJournaledTransaction,
} from './commit-transaction-recovery-journaled.ts';
import type {
  CommitTransactionRecoveryAction,
  CommitTransactionRecoveryOutcome,
} from './commit-transaction-recovery-types.ts';
import { CommitTransactionRecoveryError, } from './commit-transaction-recovery-validation.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Reflog action prefix the workspace writes; its suffix is the transaction ID.
 */
const REFLOG_ACTION_PREFIX = 'cli-git:transaction:';

/**
 Owner evidence for one unpublished or published entry.
 */
type InspectedEntry = Readonly<{
  /**
   Classified registry entry.
   */
  entry: TransactionRegistryEntry;
  /**
   Owner record and its liveness, or why none can be attributed.
   */
  owner:
    | Readonly<{
      record: TransactionOwnerRecord;
      liveness: TransactionOwnerLiveness;
    }>
    | 'vanished'
    | 'unattributed';
}>;

/**
 Owner record file or its directory no longer exists.
 */
const OWNER_RECORD_ABSENT: unique symbol = Symbol('transaction owner record absent',);

/**
 Staging owner record bytes are not one complete record.
 */
const OWNER_RECORD_TORN: unique symbol = Symbol('transaction owner record torn',);

/**
 Reads an owner record, reporting absence instead of failing.

 @param ownerPath - exact owner record path

 @returns exact bytes, or absence when the file or its directory is gone
 */
async function readOwnerBytes(ownerPath: string,): Promise<Uint8Array | typeof OWNER_RECORD_ABSENT> {
  try {
    return await readRegularRecoveryFile(ownerPath,);
  }
  catch (error: unknown) {
    if (!isMissingPath(error,))
      throw error;
    l.debug(`owner record absent at ${ownerPath}`,);
    return OWNER_RECORD_ABSENT;
  }
}

/**
 Parses a staging candidate's owner record, which a crash may have left torn.

 @param bytes - staging owner record bytes

 @returns owner record, or torn marker when the bytes are not a complete record
 */
function parseStagingOwner(bytes: Uint8Array,): TransactionOwnerRecord | typeof OWNER_RECORD_TORN {
  try {
    return parseTransactionOwner(bytes,);
  }
  catch (error: unknown) {
    /**
     Whether the failure is a parse failure of incomplete bytes rather than an I/O or programming fault.
     */
    const incomplete = (error instanceof CommitTransactionRecoveryError)
      || (error instanceof SyntaxError)
      || (error instanceof TypeError);
    if (!incomplete)
      throw error;
    l.debug(`staging owner record incomplete: ${error.message}`,);
    return OWNER_RECORD_TORN;
  }
}

/**
 Reads and classifies an entry's owner, tolerating a live owner removing its own directory concurrently.

 @param entry - published or staging entry

 @returns inspected entry

 @throws {@link CommitTransactionRecoveryError} when a published directory lacks a valid matching owner record
 */
async function inspectEntry(entry: TransactionRegistryEntry,): Promise<InspectedEntry> {
  /**
   Owner record path inside the entry.
   */
  const ownerPath = join(
    entry.path,
    OWNER_FILENAME,
  );
  /**
   Owner record bytes, absent when the entry vanished or staging stopped before writing them.
   */
  const bytes = await readOwnerBytes(ownerPath,);
  if (bytes === OWNER_RECORD_ABSENT) {
    if (entry.kind === 'staging')
      return {
        entry,
        owner: 'unattributed',
      };
    if (!(await recoveryPathExists(entry.path,)))
      return {
        entry,
        owner: 'vanished',
      };
    throw new CommitTransactionRecoveryError(`Transaction owner record is missing: ${entry.path}`,);
  }
  /**
   Parsed owner record; an unpublished candidate may hold a torn write.
   */
  const record = entry.kind === 'staging'
    ? parseStagingOwner(bytes,)
    : parseTransactionOwner(bytes,);
  if (record === OWNER_RECORD_TORN)
    return {
      entry,
      owner: 'unattributed',
    };
  if (record.transactionId !== entry.transactionId)
    throw new CommitTransactionRecoveryError(`Transaction owner record names another transaction: ${entry.path}`,);
  return {
    entry,
    owner: {
      record,
      liveness: await classifyTransactionOwner({
        ownerPid: record.ownerPid,
        ownerIdentity: record.ownerIdentity,
      },),
    },
  };
}

/**
 Proves the prepared journal belongs to the same owner, index, lock, and nonce as the owner record.

 @param directory - transaction directory

 @param owner - validated owner record

 @param journal - validated prepared journal
 */
function assertJournalMatchesOwner({
  directory,
  owner,
  journal,
}: Readonly<{
  directory: string;
  owner: TransactionOwnerRecord;
  journal: PreparedTransactionJournal;
}>,): void {
  if ((journal.ownerPid !== owner.ownerPid)
    || (journal.ownerIdentity !== owner.ownerIdentity)
    || (journal.realIndexPath !== owner.realIndexPath)
    || (journal.lockFsId !== owner.lockFsId)
    || (journal.lockDevice !== owner.lockDevice)
    || (journal.lockInode !== owner.lockInode)
    || (journal.reflogAction !== `${REFLOG_ACTION_PREFIX}${owner.transactionId}`))
    throw new CommitTransactionRecoveryError(`Transaction journal conflicts with its owner record: ${directory}`,);
}

/**
 Releases a dead owner's pre-journal state, which never touched the ref, real index, or worktree.

 @param directory - staging or published transaction directory

 @param owner - dead owner record naming the lock it created
 */
async function recoverUnjournaledTransaction({
  directory,
  owner,
}: Readonly<{
  directory: string;
  owner: TransactionOwnerRecord;
}>,): Promise<void> {
  /**
   Tagged unjournaled recovery logger.
   */
  const rl = tagged({
    tag: recoverUnjournaledTransaction.name,
    l,
  },);
  rl.debug(`unjournaled transaction lock ${await releaseOwnedLock({
    journal: owner,
    lockPath: `${owner.realIndexPath}.lock`,
  },)}: ${directory}`,);
  await removeTransactionDirectory(directory,);
}

/**
 Recovers or skips one inspected entry.

 @param inspected - entry with owner evidence

 @param gitPath - resolved Git executable

 @param effectiveCwd - invocation repository location

 @returns action for the entry
 */
async function recoverInspectedEntry({
  inspected,
  gitPath,
  effectiveCwd,
}: Readonly<{
  inspected: InspectedEntry;
  gitPath: string;
  effectiveCwd: string;
}>,): Promise<CommitTransactionRecoveryAction> {
  /**
   Tagged per-entry recovery logger.
   */
  const rl = tagged({
    tag: recoverInspectedEntry.name,
    l,
  },);
  /**
   Entry and its owner evidence.
   */
  const {
    entry,
    owner,
  } = inspected;
  if (owner === 'vanished') {
    rl.debug(`transaction finished while recovery listed it: ${entry.path}`,);
    return 'vanished';
  }
  if (owner === 'unattributed') {
    rl.debug(`staging candidate without a complete owner record left in place: ${entry.path}`,);
    return 'staging-unattributed';
  }
  /**
   Owner record and its liveness.
   */
  const {
    record,
    liveness,
  } = owner;
  if (liveness === 'alive') {
    rl.debug(`transaction owner ${String(record.ownerPid,)} is active; skipping ${entry.path}`,);
    return 'owner-active';
  }
  if ((entry.kind === 'staging')
    || (!(await recoveryPathExists(join(
      entry.path,
      JOURNAL_FILENAME,
    ),)))) {
    rl.debug(`dead owner stopped before journaling: ${entry.path}`,);
    await recoverUnjournaledTransaction({
      directory: entry.path,
      owner: record,
    },);
    return 'commit-not-created';
  }
  /**
   Prepared journal of the dead owner.
   */
  const journal = await loadTransactionJournal(entry.path,);
  assertJournalMatchesOwner({
    directory: entry.path,
    owner: record,
    journal,
  },);
  return recoverJournaledTransaction({
    directory: entry.path,
    journal,
    gitPath,
    effectiveCwd,
  },);
}

/**
 Builds an entry's recovery-order key: creation time when attributed, otherwise a key after every ISO time.

 @param inspected - inspected entry

 @returns sortable key
 */
function creationKey(inspected: InspectedEntry,): string {
  /**
   Entry and its owner evidence.
   */
  const {
    entry: { path, },
    owner,
  } = inspected;
  if ((owner === 'vanished') || (owner === 'unattributed'))
    return `~${path}`;
  /**
   Attributed owner record.
   */
  const { record: { createdAt, }, } = owner;
  return `${createdAt} ${path}`;
}

/**
 Recovers every dead-owner transaction in one worktree registry and removes retired leftovers.

 @param root - absolute registry path

 @param gitPath - resolved Git executable

 @param effectiveCwd - invocation repository location

 @returns one outcome per registry entry

 @throws {@link CommitTransactionRecoveryError} at the first transaction whose evidence conflicts

 @example
 ```ts
 await recoverRegisteredTransactions({ root: '/repo/.git/cli-git-transactions', gitPath: '/usr/bin/git', effectiveCwd: '/repo' });
 ```
 */
export async function recoverRegisteredTransactions({
  root,
  gitPath,
  effectiveCwd,
}: Readonly<{
  root: string;
  gitPath: string;
  effectiveCwd: string;
}>,): Promise<readonly CommitTransactionRecoveryOutcome[]> {
  /**
   Every classified registry entry.
   */
  const entries = await listTransactionEntries(root,);
  /**
   Owner evidence for every published and staging entry, read concurrently because inspection never mutates.
   */
  const inspected = (await Promise.all(entries
    .filter(function ownsEvidence(entry,): boolean {
      return entry.kind !== 'retired';
    },)
    .map(inspectEntry,),))
    .toSorted(function byCreation(
      left,
      right,
    ): number {
      /**
       Left entry order key.
       */
      const leftKey = creationKey(left,);
      /**
       Right entry order key.
       */
      const rightKey = creationKey(right,);
      if (leftKey === rightKey)
        return 0;
      return leftKey < rightKey ? -1 : 1;
    },);
  /**
   Outcomes in recovery order.
   */
  const outcomes: CommitTransactionRecoveryOutcome[] = [];
  for (const item of inspected) {
    /**
     Entry recovered in this step.
     */
    const { entry: { path, }, } = item;
    outcomes.push({
      directory: path,
      // oxlint-disable-next-line no-await-in-loop -- Each recovery mutates the shared ref, index, or lock the next one validates.
      action: await recoverInspectedEntry({
        inspected: item,
        gitPath,
        effectiveCwd,
      },),
    },);
  }
  /**
   Completed directories whose removal was interrupted; they hold no evidence.
   */
  const retired = entries.filter(function isRetired(entry,): boolean {
    return entry.kind === 'retired';
  },);
  await Promise.all(retired.map(async function removeRetired(entry,): Promise<void> {
    await rm(
      entry.path,
      {
        recursive: true,
        force: true,
      },
    );
  },),);
  return [
    ...outcomes,
    ...retired.map(function retiredOutcome(entry,): CommitTransactionRecoveryOutcome {
      return {
        directory: entry.path,
        action: 'retired-removed',
      };
    },),
  ];
}
