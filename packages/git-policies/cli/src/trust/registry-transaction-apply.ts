/**
 * Provenance transaction lock and record application. @module
 */
import type { ReadonlyDeep, } from 'type-fest';
import {
  mkdir,
  rename,
  rm,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import {
  assertSafeRegistryDirectory,
  DIRECTORY_MODE,
  isMissingPath,
  protectPath,
  syncDirectory,
  TrustStorageError,
  writePrivateFile,
} from './registry-io.ts';
import { recordDirectory, } from './registry-path.ts';
import { readRecord, } from './record-validation.ts';
import type {
  ProvenanceOperation,
  TransactionJournal,
} from './registry-transaction-types.ts';

/**
 * Acquires every record lock concurrently after deterministic planning.
 *
 * @param registryRoot - complete registry root
 *
 * @param journal - transaction journal
 *
 * @returns acquired lock paths
 */
async function acquireLocks({
  registryRoot,
  journal,
}: Readonly<{
  registryRoot: string;
  journal: TransactionJournal;
}>,): Promise<readonly string[]> {
  /**
   * Deterministic exact lock paths.
   */
  const lockPaths = journal.operations
    .map(function operationLock(operation,) {
    return `${recordDirectory({
      registryRoot,
      identity: operation.identity,
    },)}.lock`;
  },);
  /**
   * Every independent lock acquisition result.
   */
  const results = await Promise.allSettled(lockPaths.map(async function acquireLock(lockPath,) {
    await mkdir(
      lockPath,
      { mode: DIRECTORY_MODE, },
    );
    await protectPath({
      path: lockPath,
      directory: true,
    },);
    return lockPath;
  },),);
  /**
   * Successfully acquired lock subset.
   */
  const acquired = results.flatMap(function fulfilledLock(
    result: ReadonlyDeep<(typeof results)[number]>,
  ) {
    return result.status === 'fulfilled' ? [result.value,] : [];
  },);
  /**
   * First lock failure when contention occurred.
   */
  const failure = results.find(function rejectedLock(
    result: ReadonlyDeep<(typeof results)[number]>,
  ) {
    return result.status === 'rejected';
  },);
  if (failure === undefined)
    return acquired;
  await Promise.all(acquired.map(function removeAcquired(lockPath,) {
    return rm(
      lockPath,
      {
        recursive: true,
        force: true,
      },
    );
  },),);
  throw new TrustStorageError(
    'Recursive trust transaction lock acquisition failed.',
    {
    cause: failure.reason,
  },
  );
}

/**
 * Applies one idempotent record operation.
 *
 * @param registryRoot - complete registry root
 *
 * @param transactionId - journal transaction ID
 *
 * @param operation - final record state
 */
async function applyOperation({
  registryRoot,
  transactionId,
  operation,
}: Readonly<{
  registryRoot: string;
  transactionId: string;
  operation: ProvenanceOperation;
}>,): Promise<void> {
  /**
   * Exact record directory.
   */
  const directory = recordDirectory({
    registryRoot,
    identity: operation.identity,
  },);
  if (operation.action === 'remove') {
    /**
     * Recoverable removed sibling.
     */
    const removedDirectory = `${directory}.removed-${transactionId}`;
    try {
      await rename(
        directory,
        removedDirectory,
      );
    }
    catch (error: unknown) {
      if (!isMissingPath(error,))
        throw error;
    }
    await rm(
      removedDirectory,
      {
        recursive: true,
        force: true,
      },
    );
    await syncDirectory(dirname(directory,),);
    return;
  }
  /**
   * Current record retained with final provenance.
   */
  const record = await readRecord({
    registryRoot,
    directory,
  },);
  /**
   * Private replacement metadata path.
   */
  const temporaryPath = join(
    directory,
    `record.json.${transactionId}.tmp`,
  );
  await rm(
    temporaryPath,
    { force: true, },
  );
  await writePrivateFile({
    path: temporaryPath,
    bytes: Buffer.from(
      `${JSON.stringify({
      ...record,
      authorizingRoots: operation.authorizingRoots,
    },)}\n`,
      'utf8',
    ),
  },);
  await rename(
    temporaryPath,
    join(
      directory,
      'record.json',
    ),
  );
  await syncDirectory(directory,);
  await readRecord({
    registryRoot,
    directory,
  },);
}

/**
 * Settles one journal and releases every lock.
 *
 * @param registryRoot - complete registry root
 *
 * @param journalPath - private journal path
 *
 * @param journal - validated journal
 *
 * @param recovering - whether prior owner terminated
 *
 * @example
 * ```ts
 * await settleProvenanceJournal(input);
 * ```
 */
export async function settleProvenanceJournal({
  registryRoot,
  journalPath,
  journal,
  recovering,
}: Readonly<{
  registryRoot: string;
  journalPath: string;
  journal: TransactionJournal;
  recovering: boolean;
}>,): Promise<void> {
  /**
   * Exact validated transaction journal parent.
   */
  const journalDirectory = dirname(journalPath,);
  if (journalDirectory !== join(
    registryRoot,
    'transactions',
  ))
    throw new TrustStorageError(`Transaction journal escaped registry directory: ${journalPath}`,);
  await assertSafeRegistryDirectory({
    registryRoot,
    targetDirectory: journalDirectory,
  },);
  if (recovering) {
    await Promise.all(journal.operations
      .map(function removeStaleLock(operation,) {
      return rm(
        `${recordDirectory({
          registryRoot,
          identity: operation.identity,
        },)}.lock`,
        {
        recursive: true,
        force: true,
      },
      );
    },),);
  }
  /**
   * Locks held through complete journal application.
   */
  const locks = await acquireLocks({
    registryRoot,
    journal,
  },);
  /**
   * Automatic lock cleanup on success or failure.
   */
  await using lockCleanup = {
    async [Symbol.asyncDispose](): Promise<void> {
      await Promise.all(locks.map(function removeLock(lockPath,) {
        return rm(
          lockPath,
          {
            recursive: true,
            force: true,
          },
        );
      },),);
    },
  };
  await Promise.all(journal.operations
    .map(function applyJournalOperation(operation,) {
    return applyOperation({
      registryRoot,
      transactionId: journal.transactionId,
      operation,
    },);
  },),);
  await assertSafeRegistryDirectory({
    registryRoot,
    targetDirectory: journalDirectory,
  },);
  await rm(
    journalPath,
    { force: true, },
  );
  await syncDirectory(journalDirectory,);
}
