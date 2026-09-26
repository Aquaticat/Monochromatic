/**
 The real `index.lock` held inside the landing critical section.

 A foreign lock is classified from evidence re-read on every attempt:
 a proven-alive owner gets an unbounded wait,
 and a dead or unproven owner gets Git-style quadratic backoff with jitter up to `indexLock.unprovenOwnerTimeoutMs`
 (see `src/index-lock/index-lock-wait.ts`).
 cli-git never deletes a lock it did not create.

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
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { lockPidPath, } from '../index-lock/index-lock-evidence.ts';
import {
  LOCK_HELD,
  waitForIndexLock,
} from '../index-lock/index-lock-wait.ts';
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

export { lockPidPath, } from '../index-lock/index-lock-evidence.ts';

/**
 Opens the lock exclusively, waiting for a foreign holder under the classification rules.

 @param realIndexPath - real index path

 @param timeoutMs - backoff budget for a dead or unproven owner

 @returns open lock handle

 @throws {@link IndexLockUnprovenOwnerError} when a dead or unproven owner outlasts the budget
 */
async function openLockWaiting({
  realIndexPath,
  timeoutMs,
}: Readonly<{
  realIndexPath: string;
  timeoutMs: number;
}>,): Promise<FileHandle> {
  return await waitForIndexLock({
    realIndexPath,
    timeoutMs,
    consequence: 'landed nothing',
    attempt: async function openExclusive(): Promise<FileHandle | typeof LOCK_HELD> {
      try {
        return await open(
          `${realIndexPath}.lock`,
          constants.O_CREAT | constants.O_EXCL
            | constants.O_RDWR,
          PRIVATE_FILE_MODE,
        );
      }
      catch (error: unknown) {
        if (!(Error.isError(error,) && ('code' in error)
          && (error.code === 'EEXIST')))
          throw error;
        l.debug(`index lock busy: ${error.message}`,);
        return LOCK_HELD;
      }
    },
  },);
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
    if ((await readFile(
      pidPath,
      'utf8',
    )) === `pid ${String(process.pid,)}\n`)
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
      constants.O_CREAT | constants.O_EXCL
        | constants.O_WRONLY,
      PRIVATE_FILE_MODE,
    );
    await handle.writeFile(`pid ${String(process.pid,)}\n`,);
  }
  catch (error: unknown) {
    if (!(Error.isError(error,) && ('code' in error)
      && (error.code === 'EEXIST')))
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

 @throws {@link IndexLockUnprovenOwnerError} when a dead or unproven foreign owner outlasts the budget

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
  const handle = await openLockWaiting({
    realIndexPath,
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
        l.warn(`index lock was not this transaction's at release: ${caughtValueText(error,)}`,);
      }
      await removeOwnPidFile(pidPath,);
    },
  };
}
