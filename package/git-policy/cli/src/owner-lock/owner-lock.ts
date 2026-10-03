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
import {
  LOCK_BUSY,
  OWNER_LOCK_RECORD_FILENAME,
  OWNER_LOCK_SCHEMA_VERSION,
  OwnerLockError,
  type OwnerLockRecord,
  ownerLockHolderIsAlive,
  readOwnerLockRecord,
} from './owner-lock-record.ts';

export {
  LOCK_BUSY,
  OWNER_LOCK_RECORD_FILENAME,
  OwnerLockError,
  type OwnerLockRecord,
  ownerLockHolderIsAlive,
  parseOwnerLockRecord,
  readOwnerLockRecord,
} from './owner-lock-record.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

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
 Complete unpublished candidate lock.
 */
export type OwnerLockCandidate = Readonly<{
  /**
   Unpublished candidate directory.
   */
  directory: string;
  /**
   Complete owner record inside the candidate.
   */
  recordPath: string;
}>;

/**
 Hardens a complete unpublished candidate before publication,
 for a lock living in storage with stricter protection rules than the private modes set at creation.
 */
export type OwnerLockCandidatePreparation = (candidate: OwnerLockCandidate) => Promise<void>;

/**
 Reports whether a rename failed because another directory already holds the name.

 @param error - rename failure

 @returns whether the destination was occupied

 @example
 ```ts
 isOccupiedError(Object.assign(new Error('occupied'), { code: 'ENOTEMPTY' }));
 ```
 */
export function isOccupiedError(error: unknown,): boolean {
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
      ...(record.transactionId === undefined ? {} : { transactionId: record.transactionId, }),
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

 @param prepareCandidate - hardens the complete candidate before publication

 @returns held lock or busy sentinel
 */
async function attemptAcquire({
  lockDirectory,
  record,
  prepareCandidate,
}: Readonly<{
  lockDirectory: string;
  record: OwnerLockRecord;
  prepareCandidate?: OwnerLockCandidatePreparation;
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
    await prepareCandidate?.({
      directory: candidateDirectory,
      recordPath: join(
        candidateDirectory,
        OWNER_LOCK_RECORD_FILENAME,
      ),
    },);
  }
  catch (error: unknown) {
    l.debug(`removing unpublished candidate after preparation failed: ${caughtValueText(error,)}`,);
    await rm(
      candidateDirectory,
      {
        recursive: true,
        force: true,
      },
    );
    throw error;
  }
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
 Builds a fresh owner record for the current process.

 @param transactionId - commit transaction the lock is held for, when one is

 @returns owner record with a new token

 @throws {@link OwnerLockError} when the current process identity is unavailable
 */
async function currentOwnerRecord(transactionId?: string,): Promise<OwnerLockRecord> {
  /**
   Current process birth identity.
   */
  const ownerBirthIdentity = await resolveProcessBirthIdentity(process.pid,);
  if (ownerBirthIdentity === PROCESS_IDENTITY_ABSENT)
    throw new OwnerLockError('Current owner-lock process identity is unavailable.',);
  return {
    schemaVersion: OWNER_LOCK_SCHEMA_VERSION,
    token: randomUUID(),
    ownerPid: process.pid,
    ownerBirthIdentity,
    ...(transactionId === undefined ? {} : { transactionId, }),
  };
}

/**
 Makes one publication attempt without waiting, retiring a dead owner's lock when one blocks it.

 @param lockDirectory - lock directory path whose parent exists

 @param transactionId - commit transaction the lock is held for

 @param prepareCandidate - hardens the complete candidate before publication, for storage with stricter protection rules

 @returns held lock, or {@link LOCK_BUSY} while another owner holds it or a dead owner's lock was just retired

 @throws {@link OwnerLockError} when the current process identity is unavailable or the blocking lock's record is malformed

 @example
 ```ts
 const lock = await tryAcquireOwnerLock({ lockDirectory, transactionId });
 ```
 */
export async function tryAcquireOwnerLock({
  lockDirectory,
  transactionId,
  prepareCandidate,
}: Readonly<{
  lockDirectory: string;
  transactionId?: string;
  prepareCandidate?: OwnerLockCandidatePreparation;
}>,): Promise<OwnerLock | typeof LOCK_BUSY> {
  return await attemptAcquire({
    lockDirectory,
    record: await currentOwnerRecord(transactionId,),
    ...(prepareCandidate === undefined ? {} : { prepareCandidate, }),
  },);
}

/**
 Retires a lock whose recorded owner is dead, leaving an absent lock or a live owner's lock alone.

 @param lockDirectory - published lock directory

 @example
 ```ts
 await retireLockOfDeadOwner('/repo/.git/cli-git-transactions/reservation.lock');
 ```
 */
export async function retireLockOfDeadOwner(lockDirectory: string,): Promise<void> {
  /**
   Published owner.
   */
  const published = await readOwnerLockRecord(lockDirectory,);
  if ((published === LOCK_BUSY) || (await ownerLockHolderIsAlive(published,)))
    return;
  await retireDeadLock({
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
   Complete current owner record.
   */
  const record = await currentOwnerRecord();
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
