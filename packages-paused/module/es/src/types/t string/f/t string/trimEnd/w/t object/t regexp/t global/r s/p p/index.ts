import type { $ as Global, } from '@_/types/t object/t regexp/t global/t/index.ts';
import { $ as named, } from '../p n/index.ts';

/**
 * Trims matching patterns from the end of a string (positional params variant).
 *
 * @param str - string to trim
 *
 * @param trimmer - global regex pattern to remove from the end
 *
 * @returns trimmed string
 *
 * @example
 * ```ts
 * $('hello...', /\./g); // 'hello'
 * ```
 */
export function $({
  str,
  trimmer,
}: {
  str: string;
  trimmer: Global;
},): string {
  return named({
    str,
    trimmer,
  },);
}
