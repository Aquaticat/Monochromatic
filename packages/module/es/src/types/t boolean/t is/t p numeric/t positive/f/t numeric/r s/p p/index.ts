import type { $ as Positive, } from '@_/types/type numeric/type positive/type/index.ts';

/**
 * Checks if a numeric value is positive (greater than 0).
 * @param value - Numeric value to check
 * @returns True if value is greater than 0
 * @example
 * ```ts
 * $(5); // true
 * $(5n); // true
 * $(0); // false
 * $(-5); // false
 * ```
 */
export function $(
  value: number | bigint,
): value is Positive {
  return value > 0;
}
