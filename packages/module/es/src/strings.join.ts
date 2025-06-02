import type { MaybeAsyncIterable } from './iterable.type.maybe.ts';

/**
 * Joins an iterable of strings using the specified separator.
 *
 * @example
 * ```ts
 * joinStrings('-', ['a', 'b', 'c']) // returns 'a-b-c'
 * joinStrings('', 'hello') // returns 'hello'
 * ```
 *
 * @param separator - The string to use between each element
 * @param strings - An iterable of strings. Supports arrays, strings, Sets, and custom iterables.
 *                 Async iterables are supported by joinStringsAsync version.
 *
 * @remarks
 * For empty iterables, returns empty string.
 * Converts async iterables to array via Array.fromAsync internally before joining.
 * Array inputs are joined directly without iteration for performance.
 */
export async function joinStringsAsync(
  separator: string,
  strings: MaybeAsyncIterable<string>,
): Promise<string> {
  if (Array.isArray(strings)) {
    return strings.join(separator);
  }

  const stringsArr: string[] = await Array.fromAsync(strings);
  return stringsArr.join(separator);
}

/**
 * {@inheritDoc joinStringsAsync}
 */
export function joinStrings(
  separator: string,
  strings: Iterable<string>,
): string {
  if (Array.isArray(strings)) {
    return strings.join(separator);
  }

  const stringsArr: string[] = [...strings];
  return stringsArr.join(separator);
}
