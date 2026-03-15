/**
 * Wraps a function to accept only its first argument.
 *
 * Useful to prevent unexpected behavior from extra arguments passed by iterators.
 *
 * @param fn - Function to wrap
 *
 * @returns Unary version that ignores all but first argument
 *
 * @example
 * ```ts
 * const nums = ['1', '2', '3'].map($(parseInt,),); // [1, 2, 3]
 * // Without unary: ['1', '2', '3'].map(parseInt) // [1, NaN, NaN]
 * ```
 */
export function $<const Fn extends (arg: Parameters<Fn>[0],) => ReturnType<Fn>,>(
  fn: Fn,
): (arg: Parameters<Fn>[0],) => ReturnType<Fn> {
  return function unary(arg: Parameters<Fn>[0],): ReturnType<Fn> {
    return fn(arg,);
  };
}
