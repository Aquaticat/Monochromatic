import { equalAsync, } from './any.equal.ts';
import { arrayFromAsyncBasic, } from './array.fromAsyncBasic.ts';
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
 * to the total weight of the value it returns. Uses deep equality comparison
 * via `equalAsync` to group identical values.
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

  // Call all get methods concurrently
  const results = await Promise.all(
    getablesArray.map(async getable => ({
      value: await getable.get(key,),
      weight: getable.weight ?? 1,
    })),
  );

  l.debug(`Got ${results.length} results`,);

  // Group results by value using async equality comparison
  const valueGroups: Array<{ value: T; totalWeight: number; }> = [];

  for (const result of results) {
    // Find existing group with equal value
    let foundGroup = false;
    for (const group of valueGroups) {
      if (await equalAsync(group.value, result.value,)) {
        group.totalWeight += result.weight;
        foundGroup = true;
        break;
      }
    }

    // Create new group if no matching value found
    if (!foundGroup) {
      valueGroups.push({
        value: result.value,
        totalWeight: result.weight,
      },);
    }
  }

  l.debug(`Grouped into ${valueGroups.length} unique values`,);

  // Find maximum weight
  const maxWeight = Math.max(...valueGroups.map(group => group.totalWeight),);
  const maxWeightGroups = valueGroups.filter(group => group.totalWeight === maxWeight);

  // Check for ties
  if (maxWeightGroups.length > 1) {
    throw new Error(
      `Consensus tie detected: ${maxWeightGroups.length} values have the same maximum weight of ${maxWeight}`,
    );
  }

  // Safe to access [0] because we know there's at least one group and no ties
  const consensusValue = maxWeightGroups[0]!.value;
  l.debug(`Consensus reached with weight ${maxWeight}`,);

  return consensusValue;
}
