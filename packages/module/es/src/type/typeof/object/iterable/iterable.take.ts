import { notNullishOrThrow, } from './error.throw.ts';
import type { MaybeAsyncIterable, } from './iterable.basic.ts';

/**
 * Takes the first n elements from an async iterable, collecting them into an array.
 * Stops iteration early once the requested number of elements is reached, making it
 * efficient for processing only the beginning of large or infinite sequences.
 * Handles both synchronous and asynchronous iterables seamlessly.
 *
 * @param count - Number of elements to take from the beginning (must be non-negative)
 * @param iterable - Iterable or async iterable to take elements from
 * @returns Array containing up to count elements from the beginning
 * @example
 * ```ts
 * // Take from array
 * const first3 = await takeIterableAsync(3, [1, 2, 3, 4, 5]);
 * console.log(first3); // [1, 2, 3]
 *
 * // Take fewer than available
 * const first10 = await takeIterableAsync(10, [1, 2, 3]);
 * console.log(first10); // [1, 2, 3]
 *
 * // Take from async generator
 * async function* infiniteCounter() {
 *   let i = 1;
 *   while (true) {
 *     await new Promise(resolve => setTimeout(resolve, 100));
 *     yield i++;
 *   }
 * }
 * const firstFive = await takeIterableAsync(5, infiniteCounter());
 * console.log(firstFive); // [1, 2, 3, 4, 5]
 *
 * // Take zero elements
 * const none = await takeIterableAsync(0, [1, 2, 3]);
 * console.log(none); // []
 * ```
 */
export async function takeIterableAsync<const T,>(
  count: number,
  iterable: MaybeAsyncIterable<T>,
): Promise<T[]> {
  if (count < 0)
    throw new RangeError('Count must be non-negative',);
  if (count === 0)
    return [];

  const result: T[] = [];
  let taken = 0;

  for await (const element of iterable) {
    result.push(element,);
    taken++;
    if (taken >= count)
      break;
  }

  return result;
}

/**
 * Takes the first n elements from an iterable, collecting them into an array.
 *
 * {@inheritDoc takeIterableAsync}
 *
 * @param count - Number of elements to take from the beginning (must be non-negative)
 * @param iterable - Iterable to take elements from
 * @returns Array containing up to count elements from the beginning
 * @example
 * ```ts
 * // Take from array
 * const first3 = takeIterable(3, [1, 2, 3, 4, 5]);
 * console.log(first3); // [1, 2, 3]
 *
 * // Take from Set
 * const set = new Set(['a', 'b', 'c', 'd']);
 * const first2 = takeIterable(2, set);
 * console.log(first2); // ['a', 'b']
 *
 * // Take fewer than available
 * const all = takeIterable(10, [1, 2, 3]);
 * console.log(all); // [1, 2, 3]
 *
 * // Take from generator
 * function* fibonacci() {
 *   let a = 0, b = 1;
 *   while (true) {
 *     yield a;
 *     [a, b] = [b, a + b];
 *   }
 * }
 * const firstFibs = takeIterable(8, fibonacci());
 * console.log(firstFibs); // [0, 1, 1, 2, 3, 5, 8, 13]
 * ```
 */
export function takeIterable<const T,>(
  count: number,
  iterable: Iterable<T>,
): T[] {
  if (count < 0)
    throw new RangeError('Count must be non-negative',);
  if (count === 0)
    return [];

  const result: T[] = [];
  let taken = 0;

  for (const element of iterable) {
    result.push(element,);
    taken++;
    if (taken >= count)
      break;
  }

  return result;
}

/**
 * Asynchronously yields the first n elements from an iterable as a generator.
 * Provides streaming/lazy evaluation for memory-efficient processing of large sequences.
 * Stops yielding once the requested number of elements is reached, allowing efficient
 * handling of potentially infinite async iterables without loading all elements into memory.
 *
 * @param count - Number of elements to yield from the beginning (must be non-negative)
 * @param iterable - Iterable or async iterable to take elements from
 * @yields First n elements from the iterable
 * @example
 * ```ts
 * // Stream first elements from async source
 * async function* fetchPages() {
 *   for (let page = 1; page <= 100; page++) {
 *     yield await fetch(`/api/data?page=${page}`).then(r => r.json());
 *   }
 * }
 *
 * // Process only first 3 pages
 * for await (const page of takeIterableAsyncGen(3, fetchPages())) {
 *   console.log(`Processing page with ${page.items.length} items`);
 * }
 *
 * // Combine with other operations
 * async function* infiniteStream() {
 *   let i = 0;
 *   while (true) {
 *     yield i++;
 *     await new Promise(resolve => setTimeout(resolve, 100));
 *   }
 * }
 *
 * // Take and transform
 * const firstTenDoubled = takeIterableAsyncGen(10, infiniteStream());
 * for await (const num of firstTenDoubled) {
 *   console.log(num * 2);
 * }
 * ```
 */
