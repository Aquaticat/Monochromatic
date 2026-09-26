/**
 Rename-published owner-lock directories with process-birth ownership and an unbounded wait while the owner lives.

 A lock is a directory holding `owner.json`.
 An acquirer writes a complete candidate directory and publishes it by rename,
 so a published lock always names its owner.
 A lock whose owner is dead,
 including a PID now naming a later process,
 is retired by the next acquirer through a rename to a unique stale name.
 The hook dispatcher shim implements the same record format in plain JavaScript,
 so both sides contend on one lock.

 @module
 */
import { randomUUID, } from 'node:crypto';
import { constants, } from 'node:fs';
import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
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
const OWNER_LOCK_SCHEMA_VERSION = 1;

/**
 Private lock directory mode.
 */
const PRIVATE_DIRECTORY_MODE = 0o700;

/**
 Private owner record mode.
 */
const PRIVATE_FILE_MODE = 0o600;

/**
 Default delay between acquisition attempts while a live owner holds the lock.
 */
const DEFAULT_POLL_DELAY_MS = 20;

/**
 Another live process owns the lock, or a concurrent acquirer replaced it.
 */
const LOCK_BUSY: unique symbol = Symbol('owner lock belongs to live process',);

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
}>;

/**
 Held owner lock; disposal releases it after proving ownership did not change.
 */
export type OwnerLock = AsyncDisposable & Readonly<{
  /**
   Published lock directory.
   */
  lockDirectory: string;
  /**
   Token published in the lock.
   */
  token: string;
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
    || (value.ownerBirthIdentity === ''))
    throw new OwnerLockError('Owner lock record is malformed.',);
  return {
    schemaVersion: OWNER_LOCK_SCHEMA_VERSION,
    token: value.token,
    ownerPid: value.ownerPid,
    ownerBirthIdentity: value.ownerBirthIdentity,
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

/**
 Reports whether a rename failed because another directory already holds the name.

 @param error - rename failure

 @returns whether the destination was occupied
 */
function isOccupiedError(error: unknown,): boolean {
  return Error.isError(error,)
    && ('code' in error)
    && ((error.code === 'EEXIST') || (error.code === 'ENOTEMPTY')
      || (error.code === 'EPERM'));
}

/**
 Writes a complete unpublished candidate lock.

 @param candidateDirectory - unique candidate path

 @param record - owner record to publish
 */
async function writeCandidate({
  candidateDirectory,
  record,
}: Readonly<{
  candidateDirectory: string;
  record: OwnerLockRecord;
}>,): Promise<void> {
  await mkdir(
    candidateDirectory,
    { mode: PRIVATE_DIRECTORY_MODE, },
  );
  /**
   Exclusive no-follow owner record handle.
   */
  await using handle = await open(
    join(
      candidateDirectory,
      OWNER_LOCK_RECORD_FILENAME,
    ),
    constants.O_CREAT | constants.O_EXCL
      | constants.O_WRONLY
      | constants.O_NOFOLLOW,
    PRIVATE_FILE_MODE,
  );
  await handle.writeFile(
    `${JSON.stringify({
      schemaVersion: record.schemaVersion,
      token: record.token,
      ownerPid: record.ownerPid,
      ownerBirthIdentity: record.ownerBirthIdentity,
    },)}\n`,
    'utf8',
  );
  await handle.sync();
}

/**
 Retires a lock whose recorded owner is dead, restoring it when a live replacement was moved instead.

 @param lockDirectory - published lock directory

 @param deadToken - token of the owner proven dead

 @returns busy sentinel so the caller retries publication
 */
async function retireDeadLock({
  lockDirectory,
  deadToken,
}: Readonly<{
  lockDirectory: string;
  deadToken: string;
}>,): Promise<typeof LOCK_BUSY> {
  /**
   Tagged retirement logger.
   */
  const rl = tagged({
    tag: retireDeadLock.name,
    l,
  },);
  /**
   Owner published now; the liveness check took time, during which the dead-looking owner may have released
   and a live acquirer may have published its own lock.
   */
  const current = await readOwnerLockRecord(lockDirectory,);
  if ((current === LOCK_BUSY) || (current.token !== deadToken)) {
    rl.debug(`${lockDirectory} changed owner since its owner was found dead; not retiring it`,);
    return LOCK_BUSY;
  }
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
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT')) {
      rl.debug(`dead lock already retired by another acquirer: ${lockDirectory}`,);
      return LOCK_BUSY;
    }
    throw error;
  }
  /**
   Owner of the directory actually moved, which a concurrent acquirer may have replaced.
   */
  const moved = await readOwnerLockRecord(staleDirectory,);
  if ((moved !== LOCK_BUSY) && (moved.token !== deadToken)) {
    rl.warn(`a live replacement of ${lockDirectory} was retired by a race; restoring it`,);
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
    return LOCK_BUSY;
  }
  await rm(
    staleDirectory,
    {
      recursive: true,
      force: true,
    },
  );
  rl.debug(`retired lock of dead owner ${deadToken}: ${lockDirectory}`,);
  return LOCK_BUSY;
}

