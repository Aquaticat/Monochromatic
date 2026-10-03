/**
 Owner-lock record format, reading, and owner liveness.

 The hook dispatcher shim implements the same record format in plain JavaScript.

 @module
 */
import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  PROCESS_IDENTITY_ABSENT,
  resolveProcessBirthIdentity,
} from '../policy-engine/commit-transaction-process-identity.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Owner record filename inside a published lock directory.
 */
export const OWNER_LOCK_RECORD_FILENAME = 'owner.json';

/**
 Owner-lock record schema version.
 */
export const OWNER_LOCK_SCHEMA_VERSION = 1;

/**
 Another live process owns the lock, or a concurrent acquirer replaced it.
 */
export const LOCK_BUSY: unique symbol = Symbol('owner lock belongs to live process',);

/**
 Durable owner of one published lock.
 */
export type OwnerLockRecord = Readonly<{
  /**
   Record schema version.
   */
  schemaVersion: 1;
  /**
   Unguessable token distinguishing this acquisition from every other.
   */
  token: string;
  /**
   Owning process ID.
   */
  ownerPid: number;
  /**
   Process-birth identity distinguishing the owner from a later process reusing its PID.
   */
  ownerBirthIdentity: string;
  /**
   Commit transaction the lock is held for, recorded by the landing reservation.
   */
  transactionId?: string;
}>;

/**
 Owner lock ownership changed while it was held.
 */
export class OwnerLockError extends Error {
  /**
   Creates an ownership failure.

   @param message - diagnostic naming the lock
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'OwnerLockError';
  }
}

/**
 Parses an owner record.

 @param text - owner record text

 @returns validated record

 @throws {@link OwnerLockError} when a field is missing or mistyped

 @example
 ```ts
 parseOwnerLockRecord('{"schemaVersion":1,"token":"t","ownerPid":1,"ownerBirthIdentity":"linux:1"}');
 ```
 */
export function parseOwnerLockRecord(text: string,): OwnerLockRecord {
  /**
   Untrusted parsed JSON value.
   */
  const value: unknown = JSON.parse(text,);
  if (((typeof value) !== 'object')
    || (value === null)
    || (!('schemaVersion' in value))
    || (value.schemaVersion !== OWNER_LOCK_SCHEMA_VERSION)
    || (!('token' in value))
    || ((typeof value.token) !== 'string')
    || (value.token === '')
    || (!('ownerPid' in value))
    || ((typeof value.ownerPid) !== 'number')
    || (!Number.isSafeInteger(value.ownerPid,))
    || (value.ownerPid < 1)
    || (!('ownerBirthIdentity' in value))
    || ((typeof value.ownerBirthIdentity) !== 'string')
    || (value.ownerBirthIdentity === '')
    || (('transactionId' in value) && (((typeof value.transactionId) !== 'string') || (value.transactionId === ''))))
    throw new OwnerLockError('Owner lock record is malformed.',);
  return {
    schemaVersion: OWNER_LOCK_SCHEMA_VERSION,
    token: value.token,
    ownerPid: value.ownerPid,
    ownerBirthIdentity: value.ownerBirthIdentity,
    ...(('transactionId' in value) && ((typeof value.transactionId) === 'string') ? { transactionId: value.transactionId, } : {}),
  };
}

/**
 Reads a published owner record, reporting a vanished lock as busy so the caller retries.

 @param lockDirectory - published lock directory

 @returns owner record or busy sentinel

 @example
 ```ts
 await readOwnerLockRecord('/repo/.git/cli-git-transactions/landing.lock');
 ```
 */
export async function readOwnerLockRecord(lockDirectory: string,): Promise<OwnerLockRecord | typeof LOCK_BUSY> {
  try {
    return parseOwnerLockRecord(await readFile(
      join(
        lockDirectory,
        OWNER_LOCK_RECORD_FILENAME,
      ),
      'utf8',
    ),);
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error)
      && ((error.code === 'ENOENT') || (error.code === 'ENOTDIR'))) {
      l.debug(`owner lock vanished while reading: ${error.message}`,);
      return LOCK_BUSY;
    }
    throw error;
  }
}

/**
 Reports whether a recorded owner still runs with the same process birth.

 @param record - published owner record

 @returns whether the owner is alive

 @example
 ```ts
 await ownerLockHolderIsAlive(record);
 ```
 */
export async function ownerLockHolderIsAlive(record: OwnerLockRecord,): Promise<boolean> {
  /**
   Current birth identity of the process the PID names.
   */
  const current = await resolveProcessBirthIdentity(record.ownerPid,);
  return (current !== PROCESS_IDENTITY_ABSENT) && (current === record.ownerBirthIdentity);
}
