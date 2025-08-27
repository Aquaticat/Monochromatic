import type { $ as Float, } from '@_/types/type numeric/type float/type/index.ts';

/**
 * Checks if a numeric value is a float (non-integer number).
 * @param value - Numeric value to check
 * @returns True if value is a float (non-integer number), false for integers and bigints
 * @example
 * ```ts
 * $(1.5); // true
 * $(0.1); // true
 * $(1); // false
 * $(1n); // false (bigints are always integers)
 * ```
 */
export function $(
  value: number | bigint,
): value is Float {
  // BigInts are always integers, so they can't be floats
  if (typeof value === 'bigint')
    return false;
  return !Number.isInteger(value,);
}
