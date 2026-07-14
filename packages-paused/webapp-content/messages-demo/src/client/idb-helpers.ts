/**
 * Tiny IndexedDB Promise wrappers shared by `outbox.ts` and
 * `chunk-cache.ts`.
 *
 * The native IndexedDB API is event-callback based; every operation
 * (`open`, `get`, `put`, cursor walks) returns an `IDBRequest` that
 * fires `success` / `error` events. These two helpers funnel that
 * boilerplate into one place so the storage modules stay focused on
 * domain logic.
 */

/**
 * Awaits a single `IDBRequest`, returning its `result` on success or
 * rejecting with its `error` on failure.
 *
 * @param request - the request returned by an IDB call
 *
 * @returns the request's typed result
 *
 * @example
 * ```ts
 * const value = await idbRequestResult(store.get(key));
 * ```
 */
export function idbRequestResult<T,>(request: IDBRequest<T>,): Promise<T> {
  // IndexedDB only exposes an event-callback API; the Promise
  // constructor is the only reasonable bridge.
  // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- bridges callback API
  return new Promise<T>(function executor(
    resolve,
    reject,
  ) {
    request.addEventListener(
      'success',
      function onSuccess(): void {
        resolve(request.result,);
      },
    );
    request.addEventListener(
      'error',
      function onError(): void {
        reject(request.error
          ?? new Error('IDB request failed',),);
      },
    );
  },);
}

/**
 * Awaits an `IDBTransaction`, resolving when it completes or rejecting
 * when it fires its `error` event.
 *
 * @param tx - the transaction to await
 *
 * @example
 * ```ts
 * const tx = db.transaction(STORE, 'readwrite');
 * tx.objectStore(STORE).put(record);
 * await idbTransactionDone(tx);
 * ```
 */
export function idbTransactionDone(tx: IDBTransaction,): Promise<void> {
  // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- bridges callback API
  return new Promise<void>(function executor(
    resolve,
    reject,
  ) {
    tx.addEventListener(
      'complete',
      function onComplete(): void {
        resolve();
      },
    );
    tx.addEventListener(
      'error',
      function onError(): void {
        reject(tx.error
          ?? new Error('IDB transaction failed',),);
      },
    );
  },);
}

/**
 * Opens an IDB database, running `onUpgrade` when the schema version
 * changes. Wraps the open request in a Promise.
 *
 * @param input - database name, schema version, upgrade callback
 *
 * @returns the opened database connection
 *
 * @example
 * ```ts
 * const db = await idbOpen({
 *   name: 'my-db',
 *   version: 1,
 *   onUpgrade(dbConn) {
 *     dbConn.createObjectStore('items', { keyPath: 'id' });
 *   },
 * });
 * ```
 */
export function idbOpen(
  input: {
    name: string;
    version: number;
    onUpgrade: (dbConn: IDBDatabase,) => void;
  },
): Promise<IDBDatabase> {
  // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- bridges callback API
  return new Promise<IDBDatabase>(function executor(
    resolve,
    reject,
  ) {
    /**
     * Held to attach upgrade, success, and error listeners before the request resolves.
     */
    const request = indexedDB.open(
      input.name,
      input.version,
    );
    request.addEventListener(
      'upgradeneeded',
      function onUpgrade(): void {
        input.onUpgrade(request.result,);
      },
    );
    request.addEventListener(
      'success',
      function onSuccess(): void {
        resolve(request.result,);
      },
    );
    request.addEventListener(
      'error',
      function onError(): void {
        reject(request.error
          ?? new Error('IDB open failed',),);
      },
    );
  },);
}
