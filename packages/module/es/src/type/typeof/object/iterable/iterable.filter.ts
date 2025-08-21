import type { Promisable, } from 'type-fest';
import type { MaybeAsyncIterable, } from './iterable.basic.ts';

/**
 * Asynchronously filters an iterable or async iterable based on a predicate function.
 *
 * Processes elements sequentially, testing each against the predicate and collecting those that pass.
 * Supports both synchronous and asynchronous iterables, as well as sync and async predicates.
 * Memory-efficient processing for large datasets through streaming iteration.
 *
 * @template T_i - Type of elements in the iterable
 * @param predicate - Function that returns promisable boolean indicating whether to keep element
 * @param arrayLike - Iterable or async iterable to filter
 * @returns Array containing elements that satisfy the predicate
 *
 * @example
 * Basic async filtering:
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const evens = await filterIterableAsync(
 *   async (n) => n % 2 === 0,
 *   numbers
 * );
 * console.log(evens); // [2, 4]
 * ```
 *
 * @example
 * Working with async iterables:
 * ```ts
 * async function* generateNumbers() {
 *   for (let i = 1; i <= 10; i++) {
 *     await new Promise(resolve => setTimeout(resolve, 10));
 *     yield i;
 *   }
 * }
 *
 * const largeNumbers = await filterIterableAsync(
 *   async (n) => n > 5,
 *   generateNumbers()
 * );
 * console.log(largeNumbers); // [6, 7, 8, 9, 10]
 * ```
 *
 * @example
 * Async predicate with API calls:
 * ```ts
 * const userIds = ['user1', 'user2', 'user3'];
 * const activeUsers = await filterIterableAsync(
 *   async (userId) => {
 *     const response = await fetch(`/api/users/${userId}`);
 *     const user = await response.json();
 *     return user.isActive;
 *   },
 *   userIds
 * );
 * ```
 */
export async function filterIterableAsync<T_i,>(
  predicate: (i: T_i,) => Promisable<boolean>,
  arrayLike: MaybeAsyncIterable<T_i>,
): Promise<T_i[]> {
  const yes: T_i[] = [];

  for await (const i of arrayLike) {
    if (await predicate(i,))
      yes.push(i,);
  }

  // We can't know the length of yes beforehand,
  // no need to define overloads for plain arrays and trying to return a tuple type.
  return yes;
}

/**
 * Filters a synchronous iterable based on a predicate function.
 *
 * {@inheritDoc filterIterableAsync}
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
 * const evens = filterIterable((n) => n % 2 === 0, numbers);
 * console.log(evens); // [2, 4]
 * ```
 *
 * @example
 * Working with Sets:
 * ```ts
 * const words = new Set(['apple', 'banana', 'cherry', 'date']);
 * const longWords = filterIterable((word) => word.length > 5, words);
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
 * const activeUsers = filterIterable((user) => user.active, users);
 * console.log(activeUsers); // [Alice, Charlie objects]
 * ```
 */
export function filterIterable<T_i,>(
  predicate: (i: T_i,) => boolean,
  arrayLike: Iterable<T_i>,
): T_i[] {
  const yes: T_i[] = [];

  for (const i of arrayLike) {
    if (predicate(i,))
      yes.push(i,);
  }

  return yes;
}

/**
 * Asynchronously filters an iterable yielding elements that satisfy the predicate as they're processed.
 *
 * Generator version of filterIterableAsync that provides streaming results without collecting all elements in memory.
 * Ideal for processing large datasets or infinite streams where memory efficiency is important.
 * Yields elements immediately as they pass the predicate test.
 *
 * @template T_i - Type of elements in the iterable
 * @param predicate - Function that returns promisable boolean indicating whether to keep element
 * @param arrayLike - Iterable or async iterable to filter
 * @returns Async generator yielding elements that satisfy the predicate
 *
 * @example
 * Streaming filter with immediate results:
 * ```ts
 * async function* generateNumbers() {
 *   for (let i = 1; i <= 1000; i++) {
 *     yield i;
 *   }
 * }
 *
 * // Process results as they come
 * for await (const even of filterIterableAsyncGen(
 *   async (n) => n % 2 === 0,
 *   generateNumbers()
 * )) {
 *   console.log(even); // Prints 2, 4, 6, 8... as they're found
 *   if (even > 20) break; // Can stop early
 * }
 * ```
 *
 * @example
 * Memory-efficient processing:
 * ```ts
 * async function* fetchLargeDataset() {
 *   // Simulate fetching large dataset in chunks
 *   for (let page = 1; page <= 100; page++) {
 *     const response = await fetch(`/api/data?page=${page}`);
 *     const items = await response.json();
 *     for (const item of items) yield item;
 *   }
 * }
 *
 * // Filter without loading entire dataset into memory
 * const validItems = filterIterableAsyncGen(
 *   async (item) => item.isValid && item.score > 0.8,
 *   fetchLargeDataset()
 * );
 *
 * for await (const item of validItems) {
 *   await processItem(item); // Process one at a time
 * }
 * ```
 */
