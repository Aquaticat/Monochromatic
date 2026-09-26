/**
 Worktree-copy settlement lock acquisition by owner evidence.

 - A proven-live owner is waited for without a time limit,
   after one stderr line naming it.
 - A dead owner's lock is retired after re-reading that it still names that owner.
 - An owner record that proves nothing gets Git's jittered quadratic backoff
   up to {@link UNPROVEN_OWNER_TIMEOUT_MS},
   then a diagnostic listing the evidence;
   the lock stays in place.

 @module
 */
import { randomUUID, } from 'node:crypto';
import {
  rename,
  rm,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  type BackoffState,
  INITIAL_BACKOFF,
  jitteredWait,
  nextBackoff,
} from '../index-lock/index-lock-wait.ts';
import { WorktreeCopyError, } from './errors.ts';
import { ensureWorktreeCopyJournalRoot, } from './journal.ts';
import {
  currentLockOwner,
  isExistingLockError,
  LOCK_RETRY,
  type LockOwner,
  lockOwnerIsAlive,
  readPublishedOwner,
  removeLockOf,
  type UnprovenOwner,
  writeCandidateOwner,
} from './journal-lock-owner.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Time spent without a proven owner before acquisition fails,
 matching the concurrent-commit decision's default for evidence-free lock owners.
 */
export const UNPROVEN_OWNER_TIMEOUT_MS = 1_000;

/**
 Delay between read-only owner checks while a live owner holds the lock.
 */
const LIVE_OWNER_POLL_MS = 20;

/**
 Inherited environment capability for reentrant same-repository Git calls.
 */
export const WORKTREE_COPY_LEASE_ENV = 'CLI_GIT_WORKTREE_COPY_LEASE';

/**
 Returned by {@link tryAcquireWorktreeCopyLock} while another process holds settlement.
 */
export const WORKTREE_COPY_LOCK_HELD: unique symbol = Symbol('worktree-copy lock held by another process',);

/**
 Attempts {@link tryAcquireWorktreeCopyLock} makes while the lock keeps changing under it.
 */
const TRY_LOCK_ATTEMPTS = 10;

/**
 Ownership-checking lock and descendant reentrancy capability.
 */
export type WorktreeCopyLease = AsyncDisposable & Readonly<{
  /**
   Capability passed only to real-Git descendants.
   */
  leaseToken: string;
}>;

/**
 Result of one publication attempt.
 */
type AttemptResult =
  | Readonly<{
    /**
     Discriminant.
     */
    kind: 'acquired';
    /**
     Held lock.
     */
    lease: WorktreeCopyLease;
  }>
  | Readonly<{
    /**
     Discriminant.
     */
    kind: 'live';
    /**
     Proven-live owner.
     */
    owner: LockOwner;
  }>
  | Readonly<{
    /**
     Discriminant: the lock vanished, changed, or a dead owner's lock was just retired.
     */
    kind: 'retry';
  }>
  | UnprovenOwner;

/**
 Mutable state of one stretch of attempts without a proven owner.
 */
type EvidenceFreeStretch = {
  /**
   Whether a stretch is running.
   */
  active: boolean;
  /**
   Epoch milliseconds when the stretch began.
   */
  since: number;
  /**
   Next backoff position.
   */
  backoff: BackoffState;
};

/**
 Creates the ownership-checking disposable for a published lock.

 @param lockDirectory - exact published lock directory

 @param owner - identity published in lock

 @returns disposable exclusive lock

 @example
 ```ts
 ownedLock({ lockDirectory, owner });
 ```
 */
function ownedLock({
  lockDirectory,
  owner,
}: Readonly<{
  lockDirectory: string;
  owner: LockOwner;
}>,): WorktreeCopyLease {
  return {
    leaseToken: owner.leaseToken,
    async [Symbol.asyncDispose](): Promise<void> {
      if (!(await removeLockOf({
        lockDirectory,
        leaseToken: owner.leaseToken,
      },))) {
        throw new WorktreeCopyError(
          `cli-git: worktree-copy lock ownership changed: ${JSON.stringify(lockDirectory,)}.`,
        );
      }
    },
  };
}

/**
 Attempts one atomic lock publication and classifies the owner that blocks it.

 @param lockDirectory - exact published lock directory

 @param owner - current process identity

 @returns held lock, live owner, retry, or unproven evidence

 @example
 ```ts
 await attemptAcquire({ lockDirectory, owner });
 ```
 */
