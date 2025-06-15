import type { MaybeAsyncIterable } from './iterable.type.maybe.ts';

/**
 * Creates a new Set containing the union of all input iterables, preserving type safety across
 * multiple iterable sources. Combines elements from all iterables while automatically deduplicating
 * using Set semantics, making it perfect for merging data from different sources.
 *
 * The function uses extensive overloads to maintain precise type information for up to 9 iterables,
 * with union types that capture all possible element types from the input sources.
 *
 * @param iterables - Variable number of iterables to combine into a union set
 * @returns Set containing all unique elements from input iterables, with precise union typing
 * @template ParamTypes - Union of element types from all input iterables
 * @example
 * ```ts
 * // Basic union of arrays
 * const numbers = unionIterables([1, 2, 3], [3, 4, 5]); // Set(5) {1, 2, 3, 4, 5}
 *
 * // Union with different types
 * const mixed = unionIterables(['a', 'b'], [1, 2]); // Set<string | number>
 *
 * // Works with any iterables
 * const set1 = new Set([1, 2, 3]);
 * const set2 = new Set([3, 4, 5]);
 * const combined = unionIterables(set1, set2); // Set(5) {1, 2, 3, 4, 5}
 *
 * // String characters
 * const chars = unionIterables('abc', 'bcd'); // Set(4) {'a', 'b', 'c', 'd'}
 *
 * // Empty and single iterables
 * const empty = unionIterables(); // Set(0) {}
 * const single = unionIterables([1, 2, 2]); // Set(2) {1, 2}
 * ```
 */
