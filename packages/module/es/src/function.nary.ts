import type { MinusOne } from './numeric.type.int.ts';

// TODO: Write type tests.
export type CanTakeRequiredArgsOrNever<T_fn extends (args: any[]) => any,
  N extends number,> = N extends 0 ? T_fn
    : Parameters<T_fn>[MinusOne<N>] extends infer ArgType
      ? ArgType extends never ? never : T_fn
    : never;

/**
 * Transforms a function to accept exactly one parameter, ignoring any additional arguments.
 * Creates a unary function wrapper that only passes the first argument to the original function.
 * Useful for adapting functions with multiple parameters to contexts that provide only one argument.
 *
 * @param fn - Function to transform into unary form
 * @returns New function that accepts only one parameter and ignores additional arguments
 * @example
 * ```ts
 * const add = (a: number, b: number) => a + b;
 * const unaryAdd = unary(add);
 *
 * // Only first argument is used, second is ignored
 * const result = unaryAdd(5, 10); // Returns NaN (5 + undefined)
 * const singleResult = unaryAdd(5); // Returns NaN (5 + undefined)
 * ```
 * @example
 * ```ts
 * // Useful with array methods that pass multiple arguments
 * const numbers = ['1', '2', '3'];
 * const parseIntUnary = unary(parseInt);
 * const parsed = numbers.map(parseIntUnary); // [1, 2, 3]
 * // Without unary: numbers.map(parseInt) would pass index as radix
 * ```
 */
export function unary<
  const T extends (...args: any[]) => any,
>(
  fn: CanTakeRequiredArgsOrNever<T, 1>,
): (param1: Parameters<T>[0]) => ReturnType<T> {
  return function unaryfied(param1): ReturnType<T> {
    return fn(param1);
  };
}

/**
 * Transforms a function to accept exactly two parameters, ignoring any additional arguments.
 * Creates a binary function wrapper that only passes the first two arguments to the original function.
 * Useful for adapting functions with multiple parameters to contexts that provide exactly two arguments.
 *
 * @param fn - Function to transform into binary form
 * @returns New function that accepts only two parameters and ignores additional arguments
 * @example
 * ```ts
 * const sum = (a: number, b: number, c: number) => a + b + c;
 * const binarySum = binary(sum);
 *
 * // Only first two arguments are used, third is ignored
 * const result = binarySum(1, 2, 3); // Returns NaN (1 + 2 + undefined)
 * const twoArgs = binarySum(1, 2); // Returns NaN (1 + 2 + undefined)
 * ```
 * @example
 * ```ts
 * // Useful for callback functions that receive extra arguments
 * const multiply = (x: number, y: number, extra?: any) => x * y;
 * const binaryMultiply = binary(multiply);
 *
 * // Safe to use in contexts that pass additional arguments
 * const pairs = [[1, 2], [3, 4], [5, 6]];
 * const results = pairs.map(([a, b]) => binaryMultiply(a, b, 'ignored'));
 * ```
 */
export function binary<
  const T extends (...args: any[]) => any,
>(
  fn: CanTakeRequiredArgsOrNever<T, 2>,
): (param1: Parameters<T>[0], param2: Parameters<T>[1]) => ReturnType<T> {
  return function binaryfied(param1, param2): ReturnType<T> {
    return fn(param1, param2);
  };
}

/**
 * Transforms a function to accept exactly three parameters, ignoring any additional arguments.
 * Creates a ternary function wrapper that only passes the first three arguments to the original function.
 * Useful for adapting functions with multiple parameters to contexts that provide exactly three arguments.
 *
 * @param fn - Function to transform into ternary form
 * @returns New function that accepts only three parameters and ignores additional arguments
 * @example
 * ```ts
 * const calculate = (a: number, b: number, c: number, d: number) => a + b + c + d;
 * const ternaryCalculate = ternary(calculate);
 *
 * // Only first three arguments are used, fourth is ignored
 * const result = ternaryCalculate(1, 2, 3, 4); // Returns NaN (1 + 2 + 3 + undefined)
 * const threeArgs = ternaryCalculate(1, 2, 3); // Returns NaN (1 + 2 + 3 + undefined)
 * ```
 * @example
 * ```ts
 * // Useful for array reduce callbacks that receive extra arguments
 * const combineThree = (acc: string, curr: string, sep: string, extra?: any) =>
 *   acc + sep + curr;
 * const ternaryCombine = ternary(combineThree);
 *
 * // Safe to use with array methods that pass additional arguments
 * const words = ['hello', 'world', 'test'];
 * const combined = words.reduce((acc, curr, index) =>
 *   ternaryCombine(acc, curr, '-', index), '');
 * ```
 */
 export function ternary<
  const T extends (...args: any[]) => any,
>(
  fn: CanTakeRequiredArgsOrNever<T, 3>,
): (param1: Parameters<T>[0], param2: Parameters<T>[1],
  param3: Parameters<T>[2]) => ReturnType<T>
{
  return function ternaryfied(param1, param2, param3): ReturnType<T> {
    return fn(param1, param2, param3);
  };
}
