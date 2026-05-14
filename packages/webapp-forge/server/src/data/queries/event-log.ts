/**
 * Append-only event log + sequence-counter helpers.
 *
 * The dispatcher reads from `events` in id order; the per-resource
 * `sequences.current` counter feeds telemetry and is reused by Phase 2+
 * dispatcher modes that need per-resource ordering.
 */

import {
  all,
  get,
  run,
} from '../db.ts';
import type {
  EventKind,
  EventRow,
  ResourceType,
} from './types.ts';

/**
 * Increments the per-resource sequence counter and returns the new value.
 *
 * @param resourceType - resource discriminant
 *
 * @param resourceId - resource id
 *
 * @returns new sequence value (\>= 1)
 *
 * @example
 * ```ts
 * const seq = await nextSequence('issue', 'i1');
 * ```
 */
export async function nextSequence(
  resourceType: ResourceType,
  resourceId: string,
): Promise<number> {
  await run(
    `INSERT INTO sequences(resource_type, resource_id, current)
     VALUES (?, ?, 1)
     ON CONFLICT(resource_type, resource_id) DO UPDATE SET current = current + 1`,
    [
      resourceType,
      resourceId,
    ],
  );
  /** Re-read after the upsert returns the post-increment value. */
  const row = await get<{ current: number; }>(
    'SELECT current FROM sequences WHERE resource_type = ? AND resource_id = ?',
    [
      resourceType,
      resourceId,
    ],
  );
  if (row === undefined)
    throw new Error('sequence row vanished after upsert',);
  return row.current;
}

/**
 * Inserts an event into the append-only log.
 *
 * @param row - event fields
 *
 * @returns generated `events.id`
 *
 * @example
 * ```ts
 * const eventId = await insertEvent({
 *   resourceType: 'issue',
 *   resourceId: 'i1',
 *   kind: 'comment.created',
 *   payload: { commentId: 'c1' },
 *   sequenceNumber: 2,
 *   createdAt: Date.now(),
 * });
 * ```
 */
export async function insertEvent(row: {
  resourceType: ResourceType;
  resourceId: string;
  kind: EventKind;
  payload: Readonly<Record<string, unknown>>;
  sequenceNumber: number;
  createdAt: number;
},): Promise<number> {
  /** Insert result; `lastInsertRowid` becomes the returned `events.id`. */
  const result = await run(
    `INSERT INTO events(resource_type, resource_id, kind, payload, sequence_number, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      row.resourceType,
      row.resourceId,
      row.kind,
      JSON.stringify(row.payload,),
      row.sequenceNumber,
      row.createdAt,
    ],
  );
  return result.lastInsertRowid;
}

/**
 * Reads events with id strictly greater than `afterId`, in id order.
 *
 * @param afterId - exclusive lower bound on `events.id`
 *
 * @param limit - maximum number of rows to return
 *
 * @returns events array (possibly empty)
 *
 * @example
 * ```ts
 * const newer = await listEventsAfter(0, 100);
 * ```
 */
export async function listEventsAfter(
  afterId: number,
  limit: number,
): Promise<EventRow[]> {
  return await all<EventRow>(
    'SELECT * FROM events WHERE id > ? ORDER BY id ASC LIMIT ?',
    [
      afterId,
      limit,
    ],
  );
}
