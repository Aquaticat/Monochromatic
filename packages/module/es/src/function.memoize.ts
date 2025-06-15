export function argsAlmostEqual(
  args1: unknown[],
  args2: unknown[],
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
 * @remarks
 * Memoizes a function to cache its last result only.
 *
 * Throws when the inner function throws.
 *
 * Supports both synchronous and asynchronous functions.
 * Supports no matter how many arguments the function has.
 * Properties on the function aren't preserved.
 * If the function returns undefined, this memoization function wouldn't memoize correctly.
 *
 * Function arguments are serialized by JSON.stringify() and compared.
 * This way of comparing function arguments is fast but inaccurate.
 */
export function memoize<Args extends any[], Result,>(
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
