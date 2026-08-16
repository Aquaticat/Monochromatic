// Serial request queue: frees the stdin read loop while tool execution stays one at a time.

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

import type { JsonRpcId, } from './json-rpc.ts';

//region Queue vocabulary: entries, sentinels, and the public surface

/**
 * Marks a queue entry that no `notifications/cancelled` can ever match.
 *
 * Parse-error and shape-error frames are queued for ordering alone: they carry no
 * request id a client could name, so they must not collide with a real id in the
 * cancellation bookkeeping.
 */
export const UNCANCELLABLE: unique symbol = Symbol('mcp-stdio uncancellable queue entry',);

/**
 * Returned by a producer that has nothing to write, such as a dispatched notification.
 */
export const NO_FRAME: unique symbol = Symbol('mcp-stdio no outbound frame',);

/**
 * Runs one queued entry and yields its serialized frame.
 *
 * Called at most once per entry, and never at all when cancellation arrives before
 * this entry reaches the front of the queue.
 */
export type FrameProducer = () => Promise<string | typeof NO_FRAME>;

/**
 * Identity a queue entry is cancelled by, or {@link UNCANCELLABLE} when it has none.
 */
export type QueuedId = JsonRpcId | typeof UNCANCELLABLE;

/**
 * FIFO queue running one entry at a time and writing every frame through one path.
 *
 * @example
 * ```ts
 * const queue = createSerialRequestQueue({ write: async (frame) => { await sink(frame); } });
 * queue.enqueue({ id: 1, produce: async () => '{"jsonrpc":"2.0","id":1,"result":{}}' });
 * await queue.idle();
 * ```
 */
export type SerialRequestQueue = {
  /**
   * Accepts one entry and returns immediately, leaving the caller free to keep reading.
   */
  readonly enqueue: (entry: {
    readonly id: QueuedId;
    readonly produce: FrameProducer;
  },) => void;

  /**
   * Cancels a queued or running entry, reporting whether any entry matched.
   */
  readonly cancel: (target: { readonly id: JsonRpcId; },) => boolean;

  /**
   * Resolves once no entry is queued or running.
   */
  readonly idle: () => Promise<void>;
};

//endregion

//region Queue internals

/**
 * One accepted entry awaiting its turn.
 */
type QueuedEntry = {
  /**
   * Identity this entry is cancelled by.
   */
  readonly id: QueuedId;

  /**
   * Work producing this entry's outbound frame.
   */
  readonly produce: FrameProducer;
};

//endregion

//region Queue construction

/**
 * Creates a queue that serializes execution and output for one stdio connection.
 *
 * The read loop calls {@link SerialRequestQueue.enqueue} and moves on, so a tool running
 * for half an hour no longer stops the server from reading `notifications/cancelled`.
 * Execution itself stays strictly serial: exactly one producer runs at a time, which is
 * what the transport did before by accident and now does by design, so no two tool
 * handlers can interleave against a shared backend.
 *
 * Cancellation follows the revision 2026-07-28 schema, which states a cancellation
 * "MAY arrive after the request has already finished" and that "the result will be
 * unused, so any associated processing SHOULD cease". An entry cancelled before it runs
 * is dropped without ever being produced; one cancelled while running is allowed to
 * finish, because aborting a half-created VM is worse than completing it, and its frame
 * is discarded unwritten. A cancellation naming an unknown or already-settled id is
 * ignored.
 *
 * @param write - Sink for one serialized frame, awaited before the next entry runs
 *
 * @returns Queue owning execution order, cancellation, and write order
 *
 * @example
 * ```ts
 * const queue = createSerialRequestQueue({
 *   write: async function writeFrame(frame) {
 *     await output.write(encoder.encode(`${frame}\n`,),);
 *   },
 * });
 * ```
 */
