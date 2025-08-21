import { pathJoin, } from '@monochromatic-dev/module-es/fs.pathJoin.ts';
import {
  indexedDbExecuteTransaction,
} from '../../../indexedDb/indexedDb.executeTransaction.ts';
import { indexedDbOpen, } from '../../../indexedDb/indexedDb.open.ts';
import {
  consoleLogger,
  type Logger,
} from '../../custom/object/logger/basic.ts';
import { arrayRange, } from './array.range.ts';
import { unary, } from './function.nary.ts';
import * as shared from './string.fs.shared.ts';
import { isString, } from './string.is.ts';
import { randomUUID, } from './string.random.ts';

/**
 * Creates a StringFs implementation using Web Storage API (localStorage or sessionStorage).
 * Provides persistent string storage in browsers with automatic namespacing using unique IDs.
 * Storage keys are prefixed with the instance ID to prevent conflicts between different StringFs instances.
 *
 * @param options - Configuration options for Web Storage StringFs
 * @param options.storage - Storage instance to use (defaults to localStorage)
 * @param options.l - Logger instance for tracing operations
 * @param options.id - Unique identifier for this storage instance (auto-generated if not provided)
 * @returns StringFs implementation backed by Web Storage API
 * @throws Error when storage initialization fails or storage quota is exceeded
 *
 * @example
 * ```ts
 * // Using default localStorage
 * const fs = getWebStorageStringFs({});
 * await fs.set('config', '{"theme": "dark"}');
 * const config = await fs.get('config'); // '{"theme": "dark"}'
 *
 * // Using sessionStorage with custom ID
 * const sessionFs = getWebStorageStringFs({
 *   storage: sessionStorage,
 *   id: 'my-app-session'
 * });
 * ```
 */
export function getWebStorageStringFs(
  { storage: passedStorage, l: passedL, id: passedId, }: { storage?: Storage; l?: Logger;
    id?: string; },
): shared.StringFs {
  /** Logger instance for tracing storage operations and debugging */
  const l: Logger = passedL ?? consoleLogger;
  /** Storage instance (localStorage or sessionStorage) used for actual data persistence */
  const storage: Storage = passedStorage ?? globalThis.localStorage;
  l.trace('getWebStorageStringFs',);

  /** Unique identifier used as namespace prefix for all storage keys to prevent conflicts */
  const id = passedId ?? randomUUID();
  try {
    storage.setItem(pathJoin(id, randomUUID(),), JSON.stringify([],),);
  }
  catch (error: unknown) {
    throw new Error('init', { cause: error, },);
  }

  return {
    id,
    get(key: string,): string | undefined {
      try {
        /** Raw value retrieved from storage - can be null if key doesn't exist */
        const value = storage.getItem(pathJoin(id, key,),);
        if (value === null)
          return undefined;
        return value;
      }
      catch (error: unknown) {
        throw new Error('get', { cause: error, },);
      }
    },
    set(key: string, value: string,): void {
      try {
        storage.setItem(pathJoin(id, key,), value,);
      }
      catch (error) {
        throw new Error('set', { cause: error, },);
      }
    },
    delete(key: string,): void {
      try {
        storage.removeItem(pathJoin(id, key,),);
      }
      catch (error) {
        throw new Error('delete', { cause: error, },);
      }
    },
    keys(): string[] {
      /** Array of all storage keys mapped from storage indices - may contain null values that need filtering */
      const keys = arrayRange(storage.length,).map(unary(storage.key.bind(storage,),),);
      if (keys.every(unary(isString,),))
        return keys as string[];
      throw new Error(`invalid ${JSON.stringify(keys,)}`,);
    },
  };
}

