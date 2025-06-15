import type {
  MaybeAsyncIterable,
  Tuple,
} from '@monochromatic-dev/module-es/ts';
import type { Promisable } from 'type-fest';
import type { PromisableFunction } from './promise.type.ts';

// TODO: Support infinite Iterables by writing a * version of this fn. (Done)
//       Investigate if doing that makes sense for other ArrayLike methods.

/**
 * Mapping function that receives only the element parameter.
 * This is the simplest form of mapping function, suitable for transformations
 * that only need the element value itself.
 *
 * @template T_element - Type of input elements
 * @template T_mappedElement - Type of output elements after transformation
 *
 * @example
 * ```ts
 * const doubler: MappingFunctionWithElement<number, number> = x => x * 2;
 * const toString: MappingFunctionWithElement<number, string> = x => x.toString();
 * ```
 */
export type MappingFunctionWithElement<T_element, T_mappedElement,> = (
  element: T_element,
) => T_mappedElement;

/**
 * Mapping function that receives element and index parameters.
 * Useful for transformations that need to know the position of each element
 * in the iteration sequence.
 *
 * @template T_element - Type of input elements
 * @template T_mappedElement - Type of output elements after transformation
 *
 * @example
 * ```ts
 * const withIndex: MappingFunctionWithElementAndIndex<string, string> =
 *   (element, index) => `${index}: ${element}`;
 * const skipEvens: MappingFunctionWithElementAndIndex<number, number | null> =
 *   (element, index) => index % 2 === 0 ? element : null;
 * ```
 */
export type MappingFunctionWithElementAndIndex<T_element, T_mappedElement,> = (
  element: T_element,
  index: number,
) => T_mappedElement;

/**
 * Mapping function that receives element, index, and array parameters.
 * Provides full context including access to the complete array being processed.
 * Most comprehensive mapping function signature for complex transformations.
 *
 * @template T_element - Type of input elements
 * @template T_mappedElement - Type of output elements after transformation
 *
 * @example
 * ```ts
 * const withContext: MappingFunctionWithElementAndIndexAndArray<number, object> =
 *   (element, index, array) => ({
 *     value: element,
 *     position: index + 1,
 *     total: array.length,
 *     isLast: index === array.length - 1
 *   });
 * ```
 */
export type MappingFunctionWithElementAndIndexAndArray<T_element, T_mappedElement,> = (
  element: T_element,
  index: number,
  array: T_element[],
) => T_mappedElement;

/**
 * Union type representing any synchronous mapping function signature.
 * Accepts functions with element-only, element+index, or element+index+array parameters.
 * Used by synchronous mapping operations like `mapIterable`.
 *
 * @template T_element - Type of input elements
 * @template T_mappedElement - Type of output elements after transformation
 *
 * @example
 * ```ts
 * const simpleMap: MappingFunction<number, string> = x => x.toString();
 * const indexedMap: MappingFunction<number, string> = (x, i) => `${i}: ${x}`;
 * const contextMap: MappingFunction<number, string> = (x, i, arr) =>
 *   `${x} of ${arr.length}`;
 * ```
 */
export type MappingFunction<T_element, T_mappedElement,> =
  | MappingFunctionWithElement<T_element, T_mappedElement>
  | MappingFunctionWithElementAndIndex<T_element, T_mappedElement>
  | MappingFunctionWithElementAndIndexAndArray<T_element, T_mappedElement>;

/**
 * Union type representing any asynchronous mapping function signature.
 * Accepts functions that can return promises, supporting async transformations.
 * Used by asynchronous mapping operations like `mapIterableAsync`.
 *
 * @template T_element - Type of input elements
 * @template T_mappedElement - Type of output elements after transformation
 *
 * @example
 * ```ts
 * const asyncMap: MappingFunctionPromisable<number, string> =
 *   async x => (await fetch(`/api/${x}`)).text();
 * const mixedMap: MappingFunctionPromisable<number, string> =
 *   (x, i) => i % 2 === 0 ? Promise.resolve(x.toString()) : x.toString();
 * ```
 */
