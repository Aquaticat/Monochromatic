/**
 Starvation reservation of the next landing slot.

 A transaction that lost `landing.reserveAfterLostRaces` landing races writes `reservation-request`
 into its transaction directory and asks for the reservation:
 the owner lock `<git-dir>/cli-git-transactions/reservation.lock`,
 whose record names the transaction.
 A free reservation goes to the live requester with the earliest invocation start,
 ties broken by transaction ID.
 While another transaction's live reservation exists,
 a transaction still prepares,
 replays,
 and revalidates,
 but waits before landing,
 and checks again after taking the landing lock,
 so only a landing already inside the critical section when the reservation was granted can still land before its holder.
 The holder releases the reservation when its landing loop ends,
 landed or failed;
 a dead holder's reservation is retired through the owner-liveness check,
 which counts a zombie as exited.

 An invocation nested under a forwarded Git that holds the landing lock
 (an inherited landing lease)
 neither waits for nor takes the reservation:
 its ancestor already holds the landing lock the reservation holder waits for.

 @module
 */
import {
  access,
  rm,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { hasValidLandingLease, } from '../index-lock/landing-lease.ts';
import {
  LOCK_BUSY,
  type OwnerLock,
  type OwnerLockRecord,
  ownerLockHolderIsAlive,
  readOwnerLockRecord,
  tryAcquireOwnerLock,
} from '../owner-lock/owner-lock.ts';
import {
  syncDirectory,
  writePrivateFile,
} from '../trust/registry-io.ts';
import {
  acquireLandingLock,
  LANDING_LOCK_NAME,
  oldestFirst,
} from './commit-landing-lock.ts';
import { inspectRegistryEntry, } from './commit-transaction-recovery-inspect.ts';
import {
  listTransactionEntries,
  RESERVATION_LOCK_NAME,
} from './commit-transaction-registry.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Reservation request filename inside a transaction directory.
 */
export const RESERVATION_REQUEST_FILENAME = 'reservation-request';

/**
 Delay between reservation checks.
 */
const RESERVATION_POLL_MS = 20;

/**
 No live transaction holds the reservation.
 */
const NO_HOLDER: unique symbol = Symbol('reservation.lock is absent or names a dead owner',);

/**
 The landing reservation as one transaction sees it.
 */
export type LandingReservation = AsyncDisposable & Readonly<{
  /**
   Waits while a live reservation owned by another transaction exists.
   */
  awaitSlot: () => Promise<void>;
  /**
   Whether a live reservation owned by another transaction exists now.
   */
  heldByAnother: () => Promise<boolean>;
  /**
   Requests the reservation and waits until it is granted; resolves `false` when already held or not applicable.
   */
  reserve: (lostRaces: number) => Promise<boolean>;
}>;

/**
 Live reservation holder, or {@link NO_HOLDER} for an absent lock or a dead owner's.

 @param lockDirectory - reservation lock

 @returns live holder record
 */
async function liveHolder(lockDirectory: string,): Promise<OwnerLockRecord | typeof NO_HOLDER> {
  /**
   Published owner.
   */
  const record = await readOwnerLockRecord(lockDirectory,);
  if (record === LOCK_BUSY)
    return NO_HOLDER;
  return (await ownerLockHolderIsAlive(record,)) ? record : NO_HOLDER;
}

/**
 Whether a path exists.

 @param path - path

 @returns existence
 */
async function exists(path: string,): Promise<boolean> {
  try {
    await access(path,);
    return true;
  }
  catch (error: unknown) {
    l.debug(`${path} is absent: ${String(error,)}`,);
    return false;
  }
}

/**
 Transaction IDs of live requesters, oldest invocation first, ties by transaction ID.

 @param registryRoot - transaction registry

 @returns requester IDs in grant order

 @example
 ```ts
 await liveRequesters('/repo/.git/cli-git-transactions');
 ```
 */
export async function liveRequesters(registryRoot: string,): Promise<readonly string[]> {
  /**
   Published transactions with a request, and their owner evidence.
   */
  const requesting = await Promise.all((await listTransactionEntries(registryRoot,))
    .filter(function isPublished(entry,): boolean {
      return entry.kind === 'transaction';
    },)
    .map(async function withRequest(entry,) {
      return (await exists(join(
        entry.path,
        RESERVATION_REQUEST_FILENAME,
      ),)) ? [await inspectRegistryEntry(entry,),] : [];
    },),);
  return oldestFirst(requesting.flat(),)
    .filter(function alive(inspected,): boolean {
      return ((typeof inspected.owner) !== 'string') && (inspected.owner
        .liveness
        === 'alive');
    },)
    .map(function idOf(inspected,): string {
      return inspected.entry
        .transactionId;
    },);
}

/**
 Opens the reservation for one transaction's landing loop; disposal releases a held reservation and removes the request.

 @param registryRoot - transaction registry

 @param transactionDirectory - this transaction's directory

 @param transactionId - this transaction's ID

 @returns reservation view

 @example
 ```ts
 await using reservation = await openLandingReservation({ registryRoot, transactionDirectory, transactionId });
 ```
 */
export async function openLandingReservation({
  registryRoot,
  transactionDirectory,
  transactionId,
}: Readonly<{
  registryRoot: string;
  transactionDirectory: string;
  transactionId: string;
}>,): Promise<LandingReservation> {
  /**
   Tagged reservation logger.
   */
  const rl = tagged({
    tag: openLandingReservation.name,
    l,
  },);
  /**
   Reservation lock directory.
   */
  const lockDirectory = join(
    registryRoot,
    RESERVATION_LOCK_NAME,
  );
  /**
   Request file.
   */
  const requestPath = join(
    transactionDirectory,
    RESERVATION_REQUEST_FILENAME,
  );
  /**
   Whether this invocation lands under an ancestor's landing lock.
   */
  const nested = await hasValidLandingLease({
    environment: process.env,
    lockDirectory: join(
      registryRoot,
      LANDING_LOCK_NAME,
    ),
  },);
  /**
   The reservation, once this transaction holds it.
   */
  const held = new Map<'reservation', OwnerLock>();
  /**
   Whether another transaction holds a live reservation.

   @returns whether landing must wait
   */
  async function heldByAnother(): Promise<boolean> {
    if (nested)
      return false;
    /**
     Live holder.
     */
    const holder = await liveHolder(lockDirectory,);
    return (holder !== NO_HOLDER) && (holder.token
      !== held.get('reservation',)
      ?.token);
  }
  return {
    heldByAnother,
    awaitSlot: async function awaitSlot(): Promise<void> {
      // The wait is unbounded while the holder lives; a dead holder no longer counts.
      // oxlint-disable-next-line no-await-in-loop -- Each check re-reads the holder's liveness after the delay.
      for (let polls = 0; await heldByAnother(); polls += 1) {
        if (polls === 0)
          rl.debug(`waiting for the reservation holder in ${lockDirectory} to land`,);
        // oxlint-disable-next-line no-await-in-loop -- Delay between checks of the holder's liveness.
        await wait(RESERVATION_POLL_MS,);
      }
    },
    reserve: async function reserve(lostRaces: number,): Promise<boolean> {
      if (nested || held.has('reservation',))
        return false;
      await writePrivateFile({
        path: requestPath,
        bytes: new TextEncoder().encode(`${JSON.stringify({
          schemaVersion: 2,
          state: 'reservation-request',
          lostRaces,
        },)}\n`,),
      },);
      await syncDirectory(transactionDirectory,);
      rl.debug(`requested the landing reservation after ${String(lostRaces,)} lost races`,);
      // Each iteration either takes the free reservation as the oldest live requester or waits.
      for (;;) {
        // oxlint-disable-next-line no-await-in-loop -- Grant order is re-read on every check.
        if (((await liveHolder(lockDirectory,)) === NO_HOLDER) && ((await liveRequesters(registryRoot,))[0] === transactionId)) {
          /**
           One publication attempt; a dead holder's lock is retired by it.
           */
          // oxlint-disable-next-line no-await-in-loop -- Publication follows the grant-order check it depends on.
          const lock = await tryAcquireOwnerLock({
            lockDirectory,
            transactionId,
          },);
          if (lock !== LOCK_BUSY) {
            held.set(
              'reservation',
              lock,
            );
            rl.debug(`holds the landing reservation ${lockDirectory}`,);
            return true;
          }
        }
        // oxlint-disable-next-line no-await-in-loop -- Delay between grant checks.
        await wait(RESERVATION_POLL_MS,);
      }
    },
    [Symbol.asyncDispose]: async function release(): Promise<void> {
      /**
       Held reservation.
       */
      const lock = held.get('reservation',);
      held.delete('reservation',);
      await rm(
        requestPath,
        { force: true, },
      );
      if (lock !== undefined) {
        await lock[Symbol.asyncDispose]();
        rl.debug(`released the landing reservation ${lockDirectory}`,);
      }
    },
  };
}

/**
 Acquires the landing lock once no other transaction's reservation stands in the way,
 checking again under the lock so a reservation granted while this landing waited is honoured.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param registryRoot - transaction registry

 @param reservation - this transaction's reservation view

 @returns held landing lock

 @example
 ```ts
 await using lock = await acquireReservedLandingLock({ gitPath: '/usr/bin/git', cwd: '/repo', registryRoot, reservation });
 ```
 */
export async function acquireReservedLandingLock({
  gitPath,
  cwd,
  registryRoot,
  reservation,
}: Readonly<{
  gitPath: string;
  cwd: string;
  registryRoot: string;
  reservation: Pick<LandingReservation, 'awaitSlot' | 'heldByAnother'>;
}>,): Promise<OwnerLock> {
  // Each iteration either returns the lock or releases it for a reservation holder and waits again.
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop -- Waiting for the holder precedes each acquisition.
    await reservation.awaitSlot();
    /**
     Landing lock.
     */
    // oxlint-disable-next-line no-await-in-loop -- The lock is taken only after the slot is free.
    const lock = await acquireLandingLock({
      gitPath,
      cwd,
      registryRoot,
    },);
    // oxlint-disable-next-line no-await-in-loop -- The check must run while the lock is held.
    if (!(await reservation.heldByAnother()))
      return lock;
    l.debug('a reservation was granted while this landing waited for the landing lock; yielding it',);
    // oxlint-disable-next-line no-await-in-loop -- Release precedes the next wait.
    await lock[Symbol.asyncDispose]();
  }
}
