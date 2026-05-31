/**
 * Process-wide runtime: storage adapter + write buffer instances shared
 * by every route handler.
 *
 * Phase 1 picks the in-memory adapter unconditionally. Phase 2+ adds an
 * S3-compatible adapter selected via `--storage=memory|s3` arg or env.
 */

import { createMemoryStorage, } from '../storage/adapter-memory.ts';
import type { Storage, } from '../storage/adapter.ts';
import {
  createWriteBuffer,
  type WriteBuffer,
} from '../storage/write-buffer.ts';

/**
 * Process-shared storage adapter.
 */
export const storage: Storage = createMemoryStorage();

/**
 * Process-shared write buffer in front of the storage adapter.
 */
export const writeBuffer: WriteBuffer = createWriteBuffer({ storage, },);

/**
 * Tracks the highest `events.id` processed so far. Routes update it
 * after dispatching to avoid re-processing earlier events.
 *
 * Phase 1's dispatcher is synchronous in-request; on every write the
 * route handler reads this value, dispatches everything newer than it,
 * and stores the new cursor. Stored on a `const` container object so
 * the mutable counter stays out of module-root scope.
 */
const eventCursor: { lastProcessedEventId: number; } = { lastProcessedEventId: 0, };

/**
 * Reads the current event cursor.
 *
 * @returns highest `events.id` processed
 *
 * @example
 * ```ts
 * const cursor = getEventCursor();
 * ```
 */
export function getEventCursor(): number {
  return eventCursor.lastProcessedEventId;
}

/**
 * Advances the event cursor.
 *
 * @param eventId - new cursor (must be monotonic)
 *
 * @example
 * ```ts
 * setEventCursor(newId);
 * ```
 */
export function setEventCursor(eventId: number,): void {
  if (eventId > eventCursor
    .lastProcessedEventId)
    eventCursor.lastProcessedEventId = eventId;
}