async function attemptAcquire({
  lockDirectory,
  owner,
}: Readonly<{
  lockDirectory: string;
  owner: LockOwner;
}>,): Promise<AttemptResult> {
  /**
   Unpublished complete lock candidate.
   */
  const candidateDirectory = `${lockDirectory}.${randomUUID()}.pending`;
  await writeCandidateOwner({
    candidateDirectory,
    owner,
  },);
  try {
    await rename(
      candidateDirectory,
      lockDirectory,
    );
    return {
      kind: 'acquired',
      lease: ownedLock({
        lockDirectory,
        owner,
      },),
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
    if (!isExistingLockError(error,))
      throw error;
  }
  /**
   Owner of the blocking lock.
   */
  const published = await readPublishedOwner(lockDirectory,);
  if (published === LOCK_RETRY)
    return { kind: 'retry', };
  if ('kind' in published)
    return published;
  if (await lockOwnerIsAlive(published,))
    return {
      kind: 'live',
      owner: published,
    };
  l.debug(`worktree-copy lock owner PID ${String(published.ownerPid,)} is dead; retiring its lock`,);
  await removeLockOf({
    lockDirectory,
    leaseToken: published.leaseToken,
  },);
  return { kind: 'retry', };
}

/**
 Waits, reading only, until a live owner no longer holds the lock:
 it released or replaced the lock,
 or it died.

 @param lockDirectory - published lock directory

 @param owner - proven-live owner

 @example
 ```ts
 await waitWhileOwnerLives({ lockDirectory, owner });
 ```
 */
async function waitWhileOwnerLives({
  lockDirectory,
  owner,
}: Readonly<{
  lockDirectory: string;
  owner: LockOwner;
}>,): Promise<void> {
  // The wait has no time limit by contract while the owner lives; every iteration returns or sleeps.
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop -- delay prevents spinning against a live owner
    await wait(LIVE_OWNER_POLL_MS,);
    /* oxlint-disable no-await-in-loop -- each check observes the owner after the previous delay */
    /**
     Owner published now.
     */
    const current = await readPublishedOwner(lockDirectory,);
    /* oxlint-enable no-await-in-loop */
    if ((current === LOCK_RETRY) || ('kind' in current)
      || (current.leaseToken !== owner.leaseToken))
      return;
    // oxlint-disable-next-line no-await-in-loop -- liveness is rechecked after every delay
    if (!(await lockOwnerIsAlive(current,)))
      return;
  }
}

/**
 Renders the one stderr line naming a live holder.

 @param lockDirectory - published lock directory

 @param owner - proven-live owner

 @returns line ending in LF

 @example
 ```ts
 liveHolderLine({ lockDirectory, owner });
 ```
 */
function liveHolderLine({
  lockDirectory,
  owner,
}: Readonly<{
  lockDirectory: string;
  owner: LockOwner;
}>,): string {
  return `cli-git: waiting for PID ${String(owner.ownerPid,)}, which holds worktree-copy settlement ${JSON.stringify(lockDirectory,)} (proven by its live process identity); cli-git waits until it releases the lock.\n`;
}

/**
 Validates inherited reentrancy capability against live repository lock.

 @param commonDir - canonical common Git directory

 @param leaseToken - environment capability inherited from parent real Git

 @returns whether current invocation belongs to active outer settlement

 @example
 ```ts
 await validatesInheritedWorktreeCopyLease({ commonDir: '/repo/.git', leaseToken: process.env.CLI_GIT_WORKTREE_COPY_LEASE });
 ```
 */
export async function validatesInheritedWorktreeCopyLease({
  commonDir,
  leaseToken,
}: Readonly<{
  commonDir: string;
  leaseToken: string;
}>,): Promise<boolean> {
  if (leaseToken.length === 0)
    return false;
  /**
   Published outer owner, replacement-race sentinel, or unproven record.
   */
  const owner = await readPublishedOwner(join(
    await ensureWorktreeCopyJournalRoot(commonDir,),
    'settlement.lock',
  ),);
  if ((owner === LOCK_RETRY) || ('kind' in owner)
    || (owner.leaseToken !== leaseToken))
    return false;
  return lockOwnerIsAlive(owner,);
}

/**
 Acquires the worktree-copy settlement lock by owner evidence.
 A proven-live owner is waited for without a time limit;
 a dead owner's lock is retired;
 an owner without evidence is waited for until {@link UNPROVEN_OWNER_TIMEOUT_MS}.

 @param commonDir - canonical common Git directory

 @returns ownership-checking disposable lock

 @throws {@link WorktreeCopyError} when no owner could be proven alive or dead within the bounded wait

 @example
 ```ts
 await using lock = await acquireWorktreeCopyLock('/repo/.git');
 ```
 */
