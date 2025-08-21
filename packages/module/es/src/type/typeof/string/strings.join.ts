import type { MaybeAsyncIterable, } from '../../../iterable.basic.ts';

/**
 * Joins an async iterable of strings using the specified separator string, combining elements into a single string with the separator between each element.
 *
 * This async version handles both synchronous and asynchronous iterables, converting them to arrays before joining.
 * Provides efficient string concatenation for streaming data sources and async generators.
 * Arrays are handled with optimized direct joining without async conversion overhead.
 *
 * @param separator - String to insert between each element during joining
 * @param strings - Async iterable containing strings to join together. Supports arrays, async generators, async iterables, and any MaybeAsyncIterable<string>
 * @returns Single string with all elements joined by separator, or empty string for empty iterables
 *
 * @example
 * Basic async iterable joining:
 * ```ts
 * const words = ['hello', 'world', 'typescript'];
 * const result = await joinStringsAsync(' ', words);
 * console.log(result); // 'hello world typescript'
 * ```
 *
 * @example
 * Joining with custom separator:
 * ```ts
 * const items = ['apple', 'banana', 'cherry'];
 * const csv = await joinStringsAsync(', ', items);
 * console.log(csv); // 'apple, banana, cherry'
 * ```
 *
 * @example
 * Working with async generators:
 * ```ts
 * async function* generateParts() {
 *   yield 'part1';
 *   await new Promise(resolve => setTimeout(resolve, 10));
 *   yield 'part2';
 *   yield 'part3';
 * }
 *
 * const joined = await joinStringsAsync('-', generateParts());
 * console.log(joined); // 'part1-part2-part3'
 * ```
 *
 * @example
 * Building URLs or file paths:
 * ```ts
 * const pathSegments = ['api', 'users', '123', 'profile'];
 * const url = await joinStringsAsync('/', pathSegments);
 * console.log(url); // 'api/users/123/profile'
 * ```
 *
 * @example
 * Empty and single-element cases:
 * ```ts
 * await joinStringsAsync(',', []) // ''
 * await joinStringsAsync(',', ['only']) // 'only'
 * ```
 */
export async function joinStringsAsync(
  separator: string,
  strings: MaybeAsyncIterable<string>,
): Promise<string> {
  if (Array.isArray(strings,))
    return strings.join(separator,);

  const stringsArr: string[] = await Array.fromAsync(strings,);
  return stringsArr.join(separator,);
}

/**
 * Joins a synchronous iterable of strings using the specified separator string, combining elements into a single string with the separator between each element.
 *
 * This synchronous version efficiently handles arrays, strings, Sets, and other synchronous iterables.
 * Arrays are processed with optimal direct joining for maximum performance.
 * Other iterables are converted to arrays before joining to leverage native Array.join() efficiency.
 *
 * @param separator - String to insert between each element during joining
 * @param strings - Synchronous iterable containing strings to join together. Supports arrays, strings, Sets, generators, and any Iterable<string>
 * @returns Single string with all elements joined by separator, or empty string for empty iterables
 *
 * @example
 * Basic array joining:
 * ```ts
 * const words = ['hello', 'world', 'typescript'];
 * const result = joinStrings(' ', words);
 * console.log(result); // 'hello world typescript'
 * ```
 *
 * @example
 * Joining characters from a string:
 * ```ts
 * const result = joinStrings('-', 'hello');
 * console.log(result); // 'h-e-l-l-o'
 * ```
 *
 * @example
 * Working with Sets for unique joining:
 * ```ts
 * const uniqueItems = new Set(['apple', 'banana', 'apple', 'cherry']);
 * const result = joinStrings(', ', uniqueItems);
 * console.log(result); // 'apple, banana, cherry'
 * ```
 *
 * @example
 * Building CSS class lists:
 * ```ts
 * const classes = ['btn', 'btn-primary', 'btn-large'];
 * const classList = joinStrings(' ', classes);
 * console.log(classList); // 'btn btn-primary btn-large'
 * ```
 *
 * @example
 * Using with generators for lazy evaluation:
 * ```ts
 * function* generateNumbers() {
 *   yield '1';
 *   yield '2';
 *   yield '3';
 * }
 *
 * const result = joinStrings(', ', generateNumbers());
 * console.log(result); // '1, 2, 3'
 * ```
 *
 * @example
 * Different separator styles:
 * ```ts
 * const items = ['red', 'green', 'blue'];
 * joinStrings(', ', items) // 'red, green, blue'
 * joinStrings(' | ', items) // 'red | green | blue'
 * joinStrings('', items) // 'redgreenblue'
 * joinStrings('\n', items) // 'red\ngreen\nblue'
 * ```
 */
export function joinStrings(
  separator: string,
  strings: Iterable<string>,
): string {
  if (Array.isArray(strings,))
    return strings.join(separator,);

  const stringsArr: string[] = [...strings,];
  return stringsArr.join(separator,);
}
