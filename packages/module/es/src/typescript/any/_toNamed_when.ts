import type { Promisable, } from 'type-fest';

//region when -- Synchronous conditional transformation

/**
 * Conditionally applies a transformation function to a value if it meets a predicate.
 * If the predicate returns true for the given value, it calls the `onTrue` function with the value and returns its result.
 * Otherwise, it returns the original value.
 *
 * @template T - Type of input value.
 * @template R - Type of result if the transformation applies.
 * @param predicate - Determines if the `onTrue` function should execute based on input `value`.
 * @param onTrue - Transformation function applied to `value` if `predicate` returns true.
 * @param value - Value to conditionally transform.
 * @returns Result of `onTrue(value)` if `predicate(value)` is true; otherwise, original `value`.
 *
 * @example
 * ```ts
 * const doubleIfEven = (n: number) => when((x: number) => x % 2 === 0, (x: number) => x * 2, n);
 * doubleIfEven(4); // => 8
 * doubleIfEven(3); // => 3
 * ```
 */
export function anyWhen<const T, const R,>(
  predicate: (value: T,) => boolean,
  onTrue: (value: T,) => R,
  value: T,
): T | R {
  if (predicate(value,))
    return onTrue(value,);
  return value;
}

//endregion when

//region whenAsync -- Asynchronous conditional transformation

/**
 * Asynchronously conditionally applies a transformation function to a value if it meets a predicate.
 * If the predicate (which can be async) returns true for the given value,
 * it calls the `onTrue` function (which can be async) with the value and returns its result.
 * Otherwise, it returns the original value.
 * It awaits all operations.
 *
 * @template T - Type of input value.
 * @template R - Type of result if the transformation applies.
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
export async function anyWhenAsync<const T, const R,>(
  predicate: (value: T,) => Promisable<boolean>,
  onTrue: (value: T,) => Promisable<R>,
  value: T,
): Promise<T | R> {
  if (await predicate(value,))
    return await onTrue(value,);
  return value;
}

//endregion whenAsync
