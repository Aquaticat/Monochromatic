/**
 * Statistical threshold computation and recent-result detection for canary history.
 *
 * Uses mean - 2*stddev for degradation thresholds (covers ~95% of normal variance),
 * so a model's baseline volatility is accounted for rather than using a fixed cutoff.
 */
import type { HistoryFile, ModelThreshold, } from './history-types.ts';

/** Minimum samples needed before statistical thresholds are meaningful */
const MIN_SAMPLES = 3;

/** Fallback threshold when insufficient history exists */
const DEFAULT_THRESHOLD = 0.4;

/** 24 hours in milliseconds */
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Computes a per-model degradation threshold from historical data.
 * Only considers successful (non-failed) runs.
 * @param model - OpenRouter model ID
 * @param history - full history
 * @returns computed threshold, or default if insufficient data
 */
export function computeThreshold(model: string, history: HistoryFile): ModelThreshold {
  const scores = history.entries
    .filter((entry) => entry.model === model && !entry.failed)
    .map((entry) => entry.overallScore);

  if (scores.length < MIN_SAMPLES) {
    return { model, mean: 0, stddev: 0, threshold: DEFAULT_THRESHOLD, sampleCount: scores.length, };
  }

  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);

  return { model, mean, stddev, threshold: Math.max(0, mean - 2 * stddev), sampleCount: scores.length, };
}

/**
 * Finds the timestamp of the most recent entry for a model.
 * @param model - OpenRouter model ID
 * @param history - full history
 * @returns most recent entry timestamp, or undefined if none
 */
export function lastRunTimestamp(model: string, history: HistoryFile): string | undefined {
  return history.entries.filter((entry) => entry.model === model).at(-1)?.timestamp;
}

/**
 * Checks whether a model has been tested within the last 24 hours.
 * @param model - OpenRouter model ID
 * @param history - full history
 * @returns true if recent results exist
 */
export function hasRecentResults(model: string, history: HistoryFile): boolean {
  const lastTs = lastRunTimestamp(model, history);
  if (lastTs === undefined) return false;
  return Date.now() - new Date(lastTs).getTime() < TWENTY_FOUR_HOURS_MS;
}

/**
 * Returns a set of "model:probeName" pairs tested within the last 24 hours.
 * Used to skip only specific probes for a model, allowing partial re-runs.
 * @param history - full history
 * @returns set of recent model-probe pairs (e.g. "anthropic/claude-sonnet-4.6:csv-rfc4180")
 */
export function getRecentModelProbePairs(history: HistoryFile): Set<string> {
  const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;
  const pairs = history.entries
    .filter((entry) => !entry.failed && new Date(entry.timestamp).getTime() >= cutoff)
    .flatMap((entry) =>
      Object.keys(entry.probeScores).map((probeName) => `${entry.model}:${probeName}`),
    );
  return new Set(pairs);
}
