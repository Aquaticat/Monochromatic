import type {
  MemoizedAsyncFunction,
} from '../../t/index.ts';
import type { $ as Store, } from '../../../../../../t object/t store/t/r a/index.ts';
import { $ as named, } from '../p n/index.ts';

/**
 * Wraps an async function with memoization using LRU eviction, per-call salt-based
 * cache keys, and in-flight Promise deduplication.
 *
 * Positional-parameter wrapper around the named-parameter variant.
 *
 * @typeParam TArgs - tuple of function argument types
 * @typeParam TReturn - resolved return type (not wrapped in Promise)
 * @param fn - pure async function to memoize
 * @param keyFn - computes cache key from arguments; must be deterministic
 * @param store - store backend (defaults to fresh in-memory Store)
 * @returns memoized async function with `.store`, `.clear()`, `.delete()`
 *
 * @example
 * ```ts
 * const memoized = await $(
 *   fetchUser,
 *   (id) => id,
 * );
 * await memoized({ args: ['user-1'], salt: 'v1' }); // fetched
 * await memoized({ args: ['user-1'], salt: 'v1' }); // cached
 * ```
 */
export async function $<
  const TArgs extends readonly unknown[],
  const TReturn,
>(
  this: void,
  fn: (this: void, ...args: TArgs) => Promise<TReturn>,
  keyFn: (this: void, ...args: TArgs) => string,
  store?: Store,
): Promise<MemoizedAsyncFunction<TArgs, TReturn>> {
  return await named({ fn, keyFn, store, },);
}
