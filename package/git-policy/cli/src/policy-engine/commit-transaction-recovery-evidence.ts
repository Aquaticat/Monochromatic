/**
 Durable evidence a dead transaction left: numbered records, owned locks, and PID files.

 @module
 */
import {
  lstat,
  readdir,
  readFile,
  rm,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { isMissingPath, } from '../trust/registry-io.ts';
import { parseIndexLockRecord, } from './commit-transaction-journal-parse.ts';
import type { LockIdentity, } from './commit-transaction-journal-states.ts';
import { lockPidPath, } from './commit-landing-index-lock.ts';
import {
  readRegularRecoveryFile,
  releaseOwnedLock,
} from './commit-transaction-recovery-files.ts';
import type { OwnedLockIdentity, } from './commit-transaction-recovery-validation.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Record filename prefixes and suffix of numbered attempt records.
 */
export const LANDING_RECORD_PREFIX = 'landing-';

/**
 Index lock record filename prefix.
 */
export const INDEX_LOCK_RECORD_PREFIX = 'index-lock-';

/**
 Numbered record suffix.
 */
export const RECORD_SUFFIX = '.json';

/**
 Converts a recorded lock identity to the owned-lock shape recovery files check.

 @param lock - recorded identity

 @returns owned-lock identity

 @example
 ```ts
 ownedLock({ device: '1', inode: '2', fsId: 'fs' });
 ```
 */
export function ownedLock(lock: LockIdentity,): OwnedLockIdentity {
  return {
    lockDevice: lock.device,
    lockInode: lock.inode,
    lockFsId: lock.fsId,
  };
}

/**
 Lists attempt numbers of one numbered record kind.

 @param names - transaction directory entries

 @param prefix - record filename prefix

 @returns ascending attempt numbers

 @example
 ```ts
 attemptNumbers({ names: ['landing-2.json', 'landing-1.json'], prefix: 'landing-' }); // [1, 2]
 ```
 */
export function attemptNumbers({
  names,
  prefix,
}: Readonly<{
  names: readonly string[];
  prefix: string;
}>,): readonly number[] {
  return names
    .filter(function isRecord(name,): boolean {
      return name.startsWith(prefix,) && name.endsWith(RECORD_SUFFIX,);
    },)
    .map(function attemptOf(name,): number {
      return Number(name.slice(
        prefix.length,
        -RECORD_SUFFIX.length,
      ),);
    },)
    .filter(function isAttempt(attempt,): boolean {
      return Number.isSafeInteger(attempt,) && (attempt > 0);
    },)
    .toSorted(function ascending(
      left,
      right,
    ): number {
      return left - right;
    },);
}

/**
 Reports whether a transaction directory holds a landing record.

 @param directory - transaction directory

 @returns whether any `landing-<n>.json` exists

 @example
 ```ts
 await hasLandingRecord('/repo/.git/cli-git-transactions/id');
 ```
 */
export async function hasLandingRecord(directory: string,): Promise<boolean> {
  return attemptNumbers({
    names: await readdir(directory,),
    prefix: LANDING_RECORD_PREFIX,
  },)
    .length
    > 0;
}

/**
 Removes the dead owner's PID file beside the real index lock when it still names that owner.

 @param realIndexPath - real index path

 @param ownerPid - dead owner PID

 @example
 ```ts
 await removeDeadPidFile({ realIndexPath: '/repo/.git/index', ownerPid: 123 });
 ```
 */
export async function removeDeadPidFile({
  realIndexPath,
  ownerPid,
}: Readonly<{
  realIndexPath: string;
  ownerPid: number;
}>,): Promise<void> {
  /**
   Git's PID file path.
   */
  const pidPath = lockPidPath(realIndexPath,);
  try {
    if ((await readFile(
      pidPath,
      'utf8',
    )) === `pid ${String(ownerPid,)}\n`)
      await rm(pidPath,);
  }
  catch (error: unknown) {
    if (!isMissingPath(error,))
      throw error;
  }
}

/**
 Releases every real `index.lock` the transaction's lock records prove it created.

 @param directory - transaction directory

 @param names - directory entries

 @param realIndexPath - real index path

 @param ownerPid - dead owner PID

 @example
 ```ts
 await releaseRecordedLocks({ directory, names, realIndexPath: '/repo/.git/index', ownerPid: 123 });
 ```
 */
export async function releaseRecordedLocks({
  directory,
  names,
  realIndexPath,
  ownerPid,
}: Readonly<{
  directory: string;
  names: readonly string[];
  realIndexPath: string;
  ownerPid: number;
}>,): Promise<void> {
  /**
   Tagged lock release logger.
   */
  const rl = tagged({
    tag: releaseRecordedLocks.name,
    l,
  },);
  for (const attempt of attemptNumbers({
    names,
    prefix: INDEX_LOCK_RECORD_PREFIX,
  },)) {
    /**
     Record bytes of one attempt.
     */
    // oxlint-disable-next-line no-await-in-loop -- Attempts are checked in order against the one lock path.
    const bytes = await readRegularRecoveryFile(join(
      directory,
      `${INDEX_LOCK_RECORD_PREFIX}${String(attempt,)}${RECORD_SUFFIX}`,
    ),);
    /**
     What happened to the recorded lock.
     */
    // oxlint-disable-next-line no-await-in-loop -- Attempts are checked in order against the one lock path.
    const release = await releaseOwnedLock({
      journal: ownedLock(parseIndexLockRecord(bytes,)
        .lock,),
      lockPath: `${realIndexPath}.lock`,
    },);
    rl.debug(`attempt ${String(attempt,)} lock ${release}`,);
  }
  await removeDeadPidFile({
    realIndexPath,
    ownerPid,
  },);
}


/**
 Reports whether a path exists without following a final link.

 @param path - candidate path

 @returns existence

 @example
 ```ts
 await pathPresent('/repo/.git/cli-git/shadow/id');
 ```
 */
export async function pathPresent(path: string,): Promise<boolean> {
  try {
    await lstat(path,);
    return true;
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return false;
    throw error;
  }
}
