import {
  type MaybeAsyncIterable,
  somePromises,
} from '@monochromatic-dev/module-es/ts';
import type { Promisable } from 'type-fest';

/* @__NO_SIDE_EFFECTS__ */ export async function someArrayLikeAsync<T_element,>(
  predicate: (element: T_element) => Promisable<boolean>,
  arrayLike: MaybeAsyncIterable<T_element>,
): Promise<boolean> {
  return await somePromises(predicate, arrayLike);
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
