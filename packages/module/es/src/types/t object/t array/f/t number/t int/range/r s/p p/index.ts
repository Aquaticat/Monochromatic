/**
 * Creates an array of consecutive integers starting from 0 up to length-1.
 *
 * This function generates a zero-indexed integer sequence useful for creating indices,
 * iteration patterns, and numeric ranges. The resulting array contains exactly `length`
 * elements, starting from 0 and incrementing by 1 for each subsequent element.
 *
 * @param length - Number of consecutive integers to generate (array length)
 * @returns Array containing integers from 0 to length-1, empty array for length 0
 * @throws RangeError When length is negative
 *
 * @example
 * Basic usage:
 * ```ts
 * const indices = arrayRange(5);
 * console.log(indices); // [0, 1, 2, 3, 4]
 *
 * const empty = arrayRange(0);
 * console.log(empty); // []
 * ```
 *
 * @example
 * Creating index arrays for iteration:
 * ```ts
 * const items = ['apple', 'banana', 'cherry'];
 * const indices = arrayRange(items.length);
 *
 * for (const index of indices) {
 *   console.log(`${index}: ${items[index]}`);
 * }
 * // Output: 0: apple, 1: banana, 2: cherry
 * ```
 *
 * @example
 * Generating test data:
 * ```ts
 * const numbers = arrayRange(10);
 * const squares = numbers.map(n => n * n);
 * console.log(squares); // [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
 *
 * const coordinates = arrayRange(3).map(i => ({ x: i, y: i * 2 }));
 * console.log(coordinates); // [{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 4 }]
 * ```
 *
 * @example
 * Matrix initialization:
 * ```ts
 * const size = 3;
 * const matrix = arrayRange(size).map(() => arrayRange(size).fill(0));
 * console.log(matrix); // [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
 * ```
 *
 * @example
 * Pagination and chunking:
 * ```ts
 * const pageSize = 10;
 * const totalItems = 47;
 * const pageCount = Math.ceil(totalItems / pageSize);
 * const pageNumbers = arrayRange(pageCount).map(i => i + 1);
 * console.log(pageNumbers); // [1, 2, 3, 4, 5]
 * ```
 *
 * @example
 * Error handling:
 * ```ts
 * try {
 *   arrayRange(-5); // Throws RangeError
 * } catch (error) {
 *   console.error('Length must be non-negative');
 * }
 * ```
 */
export function $<const Length extends number,>(
  length: Length,
): Length[] & { length: Length; } {
  if (length < 0)
    throw new RangeError('Length must be non-negative',);

  if (length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Return type is a type TS can't auto infer
    return [] as any;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Return type is a type TS can't auto infer
  return Array.from({ length, }, (_, index,) => index,) as any;
}
