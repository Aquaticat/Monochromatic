/**
 Owner evidence for the registry-wide recursive-operation lock.

 The lock is an owner-lock directory (`src/owner-lock/owner-lock.ts`) whose record carries process-birth identity.
 Builds before that format published a PID-only record through `mkdir` and an in-directory rename,
 and such a build may still run against the same account registry,
 so its records are classified too:
 a PID-only owner whose process is gone is retired,
 and one whose PID still runs is unproven,
 because without a birth identity a reused PID looks identical to the owner.

 @module
 */
import { randomUUID, } from 'node:crypto';
import {
  readFile,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  isOccupiedError,
  OWNER_LOCK_RECORD_FILENAME,
  ownerLockHolderIsAlive,
  parseOwnerLockRecord,
} from '../owner-lock/owner-lock.ts';
import {
  PROCESS_IDENTITY_ABSENT,
  resolveProcessBirthIdentity,
} from '../policy-engine/commit-transaction-process-identity.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Owner record text is not a PID-only record from an earlier build.
 */
const NOT_LEGACY_RECORD: unique symbol = Symbol('owner.json text lacks the PID-only shape written by builds before process-birth ownership',);

/**
 No lock directory is published.
 */
const LOCK_DIRECTORY_ABSENT: unique symbol = Symbol('recursive lock directory absent',);

/**
 Lock directory exists without an owner record.
 */
const OWNER_RECORD_ABSENT: unique symbol = Symbol('recursive lock owner record absent',);

/**
 What one read of the lock proved about its owner.
 */
export type RecursiveLockObservation =
  | Readonly<{
    /**
     No lock is published.
     */
    kind: 'absent';
  }>
  | Readonly<{
    /**
     Owner runs with its recorded process birth.
     */
    kind: 'alive';
    /**
     Owner process ID.
     */
    ownerPid: number;
  }>
  | Readonly<{
    /**
     Birth-identity owner has exited; publication retires its lock.
     */
    kind: 'dead';
    /**
     Former owner process ID.
     */
    ownerPid: number;
  }>
  | Readonly<{
    /**
     PID-only owner from an earlier build whose process no longer runs.
     */
    kind: 'legacy-dead';
    /**
     Former owner process ID.
     */
    ownerPid: number;
    /**
     Exact record text proven dead, compared again before retirement.
     */
    recordText: string;
  }>
  | Readonly<{
    /**
     Lock exists but nothing proves its owner alive or dead.
     */
    kind: 'unproven';
    /**
     Evidence explaining why the owner is unproven.
     */
    evidence: string;
  }>;

/**
 Reads a PID-only owner record written by builds before the birth-identity format.

 @param text - owner record text

 @returns recorded PID, or {@link NOT_LEGACY_RECORD}
 */
function legacyOwnerPid(text: string,): number | typeof NOT_LEGACY_RECORD {
  try {
    /**
     Untrusted parsed JSON value.
     */
    const value: unknown = JSON.parse(text,);
    if (((typeof value) !== 'object')
      || (value === null)
      || (!('schemaVersion' in value))
      || (value.schemaVersion !== 1)
      || (!('ownerPid' in value))
      || ((typeof value.ownerPid) !== 'number')
      || (!Number.isSafeInteger(value.ownerPid,))
      || (value.ownerPid < 1)
      || ('token' in value))
      return NOT_LEGACY_RECORD;
    return value.ownerPid;
  }
  catch (error: unknown) {
    l.debug(`recursive lock owner text is not JSON: ${caughtValueText(error,)}`,);
    return NOT_LEGACY_RECORD;
  }
}

/**
 Reads the owner record text, or reports why none is readable.

 @param lockDirectory - published lock directory

 @returns record text, {@link LOCK_DIRECTORY_ABSENT}, or {@link OWNER_RECORD_ABSENT}
 */
async function readOwnerText(lockDirectory: string,): Promise<string | typeof LOCK_DIRECTORY_ABSENT | typeof OWNER_RECORD_ABSENT> {
  try {
    return await readFile(
      join(
        lockDirectory,
        OWNER_LOCK_RECORD_FILENAME,
      ),
      'utf8',
    );
  }
  catch (error: unknown) {
    if (!(Error.isError(error,)
      && ('code' in error)
      && ((error.code === 'ENOENT') || (error.code === 'ENOTDIR'))))
      throw error;
    l.debug(`recursive lock owner record unreadable: ${error.message}`,);
  }
  try {
    await stat(lockDirectory,);
    return OWNER_RECORD_ABSENT;
  }
  catch (error: unknown) {
    if (Error.isError(error,)
      && ('code' in error)
      && (error.code === 'ENOENT')) {
      l.debug(`recursive lock released while it was read: ${error.message}`,);
      return LOCK_DIRECTORY_ABSENT;
    }
    throw error;
  }
}

