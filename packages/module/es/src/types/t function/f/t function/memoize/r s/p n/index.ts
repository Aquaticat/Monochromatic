import type {
  MemoizeOptions,
  MemoizedFunction,
} from '../../t/index.ts';
import { DEFAULT_MAX_CACHE_SIZE, } from '../../t/index.ts';
import type { $ as SyncStore, } from '../../../../../../t object/t store/t/r s/index.ts';
import { $ as createSyncStore, } from '../../../../../../t object/t store/f/t store/r s/p n/index.ts';

/**
 * Build the full cache key from keyFn output and salt.
 *
 * @param argKey - key derived from function arguments via keyFn
 * @param salt - salt value to append
 * @returns composite cache key
 *
 * @example
 * ```ts
 * buildCacheKey('arg-key', 'v1'); // 'arg-key:v1'
 * ```
 */
function buildCacheKey(argKey: string, salt: string | number,): string {
  return `${argKey}:${String(salt)}`;
}

/**
 * LRU key set that tracks access order via a `Map<string, true>`.
 * On `touch`, refreshes position; evicts oldest when over capacity and
 * also removes the evicted key from the store.
 *
 * @example
 * ```ts
 * const lru = createLruKeySet(1024, store);
 * lru.touch('my-key');
 * ```
 */
type LruKeySet = {
  /** Mark a key as recently accessed. Evicts oldest if over capacity. */
  touch: (key: string,) => void;
  /** Remove a key from tracking (does not touch the store). */
  remove: (key: string,) => void;
  /** Clear all tracked keys (does not touch the store). */
  clear: () => void;
};

/**
 * Create an LRU key set backed by a SyncStore for eviction.
 *
 * @param maxSize - maximum tracked keys before eviction
 * @param store - sync store to evict from when capacity is exceeded
 * @returns LRU key set
 *
 * @example
 * ```ts
 * const lru = createLruKeySet(256, store);
 * ```
 */
function createLruKeySet(maxSize: number, store: SyncStore,): LruKeySet {
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
          store.delete(oldest.value,);
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

/**
 * Named-parameter options for sync memoization.
 * Includes the function to memoize alongside configuration.
 *
 * @typeParam TArgs - tuple of function argument types
 * @typeParam TReturn - function return type
 * @typeParam TSalt - salt value type
 *
 * @example
 * ```ts
 * const opts: MemoizeNamedOptions<[number], number, string> = {
 *   fn: (x) => x * 2,
 *   keyFn: (x) => String(x),
 *   salt: 'v1',
 * };
 * ```
 */
export type MemoizeNamedOptions<
  TArgs extends readonly unknown[],
  TReturn,
  TSalt extends string | number = string,
> = MemoizeOptions<TArgs, TSalt> & {
  /** Pure synchronous function to memoize. */
  fn: (this: void, ...args: TArgs) => TReturn;
};

/**
 * Wraps a synchronous function with memoization using a SyncStore backend,
 * LRU eviction, and salt-based cache keys.
 *
 * The `keyFn` option is required to compute cache keys from arguments.
 * This prevents accidental memoization of variadic functions without explicit key derivation.
 * The `salt` parameter is appended to every cache key; changing salt invalidates the cache.
 *
 * The `fn` parameter is typed with `this: void` to disallow method-style memoization
 * where `this` binding would cause incorrect caching.
 *
 * @typeParam TArgs - tuple of function argument types
 * @typeParam TReturn - function return type
 * @typeParam TSalt - salt value type
 * @param options - function and memoization configuration
 * @returns memoized function with `.store`, `.clear()`, `.delete()`, `.size`
 *
 * @remarks
 * Memoizing impure functions (those with side effects or non-deterministic results)
 * produces incorrect results. Only memoize pure functions.
 *
 * @example
 * Basic usage:
 * ```ts
 * const memoizedAdd = $({
 *   fn: (a: number, b: number) => a + b,
 *   keyFn: (a, b) => `${String(a)}:${String(b)}`,
 *   salt: 'v1',
 * });
 * memoizedAdd(1, 2); // computed: 3
 * memoizedAdd(1, 2); // cached: 3
 * ```
 *
 * @example
 * Time-based salt for hourly cache invalidation:
 * ```ts
 * const HOUR_MS = 3_600_000;
 * const memoized = $({
 *   fn: expensiveCompute,
 *   keyFn: (input) => input,
 *   salt: String(Math.floor(Date.now() / HOUR_MS)),
 * });
 * ```
 *
 * @example
 * Custom store and max size:
 * ```ts
 * import { $ as createSyncStore } from '../../t object/t store/f/t store/r s/p n/index.ts';
 * const store = createSyncStore({ storeId: 'my-memo' });
 * const memoized = $({
 *   fn: compute,
 *   keyFn: (x) => String(x),
 *   salt: 'v1',
 *   maxSize: 256,
 *   store,
 * });
 * ```
 */
export function $<
  const TArgs extends readonly unknown[],
  const TReturn,
  const TSalt extends string | number = string,
>(
  this: void,
  options: MemoizeNamedOptions<TArgs, TReturn, TSalt>,
): MemoizedFunction<TArgs, TReturn> {
  const { fn, keyFn, salt, } = options;
  const maxSize = options.maxSize ?? DEFAULT_MAX_CACHE_SIZE;
  const store: SyncStore = options.store ?? createSyncStore({ storeId: `memoize-${crypto.randomUUID()}`, },);

  /** LRU key set that evicts oldest store entries at capacity. */
  const lru = createLruKeySet(maxSize, store,);

  /**
   * Memoized wrapper that checks the store before calling the original function.
   */
  function memoized(this: void, ...args: TArgs): TReturn {
    const cacheKey = buildCacheKey(keyFn(...args,), salt,);

    const cached = store.get<TReturn>(cacheKey,);
    if (cached !== undefined) {
      lru.touch(cacheKey,);
      return cached;
    }

    const result = fn(...args,);
    store.set(cacheKey, result,);
    lru.touch(cacheKey,);
    return result;
  }

  memoized.store = store;

  memoized.clear = function clear(): void {
    lru.clear();
    store.clear();
  };

  memoized.delete = function deleteCacheEntry(key: string,): void {
    lru.remove(key,);
    store.delete(key,);
  };

  Object.defineProperty(memoized, 'size', {
    get(): number {
      return store.size;
    },
    enumerable: true,
    configurable: false,
  },);

  return memoized as MemoizedFunction<TArgs, TReturn>;
}
