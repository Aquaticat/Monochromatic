/**
 Registry-wide recursive-operation lock.

 The lock is an owner-lock directory (`src/owner-lock/owner-lock.ts`):
 a complete candidate carrying the owner's PID and process-birth identity,
 hardened to registry permissions,
 is published by rename,
 so a published lock always names its owner.
 A waiter polls without a time limit while the owner is proven alive,
 retires a dead owner's lock after re-reading it,
 and backs off within {@link UNPROVEN_OWNER_TIMEOUT_MS} only while nothing proves the owner alive or dead.

 @module
 */
import { join, } from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  type BackoffState,
  INITIAL_BACKOFF,
  jitteredWait,
  nextBackoff,
} from '../index-lock/index-lock-wait.ts';
import {
  LOCK_BUSY,
  type OwnerLock,
  type OwnerLockCandidate,
  OwnerLockError,
  tryAcquireOwnerLock,
} from '../owner-lock/owner-lock.ts';
import {
  ensureRegistryRoot,
  protectPath,
  syncDirectory,
  TrustStorageError,
} from './registry-io.ts';
import {
  observeRecursiveLock,
  type RecursiveLockObservation,
  retireLegacyRecursiveLock,
} from './registry-recursive-lock-owner.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Lock directory name inside the registry root.
 */
const RECURSIVE_LOCK_NAME = 'recursive-operation.lock';

/**
 Time spent without a proven owner before acquisition fails,
 matching the default `indexLock.unprovenOwnerTimeoutMs` and the earlier fixed budget.
 */
export const UNPROVEN_OWNER_TIMEOUT_MS = 1_000;

/**
 Longest single poll of a live owner, so its release is noticed promptly after the backoff grew.
 */
const LIVE_OWNER_POLL_CAP_MS = 100;

/**
 No live owner has been reported yet; process IDs start at 1.
 */
const NO_OWNER_REPORTED = 0;

/**
 Hardens an unpublished candidate exactly as the registry protects its own entries:
 private modes on POSIX,
 a verified protected ACL on Windows,
 and durable directory metadata.

 @param directory - unpublished candidate directory

 @param recordPath - complete owner record inside the candidate
 */
async function protectCandidate({
  directory,
  recordPath,
}: OwnerLockCandidate,): Promise<void> {
  await protectPath({
    path: directory,
    directory: true,
  },);
  await protectPath({
    path: recordPath,
    directory: false,
  },);
  await syncDirectory(directory,);
}

/**
 Makes one publication attempt,
 reporting a blocking record that is not in the owner-lock format as busy so the caller classifies it.

 @param lockDirectory - exact lock directory

 @returns held lock or busy sentinel

 @throws {@link OwnerLockError} when the current process identity is unavailable
 */
async function attemptPublication(lockDirectory: string,): Promise<OwnerLock | typeof LOCK_BUSY> {
  try {
    return await tryAcquireOwnerLock({
      lockDirectory,
      prepareCandidate: protectCandidate,
    },);
  }
  catch (error: unknown) {
    if (!(error instanceof OwnerLockError))
      throw error;
    /**
     Evidence deciding whether the failure was a foreign-format blocking record.
     */
    const observation = await observeRecursiveLock(lockDirectory,);
    if ((observation.kind !== 'unproven') && (observation.kind !== 'legacy-dead'))
      throw error;
    l.debug(`blocking recursive lock record is not in the owner-lock format: ${caughtValueText(error,)}`,);
    return LOCK_BUSY;
  }
}

/**
 Builds the diagnostic for an owner nothing proved alive or exited within the budget.

 @param lockDirectory - exact lock directory

 @param evidence - last observation's evidence

 @returns storage failure naming the lock, evidence, and remediation
 */
function unprovenOwnerError({
  lockDirectory,
  evidence,
}: Readonly<{
  lockDirectory: string;
  evidence: string;
}>,): TrustStorageError {
  return new TrustStorageError(`Timed out waiting for recursive trust enrollment or revocation lock ${lockDirectory}: ${evidence}. After ${String(UNPROVEN_OWNER_TIMEOUT_MS,)} ms nothing proved the owner alive or exited, so cli-git left the lock in place and changed no trust record. Retry once other cli-git trust or untrust commands have finished; remove the lock directory only after confirming no cli-git process is running.`,);
}

