/**
 Landing reservation and owner-lock internals reachable from the built artifact for unit tests.

 Not part of the authoring API;
 names and shapes change without notice.

 @internal

 @module
 */
import {
  LOCK_BUSY,
  retireLockOfDeadOwner,
  tryAcquireOwnerLock,
} from './owner-lock/owner-lock.ts';
import {
  acquireReservedLandingLock,
  liveRequesters,
  openLandingReservation,
  RESERVATION_REQUEST_FILENAME,
} from './policy-engine/commit-landing-reservation.ts';
import { RESERVATION_LOCK_NAME, } from './policy-engine/commit-transaction-registry.ts';

/**
 Shapes of the reservation internals exposed to built-artifact tests.
 */
export type ReservationTestExports = Readonly<{
  /**
   Internal `acquireReservedLandingLock`.
   */
  acquireReservedLandingLock: typeof acquireReservedLandingLock;
  /**
   Internal `liveRequesters`.
   */
  liveRequesters: typeof liveRequesters;
  /**
   Internal `LOCK_BUSY`.
   */
  LOCK_BUSY: typeof LOCK_BUSY;
  /**
   Internal `openLandingReservation`.
   */
  openLandingReservation: typeof openLandingReservation;
  /**
   Internal `RESERVATION_LOCK_NAME`.
   */
  RESERVATION_LOCK_NAME: typeof RESERVATION_LOCK_NAME;
  /**
   Internal `RESERVATION_REQUEST_FILENAME`.
   */
  RESERVATION_REQUEST_FILENAME: typeof RESERVATION_REQUEST_FILENAME;
  /**
   Internal `retireLockOfDeadOwner`.
   */
  retireLockOfDeadOwner: typeof retireLockOfDeadOwner;
  /**
   Internal `tryAcquireOwnerLock`.
   */
  tryAcquireOwnerLock: typeof tryAcquireOwnerLock;
}>;

/**
 Reservation internals as one plain object, merged into the package's test export object.
 */
export const reservationTestExports: ReservationTestExports = {
  acquireReservedLandingLock,
  liveRequesters,
  LOCK_BUSY,
  openLandingReservation,
  RESERVATION_LOCK_NAME,
  RESERVATION_REQUEST_FILENAME,
  retireLockOfDeadOwner,
  tryAcquireOwnerLock,
};