/**
 Releases a held lock by renaming it away before deleting it.

 Removing the published directory in place would empty it before `rmdir`,
 and a concurrent acquirer's `rename` replaces an empty directory,
 so an in-place removal could delete the next owner's record.
 The rename frees the published name atomically instead.

 @param lockDirectory - published lock directory

 @param token - token this holder published

 @throws {@link OwnerLockError} when the published or moved lock names another owner
 */
async function releaseHeldLock({
  lockDirectory,
  token,
}: Readonly<{
  lockDirectory: string;
  token: string;
}>,): Promise<void> {
  /**
   Owner immediately before release.
   */
  const current = await readOwnerLockRecord(lockDirectory,);
  if ((current === LOCK_BUSY) || (current.token !== token))
    throw new OwnerLockError(`Owner lock ownership changed while held: ${lockDirectory}`,);
  /**
   Unique retired name owned only after the rename.
   */
  const retiredDirectory = `${lockDirectory}.${randomUUID()}.stale`;
  await rename(
    lockDirectory,
    retiredDirectory,
  );
  /**
   Owner of the directory actually moved.
   */
  const moved = await readOwnerLockRecord(retiredDirectory,);
  if ((moved === LOCK_BUSY) || (moved.token !== token)) {
    try {
      await rename(
        retiredDirectory,
        lockDirectory,
      );
    }
    catch (error: unknown) {
      if (!isOccupiedError(error,))
        throw error;
      l.warn(`could not restore ${lockDirectory}: ${caughtValueText(error,)}`,);
    }
    throw new OwnerLockError(`Owner lock ownership changed during release: ${lockDirectory}`,);
  }
  await rm(
    retiredDirectory,
    {
      recursive: true,
      force: true,
    },
  );
}

/**
 Attempts one publication, retiring a dead owner's lock when one blocks it.

 @param lockDirectory - published lock directory

 @param record - current owner record

 @returns held lock or busy sentinel
 */
async function attemptAcquire({
  lockDirectory,
  record,
}: Readonly<{
  lockDirectory: string;
  record: OwnerLockRecord;
}>,): Promise<OwnerLock | typeof LOCK_BUSY> {
  /**
   Unpublished complete candidate.
   */
  const candidateDirectory = `${lockDirectory}.${randomUUID()}.pending`;
  await writeCandidate({
    candidateDirectory,
    record,
  },);
  try {
    await rename(
      candidateDirectory,
      lockDirectory,
    );
    return {
      lockDirectory,
      token: record.token,
      [Symbol.asyncDispose]: async function releaseOwnerLock(): Promise<void> {
        await releaseHeldLock({
          lockDirectory,
          token: record.token,
        },);
      },
    };
  }
  catch (error: unknown) {
    await rm(
      candidateDirectory,
      {
        recursive: true,
        force: true,
      },
    );
    if (!isOccupiedError(error,))
      throw error;
  }
  /**
   Owner of the blocking lock.
   */
  const published = await readOwnerLockRecord(lockDirectory,);
  if (published === LOCK_BUSY)
    return LOCK_BUSY;
  if (await ownerLockHolderIsAlive(published,))
    return LOCK_BUSY;
  return retireDeadLock({
    lockDirectory,
    deadToken: published.token,
  },);
}

/**
 Acquires an owner lock, waiting without bound while a live owner holds it.

 @param lockDirectory - lock directory path whose parent exists

 @param pollDelayMs - delay between attempts while busy

 @param onWait - called once when the first attempt finds a live owner

 @returns held lock released by disposal

 @throws {@link OwnerLockError} when the current process identity is unavailable

 @example
 ```ts
 await using lock = await acquireOwnerLock({ lockDirectory: '/repo/.git/cli-git-transactions/landing.lock' });
 ```
 */
export async function acquireOwnerLock({
  lockDirectory,
  pollDelayMs = DEFAULT_POLL_DELAY_MS,
  onWait,
}: Readonly<{
  lockDirectory: string;
  pollDelayMs?: number;
  onWait?: () => void;
}>,): Promise<OwnerLock> {
  /**
   Current process birth identity.
   */
  const ownerBirthIdentity = await resolveProcessBirthIdentity(process.pid,);
  if (ownerBirthIdentity === PROCESS_IDENTITY_ABSENT)
    throw new OwnerLockError('Current owner-lock process identity is unavailable.',);
  /**
   Complete current owner record.
   */
  const record: OwnerLockRecord = {
    schemaVersion: OWNER_LOCK_SCHEMA_VERSION,
    token: randomUUID(),
    ownerPid: process.pid,
    ownerBirthIdentity,
  };
  /**
   Whether the wait notification already ran.
   */
  const notified = new Set<'notified'>();
  // The wait is unbounded by contract while the owner lives; every iteration either returns or sleeps.
  for (;;) {
    /**
     One publication attempt.
     */
    // oxlint-disable-next-line no-await-in-loop -- Attempts are ordered; each one observes the previous owner's state.
    const result = await attemptAcquire({
      lockDirectory,
      record,
    },);
    if (result !== LOCK_BUSY)
      return result;
    if ((onWait !== undefined) && (notified.size === 0)) {
      notified.add('notified',);
      onWait();
    }
    // oxlint-disable-next-line no-await-in-loop -- Delay prevents spinning against a live owner.
    await wait(pollDelayMs,);
  }
}
