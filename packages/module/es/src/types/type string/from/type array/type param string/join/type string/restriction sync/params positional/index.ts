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
 * const result = $(' ', words);
 * console.log(result); // 'hello world typescript'
 * ```
 *
 * @example
 * Joining characters from a string:
 * ```ts
 * const result = $('-', 'hello');
 * console.log(result); // 'h-e-l-l-o'
 * ```
 *
 * @example
 * Working with Sets for unique joining:
 * ```ts
 * const uniqueItems = new Set(['apple', 'banana', 'apple', 'cherry']);
 * const result = $(', ', uniqueItems);
 * console.log(result); // 'apple, banana, cherry'
 * ```
 *
 * @example
 * Building CSS class lists:
 * ```ts
 * const classes = ['btn', 'btn-primary', 'btn-large'];
 * const classList = $(' ', classes);
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
 * const result = $(', ', generateNumbers());
 * console.log(result); // '1, 2, 3'
 * ```
 *
 * @example
 * Different separator styles:
 * ```ts
 * const items = ['red', 'green', 'blue'];
 * $(', ', items) // 'red, green, blue'
 * $(' | ', items) // 'red | green | blue'
 * $('', items) // 'redgreenblue'
 * $('\n', items) // 'red\ngreen\nblue'
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function $(
  separator: string,
  strings: Iterable<string>,
): string {
  if (Array.isArray(strings,))
    return strings.join(separator,);

  const stringsArr: string[] = [...strings,];
  return stringsArr.join(separator,);
}