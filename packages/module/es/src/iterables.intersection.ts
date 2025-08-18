import { isArrayEmpty, } from './array.empty.ts';
import { isArrayOfLength1, } from './array.length.ts';
import { notUndefinedOrThrow, } from './error.throw.ts';
import { unary, } from './function.nary.ts';
import type { MaybeAsyncIterable, } from './iterable.basic.ts';

/**
 * Creates a new Set containing the intersection of all input iterables, preserving only elements
 * that exist in every provided iterable. Uses precise type intersection (T & U & V...) to ensure
 * type safety across multiple sources, making it perfect for finding common elements across datasets.
 *
 * The function optimizes performance with early short-circuiting: if any iterable is empty, the
 * result is immediately empty. Uses extensive overloads to maintain precise type information for
 * up to 9 iterables with intersection types.
 *
 * @param arrays - Variable number of iterables to find common elements across
 * @returns Set containing elements present in all input iterables, with precise intersection typing
 * @template T - Intersection of element types from all input iterables
 * @example
 * ```ts
 * // Basic intersection of arrays
 * const common = intersectionIterables([1, 2, 3], [2, 3, 4]); // Set(2) {2, 3}
 *
 * // Intersection with multiple arrays
 * const shared = intersectionIterables([1, 2, 3], [2, 3, 4], [3, 4, 5]); // Set(1) {3}
 *
 * // Works with any iterables
 * const set1 = new Set([1, 2, 3]);
 * const set2 = new Set([2, 3, 4]);
 * const common2 = intersectionIterables(set1, set2); // Set(2) {2, 3}
 *
 * // String characters
 * const chars = intersectionIterables('abc', 'bcd'); // Set(2) {'b', 'c'}
 *
 * // Edge cases
 * const empty = intersectionIterables(); // Set(0) {}
 * const single = intersectionIterables([1, 2, 3]); // Set(3) {1, 2, 3}
 * const noCommon = intersectionIterables([1, 2], [3, 4]); // Set(0) {}
 * ```
 */
export function intersectionIterables(...arrays: never[]): Set<never>;
export function intersectionIterables<const Param1,>(
  ...arrays: [Iterable<Param1>,]
): Set<Param1>;
export function intersectionIterables<const Param1, const Param2,>(
  ...arrays: [Iterable<Param1>, Iterable<Param2>,]
): Set<Param1 & Param2>;
export function intersectionIterables<const Param1, const Param2, const Param3,>(
  ...arrays: [Iterable<Param1>, Iterable<Param2>, Iterable<Param3>,]
): Set<Param1 & Param2 & Param3>;
export function intersectionIterables<const Param1, const Param2, const Param3,
  const Param4,>(
  ...arrays: [Iterable<Param1>, Iterable<Param2>, Iterable<Param3>, Iterable<Param4>,]
): Set<Param1 & Param2 & Param3 & Param4>;
export function intersectionIterables<const Param1, const Param2, const Param3,
  const Param4, const Param5,>(
  ...arrays: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
  ]
): Set<Param1 & Param2 & Param3 & Param4 & Param5>;
export function intersectionIterables<const Param1, const Param2, const Param3,
  const Param4, const Param5, const Param6,>(
  ...arrays: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
    Iterable<Param6>,
  ]
): Set<Param1 & Param2 & Param3 & Param4 & Param5 & Param6>;
export function intersectionIterables<const Param1, const Param2, const Param3,
  const Param4, const Param5, const Param6, const Param7,>(
  ...arrays: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
    Iterable<Param6>,
    Iterable<Param7>,
  ]
): Set<Param1 & Param2 & Param3 & Param4 & Param5 & Param6 & Param7>;
export function intersectionIterables<const Param1, const Param2, const Param3,
  const Param4, const Param5, const Param6, const Param7, const Param8,>(
  ...arrays: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
    Iterable<Param6>,
    Iterable<Param7>,
    Iterable<Param8>,
  ]
): Set<Param1 & Param2 & Param3 & Param4 & Param5 & Param6 & Param7 & Param8>;
export function intersectionIterables<const Param1, const Param2, const Param3,
  const Param4, const Param5, const Param6, const Param7, const Param8, const Param9,>(
  ...arrays: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
    Iterable<Param6>,
    Iterable<Param7>,
    Iterable<Param8>,
    Iterable<Param9>,
  ]
): Set<Param1 & Param2 & Param3 & Param4 & Param5 & Param6 & Param7 & Param8 & Param9>;
export function intersectionIterables<const T,>(...arrays: Iterable<T>[]): Set<T>;
export function intersectionIterables(...arrays: Iterable<unknown>[]): Set<unknown> {
  if (arrays.length === 0)
    return new Set();

  if (arrays.length === 1)
    return new Set(arrays[0],);

  // Start with the first iterable as candidates
  const candidates = new Set(arrays[0],);

  // Empty set short-circuit
  if (candidates.size === 0)
    return candidates;

  // For each subsequent iterable
  for (const otherArray of arrays.slice(1,)) {
    // Short-circuit if no candidates remain
    if (candidates.size === 0)
      return candidates;

    const currentSet = new Set(otherArray,);

    // If current iterable is empty, intersection is empty
    if (currentSet.size === 0) {
      candidates.clear();
      return candidates;
    }

    // Remove items from candidates that don't exist in current set
    for (const item of candidates) {
      if (!currentSet.has(item,))
        candidates.delete(item,);
    }
  }

  return candidates;
}

