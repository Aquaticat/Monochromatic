/**
 * Transforms a function to accept its arguments as an array instead of individual parameters.
 * This function creates a wrapper that spreads an array of arguments when calling the original function.
 * Useful for scenarios where you have arguments collected in an array but need to call a function
 * that expects individual parameters.
 *
 * @param fn - Function to transform
 * @returns New function that accepts arguments as an array and spreads them to the original function
 *
 * @example
 * ```ts
 * function add(a: number, b: number, c: number): number {
 *   return a + b + c;
 * }
 *
 * const spreadAdd = spreadArguments(add);
 * spreadAdd([1, 2, 3]); // 6 (equivalent to add(1, 2, 3))
 *
 * // Useful with array methods
 * const numbers = [
 *   [1, 2, 3],
 *   [4, 5, 6],
 *   [7, 8, 9]
 * ];
 * const results = numbers.map(spreadAdd); // [6, 15, 24]
 *
 * // Works with built-in functions too
 * const spreadMax = spreadArguments(Math.max);
 * spreadMax([10, 5, 8, 3]); // 10
 * ```
 */
export function spreadArguments<const Fn extends (...args: any) => any,>(
  fn: Fn,
): (argumentsArray: Parameters<Fn>,) => ReturnType<Fn> {
  return function spreadFn(argumentsArray: Parameters<Fn>,): ReturnType<Fn> {
    return fn(...argumentsArray,);
  };
}

/**
 * Transforms a function that expects an array to accept individual arguments instead.
 * This function creates a wrapper that gathers individual arguments into an array
 * before calling the original function. Useful for creating variadic versions of
 * functions that normally operate on arrays.
 *
 * @param fn - Function that expects an array as its parameter
 * @returns New function that accepts individual arguments and gathers them into an array
 *
 * @example
 * ```ts
 * function sumArray(numbers: number[]): number {
 *   return numbers.reduce((sum, num) => sum + num, 0);
 * }
 *
 * const sum = gatherArguments(sumArray);
 * sum(1, 2, 3, 4, 5); // 15 (equivalent to sumArray([1, 2, 3, 4, 5]))
 *
 * // Create variadic versions of array functions
 * function maxFromArray(numbers: number[]): number {
 *   return Math.max(...numbers);
 * }
 *
 * const max = gatherArguments(maxFromArray);
 * max(10, 5, 8, 3); // 10
 *
 * // Useful for functional composition
 * function joinWithComma(strings: string[]): string {
 *   return strings.join(', ');
 * }
 *
 * const joinStrings = gatherArguments(joinWithComma);
 * joinStrings('apple', 'banana', 'cherry'); // 'apple, banana, cherry'
 * ```
 */
export function gatherArguments<const Fn extends (arg: any[],) => any,>(
  fn: Fn,
): (...argumentsArray: Parameters<Fn>[0]) => ReturnType<Fn> {
  return function gatheredFn(...argumentsArray: Parameters<Fn>[0]): ReturnType<Fn> {
    return fn(argumentsArray,);
  };
}
