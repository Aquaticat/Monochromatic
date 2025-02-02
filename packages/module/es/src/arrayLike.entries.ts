import type { MaybeAsyncIterable } from '@monochromatic-dev/module-es/ts';

/**
 @remarks
 From https://stackoverflow.com/a/10179849 with CC BY-SA 4.0 written by Ry-
 "Tags" a given arrayLike with its index for each element, one by one.
 Lazy.

 @returns current element index and current element in a pair of two, stuffed into an array, which is yielded one by one.
 */
/* @__NO_SIDE_EFFECTS__ */ export async function* entriesArrayLikeAsync<T_element,>(
  arrayLike: MaybeAsyncIterable<T_element>,
): AsyncGenerator<[number, T_element]> {
  let i = 0;

  for await (const arrayLikeElement of arrayLike) {
    yield [i, arrayLikeElement];
    i++;
  }
}

/** {@inheritDoc entriesArrayLikeAsync} */
/* @__NO_SIDE_EFFECTS__ */ export function* entriesArrayLike<T_element,>(
  arrayLike: Iterable<T_element>,
): Generator<[number, T_element]> {
  let i = 0;

  for (const arrayLikeElement of arrayLike) {
    yield [i, arrayLikeElement];
    i++;
  }
}
