/**
 * Checks if a value is of type bigint.
 * @param value - Value to check
 * @returns True if the value is a bigint, false otherwise
 * @example
 * ```ts
 * console.log($(123n)); // true
 * console.log($(123)); // false
 * console.log($('123')); // false
 * ```
 */
export function $(
  value: unknown,
): value is bigint {
  return typeof value === 'bigint';
}
