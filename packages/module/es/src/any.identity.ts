/* v8 ignore file -- @preserve */

/**
 * Returns its input value unchanged. The identity function is a fundamental building block
 * in functional programming, commonly used as a default transformation or placeholder function.
 *
 * Useful in scenarios where a function is required but no transformation is needed,
 * such as default parameters, filtering, or mapping operations.
 *
 * @param x - Value to return unchanged
 * @returns Same value that was passed in
 *
 * @example
 * ```ts
 * identity(42); // 42
 * identity('hello'); // 'hello'
 * identity([1, 2, 3]); // [1, 2, 3]
 *
 * // Common usage in functional programming
 * const numbers = [1, 2, 3, 4, 5];
 * numbers.map(identity); // [1, 2, 3, 4, 5] (no transformation)
 * numbers.filter(identity); // [1, 2, 3, 4, 5] (truthy values only)
 * ```
 */
export function identity<const T,>(x: T,): T {
  return x;
}