export async function* takeIterableAsyncGen<const T,>(
  count: number,
  iterable: MaybeAsyncIterable<T>,
): AsyncGenerator<T, void, undefined> {
  if (count < 0)
    throw new RangeError('Count must be non-negative',);
  if (count === 0)
    return;

  let taken = 0;

  for await (const element of iterable) {
    yield element;
    taken++;
    if (taken >= count)
      break;
  }
}

/**
 * Yields the first n elements from an iterable as a generator.
 *
 * Generator version of takeIterable that provides streaming results without collecting all elements in memory.
 * {@inheritDoc takeIterableAsyncGen}
 *
 * @param count - Number of elements to yield from the beginning (must be non-negative)
 * @param iterable - Iterable to take elements from
 * @yields First n elements from the iterable
 * @example
 * ```ts
 * // Stream from infinite generator
 * function* naturalNumbers() {
 *   let n = 1;
 *   while (true) yield n++;
 * }
 *
 * // Take only what you need
 * for (const num of takeIterableGen(5, naturalNumbers())) {
 *   console.log(num); // 1, 2, 3, 4, 5
 * }
 *
 * // Lazy evaluation with large arrays
 * const largeArray = Array.from({ length: 1000000 }, (_, i) => i);
 * const firstHundred = takeIterableGen(100, largeArray);
 *
 * // Process on demand
 * for (const item of firstHundred) {
 *   if (item > 50) break; // Can stop early
 * }
 *
 * // Convert to array when needed
 * const collected = [...takeIterableGen(3, ['a', 'b', 'c', 'd'])];
 * console.log(collected); // ['a', 'b', 'c']
 * ```
 */
export function* takeIterableGen<const T,>(
  count: number,
  iterable: Iterable<T>,
): Generator<T, void, undefined> {
  if (count < 0)
    throw new RangeError('Count must be non-negative',);
  if (count === 0)
    return;

  let taken = 0;

  for (const element of iterable) {
    yield element;
    taken++;
    if (taken >= count)
      break;
  }
}

/**
 * Takes elements from an async iterable while a predicate returns true, collecting into an array.
 * Stops taking elements as soon as the predicate returns false for the first time.
 * Useful for extracting a prefix of elements that satisfy a certain condition.
 *
 * @param predicate - Function that returns true to continue taking elements
 * @param iterable - Iterable or async iterable to take elements from
 * @returns Array of elements taken while predicate was true
 * @example
 * ```ts
 * // Take while numbers are small
 * const small = await takeWhileIterableAsync(
 *   async x => x < 5,
 *   [1, 2, 3, 4, 5, 6, 7]
 * );
 * console.log(small); // [1, 2, 3, 4]
 *
 * // Take from async generator while condition holds
 * async function* asyncCounter() {
 *   let i = 1;
 *   while (true) {
 *     yield i++;
 *     await new Promise(resolve => setTimeout(resolve, 10));
 *   }
 * }
 * const firstTen = await takeWhileIterableAsync(
 *   async x => x <= 10,
 *   asyncCounter()
 * );
 * console.log(firstTen); // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
 *
 * // Take prefix of valid items
 * const data = ['valid', 'ok', '', 'invalid', 'data'];
 * const prefix = await takeWhileIterableAsync(
 *   async s => s.length > 0,
 *   data
 * );
 * console.log(prefix); // ['valid', 'ok']
 * ```
 */
export async function takeWhileIterableAsync<const T,>(
  predicate: (element: T,) => Promise<boolean> | boolean,
  iterable: MaybeAsyncIterable<T>,
): Promise<T[]> {
  const result: T[] = [];

  for await (const element of iterable) {
    if (!(await predicate(element,)))
      break;
    result.push(element,);
  }

  return result;
}

