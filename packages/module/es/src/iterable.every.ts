// TODO: Finish the implementation and preferably write a Promise. function that handles this specific case.

import type { Promisable } from 'type-fest';
import { throws } from './error.throws.ts';
import {
  entriesIterable,
  entriesIterableAsync,
} from './iterable.entries.ts';
import type {
  MappingFunction,
  MappingFunctionNoArrayPromisable,
  MappingFunctionPromisable,
} from './iterable.map.ts';
import type { MaybeAsyncIterable } from './iterable.type.maybe.ts';
import { logtapeGetLogger } from './logtape.shared.ts';

const l = logtapeGetLogger(['m', 'iterable.every']);

/**
 @remarks
 Fails fast when encountering false, returning false.
 Throws errors when testingFn throws errors.

 Because of the failfast behavior,
 it cannot be used to assert the testingFn won't throw errors
 when called on every element of the entire iterable.
 This matches the behavior of the standard Array.prototype.every() .

 Because it uses parallel processing,
 we cannot even be sure if it would throw error or return false every time it runs.
 See noneIterableAsync for a function
 that is guranteed to call testingFn on everything and throws when encountering an error.
 */

/* @__NO_SIDE_EFFECTS__ */
export async function everyIterableAsync<const T_element,
  const T_iterable extends MaybeAsyncIterable<T_element>,>(
  testingFn: MappingFunctionPromisable<T_element, boolean>,
  iterable: T_iterable,
): Promise<boolean> {
  // We do have to collect the iterable first because testingFn could take 3 parameters, the 3rd being the array.
  const arr: T_element[] = await Array.fromAsync(iterable);

  /*
   We invert the approach from noneIterableAsync:
   - Create promises that reject with a sentinel value when predicates return true
   - And resolve with a signal value when predicates return false
   - Using Promise.any to detect first false result
   - Propagate any actual errors from predicates
   */

  const promises: Promise<'result is false' | Error>[] = arr.map(
    function mapper(element, index): Promise<'result is false' | Error> {
      return (async function inner(): Promise<'result is false' | Error> {
        // Propagate predicate errors
        const result: boolean | Error =
          await (async function throwing(): Promise<boolean | Error> {
            try {
              return await testingFn(element, index, arr);
            } catch (error) {
              // l.warn`${error}`;
              return error as Error;
            }
          })();

        if (result === true) {
          throw new Error(`result is true`);
        } else if (result === false) {
          return 'result is false'; // Short-circuit when predicate returns false
        } else {
          return result;
        }
      })();
    },
  );

  const promiseAnyResult: 'result is false' | Error | 'every item passes predicate' =
    await (async function orTrue() {
      try {
        return await Promise.any(promises);
      } catch {
        return 'every item passes predicate';
      }
    })();
  // l.warn`${promiseAnyResult}`;

  if (promiseAnyResult === 'every item passes predicate') {
    return true;
  }

  // If any promise resolved with false, short-circuit with false
  if (promiseAnyResult === 'result is false') {
    return false;
  }

  throw promiseAnyResult;
}

export function everyIterable<const T_element,
  const T_iterable extends Iterable<T_element>,>(
  testingFn: MappingFunction<T_element, boolean>,
  iterable: T_iterable,
): boolean {
  // We do have to collect the iterable first because testingFn could take 3 parameters, the 3rd being the array.
  const arr: T_element[] = [...iterable];
  for (const [index, element] of entriesIterable(arr)) {
    if (!testingFn(element, index, arr)) {
      return false;
    }
  }
  return true;
}
