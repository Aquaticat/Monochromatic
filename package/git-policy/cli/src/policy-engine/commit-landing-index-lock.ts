/**
 The real `index.lock` held inside the landing critical section.

 A foreign lock is retried with Git-style quadratic backoff and jitter up to `indexLock.unprovenOwnerTimeoutMs`;
 cli-git never deletes a lock it did not create.
 Holder-evidence classification and the unbounded wait for a proven-alive holder are pending (slice 6).

 @module
 */
import { resolveFsId, } from '@monochromatic-dev/module-fs-id/ts';
import { constants, } from 'node:fs';
import {
  type FileHandle,
  lstat,
  open,
  readFile,
  rename,
  rm,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  isMissingPath,
  protectPath,
  syncDirectory,
} from '../trust/registry-io.ts';
import { createOwnedFileLink, } from './commit-transaction-install-link.ts';
import {
  indexLockRecordFilename,
  JOURNAL_SCHEMA_VERSION,
  type LockIdentity,
  writeJournalRecord,
} from './commit-transaction-journal-states.ts';
import { applyIndexTimestamps, } from './index-file-timestamps.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Private lock file mode.
 */
const PRIVATE_FILE_MODE = 0o600;

/**
 Lower jitter bound as a fraction of the backoff, matching Git's `lock_file_timeout`.
 */
const JITTER_FLOOR = 3 / (2 + 2);

/**
 Jitter width as a fraction of the backoff.
 */
const JITTER_WIDTH = 1 / 2;

/**
 The real `index.lock` stayed held past the backoff budget.
 */
export class IndexLockBusyError extends Error {
  /**
   Creates a busy-lock failure.

   @param lockPath - lock left in place
   */
  public constructor(lockPath: string,) {
    super(`Another process holds ${lockPath}; cli-git left it in place and landed nothing. Retry once that Git command finishes, or remove the lock only if no Git process is running.`,);
    this.name = 'IndexLockBusyError';
  }
}

/**
 Real `index.lock` owned by this transaction.
 */
export type RealIndexLock = AsyncDisposable & Readonly<{
  /**
   Lock path.
   */
  lockPath: string;
  /**
   Created lock identity.
   */
  identity: LockIdentity;
  /**
   Installs an index through the held lock with an owner-preserving hard link, consuming the lock.
   */
  installIndex: (sourcePath: string) => Promise<void>;
}>;

/**
 Git's PID file path beside a lock (`index.lock` becomes `index~pid.lock`).

 @param realIndexPath - real index path

 @returns PID file path

 @example
 ```ts
 lockPidPath('/repo/.git/index'); // '/repo/.git/index~pid.lock'
 ```
 */
export function lockPidPath(realIndexPath: string,): string {
  return `${realIndexPath}~pid.lock`;
}

/**
 Opens the lock exclusively, retrying a foreign holder with quadratic backoff.

 @param lockPath - real `index.lock`

 @param timeoutMs - backoff budget

 @returns open lock handle
 */
async function openLockWithBackoff({
  lockPath,
  timeoutMs,
}: Readonly<{
  lockPath: string;
  timeoutMs: number;
}>,): Promise<FileHandle> {
  /**
   Budget deadline.
   */
  const deadline = Date.now() + timeoutMs;
  /**
   Attempt counter and quadratic multiplier, as in Git's `lock_file_timeout`.
   */
  const state = {
    attempt: 1,
    multiplier: 1,
  };
  // oxlint-disable-next-line typescript/no-unnecessary-condition -- Every iteration returns, throws, or sleeps within the finite budget.
  while (true) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- Each attempt observes whether the previous holder released the lock.
      return await open(
        lockPath,
        constants.O_CREAT | constants.O_EXCL | constants.O_RDWR,
        PRIVATE_FILE_MODE,
      );
    }
    catch (error: unknown) {
      if (!(Error.isError(error,) && ('code' in error) && (error.code === 'EEXIST')))
        throw error;
      l.debug(`index lock busy on attempt ${String(state.attempt,)}: ${error.message}`,);
    }
    if (Date.now() >= deadline)
      throw new IndexLockBusyError(lockPath,);
    // oxlint-disable-next-line no-await-in-loop -- Backoff between ordered attempts.
    await wait(Math.min(
      Math.max(
        1,
        Math.round(state.multiplier * (JITTER_FLOOR + (Math.random() * JITTER_WIDTH))),
      ),
      Math.max(
        1,
        deadline - Date.now(),
      ),
    ),);
    state.multiplier += (2 * state.attempt) + 1;
    state.attempt += 1;
  }
}

/**
 Proves the lock path still names the exact created lock.

 @param lockPath - lock path

 @param identity - created identity

 @throws {@link TypeError} when the lock was replaced
 */
async function assertLockIdentity({
  lockPath,
  identity,
}: Readonly<{
  lockPath: string;
  identity: LockIdentity;
}>,): Promise<void> {
  /**
   Current non-followed metadata.
   */
  const metadata = await lstat(
    lockPath,
    { bigint: true, },
  );
  if ((!metadata.isFile())
    || (String(metadata.dev,) !== identity.device)
    || (String(metadata.ino,) !== identity.inode))
    throw new TypeError(`Commit transaction index lock identity changed: ${lockPath}`,);
}

