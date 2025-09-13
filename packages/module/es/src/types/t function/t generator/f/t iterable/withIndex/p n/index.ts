import type { $ as Int, } from '@_/types/t number/t finite/t int/t/index.ts';
import type { $ as Positive, } from '@_/types/t number/t positive/t/index.ts';
import type {$ as MaybeAsyncIterable} from '@_/types/t object/t iterable/t/index.ts';

/**
 * Creates a generator that yields each element of an iterable paired with its index.
 * This function transforms any iterable into a sequence of objects containing both
 * the element and its zero-based position in the original collection.
 *
 * Useful for iteration patterns where both element values and their positions are needed,
 * such as processing arrays while tracking indices, or creating indexed views of data.
 *
 * @param myIterable - The iterable to be enumerated with indices
 * @returns Generator yielding objects with `element` and `index` properties
 *
 * @example
 * ```ts
 * // Basic usage with array
 * const gen = iterableWithIndex(['a', 'b', 'c']);
 * for (const item of gen) {
 *   console.log(`${item.index}: ${item.element}`);
 * }
 * // Output: 0: a, 1: b, 2: c
 * ```
 *
 * @example
 * ```ts
 * // Working with strings
 * const chars = iterableWithIndex('hello');
 * const result = [...chars];
 * console.log(result);
 * // Output: [{ element: 'h', index: 0 }, { element: 'e', index: 1 }, ...]
 * ```
 *
 * @example
 * ```ts
 * // Processing while tracking positions
 * const numbers = [10, 20, 30, 40];
 * const positions = iterableWithIndex(numbers);
 *
 * for (const item of positions) {
 *   if (item.index % 2 === 0) {
 *     console.log(`Even index ${item.index}: ${item.element}`);
 *   }
 * }
 * // Output: Even index 0: 10, Even index 2: 30
 * ```
 */
export async function* $<const T,>(
  { myIterable, }: { myIterable: MaybeAsyncIterable<T>; },
): AsyncGenerator<{ element: T; index: Int & (Positive | 0); }> {
  let index = 0;
  for await (const element of myIterable) {
    yield {
      element,
      index: index as Int & (Positive | 0),
    };
    index++;
  }
}
