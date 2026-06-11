import type { $ as Int, } from '@_/types/t number/t finite/t int/t/index.ts';
import type { $ as Positive, } from '@_/types/t number/t positive/t/index.ts';
import type { $ as MaybeAsyncIterable, } from '@_/types/t object/t iterable/t/index.ts';
import { $ as named, } from '../p n/index.ts';

/**
 * Yields each element from an iterable along with its zero-based index.
 *
 * @param myIterable - iterable or async iterable to index
 *
 * @returns async generator yielding objects containing the element and its integer index
 *
 * @example
 * ```ts
 * for await (const { element, index } of $(['a', 'b'])) {
 *   console.log(index, element); // 0 'a', 1 'b'
 * }
 * ```
 */
export function $<const T,>(
  myIterable: MaybeAsyncIterable<T>,
): AsyncGenerator<{
  element: T;
  index: Int & (Positive | 0);
}> {
  return named({ myIterable, },);
}
