import type { Promisable } from '../promise.type.js';

//region when -- Synchronous conditional transformation

/**
 * Conditionally applies a transformation function to a value if a predicate is met.
 * If the predicate returns true for the given value, `onTrue` function is called with the value, and its result is returned.
 * Otherwise, the original value is returned.
 *
 * @template T - Type of input value.
 * @template R - Type of result if transformation is applied.
 * @param predicate - Determines if `onTrue` function should be executed based on input `value`.
 * @param onTrue - Transformation function applied to `value` if `predicate` returns true.
 * @param value - Value to be conditionally transformed.
 * @returns Result of `onTrue(value)` if `predicate(value)` is true; otherwise, original `value`.
 *
 * @example
 * ```ts
 * const doubleIfEven = (n: number) => when((x: number) => x % 2 === 0, (x: number) => x * 2, n);
 * doubleIfEven(4); // => 8
 * doubleIfEven(3); // => 3
 * ```
 */
export function when<const T, const R>(
  predicate: (value: T) => boolean,
  onTrue: (value: T) => R,
  value: T,
): T | R {
  if (predicate(value)) {
    return onTrue(value);
  }
  return value;
}

//endregion when

//region whenAsync -- Asynchronous conditional transformation

/**
 * Asynchronously conditionally applies a transformation function to a value if a predicate is met.
 * If the predicate (which can be async) returns true for the given value,
 * `onTrue` function (which can be async) is called with the value, and its result is returned.
 * Otherwise, the original value is returned.
 * All operations are awaited.
 *
 * @template T - Type of input value.
 * @template R - Type of result if transformation is applied.
 * @param predicate - Async or sync function determining if `onTrue` should execute based on input `value`.
 * @param onTrue - Async or sync transformation function applied to `value` if `predicate` returns true.
 * @param value - Value to be conditionally transformed.
 * @returns Result of `onTrue(value)` if `predicate(value)` is true; otherwise, original `value`.
 *
 * @example
 * ```ts
 * const doubleIfEvenAsync = async (n: number) =>
 *   whenAsync(
 *     async (x: number) => x % 2 === 0,
 *     async (x: number) => x * 2,
 *     n,
 *   );
 *
 * await doubleIfEvenAsync(4); // => 8
 * await doubleIfEvenAsync(3); // => 3
 * ```
 */
export async function whenAsync<const T, const R>(
  predicate: (value: T) => Promisable<boolean>,
  onTrue: (value: T) => Promisable<R>,
  value: T,
): Promise<T | R> {
  if (await predicate(value)) {
    return await onTrue(value);
  }
  return value;
}

//endregion whenAsync