export async function* filterIterableAsyncGen<T_i,>(
  predicate: (i: T_i,) => Promisable<boolean>,
  arrayLike: MaybeAsyncIterable<T_i>,
): AsyncGenerator<T_i, void, undefined> {
  for await (const i of arrayLike) {
    if (await predicate(i,))
      yield i;
  }
}

/**
 * Filters a synchronous iterable yielding elements that satisfy the predicate as they're processed.
 *
 * Generator version of filterIterable that provides streaming results without collecting all elements in memory.
 * {@inheritDoc filterIterableAsyncGen}
 *
 * @template T_i - Type of elements in the iterable
 * @param predicate - Function that returns boolean indicating whether to keep element
 * @param arrayLike - Synchronous iterable to filter
 * @returns Generator yielding elements that satisfy the predicate
 *
 * @example
 * Streaming filter for large arrays:
 * ```ts
 * function* generateNumbers(max: number) {
 *   for (let i = 1; i <= max; i++) {
 *     yield i;
 *   }
 * }
 *
 * // Process results lazily
 * for (const even of filterIterableGen(
 *   (n) => n % 2 === 0,
 *   generateNumbers(1000)
 * )) {
 *   console.log(even); // Prints 2, 4, 6, 8...
 *   if (even > 20) break; // Can stop early without processing remaining
 * }
 * ```
 *
 * @example
 * Memory-efficient text processing:
 * ```ts
 * function* readLines(text: string) {
 *   for (const line of text.split('\n')) {
 *     yield line;
 *   }
 * }
 *
 * const nonEmptyLines = filterIterableGen(
 *   (line) => line.trim().length > 0,
 *   readLines(largeTextFile)
 * );
 *
 * // Process only non-empty lines without storing all in memory
 * for (const line of nonEmptyLines) {
 *   processLine(line);
 * }
 * ```
 */
export function* filterIterableGen<T_i,>(
  predicate: (i: T_i,) => boolean,
  arrayLike: Iterable<T_i>,
): Generator<T_i, void, undefined> {
  for (const i of arrayLike) {
    if (predicate(i,))
      yield i;
  }
}

/**
 * Asynchronously filters an iterable yielding elements that fail the predicate test as they're processed.
 *
 * Generator version that yields elements that return false from the predicate function.
 * Useful for collecting rejected items, validation failures, or inverse filtering operations.
 * Provides streaming results for memory-efficient processing of large datasets.
 *
 * @template T_i - Type of elements in the iterable
 * @param predicate - Function that returns promisable boolean (elements returning false will be yielded)
 * @param arrayLike - Iterable or async iterable to filter
 * @returns Async generator yielding elements that don't satisfy the predicate
 *
 * @example
 * Collecting validation failures:
 * ```ts
 * async function* generateUsers() {
 *   yield { id: 1, email: 'valid@example.com', age: 25 };
 *   yield { id: 2, email: 'invalid-email', age: 17 };
 *   yield { id: 3, email: 'another@example.com', age: 30 };
 * }
 *
 * const invalidUsers = filterFailIterableAsyncGen(
 *   async (user) => user.email.includes('@') && user.age >= 18,
 *   generateUsers()
 * );
 *
 * for await (const user of invalidUsers) {
 *   console.log('Invalid user:', user); // Logs user with invalid email or underage
 * }
 * ```
 *
 * @example
 * Processing errors in data stream:
 * ```ts
 * async function* processDataStream() {
 *   const items = await fetchDataBatch();
 *   for (const item of items) yield item;
 * }
 *
 * const failedItems = filterFailIterableAsyncGen(
 *   async (item) => {
 *     try {
 *       await validateItem(item);
 *       return true;
 *     } catch {
 *       return false;
 *     }
 *   },
 *   processDataStream()
 * );
 *
 * // Handle failed items separately
 * for await (const failed of failedItems) {
 *   await logError(failed);
 * }
 * ```
 */
export async function* filterFailIterableAsyncGen<T_i,>(
  predicate: (i: T_i,) => Promisable<boolean>,
  arrayLike: MaybeAsyncIterable<T_i>,
): AsyncGenerator<T_i, void, undefined> {
  for await (const i of arrayLike) {
    if (!(await predicate(i,)))
      yield i;
  }
}

