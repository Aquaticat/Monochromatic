// Not extracted to the types tree: this is a key-only eviction tracker, not a
// general-purpose LRU cache. Use cases like HTTP response caches or image
// thumbnail caches are already served by memoize itself:
//
//   const cachedFetch = memoize({
//     fn: fetchData,
//     keyFn: (url) => url,
//     salt: String(Math.floor(Date.now() / HOUR_MS)),
//   });

/**
 * Ordered key set that tracks LRU access order.
 * Uses a `Map<string, true>` so JS insertion-order iteration gives LRU semantics.
 * Does not store values -- the Store handles that.
 *
 * @example
 * ```ts
 * const lru = createLruKeySet(1024, (key) => store.delete(key));
 * lru.touch('my-key');
 * ```
 */
export type LruKeySet = {
  /** Mark a key as recently accessed. Evicts oldest if over capacity. */
  touch: (key: string,) => void;
  /** Remove a key from tracking. */
  remove: (key: string,) => void;
  /** Clear all tracked keys. */
  clear: () => void;
};

/**
 * Create an LRU key set that evicts the oldest key when capacity is exceeded.
 *
 * @param maxSize - maximum tracked keys before eviction
 * @param onEvict - callback fired when a key is evicted (used to clean the Store)
 * @returns LRU key set
 *
 * @example
 * ```ts
 * const lru = createLruKeySet(256, (key) => { void store.delete(key); });
 * ```
 */
export function createLruKeySet(
  maxSize: number,
  onEvict: (key: string,) => void,
): LruKeySet {
  /** Ordered set using Map for insertion-order iteration. */
  const keys = new Map<string, true>();

  return {
    touch(key: string,): void {
      keys.delete(key,);
      keys.set(key, true,);

      if (keys.size > maxSize) {
        const oldest = keys.keys().next();
        if (!oldest.done) {
          keys.delete(oldest.value,);
          onEvict(oldest.value,);
        }
      }
    },

    remove(key: string,): void {
      keys.delete(key,);
    },

    clear(): void {
      keys.clear();
    },
  };
}
