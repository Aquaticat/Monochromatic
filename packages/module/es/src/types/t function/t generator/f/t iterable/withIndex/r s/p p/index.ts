import type { $ as Int, } from '@_/types/t number/t finite/t int/t/index.ts';
import type { $ as Positive, } from '@_/types/t number/t positive/t/index.ts';
import { $ as named, } from '../p n/index.ts';

/**
 * Yields each element from a sync iterable along with its zero-based index.
 *
 * @param myIterable - sync iterable to index
 *
 * @returns sync generator yielding objects containing the element and its integer index
 *
 * @example
 * ```ts
 * for (const { element, index } of $(['x', 'y'])) {
 *   console.log(index, element); // 0 'x', 1 'y'
 * }
 * ```
 */
export function $<const T,>(
  myIterable: Iterable<T>,
): Generator<{
  element: T;
  index: Int & (Positive | 0);
}> {
  return named({ myIterable, },);
}
