/**
 * Checks if a bigint value is zero.
 * @param value - Bigint value to check
 * @returns True if the value is 0n, false otherwise
 * @example
 * ```ts
 * console.log($(0n)); // true
 * console.log($(1n)); // false
 * console.log($(-1n)); // false
 * ```
 */
export function $(
  value: unknown,
): value is 0n {
  return value === 0n;
}
