import type { MaybeAsyncIterable } from './iterable.type.maybe.ts';

export function unionIterables(...arrays: never[]): Set<never>;
export function unionIterables<const Param1,>(...arrays: [Iterable<Param1>]): Set<Param1>;
export function unionIterables<const Param1, const Param2,>(
  ...arrays: [Iterable<Param1>, Iterable<Param2>]
): Set<Param1 | Param2>;
export function unionIterables<const Param1, const Param2, const Param3,>(
  ...arrays: [Iterable<Param1>, Iterable<Param2>, Iterable<Param3>]
): Set<Param1 | Param2 | Param3>;
export function unionIterables<const Param1, const Param2, const Param3, const Param4,>(
  ...arrays: [Iterable<Param1>, Iterable<Param2>, Iterable<Param3>, Iterable<Param4>]
): Set<Param1 | Param2 | Param3 | Param4>;
export function unionIterables<const Param1, const Param2, const Param3, const Param4,
  const Param5,>(
  ...arrays: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
  ]
): Set<Param1 | Param2 | Param3 | Param4 | Param5>;
export function unionIterables<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6,>(
  ...arrays: [
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
  ...arrays: [
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
): Set<Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7 | Param8>;
export function unionIterables<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, const Param7, const Param8, const Param9,>(
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
): Set<Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7 | Param8 | Param9>;
export function unionIterables<const T,>(...arrays: Iterable<T>[]): Set<T>;
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
 * Asynchronously creates a new Set instance that is the union of the input iterables or async iterables.
 * @param iterables - An array of iterables or async iterables.
 * @returns A promise that resolves to a Set containing all unique elements from the input iterables.
 * @template ParamTypes - The types of elements in the input iterables.
 */
export async function unionIterablesAsync(
  ...iterables: never[]
): Promise<Set<never>>;
export async function unionIterablesAsync<const Param1, >(
  ...iterables: [MaybeAsyncIterable<Param1>]
): Promise<Set<Param1>>;
export async function unionIterablesAsync<const Param1, const Param2, >(
  ...iterables: [MaybeAsyncIterable<Param1>, MaybeAsyncIterable<Param2>]
): Promise<Set<Param1 | Param2>>;
export async function unionIterablesAsync<const Param1, const Param2, const Param3, >(
  ...iterables: [MaybeAsyncIterable<Param1>, MaybeAsyncIterable<Param2>, MaybeAsyncIterable<Param3>]
): Promise<Set<Param1 | Param2 | Param3>>;
export async function unionIterablesAsync<const Param1, const Param2, const Param3, const Param4, >(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
    MaybeAsyncIterable<Param4>,
  ]
): Promise<Set<Param1 | Param2 | Param3 | Param4>>;
export async function unionIterablesAsync<const Param1, const Param2, const Param3, const Param4,
  const Param5, >(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
    MaybeAsyncIterable<Param4>,
    MaybeAsyncIterable<Param5>,
  ]
): Promise<Set<Param1 | Param2 | Param3 | Param4 | Param5>>;
export async function unionIterablesAsync<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, >(
  ...iterables: [
    MaybeAsyncIterable<Param1>,
    MaybeAsyncIterable<Param2>,
    MaybeAsyncIterable<Param3>,
    MaybeAsyncIterable<Param4>,
    MaybeAsyncIterable<Param5>,
    MaybeAsyncIterable<Param6>,
  ]
): Promise<Set<Param1 | Param2 | Param3 | Param4 | Param5 | Param6>>;
export async function unionIterablesAsync<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, const Param7, >(
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
export async function unionIterablesAsync<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, const Param7, const Param8, >(
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
export async function unionIterablesAsync<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, const Param7, const Param8, const Param9, >(
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
): Promise<Set<Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7 | Param8 | Param9>>;
export async function unionIterablesAsync<const T, >(
  ...iterables: MaybeAsyncIterable<T>[]
): Promise<Set<T>>;
export async function unionIterablesAsync(
  ...iterables: MaybeAsyncIterable<unknown>[]
): Promise<Set<unknown>> {
  if (iterables.length === 0) {
    return new Set();
  }
  const resultSet = new Set<unknown>();
  for (const iterable of iterables) {
    for await (const item of iterable) {
      resultSet.add(item);
    }
  }
  return resultSet;
}
