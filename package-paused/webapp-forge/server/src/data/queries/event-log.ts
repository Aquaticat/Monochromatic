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
 * @param row - resource identifier
 *
 * @returns new sequence value (\>= 1)
 *
 * @example
 * ```ts
 * const seq = await nextSequence({ resourceType: 'issue', resourceId: 'i1' });
 * ```
 */
export async function nextSequence(row: {
  /**
   * Resource discriminant.
   */
  readonly resourceType: ResourceType;
  /**
   * Resource id.
   */
  readonly resourceId: string;
},): Promise<number> {
  await run({
    sql: `INSERT INTO sequences(resource_type, resource_id, current)
     VALUES (?, ?, 1)
     ON CONFLICT(resource_type, resource_id) DO UPDATE SET current = current + 1`,
    params: [
      row.resourceType,
      row.resourceId,
    ],
  },);
  /**
   * Re-read after the upsert returns the post-increment value.
   */
  const sequenceRow = await get<{ current: number; }>({
    sql: 'SELECT current FROM sequences WHERE resource_type = ? AND resource_id = ?',
    params: [
      row.resourceType,
      row.resourceId,
    ],
  },);
  if (sequenceRow === undefined)
    throw new Error('sequence row vanished after upsert',);
  return sequenceRow.current;
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
  readonly resourceType: ResourceType;
  readonly resourceId: string;
  readonly kind: EventKind;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly sequenceNumber: number;
  readonly createdAt: number;
},): Promise<number> {
  /**
   * Insert result; `lastInsertRowid` becomes the returned `events.id`.
   */
  const result = await run({
    sql:
      `INSERT INTO events(resource_type, resource_id, kind, payload, sequence_number, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    params: [
      row.resourceType,
      row.resourceId,
      row.kind,
      JSON.stringify(row.payload,),
      row.sequenceNumber,
      row.createdAt,
    ],
  },);
  return result.lastInsertRowid;
}

/**
 * Reads events with id strictly greater than `afterId`, in id order.
 *
 * @param row - pagination cursor + page size
 *
 * @returns events array (possibly empty)
 *
 * @example
 * ```ts
 * const newer = await listEventsAfter({ afterId: 0, limit: 100 });
 * ```
 */
export async function listEventsAfter(row: {
  /**
   * Exclusive lower bound on `events.id`.
   */
  readonly afterId: number;
  /**
   * Maximum number of rows to return.
   */
  readonly limit: number;
},): Promise<EventRow[]> {
  return await all<EventRow>({
    sql: 'SELECT * FROM events WHERE id > ? ORDER BY id ASC LIMIT ?',
    params: [
      row.afterId,
      row.limit,
    ],
  },);
}
