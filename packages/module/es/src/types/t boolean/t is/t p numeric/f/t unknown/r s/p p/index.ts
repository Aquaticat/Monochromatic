/**
 * Checks if a value is numeric (number or bigint).
 * @param value - Value to check
 * @returns True if value is a number or bigint
 * @example
 * ```ts
 * $(5); // true
 * $(5n); // true
 * $("5"); // false
 * ```
 */
export function $(
  value: unknown,
): value is number | bigint {
  return typeof value === 'number' || typeof value === 'bigint';
}
