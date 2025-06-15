/**
 * Creates an array from the provided elements with exact type preservation.
 * This function is similar to the built-in Array.of() but provides better type inference
 * and accepts mixed types while preserving the exact tuple type of the input elements.
 * Particularly useful when you need to maintain strict type fidelity for heterogeneous arrays.
 *
 * @param elements - Elements used to create the array
 * @returns Array containing all provided elements with preserved tuple type
 *
 * @remarks
 * Compared to built-in Array.of's definition in TypeScript, actually accepts mixed types.
 *
 * @example
 * ```ts
 * // Basic usage with mixed types
 * const mixed = arrayOf(1, 'hello', true, null);
 * // Type: [1, 'hello', true, null]
 *
 * // Preserves exact literal types
 * const literals = arrayOf('foo', 'bar', 42);
 * // Type: ['foo', 'bar', 42] (not string | number[])
 *
 * // Works with objects and complex types
 * const objects = arrayOf(
 *   { type: 'user', id: 1 },
 *   { type: 'admin', permissions: ['read', 'write'] }
 * );
 * // Type: [{ type: 'user', id: 1 }, { type: 'admin', permissions: ['read', 'write'] }]
 *
 * // Compare with Array.of (loses type precision)
 * const builtIn = Array.of(1, 'hello', true); // Type: (string | number | boolean)[]
 * const precise = arrayOf(1, 'hello', true);  // Type: [1, 'hello', true]
 * ```
 */
export function arrayOf<const T_elements extends any[],>(
  ...elements: T_elements
): T_elements {
  return elements;
}

/**
 * Creates a generator that yields each provided element in sequence.
 * This function transforms a list of arguments into a generator that yields
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
export function* genOf<const T_elements extends any[],>(
  ...elements: T_elements
): Generator<T_elements[number]> {
  for (const element of elements) {
    yield element;
  }
}
