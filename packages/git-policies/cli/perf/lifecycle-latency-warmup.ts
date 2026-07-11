/**
 * Warm-up stability assertion for lifecycle latency benchmark.
 *
 * @module
 */

import { median, } from './lifecycle-latency-command.ts';
import {
  LifecycleBenchmarkError,
  WARMUP_RUNS,
  WARMUP_STABILITY_RATIO,
  WARMUP_WINDOW,
} from './lifecycle-latency-contracts.ts';

/**
 * Decimal places in warm-up diagnostics.
 */
const DECIMAL_PLACES = 3;

/**
 * Verifies adjacent warm-up windows reached bounded drift.
 *
 * @param id - stable scenario identity
 *
 * @param values - complete metric values including warm-ups
 *
 * @example
 * ```ts
 * assertStableWarmups({ id: 'status', values: [1, 1, 1, 1, 1, 1] });
 * ```
 */
export function assertStableWarmups({
  id,
  values,
}: Readonly<{
  id: string;
  values: readonly number[];
}>,): void {
  /**
   * Warm-up values excluded from recorded samples.
   */
  const warmups = values.slice(
    0,
    WARMUP_RUNS,
  );
  /**
   * Previous warm-up window median.
   */
  const previous = median(warmups.slice(
    0,
    WARMUP_WINDOW,
  ),);
  /**
   * Current warm-up window median.
   */
  const current = median(warmups.slice(WARMUP_WINDOW,),);
  /**
   * Relative median drift across adjacent windows.
   */
  const drift = Math.abs(current - previous,) / previous;
  if (drift > WARMUP_STABILITY_RATIO) {
    throw new LifecycleBenchmarkError(
      `${id} warm-up drift ${drift.toFixed(DECIMAL_PLACES,)} exceeded ${String(WARMUP_STABILITY_RATIO,)}.`,
    );
  }
}
