import type { MaybeAsyncIterable } from './iterable.type.maybe.ts';

/**
 @remarks
 From https://stackoverflow.com/a/10179849 with CC BY-SA 4.0 written by Ry-
 "Tags" a given iterable with its index for each element, one by one.
 Lazy.

 @returns current element index and current element in a pair of two, stuffed into an array, which is yielded one by one.
 */
/* @__NO_SIDE_EFFECTS__ */ export async function* entriesIterableAsync<
  T_arrayLike extends MaybeAsyncIterable<any>,
  const T_element extends T_arrayLike extends Iterable<infer T_element> ? T_element
    : never,
>(
  arrayLike: T_arrayLike,
): AsyncGenerator<[number, T_element]> {
  let i = 0;

  for await (const arrayLikeElement of arrayLike as AsyncIterable<T_element>) {
    yield [i, arrayLikeElement];
    i++;
  }
}

/** {@inheritDoc entriesIterableAsync} */
/* @__NO_SIDE_EFFECTS__ */ export function* entriesIterable<
  const T_arrayLike extends Iterable<any>,
  const T_element extends T_arrayLike extends Iterable<infer T_element> ? T_element
    : never,
>(
  arrayLike: T_arrayLike,
): Generator<[number, T_element]> {
  let i = 0;

  for (const arrayLikeElement of arrayLike) {
    yield [i, arrayLikeElement];
    i++;
  }
}
