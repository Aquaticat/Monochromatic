/**
 * Creates a thunked version of a function that preserves its signature and behavior.
 *
 * This utility wraps a function in a named wrapper function called 'thunked', maintaining
 * the exact same signature and return type as the original function. The wrapper provides
 * a consistent execution context and can be useful for debugging, function identification,
 * or creating named function references from anonymous functions.
 *
 * @param fn - Function to wrap with thunk behavior
 * @returns Wrapped function with identical signature that delegates to original function
 *
 * @example
 * Basic function wrapping:
 * ```ts
 * const add = (a: number, b: number) => a + b;
 * const thunkedAdd = thunk(add);
 * console.log(thunkedAdd(2, 3)); // 5
 * ```
 *
 * @example
 * Creating named function references:
 * ```ts
 * const calculate = thunk((x: number) => x * 2 + 1);
 * console.log(calculate.name); // 'thunked'
 * console.log(calculate(5)); // 11
 * ```
 *
 * @example
 * Wrapping async functions:
 * ```ts
 * const fetchData = async (id: string) => `data-${id}`;
 * const thunkedFetch = thunk(fetchData);
 * await thunkedFetch('123'); // 'data-123'
 * ```
 */
export const thunk = <Args extends unknown[], T,>(
  fn: (...args: Args) => T,
): (...args: Args) => T => {
  return function thunked(...args: Args): T {
    return fn(...args,);
  };
};
