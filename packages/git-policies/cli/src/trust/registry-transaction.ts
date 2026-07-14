/**
 * Recoverable multi-record provenance transaction coordination. @module
 */
import { randomUUID, } from 'node:crypto';
import type { Dirent, } from 'node:fs';
import {
  mkdir,
  readdir,
} from 'node:fs/promises';
import { join, } from 'node:path';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  assertSafeRegistryDirectory,
  DIRECTORY_MODE,
  ensureRegistryRoot,
  protectPath,
  syncDirectory,
  TrustStorageError,
  writePrivateFile,
} from './registry-io.ts';
import { readPrivateFile, } from './record-validation.ts';
import { recordDirectory, } from './registry-path.ts';
import { settleProvenanceJournal, } from './registry-transaction-apply.ts';
import {
  parseTransactionJournal,
  type ProvenanceOperation,
  type TransactionJournal,
} from './registry-transaction-types.ts';

export type { ProvenanceOperation, } from './registry-transaction-types.ts';

/**
 * Reports whether transaction owner process still exists.
 *
 * @param ownerPid - recorded process ID
 *
 * @returns whether operating system still exposes process
 */
function processExists(ownerPid: number,): boolean {
  try {
    process.kill(
      ownerPid,
      0,
    );
    return true;
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'ESRCH'))
      return false;
    return true;
  }
}

/**
 * Ensures private transaction journal directory.
 *
 * @param registryRoot - complete registry root
 *
 * @returns private journal directory
 */
async function transactionDirectory(registryRoot: string,): Promise<string> {
  await ensureRegistryRoot(registryRoot,);
  /**
   * Private transaction journal directory.
   */
  const directory = join(
    registryRoot,
    'transactions',
  );
  /**
   * Whether this invocation created exact leaf without following substitution.
   */
  const created = await (async function createTransactionDirectory(): Promise<boolean> {
    try {
      await mkdir(
        directory,
        { mode: DIRECTORY_MODE, },
      );
      return true;
    }
    catch (error: unknown) {
      if (Error.isError(error,) && ('code' in error)
        && (error.code === 'EEXIST'))
        return false;
      throw error;
    }
  })();
  if (created) {
    await protectPath({
      path: directory,
      directory: true,
    },);
  }
  await assertSafeRegistryDirectory({
    registryRoot,
    targetDirectory: directory,
  },);
  return directory;
}

/**
 * Recovers every interrupted provenance transaction.
 *
 * @param registryRoot - complete registry root
 *
 * @example
 * ```ts
 * await recoverProvenanceTransactions({ registryRoot });
 * ```
 */
export async function recoverProvenanceTransactions({
  registryRoot,
}: Readonly<{
  registryRoot: string;
}>,): Promise<void> {
  /**
   * Private journal directory.
   */
  const directory = await transactionDirectory(registryRoot,);
  /**
   * Journal filenames in deterministic order.
   */
  const entries = (await readdir(
    directory,
    { withFileTypes: true, },
  ))
    .toSorted(function byName(
      left: ForeignBorrowed<Dirent>,
      right: ForeignBorrowed<Dirent>,
    ) {
      return left.name
        .localeCompare(right.name,);
    },);
  await entries.reduce<Promise<void>>(
    async function recoverAfter(
      previous,
      entry: ForeignBorrowed<Dirent>,
    ) {
    await previous;
    if (!entry.isFile())
      throw new TrustStorageError(`Unsafe transaction journal entry: ${entry.name}`,);
    /**
     * Exact journal path.
     */
    const journalPath = join(
      directory,
      entry.name,
    );
    /**
     * Parsed private journal.
     */
    const journal = parseTransactionJournal(Buffer.from(await readPrivateFile(journalPath,),)
      .toString('utf8',),);
    if ((journal.ownerPid !== process.pid) && processExists(journal.ownerPid))
      throw new TrustStorageError('Recursive trust transaction is active in another process.',);
    await settleProvenanceJournal({
      registryRoot,
      journalPath,
      journal,
      recovering: true,
    },);
  },
    Promise.resolve(),
  );
}

/**
 * Compares operation paths by reversible identity bytes.
 *
 * @param registryRoot - complete registry root
 *
 * @param left - first operation
 *
 * @param right - second operation
 *
 * @returns deterministic ordering
 */
function compareOperation({
  registryRoot,
  left,
  right,
}: Readonly<{
  registryRoot: string;
  left: ProvenanceOperation;
  right: ProvenanceOperation;
}>,): number {
  /**
   * First reversible record path.
   */
  const leftPath = recordDirectory({
    registryRoot,
    identity: left.identity,
  },);
  /**
   * Second reversible record path.
   */
  const rightPath = recordDirectory({
    registryRoot,
    identity: right.identity,
  },);
  if (leftPath < rightPath)
    return -1;
  return leftPath > rightPath ? 1 : 0;
}

/**
 * Applies recoverable multi-record provenance changes.
 *
 * @param registryRoot - complete registry root
 *
 * @param operations - final states in any order
 *
 * @example
 * ```ts
 * await applyProvenanceTransaction({ registryRoot, operations });
 * ```
 */
export async function applyProvenanceTransaction({
  registryRoot,
  operations,
}: Readonly<{
  registryRoot: string;
  operations: readonly ProvenanceOperation[];
}>,): Promise<void> {
  if (operations.length === 0)
    return;
  await recoverProvenanceTransactions({ registryRoot, },);
  /**
   * Deterministic operation order.
   */
  const orderedOperations = operations.toSorted(function byIdentity(
    left,
    right,
  ) {
    return compareOperation({
      registryRoot,
      left,
      right,
    },);
  },);
  /**
   * Unique journal identifier.
   */
  const transactionId = randomUUID();
  /**
   * Complete persistent journal.
   */
  const journal: TransactionJournal = {
    schemaVersion: 1,
    ownerPid: process.pid,
    transactionId,
    operations: orderedOperations,
  };
  /**
   * Private journal directory.
   */
  const directory = await transactionDirectory(registryRoot,);
  /**
   * Private durable journal path.
   */
  const journalPath = join(
    directory,
    `${transactionId}.json`,
  );
  await writePrivateFile({
    path: journalPath,
    bytes: Buffer.from(
      `${JSON.stringify(journal,)}\n`,
      'utf8',
    ),
  },);
  await syncDirectory(directory,);
  await settleProvenanceJournal({
    registryRoot,
    journalPath,
    journal,
    recovering: false,
  },);
}
