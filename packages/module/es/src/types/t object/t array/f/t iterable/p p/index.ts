import type { $, } from '../../../../t iterable/t/index.ts';

/**
 * Converts a sync or async iterable to an array, passing through arrays unchanged.
 *
 * @param iterable - iterable to convert
 *
 * @returns array of elements from the iterable
 */
export function $<const MyIterable extends $,>(
  iterable: MyIterable,
): MyIterable extends $<infer T> ? T[] : never {
  if (Array.isArray(iterable,))
    return iterable as any;
  return Array.fromAsync(iterable,) as any;
}
