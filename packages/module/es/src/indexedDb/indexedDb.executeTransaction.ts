/**
 * IndexedDB utility for executing transactions with proper error handling.
 */

/**
 * Executes IndexedDB transaction operation.
 * @param db - Database instance
 * @param storeName - Object store name
 * @param mode - Transaction mode
 * @param operation - Function that performs operation on object store
 * @returns Promise resolving to operation result
 */
export async function indexedDbExecuteTransaction<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction([storeName], mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);

    request.onerror = () => {
      reject(new Error('IndexedDB operation failed', { cause: request.error }));
    };

    request.onsuccess = () => {
      resolve(request.result as T);
    };
  });
}