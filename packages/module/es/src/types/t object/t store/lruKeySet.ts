/**
 * Ordered key set that tracks LRU access order.
 * Uses a `Set<string>` so JS insertion-order iteration gives LRU semantics.
 * Does not store values -- the Store handles that.
 *
 * @example
 * ```ts
 * const lru = createLruKeySet(1024);
 * const evicted = lru.touch('my-key');
 * ```
 */
export type LruKeySet = {
  /** Mark a key as recently accessed. Returns evicted key if over capacity. */
  touch: (key: string,) => string | undefined;
  /** Remove a key from tracking. */
  remove: (key: string,) => void;
  /** Clear all tracked keys. */
  clear: () => void;
};

/**
 * Create an LRU key set that evicts the oldest key when capacity is exceeded.
 *
 * @param maxSize - maximum tracked keys before eviction
 *
 * @returns LRU key set where {@link LruKeySet.touch} returns evicted key or undefined
 *
 * @example
 * ```ts
 * const lru = createLruKeySet(256);
 * const evicted = lru.touch('new-key');
 * if (evicted !== undefined) {
 *   store.delete(evicted);
 * }
 * ```
 */
export function createLruKeySet(
  maxSize: number,
): LruKeySet {
  /** Ordered set for insertion-order iteration. */
  const keys = new Set<string>();

  return {
    touch(key: string,): string | undefined {
      keys.delete(key,);
      keys.add(key,);

      if (keys.size > maxSize) {
        const oldest = keys.values().next();
        // oxlint-disable-next-line typescript/strict-boolean-expressions -- IteratorResult.done is boolean|undefined
        if (!oldest.done) {
          keys.delete(oldest.value,);
          return oldest.value;
        }
      }

      return undefined;
    },

    remove(key: string,): void {
      keys.delete(key,);
    },

    clear(): void {
      keys.clear();
    },
  };
}