/**
 Classifies the current owner of the recursive-operation lock.

 Owner-lock publication is atomic,
 so a lock directory without a record was left by an earlier build's `mkdir` publication,
 during its initialization or after a crash in it.

 @param lockDirectory - published lock directory

 @returns owner evidence

 @example
 ```ts
 await observeRecursiveLock('/home/me/.local/state/cli-git/trust/v1/recursive-operation.lock');
 ```
 */
export async function observeRecursiveLock(lockDirectory: string,): Promise<RecursiveLockObservation> {
  /**
   Current record text or its absence.
   */
  const text = await readOwnerText(lockDirectory,);
  if (text === LOCK_DIRECTORY_ABSENT)
    return { kind: 'absent', };
  if (text === OWNER_RECORD_ABSENT)
    return {
      kind: 'unproven',
      evidence: `${lockDirectory} exists without ${OWNER_LOCK_RECORD_FILENAME}`,
    };
  /**
   PID-only record from an earlier build.
   */
  const legacyPid = legacyOwnerPid(text,);
  if (legacyPid !== NOT_LEGACY_RECORD) {
    if ((await resolveProcessBirthIdentity(legacyPid,)) === PROCESS_IDENTITY_ABSENT)
      return {
        kind: 'legacy-dead',
        ownerPid: legacyPid,
        recordText: text,
      };
    return {
      kind: 'unproven',
      evidence: `owner record from an earlier cli-git build names running PID ${String(legacyPid,)} without a process-birth identity, so a reused PID cannot be told apart from the owner`,
    };
  }
  try {
    /**
     Birth-identity owner record.
     */
    const record = parseOwnerLockRecord(text,);
    return {
      kind: (await ownerLockHolderIsAlive(record,)) ? 'alive' : 'dead',
      ownerPid: record.ownerPid,
    };
  }
  catch (error: unknown) {
    return {
      kind: 'unproven',
      evidence: `owner record is malformed (${caughtValueText(error,)})`,
    };
  }
}

/**
 Retires a PID-only lock whose owner process is gone, restoring it when the moved lock is not the one proven dead.

 Earlier builds publish only with `mkdir`,
 which cannot replace an existing lock,
 and owner-lock publication renames only onto an empty directory,
 so the rename moves either the dead lock or,
 after a concurrent release and republication,
 a live one,
 which the text comparison detects.

 @param lockDirectory - published lock directory

 @param recordText - exact record text proven dead

 @example
 ```ts
 await retireLegacyRecursiveLock({ lockDirectory, recordText });
 ```
 */
export async function retireLegacyRecursiveLock({
  lockDirectory,
  recordText,
}: Readonly<{
  lockDirectory: string;
  recordText: string;
}>,): Promise<void> {
  /**
   Tagged retirement logger.
   */
  const rl = tagged({
    tag: retireLegacyRecursiveLock.name,
    l,
  },);
  /**
   Unique retired name owned only after a successful rename.
   */
  const staleDirectory = `${lockDirectory}.${randomUUID()}.stale`;
  try {
    await rename(
      lockDirectory,
      staleDirectory,
    );
  }
  catch (error: unknown) {
    if (Error.isError(error,)
      && ('code' in error)
      && (error.code === 'ENOENT')) {
      rl.debug(`lock already released or retired: ${error.message}`,);
      return;
    }
    throw error;
  }
  /**
   Record of the directory actually moved.
   */
  const moved = await readOwnerText(staleDirectory,);
  if (moved !== recordText) {
    rl.warn(`a lock other than the dead earlier-build lock was moved from ${lockDirectory}; restoring it`,);
    try {
      await rename(
        staleDirectory,
        lockDirectory,
      );
    }
    catch (error: unknown) {
      if (!isOccupiedError(error,))
        throw error;
      rl.warn(`could not restore ${lockDirectory}: ${caughtValueText(error,)}`,);
    }
    return;
  }
  await rm(
    staleDirectory,
    {
      recursive: true,
      force: true,
    },
  );
  rl.debug(`retired earlier-build lock of exited owner: ${lockDirectory}`,);
}
