import { arrayFromAsyncBasic, } from './array.fromAsyncBasic.ts';
import { boxesGetConsensus, } from './boxes.getConsensus.ts';
import type { Getable, } from './getable.basic.ts';
import type { MaybeAsyncIterable, } from './iterable.basic.ts';
import type { Logged, } from './logged.basic.ts';
import { getDefaultLogger, } from './string.log.ts';
import type { Box, } from './box.basic.ts';

/**
 * Determines consensus value from multiple getables using weighted voting.
 *
 * Calls `get({key})` on all getables concurrently and returns the value with the
 * highest total weight. Each getable contributes its weight (defaulting to 1)
 * to the total weight of the value it returns. Uses reference equality
 * to group identical values.
 *
 * @param getables - Iterable of getable objects to query for consensus
 * @param key - Key to pass to each getable's get method
 * @param l - Optional logger for debugging (defaults to console logger)
 * @returns Promise resolving to the consensus value with highest total weight
 *
 * @throws {Error} When multiple values tie for the highest weight
 * @throws {Error} When no getables are provided
 * @throws Will propagate any errors from individual getable.get() calls
 *
 * @example
 * ```ts
 * // Simple consensus with default weights
 * const result = await getablesGetConsensus({
 *   getables: [{get: ({key}) => 'b'}],
 *   key: 'a'
 * }); // 'b'
 *
 * // Weighted consensus
 * const result = await getablesGetConsensus({
 *   getables: [
 *     {get: ({key}) => 'b', weight: 1},
 *     {get: ({key}) => 'b', weight: 2},
 *     {get: ({key}) => 'c', weight: 10}
 *   ],
 *   key: 'a'
 * }); // 'c' (weight: 10 > 3)
 *
 * // Async getables
 * const result = await getablesGetConsensus({
 *   getables: async function*() {
 *     yield {get: async ({key}) => 'value'};
 *   }(),
 *   key: 'test'
 * }); // 'value'
 * ```
 */
export async function getablesGetConsensus<const T = unknown,>(
  { getables, key, l = getDefaultLogger(), }: {
    getables: MaybeAsyncIterable<Getable<string, T>>;
    key: string;
  } & Partial<Logged>,
): Promise<T | undefined> {
  l.trace(getablesGetConsensus.name,);

  // Convert iterable to array for concurrent processing
  const getablesArray = await arrayFromAsyncBasic({ iterable: getables, l, },);

  if (getablesArray.length === 0)
    throw new Error('No getables provided for consensus',);

  l.debug(`Processing ${getablesArray.length} getables`,);

  // Call all get methods concurrently and transform to boxes
  const boxes: Box<T | undefined>[] = await Promise.all(
    getablesArray.map(async function getableToBox(getable): Promise<Box<T | undefined>> {
      const value = await getable.get({ key, l, },);
      const box: Box<T | undefined> = { value, };
      if (getable.weight !== undefined) {
        box.weight = getable.weight;
      }
      return box;
    },),
  );

  l.debug(`Got ${boxes.length} results, delegating to boxesGetConsensus`,);

  // Delegate to boxesGetConsensus
  return await boxesGetConsensus({ boxes, l, },);
}