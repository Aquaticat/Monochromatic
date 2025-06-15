import type { Promisable } from 'type-fest';
import {
  entriesIterable,
  entriesIterableAsync,
} from './iterable.entries.ts';
import type { MaybeAsyncIterable } from './iterable.type.maybe.ts';

/**
 * Asynchronously tests whether all elements in an async iterable fail a predicate function.
 * This is the inverse of everyIterableAsync - it returns true when ALL elements fail the test
 * (predicate returns false for all elements), and false when ANY element passes the test.
 *
 * The function fails fast when encountering the first passing result, immediately returning false.
 * This provides efficient short-circuit evaluation for performance optimization.
 *
 * @param testingFn - Predicate function to test each element, can return Promise<boolean> or boolean
 * @param arrayLike - Async iterable to test elements from
 * @returns True if all elements fail the predicate (all return false), false if any element passes
 * @throws {Error} When testingFn throws errors during execution
 *
 * @example
 * ```ts
 * // Test if all numbers aren't positive (all are zero or negative)
 * const numbers = [-1, -2, 0, -4];
 * const allNonPositive = await everyFailIterableAsync(x => x > 0, numbers); // true
 *
 * // With mixed values - fails fast when finding a positive number
 * const mixed = [-1, -2, 3, -4]; // 3 is positive
 * const allNegative = await everyFailIterableAsync(x => x > 0, mixed); // false
 *
 * // With async predicate function
 * const users = [{ id: 1, active: false }, { id: 2, active: false }];
 * const allInactive = await everyFailIterableAsync(
 *   async user => {
 *     // Simulate API call
 *     await new Promise(resolve => setTimeout(resolve, 10));
 *     return user.active;
 *   },
 *   users
 * ); // true (all users are inactive, so predicate fails for all)
 *
 * // Using index and array parameters
 * const items = ['', '', ''];
 * const allEmpty = await everyFailIterableAsync(
 *   async (element, index, array) => {
 *     return element.length > 0 && index < array.length;
 *   },
 *   items
 * ); // true (all strings are empty, so predicate fails for all)
 *
 * // With async iterable
 * async function* asyncNumbers() {
 *   yield -2; yield -4; yield -6;
 * }
 * const allNegativeAsync = await everyFailIterableAsync(x => x > 0, asyncNumbers()); // true
 *
 * // Validation use case - ensure no invalid items
 * const emails = ['invalid', 'also-invalid', 'not-email'];
 * const noValidEmails = await everyFailIterableAsync(
 *   async email => email.includes('@') && email.includes('.'),
 *   emails
 * ); // true (no valid emails found)
 *
 * // Error handling
 * try {
 *   await everyFailIterableAsync(x => {
 *     if (x === 0) throw new Error('Division by zero');
 *     return 10 / x > 1;
 *   }, [-5, -2, 0, -1]);
 * } catch (error) {
 *   console.log('Predicate threw an error:', error.message);
 * }
 * ```
 */
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

/**
 * Synchronously tests whether all elements in an iterable fail a predicate function.
 * This is the inverse of everyIterable - it returns true when ALL elements fail the test
 * (predicate returns false for all elements), and false when ANY element passes the test.
 *
 * The function fails fast when encountering the first passing result, immediately returning false.
 * This provides efficient short-circuit evaluation for performance optimization.
 *
 * @param testingFn - Predicate function to test each element, receives (element, index?, arrayLike?)
 * @param arrayLike - Iterable to test elements from
 * @returns True if all elements fail the predicate (all return false), false if any element passes
 * @throws {Error} When testingFn throws errors during execution
 *
 * @example
 * ```ts
 * // Test if all numbers aren't positive (all are zero or negative)
 * const numbers = [-1, -2, 0, -4];
 * const allNonPositive = everyFailIterable(x => x > 0, numbers); // true
 *
 * // With mixed values - fails fast when finding a positive number
 * const mixed = [-1, -2, 3, -4]; // 3 is positive
 * const allNegative = everyFailIterable(x => x > 0, mixed); // false
 *
 * // Using index parameter
 * const items = ['', '', ''];
 * const allEmpty = everyFailIterable(
 *   (element, index) => element.length > index, // All fail: empty strings can't be longer than their index
 *   items
 * ); // true
 *
 * // Using all parameters (element, index, arrayLike)
 * const scores = [45, 30, 25, 40]; // All below 50
 * const allBelowThreshold = everyFailIterable(
 *   (score, index, array) => {
 *     const threshold = 50;
 *     return score >= threshold; // Test if score meets threshold
 *   },
 *   scores
 * ); // true (all scores fail to meet threshold)
 *
 * // Works with any iterable
 * const setResult = everyFailIterable(x => x > 0, new Set([-1, -2, -3])); // true
 * const mapResult = everyFailIterable(
 *   ([key, value]) => key.length === 0 || value <= 0,
 *   new Map([['a', 1], ['b', 2]]) // All entries have non-empty keys and positive values
 * ); // true (predicate fails for all entries)
 *
 * // Fail-fast behavior demonstration
 * const mixed2 = [-2, -4, 3, -6, -8]; // 3 is positive
 * const allNegative2 = everyFailIterable(x => {
 *   console.log(`Testing ${x}`); // Only logs until 3
 *   return x > 0;
 * }, mixed2); // false
 *
 * // String iterable
 * const chars = 'hello';
 * const allUppercase = everyFailIterable(char => char === char.toUpperCase(), chars); // true
 *
 * // Validation use case - ensure no valid items
 * const invalidEmails = ['invalid', 'also-invalid', 'not-email'];
 * const noValidEmails = everyFailIterable(
 *   email => email.includes('@') && email.includes('.'),
 *   invalidEmails
 * ); // true (no valid emails found)
 *
 * // Error handling
 * try {
 *   everyFailIterable(x => {
 *     if (x === 0) throw new Error('Division by zero');
 *     return 10 / x > 1;
 *   }, [-5, -2, 0, -1]);
 * } catch (error) {
 *   console.log('Predicate threw an error:', error.message);
 * }
 * ```
 */
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
