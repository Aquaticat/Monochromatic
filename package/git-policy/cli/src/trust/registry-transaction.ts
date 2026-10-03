/**
 Recoverable multi-record provenance transaction coordination. @module
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
 Ensures private transaction journal directory.
 
 @param registryRoot - complete registry root
 
 @returns private journal directory
 */
async function transactionDirectory(registryRoot: string,): Promise<string> {
  await ensureRegistryRoot(registryRoot,);
  /**
   Private transaction journal directory.
   */
  const directory = join(
    registryRoot,
    'transactions',
  );
  /**
   Whether this invocation created exact leaf without following substitution.
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
 Lists journal entries in deterministic order.
 
 @param directory - validated private journal directory
 
 @returns journal directory entries sorted by name
 */
async function sortedJournalEntries(directory: string,): Promise<readonly Dirent[]> {
  return (await readdir(
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
}

/**
 Reports whether any provenance journal is published,
 so a reader that holds no lock takes the recursive-operation lock only when a transaction may be in flight.
 
 @param registryRoot - complete registry root
 
 @returns whether the private journal directory holds any entry
 
 @example
 ```ts
 if (await provenanceJournalsPresent(registryRoot)) { ... }
 ```
 */
export async function provenanceJournalsPresent(registryRoot: string,): Promise<boolean> {
  return (await sortedJournalEntries(await transactionDirectory(registryRoot,),)).length > 0;
}

/**
 Settles every published provenance transaction.
 
 The caller holds the registry-wide recursive-operation lock,
 which every journal writer holds from publishing its journal until settling it,
 so every journal still published belongs to this process or to a holder that died:
 none can belong to a live transaction in another process.
 Owner PIDs recorded in journals are not consulted,
 because a PID alone cannot tell a live owner from an unrelated process that reused it.
 
 @param registryRoot - complete registry root
 
 @example
 ```ts
 await using lock = await acquireRecursiveRegistryLock({ registryRoot });
 await recoverProvenanceTransactions({ registryRoot });
 ```
 */
export async function recoverProvenanceTransactions({
  registryRoot,
}: Readonly<{
  registryRoot: string;
}>,): Promise<void> {
  /**
   Private journal directory.
   */
  const directory = await transactionDirectory(registryRoot,);
  /**
   Journal filenames in deterministic order.
   */
  const entries = await sortedJournalEntries(directory,);
  await entries.reduce<Promise<void>>(
    async function recoverAfter(
      previous,
      entry: ForeignBorrowed<Dirent>,
    ) {
    await previous;
    if (!entry.isFile())
      throw new TrustStorageError(`Unsafe transaction journal entry: ${entry.name}`,);
    /**
     Exact journal path.
     */
    const journalPath = join(
      directory,
      entry.name,
    );
    /**
     Parsed private journal.
     */
    const journal = parseTransactionJournal(Buffer.from(await readPrivateFile(journalPath,),)
      .toString('utf8',),);
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
 Compares operation paths by reversible identity bytes.
 
 @param registryRoot - complete registry root
 
 @param left - first operation
 
 @param right - second operation
 
 @returns deterministic ordering
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
   First reversible record path.
   */
  const leftPath = recordDirectory({
    registryRoot,
    identity: left.identity,
  },);
  /**
   Second reversible record path.
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
 Applies recoverable multi-record provenance changes.
 
 @param registryRoot - complete registry root
 
 @param operations - final states in any order
 
 @example
 ```ts
 await applyProvenanceTransaction({ registryRoot, operations });
 ```
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
   Deterministic operation order.
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
   Unique journal identifier.
   */
  const transactionId = randomUUID();
  /**
   Complete persistent journal.
   */
  const journal: TransactionJournal = {
    schemaVersion: 1,
    ownerPid: process.pid,
    transactionId,
    operations: orderedOperations,
  };
  /**
   Private journal directory.
   */
  const directory = await transactionDirectory(registryRoot,);
  /**
   Private durable journal path.
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
