/**
 * Promise bridges for the event-based IndexedDB API.
 *
 * IndexedDB predates promises and signals completion only through `onsuccess`
 * and `onerror` handlers, so awaiting it requires wrapping each request and
 * transaction in a promise once, here, instead of scattering handler wiring
 * through the sink.
 *
 * @module
 */

/**
 * Resolves with an IndexedDB request's result once it succeeds, rejecting
 * with the request's error when it fails.
 *
 * @param request - Pending IndexedDB request.
 *
 * @returns Result the request produces.
 *
 * @throws DOMException - Whatever the backend attaches to a failed request.
 *
 * @example
 * ```ts
 * const key = await awaitRequest(store.add(batch));
 * ```
 */
export function awaitRequest<T,>(request: IDBRequest<T>,): Promise<T> {
  return new Promise(function bridgeRequest(resolve, reject,) {
    request.onsuccess = function resolveResult(): void {
      resolve(request.result,);
    };
    request.onerror = function rejectError(): void {
      reject(request.error ?? new Error('IndexedDB request failed without an error object',),);
    };
  },);
}

/**
 * Resolves once an IndexedDB transaction commits, rejecting when it errors or
 * aborts, so a caller can await durability of everything queued on it.
 *
 * @param transaction - Transaction whose settlement is awaited.
 *
 * @throws DOMException - Whatever the backend attaches to a failed or aborted
 * transaction.
 *
 * @example
 * ```ts
 * const transaction = database.transaction('batch', 'readwrite');
 * transaction.objectStore('batch').add(batch);
 * await awaitTransaction(transaction);
 * ```
 */
export function awaitTransaction(transaction: IDBTransaction,): Promise<void> {
  return new Promise(function bridgeTransaction(resolve, reject,) {
    transaction.oncomplete = function resolveCommit(): void {
      resolve();
    };
    transaction.onerror = function rejectError(): void {
      reject(transaction.error ?? new Error('IndexedDB transaction failed without an error object',),);
    };
    transaction.onabort = function rejectAbort(): void {
      reject(transaction.error ?? new Error('IndexedDB transaction aborted without an error object',),);
    };
  },);
}