/**
 * Takes elements from an iterable while a predicate returns true, collecting into an array.
 *
 * {@inheritDoc takeWhileIterableAsync}
 *
 * @param predicate - Function that returns true to continue taking elements
 * @param iterable - Iterable to take elements from
 * @returns Array of elements taken while predicate was true
 * @example
 * ```ts
 * // Take ascending numbers
 * const nums = [1, 3, 5, 4, 7, 2];
 * const ascending = takeWhileIterable(
 *   (x, i, arr) => i === 0 || x > arr[i - 1],
 *   nums
 * );
 * console.log(ascending); // [1, 3, 5]
 *
 * // Take non-empty strings
 * const strings = ['hello', 'world', '', 'hidden'];
 * const nonEmpty = takeWhileIterable(
 *   s => s.length > 0,
 *   strings
 * );
 * console.log(nonEmpty); // ['hello', 'world']
 *
 * // Take from Set while condition holds
 * const set = new Set([2, 4, 6, 7, 8, 10]);
 * const evens = takeWhileIterable(
 *   n => n % 2 === 0,
 *   set
 * );
 * console.log(evens); // [2, 4, 6]
 * ```
 */
export function takeWhileIterable<const T,>(
  predicate: (element: T, index: number, array: T[],) => boolean,
  iterable: Iterable<T>,
): T[] {
  const arr = [...iterable,];
  const result: T[] = [];

  for (let index = 0; index < arr.length; index++) {
    const element = notNullishOrThrow(arr[index],);
    if (!predicate(element, index, arr,))
      break;
    result.push(element,);
  }

  return result;
}

/**
 * Asynchronously yields elements from an iterable while a predicate returns true.
 * Provides streaming/lazy evaluation, stopping as soon as the predicate returns false.
 * Memory-efficient for processing prefixes of large or infinite sequences.
 *
 * @param predicate - Function that returns true to continue yielding elements
 * @param iterable - Iterable or async iterable to take elements from
 * @yields Elements while predicate returns true
 * @example
 * ```ts
 * // Stream elements while condition holds
 * async function* infiniteData() {
 *   let i = 1;
 *   while (true) {
 *     yield { id: i, value: Math.random() };
 *     i++;
 *   }
 * }
 *
 * // Take while value is below threshold
 * const belowThreshold = takeWhileIterableAsyncGen(
 *   async item => item.value < 0.9,
 *   infiniteData()
 * );
 *
 * for await (const item of belowThreshold) {
 *   console.log(`Item ${item.id}: ${item.value}`);
 * }
 *
 * // Process API pages while has data
 * async function* fetchAllPages() {
 *   let page = 1;
 *   while (true) {
 *     const data = await fetch(`/api?page=${page}`).then(r => r.json());
 *     yield data;
 *     page++;
 *   }
 * }
 *
 * const nonEmptyPages = takeWhileIterableAsyncGen(
 *   async page => page.items.length > 0,
 *   fetchAllPages()
 * );
 * ```
 */
export async function* takeWhileIterableAsyncGen<const T,>(
  predicate: (element: T,) => Promise<boolean> | boolean,
  iterable: MaybeAsyncIterable<T>,
): AsyncGenerator<T, void, undefined> {
  for await (const element of iterable) {
    if (!(await predicate(element,)))
      break;
    yield element;
  }
}

/**
 * Yields elements from an iterable while a predicate returns true.
 *
 * Generator version that provides streaming results without collecting all elements in memory.
 * {@inheritDoc takeWhileIterableAsyncGen}
 *
 * @param predicate - Function that returns true to continue yielding elements
 * @param iterable - Iterable to take elements from
 * @yields Elements while predicate returns true
 * @example
 * ```ts
 * // Stream Fibonacci numbers below 100
 * function* fibonacci() {
 *   let a = 0, b = 1;
 *   while (true) {
 *     yield a;
 *     [a, b] = [b, a + b];
 *   }
 * }
 *
 * const smallFibs = takeWhileIterableGen(
 *   n => n < 100,
 *   fibonacci()
 * );
 *
 * for (const fib of smallFibs) {
 *   console.log(fib); // 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89
 * }
 *
 * // Process sorted data until unsorted element found
 * function* data() {
 *   yield* [1, 3, 5, 7, 4, 9, 11];
 * }
 *
 * let prev = -Infinity;
 * const sorted = takeWhileIterableGen(
 *   n => {
 *     const isSorted = n >= prev;
 *     prev = n;
 *     return isSorted;
 *   },
 *   data()
 * );
 *
 * console.log([...sorted]); // [1, 3, 5, 7]
 * ```
 */
export function* takeWhileIterableGen<const T,>(
  predicate: (element: T,) => boolean,
  iterable: Iterable<T>,
): Generator<T, void, undefined> {
  for (const element of iterable) {
    if (!predicate(element,))
      break;
    yield element;
  }
}