/**
 Removes this process's PID file when it still names this process.

 @param pidPath - PID file path
 */
async function removeOwnPidFile(pidPath: string,): Promise<void> {
  try {
    if ((await readFile(pidPath, 'utf8',)) === `pid ${String(process.pid,)}\n`)
      await rm(pidPath,);
  }
  catch (error: unknown) {
    if (!isMissingPath(error,))
      throw error;
    l.debug(`lock PID file already absent: ${pidPath}`,);
  }
}

/**
 Writes cli-git's owner PID file in Git's `core.lockfilePid` format, leaving any existing file alone.

 @param pidPath - PID file path
 */
async function writeOwnPidFile(pidPath: string,): Promise<void> {
  try {
    /**
     Exclusive PID file handle.
     */
    await using handle = await open(
      pidPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      PRIVATE_FILE_MODE,
    );
    await handle.writeFile(`pid ${String(process.pid,)}\n`,);
  }
  catch (error: unknown) {
    if (!(Error.isError(error,) && ('code' in error) && (error.code === 'EEXIST')))
      throw error;
    l.debug(`a PID file already exists beside the lock: ${pidPath}`,);
  }
}

/**
 Acquires the real `index.lock`, records its identity, and writes the owner PID file.

 @param realIndexPath - real index path

 @param transactionDirectory - transaction directory receiving the lock record and install link

 @param attempt - landing attempt number

 @param timeoutMs - backoff budget for a foreign holder

 @returns held lock

 @throws {@link IndexLockBusyError} when a foreign holder outlasts the budget

 @example
 ```ts
 await using lock = await acquireRealIndexLock({ realIndexPath: '/repo/.git/index', transactionDirectory, attempt: 1, timeoutMs: 1_000 });
 ```
 */
export async function acquireRealIndexLock({
  realIndexPath,
  transactionDirectory,
  attempt,
  timeoutMs,
}: Readonly<{
  realIndexPath: string;
  transactionDirectory: string;
  attempt: number;
  timeoutMs: number;
}>,): Promise<RealIndexLock> {
  /**
   Real lock path.
   */
  const lockPath = `${realIndexPath}.lock`;
  /**
   Git's owner PID file path.
   */
  const pidPath = lockPidPath(realIndexPath,);
  /**
   Exclusive lock handle.
   */
  const handle = await openLockWithBackoff({
    lockPath,
    timeoutMs,
  },);
  /**
   Created lock metadata.
   */
  const metadata = await handle.stat({ bigint: true, },);
  /**
   Created lock identity.
   */
  const identity: LockIdentity = {
    device: String(metadata.dev,),
    inode: String(metadata.ino,),
    fsId: (await resolveFsId({
      path: lockPath,
      emitDiagnostics: false,
    },)).value,
  };
  await writeJournalRecord({
    directory: transactionDirectory,
    filename: indexLockRecordFilename(attempt,),
    record: {
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      state: 'index-locked',
      attempt,
      lock: identity,
    },
  },);
  await protectPath({
    path: lockPath,
    directory: false,
  },);
  await writeOwnPidFile(pidPath,);
  /**
   Lifecycle markers.
   */
  const state = new Set<'closed' | 'installed'>();
  return {
    lockPath,
    identity,
    installIndex: async function installIndex(sourcePath: string,): Promise<void> {
      /**
       Exact intended index bytes.
       */
      const bytes = await readFile(sourcePath,);
      await assertLockIdentity({
        lockPath,
        identity,
      },);
      await handle.truncate(0,);
      await handle.write(
        bytes,
        0,
        bytes.length,
        0,
      );
      await applyIndexTimestamps({
        sourcePath,
        handle,
      },);
      await handle.sync();
      await assertLockIdentity({
        lockPath,
        identity,
      },);
      /**
       Private owner-preserving installation name.
       */
      const installPath = join(
        transactionDirectory,
        `install-${String(attempt,)}.index`,
      );
      await createOwnedFileLink({
        sourcePath: lockPath,
        linkedPath: installPath,
        expectedDevice: identity.device,
        expectedInode: identity.inode,
      },);
      await handle.close();
      state.add('closed',);
      await rename(
        installPath,
        realIndexPath,
      );
      state.add('installed',);
      await assertLockIdentity({
        lockPath,
        identity,
      },);
      await rm(lockPath,);
      await removeOwnPidFile(pidPath,);
      await syncDirectory(dirname(realIndexPath,),);
    },
    [Symbol.asyncDispose]: async function releaseRealIndexLock(): Promise<void> {
      if (!state.has('closed',)) {
        await handle.close();
        state.add('closed',);
      }
      if (state.has('installed',))
        return;
      try {
        await assertLockIdentity({
          lockPath,
          identity,
        },);
        await rm(lockPath,);
      }
      catch (error: unknown) {
        if (!(isMissingPath(error,) || (error instanceof TypeError)))
          throw error;
        l.warn(`index lock was not this transaction's at release: ${Error.isError(error,) ? error.message : 'absent'}`,);
      }
      await removeOwnPidFile(pidPath,);
    },
  };
}