/**
 * Converts any iterable to a Set, efficiently deduplicating elements while preserving the original
 * element type. This utility function provides a simple way to create Sets from various iterable
 * sources with full type safety and optimal performance.
 *
 * @param iterable - Any iterable to convert to a Set
 * @returns Set containing all unique elements from the input iterable
 * @template T - Element type of the input iterable, preserved in the output Set
 * @example
 * ```ts
 * // Array to Set
 * const numbers = setOfIterable([1, 2, 2, 3]); // Set(3) {1, 2, 3}
 *
 * // String to Set of characters
 * const chars = setOfIterable('hello'); // Set(4) {'h', 'e', 'l', 'o'}
 *
 * // Generator to Set
 * function* range(n: number) {
 *   for (let value = 0; value < n; value++) yield value;
 * }
 * const rangeSet = setOfIterable(range(5)); // Set(5) {0, 1, 2, 3, 4}
 *
 * // Empty iterable
 * const empty = setOfIterable([]); // Set(0) {}
 *
 * // Already a Set (creates new instance)
 * const original = new Set([1, 2, 3]);
 * const copy = setOfIterable(original); // Set(3) {1, 2, 3} (new instance)
 * ```
 */
export function setOfIterable<const T,>(
  iterable: Iterable<T>,
): Set<T> {
  const set = new Set<T>();
  for (const item of iterable)
    set.add(item,);
  return set;
}

/**
 * Asynchronously converts any iterable or async iterable to a Set, handling both synchronous and
 * asynchronous data sources. Perfect for processing async generators, streams, or mixed sync/async
 * iterables while maintaining type safety and efficient deduplication.
 *
 * @param iterable - Any iterable or async iterable to convert to a Set
 * @returns Promise resolving to Set containing all unique elements from the input iterable
 * @template T - Element type of the input iterable, preserved in the output Set
 * @example
 * ```ts
 * // Array to Set (async)
 * const numbers = await setOfIterableAsync([1, 2, 2, 3]); // Set(3) {1, 2, 3}
 *
 * // Async generator to Set
 * async function* asyncRange(n: number) {
 *   for (let value = 0; value < n; value++) {
 *     await new Promise(resolve => setTimeout(resolve, 10)); // Simulate delay
 *     yield value;
 *   }
 * }
 * const rangeSet = await setOfIterableAsync(asyncRange(5)); // Set(5) {0, 1, 2, 3, 4}
 *
 * // Mixed sync and async processing
 * const syncSet = await setOfIterableAsync('hello'); // Set(4) {'h', 'e', 'l', 'o'}
 *
 * // Stream processing
 * async function* dataStream() {
 *   yield 'item1';
 *   yield 'item2';
 *   yield 'item1'; // Duplicate
 * }
 * const streamSet = await setOfIterableAsync(dataStream()); // Set(2) {'item1', 'item2'}
 * ```
 */
export async function setOfIterableAsync<const T,>(
  iterable: MaybeAsyncIterable<T>,
): Promise<Set<T>> {
  const set = new Set<T>();
  for await (const item of iterable)
    set.add(item,);
  return set;
}

/**
 * Asynchronously creates a new Set containing the intersection of all input iterables and async
 * iterables, finding elements present in every provided source. Handles both synchronous and
 * asynchronous data sources efficiently using concurrent processing for optimal performance.
 *
 * Processes all iterables concurrently using Promise.all to convert them to Sets, then performs
 * intersection logic with early short-circuiting for empty sets. Perfect for finding common
 * elements across async data streams or mixed sync/async sources.
 *
 * @param iterables - Variable number of iterables or async iterables to find intersection across
 * @returns Promise resolving to Set containing elements present in all input sources
 * @template ParamTypes - Intersection of element types from all input iterables
 * @example
 * ```ts
 * // Basic async intersection
 * const common = await intersectionIterablesAsync([1, 2, 3], [2, 3, 4]);
 * // Set(2) {2, 3}
 *
 * // Mix of sync and async iterables
 * async function* asyncNumbers() {
 *   yield 2;
 *   yield 3;
 *   yield 4;
 * }
 * const mixed = await intersectionIterablesAsync([1, 2, 3], asyncNumbers());
 * // Set(2) {2, 3}
 *
 * // Multiple async generators
 * async function* gen1() { yield 'a'; yield 'b'; yield 'c'; }
 * async function* gen2() { yield 'b'; yield 'c'; yield 'd'; }
 * async function* gen3() { yield 'c'; yield 'd'; yield 'e'; }
 * const chars = await intersectionIterablesAsync(gen1(), gen2(), gen3());
 * // Set(1) {'c'}
 *
 * // Edge cases
 * const empty = await intersectionIterablesAsync(); // Set(0) {}
 * const single = await intersectionIterablesAsync(asyncNumbers()); // Set(3) {2, 3, 4}
 *
 * // Real-world: Finding common items across data streams
 * async function* fetchUserPreferences(userId: string) {
 *   // Simulate fetching user preferences
 *   yield 'sports';
 *   yield 'music';
 *   yield 'technology';
 * }
 * async function* fetchAvailableContent() {
 *   // Simulate fetching available content categories
 *   yield 'music';
 *   yield 'technology';
 *   yield 'movies';
 * }
 * const commonCategories = await intersectionIterablesAsync(
 *   fetchUserPreferences('user123'),
 *   fetchAvailableContent()
 * ); // Set(2) {'music', 'technology'}
 * ```
 */
