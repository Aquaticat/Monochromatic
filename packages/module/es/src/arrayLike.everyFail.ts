import type { Promisable } from 'type-fest';
import type { MaybeAsyncIterable } from './arrayLike.type.maybe.ts';
import {
  entriesIterable,
  entriesIterableAsync,
} from './iterable.entries.ts';

/* @__NO_SIDE_EFFECTS__ */
export async function everyFailIterableAsync<T_element,
  const T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  testingFn: (element: T_element, index?: number,
    arrayLike?: T_arrayLike) => Promisable<boolean>,
  arrayLike: T_arrayLike,
): Promise<boolean> {
  // TODO: Reimplement this in a parallel way - when Async Iterator helpers become available.
  for await (
    const [index, element] of entriesIterableAsync(arrayLike as AsyncIterable<T_element>)
  ) {
    if (await testingFn(element, index, arrayLike)) {
      return false;
    }
  }
  return true;
}

export function everyFailIterable<T_element,
  const T_arrayLike extends Iterable<T_element>,>(
  testingFn: (element: T_element, index?: number, arrayLike?: T_arrayLike) => boolean,
  arrayLike: T_arrayLike,
): boolean {
  for (
    const [index, element] of entriesIterable(arrayLike)
  ) {
    if (testingFn(element, index, arrayLike)) {
      return false;
    }
  }
  return true;
}
