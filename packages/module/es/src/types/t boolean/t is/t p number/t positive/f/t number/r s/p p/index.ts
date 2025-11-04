import type { $ as Positive, } from '@_/types/t number/t positive/t/index.ts';

/**
 * Type guard to check whether a number is positive (greater than zero).
 * 
 * Rejects NaN values by design, as NaN comparisons always return false.
 * 
 * @param value - Numeric value to check for positivity
 * @returns Type predicate narrowing value to positive number
 * 
 * @example
 * ```ts
 * const x: number = 5;
 * if ($(x)) {
 *   // x is narrowed to Positive type
 *   console.log('Positive number:', x);
 * }
 * 
 * $(42);    // true
 * $(0);     // false
 * $(-5);    // false
 * $(NaN);   // false
 * ```
 */
export function $(
  value: number,
): value is Positive {
  return value > 0;
}