export async function intersectionIterablesAsync(
  ...iterables: never[]
): Promise<Set<never>>;
export async function intersectionIterablesAsync<const Param1,>(
  ...iterables: [MaybeAsyncIterable<Param1>,]
): Promise<Set<Param1>>;
export async function intersectionIterablesAsync<const Param1, const Param2,>(
  ...iterables: [MaybeAsyncIterable<Param1>, MaybeAsyncIterable<Param2>,]
): Promise<Set<Param1 & Param2>>;
export async function intersectionIterablesAsync<const Param1, const Param2,
  const Param3,>(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
  ]
): Promise<Set<Param1 & Param2 & Param3>>;
export async function intersectionIterablesAsync<const Param1, const Param2, const Param3,
  const Param4,>(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
    MaybeAsyncIterable<Param4>,
  ]
): Promise<Set<Param1 & Param2 & Param3 & Param4>>;
export async function intersectionIterablesAsync<const Param1, const Param2, const Param3,
  const Param4, const Param5,>(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
    MaybeAsyncIterable<Param4>,
    MaybeAsyncIterable<Param5>,
  ]
): Promise<Set<Param1 & Param2 & Param3 & Param4 & Param5>>;
export async function intersectionIterablesAsync<const Param1, const Param2, const Param3,
  const Param4, const Param5, const Param6,>(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
    MaybeAsyncIterable<Param4>,
    MaybeAsyncIterable<Param5>,
    MaybeAsyncIterable<Param6>,
  ]
): Promise<Set<Param1 & Param2 & Param3 & Param4 & Param5 & Param6>>;
export async function intersectionIterablesAsync<const Param1, const Param2, const Param3,
  const Param4, const Param5, const Param6, const Param7,>(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
    MaybeAsyncIterable<Param4>,
    MaybeAsyncIterable<Param5>,
    MaybeAsyncIterable<Param6>,
    MaybeAsyncIterable<Param7>,
  ]
): Promise<Set<Param1 & Param2 & Param3 & Param4 & Param5 & Param6 & Param7>>;
export async function intersectionIterablesAsync<const Param1, const Param2, const Param3,
  const Param4, const Param5, const Param6, const Param7, const Param8,>(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
    MaybeAsyncIterable<Param4>,
    MaybeAsyncIterable<Param5>,
    MaybeAsyncIterable<Param6>,
    MaybeAsyncIterable<Param7>,
    MaybeAsyncIterable<Param8>,
  ]
): Promise<Set<Param1 & Param2 & Param3 & Param4 & Param5 & Param6 & Param7 & Param8>>;
export async function intersectionIterablesAsync<const Param1, const Param2, const Param3,
  const Param4, const Param5, const Param6, const Param7, const Param8, const Param9,>(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
    MaybeAsyncIterable<Param4>,
    MaybeAsyncIterable<Param5>,
    MaybeAsyncIterable<Param6>,
    MaybeAsyncIterable<Param7>,
    MaybeAsyncIterable<Param8>,
    MaybeAsyncIterable<Param9>,
  ]
): Promise<
  Set<Param1 & Param2 & Param3 & Param4 & Param5 & Param6 & Param7 & Param8 & Param9>
>;
export async function intersectionIterablesAsync<const T,>(
  ...iterables: MaybeAsyncIterable<T>[]
): Promise<Set<T>>;
export async function intersectionIterablesAsync(
  ...iterables: MaybeAsyncIterable<unknown>[]
): Promise<Set<unknown>> {
  if (isArrayEmpty(iterables,))
    return new Set();

  if (isArrayOfLength1(iterables,)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- had to use any
    return setOfIterableAsync(iterables[0] as any,);
  }

  // Start with the first iterable as candidates
  const candidates = await setOfIterableAsync(notUndefinedOrThrow(iterables[0],),);

  // Empty set short-circuit
  if (candidates.size === 0)
    return candidates;

  // Convert all subsequent iterables to sets concurrently
  const subsequentSets = await Promise.all(
    iterables.slice(1,).map(unary(setOfIterableAsync,),),
  );

  // For each subsequent set
  for (const currentSet of subsequentSets) {
    // Short-circuit if no candidates remain
    if (candidates.size === 0)
      return candidates;

    // If current set is empty, intersection is empty
    if (currentSet.size === 0) {
      candidates.clear();
      return candidates;
    }

    // Remove items from candidates that don't exist in current set
    for (const item of candidates) {
      if (!currentSet.has(item,))
        candidates.delete(item,);
    }
  }

  return candidates;
}
