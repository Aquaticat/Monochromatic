/**
 Owner evidence for the worktree-copy settlement lock:
 reading the published owner record,
 classifying its owner as live,
 dead,
 or without evidence,
 publishing candidates,
 and retiring or releasing locks by renaming them away.

 The record keeps its `leaseToken` field so wrappers built before this module still read it.
 Liveness goes through {@link ownerLockHolderIsAlive},
 which treats an exited-but-unreaped process and a reused PID as dead.

 @module
 */
import { randomUUID, } from 'node:crypto';
import { constants, } from 'node:fs';
import {
  chmod,
  mkdir,
  open,
  readFile,
  rename,
  rm,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { ownerLockHolderIsAlive, } from '../owner-lock/owner-lock.ts';
import {
  PROCESS_IDENTITY_ABSENT,
  resolveProcessBirthIdentity,
} from '../policy-engine/commit-transaction-process-identity.ts';
import { WorktreeCopyError, } from './errors.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Owner record filename inside a published lock directory.
 */
export const SETTLEMENT_OWNER_FILENAME = 'owner.json';

/**
 Private lock directory mode.
 */
const PRIVATE_DIRECTORY_MODE = 0o700;

/**
 Private lock owner file mode.
 */
const PRIVATE_FILE_MODE = 0o600;

/**
 The published lock vanished or changed during an attempt; attempt again.
 */
export const LOCK_RETRY: unique symbol = Symbol('worktree-copy lock changed during attempt',);

/**
 Durable lock owner identity.
 */
export type LockOwner = Readonly<{
  /**
   Unguessable capability inherited only by descendants of real Git.
   */
  leaseToken: string;
  /**
   Operating-system process identifier.
   */
  ownerPid: number;
  /**
   Process birth identity preventing PID reuse.
   */
  ownerBirthIdentity: string;
  /**
   Lock schema version.
   */
  schemaVersion: 1;
}>;

/**
 A published owner record that proves nothing about its owner.
 */
export type UnprovenOwner = Readonly<{
  /**
   Discriminant.
   */
  kind: 'unproven';
  /**
   Human description of what was found.
   */
  evidence: string;
}>;

/**
 Parses owner record text.

 @param text - owner record text

 @returns validated owner, or the reason it is invalid

 @example
 ```ts
 parseLockOwner('{"schemaVersion":1,"leaseToken":"t","ownerPid":1,"ownerBirthIdentity":"linux:1"}');
 ```
 */
function parseLockOwner(text: string,): LockOwner | string {
  /**
   Parsed owner metadata behind JSON boundary, or the parse failure.
   */
  const value: unknown = (function parse(): unknown {
    try {
      return JSON.parse(text,);
    }
    catch (error: unknown) {
      return new Error(`not JSON (${caughtValueText(error,)})`,);
    }
  })();
  if (Error.isError(value,))
    return value.message;
  if (((typeof value) !== 'object') || (value === null)
    || (!('schemaVersion' in value))
    || (value.schemaVersion !== 1)
    || (!('leaseToken' in value))
    || ((typeof value.leaseToken) !== 'string')
    || (value.leaseToken === '')
    || (!('ownerPid' in value))
    || ((typeof value.ownerPid) !== 'number')
    || (!Number.isSafeInteger(value.ownerPid,))
    || (value.ownerPid < 1)
    || (!('ownerBirthIdentity' in value))
    || ((typeof value.ownerBirthIdentity) !== 'string')
    || (value.ownerBirthIdentity === ''))
    return 'missing or mistyped owner fields';
  return {
    leaseToken: value.leaseToken,
    ownerPid: value.ownerPid,
    ownerBirthIdentity: value.ownerBirthIdentity,
    schemaVersion: 1,
  };
}

/**
 Reads the owner a published lock names.

 @param lockDirectory - published lock directory

 @returns owner, the retry sentinel when the lock vanished, or the evidence of an unreadable record

 @throws unexpected filesystem failures

 @example
 ```ts
 await readPublishedOwner('/repo/.git/cli-git-worktree-copy/v1/settlement.lock');
 ```
 */
export async function readPublishedOwner(
  lockDirectory: string,
): Promise<LockOwner | UnprovenOwner | typeof LOCK_RETRY> {
  /**
   Owner record path.
   */
  const ownerPath = join(
    lockDirectory,
    SETTLEMENT_OWNER_FILENAME,
  );
  /**
   Record text, or the read failure.
   */
  const text = await (async function readText(): Promise<string | Error> {
    try {
      return await readFile(
        ownerPath,
        'utf8',
      );
    }
    catch (error: unknown) {
      if (Error.isError(error,))
        return error;
      throw error;
    }
  })();
  if (Error.isError(text,)) {
    if (('code' in text) && ((text.code === 'ENOENT') || (text.code === 'ENOTDIR')))
      return LOCK_RETRY;
    if (('code' in text) && ((text.code === 'EACCES') || (text.code === 'EISDIR')))
      return {
        kind: 'unproven',
        evidence: `${JSON.stringify(ownerPath,)} is unreadable (${text.code})`,
      };
    throw text;
  }
  /**
   Parsed owner or invalidity reason.
   */
  const owner = parseLockOwner(text,);
  return (typeof owner) === 'string'
    ? {
      kind: 'unproven',
      evidence: `${JSON.stringify(ownerPath,)} holds an invalid owner record: ${owner}`,
    }
    : owner as LockOwner;
}

/**
 Reports whether a recorded owner still runs with the same process birth.

 @param owner - published owner

 @returns whether the owner is alive

 @example
 ```ts
 await lockOwnerIsAlive(owner);
 ```
 */
export function lockOwnerIsAlive(owner: LockOwner,): Promise<boolean> {
  return ownerLockHolderIsAlive({
    schemaVersion: 1,
    token: owner.leaseToken,
    ownerPid: owner.ownerPid,
    ownerBirthIdentity: owner.ownerBirthIdentity,
  },);
}

/**
 Builds the lock owner identity of the current process with a fresh lease token.

 @returns current process owner identity

 @throws {@link WorktreeCopyError} when the process birth identity is unavailable

 @example
 ```ts
 await currentLockOwner();
 ```
 */
export async function currentLockOwner(): Promise<LockOwner> {
  /**
   Current process birth identity.
   */
  const ownerBirthIdentity = await resolveProcessBirthIdentity(process.pid,);
  if (ownerBirthIdentity === PROCESS_IDENTITY_ABSENT)
    throw new WorktreeCopyError('cli-git: current worktree-copy lock owner identity is unavailable.',);
  return {
    leaseToken: randomUUID(),
    ownerPid: process.pid,
    ownerBirthIdentity,
    schemaVersion: 1,
  };
}

/**
 Writes durable owner metadata into an unpublished candidate lock directory.

 @param candidateDirectory - unique candidate lock directory

 @param owner - current process identity

 @example
 ```ts
 await writeCandidateOwner({ candidateDirectory, owner });
 ```
 */
export async function writeCandidateOwner({
  candidateDirectory,
  owner,
}: Readonly<{
  candidateDirectory: string;
  owner: LockOwner;
}>,): Promise<void> {
  try {
    await mkdir(
      candidateDirectory,
      { mode: PRIVATE_DIRECTORY_MODE, },
    );
    await chmod(
      candidateDirectory,
      PRIVATE_DIRECTORY_MODE,
    );
    /**
     Exclusive no-follow owner file handle.
     */
    await using handle = await open(
      join(
        candidateDirectory,
        SETTLEMENT_OWNER_FILENAME,
      ),
      constants.O_CREAT | constants.O_EXCL
        | constants.O_WRONLY
        | constants.O_NOFOLLOW,
      PRIVATE_FILE_MODE,
    );
    await handle.writeFile(
      `${JSON.stringify({
      leaseToken: owner.leaseToken,
      ownerBirthIdentity: owner.ownerBirthIdentity,
      ownerPid: owner.ownerPid,
      schemaVersion: owner.schemaVersion,
    },)}\n`,
      'utf8',
    );
    await handle.sync();
  }
  catch (error: unknown) {
    await rm(
      candidateDirectory,
      {
        recursive: true,
        force: true,
      },
    );
    throw error;
  }
}

/**
 Reports whether a rename failed because another directory already holds the name.

 @param error - unknown rename failure

 @returns whether another lock occupies the published name

 @example
 ```ts
 isExistingLockError(error);
 ```
 */
export function isExistingLockError(error: unknown,): boolean {
  return Error.isError(error,) && ('code' in error)
    && ((error.code === 'EEXIST') || (error.code === 'ENOTEMPTY'));
}

/**
 Renames a published lock away when it still names the expected owner, then deletes it.
 Renaming frees the published name atomically,
 so a concurrent acquirer's publication can never be emptied and deleted in place;
 a replacement moved by a race is renamed back.

 @param lockDirectory - published lock directory

 @param leaseToken - token of the owner being retired or released

 @returns whether the expected owner's lock was removed

 @example
 ```ts
 await removeLockOf({ lockDirectory, leaseToken: owner.leaseToken });
 ```
 */
export async function removeLockOf({
  lockDirectory,
  leaseToken,
}: Readonly<{
  lockDirectory: string;
  leaseToken: string;
}>,): Promise<boolean> {
  /**
   Tagged removal logger.
   */
  const rl = tagged({
    tag: removeLockOf.name,
    l,
  },);
  /**
   Owner published now.
   */
  const current = await readPublishedOwner(lockDirectory,);
  if ((current === LOCK_RETRY) || ('kind' in current)
    || (current.leaseToken !== leaseToken))
    return false;
  /**
   Unique retired name owned only after a successful rename.
   */
  const retiredDirectory = `${lockDirectory}.${randomUUID()}.stale`;
  try {
    await rename(
      lockDirectory,
      retiredDirectory,
    );
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT'))
      return false;
    throw error;
  }
  /**
   Owner of the directory actually moved.
   */
  const moved = await readPublishedOwner(retiredDirectory,);
  if ((moved === LOCK_RETRY) || ('kind' in moved)
    || (moved.leaseToken !== leaseToken)) {
    rl.warn(`a replacement of ${lockDirectory} was moved by a race; restoring it`,);
    try {
      await rename(
        retiredDirectory,
        lockDirectory,
      );
    }
    catch (error: unknown) {
      if (!isExistingLockError(error,))
        throw error;
      rl.warn(`could not restore ${lockDirectory}: ${caughtValueText(error,)}`,);
    }
    return false;
  }
  await rm(
    retiredDirectory,
    {
      recursive: true,
      force: true,
    },
  );
  return true;
}
