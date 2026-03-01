/**
 * Statistical threshold computation and recent-result detection for canary history.
 *
 * Uses mean - 2*stddev for degradation thresholds (covers ~95% of normal variance),
 * so a model's baseline volatility is accounted for rather than using a fixed cutoff.
 */
import { mean as computeMean, } from './math.ts';

import type { HistoryFile, ModelThreshold, OpenRouterModelId, } from './history-types.ts';

/** Minimum samples needed before statistical thresholds are meaningful */
const MIN_SAMPLES = 3;

/** Fallback threshold when insufficient history exists */
const DEFAULT_THRESHOLD = 0.4;

/** Hours in a day */
const HOURS_PER_DAY = 24;

/** Minutes per hour */
const MINUTES_PER_HOUR = 60;

/** Seconds per minute */
const SECONDS_PER_MINUTE = 60;

/** Milliseconds per second */
const MS_PER_SECOND = 1000;

/** 24 hours in milliseconds */
const TWENTY_FOUR_HOURS_MS = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;

/**
 * Computes a per-model degradation threshold from historical data.
 * Only considers successful (non-failed) runs.
 * @param model - OpenRouter model ID
 * @param history - full history
 * @returns computed threshold, or default if insufficient data
 */
export function computeThreshold(model: OpenRouterModelId, history: HistoryFile): ModelThreshold {
  /** Historical overall scores for this model, excluding failed runs */
  const scores = history.entries
    .filter((entry) => entry.model === model && !entry.failed)
    .map((entry) => entry.overallScore);

  if (scores.length < MIN_SAMPLES) {
    return { model, mean: 0, stddev: 0, threshold: DEFAULT_THRESHOLD, sampleCount: scores.length, };
  }

  /** Arithmetic mean of historical scores -- the model's typical performance level */
  const mean = computeMean(scores);
  /**
   * Population variance (not sample variance) -- divides by N rather than N-1.
   * We use population variance because we are computing statistics over all observed
   * runs, not estimating a parameter from a sample of a larger population.
   */
  const variance = scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length;
  /** Standard deviation: sqrt of variance, in the same units as the scores */
  const stddev = Math.sqrt(variance);

  // Threshold = mean - 2*stddev: any score more than two standard deviations
  // below the model's historical mean is flagged as likely degradation.
  // Floored at 0 to avoid negative thresholds for extremely volatile models.
  return { model, mean, stddev, threshold: Math.max(0, mean - 2 * stddev), sampleCount: scores.length, };
}

/**
 * Finds the timestamp of the most recent entry for a model.
 * @param model - OpenRouter model ID
 * @param history - full history
 * @returns most recent entry timestamp, or undefined if none
 */
export function lastRunTimestamp(model: OpenRouterModelId, history: HistoryFile): string | undefined {
  return history.entries.filter((entry) => entry.model === model).at(-1)?.timestamp;
}

/**
 * Checks whether a model has been tested within the last 24 hours.
 * @param model - OpenRouter model ID
 * @param history - full history
 * @returns true if recent results exist
 */
export function hasRecentResults(model: OpenRouterModelId, history: HistoryFile): boolean {
  const lastTs = lastRunTimestamp(model, history);
  if (lastTs === undefined) return false;
  return Date.now() - new Date(lastTs).getTime() < TWENTY_FOUR_HOURS_MS;
}

/**
 * Returns a map from model ID to the set of probe names tested within the last 24 hours.
 *
 * Using a `Map<model, Set<probe>>` instead of a flat `Set<"model:probe">` preserves
 * the structural relationship between model and probe -- callers look up by model ID
 * then probe name without needing to know any composite string format.
 * @param history - full history
 * @returns map of model ID to set of recently-tested probe names
 */
export function getRecentModelProbePairs(history: HistoryFile): ReadonlyMap<string, ReadonlySet<string>> {
  const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;
  /** Mutable intermediate map: built up entry by entry before being returned as readonly */
  const result = new Map<string, Set<string>>();
  history.entries
    .filter((entry) => !entry.failed && new Date(entry.timestamp).getTime() >= cutoff)
    .forEach((entry) => {
      // eslint-disable-next-line no-restricted-syntax -- Object.keys is safe on a plain Record
      const existing = result.get(entry.model) ?? new Set<string>();
      for (const probeName of Object.keys(entry.probeScores)) {
        existing.add(probeName);
      }
      result.set(entry.model, existing);
    });
  return result;
}
