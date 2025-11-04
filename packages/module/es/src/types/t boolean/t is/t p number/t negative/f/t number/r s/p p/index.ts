import type { $ as Negative, } from '@_/types/t number/t negative/t/index.ts';

/**
 * Type guard that checks if a number is negative (less than zero).
 *
 * Rejects `NaN` values as they fail the comparison check.
 *
 * @param value - Number to check
 * @returns `true` if the value is negative (less than 0), `false` otherwise
 *
 * @example
 * ```ts
 * $(-5); // true
 * $(0); // false
 * $(5); // false
 * $(NaN); // false
 * ```
 */
export function $(
  value: number,
): value is Negative {
  return value < 0;
}