export function unionIterables(...iterables: never[]): Set<never>;
export function unionIterables<const Param1,>(
  ...iterables: [Iterable<Param1>]
): Set<Param1>;
export function unionIterables<const Param1, const Param2,>(
  ...iterables: [Iterable<Param1>, Iterable<Param2>]
): Set<Param1 | Param2>;
export function unionIterables<const Param1, const Param2, const Param3,>(
  ...iterables: [Iterable<Param1>, Iterable<Param2>, Iterable<Param3>]
): Set<Param1 | Param2 | Param3>;
export function unionIterables<const Param1, const Param2, const Param3, const Param4,>(
  ...iterables: [Iterable<Param1>, Iterable<Param2>, Iterable<Param3>, Iterable<Param4>]
): Set<Param1 | Param2 | Param3 | Param4>;
export function unionIterables<const Param1, const Param2, const Param3, const Param4,
  const Param5,>(
  ...iterables: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
  ]
): Set<Param1 | Param2 | Param3 | Param4 | Param5>;
export function unionIterables<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6,>(
  ...iterables: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
    Iterable<Param6>,
  ]
): Set<Param1 | Param2 | Param3 | Param4 | Param5 | Param6>;
export function unionIterables<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, const Param7,>(
  ...iterables: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
    Iterable<Param6>,
    Iterable<Param7>,
  ]
): Set<Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7>;
export function unionIterables<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, const Param7, const Param8,>(
  ...iterables: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
    Iterable<Param6>,
    Iterable<Param7>,
    Iterable<Param8>,
  ]
): Set<Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7 | Param8>;
export function unionIterables<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, const Param7, const Param8, const Param9,>(
  ...iterables: [
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
): Set<Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7 | Param8 | Param9>;
export function unionIterables<const T,>(...iterables: Iterable<T>[]): Set<T>;
export function unionIterables(...iterables: Iterable<unknown>[]): Set<unknown> {
  if (iterables.length === 0) {
    return new Set();
  }
  const trueArrays: unknown[][] = iterables.map(
    function toArray(array: Iterable<unknown>): unknown[] {
      return Array.isArray(array) ? array : [...array];
    },
  );
  const flatArray: unknown[] = trueArrays.flat();
  return new Set(flatArray);
}

/**
 * Asynchronously creates a new Set containing the union of all input iterables and async iterables,
 * handling both synchronous and asynchronous data sources. Perfect for combining data streams,
 * async generators, or mixed sync/async iterables while maintaining type safety.
 *
 * Processes all iterables concurrently using Promise.all for optimal performance, then combines
 * all elements into a single deduplicated Set.
 *
 * @param iterables - Variable number of iterables or async iterables to combine
 * @returns Promise resolving to Set containing all unique elements from input sources
 * @template ParamTypes - Union of element types from all input iterables
 * @example
 * ```ts
 * // Basic async union
 * const result1 = await unionIterablesAsync([1, 2, 3], [3, 4, 5]);
 * // Set(5) {1, 2, 3, 4, 5}
 *
 * // Mix of sync and async iterables
 * async function* asyncNumbers() {
 *   yield 10;
 *   yield 20;
 * }
 * const mixed = await unionIterablesAsync([1, 2], asyncNumbers());
 * // Set(4) {1, 2, 10, 20}
 *
 * // Multiple async generators
 * async function* gen1() { yield 'a'; yield 'b'; }
 * async function* gen2() { yield 'b'; yield 'c'; }
 * const chars = await unionIterablesAsync(gen1(), gen2());
 * // Set(3) {'a', 'b', 'c'}
 *
 * // Empty and single async cases
 * const empty = await unionIterablesAsync(); // Set(0) {}
 * const single = await unionIterablesAsync(asyncNumbers()); // Set(2) {10, 20}
 * ```
 */
export async function unionIterablesAsync(
  ...iterables: never[]
): Promise<Set<never>>;
export async function unionIterablesAsync<const Param1,>(
  ...iterables: [MaybeAsyncIterable<Param1>]
): Promise<Set<Param1>>;
export async function unionIterablesAsync<const Param1, const Param2,>(
  ...iterables: [MaybeAsyncIterable<Param1>, MaybeAsyncIterable<Param2>]
): Promise<Set<Param1 | Param2>>;
export async function unionIterablesAsync<const Param1, const Param2, const Param3,>(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
  ]
): Promise<Set<Param1 | Param2 | Param3>>;
export async function unionIterablesAsync<const Param1, const Param2, const Param3,
  const Param4,>(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
    MaybeAsyncIterable<Param4>,
  ]
): Promise<Set<Param1 | Param2 | Param3 | Param4>>;
export async function unionIterablesAsync<const Param1, const Param2, const Param3,
  const Param4, const Param5,>(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
    MaybeAsyncIterable<Param4>,
    MaybeAsyncIterable<Param5>,
  ]
): Promise<Set<Param1 | Param2 | Param3 | Param4 | Param5>>;
export async function unionIterablesAsync<const Param1, const Param2, const Param3,
  const Param4, const Param5, const Param6,>(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
    MaybeAsyncIterable<Param4>,
    MaybeAsyncIterable<Param5>,
    MaybeAsyncIterable<Param6>,
  ]
): Promise<Set<Param1 | Param2 | Param3 | Param4 | Param5 | Param6>>;
export async function unionIterablesAsync<const Param1, const Param2, const Param3,
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
): Promise<Set<Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7>>;
export async function unionIterablesAsync<const Param1, const Param2, const Param3,
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
): Promise<Set<Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7 | Param8>>;
export async function unionIterablesAsync<const Param1, const Param2, const Param3,
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
  Set<Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7 | Param8 | Param9>
>;
export async function unionIterablesAsync<const T,>(
  ...iterables: MaybeAsyncIterable<T>[]
): Promise<Set<T>>;
export async function unionIterablesAsync(
  ...iterables: MaybeAsyncIterable<unknown>[]
): Promise<Set<unknown>> {
  if (iterables.length === 0) {
    return new Set();
  }
  const resultSet = new Set<unknown>();

  // Create a promise for each iterable to collect its items
  const itemPromises = iterables.map(async function toItems(iterable) {
    const items: unknown[] = [];
    for await (const item of iterable) {
      items.push(item);
    }
    return items;
  });

  // Wait for all iterables to be processed
  const arrayOfItemArrays = await Promise.all(itemPromises);

  // Add all items to the result set
  for (const itemArray of arrayOfItemArrays) {
    for (const item of itemArray) {
      resultSet.add(item);
    }
  }

  return resultSet;
}

