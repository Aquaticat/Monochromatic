/* v8 ignore file -- @preserve */

import type { Logged, } from '../../logged.basic.ts';
import { getDefaultLogger, } from '../../string.log.ts';

/**
 * Creates an infinite generator that repeatedly yields the same value.
 * This generator function creates an endless sequence of the provided value,
 * useful for scenarios requiring constant values in iterative contexts.
 *
 * @param x - Value to be yielded infinitely
 * @returns Generator that yields the same value infinitely
 *
 * @example
 * ```ts
 * const ones = echo(1);
 * const first5 = Array.from(iterable.take(ones, 5)); // [1, 1, 1, 1, 1]
 *
 * const greetings = echo('hello');
 * greetings.next().value; // 'hello'
 * greetings.next().value; // 'hello'
 *
 * // Use with iterative operations
 * for (const value of iterable.take(echo(42), 3)) {
 *   console.log(value); // 42, 42, 42
 * }
 * ```
 */
export function* anyEcho<const T,>(
  { x, l = getDefaultLogger(), }: { x: T; } & Partial<Logged>,
): Generator<T> {
  l.trace('echo',);
  while (true)
    yield x;
}
