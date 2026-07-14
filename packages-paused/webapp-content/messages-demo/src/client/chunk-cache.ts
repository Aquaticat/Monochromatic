/**
 * Tier-3 rendered-HTML chunk cache.
 *
 * Backs the prev/next chunk navigation so a previously-visited chunk
 * renders instantly on revisit. Strictly an enhancement: when both
 * OPFS and IDB probes fail, the cache is a no-op and the composer
 * falls back to a network fetch (~30 ms on a good connection).
 *
 * Cache key triple: `(messageId, revision, idx)`. The plan calls for
 * stale-entry eviction on read whenever a different revision is in
 * scope; a fresh edit bumps `messages.revision`, so a `get` for the
 * new revision deletes the prior revision's entries for the same
 * message id. This keeps cache size bounded to one revision per
 * message.
 *
 * Backend selection (per `StorageCaps`):
 *
 * - both `opfs` and `idb` available: OPFS (one file per chunk; large
 *   HTML stays out of IDB's transaction size limits)
 * - `opfs` only: OPFS
 * - `idb` only: IDB
 * - neither: no-op
 */

import {
  evictOpfsStale,
  opfsName,
} from './chunk-cache-opfs.ts';
import {
  idbOpen,
  idbTransactionDone,
} from './idb-helpers.ts';

/**
 * OPFS directory name where the cache files live.
 */
const OPFS_DIRECTORY = 'messages-demo-chunk-cache';

/**
 * IndexedDB database name used when OPFS is unavailable.
 */
const IDB_DB_NAME = 'messages-demo:chunk-cache';

/**
 * Object-store name inside the IDB database.
 */
const IDB_STORE = 'chunks';

/**
 * IDB schema version; bump when the record shape changes.
 */
const IDB_VERSION = 1;

/**
 * Key triple identifying a single cached chunk.
 */
export type ChunkCacheKey = {
  readonly messageId: number;
  readonly revision: number;
  readonly idx: number;
};

/**
 * Sentinel returned by `ChunkCache.get` on a cache miss. A unique
 * `Symbol` rather than `null`: cached HTML is always a string, so
 * callers gate with `=== CACHE_MISS`.
 */
export const CACHE_MISS: unique symbol = Symbol('messages-demo:cache-miss',);

/**
 * Cache public surface. All implementations honour the same contract.
 */
export type ChunkCache = {
  /**
   * Returns the cached HTML for `(messageId, revision, idx)`, or
   * `CACHE_MISS` on miss. Reading a key whose `revision` differs from any
   * previously-cached entries for the same `messageId` evicts the
   * older entries before returning.
   */
  get: (key: ChunkCacheKey,) => Promise<string | typeof CACHE_MISS>;
  /**
   * Writes `html` for `key`. Overwrites a same-key entry.
   */
  put: (
    key: ChunkCacheKey,
    html: string,
  ) => Promise<void>;
  /**
   * Detaches resources (closes IDB if open).
   */
  destroy: () => void;
};

/**
 * Probe results consulted to select the backend.
 */
export type ChunkCacheCaps = {
  readonly opfs: boolean;
  readonly idb: boolean;
};

/**
 * Builds a chunk cache. Honours the storage probe; never throws
 * because of a failed backend; on a setup failure the no-op cache is
 * returned so the composer remains operable.
 *
 * @param input - probe results
 *
 * @returns ready-to-use cache (real or no-op)
 *
 * @example
 * ```ts
 * const cache = await createChunkCache({ caps: { opfs: true, idb: true } });
 * await cache.put({ messageId: 1, revision: 2, idx: 0 }, '<p>hi</p>');
 * await cache.get({ messageId: 1, revision: 2, idx: 0 }); // '<p>hi</p>'
 * ```
 */
export async function createChunkCache(
  input: { readonly caps: ChunkCacheCaps; },
): Promise<ChunkCache> {
  if (input.caps
    .opfs) {
    try {
      return await createOpfsCache();
    }
    catch {
      // OPFS handed back at probe time; if creation now fails (quota,
      // permission revoked between visits), fall through to IDB.
    }
  }
  if (input.caps
    .idb) {
    try {
      return await createIdbCache();
    }
    catch {
      // Same reasoning as OPFS: degrade silently.
    }
  }
  return createNoopCache();
}

/**
 * Builds the OPFS-backed cache. One file per cache key triple; stale
 * entries are removed by listing siblings in the cache directory and
 * dropping those whose revision differs.
 *
 * @returns OPFS-backed cache
 */
