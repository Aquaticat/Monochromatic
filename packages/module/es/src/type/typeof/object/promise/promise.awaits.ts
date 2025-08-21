/**
 * Recursively awaits any value, unwrapping nested Promises to their final resolved type.
 *
 * This utility function provides explicit Promise unwrapping with TypeScript's built-in `Awaited<T>` type.
 * Handles deeply nested Promise chains and thenable objects uniformly.
 * Essential for generic async programming where the input type might be Promise, thenable, or plain value.
 * The `await` is intentionally redundant to ensure proper Promise resolution in all contexts.
 *
 * @template T_input - Input type that may be Promise, thenable, or plain value
 * @param input - Value to await, which can be any type including nested Promises
 * @returns Recursively unwrapped value from Promise chains
 *
 * @example
 * Basic Promise unwrapping:
 * ```ts
 * const promise = Promise.resolve(42);
 * const result = await awaits(promise);
 * console.log(result); // 42 (number, not Promise<number>)
 * ```
 *
 * @example
 * Deeply nested Promise resolution:
 * ```ts
 * const nested = Promise.resolve(Promise.resolve(Promise.resolve("hello")));
 * const result = await awaits(nested);
 * console.log(result); // "hello" (string, fully unwrapped)
 * ```
 *
 * @example
 * Non-Promise values pass through unchanged:
 * ```ts
 * const value = 42;
 * const result = await awaits(value);
 * console.log(result); // 42 (same value, but awaited)
 * ```
 *
 * @example
 * Working with unknown async values:
 * ```ts
 * async function processUnknownAsync<T>(input: T | Promise<T>): Promise<T> {
 *   return await awaits(input); // Handles both sync and async cases
 * }
 *
 * const syncResult = await processUnknownAsync(100);
 * const asyncResult = await processUnknownAsync(Promise.resolve(200));
 * ```
 *
 * @example
 * Generic function composition:
 * ```ts
 * async function pipeline<T, U, V>(
 *   input: T,
 *   step1: (x: T) => U | Promise<U>,
 *   step2: (x: U) => V | Promise<V>
 * ): Promise<V> {
 *   const result1 = await awaits(step1(input));
 *   const result2 = await awaits(step2(result1));
 *   return result2;
 * }
 * ```
 *
 * @example
 * Type-safe API response handling:
 * ```ts
 * async function fetchUserData<T>(
 *   fetcher: () => T | Promise<T>
 * ): Promise<Awaited<T>> {
 *   const response = await awaits(fetcher());
 *   return response; // Type is properly unwrapped
 * }
 *
 * // Works with both sync and async fetchers
 * const syncData = await fetchUserData(() => ({ id: 1, name: "Alice" }));
 * const asyncData = await fetchUserData(() => fetch('/api/user').then(r => r.json()));
 * ```
 */
export async function awaits<T_input,>(
  input: T_input,
): Promise<Awaited<T_input>> {
  // noinspection ES6RedundantAwait
  return await input;
}
