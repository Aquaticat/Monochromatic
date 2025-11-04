import { $ as partitionNamed } from '../p n/index.ts';

/**
 * Partitions an iterable into decisions by yielding each item with its evaluation result.
 *
 * Processes each item through the predicate and yields objects containing:
 * - `decision`: 'pass' if predicate returned true, 'fail' if false, 'thrown' if error occurred
 * - `item`: The original item from the iterable
 *
 * Handles both synchronous and asynchronous predicates and iterables.
 * Items are evaluated in order, with the predicate awaited for each item.
 *
 * @param predicate - Function to test each item, can return boolean or Promise<boolean>
 * @param iterable - Iterable or AsyncIterable to partition
 * @yields Objects with decision ('pass', 'fail', or 'thrown') and the item
 *
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const gen = partition(n => n % 2 === 0, numbers);
 *
 * for await (const result of gen) {
 *   console.log(result);
 *   // { decision: 'fail', item: 1 }
 *   // { decision: 'pass', item: 2 }
 *   // { decision: 'fail', item: 3 }
 *   // { decision: 'pass', item: 4 }
 *   // { decision: 'fail', item: 5 }
 * }
 * ```
 *
 * @example
 * ```ts
 * const items = ['1', 'invalid', '3'];
 * const gen = partition(
 *   s => {
 *     const num = Number.parseInt(s, 10);
 *     if (Number.isNaN(num)) throw new Error('Invalid');
 *     return num > 1;
 *   },
 *   items
 * );
 *
 * for await (const result of gen) {
 *   console.log(result);
 *   // { decision: 'fail', item: '1' }
 *   // { decision: 'thrown', item: 'invalid' }
 *   // { decision: 'pass', item: '3' }
 * }
 * ```
 */
export async function* $<T>(
  predicate: (item: T) => boolean | Promise<boolean>,
  iterable: Iterable<T> | AsyncIterable<T>,
): AsyncGenerator<
  { decision: 'pass' | 'fail' | 'thrown'; item: T },
  void,
  undefined
> {
  yield* partitionNamed({ predicate, iterable });
}