/**
 Acquires the registry-wide recursive-operation lock, waiting without a time limit while its owner is proven alive.

 @param registryRoot - complete registry root

 @returns disposable exclusive lock

 @throws {@link TrustStorageError} when an owner neither proven alive nor proven exited outlasts {@link UNPROVEN_OWNER_TIMEOUT_MS}

 @example
 ```ts
 await using lock = await acquireRecursiveRegistryLock({ registryRoot });
 ```
 */
export async function acquireRecursiveRegistryLock({
  registryRoot,
}: Readonly<{
  registryRoot: string;
}>,): Promise<AsyncDisposable> {
  /**
   Tagged acquisition logger.
   */
  const al = tagged({
    tag: acquireRecursiveRegistryLock.name,
    l,
  },);
  await ensureRegistryRoot(registryRoot,);
  /**
   Exact registry-wide recursive operation lock.
   */
  const lockDirectory = join(
    registryRoot,
    RECURSIVE_LOCK_NAME,
  );
  /**
   Loop state: backoff position, time spent without a proven owner, and the live owner last reported.
   */
  const state: {
    backoff: BackoffState;
    unprovenMs: number;
    reportedPid: number;
  } = {
    backoff: INITIAL_BACKOFF,
    unprovenMs: 0,
    reportedPid: NO_OWNER_REPORTED,
  };
  // Every iteration returns, throws, or sleeps; the budget bounds only the unproven iterations.
  for (;;) {
    /**
     When this iteration started.
     */
    const iterationStartedAt = performance.now();
    /* oxlint-disable no-await-in-loop -- Each read observes whether the previous owner released, exited, or was retired. */
    /**
     Current owner evidence, read before publishing so a live owner costs no candidate write.
     */
    const observation: RecursiveLockObservation = await observeRecursiveLock(lockDirectory,);
    /* oxlint-enable no-await-in-loop */
    if (observation.kind === 'legacy-dead') {
      al.debug(`retiring earlier-build lock of exited PID ${String(observation.ownerPid,)}`,);
      // oxlint-disable-next-line no-await-in-loop -- Retirement precedes the next ordered attempt.
      await retireLegacyRecursiveLock({
        lockDirectory,
        recordText: observation.recordText,
      },);
      continue;
    }
    if ((observation.kind === 'absent') || (observation.kind === 'dead')) {
      /* oxlint-disable no-await-in-loop -- Attempts are ordered; this attempt retires a dead owner's lock after re-reading it. */
      /**
       Publication outcome.
       */
      const result = await attemptPublication(lockDirectory,);
      /* oxlint-enable no-await-in-loop */
      if (result !== LOCK_BUSY)
        return result;
      continue;
    }
    /**
     Jittered backoff wait for this iteration.
     */
    const backoffMs = jitteredWait({
      state: state.backoff,
      random: Math.random(),
    },);
    state.backoff = nextBackoff(state.backoff,);
    if (observation.kind === 'alive') {
      state.unprovenMs = 0;
      if (state.reportedPid !== observation.ownerPid) {
        al.debug(`waiting for live PID ${String(observation.ownerPid,)} holding ${lockDirectory}`,);
        state.reportedPid = observation.ownerPid;
      }
      // oxlint-disable-next-line no-await-in-loop -- Polling a live owner in order.
      await wait(Math.min(
        backoffMs,
        LIVE_OWNER_POLL_CAP_MS,
      ),);
      continue;
    }
    state.unprovenMs += performance.now() - iterationStartedAt;
    if (state.unprovenMs >= UNPROVEN_OWNER_TIMEOUT_MS)
      throw unprovenOwnerError({
        lockDirectory,
        evidence: observation.evidence,
      },);
    al.debug(`unproven owner of ${lockDirectory} (${observation.evidence}); backing off ${String(backoffMs,)} ms`,);
    /**
     When the backoff sleep started.
     */
    const sleepStartedAt = performance.now();
    // oxlint-disable-next-line no-await-in-loop -- Backoff between ordered attempts.
    await wait(backoffMs,);
    state.unprovenMs += performance.now() - sleepStartedAt;
  }
}
