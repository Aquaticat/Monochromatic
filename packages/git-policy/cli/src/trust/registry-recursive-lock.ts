/**
 * Recoverable registry-wide recursive-operation lease. @module
 */
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  mkdir,
  readFile,
  rename,
  rm,
} from 'node:fs/promises';
import { join, } from 'node:path';
import {
  DIRECTORY_MODE,
  ensureRegistryRoot,
  protectPath,
  syncDirectory,
  TrustStorageError,
  writePrivateFile,
} from './registry-io.ts';

/**
 * Lock acquisition retry delay in milliseconds.
 */
const LOCK_RETRY_DELAY_MS = 10;
/**
 * Bounded lock acquisition attempts.
 */
const LOCK_RETRY_ATTEMPTS = 100;
/**
 * Existing live owner currently holds lock.
 */
const RECURSIVE_LOCK_BUSY: unique symbol = Symbol('RECURSIVE_OPERATION lock is held by live process',);
/**
 * Recursive registry lock owner metadata.
 */
type RecursiveLockOwner = Readonly<{
  /**
   * Lock schema.
   */
  schemaVersion: 1;
  /**
   * Owning operating-system process.
   */
  ownerPid: number;
}>;

/**
 * Reports whether owner process still exists.
 *
 * @param ownerPid - recorded process ID
 *
 * @returns whether process remains alive
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
    return !(Error.isError(error,) && ('code' in error)
      && (error.code === 'ESRCH'));
  }
}

/**
 * Reads validated lock owner.
 *
 * @param ownerPath - private owner metadata path
 *
 * @returns validated owner
 */
async function readOwner(ownerPath: string,): Promise<RecursiveLockOwner> {
  /**
   * Parsed owner metadata behind unknown boundary.
   */
  const value: unknown = JSON.parse(await readFile(
    ownerPath,
    'utf8',
  ),);
  if (((typeof value) !== 'object') || (value === null)
    || (!('schemaVersion' in value))
    || (value.schemaVersion !== 1)
    || (!('ownerPid' in value))
    || ((typeof value.ownerPid) !== 'number')
    || (!Number.isInteger(value.ownerPid))
    || (value.ownerPid < 1))
    throw new TrustStorageError('Recursive operation lock owner is invalid.',);
  return {
    schemaVersion: 1,
    ownerPid: value.ownerPid,
  };
}

/**
 * Creates owner metadata and disposable cleanup for created lock directory.
 *
 * @param lockDirectory - exact lock directory
 *
 * @returns disposable lock
 */
async function initializeLock(lockDirectory: string,): Promise<AsyncDisposable> {
  await protectPath({
    path: lockDirectory,
    directory: true,
  },);
  /**
   * Private owner metadata installed only after complete write and fsync.
   */
  const ownerPath = join(
    lockDirectory,
    'owner.json',
  );
  /**
   * Private sibling hidden from lock readers during owner initialization.
   */
  const pendingOwnerPath = join(
    lockDirectory,
    'owner.pending',
  );
  await writePrivateFile({
    path: pendingOwnerPath,
    bytes: Buffer.from(
      `${JSON.stringify({
        schemaVersion: 1,
        ownerPid: process.pid,
      },)}\n`,
      'utf8',
    ),
  },);
  await rename(
    pendingOwnerPath,
    ownerPath,
  );
  await syncDirectory(lockDirectory,);
  return {
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        lockDirectory,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Attempts one acquisition and recovers dead owner.
 *
 * @param lockDirectory - exact recursive lock directory
 *
 * @returns disposable lock or busy sentinel
 */
async function attemptAcquire(lockDirectory: string,): Promise<AsyncDisposable | typeof RECURSIVE_LOCK_BUSY> {
  try {
    await mkdir(
      lockDirectory,
      { mode: DIRECTORY_MODE, },
    );
  }
  catch (error: unknown) {
    try {
      /**
       * Existing lock owner metadata.
       */
      const owner = await readOwner(join(
        lockDirectory,
        'owner.json',
      ),);
      if (processExists(owner.ownerPid))
        return RECURSIVE_LOCK_BUSY;
    }
    catch (ownerError: unknown) {
      if (Error.isError(ownerError,) && ('code' in ownerError)
        && (ownerError.code === 'ENOENT'))
        return RECURSIVE_LOCK_BUSY;
      throw ownerError;
    }
    await rm(
      lockDirectory,
      {
        recursive: true,
        force: true,
      },
    );
    return RECURSIVE_LOCK_BUSY;
  }
  try {
    return await initializeLock(lockDirectory,);
  }
  catch (error: unknown) {
    await rm(
      lockDirectory,
      {
        recursive: true,
        force: true,
      },
    );
    throw error;
  }
}

/**
 * Acquires recoverable registry-wide recursive-operation lease.
 *
 * @param registryRoot - complete registry root
 *
 * @returns disposable exclusive lock
 *
 * @example
 * ```ts
 * await using lock = await acquireRecursiveRegistryLock({ registryRoot });
 * ```
 */
export async function acquireRecursiveRegistryLock({
  registryRoot,
}: Readonly<{
  registryRoot: string;
}>,): Promise<AsyncDisposable> {
  await ensureRegistryRoot(registryRoot,);
  /**
   * Exact registry-wide recursive operation lock.
   */
  const lockDirectory = join(
    registryRoot,
    'recursive-operation.lock',
  );
  /**
   * Serialized bounded acquisition attempts.
   */
  const result = await Array.from({ length: LOCK_RETRY_ATTEMPTS, },)
    .reduce<Promise<AsyncDisposable | typeof RECURSIVE_LOCK_BUSY>>(
      async function retryAfter(previous,) {
        /**
         * Prior successful lock or busy sentinel.
         */
        const prior = await previous;
        if (prior !== RECURSIVE_LOCK_BUSY)
          return prior;
        await wait(LOCK_RETRY_DELAY_MS,);
        return await attemptAcquire(lockDirectory,);
      },
      Promise.resolve(RECURSIVE_LOCK_BUSY,),
    );
  if (result !== RECURSIVE_LOCK_BUSY)
    return result;
  throw new TrustStorageError('Timed out waiting for recursive trust enrollment or revocation lock.',);
}
