import type { Promisable, } from 'type-fest';
import type { BooleanNot, } from './boolean.not.ts';
import {
  entriesIterable,
  entriesIterableAsync,
} from './iterable.entries.ts';
import { mapIterableAsync, } from './iterable.map.ts';
import type { MaybeAsyncIterable, } from './iterable.type.maybe.ts';

/**
 * Tests if no elements in an async iterable fail a predicate function.
 * This is the inverse of `noneIterableAsync` - returns true only if ALL elements pass the test.
 * Unlike `everyIterableAsync`, this function continues testing all elements even after finding failures,
 * making it useful for validation scenarios where you need to process all items.
 *
 * @param testingFn - Predicate function to test each element, can return Promise<boolean> or boolean
 * @param arrayLike - Async iterable to test elements from
 * @returns True if no elements fail the predicate (all pass), false if any element fails
 *
 * @example
 * ```ts
 * // Validation: ensure all users have valid email addresses
 * const users = [
 *   { name: 'Alice', email: 'alice@example.com' },
 *   { name: 'Bob', email: 'bob@example.com' },
 *   { name: 'Charlie', email: 'charlie@example.com' }
 * ];
 * const allValidEmails = await noneFailIterableAsync(
 *   async user => user.email.includes('@'),
 *   users
 * ); // true (no users fail the email validation)
 *
 * // With async iterable and async validation
 * async function* asyncUsers() {
 *   yield { name: 'Alice', age: 25 };
 *   yield { name: 'Bob', age: 17 }; // Minor
 *   yield { name: 'Charlie', age: 30 };
 * }
 * const allAdults = await noneFailIterableAsync(
 *   async user => user.age >= 18,
 *   asyncUsers()
 * ); // false (Bob fails the age check)
 *
 * // Data processing: ensure all numbers are positive
 * const numbers = [1, 2, 3, 4, 5];
 * const allPositive = await noneFailIterableAsync(
 *   x => x > 0,
 *   numbers
 * ); // true
 *
 * // Complex validation with error handling
 * const items = ['valid', 'data', 'test'];
 * const allProcessable = await noneFailIterableAsync(
 *   async item => {
 *     try {
 *       // Simulate async processing
 *       await new Promise(resolve => setTimeout(resolve, 10));
 *       return item.length > 0;
 *     } catch {
 *       return false; // Failed processing counts as failure
 *     }
 *   },
 *   items
 * ); // true
 *
 * // Continues processing all elements unlike everyIterableAsync
 * let processedCount = 0;
 * const result = await noneFailIterableAsync(
 *   async x => {
 *     processedCount++;
 *     return x !== 2; // 2 will fail
 *   },
 *   [1, 2, 3, 4] // Processes all 4 elements
 * ); // false, but processedCount === 4
 * ```
 */
export async function noneFailIterableAsync<T_element,
  T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  testingFn: (element: T_element, index?: number,
    arrayLike?: T_arrayLike,) => Promisable<boolean>,
  arrayLike: T_arrayLike,
): Promise<boolean> {
  let result = true;
  for await (
    const [index, element,] of entriesIterableAsync(
      arrayLike as AsyncIterable<T_element>,
    )
  ) {
    if (!await testingFn(element, index, arrayLike,))
      result = false;
  }
  return result;
}

/**
 * Tests if no elements in an iterable fail a predicate function.
 * This is the synchronous inverse of `noneIterable` - returns true only if ALL elements pass the test.
 * Unlike `everyIterable`, this function continues testing all elements even after finding failures,
 * making it useful for validation scenarios where you need to process all items.
 *
 * @param testingFn - Predicate function to test each element, receives (element, index?, array?)
 * @param arrayLike - Iterable to test elements from
 * @returns True if no elements fail the predicate (all pass), false if any element fails
 *
 * @example
 * ```ts
 * // Basic validation - ensure all numbers are within range
 * const numbers = [1, 5, 8, 3, 9];
 * const allInRange = noneFailIterable(x => x >= 1 && x <= 10, numbers); // true
 *
 * // String validation - ensure all strings are non-empty
 * const strings = ['hello', 'world', 'test'];
 * const allNonEmpty = noneFailIterable(s => s.length > 0, strings); // true
 *
 * // Using index parameter for position-based validation
 * const items = ['first', 'second', 'third'];
 * const validPositions = noneFailIterable(
 *   (item, index) => index !== undefined && index < 5,
 *   items
 * ); // true (all indices are < 5)
 *
 * // Mixed data type validation
 * const mixed = [1, 'hello', true, 42];
 * const allTruthy = noneFailIterable(x => Boolean(x), mixed); // true
 *
 * // Validation with failure case
 * const ages = [25, 30, 15, 40]; // 15 is under 18
 * const allAdults = noneFailIterable(age => age >= 18, ages); // false
 *
 * // Works with any iterable type
 * const setValidation = noneFailIterable(x => x > 0, new Set([1, 2, 3])); // true
 * const stringValidation = noneFailIterable(char => char !== 'x', 'hello'); // true
 * const mapValidation = noneFailIterable(
 *   ([key, value]) => key.length > 0,
 *   new Map([['a', 1], ['b', 2]])
 * ); // true
 *
 * // Continues processing all elements unlike everyIterable
 * let processedCount = 0;
 * const result = noneFailIterable(
 *   x => {
 *     processedCount++;
 *     return x !== 3; // 3 will fail
 *   },
 *   [1, 2, 3, 4, 5] // Processes all 5 elements
 * ); // false, but processedCount === 5
 *
 * // Complex object validation
 * const products = [
 *   { name: 'Laptop', price: 999, inStock: true },
 *   { name: 'Mouse', price: 25, inStock: true },
 *   { name: 'Keyboard', price: 75, inStock: false }
 * ];
 * const allAvailable = noneFailIterable(
 *   product => product.inStock && product.price > 0,
 *   products
 * ); // false (keyboard isn't in stock)
 * ```
 */
export function noneFailIterable<T_element, T_arrayLike extends Iterable<T_element>,>(
  testingFn: (element: T_element, index?: number, arrayLike?: T_arrayLike,) => boolean,
  arrayLike: T_arrayLike,
): boolean {
  let result = true;
  for (const [index, element,] of entriesIterable(arrayLike,)) {
    if (!testingFn(element, index, arrayLike,))
      result = false;
  }
  return result;
}
