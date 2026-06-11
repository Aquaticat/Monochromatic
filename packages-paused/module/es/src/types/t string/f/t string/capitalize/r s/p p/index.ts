/**
 * Capitalizes the first character of a string.
 *
 * @param str - String to capitalize
 *
 * @returns String with first character uppercased
 *
 * @example
 * ```ts
 * $('hello'); // 'Hello'
 * $(''); // ''
 * $('world'); // 'World'
 * ```
 */
export function $(str: string,): string {
  if (str.length
    === 0)
    return str;
  return str.charAt(0,)
    .toUpperCase()
    + str
    .slice(1,);
}
