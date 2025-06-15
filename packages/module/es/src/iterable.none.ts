import type { Promisable } from 'type-fest';
import {
  ensuringFalsyAsync,
  ensuringTruthyAsync,
  nonThrowingWithFalse,
} from './function.ensuring.ts';
import {
  // BooleanNot,
  entriesIterable,
  entriesIterableAsync,
  // mapArrayLikeAsync,
} from './iterable.entries.ts';
import type { MappingFunction } from './iterable.map.ts';
import type { MaybeAsyncIterable } from './iterable.type.maybe.ts';

/**
 @remarks
 Iterate over the elements in an iterable.
 Doesn't throw when the predicate throws.
 When the predicate throws, it counts as the predicate being false.
 This function's purpose is to ensure none of the elements in the iterable,
 when being passed to the predicate, return true.
 When one of the predicates returns true, the function short-circuits and returns false.
 */

/* @__NO_SIDE_EFFECTS__ */
export async function noneIterableAsync<T_element,
  T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  testingFn: MappingFunction<T_element, Promisable<boolean>>,
  arrayLike: T_arrayLike,
): Promise<boolean> {
  const arr: T_element[] = await Array.fromAsync(arrayLike);

  /*
   We want the modified predicate to throw (causing a rejected promise) as long as it doesn't satisfy.
   Then we feed the array of (rejectingPromise|true)[] into Promise.any.
   When Promise.any resolves, it means that at least one of the predicates returned true,
   which means the whole noneArray test should return false.
   Otherwise, Promise.any rejects, which means all the predicates rejected,
   so the whole noneArray test should return true.
   */
  const ensuredTruthyAsync = ensuringTruthyAsync(testingFn);
  const results = arr.map(
    function toPromise(element: T_element, index: number): Promisable<boolean> {
      return ensuredTruthyAsync(element, index, arr);
    },
  );
  try {
    await Promise.any(results);
    return false;
  } catch {
    return true;
  }
}

export function noneIterable<T_element, T_arrayLike extends Iterable<T_element>,>(
  testingFn: MappingFunction<T_element, boolean>,
  arrayLike: T_arrayLike,
): boolean {
  const arr: T_element[] = [...arrayLike];
  const nonThrowingFn = nonThrowingWithFalse(testingFn);
  for (const [index, element] of entriesIterable(arr)) {
    if (nonThrowingFn(element, index, arr)) {
      return false;
    }
  }
  return true;
  /*
   let result = true;
   for (const [index, element] of entriesArrayLike(arrayLike)) {
   if (testingFn(element, index, arrayLike)) {
   result = false;
   }
   }
   return result;*/
}
