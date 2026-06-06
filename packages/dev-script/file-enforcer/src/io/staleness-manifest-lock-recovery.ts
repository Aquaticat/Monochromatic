import {
  rmSync,
  statSync,
} from 'node:fs';

import { caughtErrorHasCode, } from './staleness-manifest-error.ts';
import { lockOwnerState, } from './staleness-manifest-lock-owner.ts';

//region Stale lock recovery constants

/**
 * Age after which directory lock is considered abandoned.
 */
const LOCK_STALE_AFTER_MS = 60_000;

//endregion Stale lock recovery constants

/**
 * Sentinel for lock directory disappearing during recovery checks.
 */
const ABSENT_LOCK_DIRECTORY_AGE: unique symbol = Symbol('file-enforcer/io/staleness-manifest-lock-recovery: absent lock directory age',);

/**
 * Result of reading lock directory age.
 */
type LockDirectoryAge = number | typeof ABSENT_LOCK_DIRECTORY_AGE;

//region Stale lock recovery helpers

/**
 * Returns age of existing lock directory in milliseconds.
 *
 * @param lockPath - Lock directory path.
 *
 * @returns Lock directory age, or absence sentinel when directory disappeared.
 *
 * @throws When lock metadata cannot be read for a reason other than absence.
 *
 * @example
 * ```ts
 * const age = lockDirectoryAgeMs('/tmp/manifest.json.lock');
 * ```
 */
function lockDirectoryAgeMs(lockPath: string,): LockDirectoryAge {
  try {
    /**
     * Filesystem metadata for existing lock directory.
     */
    const lockStat = statSync(lockPath,);
    return Date.now() - lockStat.mtimeMs;
  }
  catch (statError: unknown) {
    if (caughtErrorHasCode({
      error: statError,
      code: 'ENOENT',
    },))
      return ABSENT_LOCK_DIRECTORY_AGE;

    throw statError;
  }
}

/**
 * Returns whether existing lock directory is safe to reclaim.
 *
 * @param lockPath - Lock directory path.
 *
 * @returns Whether lock should be removed before retrying acquisition.
 *
 * @example
 * ```ts
 * const stale = lockDirectoryIsRecoverable('/tmp/manifest.json.lock');
 * ```
 */
function lockDirectoryIsRecoverable(lockPath: string,): boolean {
  /**
   * Liveness state reported by lock owner metadata.
   */
  const ownerState = lockOwnerState(lockPath,);
  if (ownerState === 'dead')
    return true;
  if (ownerState === 'live')
    return false;

  /**
   * Lock age from directory metadata.
   */
  const ageMs = lockDirectoryAgeMs(lockPath,);
  if (ageMs === ABSENT_LOCK_DIRECTORY_AGE)
    return true;

  return ageMs >= LOCK_STALE_AFTER_MS;
}

/**
 * Removes stale lock directory when it is safe to reclaim.
 *
 * @param lockPath - Lock directory path.
 *
 * @returns Whether acquisition should retry immediately.
 *
 * @example
 * ```ts
 * const retry = recoverStaleManifestLock('/tmp/manifest.json.lock');
 * ```
 */
export function recoverStaleManifestLock(lockPath: string,): boolean {
  if (!lockDirectoryIsRecoverable(lockPath,))
    return false;
  rmSync(
    lockPath,
    {
      recursive: true,
      force: true,
    },
  );
  return true;
}

//endregion Stale lock recovery helpers
