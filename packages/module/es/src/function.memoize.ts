import type {
  UnknownRecord,
} from 'type-fest';
import {
  argsAlmostEqual,
} from './function.simpleMemoize.ts';

/**
 * Creates a memoized version of a function that caches its last result only, with optional context.
 *
 * @remarks
 * The cache is invalidated when the arguments of a call are not shallowly equal to the previous call for the same
 * memoized instance. The equality check uses strict equality (`===`) per argument via {@link argsAlmostEqual}.
 *
 * Context is captured at creation time. Pass a different context to create a separate memoized function instance.
 *
 * - Throws when the inner function throws.
 * - Supports both synchronous and asynchronous functions.
 * - Properties on the original function are not preserved.
 *
 * @typeParam Args - Parameters tuple of the memoized function.
 * @typeParam Result - Result type of the memoized function.
 * @typeParam Context - Context object type forwarded to the function when provided.
 * @param fn - Function to memoize. When a context is provided, this function receives the context as its first parameter
 * followed by the arguments.
 * @param context - Context captured by the memoized wrapper and forwarded to {@link fn}.
 * @returns Memoized function.
 *
 * @example
 * ```ts
 * // Without context
 * let i = 0;
 * const inc = () => ++i;
 * const mInc = memoize(inc);
 * mInc(); // 1
 * mInc(); // 1 (cached)
 * ```
 *
 * @example
 * ```ts
 * // With context captured at creation
 * type Ctx = { multiplier: number; };
 * const times = (ctx: Ctx | undefined, x: number) => x * (ctx?.multiplier ?? 1);
 * const mTimes = memoize(times, { multiplier: 2 } as const);
 * mTimes(2); // 4
 * mTimes(2); // 4 (cached)
 * ```
 */
export function memoize<const Args extends readonly unknown[], Result,>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result;
export function memoize<
  const Args extends readonly unknown[],
  Result,
  const Context extends UnknownRecord,
>(
  fn: (context: Context | undefined, ...args: Args) => Result,
  context: Context,
): (...args: Args) => Result;
export function memoize(
  fn:
    | ((...args: unknown[]) => unknown)
    | ((context: UnknownRecord | undefined, ...args: unknown[]) => unknown),
  context?: UnknownRecord,
): (...args: unknown[]) => unknown {
  let lastArgs: unknown[] | undefined = undefined;
  let lastResult: unknown | undefined = undefined;

  return function memoized(...args: unknown[]): unknown {
    if (lastArgs && argsAlmostEqual(args, lastArgs,))
      return lastResult as unknown;

    const currentResult =
      context === undefined
        ? (fn as (...args: unknown[]) => unknown)(...args,)
        : (fn as (context: UnknownRecord | undefined, ...args: unknown[]) => unknown)(
            context,
            ...args,
          );

    lastArgs = args;
    lastResult = currentResult;
    return currentResult;
  };
}