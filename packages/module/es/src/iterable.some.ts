import type { Promisable, } from 'type-fest';
import type { MaybeAsyncIterable, } from './iterable.basic.ts';
import { somePromises, } from './promises.some.ts';

/**
 * Tests whether at least one element in an iterable satisfies the provided predicate.
 * This is the synchronous equivalent of Array.prototype.some() that works with any iterable.
 * Provides short-circuiting: stops as soon as any element passes the test.
 *
 * @param predicate - Function to test each element
 * @param iterable - Iterable to test elements from
 * @returns True if at least one element satisfies the predicate, false otherwise
 * @throws {Error} When predicate throws errors during execution
 *
 * @example
 * ```ts
 * // Check if any number is greater than 5
 * const numbers = [1, 3, 7, 2];
 * const hasLarge = someIterable(x => x > 5, numbers); // true
 *
 * // With Set
 * const set = new Set([1, 3, 7, 2]);
 * const hasEven = someIterable(x => x % 2 === 0, set); // true
 *
 * // Empty iterable returns false
 * const empty = someIterable(x => true, []); // false
 *
 * // Short-circuits on first true result
 * const shortCircuit = someIterable(
 *   x => { console.log(x); return x > 5; },
 *   [1, 3, 7, 2] // Only logs 1, 3, 7 then stops
 * );
 *
 * // With string iterable
 * const chars = 'hello';
 * const hasVowel = someIterable(char => 'aeiou'.includes(char), chars); // true
 *
 * // Error handling
 * try {
 *   someIterable(x => {
 *     if (x === 0) throw new Error('Division by zero');
 *     return 10 / x > 5;
 *   }, [5, 0, 1]);
 * } catch (error) {
 *   console.log('Predicate threw an error:', error.message);
 * }
 * ```
 */
export function someIterable<const T_element,
  const T_iterable extends Iterable<T_element>,>(
  predicate: (element: T_element,) => boolean,
  iterable: T_iterable,
): boolean {
  for (const element of iterable) {
    if (predicate(element,))
      return true;
  }
  return false;
}

/**
 * Tests whether at least one element in an iterable fails the provided predicate.
 * Returns true if any element doesn't satisfy the predicate, effectively the inverse
 * of someIterable. Useful for validation scenarios where you need to detect failures.
 *
 * @param predicate - Function to test each element
 * @param iterable - Iterable to test elements from
 * @returns True if at least one element fails the predicate, false if all pass
 * @throws {Error} When predicate throws errors during execution
 *
 * @example
 * ```ts
 * // Check if any number fails to be positive
 * const numbers = [1, 3, -1, 2];
 * const hasNegative = someFailIterable(x => x > 0, numbers); // true
 *
 * // Validation: check if any user fails age requirement
 * const users = [
 *   { name: 'Alice', age: 25 },
 *   { name: 'Bob', age: 17 },
 *   { name: 'Charlie', age: 30 }
 * ];
 * const hasMinor = someFailIterable(
 *   user => user.age >= 18,
 *   users
 * ); // true (Bob is under 18)
 *
 * // All elements pass
 * const allValid = someFailIterable(x => x > 0, [1, 2, 3]); // false
 *
 * // Empty iterable returns false (no failures)
 * const noFailures = someFailIterable(x => false, []); // false
 *
 * // Works with any iterable
 * const set = new Set(['a', 'b', 'c']);
 * const hasNonLetter = someFailIterable(x => /^[a-z]$/.test(x), set); // false
 *
 * // Short-circuits on first failure
 * const shortCircuit = someFailIterable(
 *   x => { console.log(x); return x < 10; },
 *   [1, 2, 11, 3] // Only logs 1, 2, 11 then stops
 * );
 * ```
 */
export function someFailIterable<const T_element,
  const T_iterable extends Iterable<T_element>,>(
  predicate: (element: T_element,) => boolean,
  iterable: T_iterable,
): boolean {
  for (const element of iterable) {
    if (!predicate(element,))
      return true;
  }
  return false;
}

/**
 * Tests whether at least one element in an async iterable satisfies the provided predicate.
 * This is the async equivalent of Array.prototype.some(), supporting both sync and async iterables
 * with sync or async predicates. Uses efficient promise handling for optimal performance.
 *
 * @param predicate - Function to test each element, can return Promise<boolean> or boolean
 * @param arrayLike - Iterable or async iterable to test elements from
 * @returns True if at least one element satisfies the predicate, false otherwise
 *
 * @example
 * ```ts
 * // Check if any number is greater than 5
 * const numbers = [1, 3, 7, 2];
 * const hasLarge = await someIterableAsync(x => x > 5, numbers); // true
 *
 * // With async predicate and async iterable
 * async function* asyncNumbers() {
 *   yield 1; yield 3; yield 7; yield 2;
 * }
 * const hasEven = await someIterableAsync(
 *   async x => (x % 2) === 0,
 *   asyncNumbers()
 * ); // true
 *
 * // Empty iterable returns false
 * const empty = await someIterableAsync(x => true, []); // false
 *
 * // Short-circuits on first true result
 * const shortCircuit = await someIterableAsync(
 *   x => { console.log(x); return x > 5; },
 *   [1, 3, 7, 2] // Only logs 1, 3, 7 then stops
 * );
 * ```
 */
export async function someIterableAsync<T_element,>(
  predicate: (element: T_element,) => Promisable<boolean>,
  arrayLike: MaybeAsyncIterable<T_element>,
): Promise<boolean> {
  return await somePromises(predicate, arrayLike,);
}

/**
 * Tests whether at least one element in an async iterable fails the provided predicate.
 * Returns true if any element doesn't satisfy the predicate, effectively the inverse
 * of someIterableAsync. Useful for validation scenarios where you need to detect failures.
 *
 * @param predicate - Function to test each element, can return Promise<boolean> or boolean
 * @param arrayLike - Iterable or async iterable to test elements from
 * @returns True if at least one element fails the predicate, false if all pass
 *
 * @example
 * ```ts
 * // Check if any number fails to be positive
 * const numbers = [1, 3, -1, 2];
 * const hasNegative = await someFailIterableAsync(x => x > 0, numbers); // true
 *
 * // Validation: check if any user fails age requirement
 * const users = [
 *   { name: 'Alice', age: 25 },
 *   { name: 'Bob', age: 17 },
 *   { name: 'Charlie', age: 30 }
 * ];
 * const hasMinor = await someFailIterableAsync(
 *   user => user.age >= 18,
 *   users
 * ); // true (Bob is under 18)
 *
 * // All elements pass
 * const allValid = await someFailIterableAsync(x => x > 0, [1, 2, 3]); // false
 *
 * // Empty iterable returns false (no failures)
 * const noFailures = await someFailIterableAsync(x => false, []); // false
 * ```
 */
export async function someFailIterableAsync<T_element,>(
  predicate: (element: T_element,) => Promisable<boolean>,
  arrayLike: MaybeAsyncIterable<T_element>,
): Promise<boolean> {
  for await (const element of arrayLike) {
    if (!(await predicate(element,)))
      return true;
  }
  return false;
}
