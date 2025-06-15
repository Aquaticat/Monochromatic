/**
 * Performs a shallow equality check on two arrays of arguments.
 *
 * @param args1 - First array of arguments to compare.
 * @param args2 - Second array of arguments to compare.
 * @returns `true` if arrays have the same length and their elements are strictly equal (`===`), `false` otherwise.
 * @internal
 */
export function argsAlmostEqual(
  args1: readonly unknown[],
  args2: readonly unknown[],
): boolean {
  if (args1.length !== args2.length) {
    return false;
  }
  for (let i = 0; i < args1.length; i++) {
    if (args1[i] !== args2[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Creates a memoized version of a function that caches its last result only.
 *
 * @remarks
 * The cache is invalidated if the arguments of subsequent calls aren't shallowly equal to the arguments of the previous call.
 * This uses a strict equality check (`===`) on arguments.
 *
 * - Throws when the inner function throws.
 * - Supports both synchronous and asynchronous functions.
 * - The properties on the original function aren't preserved.
 *
 * @param fn - Function to memoize.
 * @returns Memoized function.
 * @example
 * ```ts
 * let i = 0;
 * const fn = () => ++i;
 * const memoizedFn = memoize(fn);
 *
 * memoizedFn(); // 1
 * memoizedFn(); // 1
 * i = 10;
 * memoizedFn(); // 1, still cached, because args are the same (`[]`)
 *
 * const fnWithArgs = (a: number, b: string) => `${a} ${b} ${++i}`;
 * const memoizedFnWithArgs = memoize(fnWithArgs);
 * memoizedFnWithArgs(1, 'a'); // '1 a 11'
 * memoizedFnWithArgs(1, 'a'); // '1 a 11'
 * memoizedFnWithArgs(2, 'b'); // '2 b 12'
 * memoizedFnWithArgs(2, 'b'); // '2 b 12'
 * ```
 */
export function memoize<const Args extends readonly unknown[], Result,>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  let lastArgs: Args | undefined = undefined;
  let lastResult: Result | undefined = undefined;

  return function memoized(...args: Args): Result {
    if (lastArgs && argsAlmostEqual(args, lastArgs)) {
      return lastResult as Result;
    }

    const currentResult: Result = fn(...args);
    lastArgs = args;
    lastResult = currentResult;
    return currentResult;
  };
}
