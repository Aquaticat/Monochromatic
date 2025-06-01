import type { Promisable } from 'type-fest';
import type { MaybeAsyncIterable } from './iterable.type.maybe.ts';
import { somePromises } from './promises.some.ts';

/* @__NO_SIDE_EFFECTS__ */ export async function someIterableAsync<T_element,>(
  predicate: (element: T_element) => Promisable<boolean>,
  arrayLike: MaybeAsyncIterable<T_element>,
): Promise<boolean> {
  return await somePromises(predicate, arrayLike);
}

/* @__NO_SIDE_EFFECTS__ */ export async function someFailIterableAsync<T_element,>(
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
