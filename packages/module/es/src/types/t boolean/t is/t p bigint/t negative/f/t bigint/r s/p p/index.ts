import type { $ as Negative, } from '@_/types/t bigint/t negative/t/index.ts';

/**
 * Checks if a bigint value is negative.
 * @param value - Bigint value to check
 * @returns True if the value is less than 0n, false otherwise
 * @example
 * ```ts
 * console.log($(-1n)); // true
 * console.log($(-100n)); // true
 * console.log($(0n)); // false
 * console.log($(1n)); // false
 * ```
 */
export function $(
  value: bigint,
): value is Negative {
  return value < 0n;
}
