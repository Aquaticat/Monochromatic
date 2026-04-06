import type { $ as Int, } from '@_/types/t number/t finite/t int/t/index.ts';
import type { $ as Positive, } from '@_/types/t number/t positive/t/index.ts';
import { $ as named, } from '../p n/index.ts';
/**
 * Generates a sequence of integers from 0 to length - 1.
 *
 * @param length - positive integer count of values to yield
 *
 * @returns generator yielding consecutive non-negative integers
 *
 * @example
 * ```ts
 * [...$(5)]; // [0, 1, 2, 3, 4]
 * ```
 */
export function $(
  length: Int & Positive,
): Generator<Int & (Positive | 0), void, undefined> {
  return named({ length, },);
}
