/**
 * Persistent chunk-PUT outbox.
 *
 * The composer enqueues each chunk upload here instead of calling
 * `fetch` directly. The outbox:
 *
 * 1. Persists the upload to IndexedDB when the storage probe says yes,
 *    so a refresh in the middle of a tier-3 save resumes from where it
 *    left off.
 * 2. PUTs the chunk via the existing `/api/drafts/:id/chunks/:seq`
 *    endpoint with bounded exponential-backoff retries.
 * 3. On acknowledgment from the server (`{ ack }`: highest contiguous
 *    seq), drops every persisted entry whose `seq <= ack` for the same
 *    `draftId`, since those are now durable on the server.
 * 4. Re-attempts terminally failed uploads when the browser fires
 *    `online` or `visibilitychange`: the most common cause of
 *    terminal failure is a closed laptop lid, not a permanent error.
 *
 * The server's `chunks` table is the source of truth. The outbox is a
 * client-side resume buffer; losing it (e.g. private browsing closes
 * IDB) just means the worker has to re-send any chunks the server has
 * not acked yet.
 */

import { wait, } from '@monochromatic-dev/module-async-time';
import {
  idbOpen,
  idbRequestResult,
  idbTransactionDone,
} from './idb-helpers.ts';
import { readJson, } from './json-fetch.ts';

/** Maximum number of PUT attempts per chunk before pausing. */
const PUT_MAX_ATTEMPTS = 3;

/** Initial backoff delay between PUT retries, in milliseconds. */
const PUT_BACKOFF_BASE_MS = 250;

/** IndexedDB database name used for the persistent outbox. */
const OUTBOX_DB_NAME = 'messages-demo:outbox';

/** Object-store name inside the outbox database. */
const OUTBOX_STORE = 'pending';

/** IndexedDB schema version. Bump if the record shape changes. */
const OUTBOX_DB_VERSION = 1;

/**
 * One queued chunk upload. The shape mirrors the request body of
 * `PUT /api/drafts/:id/chunks/:seq` plus the route parameters, plus a
 * timestamp used only for IDB sort order on resume.
 */
export type ChunkUpload = {
  readonly draftId: string;
  readonly seq: number;
  readonly md: string;
  readonly html: string;
  readonly charCount: number;
};

/** Outbox configuration. */
export type OutboxOptions = {
  /** Set from `StorageCaps.idb`. When false, the outbox is in-memory. */
  readonly idbAvailable: boolean;
};

/** Outbox public surface. Both in-memory and IDB modes return one. */
export type Outbox = {
  /**
   * Persists the upload (when IDB is available) and schedules its PUT
   * in the background. Resolves immediately; use `flushed()` to wait
   * for completion.
   */
  enqueue: (upload: ChunkUpload,) => Promise<void>;
  /**
   * Resolves once every enqueued upload has been acked by the server.
   * If the drain loop pauses on a terminal PUT failure (the queue is
   * non-empty when retries exhaust), this promise stays pending until
   * the next online / visibilitychange kick succeeds, since send must
   * not proceed to finalize while uploads are still in flight.
   */
  flushed: () => Promise<void>;
  /** Number of uploads still waiting to ack. */
  pendingCount: () => number;
  /** Detach event listeners and close IDB. */
  destroy: () => void;
};

/**
 * Builds an outbox. The returned object is safe to share across the
 * composer's lifetime; outbox state is process-local but IDB-backed
 * uploads survive reload.
 *
 * @param options - capability flags from `probeStorage`
 *
 * @returns ready-to-use outbox; rehydrated from IDB when available
 *
 * @example
 * ```ts
 * const outbox = await createOutbox({ idbAvailable: caps.idb });
 * await outbox.enqueue({ draftId, seq: 0, md, html, charCount });
 * await outbox.flushed();
 * ```
 */
