import type { $, } from '../../../../t iterable/t/index.ts';

/**
 * Converts a sync or async iterable to an array, passing through arrays unchanged.
 *
 * @param iterable - iterable to convert
 *
 * @returns array of elements from the iterable
 *
 * @example
 * ```ts
 * $(new Set([1, 2, 3])); // [1, 2, 3]
 * $([4, 5]); // [4, 5] (passed through)
 * ```
 */
export function $<const MyIterable extends $,>(
  iterable: MyIterable,
): MyIterable extends $<infer T> ? T[] : never {
  if (Array.isArray(iterable,)) {
    // oxlint-disable-next-line typescript/no-explicit-any, typescript/no-unsafe-type-assertion, typescript/no-unsafe-return -- generic conditional return type requires cast
    return iterable as any;
  }
  // oxlint-disable-next-line typescript/no-explicit-any, typescript/no-unsafe-type-assertion, typescript/no-unsafe-return -- generic conditional return type requires cast
  return Array.fromAsync(iterable,) as any;
}