export type MappingFunctionPromisable<T_element, T_mappedElement,> =
  | PromisableFunction<MappingFunctionWithElement<T_element, T_mappedElement>>
  | PromisableFunction<MappingFunctionWithElementAndIndex<T_element, T_mappedElement>>
  | PromisableFunction<
    MappingFunctionWithElementAndIndexAndArray<T_element, T_mappedElement>
  >;

/**
 * Union type for mapping functions without array parameter access.
 * Used by generator-based mapping functions where the full array isn't available
 * due to lazy evaluation. Supports element-only and element+index signatures.
 *
 * @template T_element - Type of input elements
 * @template T_mappedElement - Type of output elements after transformation
 *
 * @example
 * ```ts
 * const lazyMap: MappingFunctionNoArray<number, string> = x => x.toString();
 * const indexedLazyMap: MappingFunctionNoArray<number, string> =
 *   (x, i) => `Item ${i}: ${x}`;
 * // Note: Can't access full array in generator context
 * ```
 */
export type MappingFunctionNoArray<T_element, T_mappedElement,> =
  | MappingFunctionWithElement<T_element, T_mappedElement>
  | MappingFunctionWithElementAndIndex<T_element, T_mappedElement>;

/**
 * Union type for async mapping functions without array parameter access.
 * Used by async generator-based mapping functions where the full array isn't available
 * due to streaming/lazy evaluation. Supports both sync and async transformations.
 *
 * @template T_element - Type of input elements
 * @template T_mappedElement - Type of output elements after transformation
 *
 * @example
 * ```ts
 * const asyncLazyMap: MappingFunctionNoArrayPromisable<number, string> =
 *   async x => (await processAsync(x)).toString();
 * const streamMap: MappingFunctionNoArrayPromisable<number, string> =
 *   (x, i) => i % 2 === 0 ? Promise.resolve(`Even: ${x}`) : `Odd: ${x}`;
 * ```
 */
export type MappingFunctionNoArrayPromisable<T_element, T_mappedElement,> =
  | PromisableFunction<MappingFunctionWithElement<T_element, T_mappedElement>>
  | PromisableFunction<MappingFunctionWithElementAndIndex<T_element, T_mappedElement>>;

/**
 * Asynchronously maps an async iterable using a transformation function that can return promises.
 * This is the async equivalent of Array.prototype.map(), supporting both sync and async iterables
 * with sync or async mapping functions. Uses Promise.all for efficient concurrent execution.
 *
 * @param mappingFn - Function to transform each element, can return Promise<T> or T
 * @param arrayLike - Iterable or async iterable to transform elements from
 * @returns Array of transformed elements, preserves tuple length when input has known length
 *
 * @example
 * ```ts
 * // Transform numbers with async function
 * const numbers = [1, 2, 3, 4];
 * const doubled = await mapIterableAsync(async x => x * 2, numbers); // [2, 4, 6, 8]
 *
 * // With async iterable and complex transformation
 * async function* asyncNumbers() {
 *   yield 1; yield 2; yield 3;
 * }
 * const strings = await mapIterableAsync(
 *   async x => `Number: ${x}`,
 *   asyncNumbers()
 * ); // ["Number: 1", "Number: 2", "Number: 3"]
 *
 * // Using index and array parameters
 * const indexed = await mapIterableAsync(
 *   async (element, index, array) => ({ element, index, total: array.length }),
 *   [10, 20, 30]
 * );
 * // [{ element: 10, index: 0, total: 3 }, ...]
 *
 * // Length-preserving tuple types for known-length arrays
 * const tuple: [string, string] = await mapIterableAsync(
 *   x => x.toString(),
 *   [1, 2] as const
 * ); // TypeScript knows result is exactly 2 elements
 * ```
 */
export async function mapIterableAsync<const T_element, const T_mappedElement,
  const T_arrayLike extends MaybeAsyncIterable<T_element> & { length: number; },>(
  mappingFn: MappingFunctionPromisable<T_element, T_mappedElement>,
  arrayLike: T_arrayLike,
): Promise<
  Tuple<T_mappedElement, T_arrayLike['length']>
