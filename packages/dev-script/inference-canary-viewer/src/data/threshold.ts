/**
 * Statistical degradation threshold computation.
 *
 * Reimplemented from the runner's deleted `history-stats.ts`.
 * Uses mean - 2*stddev floored at 0.3, requiring at least 3 samples.
 */
import {
  hasMultipleProbes,
  type ViewerEntry,
} from './viewer-types.ts';

/**
 * Minimum non-failed samples required before computing a meaningful threshold
 */
const MIN_SAMPLES = 3;

/**
 * Absolute floor for threshold values
 */
const THRESHOLD_FLOOR = 0.3;

/**
 * Number of standard deviations below the mean
 */
const STDDEV_MULTIPLIER = 2;

/**
 * Computed degradation threshold for a model
 */
export type ModelThreshold = {
  readonly model: string;
  readonly mean: number;
  readonly stddev: number;
  /**
   * Threshold = max(floor, mean - 2*stddev)
   */
  readonly threshold: number;
  readonly sampleCount: number;
};

/**
 * Computes a degradation threshold for a model from historical entries.
 *
 * Uses the statistical approach: threshold = mean - 2*stddev, floored at 0.3.
 * Returns the floor when fewer than 3 non-failed samples are available.
 *
 * @param label - model label to compute threshold for
 *
 * @param entries - all viewer entries
 *
 * @returns computed threshold with statistics
 *
 * @example
 * ```ts
 * const t = computeThreshold({ label: 'Sonnet 4.6', entries, });
 * // { model: '...', mean: 0.85, stddev: 0.05, threshold: 0.75, sampleCount: 10 }
 * ```
 */
export function computeThreshold({
  label,
  entries,
}: {
  readonly label: string;
  readonly entries: readonly ViewerEntry[];
},): ModelThreshold {
  /**
   * Non-failed overall scores used as the statistical sample.
   */
  const scores = entries
    .filter(function matchLabel(entry,): boolean {
      return (entry.label
        === label) && (!entry.failed)
        && hasMultipleProbes(entry,);
    },)
    .map(function getScore(entry,): number {
      return entry.overallScore;
    },);

  if (scores.length
    < MIN_SAMPLES) {
    return {
      model: label,
      mean: 0,
      stddev: 0,
      threshold: THRESHOLD_FLOOR,
      sampleCount: scores.length,
    };
  }

  /**
   * Arithmetic mean of the sample scores.
   */
  const mean = scores.reduce(
    function add(
      sum,
      score,
    ): number {
      return sum + score;
    },
    0,
  )
    / scores
    .length;
  /**
   * Squared-deviation average underlying the standard deviation.
   */
  const variance = scores.reduce(
    function addVariance(
      sum,
      score,
    ): number {
      return sum + ((score - mean) ** 2);
    },
    0,
  )
    / scores
    .length;
  /**
   * Sample standard deviation used to space the threshold below the mean.
   */
  const stddev = Math.sqrt(variance,);
  /**
   * Floored degradation threshold returned to callers.
   */
  const threshold = Math.max(
    THRESHOLD_FLOOR,
    mean - (STDDEV_MULTIPLIER * stddev),
  );

  return {
    model: label,
    mean,
    stddev,
    threshold,
    sampleCount: scores.length,
  };
}
