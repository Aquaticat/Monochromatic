// TODO: Finish the implementation and preferably write a Promise. function that handles this specific case.

import type { Promisable } from 'type-fest';
import { mapArrayLikeAsync } from './arrayLike.map.ts';
import type { MaybeAsyncIterable } from './arrayLike.type.ts';
import { BooleanNot } from './boolean.ts';
import { pipeAsync } from './function.ts';
import { somePromises } from './promise.ts';

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
  T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  testingFn: (element: T_element, index?: number,
    array?: T_element[]) => Promisable<boolean>,
  arrayLike: T_arrayLike,
): Promise<boolean> {
  // Double negative is not exactly positive here:
  // Doing it using somePromises could potentially help us
  // avoid unnecessarily waiting for all promises.
  // MAYBE: Write a inverted somePromises
  return !(await somePromises(pipeAsync(testingFn, BooleanNot), arrayLike));
}

/* @__NO_SIDE_EFFECTS__ */ export async function everyFailArrayLikeAsync<T_element,
  T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  testingFn: (element: T_element, index?: number,
    array?: T_element[]) => Promisable<boolean>,
  arrayLike: T_arrayLike,
): Promise<boolean> {
  return !(await somePromises(testingFn, arrayLike));
}

/* @__NO_SIDE_EFFECTS__ */ export async function noneArrayLikeAsync<T_element,
  T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  testingFn: (element: T_element, index?: number,
    array?: T_element[]) => Promisable<boolean>,
  arrayLike: T_arrayLike,
): Promise<boolean> {
  // MAYBE: Write my own Promise.all
  // We're not failing fast here.
  const fulfills = await Promise.all(await mapArrayLikeAsync(testingFn, arrayLike));

  return !fulfills.some(Boolean);
}

/* @__NO_SIDE_EFFECTS__ */ export async function noneFailArrayLikeAsync<T_element,
  T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  testingFn: (element: T_element, index?: number,
    array?: T_element[]) => Promisable<boolean>,
  arrayLike: T_arrayLike,
): Promise<boolean> {
  const fulfills = await Promise.all(await mapArrayLikeAsync(testingFn, arrayLike));

  return !fulfills.some(BooleanNot);
}

// TODO: Write none... and noneFail... which treats any possible errors testingFn throws as false.

// TODO: Write the sync versions.
