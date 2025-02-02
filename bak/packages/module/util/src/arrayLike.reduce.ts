import type { Promisable } from 'type-fest';
import {
  arrayFrom,
  arrayFromAsync,
} from './arrayLike.from.ts';
import { isEmptyArray } from './arrayLike.is.ts';
import type { MaybeAsyncIterable } from './arrayLike.type.ts';

/* @__NO_SIDE_EFFECTS__ */ export async function reduceArrayLikeAsync<T_accumulated,
  T_element,>(
  initialValue: T_accumulated,
  reducer: (accumulator: T_accumulated, currentValue: T_element, currentIndex?: number,
    array?: T_element[]) => Promisable<T_accumulated>,
  arrayLike: MaybeAsyncIterable<T_element>,
  internalCurrentIndex = 0,
): Promise<T_accumulated> {
  const arrayLikeArray: T_element[] = await arrayFromAsync(arrayLike);

  // Unfortunately, directly calling reduce is incorrect because reducer might be async.
  /*return arrayLikeArray.reduce(
    reducer as any,
    initialValue,
  ) as T_accumulated;*/

  if (isEmptyArray(arrayLikeArray)) {
    return initialValue;
  }

  // FIXME: Would probably fill up the stack.
  return await reduceArrayLikeAsync(
    await reducer(initialValue, // Built-in at doesn't know there's something at(0)
      // even though I just checked for length and it's not empty?
      arrayLikeArray.at(0)!, internalCurrentIndex, arrayLikeArray),
    reducer,
    arrayLikeArray.slice(1),
    internalCurrentIndex + 1,
  );
}

/* @__NO_SIDE_EFFECTS__ */ export function reduceArrayLike<T_accumulated, T_element,>(
  initialValue: T_accumulated,
  reducer: (accumulator: T_accumulated, currentValue: T_element, currentIndex?: number,
    array?: T_element[]) => T_accumulated,
  arrayLike: Iterable<T_element>,
): T_accumulated {
  const arrayLikeArray: T_element[] = arrayFrom(arrayLike);

  return arrayLikeArray.reduce(
    reducer,
    initialValue,
  );
}
