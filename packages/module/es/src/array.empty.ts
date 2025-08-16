import { isArray } from './array.basic.ts';

/**
 * Tests if a value is an empty array.
 * This is a type guard that narrows the type to never[] when true.
 *
 * @param value - Value to check for empty array
 * @returns True if value is an array with length 0, false otherwise
 *
 * @example
 * ```ts
 * const empty = [];
 * const notEmpty = [1, 2, 3];
 * const notArray = 'hello';
 *
 * console.log(isEmptyArray(empty)); // true
 * console.log(isEmptyArray(notEmpty)); // false
 * console.log(isEmptyArray(notArray)); // false
 * console.log(isEmptyArray(null)); // false
 *
 * // Type narrowing
 * function processArray(arr: unknown) {
 *   if (isEmptyArray(arr)) {
 *     // arr is now typed as never[]
 *     console.log('Empty array with length:', arr.length); // 0
 *   }
 * }
 * ```
 */
export function isEmptyArray(value: unknown,): value is never[] {
  return isArray(value,) && value.length === 0;
}

/**
 * Tests if an array is empty.
 * This function assumes the input is already known to be an array and checks its length.
 *
 * @param value - Array to check for emptiness
 * @returns True if array has length 0, false otherwise
 *
 * @example
 * ```ts
 * const empty: number[] = [];
 * const notEmpty = [1, 2, 3];
 * const mixed: (string | number)[] = [];
 *
 * console.log(isArrayEmpty(empty)); // true
 * console.log(isArrayEmpty(notEmpty)); // false
 * console.log(isArrayEmpty(mixed)); // true
 *
 * // Useful for array processing
 * function processKnownArray(arr: readonly any[]) {
 *   if (isArrayEmpty(arr)) {
 *     console.log('Nothing to process');
 *     return;
 *   }
 *   // Process non-empty array
 *   arr.forEach(item => console.log(item));
 * }
 * ```
 */
export function isArrayEmpty(
  value: readonly any[],
): value is never[] {
  return value.length === 0;
}