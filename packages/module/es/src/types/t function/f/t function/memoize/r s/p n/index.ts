import {
  $ as createSyncStore,
} from '../../../../../../t object/t store/f/t store/r s/p n/index.ts';
import type { $ as SyncStore, } from '../../../../../../t object/t store/t/r s/index.ts';
import { buildCacheKey, } from '../../cacheKey.ts';
import {
  type MemoizedCallOptions,
  type MemoizedFunction,
  type MemoizeNamedOptions,
  DEFAULT_MAX_CACHE_SIZE,
} from '../../t/index.ts';

/**
 * Wraps a synchronous function with memoization using a SyncStore backend,
 * LRU eviction, and salt-based cache keys.
 *
 * Salt is provided per-call via {@link MemoizedCallOptions}, enabling dynamic
 * cache invalidation without recreating the memoized function.
 *
 * The `keyFn` option is required to compute cache keys from arguments.
 * This prevents accidental memoization of variadic functions without explicit key derivation.
 *
 * The `fn` parameter is typed with `this: void` to disallow method-style memoization
 * where `this` binding would cause incorrect caching.
 *
 * @typeParam TArgs - tuple of function argument types
 *
 * @typeParam TReturn - function return type
 *
 * @param options - function and memoization configuration
 *
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
 * });
 * memoizedAdd({ args: [1, 2], salt: 'v1' }); // computed: 3
 * memoizedAdd({ args: [1, 2], salt: 'v1' }); // cached: 3
 * ```
 *
 * @example
 * Dynamic salt for cache invalidation:
 * ```ts
 * const memoized = $({
 *   fn: expensiveCompute,
 *   keyFn: (input) => input,
 * });
 * memoized({ args: ['data'], salt: 'v1' }); // computed
 * memoized({ args: ['data'], salt: 'v1' }); // cached
 * memoized({ args: ['data'], salt: 'v2' }); // recomputed (salt changed)
 * ```
 *
 * @example
 * Custom store with different eviction size:
 * ```ts
 * import { $ as createSyncStore } from '../../t object/t store/f/t store/r s/p n/index.ts';
 * const store = createSyncStore({
 *   storeId: 'my-memo',
 *   eviction: [{ policy: 'lru', maxSize: 256 }],
 * });
 * const memoized = $({
 *   fn: compute,
 *   keyFn: (x) => String(x),
 *   store,
 * });
 * ```
 */
export function $<
  const TArgs extends readonly unknown[],
  const TReturn,
>(
  this: void,
  options: MemoizeNamedOptions<TArgs, TReturn>,
): MemoizedFunction<TArgs, TReturn> {
  const { fn, keyFn, } = options;
  const store: SyncStore = options.store ?? createSyncStore({
    storeId: `memoize-${crypto.randomUUID()}`,
    eviction: [{ policy: 'lru', maxSize: DEFAULT_MAX_CACHE_SIZE, },],
  },);

  /**
   * Memoized wrapper that checks the store before calling the original function.
   * Salt is provided per-call to enable dynamic cache invalidation.
   *
   * @returns cached or freshly computed result
   */
  function memoized(this: void, { args, salt, }: MemoizedCallOptions<TArgs>,): TReturn {
    const cacheKey = buildCacheKey(keyFn(...args,), salt,);

    const cached = store.get<TReturn>(cacheKey,);
    if (cached !== undefined)
      return cached;

    const result = fn(...args,);
    store.set(cacheKey, result,);
    return result;
  }

  memoized.store = store;

  memoized.clear = function clear(): void {
    store.clear();
  };

  memoized.delete = function deleteCacheEntry(key: string,): void {
    store.delete(key,);
  };

  Object.defineProperty(memoized, 'size', {
    get(): number {
      return store.size;
    },
    enumerable: true,
    configurable: false,
  },);

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- memoized function is extended with store/clear/delete/size properties
  return memoized as MemoizedFunction<TArgs, TReturn>;
}
