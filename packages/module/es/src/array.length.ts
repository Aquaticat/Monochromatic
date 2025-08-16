/**
 * Tests if an array has exactly one element.
 * This is a type guard that narrows the type to a single-element tuple.
 *
 * @param value - Array to check for single element
 * @returns True if array has exactly one element, false otherwise
 *
 * @example
 * ```ts
 * const single = ['hello'];
 * const empty: string[] = [];
 * const multiple = [1, 2, 3];
 *
 * console.log(isArrayOfLength1(single)); // true
 * console.log(isArrayOfLength1(empty)); // false
 * console.log(isArrayOfLength1(multiple)); // false
 *
 * // Type narrowing to [T]
 * function processSingleItem<T>(arr: readonly T[]) {
 *   if (isArrayOfLength1(arr)) {
 *     // arr is now typed as readonly [T]
 *     const onlyItem = arr[0]; // Safe access to the single element
 *     console.log('Single item:', onlyItem);
 *   }
 * }
 *
 * // Useful for validation
 * function requireSingleValue<T>(values: T[]): T {
 *   if (isArrayOfLength1(values)) {
 *     return values[0];
 *   }
 *   throw new Error('Expected exactly one value');
 * }
 * ```
 */
export function isArrayOfLength1<const T,>(
  value: unknown,
): value is readonly [T,] {
  return Array.isArray(value,) && value.length === 1;
}
