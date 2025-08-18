import type { Logged, } from './logged.basic.ts';

/**
 * Converts an array or iterable to an array.
 * If the input is already an array, it is returned as-is.
 * If the input is an iterable, it is converted to an array using Array.from().
 *
 * @param iterable - The array or iterable to convert
 * @returns The input as an array
 *
 * @example
 * ```ts
 * const arr = [1, 2, 3];
 * const result = arrayFromBasic(arr);
 * // result is [1, 2, 3] and is the same reference as arr
 *
 * const set = new Set([1, 2, 3]);
 * const result2 = arrayFromBasic(set);
 * // result2 is [1, 2, 3]
 *
 * const map = new Map([['a', 1], ['b', 2]]);
 * const result3 = arrayFromBasic(map);
 * // result3 is [['a', 1], ['b', 2]]
 * ```
 */
export function arrayFromBasic<const MyIterable extends unknown[],>(
  { iterable, l, }: { iterable: MyIterable; } & Partial<Logged>,
): MyIterable;
export function arrayFromBasic<const MyIterable extends Iterable<unknown>,>(
  iterable: MyIterable,
): MyIterable extends Iterable<infer T> ? T[] : unknown[];
export function arrayFromBasic<const MyIterable extends Iterable<unknown>,>(
  iterable: MyIterable,
): unknown[] {
  if (Array.isArray(iterable,)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- had to
    return iterable as any;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- had to
  return Array.from(iterable,) as any;
}
