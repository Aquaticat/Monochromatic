import type { Promisable, } from 'type-fest';
import {
  ensuringFalsyAsync,
  ensuringTruthyAsync,
  nonThrowingWithFalse,
} from './function.ensuring.ts';
import type { MaybeAsyncIterable, } from './iterable.basic.ts';
import {
  // BooleanNot,
  entriesIterable,
  entriesIterableAsync,
  // mapArrayLikeAsync,
} from './iterable.entries.ts';
import type { MappingFunction, } from './iterable.map.ts';

/**
 * Tests if no elements in an async iterable satisfy a predicate function.
 * This is the async equivalent of Array.prototype.every() with negated logic - returns true only if ALL elements fail the test.
 * Uses Promise.any for efficient short-circuiting: stops as soon as any element passes the test.
 * Handles predicate errors gracefully by treating them as false (element fails the test).
 *
 * @param testingFn - Predicate function to test each element, can return Promise<boolean> or boolean
 * @param arrayLike - Async iterable to test elements from
 * @returns True if no elements satisfy the predicate, false if any element satisfies it
 *
 * @example
 * ```ts
 * // Test that no numbers are negative
 * const numbers = [1, 2, 3, 4, 5];
 * const noNegatives = await noneIterableAsync(x => x < 0, numbers); // true
 *
 * // With async iterable and async predicate
 * async function* asyncNumbers() {
 *   yield 1; yield -2; yield 3;
 * }
 * const hasNegative = await noneIterableAsync(
 *   async x => x < 0,
 *   asyncNumbers()
 * ); // false (because -2 < 0)
 *
 * // Error handling - predicate errors count as false
 * const safeTest = await noneIterableAsync(
 *   x => {
 *     if (x === 0) throw new Error('Division by zero');
 *     return 1 / x > 0.5;
 *   },
 *   [0, 1, 2, 3]
 * ); // true (error on 0 counts as false, others don't satisfy > 0.5)
 *
 * // Validation use case
 * const users = [
 *   { name: 'Alice', age: 25 },
 *   { name: 'Bob', age: 30 },
 *   { name: 'Charlie', age: 35 }
 * ];
 * const noMinors = await noneIterableAsync(
 *   user => user.age < 18,
 *   users
 * ); // true
 *
 * // Short-circuiting behavior
 * const shortCircuit = await noneIterableAsync(
 *   async x => {
 *     console.log(`Testing ${x}`);
 *     return x === 2;
 *   },
 *   [1, 2, 3, 4] // Only logs "Testing 1" and "Testing 2"
 * ); // false
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */
export async function noneIterableAsync<T_element,
  T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  testingFn: MappingFunction<T_element, Promisable<boolean>>,
  arrayLike: T_arrayLike,
): Promise<boolean> {
  const arr: T_element[] = await Array.fromAsync(arrayLike,);

  /*
   We want the modified predicate to throw (causing a rejected promise) as long as it doesn't satisfy.
   Then we feed the array of (rejectingPromise|true)[] into Promise.any.
   When Promise.any resolves, it means that at least one of the predicates returned true,
   which means the whole noneArray test should return false.
   Otherwise, Promise.any rejects, which means all the predicates rejected,
   so the whole noneArray test should return true.
   */
  const ensuredTruthyAsync = ensuringTruthyAsync(testingFn,);
  const results = arr.map(
    function toPromise(element: T_element, index: number,): Promisable<boolean> {
      return ensuredTruthyAsync(element, index, arr,);
    },
  );
  try {
    await Promise.any(results,);
    return false;
  }
  catch {
    return true;
  }
}

/**
 * Tests if no elements in an iterable satisfy a predicate function.
 * This is the synchronous version that returns true only if ALL elements fail the test.
 * Provides short-circuiting: stops as soon as any element passes the test.
 * Handles predicate errors gracefully by treating them as false (element fails the test).
 *
 * @param testingFn - Predicate function to test each element, receives (element, index?, array?)
 * @param arrayLike - Iterable to test elements from
 * @returns True if no elements satisfy the predicate, false if any element satisfies it
 *
 * @example
 * ```ts
 * // Basic usage - test that no numbers are even
 * const numbers = [1, 3, 5, 7];
 * const noEvens = noneIterable(x => x % 2 === 0, numbers); // true
 *
 * // With mixed data - test that no elements are strings
 * const mixed = [1, 2, 3, 4];
 * const noStrings = noneIterable(x => typeof x === 'string', mixed); // true
 *
 * // Using index parameter
 * const items = ['a', 'b', 'c'];
 * const noFirstIndex = noneIterable(
 *   (element, index) => index === 0,
 *   items
 * ); // false (first element has index 0)
 *
 * // Error handling - predicate errors count as false
 * const safeTest = noneIterable(
 *   x => {
 *     if (x === 0) throw new Error('Can't process zero');
 *     return x > 10;
 *   },
 *   [0, 5, 8] // Error on 0 counts as false, others don't satisfy > 10
 * ); // true
 *
 * // Validation use case
 * const passwords = ['abc123', 'password123', 'secure456'];
 * const noWeakPasswords = noneIterable(
 *   pwd => pwd.length < 6,
 *   passwords
 * ); // true (all passwords are 6+ characters)
 *
 * // Works with any iterable
 * const setTest = noneIterable(x => x < 0, new Set([1, 2, 3])); // true
 * const stringTest = noneIterable(char => char === 'z', 'hello'); // true
 *
 * // Short-circuiting behavior
 * const shortCircuit = noneIterable(
 *   x => {
 *     console.log(`Testing ${x}`);
 *     return x === 2;
 *   },
 *   [1, 2, 3, 4] // Only logs "Testing 1" and "Testing 2"
 * ); // false
 * ```
 */
export function noneIterable<T_element, T_arrayLike extends Iterable<T_element>,>(
  testingFn: MappingFunction<T_element, boolean>,
  arrayLike: T_arrayLike,
): boolean {
  const arr: T_element[] = [...arrayLike,];
  const nonThrowingFn = nonThrowingWithFalse(testingFn,);
  for (const [index, element,] of entriesIterable(arr,)) {
    if (nonThrowingFn(element, index, arr,))
      return false;
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
