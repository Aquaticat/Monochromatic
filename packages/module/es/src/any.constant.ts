/* v8 ignore file -- @preserve */

import type { Logged, } from './logged.basic.ts';
import { getDefaultLogger, } from './string.log';

/**
 * Creates function that returns same value regardless of arguments.
 * Useful for default values, placeholder functions, and mapping operations.
 *
 * @param x - Value for function to return
 * @param l - Optional logger
 * @returns Function returning captured value
 *
 * @example
 * ```ts
 * const alwaysFive = constant(5);
 * alwaysFive(); // 5
 * alwaysFive(1, 2, 3); // 5
 *
 * const alwaysHello = constant('hello');
 * alwaysHello(); // 'hello'
 *
 * // Mapping with constant
 * const numbers = [1, 2, 3];
 * numbers.map(constant(0)); // [0, 0, 0]
 *
 * // Default handler pattern
 * const defaultHandler = constant('default');
 * defaultHandler(); // 'default'
 * ```
 */
export function constant<const T,>(
  x: T,
  { l = getDefaultLogger(), }: Partial<Logged> = {},
): () => T {
  l.trace('constant');
  return function constantValue(): T {
    return x;
  };
}
