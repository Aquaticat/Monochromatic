import type { $ as Positive, } from '@_/types/t bigint/t positive/t/index.ts';

/**
 * Checks if a bigint value is positive.
 * @param value - Bigint value to check
 * @returns True if the value is greater than 0n, false otherwise
 * @example
 * ```ts
 * console.log($(1n)); // true
 * console.log($(100n)); // true
 * console.log($(0n)); // false
 * console.log($(-1n)); // false
 * ```
 */
export function $(
  value: bigint,
): value is Positive {
  return value > 0n;
}
