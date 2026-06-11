/**
 * Concatenates an array of strings without a separator.
 *
 * @param strings - array of strings to join
 *
 * @returns single concatenated string
 *
 * @example
 * ```ts
 * $(['foo', 'bar', 'baz']); // 'foobarbaz'
 * ```
 */
export function $(strings: string[],): string {
  return strings.join('',);
}
