import type { $ as Store, } from '../../../../../t object/t store/t/r a/index.ts';
import type { $ as SyncStore, } from '../../../../../t object/t store/t/r s/index.ts';

/** Maximum cache entries before LRU eviction in default memoize stores. */
export const DEFAULT_MAX_CACHE_SIZE = 1_024;

/**
 * Options for sync memoization via {@link MemoizedFunction}.
 *
 * @typeParam TArgs - tuple of function argument types
 *
 * @example
 * ```ts
 * const options: MemoizeOptions<[number, number]> = {
 *   keyFn: (a, b) => `${String(a)}:${String(b)}`,
 * };
 * ```
 */
export type MemoizeOptions<
  TArgs extends readonly unknown[],
> = {
  /**
   * Computes cache key from arguments. Must be deterministic.
   * Required because variadic argument hashing is error-prone.
   */
  keyFn: (
    this: void,
    ...args: TArgs
  ) => string;
  /**
   * Sync store backend for cache persistence.
   * Defaults to a fresh in-memory SyncStore with LRU eviction at {@link DEFAULT_MAX_CACHE_SIZE}.
   */
  store?: SyncStore;
};

/**
 * Options for async memoization.
 *
 * @typeParam TArgs - tuple of function argument types
 *
 * @example
 * ```ts
 * const options: MemoizeAsyncOptions<[string]> = {
 *   keyFn: (url) => url,
 * };
 * ```
 */
export type MemoizeAsyncOptions<
  TArgs extends readonly unknown[],
> = {
  /**
   * Computes cache key from arguments. Must be deterministic.
   * Required because variadic argument hashing is error-prone.
   */
  keyFn: (
    this: void,
    ...args: TArgs
  ) => string;
  /**
   * Store backend for cache persistence.
   * Defaults to a fresh in-memory Store with LRU eviction at {@link DEFAULT_MAX_CACHE_SIZE}.
   */
  store?: Store;
};

/**
 * Call-site options passed to a memoized function on each invocation.
 *
 * @typeParam TArgs - tuple of original function argument types
 *
 * @example
 * ```ts
 * memoized({ args: [1, 2], salt: 'v1' });
 * ```
 */
export type MemoizedCallOptions<
  TArgs extends readonly unknown[],
> = {
  /** Original function arguments as a tuple. */
  args: TArgs;
  /**
   * Salt appended to cache key.
   * Change salt to invalidate cache (e.g. `String(time % 3600000)` for hourly expiry).
   */
  salt: string;
};

/**
 * A memoized synchronous function with cache management methods.
 *
 * @typeParam TArgs - tuple of function argument types
 *
 * @typeParam TReturn - function return type
 *
 * @example
 * ```ts
 * const memoized: MemoizedFunction<[number], number> = memoize(expensiveFn, opts);
 * memoized({ args: [42], salt: 'v1' }); // computed
 * memoized({ args: [42], salt: 'v1' }); // cached
 * memoized.clear();
 * ```
 */
export type MemoizedFunction<
  TArgs extends readonly unknown[],
  TReturn,
> = {
  (
    this: void,
    options: MemoizedCallOptions<TArgs>,
  ): TReturn;
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
 *
 * @typeParam TReturn - resolved return type (not wrapped in Promise)
 *
 * @example
 * ```ts
 * const memoized: MemoizedAsyncFunction<[string], Response> = memoizeAsync(fetchFn, opts);
 * await memoized({ args: ['/api/data'], salt: 'v1' }); // fetched
 * await memoized({ args: ['/api/data'], salt: 'v1' }); // cached
 * await memoized.clear();
 * ```
 */
export type MemoizedAsyncFunction<
  TArgs extends readonly unknown[],
  TReturn,
> = {
  (
    this: void,
    options: MemoizedCallOptions<TArgs>,
  ): Promise<TReturn>;
  /** Read-only access to the underlying Store. */
  readonly store: Store;
  /** Wipe all cached entries. */
  clear: () => Promise<void>;
  /** Remove a specific entry by its full cache key (keyFn result + salt). */
  delete: (key: string,) => Promise<void>;
};

/**
 * Named-parameter options for sync memoization.
 * Includes the function to memoize alongside configuration.
 *
 * @typeParam TArgs - tuple of function argument types
 *
 * @typeParam TReturn - function return type
 *
 * @example
 * ```ts
 * const opts: MemoizeNamedOptions<[number], number> = {
 *   fn: (x) => x * 2,
 *   keyFn: (x) => String(x),
 * };
 * ```
 */
export type MemoizeNamedOptions<
  TArgs extends readonly unknown[],
  TReturn,
> = MemoizeOptions<TArgs> & {
  /** Pure synchronous function to memoize. */
  fn: (
    this: void,
    ...args: TArgs
  ) => TReturn;
};

/**
 * Named-parameter options for async memoization.
 * Includes the function to memoize alongside configuration.
 *
 * @typeParam TArgs - tuple of function argument types
 *
 * @typeParam TReturn - resolved return type (not wrapped in Promise)
 *
 * @example
 * ```ts
 * const opts: MemoizeAsyncNamedOptions<[string], User> = {
 *   fn: fetchUser,
 *   keyFn: (id) => id,
 * };
 * ```
 */
export type MemoizeAsyncNamedOptions<
  TArgs extends readonly unknown[],
  TReturn,
> = MemoizeAsyncOptions<TArgs> & {
  /** Pure async function to memoize. */
  fn: (
    this: void,
    ...args: TArgs
  ) => Promise<TReturn>;
};
