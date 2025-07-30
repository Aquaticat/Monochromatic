// TODO: Finish the implementation and preferably write a Promise. function that handles this specific case.

import type { Promisable, } from 'type-fest';
import { throws, } from './error.throws.ts';
import {
  entriesIterable,
  entriesIterableAsync,
} from './iterable.entries.ts';
import type {
  MappingFunction,
  MappingFunctionNoArrayPromisable,
  MappingFunctionPromisable,
} from './iterable.map.ts';
import type { MaybeAsyncIterable, } from './iterable.type.maybe.ts';
import { logtapeGetLogger, } from './logtape.shared.ts';

const l = logtapeGetLogger(['m', 'iterable.every',],);

/**
 * Asynchronously tests whether all elements in an async iterable satisfy a predicate function.
 * This is the async equivalent of Array.prototype.every(), supporting both sync and async iterables
 * with sync or async testing functions. Uses parallel processing with Promise.any for efficient execution.
 *
 * The function fails fast when encountering the first false result, immediately returning false.
 * Due to parallel processing, the order of predicate evaluation isn't guaranteed, and the function
 * may return false or throw an error depending on which promise resolves first.
 *
 * @param testingFn - Predicate function to test each element, can return Promise<boolean> or boolean
 * @param iterable - Async iterable to test elements from
 * @returns True if all elements satisfy the predicate, false if any element fails the test
 * @throws {Error} When testingFn throws errors during execution
 *
 * @remarks
 * **Fail-fast behavior**: Returns false immediately when encountering the first false result.
 * **Error propagation**: Throws errors when testingFn throws errors.
 * **Parallel processing**: Uses Promise.any for concurrent execution, so evaluation order isn't guaranteed.
 * **Compatibility**: Matches the behavior of Array.prototype.every() for consistency.
 *
 * Because of the fail-fast behavior, this function can't be used to assert that testingFn
 * won't throw errors when called on every element of the entire iterable.
 * For guaranteed evaluation of all elements with error handling, see noneIterableAsync.
 *
 * @example
 * ```ts
 * // Test if all numbers are positive
 * const numbers = [1, 2, 3, 4, 5];
 * const allPositive = await everyIterableAsync(x => x > 0, numbers); // true
 *
 * // With async predicate function
 * const users = [{ id: 1, active: true }, { id: 2, active: true }];
 * const allActive = await everyIterableAsync(
 *   async user => {
 *     // Simulate API call
 *     await new Promise(resolve => setTimeout(resolve, 10));
 *     return user.active;
 *   },
 *   users
 * ); // true
 *
 * // Using index and array parameters
 * const items = ['a', 'b', 'c'];
 * const validIndexes = await everyIterableAsync(
 *   async (element, index, array) => {
 *     return index < array.length && element.length > 0;
 *   },
 *   items
 * ); // true
 *
 * // Fail-fast behavior demonstration
 * const mixed = [2, 4, 3, 6, 8]; // 3 is odd
 * const allEven = await everyIterableAsync(x => x % 2 === 0, mixed); // false
 *
 * // With async iterable
 * async function* asyncNumbers() {
 *   yield 2; yield 4; yield 6;
 * }
 * const allEvenAsync = await everyIterableAsync(x => x % 2 === 0, asyncNumbers()); // true
 *
 * // Error handling
 * try {
 *   await everyIterableAsync(x => {
 *     if (x === 0) throw new Error('Division by zero');
 *     return 10 / x > 1;
 *   }, [5, 2, 0, 1]);
 * } catch (error) {
 *   console.log('Predicate threw an error:', error.message);
 * }
 * ```
 */
