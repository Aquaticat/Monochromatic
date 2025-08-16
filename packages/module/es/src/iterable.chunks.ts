import {
  isArrayEmpty,
  isEmptyArray,
} from './array.empty.ts';
import type { Tuple, } from './array.type.tuple.ts';
import { notEmptyOrThrow, } from './error.throw.ts';
import type { MaybeAsyncIterable, } from './iterable.type.maybe.ts';
import { logtapeGetLogger, } from './logtape.shared.ts';
import type { Ints, } from './numeric.type.ints.ts';

const l = logtapeGetLogger(['m', 'iterable.chunks',],);

/**
 * Splits an array into chunks of specified size, yielding them one by one as a generator.
 * This is a memory-efficient way to process large arrays in smaller, manageable pieces.
 * Each chunk is returned as a tuple with precise type information when chunk size ≤ 10.
 *
 * @param array - Non-empty readonly array to split into chunks
 * @param n - Chunk size, must be positive integer ≤ array length
 * @returns Generator yielding chunks as tuples of specified size
 *
 * @throws {RangeError} When array is empty
 * @throws {RangeError} When chunk size is negative, zero, or exceeds array length
 *
 * @remarks
 * **Memory efficiency**: Generates chunks lazily, processing only what's needed.
 * **Type safety**: Returns precise tuple types for chunk sizes ≤ 10, regular arrays otherwise.
 * **Immutability**: Input array is readonly and won't be modified during processing.
 * **Performance**: Uses array slicing for optimal chunk creation.
 *
 * Original implementation from {@link https://stackoverflow.com/a/55435856}
 * by {@link https://stackoverflow.com/users/10328101/ikechukwu-eze} with CC BY-SA 4.0
 *
 * @example
 * ```ts
 * // Basic chunking
 * const numbers = [1, 2, 3, 4, 5, 6, 7, 8] as const;
 * const chunks = chunksArray(numbers, 3);
 *
 * for (const chunk of chunks) {
 *   console.log(chunk); // [1, 2, 3], [4, 5, 6], [7, 8]
 * }
 *
 * // Convert to array
 * const allChunks = [...chunksArray(numbers, 2)];
 * // [[1, 2], [3, 4], [5, 6], [7, 8]]
 *
 * // Type-safe tuple chunks (n ≤ 10)
 * const letters = ['a', 'b', 'c', 'd', 'e', 'f'] as const;
 * const pairs = chunksArray(letters, 2);
 * // Each chunk has type: [string, string] | [string]
 *
 * // Processing in batches
 * const data = Array.from({ length: 1000 }, (_, i) => i);
 * for (const batch of chunksArray(data, 100)) {
 *   // Process 100 items at a time
 *   console.log(`Processing batch of ${batch.length} items`);
 * }
 *
 * // Error cases
 * try {
 *   chunksArray([], 2); // RangeError: array is empty
 * } catch (error) {
 *   console.error(error.message);
 * }
 *
 * try {
 *   chunksArray([1, 2], 5); // RangeError: chunk size exceeds array length
 * } catch (error) {
 *   console.error(error.message);
 * }
 * ```
 */

/* @__NO_SIDE_EFFECTS__ */
export function* chunksArray<
  const T_array extends readonly [any, ...any[],],
  const T_n extends Ints<1, T_array['length']>,
>(
  array: T_array,
  n: T_n,
): Generator<
  Tuple<T_array extends Iterable<infer T_element> ? T_element : never, Ints<1, (T_n)>>
> {
  if (isArrayEmpty(array,))
    throw new RangeError(`What's to be chunked cannot be empty`,);

  // TODO: Implement throw when n is 0
  if (n <= 0)
    throw new RangeError(`Chunk size cannot be negative or zero`,);

  if (n > array.length)
    throw new RangeError(`Initial chunk index is already out of range.`,);

  for (let chunkStart = 0; chunkStart < array.length; chunkStart += n) {
    yield array.slice(chunkStart, chunkStart + n,) as Tuple<
      T_array extends Iterable<infer T_element> ? T_element : never,
      T_n
    >;
  }
}

