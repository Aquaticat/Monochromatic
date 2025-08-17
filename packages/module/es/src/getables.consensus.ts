import { arrayFromAsyncBasic, } from './array.fromAsyncBasic.ts';
import { boxesGetConsensusAsync, } from './boxes.getConsensus.ts';
import type { Getable, } from './getable.basic.ts';
import type { MaybeAsyncIterable, } from './iterable.type.maybe.ts';
import {
  consoleLogger,
  type Logger,
} from './string.log.ts';

/**
 * Determines consensus value from multiple getables using weighted voting.
 *
 * Calls `get(key)` on all getables concurrently and returns the value with the
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
 * const result = await getablesGetConsensusAsync({
 *   getables: [{get: () => 'b'}],
 *   key: 'a'
 * }); // 'b'
 *
 * // Weighted consensus
 * const result = await getablesGetConsensusAsync({
 *   getables: [
 *     {get: () => 'b', weight: 1},
 *     {get: () => 'b', weight: 2},
 *     {get: () => 'c', weight: 10}
 *   ],
 *   key: 'a'
 * }); // 'c' (weight: 10 > 3)
 *
 * // Async getables
 * const result = await getablesGetConsensusAsync({
 *   getables: async function*() {
 *     yield {get: async () => 'value'};
 *   }(),
 *   key: 'test'
 * }); // 'value'
 * ```
 */
export async function getablesGetConsensusAsync<const T = unknown,>(
  { getables, key, l = consoleLogger, }: {
    getables: MaybeAsyncIterable<Getable<T>>;
    key: string;
    l?: Logger;
  },
): Promise<T> {
  l.debug(`Starting consensus for key: ${key}`,);

  // Convert iterable to array for concurrent processing
  const getablesArray = await arrayFromAsyncBasic(getables,);

  if (getablesArray.length === 0)
    throw new Error('No getables provided for consensus',);

  l.debug(`Processing ${getablesArray.length} getables`,);

  // Call all get methods concurrently and transform to boxes
  const boxes = await Promise.all(
    getablesArray.map(async getable => {
      const box: { value: T; weight?: number; } = {
        value: await getable.get(key,),
      };
      if (getable.weight !== undefined) {
        box.weight = getable.weight;
      }
      return box;
    }),
  );

  l.debug(`Got ${boxes.length} results, delegating to boxesGetConsensusAsync`,);

  // Delegate to boxesGetConsensusAsync
  return await boxesGetConsensusAsync({ boxes, l, });
}