/**
 * Creates a StringFs implementation using Origin Private File System (OPFS).
 * Provides persistent file-based storage in browsers with high performance and larger storage capacity.
 * Each StringFs instance creates its own directory within OPFS to prevent conflicts.
 *
 * @param options - Configuration options for OPFS StringFs
 * @param options.opfsRoot - Root directory handle for OPFS (auto-obtained if not provided)
 * @param options.l - Logger instance for tracing operations
 * @param options.id - Unique identifier for this storage instance (auto-generated if not provided)
 * @returns Promise resolving to StringFs implementation backed by OPFS
 * @throws Error when OPFS is not available, directory creation fails, or file operations fail
 *
 * @example
 * ```ts
 * // Using default OPFS root
 * const fs = await getOpfsStringFs({});
 * await fs.set('large-data.json', JSON.stringify(bigObject));
 * const data = await fs.get('large-data.json');
 *
 * // Using custom OPFS directory
 * const customRoot = await navigator.storage.getDirectory();
 * const customFs = await getOpfsStringFs({
 *   opfsRoot: customRoot,
 *   id: 'my-app-files'
 * });
 * ```
 */
export async function getOpfsStringFs(
  { opfsRoot: passedOpfsRoot, l: passedL, id: passedId, }: {
    opfsRoot?: FileSystemDirectoryHandle;
    l?: Logger;
    id?: string;
  },
): Promise<shared.StringFs> {
  /** Logger instance for tracing OPFS operations and debugging directory access */
  const l: Logger = passedL ?? consoleLogger;
  l.trace('getOpfsStringFs',);

  /** Unique identifier used as directory name within OPFS root for storage isolation */
  const id = passedId ?? randomUUID();

  /** Root directory handle for Origin Private File System - obtained from navigator if not provided */
  const opfsRoot: FileSystemDirectoryHandle = passedOpfsRoot
    ?? await (async function getOpfsRoot(): Promise<FileSystemDirectoryHandle> {
      try {
        return await navigator.storage.getDirectory();
      }
      catch (error: unknown) {
        throw new Error('getOpfsRoot', { cause: error, },);
      }
    })();

  /** Project-specific directory handle created within OPFS root for this StringFs instance */
  const directory = await (async function getProjectDirectory(
    opfsRoot: FileSystemDirectoryHandle,
  ): Promise<FileSystemDirectoryHandle> {
    try {
      return await opfsRoot.getDirectoryHandle(id, { create: true, },);
    }
    catch (error: unknown) {
      throw new Error('getProjectDirectory', { cause: error, },);
    }
  })(opfsRoot,);

  return {
    id,
    async get(key: string,): Promise<string | undefined> {
      try {
        /** File handle for the requested key - throws NotFoundError if file doesn't exist */
        const fileHandle = await directory.getFileHandle(key, { create: false, },);
        /** File object containing the actual file data from OPFS */
        const file = await fileHandle.getFile();
        return await file.text();
      }
      catch (error: unknown) {
        // File not found is expected, return undefined
        if (error instanceof Error && error.name === 'NotFoundError')
          return undefined;
        throw new Error('get', { cause: error, },);
      }
    },
    async set(key: string, value: string,): Promise<void> {
      try {
        /** File handle for the target key - creates file if it doesn't exist */
        const fileHandle = await directory.getFileHandle(key, { create: true, },);
        /** Writable stream for writing data to the file atomically */
        const writable = await fileHandle.createWritable();
        await writable.write(value,);
        await writable.close();
      }
      catch (error: unknown) {
        throw new Error('set', { cause: error, },);
      }
    },
    async delete(key: string,): Promise<void> {
      try {
        await directory.removeEntry(key,);
      }
      catch (error: unknown) {
        // File not found is expected, ignore
        if (error instanceof Error && error.name === 'NotFoundError')
          return;
        throw new Error('delete', { cause: error, },);
      }
    },
    async keys(): Promise<string[]> {
      try {
        /** Async iterable of directory entries containing file names and handles */
        // @ts-expect-error -- OPFS API values() method exists but TypeScript types are incomplete
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- OPFS API doesn't have complete TypeScript types
        const entries = directory.values() as AsyncIterable<FileSystemHandle>;
        return await Array.fromAsync(entries, handle => handle.name,);
      }
      catch (error: unknown) {
        throw new Error('keys', { cause: error, },);
      }
    },
  };
}

