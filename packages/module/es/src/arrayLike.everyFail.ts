import type { Promisable } from 'type-fest';
import {
  entriesArrayLike,
  entriesArrayLikeAsync,
} from './arrayLike.entries.ts';
import type { MaybeAsyncIterable } from './arrayLike.type.maybe.ts';

/* @__NO_SIDE_EFFECTS__ */ export async function everyFailArrayLikeAsync<T_element,
  const T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  testingFn: (element: T_element, index?: number,
    arrayLike?: T_arrayLike) => Promisable<boolean>,
  arrayLike: T_arrayLike,
): Promise<boolean> {
  // TODO: Reimplement this in a parallel way - when Async Iterator helpers become available.
  for await (
    const [index, element] of entriesArrayLikeAsync(arrayLike as AsyncIterable<T_element>)
  ) {
    if (await testingFn(element, index, arrayLike)) {
      return false;
    }
  }
  return true;
}

export function everyFailArrayLike<T_element,
  const T_arrayLike extends Iterable<T_element>,>(
  testingFn: (element: T_element, index?: number, arrayLike?: T_arrayLike) => boolean,
  arrayLike: T_arrayLike,
): boolean {
  for (
    const [index, element] of entriesArrayLike(arrayLike)
  ) {
    if (testingFn(element, index, arrayLike)) {
      return false;
    }
  }
  return true;
}