export async function everyIterableAsync<const T_element,
  const T_iterable extends MaybeAsyncIterable<T_element>,>(
  testingFn: MappingFunctionPromisable<T_element, boolean>,
  iterable: T_iterable,
): Promise<boolean> {
  // We do have to collect the iterable first because testingFn could take 3 parameters, the 3rd being the array.
  const arr: T_element[] = await Array.fromAsync(iterable,);

  /*
   We invert the approach from noneIterableAsync:
   - Create promises that reject with a sentinel value when predicates return true
   - And resolve with a signal value when predicates return false
   - Using Promise.any to detect first false result
   - Propagate any actual errors from predicates
   */

  const promises: Promise<'result is false' | Error>[] = arr.map(
    function mapper(element, index,): Promise<'result is false' | Error> {
      return (async function inner(): Promise<'result is false' | Error> {
        // Propagate predicate errors
        const result: boolean | Error =
          await (async function throwing(): Promise<boolean | Error> {
            try {
              return await testingFn(element, index, arr,);
            }
            catch (error) {
              // l.warn`${error}`;
              return error as Error;
            }
          })();

        if (result === true)
          throw new Error(`result is true`,);
        else if (result === false)
          return 'result is false'; // Short-circuit when predicate returns false
        else
          return result;
      })();
    },
  );

  const promiseAnyResult: 'result is false' | Error | 'every item passes predicate' =
    await (async function orTrue() {
      try {
        return await Promise.any(promises,);
      }
      catch {
        return 'every item passes predicate';
      }
    })();
  // l.warn`${promiseAnyResult}`;

  if (promiseAnyResult === 'every item passes predicate')
    return true;

  // If any promise resolved with false, short-circuit with false
  if (promiseAnyResult === 'result is false')
    return false;

  throw promiseAnyResult;
}

/**
 * Synchronously tests whether all elements in an iterable satisfy a predicate function.
 * This is a functional programming equivalent of Array.prototype.every() that works with any iterable.
 * Supports testing functions that receive element, index, and/or array parameters for flexibility.
 *
 * The function fails fast when encountering the first false result, immediately returning false.
 * This provides efficient short-circuit evaluation for performance optimization.
 *
 * @param testingFn - Predicate function to test each element, receives (element, index?, array?)
 * @param iterable - Iterable to test elements from
 * @returns True if all elements satisfy the predicate, false if any element fails the test
 * @throws {Error} When testingFn throws errors during execution
 *
 * @example
 * ```ts
 * // Test if all numbers are positive
 * const numbers = [1, 2, 3, 4, 5];
 * const allPositive = everyIterable(x => x > 0, numbers); // true
 *
 * // Using index parameter
 * const items = ['first', 'second', 'third'];
 * const validOrder = everyIterable(
 *   (element, index) => element.includes(['first', 'second', 'third'][index]),
 *   items
 * ); // true
 *
 * // Using all parameters (element, index, array)
 * const scores = [85, 90, 78, 92];
 * const aboveAverage = everyIterable(
 *   (score, index, array) => {
 *     const average = array.reduce((sum, s) => sum + s, 0) / array.length;
 *     return score >= average * 0.8; // At least 80% of average
 *   },
 *   scores
 * ); // true
 *
 * // Works with any iterable
 * const setResult = everyIterable(x => x > 0, new Set([1, 2, 3])); // true
 * const mapResult = everyIterable(
 *   ([key, value]) => key.length > 0 && value > 0,
 *   new Map([['a', 1], ['b', 2]])
 * ); // true
 *
 * // Fail-fast behavior
 * const mixed = [2, 4, 3, 6, 8]; // 3 is odd
 * const allEven = everyIterable(x => {
 *   console.log(`Testing ${x}`); // Only logs until 3
 *   return x % 2 === 0;
 * }, mixed); // false
 *
 * // String iterable
 * const chars = 'HELLO';
 * const allUppercase = everyIterable(char => char === char.toUpperCase(), chars); // true
 *
 * // Error handling
 * try {
 *   everyIterable(x => {
 *     if (x === 0) throw new Error('Division by zero');
 *     return 10 / x > 1;
 *   }, [5, 2, 0, 1]);
 * } catch (error) {
 *   console.log('Predicate threw an error:', error.message);
 * }
 * ```
 */
export function everyIterable<const T_element,
  const T_iterable extends Iterable<T_element>,>(
  testingFn: MappingFunction<T_element, boolean>,
  iterable: T_iterable,
): boolean {
  // We do have to collect the iterable first because testingFn could take 3 parameters, the 3rd being the array.
  const arr: T_element[] = [...iterable,];
  for (const [index, element,] of entriesIterable(arr,)) {
    if (!testingFn(element, index, arr,))
      return false;
  }
  return true;
}
