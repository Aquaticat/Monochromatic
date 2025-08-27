/**
 * Checks if a numeric value is zero (0 or 0n).
 * @param value - Numeric value to check
 * @returns True if value is 0 or 0n
 * @example
 * ```ts
 * $(0); // true
 * $(0n); // true
 * $(1); // false
 * $(-1n); // false
 * ```
 */
export function $(
  value: number | bigint,
): value is 0 | 0n {
  return value === 0 || value === 0n;
}
