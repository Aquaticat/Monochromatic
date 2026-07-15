/**
 * Concatenates an array of strings using a specified separator.
 *
 * @param strings - array of strings to join
 *
 * @param concatWith - separator string to place between elements
 *
 * @returns single string with elements separated by the given separator
 *
 * @example
 * ```ts
 * $({ strings: ['a', 'b', 'c'], concatWith: '-' }); // 'a-b-c'
 * ```
 */
export function $(
  {
    strings,
    concatWith,
  }: {
    strings: string[];
    concatWith: string;
  },
): string {
  return strings.join(concatWith,);
}
