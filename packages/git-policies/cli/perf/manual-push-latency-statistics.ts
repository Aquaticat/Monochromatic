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
  WARMUP_WINDOW,
} from './manual-push-latency-contracts.ts';
import type { Sample } from './manual-push-latency-contracts.ts';

/**
 * Compare numeric values in ascending order.
 *
 * @param left - Value placed on left side of comparison.
 *
 * @param right - Value placed on right side of comparison.
 *
 * @returns Negative, zero, or positive ordering value.
 *
 * @example
 * ```ts
 * [2, 1].toSorted(compareNumbers);
 * ```
 */
function compareNumbers(
  left: number,
  right: number
): number {
  return left - right;
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
  const sorted = values.toSorted(compareNumbers);
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
  const sorted = values.toSorted(compareNumbers);
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
 * Select direct latency from paired sample.
 *
 * @param sample - Paired measurement.
 *
 * @returns Direct Git latency.
 *
 * @example
 * ```ts
 * selectDirectMs({ directMs: 1, wrapperMs: 2, addedMs: 1 });
 * ```
 */
export function selectDirectMs(sample: Sample): number {
  return sample.directMs;
}

/**
 * Select wrapper latency from paired sample.
 *
 * @param sample - Paired measurement.
 *
 * @returns Wrapper latency.
 *
 * @example
 * ```ts
 * selectWrapperMs({ directMs: 1, wrapperMs: 2, addedMs: 1 });
 * ```
 */
export function selectWrapperMs(sample: Sample): number {
  return sample.wrapperMs;
}

/**
 * Select wrapper-added latency from paired sample.
 *
 * @param sample - Paired measurement.
 *
 * @returns Wrapper-added latency.
 *
 * @example
 * ```ts
 * selectAddedMs({ directMs: 1, wrapperMs: 2, addedMs: 1 });
 * ```
 */
export function selectAddedMs(sample: Sample): number {
  return sample.addedMs;
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
  const previousDirect = median(previous.map(selectDirectMs));
  /**
   * Previous wrapper median used as drift denominator.
   */
  const previousWrapper = median(previous.map(selectWrapperMs));
  /**
   * Relative direct Git median drift between adjacent windows.
   */
  const directDrift = Math.abs(median(current.map(selectDirectMs)) - previousDirect) / previousDirect;
  /**
   * Relative wrapper median drift between adjacent windows.
   */
  const wrapperDrift = Math.abs(median(current.map(selectWrapperMs)) - previousWrapper) / previousWrapper;
  return (directDrift <= STABILITY_RATIO) && (wrapperDrift <= STABILITY_RATIO);
}
