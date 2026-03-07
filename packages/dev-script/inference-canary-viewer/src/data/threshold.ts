/**
 * Statistical degradation threshold computation.
 *
 * Reimplemented from the runner's deleted `history-stats.ts`.
 * Uses mean - 2*stddev floored at 0.3, requiring at least 3 samples.
 */
import type { ViewerEntry, } from './viewer-types.ts';

/** Minimum non-failed samples required before computing a meaningful threshold */
const MIN_SAMPLES = 3;

/** Absolute floor for threshold values */
const THRESHOLD_FLOOR = 0.3;

/** Number of standard deviations below the mean */
const STDDEV_MULTIPLIER = 2;

/** Computed degradation threshold for a model */
export type ModelThreshold = {
  readonly model: string;
  readonly mean: number;
  readonly stddev: number;
  /** Threshold = max(floor, mean - 2*stddev) */
  readonly threshold: number;
  readonly sampleCount: number;
};

/**
 * Computes a degradation threshold for a model from historical entries.
 *
 * Uses the statistical approach: threshold = mean - 2*stddev, floored at 0.3.
 * Returns the floor when fewer than 3 non-failed samples are available.
 * @param model - model ID to compute threshold for
 * @param entries - all viewer entries
 * @returns computed threshold with statistics
 *
 * @example
 * ```ts
 * const t = computeThreshold('anthropic/claude-sonnet-4.6', entries);
 * // { model: '...', mean: 0.85, stddev: 0.05, threshold: 0.75, sampleCount: 10 }
 * ```
 */
export function computeThreshold(
  model: string,
  entries: readonly ViewerEntry[],
): ModelThreshold {
  const scores = entries
    .filter((entry) => entry.model === model && !entry.failed)
    .map((entry) => entry.overallScore);

  if (scores.length < MIN_SAMPLES) {
    return { model, mean: 0, stddev: 0, threshold: THRESHOLD_FLOOR, sampleCount: scores.length, };
  }

  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);
  const threshold = Math.max(THRESHOLD_FLOOR, mean - STDDEV_MULTIPLIER * stddev);

  return { model, mean, stddev, threshold, sampleCount: scores.length, };
}
