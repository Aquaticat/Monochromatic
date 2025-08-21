/**
 * Opens IndexedDB database with proper error handling.
 * @param dbName - Database name
 * @param storeName - Object store name
 * @returns Promise resolving to IDBDatabase
 */
export async function indexedDbOpen(dbName: string, storeName: string,): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject,) => {
    const request = indexedDB.open(dbName, 1,);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB', { cause: request.error, },),);
    };

    request.onsuccess = () => {
      resolve(request.result,);
    };

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName,))
        database.createObjectStore(storeName,);
    };
  },);
}
