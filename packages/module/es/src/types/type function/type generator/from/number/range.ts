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