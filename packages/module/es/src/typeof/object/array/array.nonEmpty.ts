import { isArray, } from './basic.ts';

/**
 * Tests if an array is non-empty and narrows the type to a tuple with at least one element.
 * This is a type guard that ensures the array has at least one element.
 *
 * @param value - Array to check for non-emptiness
 * @returns True if array has length > 0, false otherwise
 *
 * @example
 * ```ts
 * const empty: number[] = [];
 * const notEmpty = [1, 2, 3];
 * const single = ['hello'];
 *
 * console.log(isArrayNonEmpty(empty)); // false
 * console.log(isArrayNonEmpty(notEmpty)); // true
 * console.log(isArrayNonEmpty(single)); // true
 *
 * // Type narrowing to [T, ...T[]]
 * function processArray(arr: readonly number[]) {
 *   if (isArrayNonEmpty(arr)) {
 *     // arr is now typed as [number, ...number[]]
 *     const first = arr[0]; // Safe access to first element
 *     const rest = arr.slice(1); // Rest of the elements
 *     console.log('First:', first, 'Rest:', rest);
 *   }
 * }
 * ```
 */
export function isArrayNonEmpty<const T,>(
  value: readonly T[],
): value is [T, ...T[],] {
  return Array.isArray(value,) && value.length > 0;
}

/**
 * Tests if a value is a non-empty array and narrows the type accordingly.
 * This function first checks if the value is an array, then checks if it's non-empty.
 *
 * @param value - Value to check for non-empty array
 * @returns True if value is an array with length > 0, false otherwise
 *
 * @example
 * ```ts
 * const arr = [1, 2, 3];
 * const empty: number[] = [];
 * const notArray = 'hello';
 *
 * console.log(isNonEmptyArray(arr)); // true
 * console.log(isNonEmptyArray(empty)); // false
 * console.log(isNonEmptyArray(notArray)); // false
 * console.log(isNonEmptyArray(null)); // false
 *
 * // Type narrowing from unknown
 * function processUnknown(value: unknown) {
 *   if (isNonEmptyArray(value)) {
 *     // value is now typed as [Element, ...Element[]]
 *     const first = value[0]; // Safe access
 *     console.log('First element:', first);
 *   }
 * }
 * ```
 */
export function isNonEmptyArray<const T_value,>(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- unknown is required.
  value: T_value | unknown,
): value is [
  T_value extends (infer Element)[] ? Element : never,
  ...(T_value extends (infer Element)[] ? Element : never)[],
] {
  return isArray(value,) && value.length > 0;
}

/**
 * Tests if a value is a non-empty array with enhanced type inference.
 * Similar to isNonEmptyArray but with different generic constraints for better type inference.
 *
 * @param value - Value to check for non-empty array
 * @returns True if value is an array with length > 0, false otherwise
 *
 * @example
 * ```ts
 * const numbers = [1, 2, 3];
 * const strings = ['a', 'b'];
 * const empty: string[] = [];
 * const notArray = { length: 1 };
 *
 * console.log(arrayIsNonEmpty(numbers)); // true
 * console.log(arrayIsNonEmpty(strings)); // true
 * console.log(arrayIsNonEmpty(empty)); // false
 * console.log(arrayIsNonEmpty(notArray)); // false
 *
 * // Enhanced type inference
 * function processValue<T extends readonly any[]>(value: T | unknown) {
 *   if (arrayIsNonEmpty(value)) {
 *     // Better type inference for the array elements
 *     value.forEach(item => console.log(item));
 *   }
 * }
 * ```
 */
export function arrayIsNonEmpty<
  T_value extends readonly any[],
>(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- unknown is required.
  value: T_value | unknown,
): value is [
  T_value extends (infer Element)[] ? Element : never,
  ...(T_value extends (infer Element)[] ? Element : never)[],
] {
  return isArray(value,) && value.length > 0;
}