/**
 * Filters a synchronous iterable yielding elements that fail the predicate test as they're processed.
 *
 * Generator version that yields elements that return false from the predicate function.
 * {@inheritDoc filterFailIterableAsyncGen}
 *
 * @template T_i - Type of elements in the iterable
 * @param predicate - Function that returns boolean (elements returning false will be yielded)
 * @param arrayLike - Synchronous iterable to filter
 * @returns Generator yielding elements that don't satisfy the predicate
 *
 * @example
 * Collecting invalid data:
 * ```ts
 * const numbers = [1, 2, 'invalid', 4, null, 6];
 * const invalidNumbers = filterFailIterableGen(
 *   (item) => typeof item === 'number' && item > 0,
 *   numbers
 * );
 *
 * for (const invalid of invalidNumbers) {
 *   console.log('Invalid number:', invalid); // 'invalid', null
 * }
 * ```
 *
 * @example
 * Separating failed validations:
 * ```ts
 * const emails = ['valid@test.com', 'invalid-email', 'another@test.com', 'bad@'];
 * const invalidEmails = filterFailIterableGen(
 *   (email) => email.includes('@') && email.includes('.'),
 *   emails
 * );
 *
 * const failedList = [...invalidEmails];
 * console.log(failedList); // ['invalid-email', 'bad@']
 * ```
 */
export function* filterFailIterableGen<T_i,>(
  predicate: (i: T_i,) => boolean,
  arrayLike: Iterable<T_i>,
): Generator<T_i, void, undefined> {
  for (const i of arrayLike) {
    if (!(predicate(i,)))
      yield i;
  }
}

/**
 * Asynchronously filters an iterable collecting elements that fail the predicate test.
 *
 * Processes all elements and returns an array of those that return false from the predicate function.
 * Useful for collecting rejected items, validation failures, or performing inverse filtering operations.
 * Supports both synchronous and asynchronous iterables and predicates.
 *
 * @template T_i - Type of elements in the iterable
 * @param predicate - Function that returns promisable boolean (elements returning false will be collected)
 * @param arrayLike - Iterable or async iterable to filter
 * @returns Array containing elements that don't satisfy the predicate
 *
 * @example
 * Collecting validation failures:
 * ```ts
 * const users = [
 *   { name: 'Alice', age: 25, email: 'alice@test.com' },
 *   { name: 'Bob', age: 17, email: 'invalid-email' },
 *   { name: 'Charlie', age: 30, email: 'charlie@test.com' }
 * ];
 *
 * const invalidUsers = await filterFailIterableAsync(
 *   async (user) => user.age >= 18 && user.email.includes('@'),
 *   users
 * );
 * console.log(invalidUsers); // [Bob object - underage and invalid email]
 * ```
 *
 * @example
 * Processing API responses:
 * ```ts
 * const urls = ['/api/valid', '/api/broken', '/api/working'];
 * const failedRequests = await filterFailIterableAsync(
 *   async (url) => {
 *     try {
 *       const response = await fetch(url);
 *       return response.ok;
 *     } catch {
 *       return false;
 *     }
 *   },
 *   urls
 * );
 * console.log(failedRequests); // URLs that failed or returned errors
 * ```
 */
export async function filterFailIterableAsync<T_i,>(
  predicate: (i: T_i,) => Promisable<boolean>,
  arrayLike: MaybeAsyncIterable<T_i>,
): Promise<T_i[]> {
  const no: T_i[] = [];

  for await (const i of arrayLike) {
    if (!(await predicate(i,)))
      no.push(i,);
  }

  return no;
}

/**
 * Filters a synchronous iterable collecting elements that fail the predicate test.
 *
 * {@inheritDoc filterFailIterableAsync}
 *
 * @template T_i - Type of elements in the iterable
 * @param predicate - Function that returns boolean (elements returning false will be collected)
 * @param arrayLike - Synchronous iterable to filter
 * @returns Array containing elements that don't satisfy the predicate
 *
 * @example
 * Collecting invalid data:
 * ```ts
 * const mixedData = [1, 'text', 2, null, 3, undefined, 4];
 * const nonNumbers = filterFailIterable(
 *   (item) => typeof item === 'number',
 *   mixedData
 * );
 * console.log(nonNumbers); // ['text', null, undefined]
 * ```
 *
 * @example
 * Validation error collection:
 * ```ts
 * const passwords = ['abc123', 'password', 'StrongP@ss1', '123'];
 * const weakPasswords = filterFailIterable(
 *   (pwd) => pwd.length >= 8 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd),
 *   passwords
 * );
 * console.log(weakPasswords); // ['abc123', 'password', '123']
 * ```
 */
export function filterFailIterable<T_i,>(
  predicate: (i: T_i,) => boolean,
  arrayLike: Iterable<T_i>,
): T_i[] {
  const no: T_i[] = [];

  for (const i of arrayLike) {
    if (!(predicate(i,)))
      no.push(i,);
  }

  return no;
}
