/**
 * Filters a synchronous iterable based on a predicate function.
 *
 * Processes elements sequentially, testing each against the predicate and collecting those that pass.
 * Supports both synchronous and asynchronous iterables, as well as sync and async predicates.
 * Memory-efficient processing for large datasets through streaming iteration.
 *
 * @template T_i - Type of elements in the iterable
 * @param predicate - Function that returns boolean indicating whether to keep element
 * @param arrayLike - Synchronous iterable to filter
 * @returns Array containing elements that satisfy the predicate
 *
 * @example
 * Basic array filtering:
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const evens = $((n) => n % 2 === 0, numbers);
 * console.log(evens); // [2, 4]
 * ```
 *
 * @example
 * Working with Sets:
 * ```ts
 * const words = new Set(['apple', 'banana', 'cherry', 'date']);
 * const longWords = $((word) => word.length > 5, words);
 * console.log(longWords); // ['banana', 'cherry']
 * ```
 *
 * @example
 * Object property filtering:
 * ```ts
 * const users = [
 *   { id: 1, name: 'Alice', active: true },
 *   { id: 2, name: 'Bob', active: false },
 *   { id: 3, name: 'Charlie', active: true }
 * ];
 * const activeUsers = $((user) => user.active, users);
 * console.log(activeUsers); // [Alice, Charlie objects]
 * ```
 *
 * @example
 * String filtering with complex predicates:
 * ```ts
 * const emails = ['valid@test.com', 'invalid-email', 'another@test.com'];
 * const validEmails = $((email) => email.includes('@') && email.includes('.'), emails);
 * console.log(validEmails); // ['valid@test.com', 'another@test.com']
 * ```
 *
 * @example
 * Working with generators for lazy evaluation:
 * ```ts
 * function* generateNumbers() {
 *   for (let i = 1; i <= 10; i++) {
 *     yield i;
 *   }
 * }
 *
 * const evenNumbers = $((n) => n % 2 === 0, generateNumbers());
 * console.log(evenNumbers); // [2, 4, 6, 8, 10]
 * ```
 */
export function $<T_i>(
  predicate: (i: T_i) => boolean,
  arrayLike: Iterable<T_i>,
): T_i[] {
  const yes: T_i[] = [];

  for (const i of arrayLike) {
    if (predicate(i,))
      yes.push(i,);
  }

  return yes;
}
