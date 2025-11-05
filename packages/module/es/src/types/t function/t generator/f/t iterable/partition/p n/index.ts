/**
 * Partitions an iterable into decisions by yielding each item with its evaluation result.
 *
 * Processes each item through the predicate and yields objects containing:
 * - `decision`: 'pass' if predicate returned true, 'fail' if false, or a tuple ['thrown', error] if error occurred
 * - `item`: The original item from the iterable
 *
 * Handles both synchronous and asynchronous predicates and iterables.
 * Items are evaluated in order, with the predicate awaited for each item.
 *
 * @param params - Configuration object
 * @param params.predicate - Function to test each item, can return boolean or Promise<boolean>
 * @param params.iterable - Iterable or AsyncIterable to partition
 * @yields Objects with decision ('pass', 'fail', or ['thrown', error]) and the item
 *
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const gen = partition({
 *   predicate: n => n % 2 === 0,
 *   iterable: numbers
 * });
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
 * const gen = partition({
 *   predicate: s => {
 *     const num = Number.parseInt(s, 10);
 *     if (Number.isNaN(num)) throw new Error('Invalid');
 *     return num > 1;
 *   },
 *   iterable: items
 * });
 *
 * for await (const result of gen) {
 *   console.log(result);
 *   // { decision: 'fail', item: '1' }
 *   // { decision: ['thrown', Error('Invalid')], item: 'invalid' }
 *   // { decision: 'pass', item: '3' }
 * }
 * ```
 *
 * @example
 * ```ts
 * // Works with async predicates and iterables
 * async function* asyncNumbers() {
 *   yield 1;
 *   yield 2;
 *   yield 3;
 * }
 *
 * const gen = partition({
 *   predicate: async n => {
 *     await wait(10);
 *     return n % 2 === 0;
 *   },
 *   iterable: asyncNumbers()
 * });
 *
 * for await (const result of gen) {
 *   console.log(result);
 *   // { decision: 'fail', item: 1 }
 *   // { decision: 'pass', item: 2 }
 *   // { decision: 'fail', item: 3 }
 * }
 * ```
 */
export async function* $<T,>({ predicate, iterable, }: {
  predicate: (item: T,) => boolean | Promise<boolean>;
  iterable: Iterable<T> | AsyncIterable<T>;
},): AsyncGenerator<
  { decision: 'pass' | 'fail' | ['thrown', unknown,]; item: T; },
  void,
  undefined
> {
  for await (const item of iterable) {
    try {
      const result = await predicate(item,);
      yield (result ? { decision: 'pass', item, } : { decision: 'fail', item, });
    }
    catch (error) {
      yield { decision: ['thrown', error,], item, };
    }
  }
}