>;

export async function mapIterableAsync<const T_element, const T_mappedElement,
  const T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  mappingFn: MappingFunctionPromisable<T_element, T_mappedElement>,
  arrayLike: T_arrayLike,
): Promise<T_mappedElement[]>;

export async function mapIterableAsync<const T_element, const T_mappedElement,
  const T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  mappingFn: MappingFunctionPromisable<T_element, T_mappedElement>,
  arrayLike: T_arrayLike,
): Promise<T_mappedElement[]> {
  const arr: T_element[] = await Array.fromAsync(arrayLike);
  return await Promise.all(
    arr.map(
      function mapper(element: T_element, index: number,
        array: T_element[]): Promisable<T_mappedElement>
      {
        return mappingFn(element, index, array);
      },
    ),
  );
}

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
 * ```ts
 * // Basic transformation
 * const numbers = [1, 2, 3, 4];
 * const doubled = mapIterable(x => x * 2, numbers); // [2, 4, 6, 8]
 *
 * // Using index parameter
 * const indexed = mapIterable(
 *   (element, index) => `${index}: ${element}`,
 *   ['a', 'b', 'c']
 * ); // ["0: a", "1: b", "2: c"]
 *
 * // Using all parameters (element, index, array)
 * const withContext = mapIterable(
 *   (element, index, array) => ({
 *     value: element,
 *     position: index + 1,
 *     total: array.length
 *   }),
 *   [10, 20, 30]
 * );
 * // [{ value: 10, position: 1, total: 3 }, ...]
 *
 * // Works with any iterable
 * const setResult = mapIterable(x => x.toUpperCase(), new Set(['a', 'b'])); // ['A', 'B']
 *
 * // Length-preserving tuple types
 * const tuple: [string, string] = mapIterable(
 *   x => x.toString(),
 *   [1, 2] as const
 * ); // TypeScript knows result is exactly 2 elements
 * ```
 */
export function mapIterable<const T_element, const T_mappedElement,
  const T_arrayLike extends Iterable<T_element> & { length: number; },>(
  mappingFn: MappingFunction<T_element, T_mappedElement>,
  arrayLike: T_arrayLike,
): Tuple<T_mappedElement, T_arrayLike['length']>;

export function mapIterable<const T_element, const T_mappedElement,
  const T_arrayLike extends Iterable<T_element>,>(
  mappingFn: MappingFunction<T_element, T_mappedElement>,
  arrayLike: T_arrayLike,
): T_mappedElement[];

export function mapIterable<const T_element, const T_mappedElement,
  const T_arrayLike
    extends (Iterable<T_element> | Iterable<T_element> & { length: number; }),>(
  mappingFn: MappingFunction<T_element, T_mappedElement>,
  arrayLike: T_arrayLike,
): T_mappedElement[] {
  const arr: T_element[] = [...arrayLike];
  return arr.map(mappingFn);
}

/**
 * Lazily maps an iterable using a transformation function, yielding results one at a time.
 * This is a memory-efficient generator version that doesn't require loading all elements into memory.
 * Useful for processing large datasets or infinite iterables where you only need elements on demand.
 * Note: Array parameter isn't available in mapping function due to lazy evaluation.
 *
 * @param mappingFn - Function to transform each element, receives (element, index)
 * @param arrayLike - Iterable to transform elements from
 * @yields Transformed elements one at a time as generator progresses
 *
 * @example
 * ```ts
 * // Memory-efficient processing of large datasets
 * const numbers = [1, 2, 3, 4, 5];
 * const doubled = mapIterableGen(x => x * 2, numbers);
 *
 * // Consume lazily - only processes elements as needed
 * for (const value of doubled) {
 *   console.log(value); // 2, 4, 6, 8, 10
 *   if (value > 6) break; // Early termination possible
 * }
 *
 * // Using index parameter
 * const indexed = mapIterableGen(
 *   (element, index) => `Item ${index}: ${element}`,
 *   ['apple', 'banana', 'cherry']
 * );
 * console.log([...indexed]); // ["Item 0: apple", "Item 1: banana", "Item 2: cherry"]
 *
 * // Works with infinite generators
 * function* infiniteNumbers() {
 *   let n = 1;
 *   while (true) yield n++;
 * }
 * const squares = mapIterableGen(x => x * x, infiniteNumbers());
 * const firstFiveSquares = Array.from({ length: 5 }, () => squares.next().value);
 * // [1, 4, 9, 16, 25]
 *
 * // Convert to array only when needed
 * const result = [...mapIterableGen(x => x.toUpperCase(), ['a', 'b'])]; // ['A', 'B']
 * ```
 */
