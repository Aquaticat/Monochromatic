import { $ as named, } from '../p n/index.ts';

/**
 * Concatenates an array of strings using a specified separator (positional params variant).
 *
 * @param strings - array of strings to join
 *
 * @param concatWith - separator string
 *
 * @returns single string with elements separated by the given separator
 *
 * @example
 * ```ts
 * $(['a', 'b', 'c'], ', '); // 'a, b, c'
 * ```
 */
export function $({
  strings,
  concatWith,
}: {
  strings: string[];
  concatWith: string;
},): string {
  return named({
    strings,
    concatWith,
  },);
}
