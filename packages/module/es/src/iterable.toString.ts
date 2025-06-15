import type { MaybeAsyncIterable } from "./iterable.type.maybe.ts";

/**
 * Converts an iterable of strings into a formatted string representation using Intl.ListFormat.
 * Uses narrow style formatting with unit type, which produces compact output without separators.
 *
 * @param iterable - String iterable to format
 * @returns Formatted string representation of the iterable elements
 * @example
 * ```ts
 * const items = ['apple', 'banana', 'cherry'];
 * const result = toStringIterable(items); // "applebananacherry"
 *
 * const set = new Set(['red', 'green', 'blue']);
 * const colors = toStringIterable(set); // "redgreenblue"
 * ```
 */
export function toStringIterable(iterable: Iterable<string>): string {
  const formatter = new Intl.ListFormat(undefined, { style: 'narrow', type: 'unit' });

  return formatter.format(iterable);
}

/**
 * Converts a maybe-async iterable of strings into a formatted string representation using Intl.ListFormat.
 * Uses narrow style formatting with unit type, which produces compact output without separators.
 * Handles both synchronous and asynchronous iterables.
 *
 * @param iterable - String iterable (sync or async) to format
 * @returns Formatted string representation of the iterable elements
 * @example
 * ```ts
 * // With synchronous iterable
 * const items = ['apple', 'banana', 'cherry'];
 * const result = await toStringIterableAsync(items); // "applebananacherry"
 *
 * // With asynchronous iterable
 * async function* asyncStrings() {
 *   yield 'hello';
 *   yield 'world';
 * }
 * const greeting = await toStringIterableAsync(asyncStrings()); // "helloworld"
 * ```
 */
export async function toStringIterableAsync(iterable: MaybeAsyncIterable<string>): Promise<string> {
  const formatter = new Intl.ListFormat(undefined, { style: 'narrow', type: 'unit' });

  return formatter.format(await Array.fromAsync(iterable));
}