export function createSerialRequestQueue(
  { write, }: {
    readonly write: (frame: string,) => Promise<void>;
  },
): SerialRequestQueue {
  /**
   * Entries waiting behind whichever entry is running.
   */
  const waiting: QueuedEntry[] = [];

  /**
   * Ids accepted and not yet settled, so a cancellation can tell a live request from
   * one that already finished.
   */
  const live = new Set<JsonRpcId>();

  /**
   * Ids cancelled while live; consulted before producing and again before writing.
   */
  const cancelled = new Set<JsonRpcId>();

  /**
   * Single-key holder for the active drain, avoiding a function-root `let`.
   */
  const draining = new Map<'active', Promise<void>>();

  /**
   * Tests whether this entry was cancelled since it was accepted.
   *
   * @param id - Identity to test
   *
   * @returns Whether a cancellation named this entry
   */
  function isCancelled(id: QueuedId,): boolean {
    if (id === UNCANCELLABLE)
      return false;
    return cancelled.has(id,);
  }

  /**
   * Forgets one entry's bookkeeping once it can no longer be cancelled.
   *
   * @param id - Identity to release
   *
   * @mutates live - Drops this id from live tracking.
   *
   * @mutates cancelled - Drops any cancellation recorded for this id.
   */
  function release(id: QueuedId,): void {
    if (id === UNCANCELLABLE)
      return;
    live.delete(id,);
    cancelled.delete(id,);
  }

  /**
   * Runs one entry and writes its frame unless cancellation overtook it.
   *
   * @param entry - Entry reaching the front of the queue
   *
   * @mutates entry - Invokes this entry's producer, which dispatches to a tool handler.
   */
  async function settle(entry: QueuedEntry,): Promise<void> {
    // Cancelled before reaching the front: never dispatched at all, which is the one
    // case where processing genuinely ceases rather than merely going unreported.
    if (isCancelled(entry.id,)) {
      release(entry.id,);
      return;
    }

    // A producer failure must not wedge the queue, so later entries still run.
    try {
      /**
       * Frame this entry produced, or the sentinel when it has nothing to send.
       */
      const frame = await entry.produce();
      if ((frame !== NO_FRAME) && !isCancelled(entry.id,))
        await write(frame,);
    }
    catch (error: unknown) {
      console.error(
        '[mcp-stdio] queued request failed:',
        caughtValueText(error,),
      );
    }
    release(entry.id,);
  }

  /**
   * Runs queued entries in order until none remain.
   *
   * @mutates waiting - Removes each entry as it is taken.
   */
  async function drain(): Promise<void> {
    /**
     * Clears active-drain state even when an entry throws past {@link settle}.
     */
    using _drainCleanup = {
      [Symbol.dispose](): void {
        draining.delete('active',);
      },
    };
    while (waiting.length > 0) {
      /**
       * Next entry in acceptance order.
       */
      const entry = waiting.shift();
      if (entry === undefined)
        throw new Error('mcp-stdio request queue was empty during dequeue',);
      // oxlint-disable-next-line eslint/no-await-in-loop -- serial execution is this queue's contract; overlapping entries would let two tool handlers mutate one backend at once
      await settle(entry,);
    }
  }

  /**
   * Starts a drain when none is running, leaving an active one to pick up new entries.
   *
   * @mutates draining - Records the active drain so {@link SerialRequestQueue.idle} can await it.
   */
  function startDraining(): void {
    if (draining.has('active',))
      return;
    draining.set(
      'active',
      drain(),
    );
  }

  return {
    enqueue(entry,): void {
      if (entry.id !== UNCANCELLABLE)
        live.add(entry.id,);
      waiting.push(entry,);
      startDraining();
    },

    cancel({ id, },): boolean {
      // A cancellation for an id that never arrived, or already settled, is expected
      // rather than exceptional: the schema allows one to arrive after completion.
      if (!live.has(id,))
        return false;
      cancelled.add(id,);
      return true;
    },

    async idle(): Promise<void> {
      /**
       * Active drain, if one is running.
       */
      const active = draining.get('active',);
      if (active === undefined)
        return;
      await active;
    },
  };
}

//endregion