async function createOpfsCache(): Promise<ChunkCache> {
  /**
   * OPFS root acquired once and reused by the per-message subdirectory.
   */
  const root = await navigator.storage
    .getDirectory();
  /**
   * Per-package cache directory created on first call; reused across reads and writes.
   */
  const directory = await root.getDirectoryHandle(
    OPFS_DIRECTORY,
    { create: true, },
  );
  return {
    async get(key,) {
      try {
        await evictOpfsStale({
          directory,
          key,
        },);
        /**
         * File handle for the keyed entry; throws when absent so the catch falls through to null.
         */
        const handle = await directory.getFileHandle(opfsName(key,),);
        /**
         * Snapshot the handle's file so its body can be read as text.
         */
        const file = await handle.getFile();
        return await file.text();
      }
      catch {
        return CACHE_MISS;
      }
    },
    async put(
      key,
      html,
    ) {
      try {
        /**
         * File handle, created on first write so puts establish the slot lazily.
         */
        const handle = await directory.getFileHandle(
          opfsName(key,),
          { create: true, },
        );
        /**
         * Writable stream; written once and immediately closed below.
         */
        const writable = await handle.createWritable();
        await writable.write(html,);
        await writable.close();
      }
      catch {
        // Quota or permission errors degrade silently; cache miss next
        // time costs ~30 ms and is still correct.
      }
    },
    destroy() {
      // OPFS handles are not eagerly held; nothing to close.
    },
  };
}

/**
 * Builds the IDB-backed cache. The composite primary key is
 * `[messageId, revision, idx]`; stale-revision eviction iterates the
 * key range bounded to `messageId` and deletes anything with a
 * different revision.
 *
 * @returns IDB-backed cache
 */
async function createIdbCache(): Promise<ChunkCache> {
  /**
   * IDB connection opened once and reused by every get/put/destroy call returned from this factory.
   */
  const db = await openCacheDb();
  return {
    async get(key,) {
      try {
        await evictIdbStale({
          db,
          key,
        },);
        return await idbGet({
          db,
          key,
        },);
      }
      catch {
        return CACHE_MISS;
      }
    },
    async put(
      key,
      html,
    ) {
      try {
        await idbPut({
          db,
          key,
          html,
        },);
      }
      catch {
        // Quota errors degrade silently per probe contract.
      }
    },
    destroy() {
      db.close();
    },
  };
}

/**
 * Returns the no-op cache. Used when both OPFS and IDB are unavailable
 * or when both setup paths fail.
 *
 * @returns cache that always misses on `get` and accepts `put` silently
 */
function createNoopCache(): ChunkCache {
  return {
    get() {
      return Promise.resolve(CACHE_MISS,);
    },
    put() {
      return Promise.resolve();
    },
    destroy() {/* no-op */},
  };
}

//region IDB helpers

/**
 * 9 007 199 254 740 991 (`Number.MAX_SAFE_INTEGER`); ceiling for revision/idx in the messageId-only key range.
 */
const HUGE_KEY_CEILING = Number.MAX_SAFE_INTEGER;

/**
 * Opens (or creates) the IDB database used by the IDB cache backend.
 *
 * @returns open IDB handle
 *
 * @example
 * ```ts
 * const db = await openCacheDb();
 * ```
 */
function openCacheDb(): Promise<IDBDatabase> {
  return idbOpen({
    name: IDB_DB_NAME,
    version: IDB_VERSION,
    onUpgrade(dbConn,) {
      if (!dbConn.objectStoreNames
        .contains(IDB_STORE,)) {
        dbConn.createObjectStore(
          IDB_STORE,
          {
            keyPath: [
              'messageId',
              'revision',
              'idx',
            ],
          },
        );
      }
    },
  },);
}

/**
 * Reads `html` for `key`, returning `CACHE_MISS` on miss.
 *
 * @param input - DB handle and cache key
 *
 * @returns cached HTML or `CACHE_MISS`
 *
 * @example
 * ```ts
 * const html = await idbGet({ db, key });
 * ```
 */
