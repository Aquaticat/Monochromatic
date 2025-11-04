/**
 * Partitions an iterable into decisions by yielding each item with its evaluation result.
 *
 * Processes each item through the predicate and yields objects containing:
 * - `decision`: 'pass' if predicate returned true, 'fail' if false, 'thrown' if error occurred
 * - `item`: The original item from the iterable
 *
 * Synchronous-only variant optimized for performance when all operations are synchronous.
 * Use this when both the predicate and iterable are guaranteed to be synchronous.
 *
 * @param params - Configuration object
 * @param params.predicate - Synchronous function to test each item
 * @param params.iterable - Synchronous iterable to partition
 * @yields Objects with decision ('pass', 'fail', or 'thrown') and the item
 *
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const gen = partition({
 *   predicate: n => n % 2 === 0,
 *   iterable: numbers
 * });
 *
 * for (const result of gen) {
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
 * const gen = partition({
 *   predicate: s => {
 *     const num = Number.parseInt(s, 10);
 *     if (Number.isNaN(num)) throw new Error('Invalid');
 *     return num > 1;
 *   },
 *   iterable: items
 * });
 *
 * for (const result of gen) {
 *   console.log(result);
 *   // { decision: 'fail', item: '1' }
 *   // { decision: 'thrown', item: 'invalid' }
 *   // { decision: 'pass', item: '3' }
 * }
 * ```
 *
 * @example
 * ```ts
 * // Collect all pass items
 * const numbers = [1, 2, 3, 4, 5, 6];
 * const passItems = [...partition({
 *   predicate: n => n % 2 === 0,
 *   iterable: numbers
 * })]
 *   .filter(r => r.decision === 'pass')
 *   .map(r => r.item);
 * // passItems: [2, 4, 6]
 * ```
 */
export function* $<T>(params: {
  predicate: (item: T) => boolean;
  iterable: Iterable<T>;
}): Generator<{ decision: 'pass' | 'fail' | 'thrown'; item: T }, void, undefined> {
  const { predicate, iterable } = params;

  for (const item of iterable) {
    try {
      const result = predicate(item);
      if (result) {
        yield { decision: 'pass', item };
      } else {
        yield { decision: 'fail', item };
      }
    } catch {
      yield { decision: 'thrown', item };
    }
  }
}
