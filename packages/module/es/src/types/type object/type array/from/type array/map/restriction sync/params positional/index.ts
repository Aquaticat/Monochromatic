/**
 * Synchronously maps an iterable using a transformation function.
 * This is a functional programming equivalent of Array.prototype.map() that works with any iterable.
 * Supports mapping functions that receive element, index, and/or array parameters for flexibility.
 *
 * @param mappingFn - Function to transform each element, receives (element, index?, array?)
 * @param arrayLike - Iterable to transform elements from
 * @returns Array of transformed elements, preserves tuple length when input has known length
 *
 * @example
 * Basic transformation:
 * ```ts
 * const numbers = [1, 2, 3, 4];
 * const doubled = $(x => x * 2, numbers);
 * console.log(doubled); // [2, 4, 6, 8]
 * ```
 *
 * @example
 * Using index parameter:
 * ```ts
 * const indexed = $(
 *   (element, index) => `${index}: ${element}`,
 *   ['a', 'b', 'c']
 * );
 * console.log(indexed); // ["0: a", "1: b", "2: c"]
 * ```
 *
 * @example
 * Using all parameters (element, index, array):
 * ```ts
 * const withContext = $(
 *   (element, index, array) => ({
 *     value: element,
 *     position: index + 1,
 *     total: array.length
 *   }),
 *   [10, 20, 30]
 * );
 * // [{ value: 10, position: 1, total: 3 }, ...]
 * ```
 *
 * @example
 * Works with any iterable:
 * ```ts
 * const setResult = $(x => x.toUpperCase(), new Set(['a', 'b']));
 * console.log(setResult); // ['A', 'B']
 * 
 * // String characters
 * const charCodes = $(c => c.charCodeAt(0), 'hello');
 * console.log(charCodes); // [104, 101, 108, 108, 111]
 * ```
 *
 * @example
 * Complex transformations:
 * ```ts
 * const users = [
 *   { id: 1, name: 'Alice', age: 30 },
 *   { id: 2, name: 'Bob', age: 25 }
 * ];
 * 
 * const userSummary = $(
 *   (user, index) => `${index + 1}. ${user.name} (${user.age})`,
 *   users
 * );
 * console.log(userSummary); // ["1. Alice (30)", "2. Bob (25)"]
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function $<const T_element, const T_mappedElement>(
  mappingFn: ((element: T_element) => T_mappedElement) | 
            ((element: T_element, index: number) => T_mappedElement) |
            ((element: T_element, index: number, array: T_element[]) => T_mappedElement),
  arrayLike: Iterable<T_element>,
): T_mappedElement[] {
  const arr: T_element[] = [...arrayLike,];
  return arr.map(mappingFn,);
}