/**
 * Creates a generator that yields each provided element in sequence.
 * This function transforms an array into a generator that yields
 * each element one at a time. Useful for creating iterables from discrete values
 * or when you need lazy evaluation of a known set of elements.
 *
 * @param elements - Elements to be yielded by the generator
 * @returns Generator that yields each provided element in order
 *
 * @example
 * ```ts
 * // Basic usage with mixed types
 * const gen = genOf(1, 'hello', true, null);
 * for (const value of gen) {
 *   console.log(value); // 1, then 'hello', then true, then null
 * }
 *
 * // Convert to array
 * const numbers = genOf(10, 20, 30);
 * const array = [...numbers]; // [10, 20, 30]
 *
 * // Use with iterable utilities
 * const chars = genOf('a', 'b', 'c', 'd');
 * const taken = iterable.take(chars, 2); // Takes first 2: ['a', 'b']
 *
 * // Lazy evaluation - generator doesn't execute until consumed
 * const lazy = genOf(
 *   getValue1(), // These functions only called when generator is consumed
 *   getValue2(),
 *   getValue3()
 * );
 *
 * // Works with complex types
 * const configs = genOf(
 *   { env: 'dev', port: 3000 },
 *   { env: 'staging', port: 4000 },
 *   { env: 'prod', port: 8080 }
 * );
 * for (const config of configs) {
 *   console.log(`${config.env}: ${config.port}`);
 * }
 * ```
 */
export function* $<const T_elements extends unknown[],>(
  elements: T_elements
): Generator<T_elements[number]> {
  for (const element of elements)
    yield element;
}
