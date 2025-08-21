/**
 * Finds the index of the first element in an array that satisfies the predicate.
 * Returns -1 if no element satisfies the predicate.
 *
 * @param array - to search through for matching element
 * @param predicate - to test each element
 * @returns Index of first matching element or -1 if no matches found
 *
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const isEven = (n: number) => n % 2 === 0;
 * const index = arrayFindIndex(numbers, isEven);
 * console.log(index); // 1
 * ```
 *
 * @example
 * ```ts
 * const strings = ['hello', 'world', 'test'];
 * const isLong = (s: string) => s.length > 10;
 * const index = arrayFindIndex(strings, isLong);
 * console.log(index); // -1
 * ```
 */
export function arrayFindIndex<T,>(array: readonly T[],
  predicate: (item: T,) => boolean,): number
{
  for (const [index, item,] of array.entries()) {
    if (predicate(item,))
      return index;
  }
  return -1;
}
