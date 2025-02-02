import {
  BooleanNot,
  entriesArrayLike,
  entriesArrayLikeAsync,
  mapArrayLikeAsync,
  type MaybeAsyncIterable,
} from '@monochromatic-dev/module-es/ts';
import type { Promisable } from 'type-fest';

/**
 @remarks
 Iterate over all the elements in an iterable.
 */
/* @__NO_SIDE_EFFECTS__ */ export async function noneFailArrayLikeAsync<T_element,
  T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  testingFn: (element: T_element, index?: number,
    arrayLike?: T_arrayLike) => Promisable<boolean>,
  arrayLike: T_arrayLike,
): Promise<boolean> {
  let result = true;
  for await (
    const [index, element] of entriesArrayLikeAsync(arrayLike as AsyncIterable<T_element>)
  ) {
    if (!await testingFn(element, index, arrayLike)) {
      result = false;
    }
  }
  return result;
}

export function noneFailArrayLike<T_element, T_arrayLike extends Iterable<T_element>,>(
  testingFn: (element: T_element, index?: number, arrayLike?: T_arrayLike) => boolean,
  arrayLike: T_arrayLike,
): boolean {
  let result = true;
  for (const [index, element] of entriesArrayLike(arrayLike)) {
    if (!testingFn(element, index, arrayLike)) {
      result = false;
    }
  }
  return result;
}
