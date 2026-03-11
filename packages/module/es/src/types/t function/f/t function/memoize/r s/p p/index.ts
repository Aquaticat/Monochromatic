import type {
  MemoizedFunction,
} from '../../t/index.ts';
import type { $ as SyncStore, } from '../../../../../../t object/t store/t/r s/index.ts';
import { $ as named, } from '../p n/index.ts';

/**
 * Wraps a synchronous function with memoization using a SyncStore backend,
 * LRU eviction, and per-call salt-based cache keys.
 *
 * Positional-parameter wrapper around the named-parameter variant.
 *
 * @typeParam TArgs - tuple of function argument types
 * @typeParam TReturn - function return type
 * @param fn - pure synchronous function to memoize
 * @param keyFn - computes cache key from arguments; must be deterministic
 * @param store - sync store backend (defaults to fresh in-memory SyncStore)
 * @returns memoized function with `.store`, `.clear()`, `.delete()`, `.size`
 *
 * @example
 * ```ts
 * const memoizedAdd = $(
 *   (a: number, b: number) => a + b,
 *   (a, b) => `${String(a)}:${String(b)}`,
 * );
 * memoizedAdd({ args: [1, 2], salt: 'v1' }); // computed: 3
 * memoizedAdd({ args: [1, 2], salt: 'v1' }); // cached: 3
 * ```
 */
export function $<
  const TArgs extends readonly unknown[],
  const TReturn,
>(
  this: void,
  fn: (this: void, ...args: TArgs) => TReturn,
  keyFn: (this: void, ...args: TArgs) => string,
  store?: SyncStore,
): MemoizedFunction<TArgs, TReturn> {
  return named({ fn, keyFn, ...(store !== undefined ? { store, } : {}), },);
}
