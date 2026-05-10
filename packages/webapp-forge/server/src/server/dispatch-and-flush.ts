/**
 * Glue: dispatch all events newer than a given baseline, draining the
 * write buffer at the end.
 *
 * Used by route handlers and the seed CLI to make sure every fragment
 * affected by the last write is durable in storage before returning to
 * the caller.
 */

import {
  type EventKind,
  listEventsAfter,
} from '../data/queries.ts';
import type { Storage, } from '../storage/adapter.ts';
import type { WriteBuffer, } from '../storage/write-buffer.ts';
import { processEvent, } from '../worker/dispatcher.ts';

/**
 * Fragment-event kinds the dispatcher rebuilds. Phase 1 covers issue +
 * comment + label; Phase 2 adds PR lifecycle events that share their
 * resource id with the underlying issue.
 */
const DISPATCHABLE_KINDS: ReadonlySet<EventKind> = new Set<EventKind>([
  'comment.created',
  'issue.created',
  'issue.labeled',
  'pr.opened',
  'pr.merged',
  'pr.closed',
  'review.submitted',
  'push',
],);

/** Default batch size for the event-drain loop. */
const DEFAULT_BATCH_SIZE = 256;

/**
 * Drains every event newer than `afterEventId`, dispatching each one in
 * id order, then waits for the write buffer to flush.
 *
 * @param row - dispatch inputs
 *
 * @returns the highest `events.id` processed (`afterEventId` when no
 *          events were drained)
 *
 * @example
 * ```ts
 * const cursor = await dispatchAndFlush({
 *   afterEventId: 0,
 *   storage,
 *   writeBuffer,
 * });
 * ```
 */
export async function dispatchAndFlush(row: {
  afterEventId: number;
  storage: Storage;
  writeBuffer: WriteBuffer;
  batchSize?: number;
},): Promise<number> {
  const batchSize = row.batchSize ?? DEFAULT_BATCH_SIZE;
  let cursor = row.afterEventId;
  // Process up to `batchSize` events per loop turn so an unbounded
  // backlog cannot starve the caller. Phase 1 callers usually only
  // expect 1-2 events; the loop terminates once `listEventsAfter`
  // returns an empty page.
  while (true) {
    // oxlint-disable-next-line no-await-in-loop -- sequential by design
    const events = await listEventsAfter(
      cursor,
      batchSize,
    );
    if (events.length === 0)
      break;
    for (const eventRow of events) {
      cursor = eventRow.id;
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- event-log column is a string subtype
      const kind = eventRow.kind as EventKind;
      if (!DISPATCHABLE_KINDS.has(kind,))
        continue;
      const commentId = kind === 'comment.created'
        ? extractCommentId(eventRow.payload,)
        : undefined;
      const event = commentId === undefined
        ? {
          kind,
          resourceId: eventRow.resource_id,
        }
        : {
          kind,
          resourceId: eventRow.resource_id,
          commentId,
        };
      // oxlint-disable-next-line no-await-in-loop -- per-resource ordering relies on sequential dispatch
      await processEvent(
        event,
        eventRow.sequence_number,
        eventRow.id,
        row.writeBuffer,
      );
    }
    if (events.length < batchSize)
      break;
  }
  await row.writeBuffer.flush();
  return cursor;
}

/**
 * Extracts the `commentId` field from a `comment.created` event's
 * payload JSON. Returns `undefined` when the payload is malformed or the
 * field is missing.
 *
 * @param payload - the event row's `payload` column (JSON string)
 *
 * @returns the comment id, or `undefined` when it is absent
 *
 * @example
 * ```ts
 * extractCommentId('{"commentId":"c1","authorId":"u1"}'); // 'c1'
 * ```
 */
function extractCommentId(payload: string,): string | undefined {
  let parsed: unknown = undefined;
  try {
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- JSON.parse returns any
    parsed = JSON.parse(payload,);
  } catch {
    return undefined;
  }
  if (parsed === null || typeof parsed !== 'object')
    return undefined;
  if (!('commentId' in parsed))
    return undefined;
  const { commentId, } = parsed;
  return typeof commentId === 'string' ? commentId : undefined;
}
