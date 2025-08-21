import type { Box, } from '../basic.ts';
import type { GetableSync, } from './getable.basic.ts';
import type { Logged, } from './logged.basic.ts';
import { getDefaultLogger, } from './string.log.ts';

/**
 * Converts a Box to a Getable that always returns the boxed value regardless of key.
 *
 * @typeParam K - Type of keys (ignored in implementation)
 * @typeParam V - Type of value contained in the box
 * @param box - The Box to convert
 * @param l - Optional logger for tracing the operation
 * @returns A Getable that returns the boxed value for any key
 *
 * @example
 * ```ts
 * const numberBox: Box<number> = { value: 42 };
 * const getable: Getable<string, number> = boxToGetable({ box: numberBox });
 * const value = await getable.get({ key: 'any-key' }); // 42
 * ```
 */
export function boxToGetableSync<const K = unknown, const V = unknown,>(
  { box, l = getDefaultLogger(), }: { box: Box<V>; } & Partial<Logged>,
): GetableSync<K, V> {
  l.trace('boxToGetable',);
  return {
    ...box,
    get: function fromBox(
      { key: _key, l = getDefaultLogger(), }: { key: K; } & Partial<Logged>,
    ) {
      l.trace(`fromBox get`,);
      return box.value;
    },
  };
}

// Box operations are inherently synchronous since they just return a stored value,
// so there's no need for an async version. The Getable interface extends GetableSync and adds async capabilities,
// but for Box values, the synchronous implementation is sufficient.
