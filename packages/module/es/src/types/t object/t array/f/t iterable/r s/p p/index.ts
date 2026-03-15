import type { $, } from '../../../../../t iterable/t/r s/index.ts';

/**
 * Converts a sync iterable to an array, passing through arrays unchanged.
 *
 * @param iterable - sync iterable to convert
 *
 * @returns array of elements from the iterable
 */
export function $<const MyIterable extends $,>(
  iterable: MyIterable,
): MyIterable extends $<infer T> ? T[] : never {
  if (Array.isArray(iterable,))
    return iterable as any;
  return [...iterable,] as any;
}
