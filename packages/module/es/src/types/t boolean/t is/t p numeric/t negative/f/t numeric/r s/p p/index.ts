import type { $ as Negative, } from '@_/types/type numeric/type negative/type/index.ts';

/**
 * Checks if a numeric value is negative (less than 0).
 * @param value - Numeric value to check
 * @returns True if value is less than 0
 * @example
 * ```ts
 * $(-5); // true
 * $(-5n); // true
 * $(0); // false
 * $(5); // false
 * ```
 */
export function $(
  value: number | bigint,
): value is Negative {
  return value < 0;
}
