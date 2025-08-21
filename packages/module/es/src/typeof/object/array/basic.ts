/**
 * Type guard that checks if a value is an array.
 * This is a re-export of the native Array.isArray method for consistency with other type guards.
 *
 * @param value - Value to check
 * @returns True if value is an array, false otherwise
 *
 * @example
 * ```ts
 * const arr = [1, 2, 3];
 * const notArr = 'hello';
 *
 * console.log(isArray(arr)); // true
 * console.log(isArray(notArr)); // false
 * console.log(isArray(new Set([1, 2]))); // false
 * ```
 */
export const isArray: typeof Array.isArray = Array.isArray;