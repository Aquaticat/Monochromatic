import type {
  MemoizeAsyncOptions,
  MemoizedAsyncFunction,
} from '../../t/index.ts';
import { DEFAULT_MAX_CACHE_SIZE, } from '../../t/index.ts';
import type { $ as Store, } from '../../../../../../t object/t store/t/r a/index.ts';
import { $ as createStore, } from '../../../../../../t object/t store/f/t store/r a/p n/index.ts';

/**
 * Build the full cache key from keyFn output and resolved salt.
 *
 * @param argKey - key derived from function arguments via keyFn
 * @param salt - resolved salt value to append
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
type LruKeySet = {
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
function createLruKeySet(
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

/**
 * Named-parameter options for async memoization.
 * Includes the function to memoize alongside configuration.
 *
 * @typeParam TArgs - tuple of function argument types
 * @typeParam TReturn - resolved return type (not wrapped in Promise)
 * @typeParam TSalt - salt value type
 *
 * @example
 * ```ts
 * const opts: MemoizeAsyncNamedOptions<[string], User, string> = {
 *   fn: fetchUser,
 *   keyFn: (id) => id,
 *   salt: 'v1',
 * };
 * ```
 */
export type MemoizeAsyncNamedOptions<
  TArgs extends readonly unknown[],
  TReturn,
  TSalt extends string | number = string,
> = MemoizeAsyncOptions<TArgs, TSalt> & {
  /** Pure async function to memoize. */
  fn: (this: void, ...args: TArgs) => Promise<TReturn>;
};

/**
 * Wraps an async function with memoization using LRU eviction, salt-based cache keys,
 * and in-flight Promise deduplication.
 *
 * The `keyFn` option is required to compute cache keys from arguments.
 * The `salt` parameter can be a `Promise`, enabling patterns like
 * `await fetchData({salt: time%1h})` for time-based cache invalidation.
 *
 * Uses the Store as the single source of truth for cached values.
 * An in-flight `Map` deduplicates concurrent calls with the same key.
 * An LRU key set tracks access order and evicts from the Store at capacity.
 *
 * The `fn` parameter is typed with `this: void` to disallow method-style memoization
 * where `this` binding would cause incorrect caching.
 *
 * @typeParam TArgs - tuple of function argument types
 * @typeParam TReturn - resolved return type (not wrapped in Promise)
 * @typeParam TSalt - salt value type
 * @param options - function and memoization configuration
 * @returns memoized async function with `.store`, `.clear()`, `.delete()`
 *
 * @remarks
 * Memoizing impure functions (those with side effects or non-deterministic results)
 * produces incorrect results. Only memoize pure functions.
 *
 * @example
 * Basic usage:
 * ```ts
 * const memoized = await $({
 *   fn: fetchUser,
 *   keyFn: (id) => id,
 *   salt: 'v1',
 * });
 * await memoized('user-1'); // fetched
 * await memoized('user-1'); // cached
 * ```
 *
 * @example
 * Time-based salt via Promise:
 * ```ts
 * const HOUR_MS = 3_600_000;
 * const memoized = await $({
 *   fn: expensiveFetch,
 *   keyFn: (url) => url,
 *   salt: Promise.resolve(String(Math.floor(Date.now() / HOUR_MS))),
 * });
 * ```
 *
 * @example
 * Custom Store backend:
 * ```ts
 * import { $ as createStore } from '../../t object/t store/f/t store/r a/p n/index.ts';
 * const store = await createStore({ storeId: 'fetch-cache' });
 * const memoized = await $({
 *   fn: fetchData,
 *   keyFn: (id) => id,
 *   salt: 'v1',
 *   store,
 * });
 * ```
 */
export async function $<
  const TArgs extends readonly unknown[],
  const TReturn,
  const TSalt extends string | number = string,
>(
  this: void,
  options: MemoizeAsyncNamedOptions<TArgs, TReturn, TSalt>,
): Promise<MemoizedAsyncFunction<TArgs, TReturn>> {
  const { fn, keyFn, salt, } = options;
  const maxSize = options.maxSize ?? DEFAULT_MAX_CACHE_SIZE;
  const store: Store = options.store ?? await createStore({ storeId: `memoize-${crypto.randomUUID()}`, },);

  /** In-flight promises for deduplication of concurrent calls. */
  const inflight = new Map<string, Promise<TReturn>>();

  /** LRU key set that evicts oldest Store entries at capacity. */
  const lru = createLruKeySet(maxSize, function onEvict(evictedKey,) {
    // Fire-and-forget: clean persistent store when LRU evicts.
    // Intentional void: store.delete is async but eviction callback is synchronous.
    void store.delete(evictedKey,);
  },);

  /**
   * Eagerly resolve salt so it's available synchronously on subsequent calls.
   * Intentional let: caches the resolved salt value after first resolution.
   */
  // eslint-disable-next-line prefer-const -- intentional: caches after first await
  let resolvedSaltCache: string | number | undefined;

  /** Promise that resolves salt exactly once. */
  const saltReady: Promise<string | number> = (async function resolveSalt(): Promise<string | number> {
    const resolved = await salt;
    resolvedSaltCache = resolved;
    return resolved;
  })();

  /**
   * Core computation: checks Store, then calls fn. Manages inflight map.
   *
   * @param cacheKey - full cache key
   * @param args - original function arguments
   * @returns cached or freshly computed result
   */
  async function resolveValue(cacheKey: string, args: TArgs,): Promise<TReturn> {
    try {
      const stored = await store.get<TReturn>(cacheKey,);
      if (stored !== undefined) {
        lru.touch(cacheKey,);
        return stored;
      }

      const result = await fn(...args,);
      await store.set(cacheKey, result,);
      lru.touch(cacheKey,);
      return result;
    } catch (error: unknown) {
      inflight.delete(cacheKey,);
      throw error;
    } finally {
      inflight.delete(cacheKey,);
    }
  }

  /**
   * Dispatch a cache lookup + compute for the given key.
   * If an inflight promise already exists for this key, returns it (deduplication).
   *
   * @param cacheKey - full cache key
   * @param args - original function arguments
   * @returns promise resolving to the cached or computed value
   */
  function dispatch(cacheKey: string, args: TArgs,): Promise<TReturn> {
    const existing = inflight.get(cacheKey,);
    if (existing !== undefined) {
      return existing;
    }

    const promise = resolveValue(cacheKey, args,);
    inflight.set(cacheKey, promise,);
    return promise;
  }

  /**
   * Memoized async wrapper.
   * When salt is already resolved, dispatches synchronously for deduplication.
   * Otherwise awaits salt resolution first.
   */
  function memoized(this: void, ...args: TArgs): Promise<TReturn> {
    if (resolvedSaltCache !== undefined) {
      const cacheKey = buildCacheKey(keyFn(...args,), resolvedSaltCache,);
      return dispatch(cacheKey, args,);
    }

    async function afterSaltResolved(): Promise<TReturn> {
      const resolvedSalt = await saltReady;
      const cacheKey = buildCacheKey(keyFn(...args,), resolvedSalt,);
      return await dispatch(cacheKey, args,);
    }

    return afterSaltResolved();
  }

  memoized.store = store;

  memoized.clear = async function clear(): Promise<void> {
    inflight.clear();
    lru.clear();
    await store.clear();
  };

  memoized.delete = async function deleteCacheEntry(key: string,): Promise<void> {
    inflight.delete(key,);
    lru.remove(key,);
    await store.delete(key,);
  };

  return memoized as MemoizedAsyncFunction<TArgs, TReturn>;
}
