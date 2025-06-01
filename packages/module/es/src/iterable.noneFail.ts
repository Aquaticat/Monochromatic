import type { Promisable } from 'type-fest';
import type { BooleanNot } from './boolean.not.ts';
import {
  entriesIterable,
  entriesIterableAsync,
} from './iterable.entries.ts';
import { mapIterableAsync } from './iterable.map.ts';
import type { MaybeAsyncIterable } from './iterable.type.maybe.ts';

/**
 @remarks
 Iterate over all the elements in an iterable.
 */

/* @__NO_SIDE_EFFECTS__ */
export async function noneFailIterableAsync<T_element,
  T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  testingFn: (element: T_element, index?: number,
    arrayLike?: T_arrayLike) => Promisable<boolean>,
  arrayLike: T_arrayLike,
): Promise<boolean> {
  let result = true;
  for await (
    const [index, element] of entriesIterableAsync(arrayLike as AsyncIterable<T_element>)
  ) {
    if (!await testingFn(element, index, arrayLike)) {
      result = false;
    }
  }
  return result;
}

export function noneFailIterable<T_element, T_arrayLike extends Iterable<T_element>,>(
  testingFn: (element: T_element, index?: number, arrayLike?: T_arrayLike) => boolean,
  arrayLike: T_arrayLike,
): boolean {
  let result = true;
  for (const [index, element] of entriesIterable(arrayLike)) {
    if (!testingFn(element, index, arrayLike)) {
      result = false;
    }
  }
  return result;
}