/**
 * Creates a StringFs implementation using IndexedDB for structured storage.
 * Provides persistent database-backed storage with transaction support and offline capabilities.
 * Each StringFs instance uses its own object store within the database for isolation.
 *
 * @param options - Configuration options for IndexedDB StringFs (all optional)
 * @param options.db - Database connection to use (auto-created if not provided)
 * @param options.l - Logger instance for tracing operations
 * @param options.id - Unique identifier for this storage instance (auto-generated if not provided)
 * @returns Promise resolving to StringFs implementation backed by IndexedDB
 * @throws Error when IndexedDB is not available, database operations fail, or transactions error
 *
 * @example
 * ```ts
 * // Using default database
 * const fs = await getIndexedDbStringFs();
 * await fs.set('user-settings', JSON.stringify(settings));
 * const keys = await fs.keys(); // ['user-settings']
 *
 * // Using existing database connection
 * const db = await indexedDbOpen('MyAppDB', 'my-store');
 * const dbFs = await getIndexedDbStringFs({
 *   db,
 *   id: 'config-store'
 * });
 * ```
 */
export async function getIndexedDbStringFs(
  { db: passedDb, l: passedL, id: passedId, }: {
    db?: IDBDatabase;
    l?: Logger;
    id?: string;
  } = {},
): Promise<shared.StringFs> {
  /** Logger instance for tracing IndexedDB operations and transaction debugging */
  const l: Logger = passedL ?? consoleLogger;
  l.trace('getIndexedDbStringFs',);

  /** Unique identifier used as object store name within IndexedDB for data isolation */
  const id = passedId ?? randomUUID();

  /** IndexedDB database instance - created with default name if not provided */
  const db: IDBDatabase = passedDb
    ?? await (async function openDefaultDb(): Promise<IDBDatabase> {
      try {
        return await indexedDbOpen('StringFsDB', id,); // Use id as store name
      }
      catch (error: unknown) {
        throw new Error('openDefaultDb', { cause: error, },);
      }
    })();

  return {
    id,
    async get(key: string,): Promise<string | undefined> {
      try {
        /** Retrieved value from IndexedDB store - undefined if key doesn't exist */
        const result = await indexedDbExecuteTransaction<string | undefined>(
          db,
          id, // Use id as store name
          'readonly',
          store => store.get(key,), // No pathJoin needed - each instance has its own store
        );
        return result;
      }
      catch (error: unknown) {
        throw new Error('get', { cause: error, },);
      }
    },
    async set(key: string, value: string,): Promise<void> {
      try {
        await indexedDbExecuteTransaction(
          db,
          id, // Use id as store name
          'readwrite',
          store => store.put(value, key,), // No pathJoin needed
        );
      }
      catch (error: unknown) {
        throw new Error('set', { cause: error, },);
      }
    },
    async delete(key: string,): Promise<void> {
      try {
        await indexedDbExecuteTransaction(
          db,
          id, // Use id as store name
          'readwrite',
          store => store.delete(key,), // No pathJoin needed
        );
      }
      catch (error: unknown) {
        throw new Error('delete', { cause: error, },);
      }
    },
    async keys(): Promise<string[]> {
      try {
        /** All keys retrieved from the IndexedDB object store for this StringFs instance */
        const allKeys = await indexedDbExecuteTransaction(
          db,
          id, // Use id as store name
          'readonly',
          store => store.getAllKeys(),
        );

        return allKeys as string[]; // No filtering needed - each instance has its own store
      }
      catch (error: unknown) {
        throw new Error('keys', { cause: error, },);
      }
    },
  };
}

export * from './string.fs.shared.ts';