export function* mapIterableGen<const T_element, const T_mappedElement,>(
  mappingFn: MappingFunctionNoArray<T_element, T_mappedElement>,
  arrayLike: Iterable<T_element>,
): Generator<T_mappedElement> {
  let index = 0;
  for (const element of arrayLike) {
    yield mappingFn(element, index++);
  }
}

/**
 * Lazily maps an async iterable using a transformation function that can return promises.
 * This is a streaming async generator that processes elements as they arrive from the source.
 * Supports both sync and async transformation functions, making it versatile for complex async workflows.
 * Results are yielded individually as they complete, enabling real-time processing of async data streams.
 * Note: Array parameter isn't available in mapping function due to streaming nature.
 *
 * @param mappingFn - Function to transform each element, can be sync or async, receives (element, index)
 * @param arrayLike - Async iterable to transform elements from (can be async generators, Promise arrays, etc.)
 * @yields Transformed elements one at a time as they're processed
 *
 * @example
 * ```ts
 * // Processing async data streams with async transformations
 * async function* fetchUserData() {
 *   yield { id: 1, name: 'Alice' };
 *   await new Promise(resolve => setTimeout(resolve, 100));
 *   yield { id: 2, name: 'Bob' };
 *   await new Promise(resolve => setTimeout(resolve, 100));
 *   yield { id: 3, name: 'Charlie' };
 * }
 *
 * // Async transformation function
 * async function enrichUser(user, index) {
 *   // Simulate API call
 *   await new Promise(resolve => setTimeout(resolve, 50));
 *   return { ...user, processed: true, order: index };
 * }
 *
 * const enriched = mapIterableAsyncGen(enrichUser, fetchUserData());
 *
 * // Process results as they arrive
 * for await (const user of enriched) {
 *   console.log(`Processed user ${user.order}: ${user.name}`);
 * }
 *
 * // Sync transformation with async iterable
 * const uppercased = mapIterableAsyncGen(
 *   (user, index) => ({ ...user, name: user.name.toUpperCase(), index }),
 *   fetchUserData()
 * );
 *
 * // Convert async iterable to array when needed
 * const results = [];
 * for await (const item of uppercased) {
 *   results.push(item);
 * }
 *
 * // Real-world example: Processing API responses
 * async function* fetchPages() {
 *   for (let page = 1; page <= 3; page++) {
 *     yield fetch(`/api/data?page=${page}`).then(r => r.json());
 *   }
 * }
 *
 * const processedData = mapIterableAsyncGen(
 *   async (responsePromise, index) => {
 *     const data = await responsePromise;
 *     return { page: index + 1, items: data.items.length };
 *   },
 *   fetchPages()
 * );
 *
 * // Stream processing without loading everything into memory
 * for await (const pageInfo of processedData) {
 *   console.log(`Page ${pageInfo.page} has ${pageInfo.items} items`);
 * }
 * ```
 */
export async function* mapIterableAsyncGen<const T_element, const T_mappedElement,>(
  mappingFn: MappingFunctionNoArrayPromisable<T_element, T_mappedElement>,
  arrayLike: MaybeAsyncIterable<T_element>,
): AsyncGenerator<T_mappedElement> {
  let index = 0;
  for await (const element of arrayLike) {
    yield await mappingFn(element, index++);
  }
}