export async function createOutbox(options: OutboxOptions,): Promise<Outbox> {
  // Probes can succeed but the actual open can still fail (private
  // mode quirks, quota races). Fall back to in-memory so the composer
  // never blocks at startup.
  /** Lazily assigned IDB handle; left null when the probe lied or the open call fails post-probe. */
  let idb: IDBDatabase | null = null;
  if (options.idbAvailable) {
    try {
      idb = await openOutboxDb();
    }
    catch {
      idb = null;
    }
  }
  /** Initial queue populated from IDB when available; pushes from `enqueue` extend it later. */
  let queue: ChunkUpload[] = [];
  if (idb !== null) {
    try {
      queue = await readPersistedQueue(idb,);
    }
    catch {
      queue = [];
    }
  }
  /** Closure-scoped state shared by every helper in this factory; queue and flags live here. */
  const state = {
    queue,
    idb,
    draining: false,
    destroyed: false,
    waiters: [] as (() => void)[],
  };

  /** Resolves every pending `flushed()` waiter and clears the list. */
  function notifyFlushed(): void {
    /** Snapshot of `state.waiters` so the list can be reset before each resolver runs. */
    const pending = state.waiters;
    state.waiters = [];
    for (const resolve of pending)
      resolve();
  }

  /**
   * Background drain loop. Processes the queue head-first, sequential,
   * stopping when the queue empties or a PUT terminally fails (in
   * which case the next online/visibilitychange resumes). Uses
   * `using` for the draining-flag cleanup so a thrown IDB error in
   * `dropAcked` still resets the flag and notifies waiters.
   */
  async function drain(): Promise<void> {
    if (state.draining || state.destroyed)
      return;
    state.draining = true;
    /** `using` disposable so the draining flag clears even when the body throws. */
    using _drainCleanup = {
      /** Cleared at scope exit (including throws). */
      [Symbol.dispose]: function dispose(): void {
        state.draining = false;
        if (state.queue.length === 0)
          notifyFlushed();
      },
    };
    while (state.queue.length > 0 && !state.destroyed) {
      /** Destructured head so the next iteration sees the new front element. */
      const [head,] = state.queue;
      if (head === undefined)
        break;
      // oxlint-disable-next-line no-await-in-loop
      /** Server ack from the PUT; `null` signals retries exhausted and the loop pauses. */
      const ack = await tryPutWithBackoff(head,);
      if (ack === null)
        break;
      // oxlint-disable-next-line no-await-in-loop
      await dropAcked({
        idb: state.idb,
        queue: state.queue,
        draftId: head.draftId,
        ack,
      },);
    }
  }

  /** Idempotent drain trigger. Multiple concurrent calls collapse. */
  function kick(): void {
    void drain();
  }

  /** Online/visibility listener: kicks the drain when conditions improve. */
  function onOnlineOrVisible(): void {
    if (state.destroyed)
      return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible')
      return;
    kick();
  }

  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener(
      'online',
      onOnlineOrVisible,
    );
  }
  if (typeof document !== 'undefined'
    && typeof document.addEventListener === 'function')
  {
    document.addEventListener(
      'visibilitychange',
      onOnlineOrVisible,
    );
  }

  // Drain anything we rehydrated from IDB on construction.
  if (queue.length > 0)
    kick();

  return {
    async enqueue(upload,) {
      if (state.destroyed)
        throw new Error('outbox destroyed',);
      if (state.idb !== null) {
        await persistOne({
          idb: state.idb,
          upload,
        },);
      }
      state.queue.push(upload,);
      kick();
    },
    flushed() {
      if (state.queue.length === 0 && !state.draining)
        return Promise.resolve();
      // The Promise constructor is the only way to capture a resolver
      // we hand off to the drain loop for later notification.
      // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- one-shot resolver
      return new Promise<void>(function executor(resolve,) {
        state.waiters.push(resolve,);
      },);
    },
    pendingCount() {
      return state.queue.length;
    },
    destroy() {
      state.destroyed = true;
      if (typeof globalThis.removeEventListener === 'function') {
        globalThis.removeEventListener(
          'online',
          onOnlineOrVisible,
        );
      }
      if (typeof document !== 'undefined'
        && typeof document.removeEventListener === 'function')
      {
        document.removeEventListener(
          'visibilitychange',
          onOnlineOrVisible,
        );
      }
      if (state.idb !== null)
        state.idb.close();
      notifyFlushed();
    },
  };
}

