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
export function $<const T_elements extends any[],>(
  ...elements: T_elements
): T_elements {
  return elements;
}

export * as gen from './gen/index.ts';
