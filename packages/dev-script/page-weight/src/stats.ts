/**
 * Distribution summary for a finite sample of numbers.
 *
 * Reports the four stats the user cares about: min, max, mean, median.
 * Standard deviation is intentionally omitted -- it adds noise to a short
 * CLI report and rarely drives action.
 */
import {
  $ as notNullishOrThrow,
} from '@monochromatic-dev/module-es/not-nullish-or-throw';

/**
 * Aggregate description of a numeric sample.
 */
export type Stats = {
  /** Number of observations. */
  count: number;
  /** Smallest observation. */
  min: number;
  /** Largest observation. */
  max: number;
  /** Arithmetic mean (sum / count). */
  mean: number;
  /** Median; for even samples, the average of the two middle values. */
  median: number;
  /** Sum of all observations. */
  sum: number;
};

/**
 * Ascending numeric comparator for `Array#toSorted`.
 *
 * @param a - left operand
 *
 * @param b - right operand
 *
 * @returns negative if `a < b`, positive if `a > b`, zero when equal
 */
function ascending(
  a: number,
  b: number,
): number {
  return a - b;
}

/**
 * Addition reducer used to sum a numeric array.
 *
 * @param acc - running total
 *
 * @param value - next value to add
 *
 * @returns updated total
 */
function add(
  acc: number,
  value: number,
): number {
  return acc + value;
}

/**
 * Computes the median of an already-sorted-ascending array of numbers.
 *
 * @param sorted - ascending-sorted observations (non-empty)
 *
 * @returns middle value for odd-length input, average of the two middle values for even-length
 *
 * @example
 * ```ts
 * medianOfSorted([1, 2, 3]); // 2
 * medianOfSorted([1, 2, 3, 4]); // 2.5
 * ```
 */
function medianOfSorted(sorted: readonly number[],): number {
  if (sorted.length === 0)
    throw new Error('cannot compute median of empty sample',);
  const mid = Math.floor(sorted.length / 2,);
  if (sorted.length % 2 === 1)
    return notNullishOrThrow(sorted[mid],);
  const low = notNullishOrThrow(sorted[mid - 1],);
  const high = notNullishOrThrow(sorted[mid],);
  return (low + high) / 2;
}

/**
 * Computes min, max, mean, median, sum for a sample.
 *
 * Throws when given an empty sample -- an empty distribution has no
 * meaningful summary, and silently returning zeros would mask bugs
 * in the caller's data pipeline.
 *
 * @param sample - observations; must contain at least one value
 *
 * @returns aggregate description
 *
 * @throws when `sample.length` is zero
 *
 * @example
 * ```ts
 * summarize([1, 2, 3, 4]);
 * // { count: 4, min: 1, max: 4, mean: 2.5, median: 2.5, sum: 10 }
 * ```
 */
export function summarize(sample: readonly number[],): Stats {
  if (sample.length === 0)
    throw new Error('cannot summarize an empty sample',);
  const sorted = sample.toSorted(ascending,);
  const sum = sorted.reduce(
    add,
    0,
  );
  return {
    count: sorted.length,
    min: notNullishOrThrow(sorted[0],),
    max: notNullishOrThrow(sorted.at(-1,),),
    mean: sum / sorted.length,
    median: medianOfSorted(sorted,),
    sum,
  };
}