/**
 * Sends one upload with bounded exponential backoff. Returns the
 * server-reported ack on success or `null` after the retry budget is
 * exhausted; the caller pauses the queue until the next online /
 * visibility event.
 *
 * @param upload - chunk to PUT
 *
 * @returns highest contiguous seq returned by the server, or `null`
 *
 * @example
 * ```ts
 * const ack = await tryPutWithBackoff(upload);
 * ```
 */
async function tryPutWithBackoff(upload: ChunkUpload,): Promise<number | null> {
  /** Stable URL captured once outside the retry loop so each attempt targets the same slot. */
  const url = `/api/drafts/${encodeURIComponent(upload.draftId,)}/chunks/${
    String(upload.seq,)
  }`;
  /** JSON body serialised once outside the retry loop to avoid repeated stringify cost. */
  const body = JSON.stringify({
    md: upload.md,
    html: upload.html,
    char_count: upload.charCount,
  },);
  // oxlint-disable-next-line no-await-in-loop
  for (let attempt = 0; attempt < PUT_MAX_ATTEMPTS; attempt += 1) {
    try {
      // oxlint-disable-next-line no-await-in-loop
      /** Awaited so both the status check and the JSON read can reuse the same response. */
      const response = await fetch(
        url,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', },
          body,
        },
      );
      if (!response.ok)
        throw new Error(`PUT returned ${String(response.status,)}`,);
      // oxlint-disable-next-line no-await-in-loop
      /** Server ack envelope; falls back to `upload.seq` when `ack` is missing or non-numeric. */
      const parsed = await readJson<{ ack?: unknown; }>(response,);
      return typeof parsed.ack === 'number' ? parsed.ack : upload.seq;
    }
    catch {
      /** Exponential backoff per retry; doubles on each attempt (250 ms, 500 ms, 1 s). */
      const delay = PUT_BACKOFF_BASE_MS * (1 << attempt);
      // oxlint-disable-next-line no-await-in-loop
      await wait(delay,);
    }
  }
  return null;
}

/**
 * Drops every queue entry whose `(draftId, seq)` is implied by the
 * server's ack (`seq <= ack`) and removes the same entries from IDB.
 *
 * @param input - queue, IDB handle, draft id, server ack
 *
 * @example
 * ```ts
 * await dropAcked({ idb, queue, draftId, ack });
 * ```
 */
async function dropAcked(
  input: {
    idb: IDBDatabase | null;
    queue: ChunkUpload[];
    draftId: string;
    ack: number;
  },
): Promise<void> {
  /** Pre-sweep length captured so the reverse walk terminates at a known head. */
  const before = input.queue.length;
  for (let index = before - 1; index >= 0; index -= 1) {
    /** Currently-visited entry; the guard below treats sparse holes as already-dropped. */
    const entry = input.queue[index];
    if (entry === undefined)
      continue;
    if (entry.draftId === input.draftId && entry.seq <= input.ack) {
      input.queue.splice(
        index,
        1,
      );
    }
  }
  if (input.idb === null)
    return;
  await deleteAcked({
    idb: input.idb,
    draftId: input.draftId,
    ack: input.ack,
  },);
}

/**
 * Opens (or creates) the IDB database used to persist the outbox.
 *
 * @returns open IDB handle, or rejects when the open fails
 *
 * @example
 * ```ts
 * const db = await openOutboxDb();
 * ```
 */
function openOutboxDb(): Promise<IDBDatabase> {
  return idbOpen({
    name: OUTBOX_DB_NAME,
    version: OUTBOX_DB_VERSION,
    onUpgrade(dbConn,) {
      if (!dbConn.objectStoreNames.contains(OUTBOX_STORE,)) {
        dbConn.createObjectStore(
          OUTBOX_STORE,
          {
            keyPath: [
              'draftId',
              'seq',
            ],
          },
        );
      }
    },
  },);
}

