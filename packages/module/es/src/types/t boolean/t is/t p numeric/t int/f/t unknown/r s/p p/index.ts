import type { $ as NumericInt, } from '@_/types/t numeric/t int/t/index.ts';

/**
 * Checks if a value is an integer (integer number or any bigint).
 * @param value - Value to check
 * @returns True if value is an integer number or any bigint
 * @example
 * ```ts
 * $(5); // true
 * $(5n); // true
 * $(1.5); // false
 * $("5"); // false
 * ```
 */
export function $(
  value: unknown,
): value is NumericInt {
  // BigInts are always integers, so they can't be floats
  if (typeof value === 'bigint')
    return true;
  return Number.isInteger(value,);
}
