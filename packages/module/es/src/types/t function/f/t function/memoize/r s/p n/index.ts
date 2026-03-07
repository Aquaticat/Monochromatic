import type {
  MemoizeNamedOptions,
  MemoizedFunction,
} from '../../t/index.ts';
import { DEFAULT_MAX_CACHE_SIZE, } from '../../t/index.ts';
import type { $ as SyncStore, } from '../../../../../../t object/t store/t/r s/index.ts';
import { $ as createSyncStore, } from '../../../../../../t object/t store/f/t store/r s/p n/index.ts';
import { buildCacheKey, } from '../../cacheKey.ts';

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
 * const store = createSyncStore({
 *   storeId: 'my-memo',
 *   eviction: [{ policy: 'lru', maxSize: 256 }],
 * });
 * const memoized = $({
 *   fn: compute,
 *   keyFn: (x) => String(x),
 *   salt: 'v1',
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
  const store: SyncStore = options.store ?? createSyncStore({
    storeId: `memoize-${crypto.randomUUID()}`,
    eviction: [{ policy: 'lru', maxSize, },],
  },);

  /**
   * Memoized wrapper that checks the store before calling the original function.
   */
  function memoized(this: void, ...args: TArgs): TReturn {
    const cacheKey = buildCacheKey(keyFn(...args,), salt,);

    const cached = store.get<TReturn>(cacheKey,);
    if (cached !== undefined) {
      return cached;
    }

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

  return memoized as MemoizedFunction<TArgs, TReturn>;
}