/**
 * Creates a memory-efficient generator that yields the union of all input iterables in encounter
 * order. Elements are yielded as soon as they're discovered and only once, making this perfect
 * for processing large datasets without loading everything into memory at once.
 *
 * Uses a Set internally to track yielded elements for deduplication while maintaining the
 * lazy evaluation benefits of generators. Elements appear in the order they're first encountered
 * across the input iterables.
 *
 * @param iterables - Variable number of iterables to process in union fashion
 * @returns Generator yielding unique elements in encounter order
 * @template ParamTypes - Union of element types from all input iterables
 * @example
 * ```ts
 * // Basic generator union
 * const gen = unionIterablesGen([1, 2, 3], [3, 4, 5]);
 * for (const item of gen) {
 *   console.log(item); // 1, 2, 3, 4, 5 (in encounter order)
 * }
 *
 * // Memory-efficient processing of large datasets
 * function* largeDataset1() { for(let i = 0; i < 1000000; i++) yield i; }
 * function* largeDataset2() { for(let i = 500000; i < 1500000; i++) yield i; }
 * const union = unionIterablesGen(largeDataset1(), largeDataset2());
 * // Processes without loading all data into memory
 *
 * // String processing
 * const chars = unionIterablesGen('abc', 'bcd', 'cde');
 * console.log([...chars]); // ['a', 'b', 'c', 'd', 'e']
 *
 * // Early termination
 * const gen2 = unionIterablesGen([1, 2, 3], [4, 5, 6]);
 * const first3 = [];
 * for (const item of gen2) {
 *   first3.push(item);
 *   if (first3.length === 3) break; // Only processes what's needed
 * }
 * ```
 */
export function unionIterablesGen(
  ...iterables: never[]
): Generator<never, void, undefined>;
export function unionIterablesGen<const Param1,>(
  ...iterables: [Iterable<Param1>]
): Generator<Param1, void, undefined>;
export function unionIterablesGen<const Param1, const Param2,>(
  ...iterables: [Iterable<Param1>, Iterable<Param2>]
): Generator<Param1 | Param2, void, undefined>;
export function unionIterablesGen<const Param1, const Param2, const Param3,>(
  ...iterables: [Iterable<Param1>, Iterable<Param2>, Iterable<Param3>]
): Generator<Param1 | Param2 | Param3, void, undefined>;
export function unionIterablesGen<const Param1, const Param2, const Param3,
  const Param4,>(
  ...iterables: [Iterable<Param1>, Iterable<Param2>, Iterable<Param3>, Iterable<Param4>]
): Generator<Param1 | Param2 | Param3 | Param4, void, undefined>;
export function unionIterablesGen<const Param1, const Param2, const Param3, const Param4,
  const Param5,>(
  ...iterables: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
  ]
): Generator<Param1 | Param2 | Param3 | Param4 | Param5, void, undefined>;
export function unionIterablesGen<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6,>(
  ...iterables: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
    Iterable<Param6>,
  ]
): Generator<Param1 | Param2 | Param3 | Param4 | Param5 | Param6, void, undefined>;
export function unionIterablesGen<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, const Param7,>(
  ...iterables: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
    Iterable<Param6>,
    Iterable<Param7>,
  ]
): Generator<Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7, void,
  undefined>;
export function unionIterablesGen<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, const Param7, const Param8,>(
  ...iterables: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
    Iterable<Param6>,
    Iterable<Param7>,
    Iterable<Param8>,
  ]
): Generator<
  Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7 | Param8,
  void,
  undefined
