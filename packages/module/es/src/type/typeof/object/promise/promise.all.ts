/**
 * A synchronous, non-promise-based equivalent of `Promise.all`.
 *
 * It takes an iterable of values and returns an array containing those values.
 * This is useful for declaratively collecting the results of multiple synchronous
 * operations (such as function calls or IIFEs) into a single array, providing a
 * parallel syntax to `Promise.all` for synchronous code.
 *
 * @typeParam T_array - to return
 * @param values - to return
 * @returns identical values tuple
 * @example
 * ```ts
 * function getPort(): number {
 *   return 8080;
 * }
 *
 * const results = nonPromiseAll([
 *   'localhost',
 *   getPort(),
 *   (() => true)(),
 * ]);
 * // results is ['localhost', 8080, true]
 * // The type is inferred as [string | number | boolean]
 * ```
 */
export function nonPromiseAll<const T_array extends readonly unknown[],>(
  values: T_array,
): T_array;
/**
 * {@inheritDoc nonPromiseAll}
 *
 * @typeParam T - elements inside the iterable
 * @param values - iterable
 * @returns iterable turned to array
 */
export function nonPromiseAll<const T,>(values: Iterable<T>,): T[] {
  return [...values,];
}
