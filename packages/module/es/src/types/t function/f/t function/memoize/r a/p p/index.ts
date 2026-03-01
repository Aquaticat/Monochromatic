import type {
  MemoizedAsyncFunction,
} from '../../t/index.ts';
import type { $ as Store, } from '../../../../../../t object/t store/t/r a/index.ts';
import { $ as named, } from '../p n/index.ts';

/**
 * Wraps an async function with memoization using LRU eviction, salt-based cache keys,
 * and in-flight Promise deduplication.
 *
 * Positional-parameter wrapper around the named-parameter variant.
 *
 * @typeParam TArgs - tuple of function argument types
 * @typeParam TReturn - resolved return type (not wrapped in Promise)
 * @typeParam TSalt - salt value type
 * @param fn - pure async function to memoize
 * @param keyFn - computes cache key from arguments; must be deterministic
 * @param salt - appended to cache key; can be a Promise for async resolution
 * @param maxSize - maximum cache entries before LRU eviction (defaults to `1024`)
 * @param store - store backend (defaults to fresh in-memory Store)
 * @returns memoized async function with `.store`, `.clear()`, `.delete()`
 *
 * @example
 * ```ts
 * const memoized = await $(
 *   fetchUser,
 *   (id) => id,
 *   'v1',
 * );
 * await memoized('user-1'); // fetched
 * await memoized('user-1'); // cached
 * ```
 */
export async function $<
  const TArgs extends readonly unknown[],
  const TReturn,
  const TSalt extends string | number = string,
>(
  this: void,
  fn: (this: void, ...args: TArgs) => Promise<TReturn>,
  keyFn: (this: void, ...args: TArgs) => string,
  salt: TSalt | Promise<TSalt>,
  maxSize?: number,
  store?: Store,
): Promise<MemoizedAsyncFunction<TArgs, TReturn>> {
  return await named({ fn, keyFn, salt, maxSize, store, },);
}
