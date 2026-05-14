import {
  $ as createStore,
} from '../../../../../../t object/t store/f/t store/r a/p n/index.ts';
import type { $ as Store, } from '../../../../../../t object/t store/t/r a/index.ts';
import { buildCacheKey, } from '../../cacheKey.ts';
import {
  DEFAULT_MAX_CACHE_SIZE,
  type MemoizeAsyncNamedOptions,
  type MemoizedAsyncFunction,
  type MemoizedCallOptions,
} from '../../t/index.ts';

/**
 * Wraps an async function with memoization using LRU eviction, per-call salt-based
 * cache keys, and in-flight Promise deduplication.
 *
 * Salt is provided per-call via {@link MemoizedCallOptions}, enabling dynamic
 * cache invalidation without recreating the memoized function.
 *
 * The `keyFn` option is required to compute cache keys from arguments.
 * Uses the Store as the single source of truth for cached values.
 * An in-flight `Map` deduplicates concurrent calls with the same key.
 * LRU eviction is handled by the Store when configured with an eviction policy.
 *
 * The `fn` parameter is typed with `this: void` to disallow method-style memoization
 * where `this` binding would cause incorrect caching.
 *
 * @typeParam TArgs - tuple of function argument types
 *
 * @typeParam TReturn - resolved return type (not wrapped in Promise)
 *
 * @param options - function and memoization configuration
 *
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
 * });
 * await memoized({ args: ['user-1'], salt: 'v1' }); // fetched
 * await memoized({ args: ['user-1'], salt: 'v1' }); // cached
 * ```
 *
 * @example
 * Dynamic salt for cache invalidation:
 * ```ts
 * const memoized = await $({
 *   fn: expensiveFetch,
 *   keyFn: (url) => url,
 * });
 * await memoized({ args: ['/api'], salt: 'v1' }); // fetched
 * await memoized({ args: ['/api'], salt: 'v2' }); // refetched (salt changed)
 * ```
 *
 * @example
 * Custom Store backend:
 * ```ts
 * import { $ as createStore } from '../../t object/t store/f/t store/r a/p n/index.ts';
 * const store = await createStore({
 *   storeId: 'fetch-cache',
 *   eviction: [{ policy: 'lru', maxSize: 512 }],
 * });
 * const memoized = await $({
 *   fn: fetchData,
 *   keyFn: (id) => id,
 *   store,
 * });
 * ```
 */
export async function $<
  const TArgs extends readonly unknown[],
  const TReturn,
>(
  options: MemoizeAsyncNamedOptions<TArgs, TReturn>,
): Promise<MemoizedAsyncFunction<TArgs, TReturn>> {
  /** Caller-provided function plus cache-key builder extracted from `options` for closure capture. */
  const {
    fn,
    keyFn,
  } = options;
  /** Cache backend; defaults to a per-instance LRU store so callers without one still get bounded memory. */
  const store: Store = options.store ?? await createStore({
    storeId: `memoize-${crypto.randomUUID()}`,
    eviction: [{
      policy: 'lru',
      maxSize: DEFAULT_MAX_CACHE_SIZE,
    },],
  },);

  /** In-flight promises for deduplication of concurrent calls. */
  const inflight = new Map<string, Promise<TReturn>>();

  /**
   * Create a disposable that removes a key from the inflight map on dispose.
   *
   * @param cacheKey - key to remove from inflight on disposal
   *
   * @returns disposable that cleans inflight entry
   *
   * @example
   * ```ts
   * using _guard = inflightGuard('my-key');
   * ```
   */
  function inflightGuard(cacheKey: string,): Disposable {
    return {
      [Symbol.dispose](): void {
        inflight.delete(cacheKey,);
      },
    };
  }

  /**
   * Core computation: checks Store, then calls fn. Manages inflight map.
   *
   * @param cacheKey - full cache key
   *
   * @param args - original function arguments
   *
   * @returns cached or freshly computed result
   */
  async function resolveValue({
    cacheKey,
    args,
  }: {
    cacheKey: string;
    args: TArgs;
  },): Promise<TReturn> {
    /** Auto-disposer that clears the inflight entry on scope exit, even on throw. */
    using _guard = inflightGuard(cacheKey,);

    /** Cached value if present; an explicit `undefined` triggers recomputation, matching standard cache-miss semantics. */
    const stored = await store.get<TReturn>(cacheKey,);
    if (stored !== undefined)
      return stored;

    /** Freshly computed value persisted to `store` so subsequent calls hit the cache. */
    const result = await fn(...args,);
    await store.set(
      cacheKey,
      result,
    );
    return result;
  }

  /**
   * Dispatch a cache lookup + compute for the given key.
   * If an inflight promise already exists for this key, returns it (deduplication).
   *
   * @param cacheKey - full cache key
   *
   * @param args - original function arguments
   *
   * @returns promise resolving to the cached or computed value
   */
  function dispatch({
    cacheKey,
    args,
  }: {
    cacheKey: string;
    args: TArgs;
  },): Promise<TReturn> {
    /** Inflight promise for this key, if any; returning it dedupes concurrent callers onto a single computation. */
    const existing = inflight.get(cacheKey,);
    if (existing !== undefined)
      return existing;

    /** Newly started computation registered in `inflight` so concurrent callers share it. */
    const promise = resolveValue({
      cacheKey,
      args,
    },);
    inflight.set(
      cacheKey,
      promise,
    );
    return promise;
  }

  /**
   * Memoized async wrapper.
   * Salt is provided per-call to enable dynamic cache invalidation.
   *
   * @returns cached or freshly computed result
   */
  function memoized(
    {
      args,
      salt,
    }: MemoizedCallOptions<TArgs>,
  ): Promise<TReturn> {
    /** Composite cache key combining the argument-derived key with the per-call `salt` for invalidation. */
    const cacheKey = buildCacheKey({
      argKey: keyFn(...args,),
      salt,
    },);
    return dispatch({
      cacheKey,
      args,
    },);
  }

  memoized.store = store;

  memoized.clear = async function clear(): Promise<void> {
    inflight.clear();
    await store.clear();
  };

  memoized.delete = async function deleteCacheEntry(key: string,): Promise<void> {
    inflight.delete(key,);
    await store.delete(key,);
  };

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- memoized function is extended with store/clear/delete properties
  return memoized as MemoizedAsyncFunction<TArgs, TReturn>;
}
