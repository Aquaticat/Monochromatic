/**
 * Tests if a value is an Iterable but not an AsyncIterable.
 * This function specifically checks for synchronous iterables by looking for the Symbol.iterator method.
 *
 * @param value - Value to check for Iterable interface
 * @returns True if value implements Iterable<any>, false otherwise
 *
 * @example
 * ```ts
 * // Arrays are iterable
 * $([1, 2, 3]); // true
 * $('hello'); // true
 * $(new Set([1, 2])); // true
 * $(new Map([['a', 1]])); // true
 *
 * // Non-iterables
 * $(42); // false
 * $({}); // false
 * $(null); // false
 *
 * // Generator functions return iterables
 * function* gen() { yield 1; }
 * $(gen()); // true
 *
 * // Works with custom iterables
 * const customIterable = {
 *   *[Symbol.iterator]() {
 *     yield 1; yield 2; yield 3;
 *   }
 * };
 * $(customIterable); // true
 *
 * // Cross-context compatibility
 * const iframe = document.createElement('iframe');
 * document.body.appendChild(iframe);
 * const iframeArray = new iframe.contentWindow.Array(1, 2, 3);
 * $(iframeArray); // true
 * ```
 */
export function $<const MyValue,>(
  value: MyValue,
): value is MyValue extends Iterable<infer T> ? MyValue & Iterable<T> : never {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Might be Iterable
  return typeof (value as any)?.[Symbol.iterator] === 'function';
}
