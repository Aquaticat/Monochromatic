import type { Box, } from '../basic.ts';
import { arrayFromAsyncBasic, } from './array.fromAsyncBasic.ts';
import { notNullishOrThrow, } from './error.throw.ts';
import type { MaybeAsyncIterable, } from './iterable.basic.ts';
import type { Logged, } from './logged.basic.ts';
import { getDefaultLogger, } from './string.log.ts';

/**
 * Determines consensus value from multiple boxes using weighted voting.
 *
 * Groups boxes by their values.
 * sums the weights for each group (defaulting to 1), and returns the value
 * with the highest total weight.
 *
 * @param boxes - Iterable of boxes to evaluate for consensus
 * @param l - Optional logger for debugging (defaults to console logger)
 * @returns Promise resolving to the consensus value with highest total weight
 *
 * @throws {Error} When multiple values tie for the highest weight
 * @throws {Error} When no boxes are provided
 * @throws Will propagate any errors from equality comparisons
 *
 * @example
 * ```ts
 * // Simple consensus with default weights
 * const result = await boxesGetConsensus([
 *   {value: 'b'}
 * ]); // 'b'
 *
 * // Weighted consensus
 * const result = await boxesGetConsensus([
 *   {value: 'b', weight: 1},
 *   {value: 'b', weight: 2},
 *   {value: 'c', weight: 10}
 * ]); // 'c' (weight: 10 > 3)
 *
 * // Async iterable of boxes
 * const result = await boxesGetConsensus(async function*() {
 *   yield {value: 'test'};
 * }()); // 'test'
 * ```
 */
export async function boxesGetConsensus<const T = unknown,>(
  { boxes, l = getDefaultLogger(), }: {
    boxes: MaybeAsyncIterable<Box<T>>;
  } & Partial<Logged>,
): Promise<T> {
  l.trace(boxesGetConsensus.name,);

  // Convert iterable to array for processing
  const boxesArray = await arrayFromAsyncBasic({ iterable: boxes, },);

  if (boxesArray.length === 0)
    throw new Error('No boxes provided for consensus',);

  l.debug(`Processing ${boxesArray.length} boxes`,);

  const groupedByValue = Map.groupBy(boxesArray, function byValue({ value, },) {
    return value;
  },);

  const newBoxes =
    (Array.from(groupedByValue,).map(function getWeight([value, array,],): Required<Box> {
      return { value, weight: array.reduce(function(accumulator, { weight, },) {
        return accumulator + (weight ?? 1);
      }, 0,), };
    },))
      .toSorted(function byWeight({ weight: aWeight, }, { weight: bWeight, },) {
        return aWeight - bWeight;
      },) as [Required<Box<T>>, ...Required<Box<T>>[],];

  l.debug(`Grouped into ${newBoxes.length} unique values`,);

  const consensus = notNullishOrThrow(newBoxes.at(0,),);

  // Check for ties
  if (consensus.weight === newBoxes.at(1,)?.weight) {
    throw new Error(
      `Consensus tie detected`,
    );
  }

  l.debug(`Consensus reached with ${JSON.stringify(consensus,)}`,);

  return consensus.value;
}