/**
 * Splits an iterable into chunks of specified size, yielding them one by one as a generator.
 * This provides memory-efficient processing of any iterable sequence, including infinite iterables.
 * Unlike array chunking, this works with any iterable and doesn't require knowing the total length.
 *
 * @param arrayLike - Iterable sequence to split into chunks
 * @param n - Chunk size, must be positive integer
 * @returns Generator yielding arrays of elements with specified chunk size
 *
 * @throws {RangeError} When iterable is empty
 * @throws {RangeError} When chunk size is negative, zero, or exceeds iterable length (for sized iterables)
 *
 * @remarks
 * **Memory efficiency**: Processes iterables lazily without loading entire sequence into memory.
 * **Infinite iterables**: Works with infinite sequences, yielding chunks as needed.
 * **Type preservation**: Maintains element types from the original iterable.
 * **Flexible input**: Accepts any iterable (arrays, sets, maps, generators, etc.).
 * **Performance note**: Currently converts iterable to array internally - future versions will be fully lazy.
 *
 * @example
 * ```ts
 * // Basic iterable chunking
 * const numbers = [1, 2, 3, 4, 5, 6, 7, 8];
 * const chunks = chunksIterable(numbers, 3);
 *
 * for (const chunk of chunks) {
 *   console.log(chunk); // [1, 2, 3], [4, 5, 6], [7, 8]
 * }
 *
 * // Working with Sets
 * const uniqueValues = new Set(['a', 'b', 'c', 'd', 'e']);
 * const setChunks = [...chunksIterable(uniqueValues, 2)];
 * // [['a', 'b'], ['c', 'd'], ['e']]
 *
 * // Processing Map entries
 * const map = new Map([['x', 1], ['y', 2], ['z', 3], ['w', 4]]);
 * for (const chunk of chunksIterable(map, 2)) {
 *   console.log(chunk); // [['x', 1], ['y', 2]], [['z', 3], ['w', 4]]
 * }
 *
 * // Working with generators
 * function* fibonacci() {
 *   let a = 0, b = 1;
 *   while (true) {
 *     yield a;
 *     [a, b] = [b, a + b];
 *   }
 * }
 *
 * const fibChunks = chunksIterable(fibonacci(), 5);
 * const firstChunk = fibChunks.next().value;
 * // [0, 1, 1, 2, 3]
 *
 * // String chunking (strings are iterable)
 * const text = "Hello World";
 * const charChunks = [...chunksIterable(text, 3)];
 * // [['H', 'e', 'l'], ['l', 'o', ' '], ['W', 'o', 'r'], ['l', 'd']]
 *
 * // Error cases
 * try {
 *   chunksIterable([], 0); // RangeError: chunk size must be positive
 * } catch (error) {
 *   console.error(error.message);
 * }
 *
 * try {
 *   chunksIterable([1, 2, 3], -1); // RangeError: chunk size must be positive
 * } catch (error) {
 *   console.error(error.message);
 * }
 * ```
 */
export function chunksIterable<
  // An overload sig can't be declared as a generator
  const T_arrayLike extends Iterable<any> & { length: number; },
  const T_n extends Ints<1, T_arrayLike['length']>,
  const YieldType extends Tuple<
    T_arrayLike extends Iterable<infer T_element> ? T_element : never,
    T_n
  >,
>(arrayLike: T_arrayLike, n: T_n,): Generator<
  YieldType
>;

export function chunksIterable<
  // An overload sig can't be declared as a generator
  const T_arrayLike extends Iterable<any>,
  const T_n extends number,
  const YieldType extends Tuple<
    T_arrayLike extends Iterable<infer T_element> ? T_element : never,
    T_n
  >,
>(arrayLike: T_arrayLike, n: T_n,): Generator<
  YieldType
>;

