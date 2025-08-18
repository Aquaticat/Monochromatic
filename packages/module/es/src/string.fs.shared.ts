import type { Promisable, } from 'type-fest';
import type { MaybeAsyncIterableIterator, } from './iterable.basic.ts';
import type { NonEmptyString, } from './string.general.ts';
import {
  consoleLogger,
  type Logger,
} from './string.log.ts';
import { randomUUID, } from './string.random.ts';

/**
 * Interface for string-based key-value storage with filesystem-like operations.
 * Provides a consistent API for different storage backends (memory, filesystem, database).
 * All operations are potentially async to support various storage implementations.
 *
 * @example
 * ```ts
 * const storage = getMemoryStringFs();
 * await storage.set('config', 'value');
 * const value = await storage.get('config'); // 'value'
 * ```
 */
export type StringFs = {
  /** Retrieves value for the specified key */
  get(key: string,): Promisable<string | undefined>;
  /** Stores value under the specified key */
  set(key: string, value: string,): Promisable<unknown>;
  /** Removes the key-value pair for the specified key */
  delete(key: string,): Promisable<unknown>;
  /** Iterates all available keys in the storage */
  keys(): MaybeAsyncIterableIterator<string>;
  /** Unique identifier for this storage instance */
  id?: NonEmptyString;
};

/**
 * Creates an in-memory StringFs implementation using Map data structure.
 * Data is stored in memory and will be lost when the process exits.
 * Useful for temporary storage, caching, or testing scenarios.
 *
 * @param options - Configuration options for the memory storage
 * @param options.map - Existing Map instance to use for storage
 * @param options.l - Logger instance for tracing operations
 * @param options.id - Unique identifier for this storage instance
 * @returns StringFs implementation backed by Map
 *
 * @example
 * ```ts
 * // Basic usage
 * const storage = getMemoryStringFs();
 * storage.set('user:123', 'John Doe');
 * const name = storage.get('user:123'); // 'John Doe'
 *
 * // With custom configuration
 * const customStorage = getMemoryStringFs({
 *   id: 'session-cache',
 *   map: new Map([['initial', 'value']])
 * });
 * ```
 */
export function getMemoryStringFs(
  { map: passedMap, l: passedL, id: passedId, }: { map?: Map<string, string>; l?: Logger;
    id?: string; } = {},
): StringFs {
  /** Logger instance for tracing storage operations */
  const l: Logger = passedL ?? consoleLogger;
  l.trace('getMemoryStringFs',);

  /** Unique identifier for this storage instance, generated if not provided */
  const id = passedId ?? randomUUID();
  /** Map instance for storing key-value pairs in memory */
  const map: Map<string, string> = passedMap ?? new Map<string, string>();

  return {
    id,
    get(key: string,): string | undefined {
      try {
        return map.get(key,);
      }
      catch (error: unknown) {
        throw new Error('get', { cause: error, },);
      }
    },
    set(key: string, value: string,): void {
      try {
        map.set(key, value,);
      }
      catch (error: unknown) {
        throw new Error('set', { cause: error, },);
      }
    },
    delete(key: string,): void {
      try {
        map.delete(key,);
      }
      catch (error: unknown) {
        throw new Error('delete', { cause: error, },);
      }
    },
    keys: map.keys.bind(map,),
  };
}
