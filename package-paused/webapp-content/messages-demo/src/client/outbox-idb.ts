/**
 * IndexedDB persistence layer for the chunk-PUT outbox.
 *
 * Split from `outbox.ts` so the factory module stays under the line cap.
 * Every function here takes an open `IDBDatabase`; the no-handle case is
 * decided by the caller before delegating.
 */

import {
  idbOpen,
  idbRequestResult,
  idbTransactionDone,
} from './idb-helpers.ts';
import type { ChunkUpload, } from './outbox.ts';

/**
 * IndexedDB database name used for the persistent outbox.
 */
const OUTBOX_DB_NAME = 'messages-demo:outbox';

/**
 * Object-store name inside the outbox database.
 */
const OUTBOX_STORE = 'pending';

/**
 * IndexedDB schema version. Bump if the record shape changes.
 */
const OUTBOX_DB_VERSION = 1;

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
export function openOutboxDb(): Promise<IDBDatabase> {
  return idbOpen({
    name: OUTBOX_DB_NAME,
    version: OUTBOX_DB_VERSION,
    onUpgrade(dbConn,) {
      if (!dbConn.objectStoreNames
        .contains(OUTBOX_STORE,)) {
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
export async function readPersistedQueue(db: IDBDatabase,): Promise<ChunkUpload[]> {
  /**
   * Read-only transaction scoped to the outbox store; held until the request resolves.
   */
  const tx = db.transaction(
    OUTBOX_STORE,
    'readonly',
  );
  /**
   * Store handle reused by the `getAll` request below.
   */
  const store = tx.objectStore(OUTBOX_STORE,);
  // The store's keyPath constrains every record to ChunkUpload shape;
  // see openOutboxDb's onUpgrade. getAll's typings widen to any[].
  /* oxlint-disable typescript/no-unsafe-type-assertion -- IDB store schema constraint */
  /**
   * Cast widens `getAll`'s `any[]` back to the schema-enforced `ChunkUpload[]`.
   */
  const request = store.getAll() as IDBRequest<ChunkUpload[]>;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  /**
   * Resolved records; sorted in place below so the drain loop emits original order.
   */
  const raw = await idbRequestResult<ChunkUpload[]>(request,);
  // Array.sort dictates the (a, b) => number callback shape, so the
  // comparator stays inline rather than being promoted to a top-level
  // declaration that would violate require-destructured-params.
  raw.sort(function comparePersistedUpload(
    a: ChunkUpload,
    b: ChunkUpload,
  ): number {
    if (a.draftId
      !== b
      .draftId)
      return a.draftId
        < b
        .draftId ? -1 : 1;
    return a.seq
      - b
      .seq;
  },);
  return raw;
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
export async function persistOne(
  input: {
    idb: IDBDatabase;
    upload: ChunkUpload;
  },
): Promise<void> {
  /**
   * Read-write transaction held until `idbTransactionDone` resolves below.
   */
  const tx = input.idb
    .transaction(
    OUTBOX_STORE,
    'readwrite',
  );
  tx.objectStore(OUTBOX_STORE,)
    .put(input.upload,);
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
export async function deleteAcked(
  input: {
    idb: IDBDatabase;
    draftId: string;
    ack: number;
  },
): Promise<void> {
  /**
   * Read-write transaction held until `idbTransactionDone` resolves below.
   */
  const tx = input.idb
    .transaction(
    OUTBOX_STORE,
    'readwrite',
  );
  /**
   * Store handle reused by the bounded-delete below.
   */
  const store = tx.objectStore(OUTBOX_STORE,);
  // Composite key range: every (draftId, seq) with seq in [0, ack].
  // Lower bound at seq=0 is the smallest value the chunker produces.
  /**
   * Composite-key range bounding the delete to one draft id and seqs 0..ack.
   */
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
