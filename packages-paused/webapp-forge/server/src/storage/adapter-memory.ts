/**
 * In-memory `Storage` adapter for tests and Phase 1's dev/stress runs.
 *
 * Not durable. Not threadsafe across worker threads. Atomicity is
 * trivial because a JavaScript map assignment is a single statement
 * with no observable intermediate state.
 *
 * The methods return resolved promises rather than declaring `async` so
 * the implementations stay literally synchronous; the `Storage` interface
 * still sees a `Promise<...>` because the network adapters in Phase 2+
 * legitimately need to await I/O.
 */

import type {
  Storage,
  StoragePutItem,
} from './adapter.ts';

/**
 * Creates an in-memory `Storage` implementation backed by a `Map`.
 *
 * @returns fresh, empty in-memory storage
 *
 * @example
 * ```ts
 * const storage = createMemoryStorage();
 * await storage.put('a', new TextEncoder().encode('hello'));
 * const value = await storage.get('a'); // Uint8Array('hello')
 * ```
 */
export function createMemoryStorage(): Storage {
  /**
   * Backing map closed over by every method on the returned adapter.
   */
  const map = new Map<string, Uint8Array>();
  return {
    put(
      key: string,
      body: Uint8Array,
    ): Promise<void> {
      map.set(
        key,
        body,
      );
      return Promise.resolve();
    },
    putBatch(items: readonly StoragePutItem[],): Promise<void> {
      for (const item of items) {
        map.set(
          item.key,
          item.body,
        );
      }
      return Promise.resolve();
    },
    get(key: string,): Promise<Uint8Array | undefined> {
      return Promise.resolve(map.get(key,),);
    },
    delete(key: string,): Promise<void> {
      map.delete(key,);
      return Promise.resolve();
    },
    list(prefix: string,): Promise<string[]> {
      return Promise.resolve(
        [...map.keys(),]
          .filter(function hasPrefix(key,) {
            return key.startsWith(prefix,);
          },)
          .toSorted(),
      );
    },
  };
}
