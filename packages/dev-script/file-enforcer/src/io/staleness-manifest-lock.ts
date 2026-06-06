import {
  mkdirSync,
  rmSync,
} from 'node:fs';
import { dirname, } from 'node:path';

import { recoverStaleManifestLock, } from './staleness-manifest-lock-recovery.ts';
import { writeLockOwner, } from './staleness-manifest-lock-owner.ts';
import {
  caughtErrorHasCode,
  StalenessManifestPersistenceError,
} from './staleness-manifest-error.ts';

//region Locking and synchronous sleep constants

/**
 * Suffix appended to manifest path for directory locks.
 */
const LOCK_DIRECTORY_SUFFIX = '.lock';

/**
 * Poll delay while waiting for another process to release manifest lock.
 */
const LOCK_RETRY_MS = 10;

/**
 * Maximum time to wait for another process to release manifest lock.
 */
const LOCK_TIMEOUT_MS = 5_000;

/**
 * Length of synchronous sleep buffer.
 */
const SLEEP_BUFFER_LENGTH = 1;

/**
 * Index used for synchronous Atomics wait.
 */
const SLEEP_WAIT_INDEX = 0;

/**
 * Expected value used for synchronous Atomics wait.
 */
const SLEEP_EXPECTED_VALUE = 0;

/**
 * Shared buffer backing synchronous lock-poll sleeps.
 */
const sleepBuffer = new SharedArrayBuffer(
  Int32Array.BYTES_PER_ELEMENT * SLEEP_BUFFER_LENGTH,
);

/**
 * Int32 view used by Atomics.wait for short synchronous sleeps.
 */
const sleepArray = new Int32Array(sleepBuffer,);

//endregion Locking and synchronous sleep constants

//region Lock acquisition helpers

/**
 * Sleeps synchronously while polling manifest lock.
 *
 * @param durationMs - Sleep duration in milliseconds.
 *
 * @example
 * ```ts
 * sleepSync({ durationMs: LOCK_RETRY_MS });
 * ```
 */
function sleepSync({ durationMs, }: { readonly durationMs: number; },): void {
  Atomics.wait(
    sleepArray,
    SLEEP_WAIT_INDEX,
    SLEEP_EXPECTED_VALUE,
    durationMs,
  );
}

/**
 * Removes lock directory if owner metadata cannot be written.
 *
 * @param lockPath - Lock directory path.
 *
 * @param ownerError - Error thrown while writing owner metadata.
 *
 * @throws Always rethrows `ownerError` after cleanup.
 *
 * @example
 * ```ts
 * cleanupFailedOwnerWrite({ lockPath, ownerError });
 * ```
 */
function cleanupFailedOwnerWrite(
  {
    lockPath,
    ownerError,
  }: {
    readonly lockPath: string;
    readonly ownerError: unknown;
  },
): never {
  rmSync(
    lockPath,
    {
      recursive: true,
      force: true,
    },
  );
  throw ownerError;
}

/**
 * Records lock owner metadata after directory acquisition.
 *
 * @param lockPath - Lock directory path.
 *
 * @example
 * ```ts
 * recordLockOwner('/tmp/manifest.json.lock');
 * ```
 */
function recordLockOwner(lockPath: string,): void {
  try {
    writeLockOwner(lockPath,);
  }
  catch (ownerError: unknown) {
    cleanupFailedOwnerWrite({
      lockPath,
      ownerError,
    },);
  }
}

/**
 * Returns disposable handle that releases lock directory.
 *
 * @param lockPath - Lock directory path.
 *
 * @returns Disposable release handle.
 *
 * @example
 * ```ts
 * using lock = lockReleaseHandle('/tmp/manifest.json.lock');
 * ```
 */
function lockReleaseHandle(lockPath: string,): Disposable {
  return {
    [Symbol.dispose](): void {
      rmSync(
        lockPath,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

//endregion Lock acquisition helpers

//region Lock acquisition

/**
 * Acquires manifest directory lock and returns disposable release handle.
 *
 * @param manifestPath - Absolute manifest path whose lock should be held.
 *
 * @returns Disposable lock release handle.
 *
 * @throws When lock cannot be acquired before timeout.
 *
 * @example
 * ```ts
 * using lock = acquireManifestLock('/tmp/manifest.json');
 * ```
 */
export function acquireManifestLock(manifestPath: string,): Disposable {
  mkdirSync(
    dirname(manifestPath,),
    { recursive: true, },
  );
  /**
   * Directory path used as inter-process lock.
   */
  const lockPath = `${manifestPath}${LOCK_DIRECTORY_SUFFIX}`;
  /**
   * Last timestamp at which lock acquisition may keep retrying.
   */
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (true) {
    try {
      mkdirSync(lockPath,);
      recordLockOwner(lockPath,);
      return lockReleaseHandle(lockPath,);
    }
    catch (lockError: unknown) {
      if (!caughtErrorHasCode({
        error: lockError,
        code: 'EEXIST',
      },))
        throw lockError;
      if (recoverStaleManifestLock(lockPath,))
        continue;
      if (Date.now() > deadline) {
        throw new StalenessManifestPersistenceError(
          `Timed out waiting for staleness manifest lock ${lockPath}`,
          { cause: lockError, },
        );
      }
      sleepSync({ durationMs: LOCK_RETRY_MS, },);
    }
  }
}

//endregion Lock acquisition
