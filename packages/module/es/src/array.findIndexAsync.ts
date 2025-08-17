/**
 * Finds the index of the first element in an array that satisfies the async predicate.
 * Returns -1 if no element satisfies the predicate.
 *
 * @param array - The array to search through
 * @param predicate - An async function that takes an element and returns a Promise that resolves to a boolean
 * @returns A Promise that resolves to the index of the first element that satisfies the predicate, or -1 if none found
 *
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const isEvenAsync = async (n: number) => n % 2 === 0;
 * const index = await arrayFindIndexAsync(numbers, isEvenAsync);
 * console.log(index); // 1
 * ```
 *
 * @example
 * ```ts
 * const strings = ['hello', 'world', 'test'];
 * const isLongAsync = async (s: string) => s.length > 10;
 * const index = await arrayFindIndexAsync(strings, isLongAsync);
 * console.log(index); // -1
 * ```
 */
async function arrayFindIndexAsync<T,>(
  array: readonly T[],
  predicate: (item: T,) => Promise<boolean>,
): Promise<number> {
  for (const [index, item,] of array.entries()) {
    if (await predicate(item,))
      return index;
  }
  return -1;
}

export { arrayFindIndexAsync, };