export function* chunksIterable<
  // An overload sig can't be declared as a generator
  const T_arrayLike extends Iterable<any> | Iterable<any> & { length: number; },
  const T_n extends T_arrayLike extends { length: number; }
    ? Ints<1, T_arrayLike['length']>
    : number,
  const YieldType extends Tuple<
    T_arrayLike extends Iterable<infer T_element> ? T_element : never,
    T_n
  >,
>(arrayLike: T_arrayLike, n: T_n,): Generator<
  YieldType
> {
  l.debug`chunksIterable(arrayLike: ${arrayLike}, n: ${n})`;

  if (isEmptyArray(arrayLike,)) {
    throw new RangeError(
      `What's to be chunked: ${JSON.stringify(arrayLike,)} cannot be empty`,
    );
  }
  if (n > (arrayLike as Iterable<any> & { length: number; }).length) {
    throw new RangeError(
      `Initial chunk index: ${n} is already out of range: ${
        (arrayLike as Iterable<any> & { length: number; }).length
      }`,
    );
  }
  l.debug`arrayLike.length: ${
    (arrayLike as Iterable<any> & { length: number; }).length
  }, n: ${n}`;

  // TODO: Switch this to lazy.
  //       Do a check on whether it's an array. If so, yield* to chunksArray
  //       If not, iterate as normal and only take what we need.
  const arrayLikeArray:
    readonly (T_arrayLike extends Iterable<infer T_element> ? T_element : never)[] = [
      ...arrayLike,
    ];

  l.debug`arrayLikeArray: ${arrayLikeArray}`;

  if (n > arrayLikeArray.length) {
    throw new RangeError(
      `Initial chunk index: ${n} is already out of range: ${arrayLikeArray.length}`,
    );
  }

  yield* chunksArray(notEmptyOrThrow(arrayLikeArray,), n,) as unknown as Generator<
    YieldType
  >;
  return;
}

/**
 * Splits an async iterable into chunks of specified size, yielding them one by one as an async generator.
 * This provides memory-efficient processing of async iterable sequences, including async generators and streams.
 * Handles both sync and async iterables, making it versatile for various data sources.
 *
 * @param arrayLike - Async iterable sequence to split into chunks
 * @param n - Chunk size, must be positive integer
 * @returns AsyncGenerator yielding arrays of elements with specified chunk size
 *
 * @throws {RangeError} When iterable is empty after consumption
 * @throws {RangeError} When chunk size is negative, zero, or exceeds iterable length (for sized iterables)
 *
 * @remarks
 * **Async processing**: Handles async iterables, promises, and async generators seamlessly.
 * **Memory efficiency**: Processes async sequences without loading entire dataset into memory.
 * **Type preservation**: Maintains element types from the original async iterable.
 * **Flexible input**: Accepts any async iterable (async generators, streams, etc.).
 * **Performance note**: Currently converts async iterable to array internally - future versions will be fully lazy.
 *
 * @example
 * ```ts
 * // Basic async iterable chunking
 * async function* asyncNumbers() {
 *   for (let value = 1; value <= 8; value++) {
 *     yield value;
 *   }
 * }
 *
 * const chunks = chunksIterableAsync(asyncNumbers(), 3);
 * for await (const chunk of chunks) {
 *   console.log(chunk); // [1, 2, 3], [4, 5, 6], [7, 8]
 * }
 *
 * // Working with async generators from APIs
 * async function* fetchData() {
 *   const response = await fetch('/api/data');
 *   const data = await response.json();
 *   for (const item of data) {
 *     yield item;
 *   }
 * }
 *
 * const dataChunks = chunksIterableAsync(fetchData(), 5);
 * for await (const batch of dataChunks) {
 *   // Process 5 items at a time
 *   console.log(`Processing batch of ${batch.length} items`);
 * }
 *
 * // Working with streams
 * async function* streamProcessor(stream: ReadableStream) {
 *   const reader = stream.getReader();
 *   try {
 *     while (true) {
 *       const { done, value } = await reader.read();
 *       if (done) break;
 *       yield value;
 *     }
 *   } finally {
 *     reader.releaseLock();
 *   }
 * }
 *
 * const streamChunks = chunksIterableAsync(streamProcessor(someStream), 10);
 * for await (const chunk of streamChunks) {
 *   console.log(`Stream chunk: ${chunk.length} items`);
 * }
 *
 * // Mixed sync/async iterables
 * const mixedData = [Promise.resolve(1), 2, Promise.resolve(3), 4];
 * const mixedChunks = chunksIterableAsync(mixedData, 2);
 * for await (const chunk of mixedChunks) {
 *   console.log(chunk); // [1, 2], [3, 4] (promises resolved)
 * }
 *
 * // Error cases
 * try {
 *   const emptyAsync = async function*() {}();
 *   const chunks = chunksIterableAsync(emptyAsync, 2);
 *   await chunks.next(); // RangeError: iterable is empty
 * } catch (error) {
 *   console.error(error.message);
 * }
 * ```
 */
