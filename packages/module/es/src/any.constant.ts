/**
 * Creates a function that always returns the same value, regardless of any arguments passed to it.
 * The constant function is a fundamental functional programming combinator that creates
 * a closure over a value, useful for providing default values or placeholder functions.
 *
 * Commonly used in functional programming scenarios where a consistent value is needed,
 * such as default parameters, mapping operations, or as a placeholder function.
 *
 * @param x - Value to be returned by the constant function
 * @returns Function that always returns the captured value
 *
 * @example
 * ```ts
 * const alwaysFive = constant(5);
 * alwaysFive(); // 5
 * alwaysFive(1, 2, 3); // 5 (ignores arguments)
 *
 * const alwaysHello = constant('hello');
 * alwaysHello(); // 'hello'
 *
 * // Common usage in functional programming
 * const numbers = [1, 2, 3];
 * numbers.map(constant(0)); // [0, 0, 0] (replace all with 0)
 *
 * // Useful for default functions
 * const defaultHandler = constant('default');
 * defaultHandler(); // 'default'
 * ```
 */
export function constant<const T,>(x: T,): () => T {
  return function identity(): T {
    return x;
  };
}
