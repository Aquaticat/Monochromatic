// TODO: Finish the implementation and preferably write a Promise. function that handles this specific case.

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
 Fails fast when encountering false, returning false.
 Throws errors when testingFn throws errors.

 Because of the failfast behavior,
 it cannot be used to assert the testingFn won't throw errors
 when called on every element of the entire arrayLike.
 This matches the behavior of the standard Array.prototype.every() .

 Because it uses parallel processing,
 we cannot even be sure if it would throw error or return false every time it runs.
 See noneArrayLikeAsync for a function
 that is guranteed to call testingFn on everything and throws when encountering an error.
 */
/* @__NO_SIDE_EFFECTS__ */ export async function everyArrayLikeAsync<T_element,
  const T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  testingFn: (element: T_element, index?: number,
    arrayLike?: T_arrayLike) => Promisable<boolean>,
  arrayLike: T_arrayLike,
): Promise<boolean> {
  // Double negative is not exactly positive here:
  // Doing it using somePromises could potentially help us
  // avoid unnecessarily waiting for all promises.
  // MAYBE: Write a inverted somePromises

  // TODO: Reimplement this in a parallel way - when Async Iterator helpers become available.
  for await (
    const [index, element] of entriesArrayLikeAsync(arrayLike as AsyncIterable<T_element>)
  ) {
    if (!await testingFn(element, index, arrayLike)) {
      return false;
    }
  }
  return true;

  /*   if (arrayLike[Symbol.iterator]) {

  const result = await  Promise.any(Iterator.from(arrayLike as Iterable<T_element>).map(pipeAsync(testingFn, (testingResult: boolean): true => testingResult ? throws(new RangeError('This element passes testingFn. Throwing to signal to Promise.any to ignore this result.')) : true)));
} */
}

export function everyArrayLike<T_element, const T_arrayLike extends Iterable<T_element>,>(
  testingFn: (element: T_element, index?: number, arrayLike?: T_arrayLike) => boolean,
  arrayLike: T_arrayLike,
): boolean {
  for (const [index, element] of entriesArrayLike(arrayLike)) {
    if (!testingFn(element, index, arrayLike)) {
      return false;
    }
  }
  return true;
}
