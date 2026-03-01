import type { $ as Store, } from '../../../../../t object/t store/t/r a/index.ts';
import type { $ as SyncStore, } from '../../../../../t object/t store/t/r s/index.ts';

/** Default maximum cache entries before LRU eviction. */
export const DEFAULT_MAX_CACHE_SIZE = 1024;

/**
 * Options for sync memoization via {@link MemoizedFunction}.
 *
 * @typeParam TArgs - tuple of function argument types
 * @typeParam TSalt - salt value type, must be string or number
 *
 * @example
 * ```ts
 * const options: MemoizeOptions<[number, number], string> = {
 *   keyFn: (a, b) => `${String(a)}:${String(b)}`,
 *   salt: 'v1',
 * };
 * ```
 */
export type MemoizeOptions<
  TArgs extends readonly unknown[],
  TSalt extends string | number = string,
> = {
  /**
   * Computes cache key from arguments. Must be deterministic.
   * Required because variadic argument hashing is error-prone.
   */
  keyFn: (this: void, ...args: TArgs) => string;
  /**
   * Salt value appended to cache key.
   * Change salt to invalidate cache (e.g. `time % 3600000` for hourly expiry).
   */
  salt: TSalt;
  /** Maximum cache entries before LRU eviction. Defaults to `1024`. */
  maxSize?: number;
  /**
   * Sync store backend for cache persistence.
   * Defaults to a fresh in-memory SyncStore.
   */
  store?: SyncStore;
};

/**
 * Options for async memoization.
 * Extends {@link MemoizeOptions} by allowing salt to be a `Promise`.
 *
 * @typeParam TArgs - tuple of function argument types
 * @typeParam TSalt - salt value type, must be string or number
 *
 * @example
 * ```ts
 * const options: MemoizeAsyncOptions<[string], string> = {
 *   keyFn: (url) => url,
 *   salt: fetchVersion(), // Promise<string>
 * };
 * ```
 */
export type MemoizeAsyncOptions<
  TArgs extends readonly unknown[],
  TSalt extends string | number = string,
> = {
  /**
   * Computes cache key from arguments. Must be deterministic.
   * Required because variadic argument hashing is error-prone.
   */
  keyFn: (this: void, ...args: TArgs) => string;
  /**
   * Salt value appended to cache key.
   * Can be a Promise to support patterns like `await fetchData({salt: time%1h})`.
   */
  salt: TSalt | Promise<TSalt>;
  /** Maximum cache entries before LRU eviction. Defaults to `1024`. */
  maxSize?: number;
  /**
   * Store backend for cache persistence.
   * Defaults to a fresh in-memory Store.
   */
  store?: Store;
};

/**
 * A memoized synchronous function with cache management methods.
 *
 * @typeParam TArgs - tuple of function argument types
 * @typeParam TReturn - function return type
 *
 * @example
 * ```ts
 * const memoized: MemoizedFunction<[number], number> = memoize(expensiveFn, opts);
 * memoized(42); // computed
 * memoized(42); // cached
 * memoized.clear();
 * ```
 */
export type MemoizedFunction<
  TArgs extends readonly unknown[],
  TReturn,
> = {
  (this: void, ...args: TArgs): TReturn;
  /** Read-only access to the underlying SyncStore. */
  readonly store: SyncStore;
  /** Wipe all cached entries. */
  clear: () => void;
  /** Remove a specific entry by its full cache key (keyFn result + salt). */
  delete: (key: string,) => void;
  /** Current number of cached entries. */
  readonly size: number;
};

/**
 * A memoized asynchronous function with cache management methods.
 *
 * @typeParam TArgs - tuple of function argument types
 * @typeParam TReturn - resolved return type (not wrapped in Promise)
 *
 * @example
 * ```ts
 * const memoized: MemoizedAsyncFunction<[string], Response> = memoizeAsync(fetchFn, opts);
 * await memoized('/api/data'); // fetched
 * await memoized('/api/data'); // cached
 * await memoized.clear();
 * ```
 */
export type MemoizedAsyncFunction<
  TArgs extends readonly unknown[],
  TReturn,
> = {
  (this: void, ...args: TArgs): Promise<TReturn>;
  /** Read-only access to the underlying Store. */
  readonly store: Store;
  /** Wipe all cached entries. */
  clear: () => Promise<void>;
  /** Remove a specific entry by its full cache key (keyFn result + salt). */
  delete: (key: string,) => Promise<void>;
};