>;
export function unionIterablesGen<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, const Param7, const Param8, const Param9,>(
  ...iterables: [
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
): Generator<
  Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7 | Param8 | Param9,
  void,
  undefined
>;
export function unionIterablesGen<const T,>(
  ...iterables: Iterable<T>[]
): Generator<T, void, undefined>;
export function* unionIterablesGen(
  ...iterables: Iterable<unknown>[]
): Generator<unknown, void, undefined> {
  const yieldedSet = new Set<unknown>();
  for (const iterable of iterables) {
    for (const item of iterable) {
      if (!yieldedSet.has(item)) {
        yieldedSet.add(item);
        yield item;
      }
    }
  }
}

/**
 * Creates a memory-efficient async generator that yields the union of all input iterables and
 * async iterables in encounter order. Handles both synchronous and asynchronous data sources
 * while maintaining lazy evaluation and memory efficiency for large or infinite data streams.
 *
 * Processes iterables sequentially (not concurrently) to maintain encounter order, using a Set
 * for deduplication. Elements are yielded as soon as they're discovered and only once.
 *
 * @param iterables - Variable number of iterables or async iterables to process
 * @returns AsyncGenerator yielding unique elements in encounter order
 * @template ParamTypes - Union of element types from all input iterables
 * @example
 * ```ts
 * // Basic async generator union
 * async function* gen1() { yield 1; yield 2; }
 * async function* gen2() { yield 2; yield 3; }
 * const union = unionIterablesAsyncGen(gen1(), gen2());
 * for await (const item of union) {
 *   console.log(item); // 1, 2, 3 (in encounter order)
 * }
 *
 * // Mix of sync and async sources
 * async function* asyncData() { yield 'async1'; yield 'async2'; }
 * const mixed = unionIterablesAsyncGen(['sync1', 'sync2'], asyncData());
 * const result = [];
 * for await (const item of mixed) {
 *   result.push(item); // ['sync1', 'sync2', 'async1', 'async2']
 * }
 *
 * // Streaming data processing
 * async function* dataStream1() {
 *   for (let i = 0; i < 1000; i++) {
 *     await new Promise(resolve => setTimeout(resolve, 1)); // Simulate delay
 *     yield `stream1-${i}`;
 *   }
 * }
 * async function* dataStream2() {
 *   for (let i = 500; i < 1500; i++) {
 *     yield `stream2-${i}`;
 *   }
 * }
 * const streamUnion = unionIterablesAsyncGen(dataStream1(), dataStream2());
 * // Memory-efficient processing of streaming data
 *
 * // Early termination with async
 * const asyncGen = unionIterablesAsyncGen(gen1(), gen2());
 * const first2 = [];
 * for await (const item of asyncGen) {
 *   first2.push(item);
 *   if (first2.length === 2) break; // Stops processing early
 * }
 * ```
 */
export function unionIterablesAsyncGen(
  ...iterables: never[]
): AsyncGenerator<never, void, undefined>;
export function unionIterablesAsyncGen<const Param1,>(
  ...iterables: [MaybeAsyncIterable<Param1>]
): AsyncGenerator<Param1, void, undefined>;
export function unionIterablesAsyncGen<const Param1, const Param2,>(
  ...iterables: [MaybeAsyncIterable<Param1>, MaybeAsyncIterable<Param2>]
): AsyncGenerator<Param1 | Param2, void, undefined>;
export function unionIterablesAsyncGen<const Param1, const Param2, const Param3,>(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
  ]
): AsyncGenerator<Param1 | Param2 | Param3, void, undefined>;
export function unionIterablesAsyncGen<const Param1, const Param2, const Param3,
  const Param4,>(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
    MaybeAsyncIterable<Param4>,
  ]
): AsyncGenerator<Param1 | Param2 | Param3 | Param4, void, undefined>;
export function unionIterablesAsyncGen<const Param1, const Param2, const Param3,
  const Param4, const Param5,>(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
    MaybeAsyncIterable<Param4>,
    MaybeAsyncIterable<Param5>,
  ]
): AsyncGenerator<Param1 | Param2 | Param3 | Param4 | Param5, void, undefined>;
export function unionIterablesAsyncGen<const Param1, const Param2, const Param3,
  const Param4, const Param5, const Param6,>(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
    MaybeAsyncIterable<Param4>,
    MaybeAsyncIterable<Param5>,
    MaybeAsyncIterable<Param6>,
  ]
): AsyncGenerator<Param1 | Param2 | Param3 | Param4 | Param5 | Param6, void, undefined>;
export function unionIterablesAsyncGen<const Param1, const Param2, const Param3,
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
): AsyncGenerator<Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7, void,
  undefined>;
export function unionIterablesAsyncGen<const Param1, const Param2, const Param3,
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
): AsyncGenerator<
  Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7 | Param8,
  void,
  undefined
>;
export function unionIterablesAsyncGen<const Param1, const Param2, const Param3,
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
): AsyncGenerator<
  Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7 | Param8 | Param9,
  void,
  undefined
>;
export function unionIterablesAsyncGen<const T,>(
  ...iterables: MaybeAsyncIterable<T>[]
): AsyncGenerator<T, void, undefined>;
export async function* unionIterablesAsyncGen(
  ...iterables: MaybeAsyncIterable<unknown>[]
): AsyncGenerator<unknown, void, undefined> {
  const yieldedSet = new Set<unknown>();
  for (const iterable of iterables) {
    // oxlint-disable-next-line no-await-in-loop -- await in loop here is necessary for the logic, because this function processes each MaybeAsyncIterable one by one.
    for await (const item of iterable) {
      if (!yieldedSet.has(item)) {
        yieldedSet.add(item);
        yield item;
      }
    }
  }
}