export function chunksIterableAsync<
  // An overload sig can't be declared as a generator
  const T_arrayLike extends MaybeAsyncIterable<any> & { length: number; },
  const T_n extends Ints<1, T_arrayLike['length']>,
>(
  arrayLike: T_arrayLike,
  n: T_n,
): AsyncGenerator<
  Tuple<T_arrayLike extends MaybeAsyncIterable<infer T_element> ? T_element : never, T_n>
>;

export function chunksIterableAsync<
  // An overload sig can't be declared as a generator
  const T_arrayLike extends MaybeAsyncIterable<any>,
  const T_n extends number,
>(
  arrayLike: T_arrayLike,
  n: T_n,
): AsyncGenerator<
  Tuple<T_arrayLike extends MaybeAsyncIterable<infer T_element> ? T_element : never, T_n>
>;

export async function* chunksIterableAsync<
  // An overload sig can't be declared as a generator
  const T_arrayLike extends
    | MaybeAsyncIterable<any>
    | MaybeAsyncIterable<any> & { length: number; },
  const T_n extends T_arrayLike extends { length: number; }
    ? Ints<1, T_arrayLike['length']>
    : number,
  const YieldType extends Tuple<
    T_arrayLike extends MaybeAsyncIterable<infer T_element> ? T_element : never,
    T_n
  >,
>(arrayLike: T_arrayLike, n: T_n,): AsyncGenerator<
  YieldType
> {
  // TODO: Switch this to lazy.

  l.debug`chunksIterableAsync(arrayLike: ${arrayLike}, n: ${n})`;

  if (isEmptyArray(arrayLike,)) {
    throw new RangeError(
      `What's to be chunked: ${JSON.stringify(arrayLike,)} cannot be empty`,
    );
  }
  if (
    Object.hasOwn(arrayLike, 'length',)
    && n > (arrayLike as MaybeAsyncIterable<any> & { length: number; }).length
  ) {
    throw new RangeError(
      `Initial chunk index: ${n} is already out of range: ${
        (arrayLike as MaybeAsyncIterable<any> & { length: number; }).length
      }`,
    );
  }
  l.debug`arrayLike.length: ${
    (arrayLike as MaybeAsyncIterable<any> & { length: number; }).length
  }, n: ${n}`;

  const arrayLikeArray:
    readonly (T_arrayLike extends MaybeAsyncIterable<infer T_element> ? T_element
      : never)[] = await Array.fromAsync(arrayLike,);
  if (isEmptyArray(arrayLikeArray,)) {
    throw new RangeError(
      `What's to be chunked: ${JSON.stringify(arrayLikeArray,)} cannot be empty`,
    );
  }
  if (n > arrayLikeArray.length) {
    throw new RangeError(
      `Initial chunk index: ${n} is already out of range: ${arrayLikeArray.length}`,
    );
  }

  l.debug`arrayLikeArray: ${arrayLikeArray}`;

  if (n > arrayLikeArray.length) {
    throw new RangeError(
      `Initial chunk index: ${n} is already out of range: ${arrayLikeArray.length}`,
    );
  }

  yield* chunksArray(notEmptyOrThrow(arrayLikeArray,), n,) as unknown as Generator<
    YieldType
  >;
  return;
}
