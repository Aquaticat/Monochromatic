import type { MaybeAsyncIterable } from './iterable.type.maybe.ts';

/**
 * Creates index-value pairs from an async iterable, similar to Array.prototype.entries().
 * Each element is paired with its zero-based index position in the sequence.
 * Provides lazy evaluation for memory-efficient processing of async sequences.
 *
 * @param arrayLike - Async iterable sequence to enumerate with indices
 * @returns AsyncGenerator yielding [index, element] tuples for each element
 *
 * @remarks
 * **Async processing**: Handles async iterables, promises, and async generators seamlessly.
 * **Memory efficiency**: Processes async sequences without loading entire dataset into memory.
 * **Type preservation**: Maintains element types from the original async iterable.
 * **Index tracking**: Provides zero-based indexing similar to Array.prototype.entries().
 * **Lazy evaluation**: Elements are processed one at a time as needed.
 *
 * Based on https://stackoverflow.com/a/10179849 with CC BY-SA 4.0 written by Ry-
 *
 * @example
 * ```ts
 * // Basic async iterable enumeration
 * async function* asyncNumbers() {
 *   for (let i = 10; i <= 13; i++) {
 *     yield i;
 *   }
 * }
 *
 * const entries = entriesIterableAsync(asyncNumbers());
 * for await (const [index, value] of entries) {
 *   console.log(`[${index}]: ${value}`);
 * }
 * // Output: [0]: 10, [1]: 11, [2]: 12, [3]: 13
 *
 * // Working with async generators from APIs
 * async function* fetchUserData() {
 *   const users = ['alice', 'bob', 'charlie'];
 *   for (const user of users) {
 *     const response = await fetch(`/api/users/${user}`);
 *     yield await response.json();
 *   }
 * }
 *
 * const userEntries = entriesIterableAsync(fetchUserData());
 * for await (const [index, userData] of userEntries) {
 *   console.log(`User ${index + 1}:`, userData.name);
 * }
 *
 * // Processing streams with index tracking
 * async function* streamProcessor(stream: ReadableStream) {
 *   const reader = stream.getReader();
 *   try {
 *     while (true) {
 *       const { done, value } = await reader.read();
 *       if (done) break;
 *       yield value;
 *     }
 *   } finally {
 *     reader.releaseLock();
 *   }
 * }
 *
 * const streamEntries = entriesIterableAsync(streamProcessor(someStream));
 * for await (const [index, chunk] of streamEntries) {
 *   console.log(`Chunk ${index}: ${chunk.length} bytes`);
 * }
 *
 * // Mixed sync/async iterables
 * const mixedData = [Promise.resolve('a'), 'b', Promise.resolve('c')];
 * const mixedEntries = entriesIterableAsync(mixedData);
 * for await (const [index, value] of mixedEntries) {
 *   console.log(`[${index}]: ${value}`); // [0]: a, [1]: b, [2]: c
 * }
 *
 * // Working with async Set-like structures
 * const asyncSet = new Set([
 *   Promise.resolve('first'),
 *   Promise.resolve('second'),
 *   Promise.resolve('third')
 * ]);
 *
 * const setEntries = entriesIterableAsync(asyncSet);
 * for await (const [index, value] of setEntries) {
 *   console.log(`Item ${index}: ${value}`);
 * }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export async function* entriesIterableAsync<
  T_arrayLike extends MaybeAsyncIterable<any>,
  const T_element extends T_arrayLike extends Iterable<infer T_element> ? T_element
    : never,
>(
  arrayLike: T_arrayLike,
): AsyncGenerator<[number, T_element]> {
  let i = 0;

  for await (const arrayLikeElement of arrayLike as AsyncIterable<T_element>) {
    yield [i, arrayLikeElement];
    i++;
  }
}

/**
 * Creates index-value pairs from a sync iterable, similar to Array.prototype.entries().
 * Each element is paired with its zero-based index position in the sequence.
 * Provides lazy evaluation for memory-efficient processing of iterable sequences.
 *
 * @param arrayLike - Iterable sequence to enumerate with indices
 * @returns Generator yielding [index, element] tuples for each element
 *
 * @remarks
 * **Sync processing**: Handles sync iterables including arrays, sets, maps, strings, and generators.
 * **Memory efficiency**: Processes sequences without loading entire dataset into memory.
 * **Type preservation**: Maintains element types from the original iterable.
 * **Index tracking**: Provides zero-based indexing similar to Array.prototype.entries().
 * **Lazy evaluation**: Elements are processed one at a time as needed.
 *
 * @example
 * ```ts
 * // Basic array enumeration
 * const numbers = [10, 20, 30];
 * const entries = entriesIterable(numbers);
 * for (const [index, value] of entries) {
 *   console.log(`[${index}]: ${value}`);
 * }
 * // Output: [0]: 10, [1]: 20, [2]: 30
 *
 * // Working with Sets
 * const uniqueItems = new Set(['apple', 'banana', 'cherry']);
 * const setEntries = entriesIterable(uniqueItems);
 * for (const [index, item] of setEntries) {
 *   console.log(`Item ${index + 1}: ${item}`);
 * }
 * // Output: Item 1: apple, Item 2: banana, Item 3: cherry
 *
 * // Working with Maps
 * const userRoles = new Map([
 *   ['alice', 'admin'],
 *   ['bob', 'user'],
 *   ['charlie', 'moderator']
 * ]);
 *
 * const mapEntries = entriesIterable(userRoles);
 * for (const [index, [username, role]] of mapEntries) {
 *   console.log(`User ${index}: ${username} (${role})`);
 * }
 * // Output: User 0: alice (admin), User 1: bob (user), User 2: charlie (moderator)
 *
 * // Working with strings
 * const text = "hello";
 * const charEntries = entriesIterable(text);
 * for (const [index, char] of charEntries) {
 *   console.log(`Character ${index}: '${char}'`);
 * }
 * // Output: Character 0: 'h', Character 1: 'e', Character 2: 'l', Character 3: 'l', Character 4: 'o'
 *
 * // Working with generators
 * function* fibonacci() {
 *   let a = 0, b = 1;
 *   while (a < 100) {
 *     yield a;
 *     [a, b] = [b, a + b];
 *   }
 * }
 *
 * const fibEntries = entriesIterable(fibonacci());
 * for (const [index, value] of fibEntries) {
 *   console.log(`Fibonacci[${index}]: ${value}`);
 * }
 * // Output: Fibonacci[0]: 0, Fibonacci[1]: 1, Fibonacci[2]: 1, Fibonacci[3]: 2, etc.
 *
 * // Collecting entries into array
 * const colors = ['red', 'green', 'blue'];
 * const colorEntries = Array.from(entriesIterable(colors));
 * console.log(colorEntries); // [[0, 'red'], [1, 'green'], [2, 'blue']]
 *
 * // Using with destructuring
 * const items = ['first', 'second', 'third'];
 * const [[firstIndex, firstItem], [secondIndex, secondItem]] = entriesIterable(items);
 * console.log(`${firstIndex}: ${firstItem}, ${secondIndex}: ${secondItem}`); // 0: first, 1: second
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function* entriesIterable<
  const T_arrayLike extends Iterable<any>,
  const T_element extends T_arrayLike extends Iterable<infer T_element> ? T_element
    : never,
>(
  arrayLike: T_arrayLike,
): Generator<[number, T_element]> {
  let i = 0;

  for (const arrayLikeElement of arrayLike) {
    yield [i, arrayLikeElement];
    i++;
  }
}
