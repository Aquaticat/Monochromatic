/**
 * Creates an array of consecutive integers starting from 0 up to length-1.
 * 
 * This function generates a zero-indexed integer sequence useful for creating indices,
 * iteration patterns, and numeric ranges. The resulting array contains exactly `length`
 * elements, starting from 0 and incrementing by 1 for each subsequent element.
 *
 * @param length - Number of consecutive integers to generate (array length)
 * @returns Array containing integers from 0 to length-1, empty array for length 0
 * @throws {RangeError} When length is negative
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
export function arrayRange(length: number): number[] {
  if (length < 0) {
    throw new RangeError('Length must be non-negative');
  }

  if (length === 0) {
    return [];
  }

  return Array.from({ length }, (_, index) => index);
}

/**
 * Creates a generator that yields consecutive integers starting from 0 up to length-1.
 * 
 * This generator version provides memory-efficient iteration over integer sequences
 * without creating the entire array in memory. Ideal for large ranges or when only
 * partial iteration is needed. Supports early termination and lazy evaluation.
 *
 * @param length - Number of consecutive integers to generate
 * @returns Generator yielding integers from 0 to length-1
 * @throws {RangeError} When length is negative
 *
 * @example
 * Basic generator usage:
 * ```ts
 * const rangeGen = arrayRangeGen(5);
 * for (const value of rangeGen) {
 *   console.log(value); // 0, 1, 2, 3, 4
 * }
 * ```
 *
 * @example
 * Memory-efficient processing of large ranges:
 * ```ts
 * function processLargeRange() {
 *   for (const index of arrayRangeGen(1000000)) {
 *     if (index > 100) break; // Early termination
 *     console.log(`Processing item ${index}`);
 *   }
 * }
 * ```
 *
 * @example
 * Converting to array when needed:
 * ```ts
 * const rangeArray = [...arrayRangeGen(3)];
 * console.log(rangeArray); // [0, 1, 2]
 * ```
 *
 * @example
 * Using with iterative operations:
 * ```ts
 * const sum = Array.from(arrayRangeGen(5)).reduce((acc, val) => acc + val, 0);
 * console.log(sum); // 10 (0+1+2+3+4)
 * ```
 */
export function* arrayRangeGen(length: number): Generator<number, void, undefined> {
  if (length < 0) {
    throw new RangeError('Length must be non-negative');
  }

  for (let index = 0; index < length; index++) {
    yield index;
  }
}