export async function acquireWorktreeCopyLock(
  commonDir: string,
): Promise<WorktreeCopyLease> {
  /**
   Exact repository-wide settlement lock.
   */
  const lockDirectory = join(
    await ensureWorktreeCopyJournalRoot(commonDir,),
    'settlement.lock',
  );
  /**
   Complete current lock owner.
   */
  const owner = await currentLockOwner();
  /**
   Holders already named on stderr, by lease token.
   */
  const named = new Set<string>();
  /**
   Current stretch without a proven owner: whether one is running, when it began, and its backoff position.
   */
  const unproven: EvidenceFreeStretch = {
    active: false,
    since: 0,
    backoff: INITIAL_BACKOFF,
  };
  // Ends by acquisition or by the bounded evidence-free wait; a live owner is waited for without a limit.
  for (;;) {
    /* oxlint-disable no-await-in-loop -- every attempt observes the previous owner's state */
    /**
     Current attempt result.
     */
    const result = await attemptAcquire({
      lockDirectory,
      owner,
    },);
    /* oxlint-enable no-await-in-loop */
    if (result.kind === 'acquired')
      return result.lease;
    if (result.kind === 'live') {
      unproven.active = false;
      if (!named.has(result.owner
        .leaseToken,)) {
        named.add(result.owner
          .leaseToken,);
        process.stderr
          .write(liveHolderLine({
            lockDirectory,
            owner: result.owner,
          },),);
      }
      // oxlint-disable-next-line no-await-in-loop -- the next attempt must follow the owner's release
      await waitWhileOwnerLives({
        lockDirectory,
        owner: result.owner,
      },);
      continue;
    }
    if (!unproven.active) {
      unproven.active = true;
      unproven.since = Date.now();
      unproven.backoff = INITIAL_BACKOFF;
    }
    if ((result.kind === 'unproven') && ((Date.now() - unproven.since) >= UNPROVEN_OWNER_TIMEOUT_MS)) {
      throw new WorktreeCopyError(
        `cli-git: worktree-copy settlement lock ${JSON.stringify(lockDirectory,)} stayed in place for ${String(UNPROVEN_OWNER_TIMEOUT_MS,)} ms and cli-git could not prove whether its owner is alive. Evidence: ${result.evidence}. cli-git left the lock in place; remove it only after confirming no cli-git process is using this repository.`,
      );
    }
    /**
     Backoff position for this wait.
     */
    const {backoff} = unproven;
    unproven.backoff = nextBackoff(backoff,);
    // oxlint-disable-next-line no-await-in-loop -- Git-style backoff separates evidence-free attempts
    await wait(jitteredWait({
      state: backoff,
      random: Math.random(),
    },),);
  }
}

/**
 Acquires the settlement lock unless another process holds it, without waiting for that holder.
 A dead owner is retired and a lock that changes during an attempt is attempted again, a bounded number of times;
 a live or unproven holder returns the held sentinel.

 @param commonDir - canonical common Git directory

 @returns ownership-checking disposable lock, or the held sentinel

 @throws {@link WorktreeCopyError} when the lock keeps changing through every attempt

 @example
 ```ts
 const lease = await tryAcquireWorktreeCopyLock('/repo/.git');
 ```
 */
export async function tryAcquireWorktreeCopyLock(
  commonDir: string,
): Promise<WorktreeCopyLease | typeof WORKTREE_COPY_LOCK_HELD> {
  /**
   Exact repository-wide settlement lock.
   */
  const lockDirectory = join(
    await ensureWorktreeCopyJournalRoot(commonDir,),
    'settlement.lock',
  );
  /**
   Complete current lock owner.
   */
  const owner = await currentLockOwner();
  for (const _attempt of Array.from({ length: TRY_LOCK_ATTEMPTS, },)) {
    /* oxlint-disable no-await-in-loop -- a retried attempt must follow the retirement or race it observed */
    /**
     Current attempt result.
     */
    const result = await attemptAcquire({
      lockDirectory,
      owner,
    },);
    /* oxlint-enable no-await-in-loop */
    if (result.kind === 'acquired')
      return result.lease;
    if (result.kind === 'unproven')
      l.debug(`worktree-copy lock owner is unproven: ${result.evidence}`,);
    if (result.kind !== 'retry')
      return WORKTREE_COPY_LOCK_HELD;
  }
  throw new WorktreeCopyError(
    `cli-git: worktree-copy settlement lock under ${JSON.stringify(commonDir,)} kept changing while it was acquired.`,
  );
}
