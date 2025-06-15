import type { MaybeAsyncIterable } from './iterable.type.maybe.ts';

/**
 * Creates a new Set instance that's the union of the input iterables.
 * @param iterables - An array of iterables.
 * @returns A Set containing all unique elements from the input iterables.
 * @template ParamTypes - The types of elements in the input iterables.
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
 * Asynchronously creates a new Set instance that's the union of the input iterables or async iterables.
 * @param iterables - An array of iterables or async iterables.
 * @returns A promise that resolves to a Set containing all unique elements from the input iterables.
 * @template ParamTypes - The types of elements in the input iterables.
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
 * Creates a new generator that yields the union of the input iterables.
 * Elements are yielded in the order they appear and only once.
 * @param iterables - An array of iterables.
 * @returns A generator yielding all unique elements from the input iterables.
 * @template ParamTypes - The types of elements in the input iterables.
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
 * Asynchronously creates a new async generator that yields the union of the input iterables or async iterables.
 * Elements are yielded in the order they appear and only once.
 * @param iterables - An array of iterables or async iterables.
 * @returns An async generator yielding all unique elements from the input iterables.
 * @template ParamTypes - The types of elements in the input iterables.
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