/**
 * Reads every persisted upload back into a queue, ordered by
 * `(draftId, seq)`.
 *
 * @param db - open IDB handle
 *
 * @returns rehydrated queue
 *
 * @example
 * ```ts
 * const queue = await readPersistedQueue(db);
 * ```
 */
async function readPersistedQueue(db: IDBDatabase,): Promise<ChunkUpload[]> {
  /** Read-only transaction scoped to the outbox store; held until the request resolves. */
  const tx = db.transaction(
    OUTBOX_STORE,
    'readonly',
  );
  /** Store handle reused by the `getAll` request below. */
  const store = tx.objectStore(OUTBOX_STORE,);
  // The store's keyPath constrains every record to ChunkUpload shape;
  // see openOutboxDb's onUpgrade. getAll's typings widen to any[].
  /* oxlint-disable typescript/no-unsafe-type-assertion -- IDB store schema constraint */
  /** Cast widens `getAll`'s `any[]` back to the schema-enforced `ChunkUpload[]`. */
  const request = store.getAll() as IDBRequest<ChunkUpload[]>;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  /** Resolved records; sorted in place below so the drain loop emits original order. */
  const raw = await idbRequestResult<ChunkUpload[]>(request,);
  raw.sort(comparePersistedUpload,);
  return raw;
}

/**
 * Compare-by-`(draftId, seq)` for sorting the rehydrated queue so the
 * drain loop emits chunks in their original order.
 *
 * @param a - left side of the comparison
 *
 * @param b - right side of the comparison
 *
 * @returns negative when `a` precedes `b`, positive when `b` precedes
 *          `a`, zero when equal
 */
function comparePersistedUpload(
  a: ChunkUpload,
  b: ChunkUpload,
): number {
  if (a.draftId !== b.draftId)
    return a.draftId < b.draftId ? -1 : 1;
  return a.seq - b.seq;
}

/**
 * Writes one upload to IDB. Idempotent: re-enqueueing the same
 * `(draftId, seq)` overwrites the prior entry.
 *
 * @param input - IDB handle and the upload to persist
 *
 * @example
 * ```ts
 * await persistOne({ idb, upload });
 * ```
 */
async function persistOne(
  input: {
    idb: IDBDatabase;
    upload: ChunkUpload;
  },
): Promise<void> {
  /** Read-write transaction held until `idbTransactionDone` resolves below. */
  const tx = input.idb.transaction(
    OUTBOX_STORE,
    'readwrite',
  );
  tx.objectStore(OUTBOX_STORE,).put(input.upload,);
  await idbTransactionDone(tx,);
}

/**
 * Deletes every persisted entry for `draftId` whose `seq <= ack`.
 *
 * @param input - IDB handle, draft id, server ack
 *
 * @example
 * ```ts
 * await deleteAcked({ idb, draftId, ack });
 * ```
 */
async function deleteAcked(
  input: {
    idb: IDBDatabase;
    draftId: string;
    ack: number;
  },
): Promise<void> {
  /** Read-write transaction held until `idbTransactionDone` resolves below. */
  const tx = input.idb.transaction(
    OUTBOX_STORE,
    'readwrite',
  );
  /** Store handle reused by the bounded-delete below. */
  const store = tx.objectStore(OUTBOX_STORE,);
  // Composite key range: every (draftId, seq) with seq in [0, ack].
  // Lower bound at seq=0 is the smallest value the chunker produces.
  /** Composite-key range bounding the delete to one draft id and seqs 0..ack. */
  const range = IDBKeyRange.bound(
    [
      input.draftId,
      0,
    ],
    [
      input.draftId,
      input.ack,
    ],
    false,
    false,
  );
  store.delete(range,);
  await idbTransactionDone(tx,);
}
