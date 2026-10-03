/**
 Owner inspection of one transaction registry entry.

 @module
 */
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { isMissingPath, } from '../trust/registry-io.ts';
import {
  classifyTransactionOwner,
  parseTransactionOwner,
  type TransactionOwnerLiveness,
  type TransactionOwnerRecord,
} from './commit-transaction-owner.ts';
import {
  OWNER_FILENAME,
  type TransactionRegistryEntry,
} from './commit-transaction-registry.ts';
import {
  readRegularRecoveryFile,
  recoveryPathExists,
} from './commit-transaction-recovery-files.ts';
import { CommitTransactionRecoveryError, } from './commit-transaction-recovery-validation.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Owner evidence for one unpublished or published entry.
 */
export type InspectedEntry = Readonly<{
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

 @example
 ```ts
 await inspectRegistryEntry({ kind: 'transaction', transactionId, path: '/repo/.git/cli-git-transactions/' + transactionId });
 ```
 */
export async function inspectRegistryEntry(entry: TransactionRegistryEntry,): Promise<InspectedEntry> {
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
