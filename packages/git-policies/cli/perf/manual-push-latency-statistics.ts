/**
 * Statistical helpers for repository-scale manual-push latency measurements.
 *
 * @module
 */

import {
  BenchmarkError,
  MINIMUM_WARMUPS,
  NINETY_FIFTH_PERCENTILE,
  STABILITY_RATIO,
  type Sample,
  WARMUP_WINDOW,
} from './manual-push-latency-contracts.ts';

/**
 * Copy numeric values in ascending order.
 *
 * @param values - Numeric values to order without mutation.
 *
 * @returns Ascending copy of numeric values.
 *
 * @example
 * ```ts
 * sortNumbers([2, 1]);
 * ```
 */
function sortNumbers(values: readonly number[]): readonly number[] {
  return values.toSorted(function compareNumbers(
    left: number,
    right: number,
  ): number {
    return left - right;
  });
}

/**
 * Read required numeric array element.
 *
 * @param values - Sequence containing required element.
 *
 * @param index - Position expected to exist.
 *
 * @returns Numeric element at requested position.
 *
 * @throws {@link BenchmarkError} when position is absent.
 *
 * @example
 * ```ts
 * requiredNumberAt({ values: [5], index: 0 });
 * ```
 */
function requiredNumberAt({
  values,
  index,
}: Readonly<{
  values: readonly number[];
  index: number;
}>): number {
  /**
   * Element whose presence is required by non-empty statistical input.
   */
  const value = values.at(index);
  if (value === undefined) {
    throw new BenchmarkError(`Missing numeric sample at index ${String(index)}.`);
  }
  return value;
}

/**
 * Calculate median of non-empty numeric samples.
 *
 * @param values - Samples whose midpoint represents central latency.
 *
 * @returns Median sample value.
 *
 * @throws {@link BenchmarkError} when no samples are supplied.
 *
 * @example
 * ```ts
 * median([1, 3, 2]);
 * ```
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) {
    throw new BenchmarkError('Cannot calculate median of empty samples.');
  }
  /**
   * Ordered copy used to locate sample midpoint.
   */
  const sorted = sortNumbers(values);
  /**
   * Integer midpoint index in ordered samples.
   */
  const middle = Math.floor(sorted.length / 2);
  if ((sorted.length % 2) !== 0) {
    return requiredNumberAt({
      values: sorted,
      index: middle
    });
  }
  /**
   * Lower midpoint for even sample counts.
   */
  const lower = requiredNumberAt({
    values: sorted,
    index: middle - 1
  });
  /**
   * Upper midpoint for even sample counts.
   */
  const upper = requiredNumberAt({
    values: sorted,
    index: middle
  });
  return (lower + upper) / 2;
}

/**
 * Calculate nearest-rank ninety-fifth percentile of non-empty samples.
 *
 * @param values - Samples whose upper-tail latency is required.
 *
 * @returns Ninety-fifth percentile sample value.
 *
 * @throws {@link BenchmarkError} when no samples are supplied.
 *
 * @example
 * ```ts
 * p95([1, 2, 3]);
 * ```
 */
export function p95(values: readonly number[]): number {
  if (values.length === 0) {
    throw new BenchmarkError('Cannot calculate percentile of empty samples.');
  }
  /**
   * Ordered copy used for nearest-rank lookup.
   */
  const sorted = sortNumbers(values);
  /**
   * Zero-based nearest-rank percentile position.
   */
  const rank = Math.ceil(sorted.length * NINETY_FIFTH_PERCENTILE) - 1;
  return requiredNumberAt({
    values: sorted,
    index: rank
  });
}

/**
 * Calculate median absolute deviation of non-empty samples.
 *
 * @param values - Samples whose robust spread is required.
 *
 * @returns Median distance from sample median.
 *
 * @throws {@link BenchmarkError} when no samples are supplied.
 *
 * @example
 * ```ts
 * medianAbsoluteDeviation([1, 2, 3]);
 * ```
 */
export function medianAbsoluteDeviation(values: readonly number[]): number {
  /**
   * Median used as robust distribution center.
   */
  const center = median(values);
  return median(values.map(function distanceFromCenter(value: number): number {
    return Math.abs(value - center);
  }));
}

/**
 * Extract direct Git latencies from paired samples.
 *
 * @param samples - Paired measurements.
 *
 * @returns Direct Git latency values in sample order.
 *
 * @example
 * ```ts
 * directValues([{ directMs: 1, wrapperMs: 2, addedMs: 1 }]);
 * ```
 */
export function directValues(samples: readonly Sample[]): readonly number[] {
  return samples.map(function selectDirect(sample: Sample): number {
    return sample.directMs;
  });
}

/**
 * Extract wrapper latencies from paired samples.
 *
 * @param samples - Paired measurements.
 *
 * @returns Wrapper latency values in sample order.
 *
 * @example
 * ```ts
 * wrapperValues([{ directMs: 1, wrapperMs: 2, addedMs: 1 }]);
 * ```
 */
export function wrapperValues(samples: readonly Sample[]): readonly number[] {
  return samples.map(function selectWrapper(sample: Sample): number {
    return sample.wrapperMs;
  });
}

/**
 * Extract wrapper-added latencies from paired samples.
 *
 * @param samples - Paired measurements.
 *
 * @returns Wrapper-added latency values in sample order.
 *
 * @example
 * ```ts
 * addedValues([{ directMs: 1, wrapperMs: 2, addedMs: 1 }]);
 * ```
 */
export function addedValues(samples: readonly Sample[]): readonly number[] {
  return samples.map(function selectAdded(sample: Sample): number {
    return sample.addedMs;
  });
}

/**
 * Determine whether recent warm-up windows have stable direct and wrapper medians.
 *
 * @param samples - Warm-up pairs accumulated in execution order.
 *
 * @returns Whether both measurements remain within stability ratio.
 *
 * @example
 * ```ts
 * warmupsAreStable([]);
 * ```
 */
export function warmupsAreStable(samples: readonly Sample[]): boolean {
  if (samples.length < MINIMUM_WARMUPS) {
    return false;
  }
  /**
   * Warm-up window immediately preceding current window.
   */
  const previous = samples.slice(
    -(2 * WARMUP_WINDOW),
    -WARMUP_WINDOW
  );
  /**
   * Most recently recorded warm-up window.
   */
  const current = samples.slice(-WARMUP_WINDOW);
  /**
   * Previous direct Git median used as drift denominator.
   */
  const previousDirect = median(directValues(previous));
  /**
   * Previous wrapper median used as drift denominator.
   */
  const previousWrapper = median(wrapperValues(previous));
  /**
   * Relative direct Git median drift between adjacent windows.
   */
  const directDrift = Math.abs(median(directValues(current)) - previousDirect) / previousDirect;
  /**
   * Relative wrapper median drift between adjacent windows.
   */
  const wrapperDrift = Math.abs(median(wrapperValues(current)) - previousWrapper) / previousWrapper;
  return (directDrift <= STABILITY_RATIO) && (wrapperDrift <= STABILITY_RATIO);
}
