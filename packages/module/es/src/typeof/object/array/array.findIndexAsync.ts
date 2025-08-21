import type { Logged, } from '../../../logged.basic.ts';
import { getDefaultLogger, } from '../../../string.log.ts';

/**
 * Finds the index of the first element in an array that satisfies the async predicate.
 * Returns -1 if no element satisfies the predicate.
 *
 * @param array - to search through for matching element
 * @param predicate - to test each element
 * @param l - Logger instance for debugging. Uses console logger if omitted.
 * @returns Index of first matching element or -1 if no matches found
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
async function arrayFindIndexAsync<T,>({ array, predicate, l = getDefaultLogger(), }: {
  array: readonly T[];
  predicate: (item: T,) => Promise<boolean>;
} & Partial<Logged>,): Promise<number> {
  l.trace('arrayFindIndexAsync');
  for (const [index, item,] of array.entries()) {
    if (await predicate(item,))
      return index;
  }
  return -1;
}

export { arrayFindIndexAsync, };