function idbGet(
  input: {
    db: IDBDatabase;
    key: ChunkCacheKey;
  },
): Promise<string | typeof CACHE_MISS> {
  // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- bridges callback API
  return new Promise<string | typeof CACHE_MISS>(function executor(
    resolve,
    reject,
  ) {
    /**
     * Read-only transaction scoped to the chunk store; closes on success callback.
     */
    const tx = input.db
      .transaction(
      IDB_STORE,
      'readonly',
    );
    /**
     * Store handle from the transaction; reused for the keyed get.
     */
    const store = tx.objectStore(IDB_STORE,);
    /**
     * Keyed get request; resolves to the row or `undefined` on miss.
     */
    const request = store.get([
      input.key
        .messageId,
      input.key
        .revision,
      input.key
        .idx,
    ],);
    request.addEventListener(
      'success',
      function onSuccess(): void {
        /**
         * Widened from `any` so the shape narrowing below stays type-safe.
         */
        const raw: unknown = request.result;
        if ((raw === null) || ((typeof raw) !== 'object')
          || (!('html' in raw))) {
          resolve(CACHE_MISS,);
          return;
        }
        /**
         * Destructured after narrowing; required to satisfy the rule.
         */
        const { html, } = raw;
        resolve((typeof html) === 'string' ? html : CACHE_MISS,);
      },
    );
    request.addEventListener(
      'error',
      function onError(): void {
        reject(request.error
          ?? new Error('IDB get failed',),);
      },
    );
  },);
}

/**
 * Writes (or overwrites) the `(key, html)` record.
 *
 * @param input - DB handle, cache key, html payload
 *
 * @example
 * ```ts
 * await idbPut({ db, key, html });
 * ```
 */
async function idbPut(
  input: {
    db: IDBDatabase;
    key: ChunkCacheKey;
    html: string;
  },
): Promise<void> {
  /**
   * Read-write transaction held until `idbTransactionDone` resolves below.
   */
  const tx = input.db
    .transaction(
    IDB_STORE,
    'readwrite',
  );
  tx.objectStore(IDB_STORE,)
    .put({
    messageId: input.key
      .messageId,
    revision: input.key
      .revision,
    idx: input.key
      .idx,
    html: input.html,
  },);
  await idbTransactionDone(tx,);
}

/**
 * Deletes every cached entry for `messageId` whose revision differs
 * from `key.revision`. Iterates the messageId-bounded composite-key
 * range and deletes mismatches in the same transaction.
 *
 * @param input - DB handle and cache key being queried
 *
 * @example
 * ```ts
 * await evictIdbStale({ db, key });
 * ```
 */
async function evictIdbStale(
  input: {
    db: IDBDatabase;
    key: ChunkCacheKey;
  },
): Promise<void> {
  /**
   * Read-write transaction held until `idbTransactionDone` resolves below.
   */
  const tx = input.db
    .transaction(
    IDB_STORE,
    'readwrite',
  );
  /**
   * Store handle reused by the cursor open below.
   */
  const store = tx.objectStore(IDB_STORE,);
  // Composite primary key is [messageId, revision, idx]; bound the
  // cursor to messageId by setting revision/idx to 0..HUGE_KEY_CEILING.
  /**
   * Lower-bound to upper-bound composite key range scoping the cursor to one message.
   */
  const range = IDBKeyRange.bound(
    [
      input.key
        .messageId,
      0,
      0,
    ],
    [
      input.key
        .messageId,
      HUGE_KEY_CEILING,
      HUGE_KEY_CEILING,
    ],
    false,
    false,
  );
  /**
   * Cursor request opened against `range`; success callback fires per cursor advance.
   */
  const cursorRequest = store.openCursor(range,);
  cursorRequest.addEventListener(
    'success',
    function onCursor(): void {
      /**
       * Snapshot of `cursorRequest.result` so each callback reads a stable cursor reference.
       */
      const cursor = cursorRequest.result;
      if (cursor === null)
        return;
      // IDBCursorWithValue.value is typed as any; we widen back to unknown
      // for safe narrowing. Object destructuring would inherit the any
      // type and trip no-unsafe-assignment.
      /* oxlint-disable eslint/prefer-destructuring -- explicit unknown widening */
      /**
       * Widened to `unknown` so the shape check can narrow the row before reading fields.
       */
      const value: unknown = cursor.value;
      /* oxlint-enable eslint/prefer-destructuring */
      if ((value !== null) && ((typeof value) === 'object')
        && ('revision' in value)) {
        /**
         * Destructured after narrowing; the revision compare decides whether to delete this row.
         */
        const { revision, } = value;
        if (((typeof revision) === 'number') && (revision
          !== input
          .key
          .revision))
          cursor.delete();
      }
      cursor.continue();
    },
  );
  await idbTransactionDone(tx,);
}

//endregion
