import type { Promisable } from 'type-fest';
import type { MaybeAsyncIterable } from './arrayLike.type.ts';
import { somePromises } from './promise.ts';

/* @__NO_SIDE_EFFECTS__ */ export async function someArrayLikeAsync<T_element,>(
  predicate: (element: T_element) => Promisable<boolean>,
  arrayLike: MaybeAsyncIterable<T_element>,
): Promise<boolean> {
  return somePromises(predicate, arrayLike);
}

/* @__NO_SIDE_EFFECTS__ */ export async function someFailArrayLikeAsync<T_element,>(
  predicate: (element: T_element) => Promisable<boolean>,
  arrayLike: MaybeAsyncIterable<T_element>,
): Promise<boolean> {
  for await (const element of arrayLike) {
    if (!(predicate(element))) {
      return true;
    }
  }
  return false;
}
