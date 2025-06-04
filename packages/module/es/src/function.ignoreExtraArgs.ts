//region ignoreExtraArgs -- Creates a function that ignores extraneous arguments

/**
 * Wraps a function to create a new function that accepts more arguments than the original.
 * The wrapper calls the original function with only the number of arguments it formally declares.
 * Any additional arguments provided to the wrapper are ignored.
 *
 * This is useful for adapting functions to contexts where they might receive more arguments
 * than they handle, such as in some event listener patterns or callback scenarios (e.g., with `Array.prototype.map`).
 *
 * @template F - Type of the function to wrap. Must be a function type.
 * @param fn - Original function to wrap.
 * @returns New function that takes potentially more arguments than `fn` but calls `fn`
 * with its expected arguments, ignoring any extras. The returned function will require
 * at least as many arguments as `fn` itself.
 *
 * @example
 * ```ts
 * function sum(a: number, b: number): number {
 *   return a + b;
 * }
 *
 * const lenientSum = ignoreExtraArgs(sum);
 *
 * lenientSum(1, 2); // => 3 (calls sum(1, 2))
 * lenientSum(1, 2, 3, 4); // => 3 (calls sum(1, 2), ignores 3 and 4)
 * // lenientSum(1) would be a TypeScript error, as `sum` requires two arguments.
 *
 * // Example with parseInt, which expects 1 or 2 arguments (string, radix).
 * // Number.parseInt.length is 2.
 * const strictParseInt = (s: string) => Number.parseInt(s, 10); // strictParseInt.length is 1
 * const lenientParseInt = ignoreExtraArgs(strictParseInt);
 *
 * const strings = ['10', '20', '30'];
 * // Using lenientParseInt with map, which passes (element, index, array)
 * const numbers = strings.map(lenientParseInt); // => [10, 20, 30]
 * // lenientParseInt('10', 0, strings) calls strictParseInt('10'), ignoring index and array.
 * ```
 */
export function ignoreExtraArgs<const F extends (...args: any[]) => any,>(
  fn: F,
): (...allArgs: [...Parameters<F>, ...any[]]) => ReturnType<F> {
  const expectedArgCount = fn.length;

  return function(...allArgs: [...Parameters<F>, ...any[]]): ReturnType<F> {
    // The type `[...Parameters<F>, ...any[]]` ensures `allArgs` is an array-like tuple.
    // We cast to `any[]` for `slice` compatibility if needed, though tuples have slice.
    const argsForFn = (allArgs as any[]).slice(0, expectedArgCount) as Parameters<F>;
    return fn(...argsForFn);
  };
}

//endregion ignoreExtraArgs
